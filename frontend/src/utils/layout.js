import { songSubtitle } from "../data/graph.js";
import {
  ancestorGenerations,
  deepAncestry,
  descendantGenerations,
  edgesWithin,
} from "./ancestry.js";

const CURRENT_YEAR = new Date().getFullYear();
function createTimeScale(e, t, n = 0) {
  const r = [...new Set(e)].sort((h, y) => y - h),
    i = Math.min(Math.ceil(r[0]) + 2, CURRENT_YEAR + 1),
    s = Math.floor(r[r.length - 1]) - 2,
    l = [i, ...r, s],
    o = 7,
    a = 0.16,
    u = [],
    d = [];
  let f = 0;
  for (let h = 0; h < l.length; h++) {
    if (h > 0) {
      const y = l[h - 1] - l[h];
      if (y <= 0) continue;
      const v = y <= o ? y : Math.min(30, o + (y - o) * a);
      f += Math.max(v, n);
      y > o * 2 &&
        d.push({
          from: l[h],
          to: l[h - 1],
          y0: 0,
          y1: 0,
        });
    }
    u.push({
      year: l[h],
      pos: f,
    });
  }
  const p = u[u.length - 1],
    m = (h) => {
      let y;
      if (h >= u[0].year) y = -(h - u[0].year);
      else if (h <= p.year) y = p.pos + (p.year - h);
      else {
        let v = 1;
        for (; u[v].year > h;) v++;
        const x = u[v - 1],
          k = u[v];
        y = x.pos + ((x.year - h) / (x.year - k.year)) * (k.pos - x.pos);
      }
      return y * t;
    };
  for (const h of d) {
    h.y0 = m(h.to);
    h.y1 = m(h.from);
  }
  const g = [],
    w = [];
  for (let h = Math.floor(i / 10) * 10; h >= Math.max(s, 1900); h -= 10) w.push(h);
  for (let h = 1800; h >= Math.max(s, 1e3); h -= 100) w.push(h);
  for (const h of [
    750, 500, 250, 0, -500, -1e3, -2e3, -3e3, -5e3, -1e4, -2e4, -4e4, -6e4,
  ])
    h >= s && w.push(h);
  let N = -1 / 0;
  for (const h of w) {
    const y = m(h);
    y - N >= 34 &&
      (g.push({
        year: h,
        y,
      }),
      (N = y));
  }
  return {
    y: m,
    ticks: g,
    breaks: d,
    top: m(i),
    bottom: m(s),
  };
}
function formatEra(e) {
  return e >= 1e3
    ? `${e}s`
    : e > 0
      ? `${e} ce`
      : e === 0
        ? "1 ce"
        : `${(-e).toLocaleString("en-US")} bce`;
}
const estimatedTextWidth = (e, t) => e.length * t * 0.47,
  songLabelWidth = (e, t, n) => {
    const r = e.byId.get(t);
    return (
      Math.max(
        estimatedTextWidth(r.title, n),
        estimatedTextWidth(songSubtitle(r), n * 0.72),
      ) + 16
    );
  };
