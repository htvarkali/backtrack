import test from "node:test";
import assert from "node:assert/strict";
import { submitContribution } from "../frontend/src/services/contributions.js";
import {
  BROWSER_CONTRIBUTIONS_KEY,
  readBrowserContributions,
} from "../frontend/src/services/contributionStorage.js";
import {
  fetchContributions,
  mergeContributions,
} from "../frontend/src/data/contributions.js";
import { hydrateGraph } from "../frontend/src/data/graph.js";
import { analyzeAncestry } from "../frontend/src/utils/ancestry.js";

const graph = (songs = [], samples = []) => ({
  songs,
  samples,
  genres: [],
  families: [],
  traditions: [],
  influences: [],
  featured: [],
});
const song = (id, title, year) => ({
  id,
  title,
  artist: "Test Artist",
  year,
  genres: [],
  external: true,
});
const current = song("sp-it100", "Current Song", 2020);
const older = song("it200", "Older Song", 1980);
const oldest = song("it300", "Oldest Song", 1950);
const createStorage = () => {
  const data = new Map();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
    removeItem: (key) => data.delete(key),
  };
};
const confirm =
  (scope = "browser") =>
  async (_url, request) => {
    const input = JSON.parse(request.body);
    return Response.json({
      ok: true,
      id: `${input.title}>${input.sampleTitle}`,
      ...input,
      createdAt: "2026-10-17T12:00:00.000Z",
      scope,
      persisted: scope === "local",
    });
  };
const submit = (storage, options = {}) =>
  submitContribution({
    getGraph: () => graph([current]),
    parentId: current.id,
    sample: {
      ...older,
      art: "https://example.com/cover.jpg",
      preview: "https://example.com/preview.mp3",
      part: "vocal",
    },
    fetchImpl: confirm(),
    storage,
    ...options,
  });

test("hosted contributions restore external songs and metadata after empty server cold start", async () => {
  const storage = createStorage();
  const result = await submit(storage);
  assert.equal(result.scope, "browser");
  // No legacy discovery cache and no server record are needed to restore this relationship.
  const freshBrowserEntries = await fetchContributions({
    fetchImpl: async () =>
      Response.json({ contributions: [], scope: "browser" }),
    storage,
  });
  const restored = mergeContributions(graph(), freshBrowserEntries);
  assert.equal(restored.songs.length, 2);
  assert.equal(restored.samples.length, 1);
  assert.equal(
    restored.songs.find((item) => item.id === current.id).year,
    2020,
  );
  assert.equal(
    restored.songs.find((item) => item.id === older.id).preview,
    "https://example.com/preview.mp3",
  );
  assert.equal(
    restored.songs.find((item) => item.id === older.id).art,
    "https://example.com/cover.jpg",
  );
  assert.equal(restored.samples[0].element, "vocal");
  assert.equal(restored.samples[0].evidence.source, "your browser");
  const ancestry = analyzeAncestry(hydrateGraph(restored), current.id);
  assert.equal(ancestry.depth, 1);
  assert.equal(ancestry.oldest.year, 1980);
});

test("browser restoration survives API failure and retains canonical receipt fields", async () => {
  const storage = createStorage();
  const result = await submit(storage, {
    fetchImpl: async (_url, request) =>
      Response.json({
        ...JSON.parse(request.body),
        ok: true,
        id: "canonical",
        scope: "browser",
        part: "trimmed vocal",
      }),
  });
  assert.equal(result.entry.part, "trimmed vocal");
  const recovered = await fetchContributions({
    fetchImpl: async () => {
      throw new Error("cold start");
    },
    storage,
  });
  assert.equal(recovered.length, 1);
  assert.equal(recovered[0].id, "canonical");
});

test("repeat saves and combined local/server receipts do not duplicate contributions or edges", async () => {
  const storage = createStorage();
  const first = await submit(storage, { fetchImpl: confirm("local") });
  assert.equal(first.scope, "local");
  await submit(storage, { fetchImpl: confirm("local") });
  assert.equal(readBrowserContributions(storage).length, 1);
  const entries = await fetchContributions({
    fetchImpl: async () => Response.json({ contributions: [first.entry] }),
    storage,
  });
  assert.equal(entries.length, 1);
  const restored = mergeContributions(graph(), entries);
  const again = mergeContributions(restored, entries);
  assert.equal(again.songs.length, 2);
  assert.equal(again.samples.length, 1);
});

