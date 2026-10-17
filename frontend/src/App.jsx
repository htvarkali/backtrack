import React from "react";
import {
  materializeSamples,
  navigate,
  parseRoute,
  readExtraLinks,
  readExtraSongs,
  saveExtraLinks,
  saveExtraSongs,
} from "./services/library.js";
import { usePanelWidth } from "./hooks/usePanelWidth.js";
import { hydrateGraph, loadGraph } from "./data/graph.js";
import { mergeContributions } from "./data/contributions.js";
import { submitContribution } from "./services/contributions.js";
import {
  canPlay,
  getPlayerState,
  playSong,
  setPreviewResolver,
  setPreviewUrls,
  stopPlayback,
  toggleSong,
  usePlayerSelector,
} from "./services/player.js";
import { lookupAncestry, sameRecording } from "./services/research.js";
import { lookupRecording } from "./services/catalog.js";
import {
  analyzeAncestry,
  expandedInfluences,
  initialExpandedNodes,
} from "./utils/ancestry.js";
import { Search } from "./components/Search.jsx";
import { readListeningSource } from "./services/listening.js";
import { Home } from "./components/Home.jsx";
import { AncestryGraph } from "./components/AncestryGraph.jsx";
import { Library } from "./components/Library.jsx";
import { Originality } from "./components/Originality.jsx";
import { SongPanel } from "./components/SongPanel.jsx";
import { PlayerBar } from "./components/PlayerBar.jsx";

