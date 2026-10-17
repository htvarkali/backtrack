import React from "react";
import { usePlayer, usePlayerSelector } from "../services/player.js";
import { songSubtitle } from "../data/graph.js";

function sepiaMatrix(e) {
  const t = [0.393, 0.769, 0.189, 0.349, 0.686, 0.168, 0.272, 0.534, 0.131],
    n = [1, 0, 0, 0, 1, 0, 0, 0, 1],
    r = t.map((i, s) => n[s] * (1 - e) + i * e);
  return `${r[0]} ${r[1]} ${r[2]} 0 0 ${r[3]} ${r[4]} ${r[5]} 0 0 ${r[6]} ${r[7]} ${r[8]} 0 0 0 0 0 1 0`;
}
function recordEra(e) {
  return e >= 2005 ? 0 : e >= 1990 ? 1 : e >= 1975 ? 2 : e >= 1962 ? 3 : 4;
}
const SAMPLE_LABELS = {
    drums: "drums",
    bass: "bassline",
    vocal: "vocal",
    melody: "melody",
    interpolation: "replayed",
    cover: "cover",
    sample: "sampled",
    influence: "grew from",
  },
  SAMPLE_DESCRIPTIONS = {
    drums: "Drums lifted from the recording",
    bass: "Bassline lifted from the recording",
    vocal: "Vocal lifted from the recording",
    melody: "Instrumental hook lifted from the recording",
    interpolation: "Re-sung or re-played, not lifted",
    cover: "The same song, recorded again",
    sample: "Sampled; the filing doesn't say which part",
    influence: "A style it grew out of, not a sample",
  },
  RecordNode = React.memo(function ({
    song: song,
    n,
    color: color,
    clipId: clipId,
    labelSize: labelSize,
    showLabel: showLabel,
    delay = 0,
    className = "",
    badge: badge,
    onClick: onClick,
    onDoubleClick: onDoubleClick,
    onEnter: onEnter,
    onLeave: onLeave,
  }) {
    const g = n.r,
      w = usePlayerSelector((N) => N.id === song.id && N.playing);
    return (
      <g
        className={`disc ${className} ${w ? "playing" : ""}`}
        style={{
          transform: `translate(${n.x}px, ${n.y}px)`,
        }}
        onClick={(N) => {
          N.stopPropagation();
          onClick == null || onClick(song.id);
        }}
        onDoubleClick={(N) => {
          N.stopPropagation();
          onDoubleClick == null || onDoubleClick(song.id);
        }}
        onMouseEnter={() => (onEnter == null ? undefined : onEnter(song.id))}
        onMouseLeave={() => (onLeave == null ? undefined : onLeave())}
        role={"button"}
        tabIndex={0}
        aria-label={`${song.title} by ${song.artist}, ${song.year}`}
        onKeyDown={(N) => {
          (N.key === "Enter" || N.key === " ") && (onClick == null || onClick(song.id));
        }}
      >
        <g
          className={"disc-grow"}
          style={{
            animationDelay: `${delay}ms`,
          }}
        >
          <PlaybackRing id={song.id} r={g} color={color} />
          <clipPath id={clipId}>
            <circle r={g} />
          </clipPath>
          {song.kind ? (
            <g className={"block"}>
              <rect
                x={-g - 5}
                y={-g - 5}
                width={g * 2 + 10}
                height={g * 2 + 10}
                className={"block-frame"}
              />
              {song.art ? (
                <image
                  href={song.art}
                  x={-g}
                  y={-g}
                  width={g * 2}
                  height={g * 2}
                  filter={`url(#age-${recordEra(song.year)})`}
                  preserveAspectRatio={"xMidYMid slice"}
                />
              ) : (
                <text
                  className={"disc-initial"}
                  dy={"0.35em"}
                  textAnchor={"middle"}
                  style={{
                    fontSize: g * 0.9,
                  }}
                >
                  {song.title.charAt(0).toLowerCase()}
                </text>
              )}
            </g>
          ) : (
            <>
              <g className={"disc-spin"}>
                <circle r={g + 5} className={"vinyl"} />
                {song.art ? (
                  <image
                    href={song.art}
                    x={-g}
                    y={-g}
                    width={g * 2}
                    height={g * 2}
                    clipPath={`url(#${clipId})`}
                    filter={`url(#age-${recordEra(song.year)})`}
                    preserveAspectRatio={"xMidYMid slice"}
                  />
                ) : (
                  <>
                    <circle r={g} className={"disc-blank"} />
                    <text
                      className={"disc-initial"}
                      dy={"0.35em"}
                      textAnchor={"middle"}
                      style={{
                        fontSize: g * 0.8,
                      }}
                    >
                      {song.title
                        .replace(/^[^A-Za-z0-9]+/, "")
                        .charAt(0)
                        .toLowerCase()}
                    </text>
                  </>
                )}
                <circle r={g} className={"label-sheen"} />
                <circle r={Math.max(1.5, g * 0.07)} className={"spindle"} />
              </g>
              <circle r={g + 5} className={"ring"} />
            </>
          )}
          {badge && (
            <g className={"badge"} transform={`translate(${g * 0.72}, ${-g * 0.72})`}>
              <circle r={13} className={"badge-dot"} />
              <text dy={"0.35em"} textAnchor={"middle"}>
                {badge}
              </text>
            </g>
          )}
          {showLabel && (
            <RecordLabel
              song={song}
              n={{
                ...n,
                x: 0,
                y: 0,
              }}
              labelSize={labelSize}
            />
          )}
        </g>
      </g>
    );
  });
