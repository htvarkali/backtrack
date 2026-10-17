import test from 'node:test';
import assert from 'node:assert/strict';
import { createUpstream } from '../services/upstream.js';

test('an expired shared research deadline prevents outbound calls', async () => {
  let calls = 0;
  const upstream = createUpstream({ fetchImpl: async () => { calls += 1; return new Response('{}'); } });
  await assert.rejects(upstream('https://musicbrainz.org/ws/2/recording?fmt=json', { deadline: Date.now() - 1 }),
    (error) => error.status === 504 && error.code === 'UPSTREAM_TIMEOUT');
  assert.equal(calls, 0);
});

test('MusicBrainz pacing does not wait beyond the shared research deadline', async () => {
  let calls = 0;
  const upstream = createUpstream({ fetchImpl: async () => { calls += 1; return new Response('{}'); } });
  await upstream('https://musicbrainz.org/ws/2/recording?fmt=json');
  await assert.rejects(upstream('https://musicbrainz.org/ws/2/recording?fmt=json', { deadline: Date.now() + 10 }),
    (error) => error.status === 504);
  assert.equal(calls, 1);
});
