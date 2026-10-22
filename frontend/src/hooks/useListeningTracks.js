import React from "react";
import { fetchListening, readListeningSource } from "../services/listening.js";

const LISTENING_CACHE_KEY = "nn-listening";
function useListeningTracks() {
  const [e, t] = React.useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem(LISTENING_CACHE_KEY) ?? "null");
    } catch {
      return null;
    }
  });
  return (
    React.useEffect(() => {
      const n = readListeningSource();
      e ||
        !n ||
        fetchListening(n.from)
          .then((r) => {
            const i = r.tracks.slice(0, 10);
            t(i);
            try {
              sessionStorage.setItem(LISTENING_CACHE_KEY, JSON.stringify(i));
            } catch {}
          })
          .catch(() => t([]));
    }, [e]),
    e
  );
}

// Only imported listening history belongs here. Selected library tracks are
// researched when opened, keeping the default page free of bulk lookups.
function usePrepareListeningTracks(tracks, onPrepare) {
  const prepared = React.useRef(new Set());
  React.useEffect(() => {
    const pending = (tracks ?? []).filter((track) => !prepared.current.has(track.id));
    pending.forEach((track) => prepared.current.add(track.id));
    if (pending.length) onPrepare(pending);
  }, [tracks, onPrepare]);
}

export { useListeningTracks, usePrepareListeningTracks };
