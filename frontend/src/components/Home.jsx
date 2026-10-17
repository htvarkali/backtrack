import React from "react";
import { FEATURED_SONG_IDS, useListeningTracks } from "../hooks/useListeningTracks.js";
import { SongStrips, createSongRows } from "./SongStrips.jsx";
import { readListeningSource } from "../services/listening.js";
import { ListeningSource } from "./ListeningSource.jsx";
import { Search } from "./Search.jsx";

function Home({
  g: graph,
  onPick: onPick,
  onPickExternal: onPickExternal,
  onAll: onAll,
  onPrepare: onPrepare,
  digging: digging,
}) {
  const l = useListeningTracks(),
    o = React.useRef(false);
  React.useEffect(() => {
    l != null && l.length && !o.current && ((o.current = true), onPrepare(l));
  }, [l, onPrepare]);
  const a = React.useMemo(() => {
    var g;
    const { rowFor: u, rowForTrack: d } = createSongRows(
        graph,
        onPick,
        onPickExternal,
        digging,
      ),
      f = (l ?? []).map((w) => d(w, "mine")),
      p = FEATURED_SONG_IDS.filter((w) => graph.byId.has(w))
        .map(u)
        .filter((w) => !f.some((N) => N.title === w.title && N.artist === w.artist)),
      m = [];
    return (
      f.length &&
        m.push({
          head:
            ((g = readListeningSource()) == null ? undefined : g.recent) === false
              ? `from ${readListeningSource().name}`
              : "what you've been playing",
          rows: f,
        }),
      m.push({
        head: "songs everyone knows",
        rows: p,
      }),
      m
    );
  }, [graph, l, digging, onPick, onPickExternal]);
  return (
    <main className={"landing"}>
      <header className={"landing-top"}>
        <span className={"wordmark"}>{"Back Track"}</span>
        <nav className={"landing-nav"}>
          {readListeningSource() && (
            <button className={"text-btn"} onClick={onAll}>
              {"your library"}
            </button>
          )}
          <ListeningSource />
        </nav>
      </header>
      <section className={"hero"}>
        <h1 className={"hero-line"}>{"dig up any song."}</h1>
        <p className={"hero-claim"}>{"nothing new under the sun."}</p>
        <p className={"hero-sub"}>
          {
            "search a song and follow it down: past its samples, to the blues, to bach, to the oldest music there is."
          }
        </p>
        <Search
          g={graph}
          onPick={onPick}
          onPickExternal={onPickExternal}
          big={true}
          autoFocus={true}
        />
      </section>
      <LibraryLink
        onOpen={onAll}
        covers={(l ?? []).map((u) => u.art).filter((u) => !!u)}
      />
      <SongStrips sections={a} onPick={onPick} />
    </main>
  );
}
function LibraryLink({ onOpen: onOpen, covers: covers }) {
  return readListeningSource() ? (
    <button className={"library-cta"} onClick={onOpen}>
      <span className={"library-covers"} aria-hidden={true}>
        {covers.slice(0, 6).map((n, r) => (
          <img
            src={n}
            alt={""}
            style={{
              zIndex: 6 - r,
            }}
            key={r}
          />
        ))}
      </span>
      <span className={"library-text"}>
        <span className={"library-title"}>{"your library"}</span>
        <span className={"library-sub"}>
          {"every one of your songs, with everything they sample"}
        </span>
      </span>
      <span className={"library-go"}>{"open"}</span>
    </button>
  ) : null;
}
export { Home };
