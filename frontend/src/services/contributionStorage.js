import { normalizeTrack } from "./catalog.js";

const BROWSER_CONTRIBUTIONS_KEY = "back-track-contributions-v1";
const contributionKey = (entry) =>
  [entry.title, entry.artist, entry.sampleTitle, entry.sampleArtist]
    .map(normalizeTrack)
    .join("|");
const validContribution = (entry) =>
  entry &&
  [entry.title, entry.artist, entry.sampleTitle, entry.sampleArtist].every(
    (value) => typeof value === "string" && value.trim(),
  );

function browserStorage(storage) {
  const target = storage ?? globalThis.localStorage;
  if (!target) throw new Error("Browser storage is unavailable.");
  return target;
}
function readStoredContributions(storage) {
  const serialized = browserStorage(storage).getItem(BROWSER_CONTRIBUTIONS_KEY);
  if (serialized === null) return [];
  const ledger = JSON.parse(serialized);
  if (
    ledger?.version !== 1 ||
    !Array.isArray(ledger.contributions) ||
    !ledger.contributions.every(validContribution)
  ) {
    throw new Error("Saved browser contributions could not be read.");
  }
  return ledger.contributions;
}
function readBrowserContributions(storage) {
  try {
    return readStoredContributions(storage);
  } catch {
    // Browsing the catalog remains available when browser storage is disabled.
    return [];
  }
}
function requireBrowserContributions(storage) {
  try {
    return readStoredContributions(storage);
  } catch {
    throw new Error(
      "Your saved contributions could not be read. Enable site storage and try again.",
    );
  }
}
function combineContributions(...groups) {
  const entries = new Map();
  for (const entry of groups.flat()) {
    if (!validContribution(entry)) continue;
    const key = contributionKey(entry);
    entries.set(key, { ...entries.get(key), ...entry });
  }
  return [...entries.values()];
}

/** One verified, atomic storage write is required before showing a saved state. */
function persistBrowserContribution(entry, storage) {
  if (!validContribution(entry))
    throw new Error("This contribution is incomplete.");
  const contributions = combineContributions(
    requireBrowserContributions(storage),
    [entry],
  );
  const serialized = JSON.stringify({ version: 1, contributions });
  try {
    const target = browserStorage(storage);
    target.setItem(BROWSER_CONTRIBUTIONS_KEY, serialized);
    if (target.getItem(BROWSER_CONTRIBUTIONS_KEY) !== serialized) {
      throw new Error("Storage did not retain the contribution.");
    }
  } catch {
    throw new Error(
      "Could not save this contribution in your browser. Enable site storage or free some space, then try again.",
    );
  }
  return entry;
}

export {
  BROWSER_CONTRIBUTIONS_KEY,
  combineContributions,
  persistBrowserContribution,
  readBrowserContributions,
  requireBrowserContributions,
};