function adjustedYears(e, t, n = []) {
  const r = new Map(),
    i = [...t].sort((s, l) => e.byId.get(l).year - e.byId.get(s).year);
  for (const s of i) r.set(s, e.byId.get(s).year);
  for (let s = 0; s < 6; s++)
    for (const l of [...edgesWithin(e, t), ...n]) {
      if (!r.has(l.from) || !r.has(l.to)) continue;
      const o = r.get(l.from);
      r.get(l.to) > o - 0.6 && r.set(l.to, o - 0.6);
    }
  return r;
}
function treeColumns(e, t) {
  const n = new Map(),
    r = new Set([e]),
    i = new Map(),
    s = [e];
  for (; s.length;) {
    const a = s.shift(),
      u = [];
    for (const d of t(a)) r.has(d) || (r.add(d), u.push(d), s.push(d));
    i.set(a, u);
  }
  let l = 0;
  const o = (a) => {
    const u = i.get(a) ?? [];
    if (!u.length) return (n.set(a, l++), n.get(a));
    const d = u.map(o),
      f = (d[0] + d[d.length - 1]) / 2;
    return (n.set(a, f), f);
  };
  return (o(e), n);
}
function relaxLayout(e, t, n, r) {
  const i = new Map(e.map((l) => [l.id, l])),
    s = new Map();
  for (const l of t) {
    s.set(l.from, (s.get(l.from) ?? 0) + 1);
    s.set(l.to, (s.get(l.to) ?? 0) + 1);
  }
  for (let l = 0; l < r.iterations; l++) {
    const o = 1 - l / r.iterations;
    for (const a of t) {
      const u = i.get(a.from),
        d = i.get(a.to),
        f = (d.x - u.x) * r.spring * o;
      u.x += f / Math.sqrt(s.get(u.id));
      d.x -= f / Math.sqrt(s.get(d.id));
    }
    for (const a of e) a.x += (n.get(a.id) - a.x) * r.anchor * o;
    for (let a = 0; a < 2; a++) {
      const u = [...e].sort((d, f) => d.x - f.x);
      for (let d = 0; d < u.length; d++) {
        const f = u[d],
          p = Math.max(f.r, f.labeled ? 26 : 0) + r.rowPad;
        for (let m = d + 1; m < u.length; m++) {
          const g = u[m],
            w = f.r + (f.labeled ? f.labelW : 0) + r.gap + g.r;
          if (g.x - f.x > w + 400) break;
          const N = Math.max(g.r, g.labeled ? 26 : 0) + r.rowPad;
          if (Math.abs(f.y - g.y) > p + N) continue;
          const h = g.x - f.x;
          if (h < w) {
            const y = (w - h) / 2;
            f.x -= y;
            g.x += y;
          }
        }
      }
    }
    if (l > r.iterations * 0.3)
      for (const a of t) nodeRadius(i.get(a.from), i.get(a.to), e);
  }
}
function centerLabel(e, t, n) {
  const r = e.y + e.r + 5,
    i = t.y - t.r - 5,
    s = (r + i) / 2,
    l = (u, d, f, p, m) =>
      (1 - m) ** 3 * u + 3 * (1 - m) ** 2 * m * d + 3 * (1 - m) * m * m * f + m ** 3 * p;
  let o = 0,
    a = 1;
  for (let u = 0; u < 18; u++) {
    const d = (o + a) / 2;
    l(r, s, s, i, d) < n ? (o = d) : (a = d);
  }
  return l(e.x, e.x, t.x, t.x, o);
}
function nodeRadius(e, t, n) {
  const [r, i] = e.y <= t.y ? [e, t] : [t, e],
    s = 14;
  for (const l of n) {
    if (l === e || l === t || l.y - l.r <= r.y + r.r + 5 || l.y + l.r >= i.y - i.r - 5)
      continue;
    const o = centerLabel(r, i, l.y),
      a = l.x - l.r - s,
      u = l.x + l.r + (l.labeled ? l.labelW + 14 : 0) + s;
    if (o <= a || o >= u) continue;
    const d = o - a,
      f = u - o;
    l.x += f < d ? -f * 0.5 : d * 0.5;
  }
}
function layoutBounds(e, t) {
  let n = Infinity,
    r = -1 / 0;
  for (const i of e) {
    n = Math.min(n, i.x - i.r);
    r = Math.max(r, i.x + i.r + (i.labeled ? i.labelW : 0));
  }
  return {
    x0: n,
    x1: r,
    y0: t.top,
    y1: t.bottom,
  };
}
function buildSongLayout(e, t) {
  const n = e.byId.get(t),
    r = ancestorGenerations(e, t),
    i = n.kind ? new Map([[t, 0]]) : descendantGenerations(e, t, 2);
  if (n.kind) for (const C of (e.grewInto.get(t) ?? []).slice(0, 8)) i.set(C.from, 1);
  const s = deepAncestry(e, t, 99),
    l = new Map(),
    o = [];
  for (const [C, U] of r)
    if (U !== 0)
      for (const X of e.sampledBy.get(C) ?? [])
        r.has(X.from) ||
          i.has(X.from) ||
          o.push({
            id: X.from,
            via: C,
            gen: U,
          });
  o.sort(
    (C, U) =>
      Number(e.featured.includes(U.id)) - Number(e.featured.includes(C.id)) ||
      C.gen - U.gen ||
      e.byId.get(U.id).year - e.byId.get(C.id).year,
  ).forEach((C) => {
    l.size < 8 && !l.has(C.id) && l.set(C.id, C.via);
  });
  const a = new Set([...r.keys(), ...i.keys(), ...l.keys(), ...s.level.keys()]),
    u = n.kind ? (e.grewInto.get(t) ?? []).filter((C) => i.has(C.from)) : [],
    d = [
      ...edgesWithin(e, a).filter(
        (C) =>
          (r.has(C.from) && r.has(C.to)) ||
          (i.has(C.from) && i.has(C.to)) ||
          l.get(C.from) === C.to,
      ),
      ...s.edges,
      ...u,
    ],
    f = adjustedYears(e, a, [...s.edges, ...u]),
    p = [...f.entries()].filter(([C]) => !s.level.has(C)).map(([, C]) => C),
    m = createTimeScale(p, 1, 2.2),
    g = Math.max(16, Math.min(34, 900 / Math.max(10, m.bottom - m.top))),
    w = createTimeScale([...f.values()], g, 92 / g),
    N = 250,
    h = new Map();
  for (const C of s.edges) h.set(C.from, [...(h.get(C.from) ?? []), C.to]);
  const y = treeColumns(t, (C) => [
      ...(e.samplesOf.get(C) ?? []).map((U) => U.to),
      ...(h.get(C) ?? []),
    ]),
    v = treeColumns(t, (C) =>
      n.kind && C === t
        ? u.map((U) => U.from)
        : (e.sampledBy.get(C) ?? []).filter((U) => i.has(U.from)).map((U) => U.from),
    ),
    x = y.get(t) - v.get(t),
    k = new Map();
  for (const [C, U] of y) k.set(C, U * N);
  for (const [C, U] of v) k.has(C) || k.set(C, (U + x) * N);
  const M = new Map();
  for (const [C, U] of l) {
    const X = M.get(U) ?? 0;
    M.set(U, X + 1);
    const G = X % 2 === 0 ? 1 : -1;
    k.set(C, k.get(U) + G * N * (0.8 + Math.floor(X / 2) * 0.8));
  }
  const $ = [...a].map((C) => {
    const U = l.has(C),
      X = s.level.get(C),
      G = r.has(C)
        ? r.get(C)
        : X !== undefined
          ? s.base.get(C) + X
          : i.has(C)
            ? -i.get(C)
            : 0,
      j = C === t ? 50 : U || G < 0 ? 24 : X !== undefined ? 28 : 32;
    return {
      id: C,
      x: k.get(C) ?? 0,
      y: w.y(f.get(C)),
      r: j,
      year: e.byId.get(C).year,
      labeled: true,
      labelW: songLabelWidth(e, C, C === t ? 40 : U || G < 0 ? 22 : 28),
      gen: G,
      cousinOf: l.get(C),
      deep: X,
    };
  });
  relaxLayout(
    $,
    d.filter((C) => !l.has(C.from)),
    k,
    {
      iterations: 120,
      spring: 0.12,
      anchor: 0.08,
      gap: 26,
      rowPad: 6,
    },
  );
  const T = $.find((C) => C.id === t).x;
  for (const C of $) C.x -= T;
  const B = new Map($.map((C) => [C.id, C]));
  return {
    nodes: B,
    edges: d,
    time: w,
    bounds: layoutBounds(B.values(), w),
    maxDig: s.max,
  };
}
export { buildSongLayout, formatEra };
