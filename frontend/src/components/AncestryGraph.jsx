import React from "react";
import { buildSongLayout } from "../utils/layout.js";
import {
  analyzeAncestry,
  edgeId,
  expandedInfluences,
  influenceParents,
} from "../utils/ancestry.js";
import {
  EdgeLabel,
  RecordNode,
  RootEdge,
  SAMPLE_LABELS,
  verticalEdgePath,
} from "./GraphElements.jsx";
import { GraphCanvas } from "./GraphCanvas.jsx";
import { songFamily } from "../data/graph.js";

const EXPANSION_DELAY = 420;
function AncestryGraphView({
  g: graph,
  rootId: rootId,
  rightInset: rightInset,
  bottomInset = 0,
  selected: selected,
  expanded: expanded,
  onExpand: onExpand,
  onPick: onPick,
  onOpen: onOpen,
  digging = [],
}) {
  const d = React.useMemo(() => buildSongLayout(graph, rootId), [graph, rootId]),
    f = React.useMemo(() => analyzeAncestry(graph, rootId), [graph, rootId]),
    [p, m] = React.useState(null),
    [g, w] = React.useState(null),
    N = React.useMemo(
      () => expandedInfluences(graph, rootId, expanded),
      [graph, rootId, expanded],
    ),
    h = React.useMemo(() => {
      const S = [...d.nodes.values()].filter(
          (W) => W.deep === undefined || N.nodes.has(W.id),
        ),
        _ = new Set(S.map((W) => W.id)),
        z = new Set(N.edges.map(edgeId)),
        E = d.edges.filter(
          (W) =>
            _.has(W.from) && _.has(W.to) && (W.type !== "influence" || z.has(edgeId(W))),
        );
      let R = Infinity,
        A = -1 / 0,
        Z = Infinity,
        V = -1 / 0;
      for (const W of S) {
        R = Math.min(R, W.x - W.r);
        A = Math.max(A, W.x + W.r + W.labelW);
        Z = Math.min(Z, W.y - W.r - 30);
        V = Math.max(V, W.y + W.r + 30);
      }
      return {
        nodes: S,
        edges: E,
        ids: _,
        bounds: {
          x0: R,
          x1: A,
          y0: Z,
          y1: V,
        },
      };
    }, [d, N]),
    y = React.useMemo(() => {
      var E;
      const S = h.nodes.map((R) => {
        const A = R.id === rootId ? 40 : R.gen < 0 || R.cousinOf ? 22 : 28;
        return {
          x0: R.x - R.r - 6,
          x1: R.x + R.r + 14 + R.labelW,
          y0: R.y - Math.max(R.r, A * 0.9) - 6,
          y1: R.y + Math.max(R.r, A * 1.4) + 6,
        };
      });
      for (const R of h.nodes)
        !expanded.has(R.id) &&
          R.gen >= 0 &&
          influenceParents(graph, R.id).length &&
          S.push({
            x0: R.x - 26,
            x1: R.x + 26,
            y0: R.y + R.r,
            y1: R.y + R.r + 56,
          });
      const _ = (R) =>
          S.some((A) => R.x0 < A.x1 && R.x1 > A.x0 && R.y0 < A.y1 && R.y1 > A.y0),
        z = new Map();
      for (const R of h.edges) {
        if (R.type === "influence") continue;
        const A = d.nodes.get(R.from),
          Z = d.nodes.get(R.to),
          V = SAMPLE_LABELS[R.type].length * 8 + 4,
          W = Math.max(
            V,
            (((E = R.element) == null ? undefined : E.length) ?? 0) * 7.4 + 4,
          ),
          re = (f.flow.has(edgeId(R)) ? 2.5 + 26 * f.flow.get(edgeId(R)) : 2.5) / 2 + 8;
        let te;
        for (const [$e, F] of [
          [W, R.element ? 36 : 11],
          [V, 11],
        ]) {
          for (const Y of [0.32, 0.45, 0.22, 0.58, 0.7, 0.14, 0.82]) {
            const { mid: q } = verticalEdgePath(A, Z, Y);
            for (const K of [false, true]) {
              const J = K ? q.x - re - $e : q.x + re,
                we = {
                  x0: J,
                  x1: J + $e,
                  y0: q.y - 11,
                  y1: q.y + F,
                };
              if (
                (_(we) ||
                  (te = {
                    t: Y,
                    left: K,
                    box: {
                      ...we,
                      y1: q.y + 11,
                    },
                  }),
                te)
              )
                break;
            }
            if (te) break;
          }
          if (te) break;
        }
        te &&
          (S.push(te.box),
          z.set(edgeId(R), {
            t: te.t,
            left: te.left,
          }));
      }
      return z;
    }, [h, d, f, rootId, expanded, graph]),
    v = `${rootId}${digging.includes(rootId) ? ":digging" : ""}`,
    x = React.useRef({
      fitKey: v,
      bounds: h.bounds,
    });
  if (x.current.fitKey !== v) {
    const _ = h.nodes.some((E) => E.gen > 0 && E.deep === undefined)
        ? h.nodes
        : h.nodes.filter((E) => E.id === rootId || E.gen < 0 || (E.deep ?? 99) <= 1),
      z = {
        x0: Infinity,
        x1: -1 / 0,
        y0: Infinity,
        y1: -1 / 0,
      };
    for (const E of _.length ? _ : h.nodes) {
      z.x0 = Math.min(z.x0, E.x - E.r);
      z.x1 = Math.max(z.x1, E.x + E.r + E.labelW);
      z.y0 = Math.min(z.y0, E.y - E.r - 30);
      z.y1 = Math.max(z.y1, E.y + E.r + 30);
    }
    x.current = {
      fitKey: v,
      bounds: z,
    };
  }
  const [k, M] = React.useState(),
    $ = React.useRef(h.ids),
    T = React.useRef(v);
  React.useEffect(() => {
    const S = h.nodes.filter((E) => !$.current.has(E.id));
    if ((($.current = h.ids), T.current !== v)) {
      T.current = v;
      return;
    }
    if (!S.length) return;
    const _ = Math.min(...S.map((E) => E.y)),
      z = S.filter((E) => E.y <= _ + 420);
    M({
      key: z.map((E) => E.id).join(","),
      bounds: {
        x0: Math.min(...z.map((E) => E.x - E.r)),
        x1: Math.max(...z.map((E) => E.x + E.r + E.labelW)),
        y0: Math.min(...z.map((E) => E.y - E.r)),
        y1: Math.max(...z.map((E) => E.y + E.r + 40)),
      },
    });
  }, [h, v]);
  const B = React.useCallback((S) => onExpand(S), [onExpand]),
    C = React.useCallback(
      (S) => {
        !expanded.has(S) && influenceParents(graph, S).length ? onExpand(S) : onOpen(S);
      },
      [expanded, graph, onExpand, onOpen],
    ),
    U = React.useRef({
      rootId: rootId,
      ids: h.ids,
    });
  U.current.rootId !== rootId &&
    (U.current = {
      rootId: rootId,
      ids: h.ids,
    });
  const X = (S) => !U.current.ids.has(S),
    G = (S) => (S >= 0 ? S * EXPANSION_DELAY : 300 + -S * EXPANSION_DELAY * 0.6),
    j = (S) => {
      var _;
      return (
        (f.depth + 0.6) * EXPANSION_DELAY +
        (((_ = d.nodes.get(S)) == null ? undefined : _.gen) ?? 0) * 140
      );
    },
    O = (S, _) => (X(S) ? 60 : (f.depth + _ - 0.4) * EXPANSION_DELAY),
    L = (S) => {
      const _ = d.nodes.get(S.from),
        z = d.nodes.get(S.to);
      return S.type === "influence"
        ? Math.max(0, O(z.id, z.deep ?? 1) - 200)
        : _.cousinOf
          ? j(_.cousinOf)
          : G(_.gen) + (f.flow.has(edgeId(S)) ? 120 : 80);
    };
  return (
    <GraphCanvas
      g={graph}
      layout={d}
      rightInset={rightInset}
      bottomInset={bottomInset}
      fitKey={v}
      focus={x.current.bounds}
      minScale={0.42}
      reveal={k}
    >
      <g className={"Back Track"}>
        {h.edges.map((S) => {
          const _ = d.nodes.get(S.from),
            z = d.nodes.get(S.to),
            E = edgeId(S),
            R = f.flow.get(E),
            A = R !== undefined,
            Z = S.type === "influence",
            V = A ? 2.5 + 26 * R : Z ? 2 : 2.5,
            W = L(S);
          return (
            <RootEdge
              a={_}
              b={z}
              type={S.type}
              width={V}
              delay={W}
              duration={EXPANSION_DELAY + 120}
              showPill={false}
              className={A || Z ? "" : _.cousinOf ? "offspring cousin" : "offspring"}
              onEnter={() => w(E)}
              onLeave={() => w(null)}
              key={`${rootId}:${E}`}
            />
          );
        })}
      </g>
      <g className={"discs"}>
        {h.nodes
          .slice()
          .sort((S, _) => S.r - _.r)
          .map((S) => {
            const _ = graph.byId.get(S.id),
              z = S.id === rootId;
            return (
              <RecordNode
                song={_}
                n={S}
                color={songFamily(graph, _).color}
                clipId={`clip-s-${S.id}`}
                labelSize={z ? 40 : S.gen < 0 || S.cousinOf ? 22 : 28}
                showLabel={true}
                delay={
                  z
                    ? 0
                    : S.deep !== undefined
                      ? O(S.id, S.deep)
                      : S.cousinOf
                        ? j(S.cousinOf)
                        : G(S.gen) + (S.gen > 0 ? EXPANSION_DELAY * 0.7 : 0)
                }
                className={`${z ? "is-root" : ""} ${S.gen < 0 || S.cousinOf ? "offspring" : ""} ${selected === S.id ? "is-selected" : ""}`}
                onClick={onPick}
                onDoubleClick={C}
                onEnter={m}
                onLeave={() => m(null)}
                key={S.id}
              />
            );
          })}
      </g>
      <g className={"edge-labels"}>
        {h.edges.map((S) => {
          const _ = d.nodes.get(S.from),
            z = d.nodes.get(S.to),
            E = edgeId(S),
            R = f.flow.get(E),
            A = S.type === "influence",
            Z = g === E || p === S.from || p === S.to;
          return (A || _.cousinOf) && !Z ? null : (
            <EdgeLabel
              a={_}
              b={z}
              type={S.type}
              width={R !== undefined ? 2.5 + 26 * R : A ? 2 : 2.5}
              delay={A || _.cousinOf ? 0 : L(S)}
              duration={EXPANSION_DELAY + 120}
              element={Z ? S.element : undefined}
              labelAt={y.get(E)}
              key={`${rootId}:${E}`}
            />
          );
        })}
      </g>
      <g className={"digging"}>
        {digging.map((S) => {
          const _ = d.nodes.get(S);
          if (!_) return null;
          const z = _.y + _.r + 6,
            E = Math.max(18, _.r * 0.7);
          return (
            <g
              className={"ghost"}
              transform={`translate(${_.x}, ${z})`}
              aria-label={"digging for samples"}
              key={S}
            >
              <line y1={0} y2={110} className={"ghost-root"} />
              <circle cy={110 + E} r={E} className={"ghost-disc"} />
              <text y={110 + E * 2 + 26} textAnchor={"middle"} className={"ghost-label"}>
                {"digging"}
              </text>
            </g>
          );
        })}
      </g>
      <g className={"dig-marks"}>
        {h.nodes
          .filter(
            (S) =>
              !expanded.has(S.id) &&
              S.gen >= 0 &&
              influenceParents(graph, S.id).length > 0,
          )
          .map((S) => (
            <g
              className={"dig-mark"}
              transform={`translate(${S.x}, ${S.y + S.r + 8})`}
              onClick={() => B(S.id)}
              key={S.id}
            >
              <title>
                {"dig under "}
                {graph.byId.get(S.id).title}
                {": see what it grew out of"}
              </title>
              <line y1={0} y2={22} />
              <text y={42} textAnchor={"middle"}>
                {"dig"}
              </text>
              <rect x={-26} y={-4} width={52} height={56} className={"dig-hit"} />
            </g>
          ))}
      </g>
    </GraphCanvas>
  );
}
const AncestryGraph = React.memo(AncestryGraphView);
export { AncestryGraph };
