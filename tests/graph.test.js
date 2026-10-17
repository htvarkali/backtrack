import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { hydrateGraph, searchGraph } from '../frontend/src/data/graph.js';
import {
  analyzeAncestry,
  compositionByFamily,
  compositionByGeneration,
  expandedInfluences,
  initialExpandedNodes,
  influenceParents,
} from '../frontend/src/utils/ancestry.js';
import { buildSongLayout } from '../frontend/src/utils/layout.js';

const raw = JSON.parse(fs.readFileSync(new URL('../frontend/public/data/graph.json', import.meta.url), 'utf8'));
const graph = hydrateGraph(raw);

test('all curated sample edges and historical influences resolve to records', () => {
  assert.equal(graph.songs.length, 179);
  assert.equal(graph.samples.length, 119);
  assert.equal(graph.deep.length, 88);
  for (const edge of graph.samples) {
    assert.ok(graph.byId.has(edge.from), edge.from);
    assert.ok(graph.byId.has(edge.to), edge.to);
  }
  for (const edges of graph.influencesOf.values()) {
    for (const edge of edges) {
      assert.ok(graph.byId.has(edge.from), edge.from);
      assert.ok(graph.byId.has(edge.to), edge.to);
    }
  }
});

test('every song ancestry conserves its full composition across generations and families', () => {
  for (const song of graph.songs) {
    const ancestry = analyzeAncestry(graph, song.id);
    const sum = (values) => [...values].reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(sum(ancestry.contrib.values()) - 1) < 1e-9, song.id);
    assert.ok(Math.abs(sum(compositionByGeneration(graph, ancestry).map((generation) => generation.total)) - 1) < 1e-9, song.id);
    assert.ok(Math.abs(sum(compositionByFamily(graph, ancestry, true).map((family) => family.share)) - 1) < 1e-9, song.id);
    for (const share of ancestry.contrib.values()) {
      assert.ok(Number.isFinite(share) && share >= 0 && share <= 1, song.id);
    }
  }
});

test('the Gold Digger report has the expected 40/24/36 split', () => {
  const ancestry = analyzeAncestry(graph, 'gold-digger');
  assert.equal(ancestry.contrib.get('gold-digger'), 0.4);
  assert.equal(ancestry.contrib.get('i-got-a-woman'), 0.24);
  assert.equal(ancestry.contrib.get('it-must-be-jesus'), 0.36);
  assert.equal(ancestry.depth, 2);
  assert.equal(ancestry.oldest.year, 1954);
});

test('all 267 song, genre, and tradition ancestry produce finite, complete layouts', () => {
  for (const record of [...graph.songs, ...graph.deep]) {
    const layout = buildSongLayout(graph, record.id);
    assert.ok(layout.nodes.has(record.id), record.id);
    for (const node of layout.nodes.values()) {
      assert.ok(Number.isFinite(node.x) && Number.isFinite(node.y) && node.r > 0, `${record.id}: ${node.id}`);
    }
    for (const edge of layout.edges) {
      assert.ok(layout.nodes.has(edge.from), `${record.id}: ${edge.from}`);
      assert.ok(layout.nodes.has(edge.to), `${record.id}: ${edge.to}`);
    }
    for (const bound of Object.values(layout.bounds)) assert.ok(Number.isFinite(bound), record.id);
  }
});

test('deep expansion exposes gospel and then its documented historical parents', () => {
  const expanded = initialExpandedNodes(graph, 'gold-digger');
  assert.equal(expandedInfluences(graph, 'gold-digger', expanded).nodes.size, 0);
  expanded.add('it-must-be-jesus');
  assert.ok(expandedInfluences(graph, 'gold-digger', expanded).nodes.has('genre:gospel'));
  expanded.add('genre:gospel');
  const next = expandedInfluences(graph, 'gold-digger', expanded);
  for (const parent of influenceParents(graph, 'genre:gospel')) assert.ok(next.nodes.has(parent));
});

test('crate search handles punctuation, accents, empty input, and multiword artist queries', () => {
  assert.equal(searchGraph(graph, 'Gold Digger')[0].id, 'gold-digger');
  assert.ok(searchGraph(graph, 'Beyonce').some((song) => song.artist === 'Beyoncé'));
  assert.ok(searchGraph(graph, 'kanye stronger').some((song) => song.id === 'stronger'));
  assert.deepEqual(searchGraph(graph, '  '), []);
  assert.deepEqual(searchGraph(graph, 'no matching song zzzzzzzzzz'), []);
});

test('all mirrored artwork files and font files exist locally', () => {
  const manifest = JSON.parse(fs.readFileSync(new URL('../frontend/public/data/asset-manifest.json', import.meta.url), 'utf8'));
  const publicRoot = new URL('../frontend/public/', import.meta.url);
  let checked = 0;
  const visit = (value) => {
    if (!value || typeof value !== 'object') return;
    if (typeof value.art === 'string' && value.art.startsWith('/artwork/')) {
      assert.ok(fs.statSync(new URL(value.art.slice(1), publicRoot)).size > 0, value.art);
      checked++;
    }
    for (const child of Object.values(value)) if (typeof child === 'object') visit(child);
  };
  visit(raw);
  assert.equal(checked, 546);
  assert.ok(manifest);
  assert.ok(fs.statSync(new URL('fonts/fonts.css', publicRoot)).size > 0);
});
