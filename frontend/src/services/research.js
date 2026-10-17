import { normalizeTrack } from "./catalog.js";

const sameRecording = (e, t) =>
    normalizeTrack(e.title) === normalizeTrack(t.title) &&
    normalizeTrack(e.artist).split(" ")[0] ===
      normalizeTrack(t.artist).split(" ")[0],
  WIKIPEDIA_ENDPOINT = "/api/catalog/wikipedia",
  MUSICBRAINZ_ENDPOINT = "/api/catalog/musicbrainz",
  normalizeResearch = (e) =>
    e
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\(.*?\)|\[.*?\]/g, "")
      .replace(/&/g, "and")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
async function fetchWikipedia(e) {
  const t = await fetch(
    `${WIKIPEDIA_ENDPOINT}?${new URLSearchParams({
      format: "json",
      formatversion: "2",
      origin: "*",
      ...e,
    })}`,
  );
  if (!t.ok) throw new Error(`wikipedia ${t.status}`);
  return t.json();
}
async function readWikiPages(e) {
  var n;
  return e.length
    ? (
        ((n = (
          await fetchWikipedia({
            action: "query",
            prop: "revisions",
            rvprop: "content",
            rvslots: "main",
            redirects: "1",
            titles: e.join("|"),
          })
        ).query) == null
          ? undefined
          : n.pages) ?? []
      )
        .filter((r) => !r.missing)
        .map((r) => {
          var i, s;
          return {
            title: r.title,
            text:
              ((s = (i = r.revisions) == null ? undefined : i[0]) == null
                ? undefined
                : s.slots.main.content) ?? "",
          };
        })
    : [];
}
function stripWikiMarkup(e) {
  let t = e
    .replace(/<ref[^>]*\/>/g, "")
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/g, "")
    .replace(/<!--[\s\S]*?-->/g, "");
  for (let n = 0; n < 4; n++) t = t.replace(/\{\{[^{}]*\}\}/g, "");
  return t
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, "$1")
    .replace(/'''?/g, "")
    .replace(/[“”]/g, '"');
}
const INTERPOLATION_PATTERN = /interpolat|replay|re-?sung|quote/i,
  SAMPLE_PATTERN =
    /\b(sample[sd]?|sampling|interpolat\w*|contains? elements|contains? portions|incorporat\w*|re-?sung|replay\w*)\b/i;
function extractArtist(e) {
  const t =
    e.match(
      /^[^"]{0,120}?(?:as )?(?:written and )?performed by ((?:the )?[^,.;:()"]+)/i,
    ) ??
    e.match(/^\s*(?:\(\d{4}\)\s*)?by ((?:the )?[^,.;:()"]+)/i) ??
    e.match(/^[^"]{0,80}?written by ([^,.;:()"]+)/i);
  return t == null
    ? undefined
    : t[1].replace(/\s+(and|as|from|on|in)\s*$/i, "").trim();
}
function extractSamples(e, t) {
  var o, a;
  const n = [],
    r = normalizeResearch(t),
    i = normalizeResearch(e.title).startsWith(r),
    l = stripWikiMarkup(e.text).split(
      new RegExp('\\n|(?<=[.!?])\\s+(?=[A-Z"])'),
    );
  for (const u of l) {
    if (
      !SAMPLE_PATTERN.test(u) ||
      /\b(was|were|been|being|later|subsequently) (sampled|interpolated)|sampled (it|the song|by)|sampled in\b/i.test(
        u,
      )
    )
      continue;
    const d = [...u.matchAll(/"([^"]{1,90})"/g)];
    if (!d.length) continue;
    const f = u.search(SAMPLE_PATTERN),
      p = d
        .filter((g) => g.index < f)
        .map((g) => normalizeResearch(g[1].replace(/,$/, "")));
    if (
      p.includes(r) ||
      (i && (p.length === 0 || /^(the song|it|the track)\b/i.test(u.trim())))
    )
      for (const g of d) {
        if (g.index < f) continue;
        const w = g[1].replace(/[,.]$/, "").trim();
        if (normalizeResearch(w) === r || !w) continue;
        const N = u.slice(g.index + g[0].length),
          h = extractArtist(N);
        if (!h || h.length > 60 || !/^(the )?[A-Z0-9À-ɏ]/.test(h)) continue;
        const y =
            Number(
              ((o = N.match(/^\s*\((\d{4})\)/)) == null ? undefined : o[1]) ??
                ((a = u.match(
                  new RegExp(`${escapeRegExp(w)}"?\\s*\\((\\d{4})\\)`),
                )) == null
                  ? undefined
                  : a[1]),
            ) || undefined,
          v = u.slice(f, g.index);
        n.push({
          title: w,
          artist: h,
          year: y,
          type: INTERPOLATION_PATTERN.test(v) ? "interpolation" : "sample",
        });
      }
  }
  return n;
}
const escapeRegExp = (e) => e.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function extractGenres(e) {
  const t = e.match(/\|\s*genre\s*=([\s\S]*?)\n\s*\|\s*[a-z_ ]+=/i);
  if (!t) return [];
  const n = [...t[1].matchAll(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g)].map(
    (r) => r[2] ?? r[1],
  );
  return n.length
    ? n
    : t[1]
        .split(/,|\n|\*/)
        .map((r) => stripWikiMarkup(r).trim())
        .filter(Boolean);
}
function extractAlbum(e) {
  const t = e.match(/\|\s*album\s*=\s*\[\[([^\]|]+)/i);
  return t == null ? undefined : t[1];
}
async function researchWikipedia(e, t) {
  var w;
  const n = t.split(/,| & | and | feat/i)[0],
    i = (
      ((w = (
        await fetchWikipedia({
          action: "query",
          list: "search",
          srsearch: `"${e}" ${n}`,
          srlimit: "6",
        })
      ).query) == null
        ? undefined
        : w.search) ?? []
    ).map((N) => N.title),
    s = normalizeResearch(e),
    l = i.find((N) => normalizeResearch(N).startsWith(s)),
    o = await readWikiPages(
      [...new Set([l, ...i.filter((N) => N !== l)].filter(Boolean))].slice(
        0,
        5,
      ),
    ),
    a = o.find(
      (N) =>
        normalizeResearch(N.title).startsWith(s) &&
        N.text.toLowerCase().includes(normalizeResearch(n).split(" ")[0]),
    ),
    u = a && extractAlbum(a.text);
  u && !o.some((N) => N.title === u) && o.push(...(await readWikiPages([u])));
  const d = new RegExp(`"(\\[\\[[^\\]|]*\\|)?${escapeRegExp(e)}`, "i"),
    f = o.filter((N) => N === a || d.test(N.text)),
    p = [];
  for (const N of f)
    for (const h of extractSamples(N, e))
      p.push({
        ...h,
        source: `https://en.wikipedia.org/wiki/${encodeURIComponent(N.title.replace(/ /g, "_"))}`,
        sourceName: "wikipedia",
      });
  let m = a ? extractGenres(a.text) : [];
  const g = u ? o.find((N) => N.title === u) : f.find((N) => N !== a);
  if ((!m.length && g && (m = extractGenres(g.text)), !m.length)) {
    const [N] = await readWikiPages([n]);
    N && (m = extractGenres(N.text));
  }
  return {
    found: p,
    genreLabels: m,
  };
}
async function researchSamples(title, artist) {
  const response = await fetch(
    `/api/samples?${new URLSearchParams({ title, artist })}`,
  );
  const result = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(result.error || `sample lookup ${response.status}`);
  if (!Array.isArray(result.found))
    throw new Error("Invalid sample lookup response");
  const checked = Array.isArray(result.checked)
    ? result.checked.filter((source) => typeof source === "string" && source)
    : typeof result.sourceName === "string"
      ? [result.sourceName]
      : [];
  return {
    found: result.found.map((sample) => ({
      ...sample,
      source: sample.source ?? result.url ?? "",
      sourceName: sample.sourceName ?? result.sourceName ?? "catalog",
    })),
    checked,
    warning:
      typeof result.warning === "string" && result.warning
        ? result.warning
        : result.partial || !checked.length
          ? "Some sample sources could not be checked."
          : undefined,
  };
}

let nextMusicBrainzRequest = 0;
async function fetchMusicBrainz(e) {
  const t = Math.max(0, nextMusicBrainzRequest - Date.now());
  nextMusicBrainzRequest = Date.now() + t + 1100;
  t && (await new Promise((r) => setTimeout(r, t)));
  const n = await fetch(
    `${MUSICBRAINZ_ENDPOINT}/${e}${e.includes("?") ? "&" : "?"}fmt=json`,
  );
  if (!n.ok) throw new Error(`musicbrainz ${n.status}`);
  return n.json();
}
const quotedSearchTerm = (e) => `"${e.replace(/["\\]/g, " ")}"`;
async function researchMusicBrainz(e, t) {
  var l;
  const n = t.split(/,| & | and | feat/i)[0],
    i = (
      (
        await fetchMusicBrainz(
          `recording?query=${encodeURIComponent(`recording:${quotedSearchTerm(e)} AND artist:${quotedSearchTerm(n)}`)}&limit=5`,
        )
      ).recordings ?? []
    )
      .filter(
        (o) =>
          (o.score ?? 0) >= 90 &&
          normalizeResearch(o.title) === normalizeResearch(e),
      )
      .slice(0, 3),
    s = [];
  for (const o of i) {
    const a = await fetchMusicBrainz(
      `recording/${o.id}?inc=recording-rels+artist-credits`,
    );
    for (const u of a.relations ?? []) {
      if (
        u.type !== "samples material" ||
        u.direction !== "forward" ||
        !u.recording
      )
        continue;
      const d = u.recording;
      s.push({
        title: d.title,
        artist:
          (d["artist-credit"] ?? []).map((f) => f.name).join(" & ") ||
          "unknown",
        year:
          Number(
            (l = d["first-release-date"]) == null ? undefined : l.slice(0, 4),
          ) || undefined,
        type: "sample",
        source: `https://musicbrainz.org/recording/${o.id}`,
        sourceName: "musicbrainz",
      });
    }
  }
  return s;
}
async function lookupFirstReleaseYear(e, t) {
  try {
    const n = t.split(/,| & | and | feat/i)[0],
      i = (
        (
          await fetchMusicBrainz(
            `recording?query=${encodeURIComponent(`recording:${quotedSearchTerm(e)} AND artist:${quotedSearchTerm(n)}`)}&limit=10`,
          )
        ).recordings ?? []
      )
        .filter((s) => (s.score ?? 0) >= 85)
        .map((s) => {
          var l;
          return Number(
            (l = s["first-release-date"]) == null ? undefined : l.slice(0, 4),
          );
        })
        .filter((s) => s > 1e3);
    return i.length ? Math.min(...i) : undefined;
  } catch {
    return;
  }
}
async function lookupCatalogGenre(e, t) {
  const n = t.split(/,| & | and | feat/i)[0],
    s =
      (
        await (
          await fetch(
            `/api/catalog/itunes?${new URLSearchParams({
              term: `${n} ${e}`,
              entity: "song",
              limit: "10",
            })}`,
          )
        ).json()
      ).results ?? [],
    l =
      s.find(
        (o) =>
          normalizeResearch(o.trackName ?? "") === normalizeResearch(e) &&
          normalizeResearch(o.artistName ?? "").includes(normalizeResearch(n)),
      ) ??
      s.find((o) =>
        normalizeResearch(o.artistName ?? "").includes(normalizeResearch(n)),
      );
  return l == null ? undefined : l.primaryGenreName;
}
const GENRE_ALIASES = {
  "r and b soul": "contemporary-rnb",
  "hip hop rap": "hip-hop",
  "singer songwriter": "pop",
  "k pop": "dance-pop",
  "j pop": "city-pop",
  latin: "pop",
  "urbano latino": "trap",
  dance: "dance-pop",
  country: "folk-blues",
  "christian and gospel": "gospel",
  christian: "gospel",
  classical: "jazz",
  vocal: "jazz",
  soundtrack: "pop",
  metal: "rock",
  "hard rock": "rock",
  punk: "rock",
  reggaeton: "dancehall",
  afrobeats: "makossa",
  african: "makossa",
  worldwide: "pop",
  "r and b": "contemporary-rnb",
  "contemporary r and b": "contemporary-rnb",
  "alternative r and b": "contemporary-rnb",
  "rhythm and blues": "rnb",
  "hip hop": "hip-hop",
  rap: "hip-hop",
  "conscious hip hop": "hip-hop",
  "alternative hip hop": "hip-hop",
  "experimental hip hop": "hip-hop",
  "progressive rap": "hip-hop",
  "gospel rap": "hip-hop",
  "progressive soul": "neo-soul",
  "avant soul": "neo-soul",
  "psychedelic soul": "soul",
  electronic: "electronica",
  "electronic dance": "electronica",
  edm: "electronica",
  "art pop": "pop",
  "indie pop": "pop",
  electropop: "synth-pop",
  "indie rock": "alternative",
  "alternative rock": "alternative",
  indie: "alternative",
  "deep house": "house",
  "uk garage": "house",
  drill: "trap",
  "rock and roll": "rock",
  blues: "folk-blues",
};
function matchGenreLabels(e, t) {
  var i, s;
  const n = new Map(
      t.map((l) => [normalizeResearch(l.label.replace(/ music$/i, "")), l.id]),
    ),
    r = [];
  for (const l of e) {
    const o = normalizeResearch(l.replace(/ music$/i, "")),
      a =
        n.get(o) ??
        GENRE_ALIASES[o] ??
        ((i = [...n.entries()].find(([u]) => o.endsWith(` ${u}`))) == null
          ? undefined
          : i[1]) ??
        ((s = Object.entries(GENRE_ALIASES).find(([u]) =>
          o.endsWith(` ${u}`),
        )) == null
          ? undefined
          : s[1]);
    a && !r.includes(a) && r.push(a);
  }
  return r.slice(0, 3);
}
const RESEARCH_CACHE_KEY = "nn-lookup-3";
const INCOMPLETE_HISTORY_WARNING =
  "Some sample sources are unavailable. This history may be incomplete.";
const researchCacheKey = (title, artist) =>
  `${normalizeResearch(title)}|${normalizeResearch(artist)}`;
function readResearchCache() {
  try {
    const cached = JSON.parse(localStorage.getItem(RESEARCH_CACHE_KEY) ?? "{}");
    return cached && typeof cached === "object" && !Array.isArray(cached)
      ? cached
      : {};
  } catch {
    return {};
  }
}
const pendingResearch = new Map();
function hasIncompleteAncestry(title, artist) {
  return readResearchCache()[researchCacheKey(title, artist)]?.partial === true;
}
function lookupAncestry(title, artist, genres, quick = false) {
  const key = researchCacheKey(title, artist);
  const cached = readResearchCache()[key];
  const age = Date.now() - (cached?.at ?? 0);
  if (
    cached &&
    !cached.partial &&
    !cached.warning &&
    Array.isArray(cached.checked) &&
    Array.isArray(cached.found) &&
    Array.isArray(cached.genres) &&
    age >= 0 &&
    age < 86_400_000 &&
    cached.checked.includes("wikipedia") &&
    (cached.checked.includes("genius") ||
      cached.checked.includes("musicbrainz"))
  ) {
    return Promise.resolve(cached);
  }
  if (!pendingResearch.has(key)) {
    const lookup = researchAncestry(title, artist, genres, key, quick).finally(
      () => pendingResearch.delete(key),
    );
    pendingResearch.set(key, lookup);
  }
  return pendingResearch.get(key);
}
async function researchAncestry(title, artist, genres, key, quick) {
  const checked = new Set();
  const warnings = [];
  const samplesPromise = researchSamples(title, artist)
    .then((result) => {
      result.checked.forEach((source) => checked.add(source));
      if (result.warning) warnings.push(result.warning);
      return result;
    })
    .catch((error) => {
      warnings.push(
        error.message || "The sample catalog could not be checked.",
      );
      return { found: [], checked: [] };
    });
  // The hosted API can already have performed MusicBrainz fallback research.
  const musicBrainzPromise = quick
    ? Promise.resolve([])
    : samplesPromise.then((result) => {
        if (result.checked.includes("musicbrainz")) return [];
        return researchMusicBrainz(title, artist)
          .then((found) => {
            checked.add("musicbrainz");
            return found;
          })
          .catch(() => {
            warnings.push("MusicBrainz could not be checked.");
            return [];
          });
      });
  const [samples, wikipedia, musicBrainz, catalogGenre] = await Promise.all([
    samplesPromise,
    researchWikipedia(title, artist)
      .then((result) => {
        checked.add("wikipedia");
        return result;
      })
      .catch(() => {
        warnings.push("Wikipedia could not be checked.");
        return { found: [], genreLabels: [] };
      }),
    musicBrainzPromise,
    lookupCatalogGenre(title, artist).catch(() => undefined),
  ]);
  const found = [];
  for (const sample of [...samples.found, ...wikipedia.found, ...musicBrainz]) {
    const existing = found.find(
      (item) =>
        normalizeResearch(item.title) === normalizeResearch(sample.title),
    );
    if (existing) existing.year ??= sample.year;
    else found.push(sample);
  }
  let matchedGenres = matchGenreLabels(wikipedia.genreLabels, genres);
  if (!matchedGenres.length && catalogGenre)
    matchedGenres = matchGenreLabels([catalogGenre], genres);
  if (!matchedGenres.length) matchedGenres = ["pop"];
  const result = {
    found,
    genres: matchedGenres,
    checked: [...checked],
    partial: warnings.length > 0,
    warning: warnings.length ? INCOMPLETE_HISTORY_WARNING : undefined,
    warnings,
  };
  // Partial records retain only retry status; they are never successful cache hits.
  // This lets the app retry even when an earlier partial lookup added graph edges.
  try {
    localStorage.setItem(
      RESEARCH_CACHE_KEY,
      JSON.stringify({
        ...readResearchCache(),
        [key]: result.partial
          ? {
              partial: true,
              warning: result.warning,
              checked: result.checked,
              at: Date.now(),
            }
          : { ...result, at: Date.now() },
      }),
    );
  } catch {}
  return result;
}
export {
  hasIncompleteAncestry,
  lookupFirstReleaseYear,
  lookupAncestry,
  sameRecording,
};