test("storage quota failure cannot report success or overwrite earlier contributions", async () => {
  const storage = createStorage();
  await submit(storage);
  const before = storage.getItem(BROWSER_CONTRIBUTIONS_KEY);
  storage.setItem = () => {
    throw new DOMException("Full", "QuotaExceededError");
  };
  await assert.rejects(
    submit(storage, { sample: oldest }),
    /Could not save.*browser/,
  );
  assert.equal(storage.getItem(BROWSER_CONTRIBUTIONS_KEY), before);
});

test("silently discarded or disabled browser storage is treated as a failed save", async () => {
  const silentStorage = { getItem: () => null, setItem: () => {} };
  await assert.rejects(submit(silentStorage), /Could not save.*browser/);
  let requests = 0;
  const blockedStorage = {
    getItem: () => {
      throw new DOMException("Blocked", "SecurityError");
    },
  };
  await assert.rejects(
    submit(blockedStorage, {
      fetchImpl: async () => {
        requests++;
      },
    }),
    /Enable site storage/,
  );
  assert.equal(requests, 0);
});

test("malformed browser ledger is not overwritten while catalog browsing stays available", async () => {
  const storage = createStorage();
  storage.setItem(BROWSER_CONTRIBUTIONS_KEY, "{broken");
  assert.deepEqual(readBrowserContributions(storage), []);
  await assert.rejects(
    submit(storage),
    /saved contributions could not be read/,
  );
  assert.equal(storage.getItem(BROWSER_CONTRIBUTIONS_KEY), "{broken");
});

test("client rejects self-samples and cycles from current graph before sending the request", async () => {
  const storage = createStorage();
  let requests = 0;
  const fetchImpl = async () => {
    requests++;
    return Response.json({});
  };
  await assert.rejects(
    submit(storage, { sample: current, fetchImpl }),
    /cannot sample itself/,
  );
  await assert.rejects(
    submit(storage, {
      getGraph: () =>
        graph(
          [current, older],
          [{ from: older.id, to: current.id, type: "sample" }],
        ),
      fetchImpl,
    }),
    /circular ancestry/,
  );
  assert.equal(requests, 0);
  assert.equal(readBrowserContributions(storage).length, 0);
});

test("cycle guard includes saved ledger edges absent from the currently rendered graph", async () => {
  const storage = createStorage();
  await submit(storage); // Current -> Older
  await assert.rejects(
    submit(storage, {
      getGraph: () => graph([older, current]),
      parentId: older.id,
      sample: current,
      fetchImpl: async () => {
        assert.fail("A browser-only cycle must never reach the server.");
      },
    }),
    /circular ancestry/,
  );
  assert.equal(readBrowserContributions(storage).length, 1);
});

test("cycle checks run again after validation if the graph changes during the request", async () => {
  const storage = createStorage();
  let active = graph([current, older]);
  await assert.rejects(
    submit(storage, {
      getGraph: () => active,
      fetchImpl: async (_url, request) => {
        active = graph(
          [current, older],
          [{ from: older.id, to: current.id, type: "sample" }],
        );
        return confirm()(_url, request);
      },
    }),
    /circular ancestry/,
  );
  assert.equal(readBrowserContributions(storage).length, 0);
});

test("server errors or unconfirmed responses never persist a successful contribution", async () => {
  const storage = createStorage();
  await assert.rejects(
    submit(storage, {
      fetchImpl: async () =>
        Response.json({ error: "Circular ancestry" }, { status: 409 }),
    }),
    /Circular ancestry/,
  );
  await assert.rejects(
    submit(storage, { fetchImpl: async () => Response.json({ ok: true }) }),
    /did not confirm/,
  );
  assert.equal(readBrowserContributions(storage).length, 0);
});

test("local durability is accurately reported when the subsequent browser write fails", async () => {
  const storage = {
    getItem: () => null,
    setItem: () => {
      throw new Error("quota");
    },
  };
  await assert.rejects(
    submit(storage, { fetchImpl: confirm("local") }),
    /server saved your contribution, but browser storage failed/,
  );
});

test("browser ledger retains full external contribution chains without legacy caches", async () => {
  const storage = createStorage();
  const first = await submit(storage);
  const active = mergeContributions(graph(), [first.entry]);
  await submit(storage, {
    getGraph: () => active,
    parentId: older.id,
    sample: oldest,
  });
  const restored = mergeContributions(
    graph(),
    readBrowserContributions(storage).reverse(),
  );
  const ancestry = analyzeAncestry(hydrateGraph(restored), current.id);
  assert.equal(restored.samples.length, 2);
  assert.equal(ancestry.depth, 2);
  assert.equal(ancestry.oldest.year, 1950);
  assert.ok(
    Math.abs(
      [...ancestry.contrib.values()].reduce((sum, part) => sum + part, 0) - 1,
    ) < 1e-9,
  );
});