function App() {
  const [baseGraph, setBaseGraph] = React.useState(null),
    [extraSongs, setExtraSongs] = React.useState(readExtraSongs),
    [extraLinks, setExtraLinks] = React.useState(readExtraLinks),
    [lookupStatus, setLookupStatus] = React.useState({}),
    [loadError, setLoadError] = React.useState(null),
    [hash, setHash] = React.useState(window.location.hash),
    [selectedSongId, setSelectedSongId] = React.useState(null),
    [panelOpen, setPanelOpen] = React.useState(true),
    [digState, setDigState] = React.useState(null),
    panelWidth = usePanelWidth(),
    lastSelection = React.useRef({
      id: "",
      at: 0,
    });
  React.useEffect(() => {
    loadGraph()
      .then(setBaseGraph)
      .catch((Y) => setLoadError(String(Y)));
    const F = () => setHash(window.location.hash);
    return (
      window.addEventListener("hashchange", F),
      () => window.removeEventListener("hashchange", F)
    );
  }, []);
  const graph = React.useMemo(() => {
      if (!baseGraph) return null;
      const F = new Set(baseGraph.songs.map((H) => H.id)),
        Y = [...baseGraph.songs, ...extraSongs.filter((H) => !F.has(H.id))],
        q = new Set(Y.map((H) => H.id)),
        K = new Set(baseGraph.samples.map((H) => `${H.from}>${H.to}`)),
        J = extraLinks.filter((edge) => {
          const key = `${edge.from}>${edge.to}`;
          if (!q.has(edge.from) || !q.has(edge.to) || K.has(key)) return false;
          K.add(key);
          return true;
        }),
        we =
          extraSongs.length || J.length
            ? hydrateGraph({
                ...baseGraph,
                songs: Y,
                samples: [...baseGraph.samples, ...J],
              })
            : baseGraph;
      return (
        setPreviewUrls(
          Object.fromEntries(
            [...we.byId.values()]
              .filter((H) => H.preview)
              .map((H) => [H.id, H.preview]),
          ),
        ),
        setPreviewResolver(
          async (H, { refresh = false } = {}) => {
            const me = we.byId.get(H);
            if (me)
              try {
                const He = await fetch(
                  `/api/preview?${new URLSearchParams({
                    title: me.heard?.title ?? me.title,
                    artist: me.heard?.artist ?? me.artist,
                    ...(refresh ? { refresh: "1" } : {}),
                  })}`,
                  { signal: AbortSignal.timeout(15_000) },
                );
                return He.ok ? (await He.json()).preview : undefined;
              } catch {
                return;
              }
          },
          (H) => {
            const me = we.byId.get(H);
            return !!me && !me.kind && !me.listenOf;
          },
        ),
        we
      );
    }, [baseGraph, extraSongs, extraLinks]),
    route = React.useMemo(() => parseRoute(hash, graph), [hash, graph]),
    graphRef = React.useRef(graph);
  graphRef.current = graph;
  const lookupRef = React.useRef(lookupStatus);
  lookupRef.current = {
    ...lookupStatus,
    ...lookupRef.current,
    ...lookupStatus,
  };
  const extraSongsRef = React.useRef(extraSongs);
  extraSongsRef.current = extraSongs;
  const queueSongId = usePlayerSelector((F) =>
    F.queue.length > 1 ? F.id : null,
  );
  React.useEffect(() => {
    setSelectedSongId(null);
    setPanelOpen(true);
    window.scrollTo(0, 0);
  }, [
    route.name,
    route.name === "song" || route.name === "dna" ? route.id : "",
  ]);
  React.useEffect(() => {
    const F = (Y) => {
      Y.key === "Escape" &&
        (selectedSongId ? setSelectedSongId(null) : stopPlayback());
    };
    return (
      window.addEventListener("keydown", F),
      () => window.removeEventListener("keydown", F)
    );
  }, [selectedSongId]);
  const openSong = React.useCallback((F) => navigate(`/song/${F}`), []),
    openOriginality = React.useCallback((F) => navigate(`/dna/${F}`), []),
    toggleTimer = React.useRef(undefined),
    selectSong = React.useCallback((F) => {
      const Y = performance.now();
      if (
        lastSelection.current.id === F &&
        Y - lastSelection.current.at < 350
      ) {
        clearTimeout(toggleTimer.current);
        return;
      }
      if (
        ((lastSelection.current = {
          id: F,
          at: Y,
        }),
        setSelectedSongId(F),
        setPanelOpen(true),
        !canPlay(F))
      )
        return;
      const q = getPlayerState();
      q.id === F && q.playing
        ? (toggleTimer.current = window.setTimeout(() => toggleSong(F), 300))
        : toggleSong(F);
    }, []),
    ensureExternalSong = React.useCallback(
      (F) => {
        if (!baseGraph) return null;
        const Y = baseGraph.songs.find((H) => sameRecording(H, F));
        if (Y) return Y;
        const q = `sp-${F.id}`,
          K = extraSongsRef.current.find((H) => H.id === q);
        if (K) return K;
        const J = {
            id: q,
            title: F.title,
            artist: F.artist,
            year: F.year,
            genres: [],
            art: F.art,
            link: F.url,
            external: true,
            preview: F.preview,
          },
          we = (H) =>
            setExtraSongs((me) => {
              const He = [
                ...me.filter((Ie) => Ie.id !== q),
                {
                  ...(me.find((Ie) => Ie.id === q) ?? J),
                  ...H,
                },
              ];
              return (saveExtraSongs(He), He);
            });
        return (
          we(J),
          (!F.preview || F.guessed) &&
            lookupRecording(F).then((H) => {
              (H.preview || H.art || H.year) &&
                we({
                  preview: J.preview ?? H.preview,
                  art: J.art ?? H.art,
                  ...(F.guessed && H.year
                    ? {
                        year: H.year,
                      }
                    : {}),
                });
            }),
          J
        );
      },
      [baseGraph],
    ),
    openExternalSong = React.useCallback(
      (F) => {
        const Y = ensureExternalSong(F);
        Y && openSong(Y.id);
      },
      [ensureExternalSong, openSong],
    ),
    contributeSample = React.useCallback(async (parentId, sample) => {
      const saved = await submitContribution({
        getGraph: () => graphRef.current,
        parentId,
        sample,
      });
      setBaseGraph((current) =>
        hydrateGraph(mergeContributions(current, [saved.entry])),
      );
      return { scope: saved.scope };
    }, []),
    discoverAncestry = React.useCallback(async (F, Y, q = false) => {
      const K = graphRef.current;
      if (!K || lookupRef.current[F]) return;
      const J = Y ?? K.byId.get(F);
      if (!J || J.kind || J.listenOf || (K.samplesOf.get(F) ?? []).length)
        return;
      lookupRef.current = {
        ...lookupRef.current,
        [F]: "looking",
      };
      setLookupStatus((Ie) => ({
        ...Ie,
        [F]: "looking",
      }));
      const we = await lookupAncestry(J.title, J.artist, K.genres, q),
        { newSongs: H, newLinks: me } = await materializeSamples(
          K,
          J,
          we.found,
          q,
        ),
        He = J.external && !J.genres.length;
      (H.length || He) &&
        setExtraSongs((Ie) => {
          const It = new Set(H.map((ln) => ln.id)),
            iu = [
              ...Ie.filter((ln) => !It.has(ln.id)).map((ln) =>
                He && ln.id === F
                  ? {
                      ...ln,
                      genres: we.genres,
                    }
                  : ln,
              ),
              ...H,
            ];
          return (saveExtraSongs(iu), iu);
        });
      me.length &&
        setExtraLinks((Ie) => {
          const It = [...Ie, ...me];
          return (saveExtraLinks(It), It);
        });
      setLookupStatus((Ie) => ({
        ...Ie,
        [F]: {
          found: me.length,
          checked: we.checked,
        },
      }));
    }, []),
    prepareTracks = React.useCallback(
      async (F) => {
        for (const Y of F) {
          const q = ensureExternalSong(Y);
          q && (await discoverAncestry(q.id, q, true));
        }
      },
      [ensureExternalSong, discoverAncestry],
    );
  React.useEffect(() => {
    route.name === "song" && discoverAncestry(route.id);
  }, [route, discoverAncestry]);
  React.useEffect(() => {
    selectedSongId && discoverAncestry(selectedSongId);
  }, [selectedSongId, discoverAncestry]);
  const expanded = React.useMemo(
      () =>
        !graph || route.name !== "song"
          ? new Set()
          : (digState == null ? undefined : digState.id) === route.id
            ? digState.expanded
            : initialExpandedNodes(graph, route.id),
      [graph, route, digState],
    ),
    expandNode = React.useCallback(
      (F) =>
        route.name === "song" &&
        setDigState({
          id: route.id,
          expanded: new Set([...expanded, F]),
        }),
      [route, expanded],
    ),
    collapseAncestry = React.useCallback(
      () =>
        route.name === "song" &&
        setDigState({
          id: route.id,
          expanded: new Set(),
        }),
      [route],
    ),
    navigableSongs = React.useMemo(() => {
      if (!graph || route.name !== "song") return [];
      const Y = [...analyzeAncestry(graph, route.id).gen.entries()]
          .sort(
            (K, J) =>
              K[1] - J[1] ||
              graph.byId.get(J[0]).year - graph.byId.get(K[0]).year,
          )
          .map(([K]) => K),
        q = [...expandedInfluences(graph, route.id, expanded).nodes].sort(
          (K, J) => graph.byId.get(J).year - graph.byId.get(K).year,
        );
      return [...Y, ...q.filter((K) => !Y.includes(K))];
    }, [graph, route, expanded]),
    swipeSong = React.useCallback(
      (F) => {
        const Y = selectedSongId ?? (route.name === "song" ? route.id : null),
          q = Y ? navigableSongs.indexOf(Y) : -1,
          K =
            navigableSongs[
              Math.max(0, Math.min(navigableSongs.length - 1, q + F))
            ];
        !K ||
          K === Y ||
          (setSelectedSongId(K), setPanelOpen(true), canPlay(K) && playSong(K));
      },
      [navigableSongs, selectedSongId, route],
    ),
    digging = React.useMemo(
      () =>
        Object.keys(lookupStatus).filter((F) => lookupStatus[F] === "looking"),
      [lookupStatus],
    );
  if (loadError)
    return (
      <div className={"fatal"}>
        {"Couldn't load the data: "}
        {loadError}
        {". Check that the data file is available."}
      </div>
    );
  if (!graph) return <div className={"loading"}>{"Digging…"}</div>;
  const panelSongId =
      route.name === "song"
        ? queueSongId && graph.byId.has(queueSongId)
          ? queueSongId
          : (selectedSongId ?? route.id)
        : null,
    showPanel = !!panelSongId && (panelOpen || !!queueSongId),
    rightInset = showPanel ? panelWidth : 0,
    viewingAnotherSong = route.name === "song" && panelSongId !== route.id;
  return (
    <div className={`app view-${route.name}`}>
      {route.name !== "home" && route.name !== "all" && (
        <header className={"topbar"}>
          <button
            className={"mark"}
            onClick={() => navigate("/")}
            aria-label={"back track, home"}
          >
            {"back track"}
          </button>
          <Search
            g={graph}
            onPick={openSong}
            onPickExternal={openExternalSong}
          />
          <nav className={"top-actions"}>
            {route.name === "song" && (
              <>
                {!graph.byId.get(route.id).external &&
                  !graph.byId.get(route.id).kind && (
                    <button
                      className={"act"}
                      onClick={() => openOriginality(route.id)}
                    >
                      {"Originality"}
                    </button>
                  )}
                {readListeningSource() && (
                  <button className={"act"} onClick={() => navigate("/all")}>
                    {"Your library"}
                  </button>
                )}
              </>
            )}
            {route.name === "dna" && (
              <>
                <button className={"act"} onClick={() => openSong(route.id)}>
                  {"Back track"}
                </button>
                <button className={"act"} onClick={() => navigate("/all")}>
                  {"Your library"}
                </button>
              </>
            )}
          </nav>
        </header>
      )}
      {route.name === "home" && (
        <Home
          g={graph}
          onPick={openSong}
          onPickExternal={openExternalSong}
          onAll={() => navigate("/all")}
          onPrepare={prepareTracks}
          digging={digging}
        />
      )}
      {route.name === "song" && (
        <>
          <AncestryGraph
            g={graph}
            rootId={route.id}
            rightInset={rightInset}
            bottomInset={
              panelWidth === 0 && showPanel ? window.innerHeight * 0.34 : 0
            }
            selected={selectedSongId}
            expanded={expanded}
            onExpand={expandNode}
            onPick={selectSong}
            onOpen={openSong}
            digging={digging}
          />
          <p className={"stage-hint"}>
            {
              "click a record to hear it. double-click the deepest one to dig under it."
            }
          </p>
          {(digState == null ? undefined : digState.id) === route.id &&
            digState.expanded.size > 0 && (
              <div className={"dig"}>
                <button className={"text-btn"} onClick={collapseAncestry}>
                  {"reset back track"}
                </button>
              </div>
            )}
        </>
      )}
      {route.name === "all" && (
        <Library
          g={graph}
          onPick={openSong}
          onPickExternal={openExternalSong}
          onPrepare={prepareTracks}
          digging={digging}
          onHome={() => navigate("/")}
        />
      )}
      {route.name === "dna" && (
        <Originality
          g={graph}
          id={route.id}
          onOpen={openSong}
          onReport={openOriginality}
        />
      )}
      {showPanel && panelSongId && (
        <SongPanel
          g={graph}
          song={graph.byId.get(panelSongId)}
          onPick={route.name === "dna" ? openSong : selectSong}
          onDna={openOriginality}
          onClose={
            queueSongId
              ? undefined
              : viewingAnotherSong
                ? () => setSelectedSongId(null)
                : () => setPanelOpen(false)
          }
          pickLabel={
            viewingAnotherSong && !queueSongId
              ? "Back track this song"
              : undefined
          }
          onGrow={openSong}
          lookup={lookupStatus[panelSongId]}
          onHeard={contributeSample}
          onSwipe={
            route.name === "song" && navigableSongs.length > 1
              ? swipeSong
              : undefined
          }
        />
      )}
      <PlayerBar
        g={graph}
        rightInset={
          route.name === "dna" || route.name === "home" || route.name === "all"
            ? 0
            : rightInset
        }
        bottom={
          panelWidth === 0 && showPanel
            ? Math.round(window.innerHeight * 0.34) + 16
            : undefined
        }
      />
    </div>
  );
}
export { App };
