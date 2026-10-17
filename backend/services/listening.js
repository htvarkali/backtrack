import { createHash } from 'node:crypto';
import { AppError, normalized } from '../utils/errors.js';

const stableId = (value) => createHash('sha256').update(value).digest('hex').slice(0, 20);

export function parseListeningSource(value) {
  const spotifyUri = value.match(/^spotify:(playlist|album):([A-Za-z0-9]{22})$/);
  if (spotifyUri) return { provider: 'spotify', type: spotifyUri[1], id: spotifyUri[2] };
  let url;
  try { url = new URL(value); } catch { /* A bare ListenBrainz username is supported. */ }
  if (url) {
    if (url.protocol !== 'https:' || url.username || url.password || url.port) throw new AppError(400, 'Use a public Spotify link or a ListenBrainz username.', 'INVALID_SOURCE');
    if (url.hostname === 'open.spotify.com') {
      const match = url.pathname.match(/^\/(?:intl-[a-z]{2}\/)?(?:embed\/)?(playlist|album)\/([A-Za-z0-9]{22})\/?$/);
      if (!match) throw new AppError(400, 'Paste a Spotify playlist or album link.', 'INVALID_SOURCE');
      return { provider: 'spotify', type: match[1], id: match[2] };
    }
    if (['listenbrainz.org', 'www.listenbrainz.org'].includes(url.hostname)) {
      const match = url.pathname.match(/^\/user\/([^/]+)\/?$/);
      if (match) value = decodeURIComponent(match[1]);
      else throw new AppError(400, 'Use a ListenBrainz profile link or username.', 'INVALID_SOURCE');
    } else throw new AppError(400, 'Use a public Spotify playlist or album, or a ListenBrainz username.', 'INVALID_SOURCE');
  }
  const username = value.replace(/^@/, '');
  if (!/^[\p{L}\p{N}_. -]{1,64}$/u.test(username)) throw new AppError(400, 'That ListenBrainz username is not valid.', 'INVALID_SOURCE');
  return { provider: 'listenbrainz', username };
}

export function parseSpotifyEmbed(html) {
  const script = html.match(/<script\b[^>]*\bid=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
  if (!script) throw new AppError(502, 'Spotify did not return a readable public playlist. Try another public link.', 'SPOTIFY_UNAVAILABLE');
  let data;
  try { data = JSON.parse(script[1]); }
  catch { throw new AppError(502, 'Spotify returned an unreadable response. Please try again.', 'SPOTIFY_UNAVAILABLE'); }
  const entity = data.props?.pageProps?.state?.data?.entity;
  if (!entity || !Array.isArray(entity.trackList)) {
    throw new AppError(422, 'Spotify could not share that playlist or album. Check that the link is public and available in your region.', 'SPOTIFY_NOT_PUBLIC');
  }
  const tracks = entity.trackList.filter((track) => track.title && track.uri?.startsWith('spotify:track:')).map((track) => ({
    id: track.uri.split(':')[2], title: track.title, artist: track.subtitle ||
      (track.artists || []).map((artist) => artist.name).join(', '),
    art: track.album?.images?.[0]?.url || track.coverArt?.sources?.[0]?.url,
    url: `https://open.spotify.com/track/${track.uri.split(':')[2]}`,
    preview: track.audioPreview?.url || undefined,
  })).filter((track) => track.artist);
  if (!tracks.length) throw new AppError(422, 'This Spotify collection has no public tracks to import.', 'EMPTY_SOURCE');
  return { name: entity.name || entity.title || 'Spotify collection', recent: false, tracks,
    provider: 'spotify', importedCount: tracks.length,
    notice: 'Imported the tracks Spotify makes available in its public embed.' };
}

export function createListening({ upstream, storage, spotifyClientId, spotifyClientSecret }) {
  let tokenCache;
  async function spotifyApi(type, id) {
    if (!tokenCache || tokenCache.expiresAt < Date.now()) tokenCache = { value: await upstream('https://accounts.spotify.com/api/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${spotifyClientId}:${spotifyClientSecret}`).toString('base64')}` },
      body: 'grant_type=client_credentials',
    }), expiresAt: Date.now() + 45 * 60 * 1000 };
    const token = tokenCache.value;
    const get = (url) => upstream(url, { headers: { Authorization: `Bearer ${token.access_token}` } });
    const collection = await get(`https://api.spotify.com/v1/${type}s/${id}`);
    let page = collection.tracks;
    const items = [];
    for (let count = 0; page && count < 10; count += 1) {
      items.push(...(page.items || []));
      const next = page.next && new URL(page.next);
      if (!next || next.origin !== 'https://api.spotify.com') break;
      page = await get(next.href);
    }
    const tracks = items.map((item) => item.track || item).filter((track) => track?.id && track.name && !track.is_local).map((track) => ({
      id: track.id, title: track.name, artist: (track.artists || []).map((artist) => artist.name).join(', '),
      art: track.album?.images?.[0]?.url || (type === 'album' ? collection.images?.[0]?.url : undefined),
      url: track.external_urls?.spotify || `https://open.spotify.com/track/${track.id}`, preview: track.preview_url || undefined,
    }));
    if (!tracks.length) throw new AppError(422, 'This Spotify collection has no public tracks to import.', 'EMPTY_SOURCE');
    return { name: collection.name, recent: false, tracks, provider: 'spotify', importedCount: tracks.length,
      total: collection.tracks?.total, truncated: collection.tracks?.total > tracks.length };
  }

  return async function listening(input) {
    const source = parseListeningSource(input);
    return storage.cached(`listening:${JSON.stringify(source)}`, 5 * 60 * 1000, async () => {
      if (source.provider === 'spotify') {
        if (spotifyClientId && spotifyClientSecret) {
          try { return await spotifyApi(source.type, source.id); }
          catch { /* Public embed remains available without credentials or API account access. */ }
        }
        const html = await upstream(`https://open.spotify.com/embed/${source.type}/${source.id}`, { json: false });
        return parseSpotifyEmbed(html);
      }
      const data = await upstream(`https://api.listenbrainz.org/1/user/${encodeURIComponent(source.username)}/listens?count=100`);
      if (!Array.isArray(data.payload?.listens)) throw new AppError(502, 'ListenBrainz returned an unreadable listening history.', 'UPSTREAM_INVALID');
      const seen = new Set();
      const tracks = data.payload.listens.flatMap((listen) => {
        const metadata = listen.track_metadata || {};
        if (!metadata.track_name || !metadata.artist_name) return [];
        const key = `${normalized(metadata.track_name)}|${normalized(metadata.artist_name)}`;
        if (seen.has(key)) return [];
        seen.add(key);
        const mbid = metadata.mbid_mapping?.recording_mbid || metadata.additional_info?.recording_mbid;
        return [{ id: mbid || stableId(key), title: metadata.track_name, artist: metadata.artist_name,
          url: mbid ? `https://musicbrainz.org/recording/${mbid}` : `https://listenbrainz.org/user/${encodeURIComponent(source.username)}/`,
        }];
      });
      if (!tracks.length) throw new AppError(422, 'This ListenBrainz user has no recent public listens.', 'EMPTY_SOURCE');
      return { name: source.username, recent: true, tracks, provider: 'listenbrainz', importedCount: tracks.length };
    });
  };
}
