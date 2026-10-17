const normalizeTrack = (e) =>
  e
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s*[([].*?[)\]]/g, "")
    .replace(/\s+-\s+.*$/, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
async function searchCatalog(e) {
  const n = await (
      await fetch(
        `/api/catalog/itunes?${new URLSearchParams({
          term: e,
          entity: "song",
          limit: "10",
        })}`,
      )
    ).json(),
    r = new Set();
  return (n.results ?? [])
    .filter((i) => {
      const s = `${normalizeTrack(i.trackName ?? "")}|${normalizeTrack(i.artistName ?? "")}`;
      return r.has(s) ? false : (r.add(s), true);
    })
    .slice(0, 8)
    .map((i) => {
      var s, l;
      return {
        id: `it${i.trackId}`,
        title: i.trackName,
        artist: i.artistName,
        year:
          Number((s = i.releaseDate) == null ? undefined : s.slice(0, 4)) ||
          new Date().getFullYear(),
        art:
          (l = i.artworkUrl100) == null
            ? undefined
            : l.replace(/\/\d+x\d+bb\./, "/600x600bb."),
        url: i.trackViewUrl ?? "",
        preview: i.previewUrl,
      };
    });
}
async function lookupRecording(e) {
  var t, n;
  try {
    const r = e.artist.split(" & ")[0],
      l = (
        (
          await (
            await fetch(
              `/api/catalog/itunes?${new URLSearchParams({
                term: `${r} ${e.title}`,
                entity: "song",
                limit: "10",
              })}`,
            )
          ).json()
        ).results ?? []
      ).find(
        (o) =>
          o.previewUrl &&
          normalizeTrack(o.trackName ?? "") === normalizeTrack(e.title) &&
          normalizeTrack(o.artistName ?? "").includes(normalizeTrack(r)),
      );
    return l
      ? {
          preview: l.previewUrl,
          art:
            (t = l.artworkUrl100) == null
              ? undefined
              : t.replace(/\/\d+x\d+bb\./, "/600x600bb."),
          year:
            Number((n = l.releaseDate) == null ? undefined : n.slice(0, 4)) || undefined,
        }
      : {};
  } catch {
    return {};
  }
}
export { lookupRecording, normalizeTrack, searchCatalog };
