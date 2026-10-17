import React from "react";
import { skipQueue, stopPlayback, toggleSong, usePlayer } from "../services/player.js";
import { songSubtitle } from "../data/graph.js";

function PlayerBar({ g: graph, rightInset: rightInset, bottom: bottom }) {
  const r = usePlayer();
  if (!r.id) return null;
  const i = graph.byId.get(r.id);
  if (!i) return null;
  const s = r.queue.length > 1;
  return (
    <div
      className={"now-playing"}
      style={{
        right: rightInset + 24,
        ...(bottom !== undefined
          ? {
              bottom: bottom,
            }
          : {}),
      }}
    >
      <div className={`np-disc ${r.playing ? "spinning" : ""}`}>
        {i.art && <img src={i.art} alt={""} />}
      </div>
      <div className={"np-text"}>
        <span className={"np-title"}>{i.title}</span>
        <span className={"np-meta"}>
          {songSubtitle(i)}
          {s && (
            <span className={"np-step"}>
              {" "}
              {r.queueIndex + 1}
              {" of "}
              {r.queue.length}
              {", going back in time"}
            </span>
          )}
        </span>
        {r.error && <span className={"np-error"}>{r.error}</span>}
        <span className={"np-bar"}>
          <span
            style={{
              width: `${r.progress * 100}%`,
            }}
          />
        </span>
      </div>
      <div className={"np-controls"}>
        {s && (
          <button
            onClick={() => skipQueue(-1)}
            disabled={r.queueIndex === 0}
            aria-label={"Previous record"}
          >
            {"⏮"}
          </button>
        )}
        <button
          onClick={() => toggleSong(r.id)}
          aria-label={r.playing ? "Pause" : "Play"}
        >
          {r.playing ? "❚❚" : "▶"}
        </button>
        {s && (
          <button
            onClick={() => skipQueue(1)}
            disabled={r.queueIndex >= r.queue.length - 1}
            aria-label={"Next record"}
          >
            {"⏭"}
          </button>
        )}
        <button onClick={stopPlayback} aria-label={"Stop"}>
          {"■"}
        </button>
      </div>
    </div>
  );
}
export { PlayerBar };
