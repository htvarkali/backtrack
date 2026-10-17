import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../app.js';
import { parseListeningSource, parseSpotifyEmbed } from '../services/listening.js';

const graph = {
  songs: [
    { id: 'modern', title: 'Modern Song', artist: 'Modern Artist', year: 2007, preview: 'https://example.org/preview.m4a' },
    { id: 'source', title: 'Source Song', artist: 'Source Artist', year: 1979 },
  ],
  samples: [{ from: 'modern', to: 'source', type: 'vocal', source: 'https://example.org/source' }],
};
const response = (data, status = 200) => new Response(typeof data === 'string' ? data : JSON.stringify(data), { status });
const unavailable = async () => { throw new Error('offline'); };
const contribute = (url, body, headers = {}) => fetch(`${url}/api/contribute`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body),
});
async function fixture(t, options = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'back-track-test-'));
  const app = await createApp({ graph, dataDir: directory, fetchImpl: unavailable, staticDir: false, ...options });
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await rm(directory, { recursive: true, force: true });
  });
  return { url: `http://127.0.0.1:${server.address().port}`, directory };
}

test('health reports real catalog counts and unknown endpoints return JSON', async (t) => {
  const { url } = await fixture(t);
  const health = await (await fetch(`${url}/api/health`)).json();
  assert.equal(health.ok, true);
  assert.equal(health.songs, 2);
  const unknown = await fetch(`${url}/api/missing`);
  assert.equal(unknown.status, 404);
  assert.equal((await unknown.json()).code, 'NOT_FOUND');
});

