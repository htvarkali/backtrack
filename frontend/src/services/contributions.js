import {
  assertContributionAllowed,
  findContributionRecording,
  mergeContributions,
  recordingSnapshot,
} from "../data/contributions.js";
import {
  persistBrowserContribution,
  requireBrowserContributions,
} from "./contributionStorage.js";

/** Validate remotely, then durably retain the user's own contribution in this browser. */
async function submitContribution({
  getGraph,
  parentId,
  sample,
  fetchImpl = globalThis.fetch,
  storage,
}) {
  const withSavedEntries = () =>
    mergeContributions(getGraph(), requireBrowserContributions(storage));
  let graph = withSavedEntries();
  const parent = graph.songs.find((song) => song.id === parentId);
  if (!parent)
    throw new Error(
      "This song is no longer available. Open it again and retry.",
    );
  assertContributionAllowed(graph, parent, sample);
  const payload = {
    title: parent.title,
    artist: parent.artist,
    sampleTitle: sample.title,
    sampleArtist: sample.artist,
    sampleYear: sample.year,
    part: sample.part,
  };
  let response;
  try {
    response = await fetchImpl("/api/contribute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new Error("Could not reach the server. Please try again.");
  }
  const receipt = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(
      receipt.error || "Could not save this sample. Please try again.",
    );
  if (
    !receipt.ok ||
    typeof receipt.id !== "string" ||
    !["browser", "local"].includes(receipt.scope)
  ) {
    throw new Error(
      "The server did not confirm this contribution. Please try again.",
    );
  }
  // Check again after the request: another contribution may have completed meanwhile.
  graph = withSavedEntries();
  const currentParent =
    findContributionRecording(graph, parent.title, parent.artist) ?? parent;
  assertContributionAllowed(graph, currentParent, sample);
  const existingSample = findContributionRecording(
    graph,
    sample.title,
    sample.artist,
  );
  const canonicalInput = Object.fromEntries(
    Object.entries(payload).map(([key, value]) => [
      key,
      Object.hasOwn(receipt, key) ? receipt[key] : value,
    ]),
  );
  const entry = {
    ...canonicalInput,
    id: receipt.id,
    createdAt: receipt.createdAt,
    scope: receipt.scope,
    parentSong: recordingSnapshot(currentParent),
    sampleSong: recordingSnapshot(existingSample ?? sample),
  };
  try {
    persistBrowserContribution(entry, storage);
  } catch (error) {
    if (receipt.scope === "local") {
      throw new Error(
        `The server saved your contribution, but browser storage failed. ${error.message}`,
      );
    }
    throw error;
  }
  return { entry, scope: receipt.scope };
}

export { submitContribution };
