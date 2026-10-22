import React from "react";
import { SAMPLE_LABELS } from "./GraphElements.jsx";
import { analyzeAncestry } from "../utils/ancestry.js";
import { sameRecording } from "../services/research.js";
import { createStripTimeline, libraryTrackStatus } from "../utils/libraryTracks.js";

function createSongRows(e, t, n, r = []) {
  const i = (a, u) => {
      const d = (e.sampledBy.get(a) ?? []).find((m) => u.has(m.from)),
        f =
          (d == null ? undefined : d.type) === "interpolation"
            ? "replays"
            : (d == null ? undefined : d.type) === "cover"
              ? "covers"
              : "samples",
        p = d != null && d.element && !d.element.startsWith("(") ? d.element : "";
      return {
        song: e.byId.get(a),
        verb: f,
        how: d ? SAMPLE_LABELS[d.type] : "",
        what: p,
      };
    },
    s = (a) => {
      const u = e.byId.get(a),
        d = analyzeAncestry(e, a);
      return {
        key: a,
        title: u.title,
        artist: u.artist,
        year: u.year,
        art: u.art,
        ancestors: [...d.gen.keys()].filter((f) => f !== a).map((f) => i(f, d.gen)),
        direct: (e.samplesOf.get(a) ?? []).map((f) => i(f.to, d.gen)),
        oldest: d.oldest.id === a ? undefined : d.oldest,
        open: () => t(a),
      };
    },
    l = [...e.byId.values()].filter((a) => !a.kind && !a.external && !a.listenOf);
  return {
    rowFor: s,
    rowForTrack: (a, u) => {
      var m;
      const d =
          ((m = l.find((g) => sameRecording(g, a))) == null ? undefined : m.id) ??
          `sp-${a.id}`,
        f = () => n(a);
      if (!e.byId.has(d))
        return {
          key: `${u}-${a.id}`,
          title: a.title,
          artist: a.artist,
          year: a.year,
          art: a.art,
          ancestors: [],
          direct: [],
          open: f,
          ...libraryTrackStatus(e, d, r),
        };
      const p = s(d);
      return {
        ...p,
        key: `${u}-${a.id}`,
        art: p.art ?? a.art,
        open: f,
        ...libraryTrackStatus(e, d, r),
      };
    },
  };
}
function SongStrips({ sections: sections, onPick: onPick }) {
  const { fraction: i, ticks: s } = createStripTimeline(
    sections.flatMap((section) => section.rows),
  );
  let l = 0;
  return (
    <section className={"strips"}>
      <div className={"strip-axis"} aria-hidden={true}>
        <span />
        <span className={"strip-ticks"}>
          {s.map((o) => (
            <span
              style={{
                left: `${i(o) * 100}%`,
              }}
              key={o}
            >
              {o}
            </span>
          ))}
        </span>
      </div>
      {sections.map((o) => (
        <div className={"strip-section"} key={o.id ?? o.head}>
          {o.head && <h2 className={"strip-head"}>{o.head}</h2>}
          {o.rows.map((a) => (
            <SongStrip r={a} frac={i} i={l++} onPick={onPick} key={a.key} />
          ))}
          {o.after}
        </div>
      ))}
    </section>
  );
}
const STRIP_ROOT_RADIUS = 13,
  STRIP_RECORD_RADIUS = 10,
  STRIP_DOT_RADIUS = 5;