function RecordLabel({ song: song, n: t, labelSize: labelSize }) {
  const r = t.r,
    i = Math.round(labelSize * 0.72);
  return (
    <g
      className={"disc-label"}
      transform={
        t.side === "above"
          ? `translate(${t.x}, ${t.y - (r + 12 + i * 1.35)})`
          : t.side === "below"
            ? `translate(${t.x}, ${t.y + r + 10 + labelSize})`
            : `translate(${t.x + (t.side === "left" ? -(r + 14) : r + 14)}, ${t.y})`
      }
      textAnchor={
        t.side === "left"
          ? "end"
          : t.side === "above" || t.side === "below"
            ? "middle"
            : "start"
      }
    >
      <text
        className={"t-title"}
        y={-labelSize * 0.12}
        style={{
          fontSize: labelSize,
        }}
      >
        {song.title}
      </text>
      <text
        className={"t-meta"}
        y={i * 1.35}
        style={{
          fontSize: i,
        }}
      >
        {songSubtitle(song)}
      </text>
    </g>
  );
}
function PlaybackRing({ id: id, r: t, color: color }) {
  const r = usePlayer();
  return r.id !== id ? null : (
    <>
      <circle
        r={t + 7}
        className={"halo"}
        stroke={color}
        style={{
          strokeWidth: 2 + (r.playing ? r.level * 5 : 0),
        }}
      />
      <circle
        r={t + 7}
        className={"progress-ring"}
        stroke={color}
        pathLength={1}
        strokeDasharray={`${r.progress} 1`}
        transform={"rotate(-90)"}
      />
    </>
  );
}
const cubicBezier = (e, t, n, r, i) =>
  (1 - i) ** 3 * e + 3 * (1 - i) ** 2 * i * t + 3 * (1 - i) * i * i * n + i ** 3 * r;
function verticalEdgePath(e, t, n = 0.32) {
  const r = e.y + e.r + 5,
    i = t.y - t.r - 5,
    s = (r + i) / 2;
  if (i - r < 40) {
    const l = t.x >= e.x ? 1 : -1,
      o = e.x + l * (e.r + 5);
    return {
      d: `M ${o} ${e.y} C ${t.x} ${e.y}, ${t.x} ${e.y}, ${t.x} ${i}`,
      mid: {
        x: cubicBezier(o, t.x, t.x, t.x, n),
        y: cubicBezier(e.y, e.y, e.y, i, n),
      },
    };
  }
  return {
    d: `M ${e.x} ${r} C ${e.x} ${s}, ${t.x} ${s}, ${t.x} ${i}`,
    mid: {
      x: cubicBezier(e.x, e.x, t.x, t.x, n),
      y: cubicBezier(r, s, s, i, n),
    },
  };
}
function radialEdgePath(e, t) {
  const n = Math.atan2(e.y, e.x),
    r = Math.atan2(t.y, t.x),
    i = Math.hypot(e.x, e.y),
    s = Math.hypot(t.x, t.y),
    l = i - e.r - 4,
    o = s + t.r + 4,
    a = (l + o) / 2,
    u = (f, p) => `${Math.cos(p) * f} ${Math.sin(p) * f}`;
  let d = (n + r) / 2;
  return (
    Math.abs(n - r) > Math.PI && (d += Math.PI),
    {
      d: `M ${u(l, n)} C ${u(a, n)}, ${u(a, r)}, ${u(o, r)}`,
      mid: {
        x: Math.cos(d) * a,
        y: Math.sin(d) * a,
      },
    }
  );
}
function RootEdge({
  a: e,
  b: b,
  type: type,
  width: width,
  delay: delay,
  duration = 650,
  showPill: showPill,
  element: element,
  className = "",
  radial: radial,
  onEnter: onEnter,
  onLeave: onLeave,
  labelAt: labelAt,
}) {
  const { d: m } = radial ? radialEdgePath(e, b) : verticalEdgePath(e, b),
    g = type === "interpolation" || type === "cover",
    w = type === "influence",
    N = {
      animationDelay: `${delay}ms`,
      animationDuration: `${duration}ms`,
    };
  return (
    <g className={`root ${w ? "influence" : ""} ${className}`}>
      <path d={m} pathLength={1} className={"root-line"} strokeWidth={width} style={N} />
      {g && (
        <path
          d={m}
          pathLength={1}
          className={"root-core"}
          strokeWidth={Math.max(1.2, width * 0.5)}
          style={N}
        />
      )}
      <path d={m} className={"root-hit"} onMouseEnter={onEnter} onMouseLeave={onLeave} />
      {showPill && (
        <EdgeLabel
          a={e}
          b={b}
          type={type}
          width={width}
          delay={delay}
          duration={duration}
          element={element}
          radial={radial}
          labelAt={labelAt}
        />
      )}
    </g>
  );
}
function EdgeLabel({
  a: e,
  b: b,
  type: type,
  width: width,
  delay: delay,
  duration = 650,
  element: element,
  radial: radial,
  labelAt: labelAt,
}) {
  const { mid: u } = radial
      ? radialEdgePath(e, b)
      : verticalEdgePath(e, b, labelAt == null ? undefined : labelAt.t),
    d = (labelAt == null ? undefined : labelAt.left) ?? false;
  return (
    <g
      className={`edge-label type-${type}`}
      transform={`translate(${u.x + (d ? -1 : 1) * (width / 2 + 8)}, ${u.y})`}
      textAnchor={d ? "end" : "start"}
      style={{
        animationDelay: `${delay + duration * 0.6}ms`,
      }}
    >
      <text dy={"0.35em"}>{SAMPLE_LABELS[type]}</text>
      {element && type !== "influence" && (
        <text className={"edge-element"} y={22}>
          {element}
        </text>
      )}
    </g>
  );
}
export {
  EdgeLabel,
  RecordNode,
  RootEdge,
  SAMPLE_DESCRIPTIONS,
  SAMPLE_LABELS,
  sepiaMatrix,
  verticalEdgePath,
};
