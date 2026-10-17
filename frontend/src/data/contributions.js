import { normalizeTrack } from "../services/catalog.js";

const recordingKey = (title, artist) =>
  `${normalizeTrack(title)}|${normalizeTrack(artist)}`;
const sampleId = (artist, title) =>
  `x-${`${artist} ${title}`
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60)}`;

function reaches(adjacency, start, target) {
  const pending = [start];
  const visited = new Set();
  while (pending.length) {
    const id = pending.pop();
    if (id === target) return true;
    if (visited.has(id)) continue;
    visited.add(id);
    pending.push(...(adjacency.get(id) ?? []));
  }
  return false;
}

/** Restore saved local relationships without changing the curated source graph. */
function mergeContributions(graph, contributions = []) {
  const songs = [...graph.songs];
  const samples = [...graph.samples];
  const byRecording = new Map(
    songs.map((song) => [recordingKey(song.title, song.artist), song]),
  );
  const byId = new Map(songs.map((song) => [song.id, song]));
  const findRecording = (title, artist) =>
    byRecording.get(recordingKey(title, artist)) ??
    songs.find(
      (song) =>
        normalizeTrack(song.title) === normalizeTrack(title) &&
        normalizeTrack(song.artist).split(" ")[0] ===
          normalizeTrack(artist).split(" ")[0],
    );
  const edgeIds = new Set(samples.map((edge) => `${edge.from}>${edge.to}`));
  const adjacency = new Map();
  for (const edge of samples) {
    if (!adjacency.has(edge.from)) adjacency.set(edge.from, []);
    adjacency.get(edge.from).push(edge.to);
  }
  // Newly introduced sample nodes can also be parents of later contributions.
  // A bounded pass handles those records regardless of their save order.
  let pending = contributions.filter((entry) =>
    [
      entry?.title,
      entry?.artist,
      entry?.sampleTitle,
      entry?.sampleArtist,
    ].every((value) => typeof value === "string" && value.trim()),
  );
  while (pending.length) {
    const deferred = [];
    let applied = 0;
    for (const entry of pending) {
      const parent = findRecording(entry.title, entry.artist);
      if (!parent) {
        deferred.push(entry);
        continue;
      }
      const key = recordingKey(entry.sampleTitle, entry.sampleArtist);
      let sample = findRecording(entry.sampleTitle, entry.sampleArtist);
      const isNew = !sample;
      if (isNew) {
        let id = sampleId(entry.sampleArtist, entry.sampleTitle);
        const baseId = id;
        let suffix = 1;
        while (byId.has(id)) id = `${baseId}-${suffix++}`;
        sample = {
          id,
          title: entry.sampleTitle,
          artist: entry.sampleArtist,
          year: Math.min(
            Number.isFinite(entry.sampleYear) ? entry.sampleYear : parent.year,
            parent.year,
          ),
          genres: [],
          external: true,
        };
      }
      const edgeKey = `${parent.id}>${sample.id}`;
      if (edgeIds.has(edgeKey) || reaches(adjacency, sample.id, parent.id))
        continue;
      if (isNew) {
        songs.push(sample);
        byId.set(sample.id, sample);
        byRecording.set(key, sample);
      }
      samples.push({
        from: parent.id,
        to: sample.id,
        type: "sample",
        element: entry.part ?? "",
        source: "",
        evidence: { kind: "found", source: "local listeners" },
      });
      edgeIds.add(edgeKey);
      if (!adjacency.has(parent.id)) adjacency.set(parent.id, []);
      adjacency.get(parent.id).push(sample.id);
      applied++;
    }
    if (!applied) break;
    pending = deferred;
  }
  // External parents not yet in this browser are restored by /api/samples when opened.
  return { ...graph, songs, samples };
}

async function fetchContributions() {
  try {
    const response = await fetch("/api/contributions", {
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) return [];
    const data = await response.json();
    return Array.isArray(data.contributions) ? data.contributions : [];
  } catch {
    // The bundled graph remains usable while the local API is restarting.
    return [];
  }
}

export { fetchContributions, mergeContributions };
