import { AppError, normalized, sameRecording } from '../utils/errors.js';

const HOUR = 60 * 60 * 1000;
export const appleTrack = (item) => ({
  id: `it${item.trackId}`, title: item.trackName, artist: item.artistName,
  year: Number(item.releaseDate?.slice(0, 4)) || undefined,
  art: item.artworkUrl100?.replace(/\/\d+x\d+bb\./, '/600x600bb.'),
  url: item.trackViewUrl || '', preview: item.previewUrl,
});

function parameters(input, allowed) {
  const out = new URLSearchParams();
  for (const [key, value] of Object.entries(input)) {
    if (allowed.has(key) && typeof value === 'string' && value.length <= 5000) out.set(key, value);
  }
  return out;
}

export function createCatalog({ upstream, storage, graph }) {
  async function itunes(query, { refresh = false } = {}) {
    const params = parameters(query, new Set(['term', 'country', 'media', 'entity', 'attribute', 'limit', 'lang', 'version', 'explicit']));
    if (!params.get('term')?.trim()) throw new AppError(400, 'A search term is required.', 'INVALID_INPUT');
    params.set('entity', 'song');
    params.set('limit', String(Math.max(1, Math.min(50, Number(params.get('limit')) || 10))));
    params.sort();
    return storage.cached(`apple:${params}`, 24 * HOUR, () => upstream(`https://itunes.apple.com/search?${params}`), { refresh });
  }
  return {
    itunes,
    async wikipedia(query) {
      const params = parameters(query, new Set(['action', 'list', 'srsearch', 'srlimit', 'prop', 'rvprop', 'rvslots', 'redirects', 'titles', 'pageids', 'explaintext', 'exintro']));
      params.set('action', 'query');
      params.set('format', 'json');
      params.set('formatversion', '2');
      if (params.has('srlimit')) params.set('srlimit', String(Math.min(10, Number(params.get('srlimit')) || 6)));
      if (params.get('titles')?.split('|').length > 10) throw new AppError(400, 'At most ten Wikipedia titles may be requested.', 'INVALID_INPUT');
      params.sort();
      return storage.cached(`wikipedia:${params}`, 24 * HOUR, () => upstream(`https://en.wikipedia.org/w/api.php?${params}`));
    },
    async musicbrainz(path, query) {
      if (!/^(recording|work|artist|release|release-group)(\/[a-f0-9-]{36})?\/?$/i.test(path)) {
        throw new AppError(400, 'Unsupported MusicBrainz request.', 'INVALID_INPUT');
      }
      const params = parameters(query, new Set(['query', 'limit', 'offset', 'inc', 'fmt']));
      params.set('fmt', 'json');
      if (params.has('limit')) params.set('limit', String(Math.min(25, Number(params.get('limit')) || 10)));
      params.sort();
      return storage.cached(`musicbrainz:${path}?${params}`, 24 * HOUR, () => upstream(`https://musicbrainz.org/ws/2/${path}?${params}`));
    },
    async search(term) {
      const words = normalized(term).split(' ');
      const local = graph.songs.filter((song) => words.every((word) => normalized(`${song.title} ${song.artist}`).includes(word)))
        .slice(0, 12).map((song) => ({ ...song, url: song.link || '', local: true }));
      try {
        const data = await itunes({ term, limit: '15' });
        const external = (data.results || []).filter((item) => item.trackName && item.artistName).map(appleTrack);
        const tracks = [...local];
        for (const track of external) if (!tracks.some((item) => sameRecording(item, track))) tracks.push(track);
        return { tracks: tracks.slice(0, 20), results: data.results || [] };
      } catch (error) {
        if (!local.length) throw error;
        return { tracks: local, results: [], warning: error.message };
      }
    },
    async preview(title, artist, { refresh = false } = {}) {
      // Deezer URLs are signed and short-lived. Versioning also bypasses old cached nulls.
      return storage.cached(`preview-v2:${normalized(title)}|${normalized(artist)}`, 5 * 60 * 1000, async () => {
        const local = graph.songs.find((song) => sameRecording(song, { title, artist }));
        let providerError;
        try {
          const data = await itunes({ term: `${artist} ${title}`, limit: '10' }, { refresh });
          const found = (data.results || []).map(appleTrack).find((track) => track.preview && sameRecording(track, { title, artist }));
          if (found) return { preview: found.preview, art: found.art, year: found.year };
        } catch (error) { providerError = error; }
        try {
          const params = new URLSearchParams({ q: `${artist} ${title}`, limit: '15' });
          const data = await upstream(`https://api.deezer.com/search?${params}`);
          if (data.error) throw new AppError(502, 'Deezer could not look up that preview. Please try again.', 'UPSTREAM_FAILED');
          const found = (data.data || []).find((track) => track.preview && sameRecording({
            title: track.title || track.title_short || '', artist: track.artist?.name || '',
          }, { title, artist }));
          if (found) return { preview: found.preview, art: found.album?.cover_xl || found.album?.cover_big || local?.art || null, year: local?.year };
        } catch (error) { providerError ??= error; }
        if (!local?.preview && providerError) throw providerError;
        return { preview: local?.preview || null, art: local?.art || null, year: local?.year };
      }, { refresh });

    },
  };
}
