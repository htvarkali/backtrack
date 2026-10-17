import { normalized, sameRecording } from '../utils/errors.js';
import { musicbrainzSamples } from './musicbrainz-samples.js';

export function createSamples({ upstream, storage, graph }) {
  const byId = new Map(graph.songs.map((song) => [song.id, song]));

  function localSamples(title, artist) {
    const song = graph.songs.find((item) => sameRecording(item, { title, artist }));
    const found = (song ? graph.samples.filter((edge) => edge.from === song.id) : []).flatMap((edge) => {
      const sample = byId.get(edge.to);
      return sample ? [{ title: sample.title, artist: sample.artist, year: sample.year,
        type: edge.type === 'interpolation' ? 'interpolation' : 'sample',
        source: edge.source || '', sourceName: 'curated catalog' }] : [];
    });
    for (const item of storage.contributions()) {
      if (sameRecording(item, { title, artist })) found.push({ title: item.sampleTitle,
        artist: item.sampleArtist, year: item.sampleYear, type: 'sample',
        source: '', sourceName: 'local listeners' });
    }
    return found;
  }

  async function genius(title, artist, deadline) {
    const params = new URLSearchParams({ q: `${artist} ${title}` });
    const search = await upstream(`https://genius.com/api/search/multi?${params}`, { deadline });
    const hits = (search.response?.sections || []).flatMap((section) => section.hits || []);
    const match = hits.find((hit) => hit.type === 'song' && sameRecording({
      title: hit.result?.title || '', artist: hit.result?.primary_artist?.name || hit.result?.artist_names || '',
    }, { title, artist }));
    if (!match) return { found: [], sourceName: 'genius', checked: ['genius'] };
    const id = Number(match.result.id);
    if (!Number.isSafeInteger(id) || id <= 0) return { found: [], sourceName: 'genius', checked: ['genius'] };
    const data = await upstream(`https://genius.com/api/songs/${id}`, { deadline });
    const song = data.response?.song;
    const found = (song?.song_relationships || []).filter((relation) => ['samples', 'interpolates'].includes(relation.relationship_type || relation.type))
      .flatMap((relation) => (relation.songs || []).map((item) => ({
        title: item.title, artist: item.primary_artist?.name || item.artist_names,
        year: item.release_date_components?.year || undefined,
        type: (relation.relationship_type || relation.type) === 'interpolates' ? 'interpolation' : 'sample',
        source: song.url, sourceName: 'genius',
      }))).filter((item) => item.title && item.artist && !sameRecording(item, { title, artist }));
    return { found, url: song?.url || match.result.url, sourceName: 'genius', checked: ['genius'] };
  }

  return async function samples(title, artist) {
    const local = localSamples(title, artist);
    const deadline = Date.now() + 45000;
    let remote;
    try {
      remote = await storage.cached(`samples:${normalized(title)}|${normalized(artist)}`, 24 * 60 * 60 * 1000, () => genius(title, artist, deadline));
    } catch (error) {
      // Curated evidence is immediately available; do not add redundant requests.
      if (local.length) return { found: local, sourceName: 'curated catalog', checked: [], warning: error.message };
      try {
        remote = await storage.cached(`samples-musicbrainz-v1:${JSON.stringify([title, artist].map((text) => text.normalize('NFKC').toLowerCase()))}`, 60 * 60 * 1000,
          () => musicbrainzSamples({ upstream, title, artist, deadline }));
      } catch { throw error; }
    }
    const found = remote.found.filter((item) => !sameRecording(item, { title, artist }));
    for (const item of local) if (!found.some((other) => sameRecording(item, other))) found.push(item);
    return { ...remote, found };
  };
}