function layoutStrip(e, t, n) {
  const r = t(e.year) * n;
  let i = r,
    s = STRIP_ROOT_RADIUS,
    l = r;
  const o = [...e.ancestors]
    .sort((a, u) => u.song.year - a.song.year)
    .map((a) => {
      const u = a.song.art ? STRIP_RECORD_RADIUS : STRIP_DOT_RADIUS,
        d = Math.max(t(a.song.year) * n, i + s + u + 4);
      i = d;
      s = u;
      const f = d - l >= 40;
      return (
        f && (l = d),
        {
          p: a,
          px: d,
          rad: u,
          label: f,
        }
      );
    });
  return {
    songX: r,
    pts: o,
    end: o.length ? Math.max(...o.map((a) => a.px)) : r,
  };
}
function SongStrip({ r: e, frac: frac, i: n, onPick: onPick }) {
  const [i, ...s] = e.direct,
    l = React.useRef(null),
    [o, a] = React.useState(0);
  React.useLayoutEffect(() => {
    const p = l.current;
    if (!p) return;
    a(p.getBoundingClientRect().width);
    const m = new ResizeObserver(([g]) => a(g.contentRect.width));
    return (m.observe(p), () => m.disconnect());
  }, []);
  const { songX: u, pts: d, end: f } = layoutStrip(e, frac, o);
  return (
    <div
      className={"strip"}
      role={"button"}
      tabIndex={0}
      onClick={e.open}
      onKeyDown={(p) =>
        (p.key === "Enter" || p.key === " ") && (p.preventDefault(), e.open())
      }
      style={{
        animationDelay: `${n * 40}ms`,
      }}
    >
      <span className={"strip-art"}>
        {e.art && <img src={e.art} alt={""} loading={"lazy"} />}
      </span>
      <span className={"strip-id"}>
        <span className={"strip-title"}>{e.title}</span>
        <span className={"strip-artist"}>{e.artist}</span>
      </span>
      <span className={"strip-line"} ref={l}>
        {o > 0 && (
          <>
            {f > u && (
              <span
                className={"strip-root"}
                style={{
                  left: u,
                  width: f - u,
                  animationDelay: `${300 + n * 40}ms`,
                }}
              />
            )}
            {e.digging && (
              <span
                className={"strip-ghost"}
                style={{
                  left: u,
                }}
              />
            )}
            <span
              className={"strip-disc is-song"}
              style={{
                left: u,
              }}
            >
              {e.art && <img src={e.art} alt={""} loading={"lazy"} />}
            </span>
            {d.map(({ p, px: px, label: label }) => (
              <button
                className={"strip-pt"}
                style={{
                  left: px,
                }}
                onClick={(w) => {
                  w.stopPropagation();
                  onPick(p.song.id);
                }}
                aria-label={`${p.song.title} by ${p.song.artist}, ${p.song.year}`}
                key={p.song.id}
              >
                {p.song.art ? (
                  <span className={"strip-disc"}>
                    <img src={p.song.art} alt={""} loading={"lazy"} />
                  </span>
                ) : (
                  <span className={"strip-ring"} />
                )}
                {label && <span className={"strip-year"}>{p.song.year}</span>}
                <span className={"strip-tip"} role={"tooltip"}>
                  {p.song.art && (
                    <span className={"strip-tip-art"}>
                      <img src={p.song.art} alt={""} loading={"lazy"} />
                    </span>
                  )}
                  <span className={"strip-tip-text"}>
                    <span className={"strip-tip-title"}>{p.song.title}</span>
                    <span className={"strip-tip-meta"}>
                      {p.song.artist}
                      {", "}
                      {p.song.year}
                    </span>
                    {p.how && (
                      <span className={"strip-tip-how"}>
                        <b>{p.how}</b> {p.what}
                      </span>
                    )}
                  </span>
                </span>
              </button>
            ))}
          </>
        )}
      </span>
      <span className={"strip-end"}>
        {i ? (
          <>
            <span className={"strip-end-how"}>{i.verb}</span> {i.song.title}
            <span className={"strip-end-by"}>
              {i.song.artist}
              {", "}
              {i.song.year}
              {s.length > 0 && `, and ${s.length} more`}
            </span>
          </>
        ) : e.digging ? (
          <span className={"strip-digging"}>{"digging for its samples"}</span>
        ) : e.unexplored ? (
          <span className={"muted"}>{"open to explore samples"}</span>
        ) : (
          <span className={"muted"}>{"no samples on record"}</span>
        )}
      </span>
    </div>
  );
}
export { SongStrips, createSongRows };
