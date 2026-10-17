import React from "react";
import { fetchListening, readListeningSource } from "../services/listening.js";

const FEATURED_SONG_IDS = [
    "gold-digger",
    "stronger",
    "not-like-us",
    "paint-the-town-red",
    "nice-for-what",
    "super-freaky-girl",
    "love-again",
    "break-my-soul",
    "dont-stop-the-music",
    "good-feeling",
    "99-problems",
    "luther",
  ],
  LISTENING_CACHE_KEY = "nn-listening";
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
export { FEATURED_SONG_IDS, useListeningTracks };
