import React from "react";
import { fetchListening, readListeningSource } from "../services/listening.js";
import { usePrepareListeningTracks } from "../hooks/useListeningTracks.js";
import selectedTracks from "../data/libraryTracks.json";
import { composeLibraryTracks, resolveImportedTracks } from "../utils/libraryTracks.js";
import { SongStrips, createSongRows } from "./SongStrips.jsx";
import { ListeningSource } from "./ListeningSource.jsx";

function Library({ g: graph, onPick, onPickExternal, onPrepare, digging, onHome }) {
  const source = React.useMemo(readListeningSource, []);
  const [importedTracks, setImportedTracks] = React.useState(null);
  const [error, setError] = React.useState(null);
  const preparedTracks = React.useMemo(
    () => resolveImportedTracks(importedTracks ?? [], selectedTracks),
    [importedTracks],
  );
  usePrepareListeningTracks(preparedTracks, onPrepare);

  React.useEffect(() => {
    if (!source?.from) return;
    let cancelled = false;
    fetchListening(source.from)
      .then(({ tracks }) => {
        if (!cancelled) setImportedTracks(tracks);
      })
      .catch((failure) => {
        if (!cancelled) setError(String(failure.message ?? failure));
      });
    return () => { cancelled = true; };
  }, [source?.from]);

  const tracks = React.useMemo(
    () => composeLibraryTracks(preparedTracks, selectedTracks),
    [preparedTracks],
  );
  const sections = React.useMemo(() => {
    const { rowForTrack } = createSongRows(graph, onPick, onPickExternal, digging);
    return [{
      head: `your library (${tracks.length})`,
      rows: tracks.map((track) => rowForTrack(track, "library")),
    }];
  }, [graph, tracks, digging, onPick, onPickExternal]);

  return (
    <main className="landing library">
      <header className="landing-top">
        <button className="wordmark mark-btn" onClick={onHome}>back track</button>
        <nav className="landing-nav"><ListeningSource /></nav>
      </header>
      <section className="hero">
        <h1 className="hero-line small">your songs, dug up.</h1>
        <p className="hero-sub">
          {source
            ? "your imported songs and selected tracks, together on one timeline. open a song to explore what it samples."
            : "drake, partynextdoor, and bryson tiller, on one timeline. open a song to explore its samples, or add your own playlist."}
        </p>
        {error && <p className="muted">{error}</p>}
        {source && !importedTracks && !error && (
          <p className="muted">getting your songs…</p>
        )}
      </section>
      <SongStrips sections={sections} onPick={onPick} />
    </main>
  );
}

export { Library };
