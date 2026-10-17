import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { syncBuiltinESMExports } from 'node:module';
import { request } from 'node:http';
import { setTimeout as delay } from 'node:timers/promises';
import { createApp } from '../app.js';
import { createServerlessStorage } from '../services/serverless-storage.js';

const graph = {
  songs: [
    { id: 'new', title: 'New Song', artist: 'New Artist', year: 2020 },
    { id: 'old', title: 'Old Song', artist: 'Old Artist', year: 1980 },
  ],
  samples: [{ from: 'new', to: 'old', source: 'https://example.org/source' }],
};
const contribution = { title: 'Third Song', artist: 'Third Artist', sampleTitle: 'New Song', sampleArtist: 'New Artist', sampleYear: 2020 };

async function cloudServer(t) {
  const storage = createServerlessStorage();
  const app = await createApp({ storage, graph, staticDir: false, fetchImpl: async () => new Response(JSON.stringify({ response: { sections: [] } })) });
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  return { url: `http://127.0.0.1:${server.address().port}`, storage };
}

function submit(url, body, headers = {}) {
  // Node fetch intentionally rewrites Host; use HTTP directly to simulate the
  // public Host header supplied by a serverless reverse proxy.
  return new Promise((resolve, reject) => {
    const outgoing = request(`${url}/api/contribute`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers } }, (incoming) => {
      const chunks = [];
      incoming.on('data', (chunk) => chunks.push(chunk));
      incoming.on('end', () => resolve(new Response(Buffer.concat(chunks), { status: incoming.statusCode })));
      incoming.on('error', reject);
    });
    outgoing.on('error', reject);
    outgoing.end(JSON.stringify(body));
  });
}

test('cloud app needs no filesystem and never retains visitor contributions', async (t) => {
  const touched = [];
  for (const method of ['readFile', 'writeFile', 'mkdir', 'rename', 'access']) {
    t.mock.method(fs, method, () => { touched.push(method); throw new Error('Filesystem is unavailable in this test'); });
  }
  syncBuiltinESMExports();
  t.after(() => { t.mock.restoreAll(); syncBuiltinESMExports(); });
  const { url, storage } = await cloudServer(t);
  assert.equal((await (await fetch(`${url}/api/health`)).json()).storage, 'browser');
  const first = await submit(url, contribution);
  assert.equal(first.status, 201);
  const item = await first.json();
  assert.equal(item.scope, 'browser');
  assert.equal(item.persisted, false);
  assert.match(item.createdAt, /^\d{4}-\d{2}-\d{2}T/);
  const second = await (await submit(url, { ...contribution, title: 'THIRD SONG' })).json();
  assert.equal(second.id, item.id, 'same canonical edge has a deterministic ID');
  assert.deepEqual(storage.contributions(), []);
  const visitorTwo = await (await fetch(`${url}/api/contributions`)).json();
  assert.deepEqual(visitorTwo, { contributions: [], scope: 'browser' });
  const samples = await (await fetch(`${url}/api/samples?title=Third%20Song&artist=Third%20Artist`)).json();
  assert.deepEqual(samples.found, [], 'visitor one must not change shared discovery');
  assert.deepEqual(touched, []);
});

test('hosted same-origin HTTPS is accepted while foreign and spoofed origins are rejected', async (t) => {
  const { url } = await cloudServer(t);
  const host = 'back-track-example.vercel.app';
  const headers = { Host: host, Origin: `https://${host}` };
  assert.equal((await submit(url, contribution, headers)).status, 201);
  for (const origin of ['https://foreign.example', `http://${host}`, 'http://localhost:5173', 'null', `https://${host}/invalid-path`]) {
    const rejected = await submit(url, contribution, { ...headers, Origin: origin, 'X-Forwarded-Host': 'foreign.example' });
    assert.equal(rejected.status, 403, origin);
    assert.equal((await rejected.json()).code, 'INVALID_ORIGIN');
  }
});

test('cloud contribution validation still rejects self-sampling and curated graph cycles', async (t) => {
  const { url } = await cloudServer(t);
  const self = await submit(url, { title: 'Same', artist: 'Artist', sampleTitle: 'Same', sampleArtist: 'Artist' });
  assert.equal(self.status, 400);
  assert.equal((await self.json()).code, 'SELF_SAMPLE');
  const cycle = await submit(url, { title: 'Old Song', artist: 'Old Artist', sampleTitle: 'New Song', sampleArtist: 'New Artist' });
  assert.equal(cycle.status, 409);
  assert.equal((await cycle.json()).code, 'SAMPLE_CYCLE');
});

test('cloud cache deduplicates in-flight lookups and returns isolated values', async () => {
  const storage = createServerlessStorage();
  let release;
  let loads = 0;
  const gate = new Promise((resolve) => { release = resolve; });
  const load = async () => { loads += 1; await gate; return { title: 'Track' }; };
  const first = storage.cached('same', 1000, load);
  const second = storage.cached('same', 1000, load);
  release();
  const [a, b] = await Promise.all([first, second]);
  a.title = 'Mutated';
  assert.equal(b.title, 'Track');
  assert.equal((await storage.cached('same', 1000, load)).title, 'Track');
  assert.equal(loads, 1);
});

test('cloud cache supports expiry, refresh, LRU bounds and oversized values', async () => {
  const storage = createServerlessStorage({ maxEntries: 2, maxBytes: 100 });
  let loads = 0;
  const load = async () => ({ value: ++loads });
  await storage.cached('a', 1000, load);
  await storage.cached('b', 1000, load);
  await storage.cached('a', 1000, load); // keep a most recently used
  await storage.cached('c', 1000, load); // evict b
  assert.equal((await storage.cached('a', 1000, load)).value, 1);
  assert.equal((await storage.cached('b', 1000, load)).value, 4);
  assert.equal((await storage.cached('b', 1000, load, { refresh: true })).value, 5);
  await storage.cached('expired', 1, load);
  await delay(5);
  assert.equal((await storage.cached('expired', 1000, load)).value, 7);
  const large = () => { loads += 1; return 'x'.repeat(101); };
  await storage.cached('large', 1000, large);
  await storage.cached('large', 1000, large);
  assert.equal(loads, 9, 'oversized data is returned without retaining it');
});

test('cloud cache bounds concurrent unique lookups and recovers from failures', async () => {
  const storage = createServerlessStorage({ maxInFlight: 1 });
  let release;
  const first = storage.cached('a', 1000, () => new Promise((resolve) => { release = resolve; }));
  await Promise.resolve();
  await assert.rejects(storage.cached('b', 1000, () => 2), (error) => error.status === 429);
  release(1);
  assert.equal(await first, 1);
  await assert.rejects(storage.cached('bad', 1000, () => { throw new Error('provider failed'); }), /provider failed/);
  assert.equal(await storage.cached('bad', 1000, () => 3), 3);
});
