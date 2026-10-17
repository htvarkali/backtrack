import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeContributions } from '../frontend/src/data/contributions.js';
import { hydrateGraph } from '../frontend/src/data/graph.js';
import { analyzeAncestry } from '../frontend/src/utils/ancestry.js';

const fixture = () => ({
  songs: [{ id: 'new-song', title: 'New Song', artist: 'New Artist', year: 2020, genres: [] }],
  samples: [], genres: [], families: [], traditions: [], influences: [], featured: [],
});
const parentLink = { title: 'New Song', artist: 'New Artist', sampleTitle: 'Older Song', sampleArtist: 'Older Artist', sampleYear: 1980, part: 'vocal' };
const grandparentLink = { title: 'Older Song', artist: 'Older Artist', sampleTitle: 'Oldest Song', sampleArtist: 'Oldest Artist', sampleYear: 1950 };

test('saved contributions restore complete chains in a fresh browser regardless of save order', () => {
  const original = fixture();
  const restored = mergeContributions(original, [grandparentLink, parentLink]);
  assert.equal(restored.songs.length, 3);
  assert.equal(restored.samples.length, 2);
  assert.equal(original.songs.length, 1);
  assert.equal(original.samples.length, 0);
  const report = analyzeAncestry(hydrateGraph(restored), 'new-song');
  assert.equal(report.depth, 2);
  assert.equal(report.oldest.year, 1950);
  assert.equal(report.contrib.get('new-song'), 0.4);
});

test('repeated restoration does not duplicate links or introduce cycles', () => {
  const graph = mergeContributions(fixture(), [parentLink, grandparentLink]);
  const reverse = { title: 'Oldest Song', artist: 'Oldest Artist', sampleTitle: 'New Song', sampleArtist: 'New Artist' };
  const restored = mergeContributions(graph, [parentLink, grandparentLink, reverse, null, { title: 'incomplete' }]);
  assert.equal(restored.samples.length, 2);
  assert.equal(restored.songs.length, 3);
  const report = analyzeAncestry(hydrateGraph(restored), 'new-song');
  assert.ok(Math.abs([...report.contrib.values()].reduce((total, value) => total + value, 0) - 1) < 1e-9);
});
