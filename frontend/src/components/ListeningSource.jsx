import React from "react";
import {
  fetchListening,
  readListeningSource,
  saveListeningSource,
} from "../services/listening.js";

function ListeningSource() {
  const e = readListeningSource(),
    [t, n] = React.useState(false),
    [r, i] = React.useState(""),
    [s, l] = React.useState(false),
    [o, a] = React.useState(null),
    u = async (d) => {
      if ((d.preventDefault(), !!r.trim())) {
        l(true);
        a(null);
        try {
          const f = await fetchListening(r.trim());
          saveListeningSource({
            from: r.trim(),
            name: f.name,
            recent: f.recent,
          });
          location.reload();
        } catch (f) {
          a(f.message);
          l(false);
        }
      }
    };
  return (
    <div className={"source"}>
      <button
        className={`source-btn ${e ? "is-on" : ""}`}
        onClick={() => n((d) => !d)}
        aria-expanded={t}
      >
        {e ? e.name : "dig up my songs"}
      </button>
      {t && (
        <form className={"source-pop"} onSubmit={u}>
          <input
            autoFocus={true}
            value={r}
            onChange={(d) => i(d.target.value)}
            placeholder={"spotify playlist link"}
            aria-label={"Spotify playlist link, or a listenbrainz username"}
          />
          <button type={"submit"} disabled={s || !r.trim()}>
            {s ? "digging…" : "dig"}
          </button>
          {o && <p className={"source-err"}>{o}</p>}
          <p className={"source-hint"}>
            {"what you've played lately: share your "}
            <b>{"on repeat"}</b>
            {
              ' playlist from spotify (search "on repeat", then share, copy link). public playlists and albums work when Spotify shares their tracks. you can also enter a listenbrainz username.'
            }
          </p>
          {e && (
            <button
              type={"button"}
              className={"text-btn source-off"}
              onClick={() => {
                saveListeningSource(null);
                location.reload();
              }}
            >
              {"forget "}
              {e.name}
            </button>
          )}
        </form>
      )}
    </div>
  );
}
export { ListeningSource };
