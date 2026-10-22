import React from "react";
import { useListeningTracks, usePrepareListeningTracks } from "../hooks/useListeningTracks.js";
import selectedTracks from "../data/libraryTracks.json";
import { composeLibraryTracks, resolveImportedTracks } from "../utils/libraryTracks.js";
import { SongStrips, createSongRows } from "./SongStrips.jsx";
import { ListeningSource } from "./ListeningSource.jsx";
import { Search } from "./Search.jsx";

function Home({ g: graph, onPick, onPickExternal, onAll, onPrepare, digging }) {
  const listeningTracks = useListeningTracks();
  const importedTracks = React.useMemo(
    () => resolveImportedTracks(listeningTracks ?? [], selectedTracks),
    [listeningTracks],
  );
  usePrepareListeningTracks(importedTracks, onPrepare);
  const tracks = React.useMemo(
    () => composeLibraryTracks(importedTracks ?? [], selectedTracks),
    [importedTracks],
  );
  const sections = React.useMemo(() => {
    const { rowForTrack } = createSongRows(graph, onPick, onPickExternal, digging);
    return [{
      id: "library",
      rows: tracks.map((track) => rowForTrack(track, "home")),
    }];
  }, [graph, tracks, digging, onPick, onPickExternal]);

  return (
    <main className="landing">
      <header className="landing-top">
        <span className="wordmark">back track</span>
        <nav className="landing-nav">
          <button className="text-btn" onClick={onAll}>your library</button>
          <ListeningSource />
        </nav>
      </header>
      <section className="hero">
        <h1 className="hero-line">dig up any song.</h1>
        <p className="hero-claim">nothing new under the sun.</p>
        <p className="hero-sub">
          search a song and follow it down: past its samples, to the blues, to bach, to the oldest music there is.
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
        covers={tracks.map((track) => track.art).filter(Boolean)}
      />
      <SongStrips sections={sections} onPick={onPick} />
    </main>
  );
}

function LibraryLink({ onOpen, covers }) {
  return (
    <button className="library-cta" onClick={onOpen}>
      <span className="library-covers" aria-hidden={true}>
        {covers.slice(0, 6).map((cover, index) => (
          <img src={cover} alt="" style={{ zIndex: 6 - index }} key={index} />
        ))}
      </span>
      <span className="library-text">
        <span className="library-title">your library</span>
        <span className="library-sub">your songs, with everything they sample</span>
      </span>
      <span className="library-go">open</span>
    </button>
  );
}

export { Home };
