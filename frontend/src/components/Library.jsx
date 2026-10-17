import React from "react";
import { fetchListening, readListeningSource } from "../services/listening.js";
import { SongStrips, createSongRows } from "./SongStrips.jsx";
import { leafSongs } from "../utils/ancestry.js";
import { ListeningSource } from "./ListeningSource.jsx";

function Library({
  g: graph,
  onPick: onPick,
  onPickExternal: onPickExternal,
  onPrepare: onPrepare,
  digging: digging,
  onHome: onHome,
}) {
  const l = React.useMemo(readListeningSource, []),
    [o, a] = React.useState(null),
    [u, d] = React.useState(null),
    f = React.useRef(new Set()),
    p = React.useCallback(
      (w) => {
        const N = w.filter((h) => !f.current.has(h.id));
        N.forEach((h) => f.current.add(h.id));
        N.length && onPrepare(N);
      },
      [onPrepare],
    ),
    m = l == null ? undefined : l.from;
  React.useEffect(() => {
    m &&
      fetchListening(m)
        .then((w) => {
          a(w.tracks);
          p(w.tracks);
        })
        .catch((w) => d(String(w.message ?? w)));
  }, [m, p]);
  const g = React.useMemo(() => {
    const { rowFor: w, rowForTrack: N } = createSongRows(
      graph,
      onPick,
      onPickExternal,
      digging,
    );
    if (!l) {
      const y = leafSongs(graph)
        .filter(
          (v) =>
            !v.kind &&
            !v.external &&
            !v.listenOf &&
            (graph.samplesOf.get(v.id) ?? []).length,
        )
        .sort((v, x) => x.year - v.year);
      return [
        {
          head: `every song in the crate (${y.length})`,
          rows: y.map((v) => w(v.id)),
        },
      ];
    }
    return [
      {
        head: l.recent
          ? `your last ${(o == null ? undefined : o.length) ?? ""} plays`
          : `${l.name}${o ? ` (${o.length})` : ""}`,
        rows: (o ?? []).map((y) => N(y, "lib")),
      },
    ];
  }, [graph, l, o, digging, onPick, onPickExternal]);
  return (
    <main className={"landing library"}>
      <header className={"landing-top"}>
        <button className={"wordmark mark-btn"} onClick={onHome}>
          {"Back Track"}
        </button>
        <nav className={"landing-nav"}>
          <ListeningSource />
        </nav>
      </header>
      <section className={"hero"}>
        <h1 className={"hero-line small"}>
          {l ? "your songs, dug up." : "every root at once."}
        </h1>
        <p className={"hero-sub"}>
          {l
            ? "every one on one timeline. each fills in with what it samples as it gets dug up."
            : "paste a playlist link or a username to dig up your own songs. until then, here is every song in the crate."}
        </p>
        {u && <p className={"muted"}>{u}</p>}
      </section>
      {l && !o && !u ? (
        <p className={"muted"}>{"getting your songs…"}</p>
      ) : (
        <SongStrips sections={g} onPick={onPick} />
      )}
    </main>
  );
}
export { Library };
