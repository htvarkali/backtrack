import React from "react";
import {
  canPlay,
  compareSongs,
  getPlayerState,
  toggleSong,
  usePlayer,
} from "../services/player.js";
import { songFamily, songSubtitle } from "../data/graph.js";
import { SAMPLE_DESCRIPTIONS, SAMPLE_LABELS } from "./GraphElements.jsx";
import { searchCatalog } from "../services/catalog.js";

const formatRecordingYear = (e) => {
  try {
    const t = new URL(e).hostname.replace(/^www\.|^en\./, "");
    return t === "wikipedia.org"
      ? "wikipedia"
      : t === "wikidata.org"
        ? "wikidata"
        : t === "publicrecords.copyright.gov"
          ? "copyright registration"
          : t;
  } catch {
    return "source";
  }
};
function SongPanel({
  g: graph,
  song: song,
  onPick: onPick,
  onDna: onDna,
  onClose: onClose,
  pickLabel: pickLabel,
  onGrow: onGrow,
  lookup: lookup,
  onHeard: onHeard,
  onSwipe: onSwipe,
}) {
  var y, v;
  const d = React.useRef(null),
    f = usePlayer(),
    p = f.id === song.id && f.playing,
    m = !!song.kind,
    g = m
      ? (graph.influencesOf.get(song.id) ?? [])
      : (graph.samplesOf.get(song.id) ?? []),
    w = m
      ? (graph.grewInto.get(song.id) ?? [])
      : (graph.sampledBy.get(song.id) ?? []),
    N = graph.genreById.get(song.genres[0]),
    h = m
      ? song.kind === "genre"
        ? `a genre, ${song.startLabel}`
        : `${song.startLabel}${song.region ? `, ${song.region}` : ""}`
      : `${song.year}${N ? `, ${N.label}` : ""}`;
  return (
    <aside
      className={"panel"}
      onTouchStart={(x) =>
        (d.current = {
          x: x.touches[0].clientX,
          y: x.touches[0].clientY,
        })
      }
      onTouchEnd={(x) => {
        const k = d.current;
        if (((d.current = null), !k || !onSwipe)) return;
        const M = x.changedTouches[0].clientX - k.x,
          $ = x.changedTouches[0].clientY - k.y;
        Math.abs(M) > 60 &&
          Math.abs(M) > Math.abs($) * 1.5 &&
          onSwipe(M < 0 ? 1 : -1);
      }}
      key={song.id}
    >
      <div className={"panel-inner"}>
        <div className={"panel-head"}>
          <div className={`panel-art ${m ? "square" : ""}`}>
            {song.art ? (
              <img src={song.art} alt={""} />
            ) : (
              <span>{song.title.charAt(0)}</span>
            )}
          </div>
          <div className={"panel-id"}>
            <h2 className={"panel-title"}>{song.title}</h2>
            {!m && <p className={"panel-artist"}>{song.artist}</p>}
            <p className={"panel-sub"}>{h}</p>
          </div>
          {onClose && (
            <button
              className={"icon-btn"}
              onClick={onClose}
              aria-label={"close"}
            >
              {"✕"}
            </button>
          )}
        </div>
        {song.about && <p className={"panel-about"}>{song.about}</p>}
        <div className={"panel-actions"}>
          {canPlay(song.id) ? (
            <button className={"play-btn"} onClick={() => toggleSong(song.id)}>
              {p ? "pause" : "play"}
              {f.id === song.id && (
                <span
                  className={"play-progress"}
                  style={{
                    width: `${f.progress * 100}%`,
                  }}
                />
              )}
            </button>
          ) : (
            <span className={"muted"}>{"no recording to play"}</span>
          )}
          {m &&
            (((y = song.listen) == null ? undefined : y.length) ?? 0) > 1 && (
              <button
                className={"text-btn"}
                onClick={() => sourceLabel(song)}
                title={"play another record from this genre"}
              >
                {"shuffle"}
              </button>
            )}
          {pickLabel && (
            <button
              className={"text-btn"}
              onClick={() => (onGrow ?? onPick)(song.id)}
            >
              {pickLabel}
            </button>
          )}
          {!m && !song.external && (
            <button className={"text-btn"} onClick={() => onDna(song.id)}>
              {"originality"}
            </button>
          )}
          {song.external && song.link && (
            <a
              className={"text-btn"}
              href={song.link}
              target={"_blank"}
              rel={"noreferrer"}
            >
              {song.link.includes("spotify")
                ? "open in spotify"
                : song.link.includes("apple.com")
                  ? "open in apple music"
                  : song.link.includes("last.fm")
                    ? "open on last.fm"
                    : "open on musicbrainz"}
            </a>
          )}
        </div>
        {onSwipe && (
          <p className={"swipe-hint"}>{"swipe to go back in time"}</p>
        )}
        {m && (((v = song.listen) == null ? undefined : v.length) ?? 0) > 0 && (
          <GenreListening g={graph} song={song} />
        )}
        {g.length > 0 && (
          <section className={"panel-section"}>
            <h3>{m ? "grew out of" : "built from"}</h3>
            {g.map((x) => (
              <SampleRow
                g={graph}
                e={x}
                other={graph.byId.get(x.to)}
                newer={song.id}
                older={x.to}
                onPick={onPick}
                key={x.to}
              />
            ))}
          </section>
        )}
        {w.length > 0 && (
          <section className={"panel-section"}>
            <h3>{m ? "grew into" : "sampled by"}</h3>
            {w
              .slice()
              .sort(
                (x, k) =>
                  graph.byId.get(k.from).year - graph.byId.get(x.from).year,
              )
              .map((x) => (
                <SampleRow
                  g={graph}
                  e={x}
                  other={graph.byId.get(x.from)}
                  newer={x.from}
                  older={song.id}
                  onPick={onPick}
                  key={x.from}
                />
              ))}
          </section>
        )}
        {!m && (g.length === 0 || lookup?.warning) && (
          <p className={"panel-note"}>
            {lookup === "looking"
              ? "digging for its samples…"
              : lookup?.warning
                ? lookup.warning
                : w.length
                  ? "bedrock: nothing it sampled is documented. dig to see what it grew out of."
                  : "no samples documented. dig to see what its genre grew out of."}
          </p>
        )}
        {!m && !song.listenOf && onHeard && (
          <AddSample onAdd={(x) => onHeard(song.id, x)} key={song.id} />
        )}
        {!m && song.onFile && <RecordingNote song={song} />}
        {m && song.source && (
          <p className={"panel-source"}>
            <a href={song.source} target={"_blank"} rel={"noreferrer"}>
              {formatRecordingYear(song.source)}
            </a>
          </p>
        )}
      </div>
    </aside>
  );
}
function SampleRow({
  g: graph,
  e: e,
  other: other,
  newer: newer,
  older: older,
  onPick: onPick,
}) {
  const l = e.type !== "influence" && canPlay(newer) && canPlay(older),
    o = l;
  return (
    <div className={"row"}>
      <button className={"row-main"} onClick={() => onPick(other.id)}>
        <span
          className={`row-art ${other.kind ? "square" : ""}`}
          style={{
            "--fam": songFamily(graph, other).color,
          }}
        >
          {other.art && <img src={other.art} alt={""} />}
        </span>
        <span className={"row-text"}>
          <span className={"row-title"}>{other.title}</span>
          <span className={"row-meta"}>{songSubtitle(other)}</span>
          {e.type !== "influence" && (
            <span className={"row-what"} title={SAMPLE_DESCRIPTIONS[e.type]}>
              <b>{SAMPLE_LABELS[e.type]}</b> {e.element}
            </span>
          )}
        </span>
      </button>
      {o && (
        <span className={"row-links"}>
          {l && (
            <button
              onClick={() => compareSongs(newer, older)}
              title={"play the newer song, then the record it sampled"}
            >
              {"hear both"}
            </button>
          )}
        </span>
      )}
    </div>
  );
}
function RecordingNote({ song: song }) {
  const t = song.onFile,
    n = !t.registrations && !t.work && !t.writers.length;
  return (
    <section className={"panel-section on-file"}>
      <h3>{"on file"}</h3>
      {t.disclosures.map((r, i) => (
        <p className={"disclosure"} key={i}>
          <a href={r.url} target={"_blank"} rel={"noreferrer"}>
            {r.source}
            {", "}
            {r.ref}
          </a>
          <span>{r.text}</span>
        </p>
      ))}
      {t.writers.length > 0 && (
        <p className={"writers"}>
          <span className={"muted"}>{"registered writers"}</span>{" "}
          {t.writers.join(", ")}
        </p>
      )}
      {!t.disclosures.length && (
        <p className={"muted"}>
          {n
            ? `nothing on file: no copyright registration, no registered writers${t.releases ? ", and its discogs release lists no credits" : ""}. a sample nobody declared would only show up by ear.`
            : "no sample disclosed in its registrations or liner notes."}
        </p>
      )}
    </section>
  );
}
function sourceLabel(e) {
  const t = e.listen ?? [],
    n = getPlayerState().id,
    r = t.filter((i) => i !== n);
  r.length && toggleSong(r[Math.floor(Math.random() * r.length)]);
}
function GenreListening({ g: graph, song: song }) {
  const n = usePlayer();
  return (
    <section className={"panel-section listen"}>
      <h3>{"listen"}</h3>
      {(song.listen ?? []).map((r) => {
        const i = graph.byId.get(r),
          s = n.id === r;
        return (
          <button
            className={`listen-row ${s ? "is-on" : ""}`}
            onClick={() => toggleSong(r)}
            key={r}
          >
            <span className={"row-art"}>
              {i.art && <img src={i.art} alt={""} />}
            </span>
            <span className={"row-text"}>
              <span className={"row-title"}>{i.title}</span>
              <span className={"row-meta"}>
                {i.artist}
                {", "}
                {i.year}
              </span>
            </span>
            <span className={"listen-state"}>
              {s && n.playing ? "pause" : "play"}
            </span>
          </button>
        );
      })}
    </section>
  );
}
function AddSample({ onAdd: onAdd }) {
  const [errorMessage, setErrorMessage] = React.useState("");
  const [savedScope, setSavedScope] = React.useState(null);
  const [t, n] = React.useState(false),
    [r, i] = React.useState(""),
    [s, l] = React.useState([]),
    [o, a] = React.useState(null),
    [u, d] = React.useState(""),
    [f, p] = React.useState("idle");
  return (
    React.useEffect(() => {
      const m = r.trim();
      if (o || m.length < 2) return l([]);
      const g = setTimeout(
        () =>
          searchCatalog(m)
            .then(l)
            .catch(() => l([])),
        300,
      );
      return () => clearTimeout(g);
    }, [r, o]),
    f === "done" ? (
      <p className={"add-done"}>
        {savedScope === "browser"
          ? "added. saved in this browser."
          : "added. saved locally on this computer."}
      </p>
    ) : t ? (
      <section className={"panel-section add-sample"}>
        <h3>{"what does it sample?"}</h3>
        {o ? (
          <div className={"add-picked"}>
            <span className={"row-art"}>
              {o.art && <img src={o.art} alt={""} />}
            </span>
            <span className={"row-text"}>
              <span className={"row-title"}>{o.title}</span>
              <span className={"row-meta"}>
                {o.artist}
                {", "}
                {o.year}
              </span>
            </span>
            <button className={"text-btn"} onClick={() => a(null)}>
              {"change"}
            </button>
          </div>
        ) : (
          <>
            <input
              className={"add-input"}
              autoFocus={true}
              placeholder={"search the original song"}
              value={r}
              onChange={(m) => i(m.target.value)}
            />
            {s.map((m) => (
              <button className={"add-hit"} onClick={() => a(m)} key={m.id}>
                <span className={"row-art"}>
                  {m.art && <img src={m.art} alt={""} />}
                </span>
                <span className={"row-text"}>
                  <span className={"row-title"}>{m.title}</span>
                  <span className={"row-meta"}>
                    {m.artist}
                    {", "}
                    {m.year}
                  </span>
                </span>
              </button>
            ))}
          </>
        )}
        {o && (
          <>
            <input
              className={"add-input"}
              placeholder={"which part? (optional, e.g. the horn riff)"}
              value={u}
              onChange={(m) => d(m.target.value)}
              maxLength={80}
            />
            <button
              className={"play-btn"}
              disabled={f === "saving"}
              onClick={async () => {
                p("saving");
                setErrorMessage("");
                try {
                  const saved = await onAdd({
                    ...o,
                    part: u.trim() || undefined,
                  });
                  if (saved?.scope === "browser" || saved?.scope === "local") {
                    setSavedScope(saved.scope);
                    p("done");
                  } else {
                    p("error");
                  }
                } catch (error) {
                  setErrorMessage(error.message);
                  p("error");
                }
              }}
            >
              {f === "saving" ? "adding…" : "add sample"}
            </button>
            {f === "error" && (
              <p className={"muted"}>
                {errorMessage || "couldn't save it. try again in a moment."}
              </p>
            )}
          </>
        )}
      </section>
    ) : (
      <button className={"text-btn add-open"} onClick={() => n(true)}>
        {"hear a sample in this? add it"}
      </button>
    )
  );
}
export { SongPanel };
