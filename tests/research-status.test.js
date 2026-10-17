import test from "node:test";
import assert from "node:assert/strict";
import { mergeDiscoveredLinks } from "../frontend/src/services/library.js";
import {
  hasIncompleteAncestry,
  lookupAncestry,
} from "../frontend/src/services/research.js";

function environment(t, { samples, wikipediaUnavailable = false } = {}) {
  const originalFetch = globalThis.fetch;
  const originalStorage = Object.getOwnPropertyDescriptor(
    globalThis,
    "localStorage",
  );
  const stored = new Map();
  const calls = { samples: 0, musicbrainz: 0 };
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key) => stored.get(key) ?? null,
      setItem: (key, value) => stored.set(key, value),
    },
  });
  globalThis.fetch = async (input) => {
    const url = new URL(input, "https://back-track.test");
    if (url.pathname === "/api/samples") {
      calls.samples++;
      return typeof samples === "function"
        ? samples(calls.samples)
        : Response.json(samples);
    }
    if (url.pathname === "/api/catalog/wikipedia") {
      if (wikipediaUnavailable)
        return Response.json({ error: "unavailable" }, { status: 502 });
      return Response.json({ query: { search: [], pages: [] } });
    }
    if (url.pathname.startsWith("/api/catalog/musicbrainz/")) {
      calls.musicbrainz++;
      return Response.json({ recordings: [] });
    }
    if (url.pathname === "/api/catalog/itunes")
      return Response.json({ results: [] });
    throw new Error(`Unexpected request ${input}`);
  };
  t.after(() => {
    globalThis.fetch = originalFetch;
    if (originalStorage)
      Object.defineProperty(globalThis, "localStorage", originalStorage);
    else delete globalThis.localStorage;
  });
  return { stored, calls };
}

const fallback = {
  sourceName: "musicbrainz",
  checked: ["musicbrainz"],
  warning: "Genius is unavailable; MusicBrainz was checked instead.",
  found: [
    {
      title: "Original Recording",
      artist: "Source Artist",
      type: "sample",
      source: "https://musicbrainz.org/recording/123",
      sourceName: "musicbrainz",
    },
  ],
};

test("fallback attribution stays MusicBrainz and warns that the history may be incomplete", async (t) => {
  const { calls, stored } = environment(t, { samples: fallback });
  const result = await lookupAncestry("Fallback Track", "Artist", []);
  assert.ok(result.checked.includes("musicbrainz"));
  assert.ok(result.checked.includes("wikipedia"));
  assert.ok(!result.checked.includes("genius"));
  assert.equal(result.found[0].sourceName, "musicbrainz");
  assert.equal(result.found[0].source, fallback.found[0].source);
  assert.equal(result.partial, true);
  assert.match(result.warning, /history may be incomplete/);
  assert.ok(result.warnings.includes(fallback.warning));
  assert.equal(
    calls.musicbrainz,
    0,
    "the client must not repeat a successful backend fallback",
  );
  assert.equal(hasIncompleteAncestry("Fallback Track", "Artist"), true);
  const marker = Object.values(JSON.parse(stored.get("nn-lookup-3")))[0];
  assert.equal(marker.partial, true);
  assert.equal(
    marker.found,
    undefined,
    "partial results retain retry status, not a success cache",
  );
  await lookupAncestry("Fallback Track", "Artist", []);
  assert.equal(calls.samples, 2, "refresh must recheck a partial lookup");
});

test("a failed API lookup is incomplete, never marked Genius checked, and retries", async (t) => {
  const { calls } = environment(t, {
    samples: () =>
      Response.json(
        { error: "Genius and MusicBrainz are unavailable." },
        { status: 502 },
      ),
  });
  const result = await lookupAncestry("Failed Lookup", "Artist", [], true);
  assert.deepEqual(result.found, []);
  assert.deepEqual(result.checked, ["wikipedia"]);
  assert.equal(result.partial, true);
  assert.match(result.warning, /sample sources are unavailable/);
  assert.match(result.warnings[0], /Genius and MusicBrainz/);
  await lookupAncestry("Failed Lookup", "Artist", [], true);
  assert.equal(calls.samples, 2);
});

test("a verified empty fallback remains truthful about the source and missing providers", async (t) => {
  environment(t, { samples: { ...fallback, found: [] } });
  const result = await lookupAncestry("Empty Fallback", "Artist", [], true);
  assert.deepEqual(result.found, []);
  assert.ok(result.checked.includes("musicbrainz"));
  assert.ok(!result.checked.includes("genius"));
  assert.equal(result.partial, true);
  assert.match(result.warning, /may be incomplete/);
});

test("successful complete research caches normally and clears a previous partial retry marker", async (t) => {
  const { calls } = environment(t, {
    samples: (count) =>
      Response.json(
        count === 1
          ? fallback
          : { found: [], sourceName: "genius", checked: ["genius"] },
      ),
  });
  await lookupAncestry("Recovery Track", "Artist", [], true);
  assert.equal(hasIncompleteAncestry("Recovery Track", "Artist"), true);
  const recovered = await lookupAncestry("Recovery Track", "Artist", [], true);
  assert.equal(recovered.partial, false);
  assert.equal(recovered.warning, undefined);
  assert.ok(recovered.checked.includes("genius"));
  assert.equal(hasIncompleteAncestry("Recovery Track", "Artist"), false);
  await lookupAncestry("Recovery Track", "Artist", [], true);
  assert.equal(calls.samples, 2, "only the fully checked result can be reused");
});

test("Wikipedia failure also prevents a fully checked cache hit", async (t) => {
  const { calls } = environment(t, {
    samples: { found: [], sourceName: "genius", checked: ["genius"] },
    wikipediaUnavailable: true,
  });
  const result = await lookupAncestry("Wiki Failure", "Artist", [], true);
  assert.deepEqual(result.checked, ["genius"]);
  assert.equal(result.partial, true);
  assert.ok(result.warnings.includes("Wikipedia could not be checked."));
  await lookupAncestry("Wiki Failure", "Artist", [], true);
  assert.equal(calls.samples, 2);
});

test("legacy caches that guessed Genius success cannot hide current provider failures", async (t) => {
  const { stored, calls } = environment(t, {
    samples: { ...fallback, found: [] },
  });
  stored.set(
    "nn-lookup-2",
    JSON.stringify({
      "legacy track|artist": {
        checked: ["genius", "wikipedia"],
        found: [],
        genres: ["pop"],
        at: Date.now(),
      },
    }),
  );
  const result = await lookupAncestry("Legacy Track", "Artist", [], true);
  assert.equal(calls.samples, 1);
  assert.equal(result.partial, true);
  assert.ok(!result.checked.includes("genius"));
});

test("partial refreshes are idempotent and preserve curated and existing sample types", () => {
  const curated = {
    from: "parent",
    to: "original",
    type: "interpolation",
    source: "curated source",
  };
  const existing = {
    from: "parent",
    to: "older",
    type: "vocal",
    source: "first discovery",
  };
  const added = {
    from: "parent",
    to: "new",
    type: "sample",
    source: "new discovery",
  };
  const discovered = [
    { ...curated, type: "sample", source: "fallback" },
    { ...existing, type: "sample", source: "fallback" },
    added,
    { ...added },
  ];
  const first = mergeDiscoveredLinks([existing, { ...existing }], discovered, [
    curated,
    existing,
  ]);
  assert.deepEqual(first, [existing, added]);
  const repeated = mergeDiscoveredLinks(first, discovered, [curated, ...first]);
  assert.deepEqual(repeated, first);
  assert.equal(first[0].type, "vocal");
  assert.equal(curated.type, "interpolation");
});
