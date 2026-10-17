import { FALLBACK_FAMILY_COLOR } from "../styles/palette.js";
import { genreNodeId } from "../data/graph.js";

function ancestorGenerations(e, t) {
  const n = new Map([[t, 0]]),
    r = [t];
  for (; r.length;) {
    const i = r.shift();
    for (const s of e.samplesOf.get(i) ?? [])
      n.has(s.to) || (n.set(s.to, n.get(i) + 1), r.push(s.to));
  }
  return n;
}
function descendantGenerations(e, t, n = Infinity) {
  const r = new Map([[t, 0]]),
    i = [t];
  for (; i.length;) {
    const s = i.shift(),
      l = r.get(s);
    if (!(l >= n))
      for (const o of e.sampledBy.get(s) ?? [])
        r.has(o.from) || (r.set(o.from, l + 1), i.push(o.from));
  }
  return r;
}
function edgesWithin(e, t) {
  return e.samples.filter((n) => t.has(n.from) && t.has(n.to));
}
const SAMPLE_WEIGHTS = {
    influence: 0,
    sample: 1,
    vocal: 1.2,
    melody: 1.2,
    cover: 1.2,
    bass: 1,
    interpolation: 1,
    drums: 0.9,
  },
  ORIGINAL_SHARE = 0.4,
  COVER_ORIGINAL_SHARE = 0.15;
function originalShare(e, t) {
  const n = e.samplesOf.get(t) ?? [];
  return n.length
    ? n.some((r) => r.type === "cover")
      ? COVER_ORIGINAL_SHARE
      : ORIGINAL_SHARE
    : 1;
}
const edgeId = (e) => `${e.from}>${e.to}`;
function analyzeAncestry(e, t) {
  const n = ancestorGenerations(e, t),
    r = new Set(n.keys()),
    i = new Map();
  for (const f of r) i.set(f, 0);
  for (const f of edgesWithin(e, r)) i.set(f.to, i.get(f.to) + 1);
  const s = [],
    l = [...r].filter((f) => i.get(f) === 0);
  for (; l.length;) {
    const f = l.shift();
    s.push(f);
    for (const p of e.samplesOf.get(f) ?? [])
      r.has(p.to) &&
        (i.set(p.to, i.get(p.to) - 1), i.get(p.to) === 0 && l.push(p.to));
  }
  const o = new Map([[t, 1]]),
    a = new Map(),
    u = new Map();
  for (const f of s) {
    const p = o.get(f) ?? 0,
      m = originalShare(e, f);
    a.set(f, p * m);
    const g = e.samplesOf.get(f) ?? [],
      w = g.reduce((N, h) => N + SAMPLE_WEIGHTS[h.type], 0);
    for (const N of g) {
      const h = (p * (1 - m) * SAMPLE_WEIGHTS[N.type]) / w;
      u.set(edgeId(N), h);
      o.set(N.to, (o.get(N.to) ?? 0) + h);
    }
  }
  let d = e.byId.get(t);
  for (const f of r) {
    const p = e.byId.get(f);
    p.year < d.year && (d = p);
  }
  return {
    root: t,
    gen: n,
    contrib: a,
    flow: u,
    reach: o,
    inherited: 1 - (a.get(t) ?? 0),
    oldest: d,
    depth: Math.max(...n.values()),
  };
}
function compositionByFamily(e, t, n = false) {
  const r = new Map();
  for (const [s, l] of t.contrib) {
    if ((!n && s === t.root) || l < 1e-6) continue;
    const o = e.byId.get(s),
      a = e.genreById.get(o.genres[0]),
      u = e.familyById.get((a == null ? undefined : a.family) ?? "") ?? {
        id: "other",
        label: "Other",
        color: FALLBACK_FAMILY_COLOR,
      };
    r.has(u.id) ||
      r.set(u.id, {
        key: u.id,
        label: u.label,
        color: u.color,
        share: 0,
        children: [],
      });
    const d = r.get(u.id);
    d.share += l;
    let f = d.children.find((p) => p.key === (a == null ? undefined : a.id));
    f ||
      ((f = {
        key: (a == null ? undefined : a.id) ?? "unknown",
        label: (a == null ? undefined : a.label) ?? "Unknown",
        color: u.color,
        share: 0,
        children: [],
      }),
      d.children.push(f));
    f.share += l;
    f.children.push({
      key: s,
      label: o.title,
      color: u.color,
      share: l,
      children: [],
    });
  }
  const i = (s) => (
    s.sort((l, o) => o.share - l.share),
    s.forEach((l) => i(l.children)),
    s
  );
  return i([...r.values()]);
}
function compositionByGeneration(e, t) {
  const n = [];
  for (const [r, i] of t.contrib) {
    const s = t.gen.get(r);
    n[s] ||
      (n[s] = {
        gen: s,
        total: 0,
        parts: [],
      });
    n[s].total += i;
    n[s].parts.push({
      id: r,
      share: i,
    });
  }
  for (const r of n)
    r && r.parts.sort((i, s) => e.byId.get(i.id).year - e.byId.get(s.id).year);
  return n.filter(Boolean);
}
const RHYTHM_TYPES = ["drums", "bass", "cover"],
  MELODY_TYPES = ["vocal", "melody", "interpolation", "cover"];
