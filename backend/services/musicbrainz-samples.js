import { AppError } from '../utils/errors.js';

const MBID = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
// Keep version labels: a remix or live performance must not match the original.
const exactText = (text = '') => text.toLowerCase().normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '').replace(/&/g, 'and').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const creditName = (recording) => (recording['artist-credit'] || [])
  .map((credit) => `${credit.name || credit.artist?.name || ''}${credit.joinphrase || ''}`).join('').trim();
const queryQuote = (text) => `"${text.replace(/["\\]/g, ' ')}"`;
const versionVariant = /\b(live|remix|mix|instrumental|karaoke|demo|edit|bootleg)\b/i;

function exactRecording(recording, title, artist) {
  return typeof recording.title === 'string' && exactText(recording.title) === exactText(title) &&
    exactText(creditName(recording)) === exactText(artist) && !recording.video &&
    !(versionVariant.test(recording.disambiguation || '') && !versionVariant.test(title));
}

export async function musicbrainzSamples({ upstream, title, artist, deadline }) {
  const searchParams = new URLSearchParams({ query: `recording:${queryQuote(title)} AND artist:${queryQuote(artist)}`, limit: '25', fmt: 'json' });
  const search = await upstream(`https://musicbrainz.org/ws/2/recording?${searchParams}`, { deadline });
  if (!Array.isArray(search.recordings)) throw new AppError(502, 'MusicBrainz returned an unreadable recording search.', 'UPSTREAM_INVALID');
  const releaseCount = (recording) => (recording.releases || []).reduce((total, release) => total + (Number(release.count) || 1), 0);
  const seenIds = new Set();
  const candidates = search.recordings.filter((recording) => {
    if (!MBID.test(recording.id || '') || seenIds.has(recording.id) || (Number(recording.score) || 0) < 90 || !exactRecording(recording, title, artist)) return false;
    seenIds.add(recording.id);
    return true;
  }).sort((a, b) => releaseCount(b) - releaseCount(a)).slice(0, 2);
  const details = await Promise.allSettled(candidates.map(async (candidate) => {
    const params = new URLSearchParams({ inc: 'recording-rels artist-credits', fmt: 'json' });
    const recording = await upstream(`https://musicbrainz.org/ws/2/recording/${candidate.id}?${params}`, { deadline });
    if (!exactRecording(recording, title, artist) || recording.id !== candidate.id) return [];
    if (!Array.isArray(recording.relations)) throw new AppError(502, 'MusicBrainz returned unreadable recording relationships.', 'UPSTREAM_INVALID');
    // https://musicbrainz.org/relationship/9efd9ce9-e702-448b-8e76-641515e8fe62
    // Forward: contains samples from. Backward: sampled by; never invert it.
    return recording.relations.filter((relation) => relation.type === 'samples material' &&
      relation.direction === 'forward' && relation.recording).flatMap((relation) => {
      const sample = relation.recording;
      const sampleArtist = creditName(sample);
      if (!sample.title || !sampleArtist || !MBID.test(sample.id || '') || sample.id === recording.id ||
        (exactText(sample.title) === exactText(title) && exactText(sampleArtist) === exactText(artist))) return [];
      const year = Number(sample['first-release-date']?.slice(0, 4)) || undefined;
      return [{ title: sample.title, artist: sampleArtist, year, type: 'sample',
        source: `https://musicbrainz.org/recording/${recording.id}`, sourceName: 'musicbrainz' }];
    });
  }));
  if (details.length && details.every((result) => result.status === 'rejected')) throw details[0].reason;
  const found = [];
  for (const result of details) {
    if (result.status !== 'fulfilled') continue;
    for (const item of result.value) if (!found.some((existing) => exactText(existing.title) === exactText(item.title) && exactText(existing.artist) === exactText(item.artist))) found.push(item);
  }
  const incomplete = details.some((result) => result.status === 'rejected');
  return { found, sourceName: 'musicbrainz', checked: ['musicbrainz'],
    warning: !candidates.length ? 'Genius is unavailable; MusicBrainz returned no exact recording match.' :
      incomplete ? 'Genius is unavailable and some MusicBrainz recordings could not be checked. These results are partial.' :
        'Genius is unavailable; these results include only samples documented by MusicBrainz.' };
}
