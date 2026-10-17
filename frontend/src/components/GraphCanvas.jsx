import React from "react";
import { select } from "d3-selection";
import { zoom, zoomIdentity, zoomTransform } from "d3-zoom";
import "d3-transition";
import { sepiaMatrix } from "./GraphElements.jsx";
import { formatEra } from "../utils/layout.js";

function GraphCanvas({
  layout: layout,
  rightInset: rightInset,
  topInset = 110,
  bottomInset = 0,
  fitKey: fitKey,
  maxScale = 1.1,
  focus: focus,
  minScale = 0.15,
  reveal: reveal,
  children: children,
}) {
  const d = React.useRef(null),
    f = React.useRef(),
    [p, m] = React.useState(zoomIdentity),
    [g, w] = React.useState({
      w: window.innerWidth,
      h: window.innerHeight,
    });
  React.useEffect(() => {
    const M = () =>
      w({
        w: window.innerWidth,
        h: window.innerHeight,
      });
    return (
      window.addEventListener("resize", M),
      () => window.removeEventListener("resize", M)
    );
  }, []);
  React.useLayoutEffect(() => {
    const M = select(d.current),
      $ = zoom()
        .scaleExtent([0.15, 2.5])
        .filter((T) => T.type !== "wheel" || T.ctrlKey || T.metaKey)
        .wheelDelta(
          (T) =>
            -T.deltaY *
            (T.deltaMode === 1 ? 0.05 : T.deltaMode ? 1 : 0.002) *
            (T.ctrlKey && !T.metaKey ? 10 : 1),
        )
        .on("zoom", (T) => m(T.transform));
    return (
      M.call($).on("dblclick.zoom", null),
      M.on("wheel.pan", (T) => {
        T.ctrlKey ||
          T.metaKey ||
          (T.preventDefault(),
          $.translateBy(
            M,
            -T.deltaX / zoomTransform(M.node()).k,
            -T.deltaY / zoomTransform(M.node()).k,
          ));
      }),
      (f.current = $),
      () => {
        M.on(".zoom", null).on("wheel.pan", null);
      }
    );
  }, []);
  const N = () => {
    const { x0: M, x1: $, y0: T, y1: B } = focus ?? layout.bounds,
      C = layout.polar ? 0 : g.w < 700 ? 64 : 120,
      U = g.w - rightInset - C - (g.w < 700 ? 24 : 60),
      X = g.h - topInset - 70 - bottomInset,
      G = Math.max(
        minScale,
        Math.min(maxScale, U / Math.max(1, $ - M), X / Math.max(1, B - T)),
      ),
      j = C + U / 2 + (g.w < 700 ? 12 : 30) - ((M + $) / 2) * G,
      O = (B - T) * G > X ? topInset + 10 - T * G : topInset + X / 2 - ((T + B) / 2) * G,
      L = zoomIdentity.translate(j, O).scale(G);
    select(d.current).transition().duration(900).call(f.current.transform, L);
  };
  React.useEffect(N, [fitKey, g.w, g.h, rightInset, bottomInset]);
  const h = (M) => {
      const $ = (g.w - rightInset) / 2,
        T = g.h / 2;
      select(d.current).transition().duration(250).call(f.current.scaleBy, M, [$, T]);
    },
    y = React.useRef(N);
  y.current = N;
  const v = React.useRef(h);
  v.current = h;
  React.useEffect(() => {
    const M = ($) => {
      if ($.target.closest("input, textarea, [contenteditable]") || $.altKey) return;
      const B = select(d.current),
        C = zoomTransform(d.current).k,
        U = (X, G) =>
          B.transition()
            .duration(200)
            .call(f.current.translateBy, X / C, G / C);
      if ($.key === "=" || $.key === "+") v.current(1.4);
      else if ($.key === "-" || $.key === "_") v.current(0.7142857142857143);
      else if ($.key === "0") y.current();
      else if ($.key === "ArrowUp") U(0, 160);
      else if ($.key === "ArrowDown") U(0, -160);
      else if ($.key === "ArrowLeft") U(160, 0);
      else if ($.key === "ArrowRight") U(-160, 0);
      else return;
      $.preventDefault();
    };
    return (
      window.addEventListener("keydown", M),
      () => window.removeEventListener("keydown", M)
    );
  }, []);
  React.useEffect(() => {
    if (!reveal) return;
    const M = d.current,
      $ = zoomTransform(M),
      T = $.applyY(reveal.bounds.y0),
      B = $.applyY(reveal.bounds.y1),
      C = $.applyX(reveal.bounds.x0),
      U = $.applyX(reveal.bounds.x1),
      X = g.h - bottomInset - 90,
      G = g.w - rightInset - 30;
    let j = 0,
      O = 0;
    B > X && (j = Math.max(X - B, topInset + 20 - T));
    U > G && (O = G - U);
    C + O < 130 && (O = 130 - C);
    !(!O && !j) &&
      select(M)
        .transition()
        .duration(700)
        .call(f.current.translateBy, O / $.k, j / $.k);
  }, [reveal == null ? undefined : reveal.key]);
  const { time: x, polar: k } = layout;
  return (
    <>
      <div
        className={"zoom-ctl"}
        style={{
          bottom: bottomInset + 20,
        }}
      >
        <button
          onClick={() => h(1.4)}
          aria-label={"zoom in"}
          title={"zoom in (+, or cmd + scroll)"}
        >
          {"+"}
        </button>
        <button onClick={() => h(1 / 1.4)} aria-label={"zoom out"} title={"zoom out (-)"}>
          {"−"}
        </button>
        <button onClick={N} title={"fit the tree (0)"}>
          {"fit"}
        </button>
      </div>
      <svg ref={d} className={"stage"} width={g.w} height={g.h}>
        <defs>
          <linearGradient
            id={"rootInk"}
            gradientUnits={"userSpaceOnUse"}
            x1={"0"}
            y1={x.top}
            x2={"0"}
            y2={x.bottom}
          >
            <stop offset={"0%"} stopColor={"var(--root-new)"} />
            <stop offset={"100%"} stopColor={"var(--root-old)"} />
          </linearGradient>
          <radialGradient
            id={"rootInkRadial"}
            gradientUnits={"userSpaceOnUse"}
            cx={"0"}
            cy={"0"}
            r={(k == null ? undefined : k.r1) ?? 1}
          >
            <stop offset={"0%"} stopColor={"var(--root-old)"} />
            <stop offset={"100%"} stopColor={"var(--root-new)"} />
          </radialGradient>
          <radialGradient id={"sunCore"}>
            <stop offset={"0%"} stopColor={"#8a5d3b"} />
            <stop offset={"45%"} stopColor={"#b48a62"} />
            <stop offset={"75%"} stopColor={"rgba(180,138,98,0.35)"} />
            <stop offset={"100%"} stopColor={"rgba(180,138,98,0)"} />
          </radialGradient>
          {[0, 1, 2, 3, 4].map((M) => (
            <filter id={`age-${M}`} key={M}>
              <feColorMatrix type={"matrix"} values={sepiaMatrix(M / 4)} />
            </filter>
          ))}
          <filter id={"grain"} x={"0"} y={"0"} width={"100%"} height={"100%"}>
            <feTurbulence
              type={"fractalNoise"}
              baseFrequency={"0.9"}
              numOctaves={"2"}
              stitchTiles={"stitch"}
            />
            <feColorMatrix type={"saturate"} values={"0"} />
            <feComponentTransfer>
              <feFuncA type={"linear"} slope={"0.07"} />
            </feComponentTransfer>
          </filter>
        </defs>
        <g transform={p.toString()} className={k ? "is-polar" : ""}>
          {k && (
            <g className={"rings"}>
              <circle r={k.r0 * 1.9} fill={"url(#sunCore)"} className={"core-sun"} />
              {k.rings.map((M, $) => (
                <circle
                  r={M.r}
                  className={`ring-line ${$ % 2 ? "odd" : ""}`}
                  key={M.year}
                />
              ))}
              {k.rings.map((M) => (
                <text
                  className={"ring-label"}
                  x={0}
                  y={-M.r + 4}
                  textAnchor={"middle"}
                  key={M.year}
                >
                  {M.year}
                  {"s"}
                </text>
              ))}
            </g>
          )}
          {!k &&
            x.ticks.map((M) => (
              <line
                x1={-2e4}
                x2={2e4}
                y1={M.y}
                y2={M.y}
                className={"gridline"}
                key={M.year}
              />
            ))}
          {children}
        </g>
        <g
          className={"axis"}
          style={{
            display: k ? "none" : undefined,
          }}
        >
          <rect
            x={0}
            y={0}
            width={g.w < 700 ? 58 : 104}
            height={g.h}
            className={"axis-bg"}
          />
          {(() => {
            let M = -1 / 0;
            return x.ticks.map(($) => {
              const T = p.applyY($.y);
              return T < topInset - 30 || T > g.h - 10 || T - M < 30
                ? null
                : ((M = T),
                  (
                    <text
                      x={g.w < 700 ? 20 : 28}
                      y={T + 7}
                      className={"axis-label"}
                      style={
                        g.w < 700
                          ? {
                              fontSize: 15,
                            }
                          : undefined
                      }
                      key={$.year}
                    >
                      {formatEra($.year)}
                    </text>
                  ));
            });
          })()}
        </g>
      </svg>
    </>
  );
}
export { GraphCanvas };