test('rejects malformed JSON, missing fields, unsafe origins, invalid years and self-samples', async (t) => {
  const { url } = await fixture(t);
  assert.equal((await fetch(`${url}/api/preview?title=Only`)).status, 400);
  assert.equal((await fetch(`${url}/api/listening?from=https://127.0.0.1/secrets`)).status, 400);
  const invalid = await fetch(`${url}/api/contribute`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' });
  assert.equal(invalid.status, 400);
  assert.equal((await invalid.json()).code, 'INVALID_JSON');
  const self = { title: 'Same Song', artist: 'Same Artist', sampleTitle: 'Same Song', sampleArtist: 'Same Artist' };
  assert.equal((await contribute(url, self)).status, 400);
  assert.equal((await contribute(url, self, { Origin: 'https://untrusted.example' })).status, 403);
  assert.equal((await contribute(url, { ...self, sampleTitle: 'Other', sampleYear: 999 })).status, 400);
});

test('curated samples and previews remain available when external providers fail', async (t) => {
  const { url } = await fixture(t);
  const query = new URLSearchParams({ title: 'Modern Song', artist: 'Modern Artist' });
  const samples = await (await fetch(`${url}/api/samples?${query}`)).json();
  assert.equal(samples.found[0].title, 'Source Song');
  assert.equal(samples.found[0].sourceName, 'curated catalog');
  assert.match(samples.warning, /Could not reach/);
  const preview = await (await fetch(`${url}/api/preview?${query}`)).json();
  assert.equal(preview.preview, graph.songs[0].preview);
  const unknown = await fetch(`${url}/api/samples?title=Unknown&artist=Unknown`);
  assert.equal(unknown.status, 502);
  assert.equal((await unknown.json()).code, 'UPSTREAM_UNAVAILABLE');
});

test('contributions are idempotent, durable, discoverable and protected from graph cycles', async (t) => {
  const { url, directory } = await fixture(t);
  const input = { title: 'Third Song', artist: 'Third Artist', sampleTitle: 'Modern Song', sampleArtist: 'Modern Artist', sampleYear: 2007, part: 'drum loop' };
  const results = await Promise.all([contribute(url, input), contribute(url, input)]);
  assert.deepEqual(results.map((item) => item.status).sort(), [200, 201]);
  const saved = await (await fetch(`${url}/api/contributions`)).json();
  assert.equal(saved.contributions.length, 1);
  assert.equal(saved.contributions[0].scope, 'local');
  assert.equal(JSON.parse(await readFile(join(directory, 'contributions.json'), 'utf8'))[0].part, 'drum loop');
  const found = await (await fetch(`${url}/api/samples?title=Third%20Song&artist=Third%20Artist`)).json();
  assert.equal(found.found[0].sourceName, 'local listeners');
  const cyclic = await contribute(url, { title: 'Source Song', artist: 'Source Artist', sampleTitle: 'Third Song', sampleArtist: 'Third Artist' });
  assert.equal(cyclic.status, 409);
  assert.equal((await cyclic.json()).code, 'SAMPLE_CYCLE');
  const reopened = await createApp({ graph, dataDir: directory, fetchImpl: unavailable, staticDir: false });
  const second = reopened.listen(0, '127.0.0.1');
  await new Promise((resolve) => second.once('listening', resolve));
  try {
    const restored = await (await fetch(`http://127.0.0.1:${second.address().port}/api/contributions`)).json();
    assert.equal(restored.contributions.length, 1);
  } finally { await new Promise((resolve) => second.close(resolve)); }
});

test('Genius discovery excludes reverse relationships, preserves source and caches lookups', async (t) => {
  let calls = 0;
  const { url } = await fixture(t, { fetchImpl: async (target) => {
    calls += 1;
    if (target.pathname === '/api/search/multi') return response({ response: { sections: [{ hits: [
      { type: 'song', result: { id: 10, title: 'Test Song', primary_artist: { name: 'Test Artist' } } },
    ] }] } });
    return response({ response: { song: { url: 'https://genius.com/Test-artist-test-song-lyrics', song_relationships: [
      { relationship_type: 'samples', songs: [{ title: 'Old Tune', primary_artist: { name: 'Old Artist' }, release_date_components: { year: 1972 } }] },
      { relationship_type: 'sampled_in', songs: [{ title: 'New Tune', primary_artist: { name: 'New Artist' } }] },
      { relationship_type: 'interpolates', songs: [{ title: 'Melody', primary_artist: { name: 'Composer' } }, { title: 'Test Song (Demo)', primary_artist: { name: 'Test Artist' } }] },
    ] } } });
  } });
  const path = `${url}/api/samples?title=Test%20Song&artist=Test%20Artist`;
  const data = await (await fetch(path)).json();
  assert.deepEqual(data.found.map((item) => item.title), ['Old Tune', 'Melody']);
  assert.equal(data.found[1].type, 'interpolation');
  assert.equal(data.found[0].year, 1972);
  assert.equal(data.found[0].source, data.url);
  await fetch(path);
  assert.equal(calls, 2);
});

test('catalog gateway uses fixed hosts and preview does not choose a different artist', async (t) => {
  const targets = [];
  const { url } = await fixture(t, { fetchImpl: async (target) => {
    targets.push(target.href);
    return response({ resultCount: 2, results: [
      { trackId: 1, trackName: 'New Song', artistName: 'Wrong Artist', previewUrl: 'https://example.org/wrong' },
      { trackId: 2, trackName: 'New Song', artistName: 'Right Artist', releaseDate: '1999-01-01', previewUrl: 'https://example.org/right', artworkUrl100: 'https://example.org/100x100bb.jpg' },
    ] });
  } });
  const data = await (await fetch(`${url}/api/search?q=New%20Song`)).json();
  assert.equal(data.tracks[1].year, 1999);
  const preview = await (await fetch(`${url}/api/preview?title=New%20Song&artist=Right%20Artist`)).json();
  assert.equal(preview.preview, 'https://example.org/right');
  assert.equal(preview.art, 'https://example.org/600x600bb.jpg');
  assert.ok(targets.every((target) => target.startsWith('https://itunes.apple.com/search?')));
  assert.equal((await fetch(`${url}/api/catalog/musicbrainz/https://evil.example`)).status, 400);
});

test('Spotify parser imports real tracks and rejects unreadable collections and foreign URLs', () => {
  const collection = { name: 'Public List', trackList: [
    { uri: 'spotify:track:123', title: 'Real Song', subtitle: 'Real Artist', audioPreview: { url: 'https://example.org/audio' } },
    { uri: 'spotify:episode:456', title: 'Podcast', subtitle: 'Host' },
  ] };
  const html = `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({ props: { pageProps: { state: { data: { entity: collection } } } } })}</script>`;
  const data = parseSpotifyEmbed(html);
  assert.equal(data.tracks.length, 1);
  assert.equal(data.tracks[0].id, '123');
  assert.equal(data.recent, false);
  assert.throws(() => parseSpotifyEmbed('<html>unavailable</html>'), /Spotify/);
  assert.equal(parseListeningSource('spotify:album:1234567890123456789012').type, 'album');
  assert.equal(parseListeningSource('https://open.spotify.com/intl-us/playlist/1234567890123456789012?si=x').type, 'playlist');
  assert.equal(parseListeningSource('https://listenbrainz.org/user/TestUser/').username, 'TestUser');
  assert.throws(() => parseListeningSource('https://open.spotify.com.evil.example/playlist/1234567890123456789012'), /public Spotify/);
});

test('ListenBrainz deduplicates real listens and returns an error for empty histories', async (t) => {
  const { url } = await fixture(t, { fetchImpl: async (target) => response({ payload: { listens: target.pathname.includes('empty') ? [] : [
    { track_metadata: { track_name: 'First Song', artist_name: 'First Artist', additional_info: { recording_mbid: 'recording-1' } } },
    { track_metadata: { track_name: 'First Song', artist_name: 'First Artist' } },
    { track_metadata: { track_name: 'Second Song', artist_name: 'Second Artist' } },
  ] } }) });
  const data = await (await fetch(`${url}/api/listening?from=testuser`)).json();
  assert.equal(data.tracks.length, 2);
  assert.equal(data.tracks[0].id, 'recording-1');
  assert.equal(data.recent, true);
  assert.equal((await fetch(`${url}/api/listening?from=empty`)).status, 422);
});

test('upstream timeout and provider 404 produce errors without fake results', async (t) => {
  const { url } = await fixture(t, { fetchImpl: async (target) => {
    if (target.pathname.includes('missing')) return response({}, 404);
    throw new DOMException('timeout', 'TimeoutError');
  } });
  assert.equal((await fetch(`${url}/api/listening?from=missing`)).status, 404);
  const timeout = await fetch(`${url}/api/listening?from=slow`);
  assert.equal(timeout.status, 504);
  assert.equal((await timeout.json()).code, 'UPSTREAM_TIMEOUT');
});

test('Deezer fills Apple catalog gaps, skips wrong artists and expires signed previews within five minutes', async (t) => {
  const calls = [];
  const missingPreviewGraph = { songs: [{ id: 'blood', title: 'Blood on the Leaves', artist: 'Kanye West', year: 2013 }], samples: [] };
  const { url, directory } = await fixture(t, { graph: missingPreviewGraph, fetchImpl: async (target) => {
    calls.push(target.hostname);
    if (target.hostname === 'itunes.apple.com') return response({ results: [] });
    return response({ data: [
      { title: 'Blood On The Leaves', artist: { name: 'Cover Artist' }, preview: 'https://example.org/wrong.mp3' },
      { title: 'Blood On The Leaves', artist: { name: 'Kanye West' }, preview: 'https://cdn-preview.deezer.com/signed.mp3', album: { cover_xl: 'https://example.org/yeezus.jpg' } },
    ] });
  } });
  const path = `${url}/api/preview?title=Blood%20on%20the%20Leaves&artist=Kanye%20West`;
  const data = await (await fetch(path)).json();
  assert.equal(data.preview, 'https://cdn-preview.deezer.com/signed.mp3');
  assert.equal(data.year, 2013);
  assert.equal(data.art, 'https://example.org/yeezus.jpg');
  await fetch(path);
  assert.deepEqual(calls, ['itunes.apple.com', 'api.deezer.com']);
  const cache = JSON.parse(await readFile(join(directory, 'cache.json'), 'utf8'));
  const entry = cache['preview-v2:blood on the leaves|kanye west'];
  assert.ok(entry.expiresAt > Date.now());
  assert.ok(entry.expiresAt <= Date.now() + 5 * 60 * 1000);
  await fetch(`${path}&refresh=1`);
  assert.deepEqual(calls, ['itunes.apple.com', 'api.deezer.com', 'itunes.apple.com', 'api.deezer.com']);
});

test('preview refresh bypasses successful Apple metadata and outer preview caches', async (t) => {
  let count = 0;
  const { url } = await fixture(t, { fetchImpl: async () => response({ results: [{
    trackId: 100, trackName: 'Song', artistName: 'Artist', previewUrl: `https://example.org/preview-${++count}.m4a`,
  }] }) });
  const path = `${url}/api/preview?title=Song&artist=Artist`;
  assert.equal((await (await fetch(path)).json()).preview, 'https://example.org/preview-1.m4a');
  assert.equal((await (await fetch(path)).json()).preview, 'https://example.org/preview-1.m4a');
  assert.equal((await (await fetch(`${path}&refresh=1`)).json()).preview, 'https://example.org/preview-2.m4a');
});

test('local development contributions accept the localhost frontend origin', async (t) => {
  const { url } = await fixture(t);
  const result = await contribute(url, { title: 'Third Song', artist: 'Third Artist', sampleTitle: 'Source Song', sampleArtist: 'Source Artist' }, { Origin: 'http://localhost:5173' });
  assert.equal(result.status, 201);
  assert.equal((await result.json()).scope, 'local');
  assert.equal((await (await fetch(`${url}/api/health`)).json()).storage, 'local');
});

test('Genius failure falls back to bounded, exact MusicBrainz recordings and forward samples only', async (t) => {
  const id = (number) => `00000000-0000-0000-0000-${String(number).padStart(12, '0')}`;
  const recording = (number, changes = {}) => ({ id: id(number), title: 'Test Song', score: 100,
    'artist-credit': [{ name: 'Test Artist' }], releases: [{ count: 10 - number }], ...changes });
  const relation = (number, changes = {}) => ({ type: 'samples material', direction: 'forward',
    recording: { id: id(number), title: 'Source Tune', 'artist-credit': [{ name: 'Source Artist' }], 'first-release-date': '1973-01-01' }, ...changes });
  const requested = [];
  const { url } = await fixture(t, { fetchImpl: async (target) => {
    if (target.hostname === 'genius.com') return response({}, 403);
    requested.push(target.pathname);
    if (target.pathname === '/ws/2/recording') return response({ recordings: [
      recording(8, { 'artist-credit': [{ name: 'Wrong Artist' }], releases: [{ count: 1000 }] }),
      recording(9, { title: 'Test Song (Remix)' }),
      recording(10, { disambiguation: 'live at a concert' }),
      recording(11, { score: 50 }),
      recording(1), recording(2), recording(3),
    ] });
    const number = target.pathname.endsWith(id(1)) ? 1 : 2;
    assert.equal(target.searchParams.get('inc'), 'recording-rels artist-credits');
    return response({ ...recording(number), relations: [relation(20),
      relation(21, { direction: 'backward' }), relation(22, { type: 'remix' }),
      relation(number, { recording: { id: id(number), title: 'Test Song', 'artist-credit': [{ name: 'Test Artist' }] } }),
      relation(23, { recording: { id: id(23), title: 'No credited performer' } }),
    ] });
  } });
  const path = `${url}/api/samples?title=Test%20Song&artist=Test%20Artist`;
  const data = await (await fetch(path)).json();
  assert.equal(data.sourceName, 'musicbrainz');
  assert.deepEqual(data.checked, ['musicbrainz']);
  assert.match(data.warning, /Genius is unavailable/);
  assert.equal(data.found.length, 1);
  assert.deepEqual(data.found[0], { title: 'Source Tune', artist: 'Source Artist', year: 1973, type: 'sample',
    source: `https://musicbrainz.org/recording/${id(1)}`, sourceName: 'musicbrainz' });
  assert.deepEqual(requested, ['/ws/2/recording', `/ws/2/recording/${id(1)}`, `/ws/2/recording/${id(2)}`]);
  await fetch(path);
  assert.equal(requested.length, 3, 'fallback results are cached without repeating MusicBrainz requests');
});

test('MusicBrainz without an exact recording returns an honest attributed empty partial lookup', async (t) => {
  let requests = 0;
  const { url } = await fixture(t, { fetchImpl: async (target) => {
    if (target.hostname === 'genius.com') return response({}, 403);
    requests += 1;
    return response({ recordings: [{ id: '00000000-0000-0000-0000-000000000001', title: 'Teardrop', score: 100,
      'artist-credit': [{ name: 'A Cover Band' }] }] });
  } });
  const result = await fetch(`${url}/api/samples?title=Teardrop&artist=Massive%20Attack`);
  assert.equal(result.status, 200);
  const data = await result.json();
  assert.deepEqual(data.found, []);
  assert.equal(data.sourceName, 'musicbrainz');
  assert.match(data.warning, /no exact recording match/);
  assert.equal(requests, 1);
});

test('curated samples avoid extra MusicBrainz work when Genius is unavailable', async (t) => {
  const hosts = [];
  const { url } = await fixture(t, { fetchImpl: async (target) => { hosts.push(target.hostname); return response({}, 403); } });
  const data = await (await fetch(`${url}/api/samples?title=Modern%20Song&artist=Modern%20Artist`)).json();
  assert.equal(data.found[0].title, 'Source Song');
  assert.equal(data.sourceName, 'curated catalog');
  assert.deepEqual(data.checked, []);
  assert.deepEqual(hosts, ['genius.com']);
});
