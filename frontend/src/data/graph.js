import { FAMILY_COLORS, FALLBACK_FAMILY_COLOR } from "../styles/palette.js";
import { fetchContributions, mergeContributions } from "./contributions.js";

const genreNodeId = (e) => `genre:${e}`;
function hydrateGraph(e) {
  const families = e.families.map((family) => ({
    ...family,
    color: FAMILY_COLORS[family.id] ?? FALLBACK_FAMILY_COLOR,
  }));
  const t = new Map(e.songs.map((f) => [f.id, f])),
    n = new Map(),
    r = new Map();
  for (const f of e.songs) {
    n.set(f.id, []);
    r.set(f.id, []);
  }
  for (const f of e.samples) {
    n.get(f.from).push(f);
    r.get(f.to).push(f);
  }
  const i = [
      ...e.genres.map((f) => ({
        id: genreNodeId(f.id),
        title: f.label,
        artist: "genre",
        year: f.start,
        genres: [f.id],
        kind: "genre",
        family: f.family,
        startLabel: `from ${f.start}`,
        preview: f.preview,
        art: f.art,
        link: f.link,
        heard: f.representative,
      })),
      ...(e.traditions ?? []).map((f) => ({
        id: f.id,
        title: f.label,
        artist: f.region,
        year: f.start,
        genres: [],
        kind: "tradition",
        family: f.family,
        startLabel: f.startLabel,
        region: f.region,
        about: f.about,
        source: f.source,
        preview: f.preview,
        art: f.art,
        link: f.link,
        heard: f.recording ?? undefined,
      })),
    ],
    s = [
      ...e.genres.map((f) => ({
        id: genreNodeId(f.id),
        listen: f.listen,
      })),
      ...(e.traditions ?? []).map((f) => ({
        id: f.id,
        listen: f.listen,
      })),
    ],
    l = [];
  for (const { id: f, listen: p } of s) {
    const m = i.find((w) => w.id === f),
      g = p ?? [];
    m.listen = g.map((w, N) => `${f}~${N}`);
    g.forEach((w, N) =>
      l.push({
        id: `${f}~${N}`,
        title: w.title,
        artist: w.artist,
        year: w.year ?? m.year,
        genres: m.genres,
        preview: w.preview,
        art: w.art,
        listenOf: f,
      }),
    );
    !m.preview &&
      g[0] &&
      ((m.preview = g[0].preview),
      (m.art = g[0].art),
      (m.heard = {
        title: g[0].title,
        artist: g[0].artist,
      }));
  }
  for (const f of [...i, ...l]) t.set(f.id, f);
  const o = new Set(e.genres.map((f) => f.id)),
    a = (f) => (o.has(f) ? genreNodeId(f) : f),
    u = new Map(),
    d = new Map();
  for (const f of i) {
    u.set(f.id, []);
    d.set(f.id, []);
  }
  for (const f of e.influences ?? []) {
    const p = {
      from: a(f.from),
      to: a(f.to),
      type: "influence",
      element: "grew out of",
      source: f.source,
    };
    !t.has(p.from) ||
      !t.has(p.to) ||
      (u.get(p.from).push(p), d.get(p.to).push(p));
  }
  return {
    ...e,
    families,
    byId: t,
    genreById: new Map(e.genres.map((f) => [f.id, f])),
    familyById: new Map(families.map((f) => [f.id, f])),
    samplesOf: n,
    sampledBy: r,
    deep: i,
    influencesOf: u,
    grewInto: d,
  };
}
async function loadGraph() {
  const [response, contributions] = await Promise.all([
    fetch("/data/graph.json"),
    fetchContributions(),
  ]);
  if (!response.ok) throw new Error(`graph.json: ${response.status}`);
  const graph = await response.json();
  return hydrateGraph(mergeContributions(graph, contributions));
}
function primaryGenre(e, t) {
  return e.genreById.get(t.genres[0]);
}
function songFamily(e, t) {
  var r;
  const n =
    t.family ?? ((r = primaryGenre(e, t)) == null ? undefined : r.family);
  return (
    (n && e.familyById.get(n)) || {
      id: "other",
      label: "Other",
      color: FALLBACK_FAMILY_COLOR,
    }
  );
}
function songSubtitle(e) {
  return e.kind === "genre"
    ? `genre, ${e.startLabel}`
    : e.kind === "tradition"
      ? [e.startLabel, e.region].filter(Boolean).join(", ")
      : `${e.artist}, ${e.year}`;
}
const normalizeSearch = (e) =>
  e
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
function searchGraph(e, t, n = 8) {
  const r = normalizeSearch(t);
  if (!r) return [];
  const i = r.split(" "),
    s = [];
  for (const l of [...e.songs, ...e.deep]) {
    const o = normalizeSearch(l.title),
      a = normalizeSearch(l.artist),
      u = `${o} ${a}`;
    if (!i.every((f) => u.includes(f))) continue;
    let d = 0;
    o.startsWith(r) && (d += 10);
    a.startsWith(r) && (d += 6);
    o === r && (d += 10);
    d += l.year / 1e3;
    l.kind && (d -= 2);
    s.push({
      s: l,
      score: d,
    });
  }
  return s
    .sort((l, o) => o.score - l.score)
    .slice(0, n)
    .map((l) => l.s);
}
export {
  genreNodeId,
  hydrateGraph,
  loadGraph,
  searchGraph,
  songFamily,
  songSubtitle,
};
