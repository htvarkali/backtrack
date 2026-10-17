import React from "react";
import { searchGraph, songSubtitle } from "../data/graph.js";
import { searchCatalog } from "../services/catalog.js";
import { sameRecording } from "../services/research.js";

function Search({
  g: graph,
  onPick: onPick,
  onPickExternal: onPickExternal,
  big: big,
  autoFocus: autoFocus,
}) {
  const [s, l] = React.useState(""),
    [o, a] = React.useState(0),
    [u, d] = React.useState(false),
    [f, p] = React.useState([]),
    [m, g] = React.useState("idle"),
    w = React.useRef(null),
    N = React.useMemo(() => searchGraph(graph, s), [graph, s]);
  React.useEffect(() => {
    const v = s.trim();
    if (v.length < 2) {
      p([]);
      return;
    }
    g("loading");
    const x = setTimeout(() => {
      searchCatalog(v)
        .then((k) => {
          p(
            k.filter((M) => !graph.songs.some(($) => !$.external && sameRecording($, M))),
          );
          g("idle");
        })
        .catch(() => {
          p([]);
          g("error");
        });
    }, 280);
    return () => clearTimeout(x);
  }, [s, graph]);
  const h = [
      ...N.map((v) => ({
        kind: "crate",
        id: v.id,
      })),
      ...f.map((v) => ({
        kind: "other",
        t: v,
      })),
    ],
    y = (v) => {
      var x;
      l("");
      d(false);
      (x = w.current) == null || x.blur();
      v.kind === "crate" ? onPick(v.id) : onPickExternal(v.t);
    };
  return (
    <div className={`search ${big ? "search-big" : ""}`}>
      <input
        ref={w}
        value={s}
        autoFocus={autoFocus}
        placeholder={"search any song or artist"}
        aria-label={"Search a song or artist"}
        onChange={(v) => {
          l(v.target.value);
          a(0);
          d(true);
        }}
        onFocus={() => d(true)}
        onBlur={() => setTimeout(() => d(false), 150)}
        onKeyDown={(v) => {
          var x;
          v.key === "ArrowDown" && a((k) => Math.min(k + 1, h.length - 1));
          v.key === "ArrowUp" && a((k) => Math.max(k - 1, 0));
          v.key === "Enter" && h[o] && y(h[o]);
          v.key === "Escape" && ((x = w.current) == null || x.blur());
        }}
      />
      {u && s.trim() && (
        <ul className={"search-results"} role={"listbox"}>
          {N.length > 0 && <li className={"sr-section"}>{"in the crate"}</li>}
          {N.map((v, x) => (
            <li role={"option"} aria-selected={x === o} key={v.id}>
              <button
                className={x === o ? "active" : ""}
                onMouseDown={() =>
                  y({
                    kind: "crate",
                    id: v.id,
                  })
                }
                onMouseEnter={() => a(x)}
              >
                {v.art ? <img src={v.art} alt={""} /> : <span className={"sr-blank"} />}
                <span>
                  <span className={"sr-title"}>{v.title}</span>
                  <span className={"sr-meta"}>
                    {songSubtitle(v)}
                    {v.external ? ", outside the crate" : ""}
                  </span>
                </span>
              </button>
            </li>
          ))}
          {!N.length && <li className={"sr-empty"}>{"Not in the crate yet."}</li>}
          <li className={"sr-section"}>
            <span>{"more songs, dug up when you open one"}</span>
          </li>
          {f.map((v, x) => {
            const k = N.length + x;
            return (
              <li role={"option"} aria-selected={k === o} key={v.id}>
                <button
                  className={k === o ? "active" : ""}
                  onMouseDown={() =>
                    y({
                      kind: "other",
                      t: v,
                    })
                  }
                  onMouseEnter={() => a(k)}
                >
                  {v.art ? <img src={v.art} alt={""} /> : <span className={"sr-blank"} />}
                  <span>
                    <span className={"sr-title"}>{v.title}</span>
                    <span className={"sr-meta"}>
                      {v.artist}
                      {", "}
                      {v.year}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
          {m === "loading" && !f.length && <li className={"sr-note"}>{"searching…"}</li>}
          {m === "error" && <li className={"sr-note"}>{"couldn't search right now."}</li>}
          {m === "idle" && !f.length && s.trim().length >= 2 && (
            <li className={"sr-note"}>{"nothing else matches."}</li>
          )}
        </ul>
      )}
    </div>
  );
}
export { Search };
