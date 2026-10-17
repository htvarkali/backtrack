import { normalizeTrack } from "../services/catalog.js";
import {
  combineContributions,
  readBrowserContributions,
} from "../services/contributionStorage.js";

const recordingKey = (title, artist) =>
  `${normalizeTrack(title)}|${normalizeTrack(artist)}`;
const sampleId = (artist, title) =>
  `x-${`${artist} ${title}`
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60)}`;
const sameContributionRecording = (song, title, artist) =>
  normalizeTrack(song.title) === normalizeTrack(title) &&
  normalizeTrack(song.artist).split(" ")[0] ===
    normalizeTrack(artist).split(" ")[0];

function findContributionRecording(graph, title, artist) {
  return graph.songs.find((song) =>
    sameContributionRecording(song, title, artist),
  );
}
function adjacencyFor(samples) {
  const adjacency = new Map();
  for (const edge of samples) {
    if (!adjacency.has(edge.from)) adjacency.set(edge.from, []);
    adjacency.get(edge.from).push(edge.to);
  }
  return adjacency;
}
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
function assertContributionAllowed(graph, parent, sample) {
  if (sameContributionRecording(parent, sample.title, sample.artist)) {
    throw new Error("A song cannot sample itself.");
  }
  const existingSample = findContributionRecording(
    graph,
    sample.title,
    sample.artist,
  );
  if (
    existingSample &&
    reaches(adjacencyFor(graph.samples), existingSample.id, parent.id)
  ) {
    throw new Error("This sample would create a circular ancestry chain.");
  }
}
function recordingSnapshot(song) {
  return {
    id: song.id,
    title: song.title,
    artist: song.artist,
    year: song.year,
    genres: Array.isArray(song.genres) ? song.genres : [],
    art: song.art,
    preview: song.preview,
    link: song.link ?? song.url,
    external: !!song.external,
  };
}

/** Restore server and browser contributions without mutating the curated data. */
function mergeContributions(graph, contributions = []) {
  const songs = [...graph.songs];
  const samples = [...graph.samples];
  const byRecording = new Map(
    songs.map((song) => [recordingKey(song.title, song.artist), song]),
  );
  const byId = new Map(songs.map((song) => [song.id, song]));
  const findRecording = (title, artist) =>
    byRecording.get(recordingKey(title, artist)) ??
    songs.find((song) => sameContributionRecording(song, title, artist));
  const edgeIds = new Set(samples.map((edge) => `${edge.from}>${edge.to}`));
  const adjacency = adjacencyFor(samples);
  const addSong = (song) => {
    songs.push(song);
    byId.set(song.id, song);
    byRecording.set(recordingKey(song.title, song.artist), song);
  };
  const restoreSong = (
    snapshot,
    title,
    artist,
    fallbackYear,
    occupied = new Set(),
  ) => {
    let id =
      typeof snapshot?.id === "string" && snapshot.id
        ? snapshot.id
        : sampleId(artist, title);
    const baseId = id;
    let suffix = 1;
    while (byId.has(id) || occupied.has(id)) id = `${baseId}-${suffix++}`;
    const metadataMatches =
      snapshot &&
      typeof snapshot.title === "string" &&
      typeof snapshot.artist === "string" &&
      sameContributionRecording(snapshot, title, artist);
    const metadata = metadataMatches ? recordingSnapshot(snapshot) : {};
    return {
      ...metadata,
      id,
      title,
      artist,
      year: Number.isFinite(metadata.year) ? metadata.year : fallbackYear,
      genres: metadata.genres ?? [],
      external: true,
    };
  };
  let pending = contributions.filter((entry) =>
    [
      entry?.title,
      entry?.artist,
      entry?.sampleTitle,
      entry?.sampleArtist,
    ].every((value) => typeof value === "string" && value.trim()),
  );
  // A bounded pass also restores older server records that lack parent snapshots.
  while (pending.length) {
    const deferred = [];
    let applied = 0;
    for (const entry of pending) {
      let parent = findRecording(entry.title, entry.artist);
      const newParent = !parent;
      if (!parent) {
        const snapshot = entry.parentSong;
        if (
          !snapshot ||
          !Number.isFinite(snapshot.year) ||
          typeof snapshot.title !== "string" ||
          typeof snapshot.artist !== "string" ||
          !sameContributionRecording(snapshot, entry.title, entry.artist)
        ) {
          deferred.push(entry);
          continue;
        }
        parent = restoreSong(
          snapshot,
          entry.title,
          entry.artist,
          snapshot.year,
        );
      }
      let sample = findRecording(entry.sampleTitle, entry.sampleArtist);
      const newSample = !sample;
      if (
        sameContributionRecording(parent, entry.sampleTitle, entry.sampleArtist)
      )
        continue;
      if (!sample) {
        const sampleYear = Math.min(
          Number.isFinite(entry.sampleYear) ? entry.sampleYear : parent.year,
          parent.year,
        );
        sample = restoreSong(
          entry.sampleSong,
          entry.sampleTitle,
          entry.sampleArtist,
          sampleYear,
          new Set([parent.id]),
        );
        sample.year = Math.min(sample.year, parent.year);
      }
      const edgeKey = `${parent.id}>${sample.id}`;
      if (edgeIds.has(edgeKey) || reaches(adjacency, sample.id, parent.id))
        continue;
      if (newParent) addSong(parent);
      if (newSample) addSong(sample);
      samples.push({
        from: parent.id,
        to: sample.id,
        type: "sample",
        element: entry.part ?? "",
        source: "",
        evidence: {
          kind: "found",
          source:
            entry.scope === "browser" ? "your browser" : "local listeners",
        },
      });
      edgeIds.add(edgeKey);
      if (!adjacency.has(parent.id)) adjacency.set(parent.id, []);
      adjacency.get(parent.id).push(sample.id);
      applied++;
    }
    if (!applied) break;
    pending = deferred;
  }
  return { ...graph, songs, samples };
}

async function fetchContributions({
  fetchImpl = globalThis.fetch,
  storage,
} = {}) {
  const browserEntries = readBrowserContributions(storage);
  try {
    const response = await fetchImpl("/api/contributions", {
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) return browserEntries;
    const data = await response.json();
    return combineContributions(
      Array.isArray(data.contributions) ? data.contributions : [],
      browserEntries,
    );
  } catch {
    // Browser contributions survive cold starts and temporary API outages.
    return browserEntries;
  }
}

export {
  assertContributionAllowed,
  fetchContributions,
  findContributionRecording,
  mergeContributions,
  recordingSnapshot,
};
