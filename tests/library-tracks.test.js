import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  composeLibraryTracks,
  createStripTimeline,
  libraryTrackStatus,
  resolveImportedTracks,
} from "../frontend/src/utils/libraryTracks.js";

const selectedTracks = JSON.parse(
  await readFile(new URL("../frontend/src/data/libraryTracks.json", import.meta.url)),
);

test("the default library retains all 11 selected tracks in the saved mixed order", () => {
  const tracks = composeLibraryTracks([], selectedTracks);
  assert.equal(tracks.length, 11);
  assert.deepEqual(tracks.map((track) => track.id), selectedTracks.map((track) => track.id));
  assert.equal(new Set(tracks.map((track) => track.id)).size, 11);
  assert.ok(tracks.every((track) => Number.isFinite(track.year)));
});

test("personal order wins while selected recordings stay present with verified metadata", () => {
  const match = selectedTracks.find((track) => track.title === "Classic");
  const imported = [
    { id: "personal-one", title: "Personal Track", artist: "Other Artist", year: 2020 },
    { id: "imported-match", title: match.title.toUpperCase(), artist: match.artist, year: 2099, guessed: true },
    { id: "personal-two", title: "Another Track", artist: "Other Artist", year: 2021 },
  ];
  const snapshot = structuredClone(imported);
  const tracks = composeLibraryTracks(imported, selectedTracks);
  assert.deepEqual(tracks.slice(0, 3).map((track) => track.id), ["personal-one", match.id, "personal-two"]);
  assert.equal(tracks[1].year, match.year);
  assert.equal(tracks[1].preview, match.preview);
  assert.equal(tracks.length, 13);
  assert.ok(selectedTracks.every((selected) => tracks.some((track) => track.id === selected.id)));
  assert.deepEqual(imported, snapshot, "composition must not modify imported storage values");
});

test("duplicate listening entries collapse without dropping another artist's recording", () => {
  const tracks = composeLibraryTracks([
    { id: "first", title: "Example", artist: "Drake" },
    { id: "repeat", title: "EXAMPLE (Remastered)", artist: "Drake" },
    { id: "different", title: "Example", artist: "Bryson Tiller" },
  ]);
  assert.deepEqual(tracks.map((track) => track.id), ["first", "different"]);
});

test("preparation gets verified overlapping metadata but never enqueues default-only tracks", () => {
  const selected = selectedTracks.find((track) => track.title === "Don't");
  const imported = [
    { id: "playlist-recording", title: selected.title, artist: selected.artist, year: 2026, guessed: true },
    { id: "personal-track", title: "A Personal Track", artist: "Another Artist", year: 2026, guessed: true },
  ];
  const prepared = resolveImportedTracks(imported, selectedTracks);
  assert.equal(prepared.length, 2);
  assert.deepEqual(prepared[0], selected);
  assert.equal(prepared[0].year, 2015);
  assert.equal(prepared[0].guessed, undefined);
  assert.deepEqual(prepared[1], imported[1]);
  assert.deepEqual(resolveImportedTracks([], selectedTracks), []);
});

test("remix, live, and instrumental imports remain separate from the selected recording", () => {
  const selected = selectedTracks.find((track) => track.title === "Exchange");
  const imports = ["Remix", "Live", "Instrumental"].map((version) => ({
    id: `import-${version}`,
    title: `Exchange (${version})`,
    artist: "Bryson Tiller",
  }));
  assert.deepEqual(resolveImportedTracks(imports, selectedTracks), imports);
  const combined = composeLibraryTracks(imports, [selected]);
  assert.deepEqual(combined.map((track) => track.id), [...imports.map((track) => track.id), selected.id]);
});

test("artists sharing a first name cannot replace or deduplicate one another", () => {
  const selected = selectedTracks.find((track) => track.title === "Exchange");
  const otherArtist = { id: "other-artist", title: "Exchange", artist: "Bryson Gray" };
  const remix = { id: "spotify-remix", title: "Exchange (Remix)", artist: "Bryson Tiller" };
  assert.deepEqual(resolveImportedTracks([remix, otherArtist], selectedTracks), [remix, otherArtist]);
  assert.deepEqual(composeLibraryTracks([otherArtist], [selected]), [otherArtist, selected]);
});

test("explicit feature credits and harmless remaster annotations still match", () => {
  const selected = selectedTracks.find((track) => track.title === "I'm Spent (feat. Loe Shimmy)");
  const imported = { id: "spotify-feature", title: "I'm Spent (2026 Remaster)", artist: "Drake" };
  assert.deepEqual(resolveImportedTracks([imported], [selected]), [selected]);
  const otherFeature = { id: "different-feature", title: "I'm Spent (feat. Another Singer)", artist: "Drake & Another Singer" };
  assert.deepEqual(resolveImportedTracks([otherFeature], [selected]), [otherFeature]);
});

test("different explicit guest artists retain separate recordings", () => {
  const selected = selectedTracks.find((track) => track.title === "Recognize (feat. Drake)");
  const imported = { ...selected, id: "different-guest", title: "Recognize (feat. Another Artist)" };
  const tracks = composeLibraryTracks([imported], [selected]);
  assert.deepEqual(tracks.map((track) => track.id), [imported.id, selected.id]);
});

test("an unopened default is unexplored and never claims an active sample lookup", () => {
  const graph = { byId: new Map(), samplesOf: new Map() };
  assert.deepEqual(libraryTrackStatus(graph, "sp-new"), {
    digging: false,
    unexplored: true,
  });
  assert.deepEqual(libraryTrackStatus(graph, "sp-new", ["sp-new"]), {
    digging: true,
    unexplored: true,
  });
});

test("only active requests animate, and discovered links survive a return to the library", () => {
  const graph = {
    byId: new Map([
      ["sp-new", { id: "sp-new", external: true, genres: [] }],
      ["catalog", { id: "catalog", genres: [] }],
    ]),
    samplesOf: new Map(),
  };
  assert.deepEqual(libraryTrackStatus(graph, "sp-new"), { digging: false, unexplored: true });
  graph.samplesOf.set("sp-new", [{ from: "sp-new", to: "catalog" }]);
  assert.deepEqual(libraryTrackStatus(graph, "sp-new"), { digging: false, unexplored: false });
  assert.deepEqual(libraryTrackStatus(graph, "catalog"), { digging: false, unexplored: false });
});

test("an unknown year cannot poison the library timeline or become guessed metadata", () => {
  const rows = [
    { year: undefined },
    { year: Number.NaN },
    { year: 2026, oldest: { year: 1957 } },
  ];
  const { fraction, ticks } = createStripTimeline(rows, 2026);
  assert.ok(ticks.includes(1960));
  for (const year of [undefined, Number.NaN, 1957, 2026, 2030]) {
    assert.ok(Number.isFinite(fraction(year)));
    assert.ok(fraction(year) >= 0);
  }
  assert.equal(fraction(2026), 0);
  assert.equal(rows[0].year, undefined);
});