function dominantLineage(e, t, n) {
  const r = [];
  let i = t.root;
  const s = new Set([i]);
  for (;;) {
    const l = (e.samplesOf.get(i) ?? []).filter(
      (a) => n.includes(a.type) && !s.has(a.to),
    );
    if (!l.length) break;
    l.sort(
      (a, u) => (t.flow.get(edgeId(u)) ?? 0) - (t.flow.get(edgeId(a)) ?? 0),
    );
    const o = l[0];
    r.push(o);
    s.add(o.to);
    i = o.to;
  }
  return r;
}
const rhythmLineage = (e, t) => dominantLineage(e, t, RHYTHM_TYPES),
  melodyLineage = (e, t) => dominantLineage(e, t, MELODY_TYPES),
  ORDINAL_LABELS = ["", "1st", "2nd", "3rd", "4th", "5th"],
  REMOVED_LABELS = ["", "once removed", "twice removed", "three times removed"];
function relativeLabel(e, t, n) {
  if (e === 1 && t === 1) return n ? "Half-sibling" : "Sibling";
  if (e === 1) return t === 2 ? "Niece or nephew" : "Grand-niece or nephew";
  if (t === 1) return e === 2 ? "Aunt or uncle" : "Great-aunt or uncle";
  const r = Math.min(e, t) - 1,
    i = Math.abs(e - t);
  return `${ORDINAL_LABELS[r] ?? `${r}th`} cousin${i ? " " + (REMOVED_LABELS[i] ?? `${i}× removed`) : ""}`;
}
function findRelatives(e, t, n) {
  const r = n(t),
    i = r.gen,
    s = [];
  for (const l of e.songs) {
    if (l.id === t || i.has(l.id)) continue;
    const o = n(l.id);
    if (o.gen.has(t)) {
      const m = o.gen.get(t);
      s.push({
        song: l,
        label: m === 1 ? "Child" : m === 2 ? "Grandchild" : "Great-grandchild",
        shared: o.reach.get(t) ?? 0,
        via: e.byId.get(t),
        closeness: m,
      });
      continue;
    }
    let a = null;
    for (const [m, g] of i) {
      if (m === t || !o.gen.has(m)) continue;
      const w = o.gen.get(m);
      (!a ||
        g + w < a.a + a.b ||
        (g + w === a.a + a.b && Math.min(g, w) < Math.min(a.a, a.b))) &&
        (a = {
          a: g,
          b: w,
          via: m,
        });
    }
    if (!a) continue;
    let u = 0;
    for (const [m, g] of r.contrib) {
      if (m === t) continue;
      const w = o.contrib.get(m);
      w && (u += Math.min(g, w));
    }
    const d = new Set((e.samplesOf.get(t) ?? []).map((m) => m.to)),
      f = new Set((e.samplesOf.get(l.id) ?? []).map((m) => m.to)),
      p = d.size !== f.size || [...d].some((m) => !f.has(m));
    s.push({
      song: l,
      label: relativeLabel(a.a, a.b, p),
      shared: u,
      via: e.byId.get(a.via),
      closeness: a.a + a.b,
    });
  }
  return s.sort((l, o) => l.closeness - o.closeness || o.shared - l.shared);
}
function leafSongs(e) {
  return e.songs.filter((t) => (e.sampledBy.get(t.id) ?? []).length === 0);
}
function memoizeById(e) {
  const t = new Map();
  return (n) => (t.has(n) || t.set(n, e(n)), t.get(n));
}
function deepAncestry(e, t, n) {
  const r = e.byId.get(t),
    i = r.kind ? new Map([[t, 0]]) : ancestorGenerations(e, t),
    s = new Map(),
    l = new Map(),
    o = [],
    a = new Set(),
    u = [];
  let d = 0;
  const f = (g) => {
    const w = `${g.from}>${g.to}`;
    a.has(w) || (a.add(w), o.push(g));
  };
  if (r.kind)
    u.push({
      id: t,
      d: 0,
      b: 0,
    });
  else
    for (const [g, w] of i) {
      if ((e.samplesOf.get(g) ?? []).length) continue;
      const N = e.byId.get(g).genres[0];
      if (!N || !e.genreById.has(N)) continue;
      const h = genreNodeId(N);
      d = Math.max(d, 1);
      f({
        from: g,
        to: h,
        type: "influence",
        element: "grew out of",
        source: "",
      });
      s.has(h) ||
        (s.set(h, 1),
        l.set(h, w),
        u.push({
          id: h,
          d: 1,
          b: w,
        }));
    }
  const p = new Map(u.map((g) => [g.id, g.d]));
  for (; u.length;) {
    const { id: g, d: w, b: N } = u.shift();
    for (const h of e.influencesOf.get(g) ?? []) {
      const y = w + 1;
      d = Math.max(d, y);
      (!p.has(h.to) || p.get(h.to) > y) &&
        (p.set(h.to, y),
        u.push({
          id: h.to,
          d: y,
          b: N,
        }));
      y <= n && (s.has(h.to) || (s.set(h.to, y), l.set(h.to, N)), f(h));
    }
  }
  const m = (g) => i.has(g) || s.has(g);
  return {
    level: s,
    base: l,
    edges: o.filter((g) => m(g.from) && s.has(g.to)),
    max: d,
  };
}
function influenceParents(e, t) {
  const n = e.byId.get(t);
  if (!n) return [];
  if (n.kind) return (e.influencesOf.get(t) ?? []).map((i) => i.to);
  if ((e.samplesOf.get(t) ?? []).length) return [];
  const r = n.genres[0];
  return r && e.genreById.has(r) ? [genreNodeId(r)] : [];
}
function expandedInfluences(e, t, n) {
  const i = e.byId.get(t).kind ? [t] : [...ancestorGenerations(e, t).keys()],
    s = new Set(),
    l = [],
    o = i.filter((u) => n.has(u)),
    a = new Set();
  for (; o.length;) {
    const u = o.shift();
    if (!a.has(u)) {
      a.add(u);
      for (const d of influenceParents(e, u)) {
        l.push(
          (e.influencesOf.get(u) ?? []).find((f) => f.to === d) ?? {
            from: u,
            to: d,
            type: "influence",
            element: "grew out of",
            source: "",
          },
        );
        s.has(d) || s.add(d);
        n.has(d) && o.push(d);
      }
    }
  }
  return {
    nodes: s,
    edges: l,
  };
}
function initialExpandedNodes(e, t) {
  const n = e.byId.get(t),
    r = new Set();
  if (n.kind) return (r.add(t), r);
  if ((e.samplesOf.get(t) ?? []).length) return r;
  let i = [t];
  for (let s = 0; s < 3; s++) {
    const l = [];
    for (const o of i) {
      r.add(o);
      l.push(...influenceParents(e, o));
    }
    i = l;
  }
  return r;
}
export {
  analyzeAncestry,
  ancestorGenerations,
  compositionByFamily,
  compositionByGeneration,
  deepAncestry,
  descendantGenerations,
  edgeId,
  edgesWithin,
  expandedInfluences,
  findRelatives,
  influenceParents,
  initialExpandedNodes,
  leafSongs,
  melodyLineage,
  memoizeById,
  rhythmLineage,
};
