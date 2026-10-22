const normalizeLibraryText = (value) =>
  value.toLowerCase().normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const normalizeLibraryArtist = (artist) => normalizeLibraryText(
  artist.replace(/\s*(?:&|\bfeat\.?|\bft\.?|\bfeaturing)\s+/gi, " and "),
);

function recordingIdentity(track) {
  const featuredArtists = [];
  const title = track.title
    .replace(/\(([^)]*)\)|\[([^\]]*)\]/g, (annotation, parentheses, brackets) => {
      const content = (parentheses ?? brackets).trim();
      const feature = content.match(/^(?:feat\.?|ft\.?|featuring)\s+(.+)$/i);
      if (feature) {
        featuredArtists.push(normalizeLibraryArtist(feature[1]));
        return "";
      }
      return /^(?:\d{4}\s+)?remaster(?:ed)?(?:\s+\d{4})?$/i.test(content)
        ? ""
        : annotation;
    })
    .replace(/\s+-\s+(?:\d{4}\s+)?remaster(?:ed)?(?:\s+\d{4})?$/i, "");
  const artist = normalizeLibraryArtist(track.artist);
  let primaryArtist = artist;
  for (const featured of featuredArtists) {
    const suffix = ` and ${featured}`;
    if (primaryArtist.endsWith(suffix)) primaryArtist = primaryArtist.slice(0, -suffix.length);
  }
  return {
    title: normalizeLibraryText(title),
    artist,
    primaryArtist,
    featured: featuredArtists.sort().join(" and "),
  };
}

// Version labels and complete artist identities distinguish separate recordings.
function sameLibraryRecording(left, right) {
  const a = recordingIdentity(left);
  const b = recordingIdentity(right);
  if (a.featured && b.featured && a.featured !== b.featured) return false;
  return a.title === b.title && (
    a.artist === b.artist ||
    a.artist === b.primaryArtist ||
    a.primaryArtist === b.artist
  );
}

/** Keep personal order while retaining every selected recording exactly once. */
function composeLibraryTracks(importedTracks = [], selectedTracks = []) {
  return resolveImportedTracks([...importedTracks, ...selectedTracks], selectedTracks);
}

/** Resolve only imports, so metadata preparation cannot enqueue default-only tracks. */
function resolveImportedTracks(importedTracks = [], selectedTracks = []) {
  const tracks = [];
  for (const track of importedTracks) {
    if (tracks.some((existing) => sameLibraryRecording(existing, track))) continue;
    // The selected entry has verified metadata; imports can have guessed dates.
    tracks.push(
      selectedTracks.find((selected) => sameLibraryRecording(selected, track)) ?? track,
    );
  }
  return tracks;
}

function libraryTrackStatus(graph, songId, activeRequests = []) {
  const song = graph.byId.get(songId);
  return {
    digging: activeRequests.includes(songId),
    unexplored:
      !song ||
      (!!song.external &&
        !(graph.samplesOf.get(songId) ?? []).length &&
        !(song.genres ?? []).length),
  };
}

/** Unknown dates stay at the near edge without becoming release-year metadata. */
function createStripTimeline(rows, currentYear = new Date().getFullYear()) {
  const years = rows
    .flatMap((row) => [row.year, row.oldest?.year])
    .filter(Number.isFinite);
  const startYear = Math.floor(Math.min(currentYear - 40, ...years) / 20) * 20;
  return {
    fraction: (year) =>
      Number.isFinite(year)
        ? Math.max(0, (currentYear - year) / (currentYear - startYear))
        : 0,
    ticks: Array.from(
      { length: Math.floor((currentYear - startYear) / 20) + 1 },
      (_, index) => Math.floor(currentYear / 20) * 20 - index * 20,
    ).filter((year) => year >= startYear),
  };
}

export { composeLibraryTracks, createStripTimeline, libraryTrackStatus, resolveImportedTracks };
