import React from "react";
import {
  analyzeAncestry,
  compositionByFamily,
  compositionByGeneration,
  findRelatives,
  melodyLineage,
  memoizeById,
  rhythmLineage,
} from "../utils/ancestry.js";
import { playQueue } from "../services/player.js";
import { songFamily } from "../data/graph.js";
import { SAMPLE_LABELS } from "./GraphElements.jsx";

const formatPercent = (e, t = 1) => `${(e * 100).toFixed(t)}%`,
  ORIGINAL_COLOR = "#516b91",
  GENERATION_LABELS = [
    "This song",
    "Parents",
    "Grandparents",
    "Great-grandparents",
    "2× great-grandparents",
    "3× great-grandparents",
  ];
function Originality({ g: graph, id: id, onOpen: onOpen, onReport: onReport }) {
  const i = React.useMemo(() => memoizeById((g) => analyzeAncestry(graph, g)), [graph]),
    s = graph.byId.get(id),
    l = i(id),
    o = React.useMemo(() => compositionByFamily(graph, l), [graph, l]),
    a = React.useMemo(() => compositionByGeneration(graph, l), [graph, l]),
    u = React.useMemo(() => findRelatives(graph, id, i).slice(0, 10), [graph, id, i]),
    d = rhythmLineage(graph, l),
    f = melodyLineage(graph, l),
    p = l.contrib.get(id) ?? 1,
    m = React.useMemo(
      () =>
        [...l.gen.entries()]
          .sort(
            (g, w) => g[1] - w[1] || (l.reach.get(w[0]) ?? 0) - (l.reach.get(g[0]) ?? 0),
          )
          .map(([g]) => g),
      [l],
    );
  return (
    <div className={"report-wrap"}>
      <article className={"report"}>
        <header className={"report-head"}>
          <div className={"report-brand"}>
            <Methodology />
            <span>{"Originality"}</span>
          </div>
          <div className={"report-subject"}>
            {s.art && <img src={s.art} alt={""} />}
            <div>
              <p className={"report-kicker"}>{"Ancestry report for"}</p>
              <h1>{s.title}</h1>
              <p className={"report-by"}>
                {s.artist}
                {", "}
                {s.year}
              </p>
            </div>
          </div>
          <div className={"report-actions"}>
            <button className={"paper-btn primary"} onClick={() => playQueue(m)}>
              {"▶ Hear the lineage"}
            </button>
            <button className={"paper-btn"} onClick={() => onOpen(id)}>
              {"Back track"}
            </button>
          </div>
        </header>
        {l.depth === 0 ? (
          <section className={"report-section"}>
            {graph.sampledBy.get(id).length > 0 ? (
              <>
                <h2>{"Bedrock record"}</h2>
                <p className={"lede"}>
                  {"Nothing in this crate came before "}
                  {s.title}
                  {". It is 100% its own material, and the songs below grew out of it."}
                </p>
              </>
            ) : (
              <>
                <h2>{"No documented samples yet"}</h2>
                <p className={"lede"}>
                  {"Nothing published says "}
                  {s.title}
                  {
                    " samples an older record, so as far as this crate knows it is 100% original."
                  }
                </p>
              </>
            )}
          </section>
        ) : (
          <>
            <section className={"report-section composition"}>
              <div className={"donut-col"}>
                <CompositionBar comp={o} self={p} />
              </div>
              <div className={"comp-col"}>
                <h2>{"Ancestry composition"}</h2>
                <p className={"lede"}>
                  {formatPercent(l.inherited, 0)}
                  {" of this song was already here before it. It traces back "}
                  {l.depth} {l.depth === 1 ? "generation" : "generations"}
                  {", to "}
                  {l.oldest.year}
                  {"."}
                </p>
                <ul className={"comp-list"}>
                  {o.map((g) => (
                    <FamilyBreakdown f={g} g={graph} onReport={onReport} key={g.key} />
                  ))}
                  <li className={"comp-row original"}>
                    <span
                      className={"swatch"}
                      style={{
                        background: ORIGINAL_COLOR,
                      }}
                    />
                    <span className={"comp-label"}>{"Original to this song"}</span>
                    <span className={"comp-pct"}>{formatPercent(p)}</span>
                  </li>
                </ul>
              </div>
            </section>
            <section className={"report-section"}>
              <h2>{"Lineage painting"}</h2>
              <p className={"lede"}>
                {
                  "Each bar is one generation back. Its length is how much of this song came from that generation."
                }
              </p>
              <GenerationBreakdown g={graph} gens={a} onReport={onReport} />
            </section>
            <section className={"report-section"}>
              <h2>{"Ancestry timeline"}</h2>
              <AncestrySummary g={graph} dna={l} song={s} />
            </section>
            <section className={"report-section lines"}>
              <LineageCard
                g={graph}
                title={"Rhythm line"}
                help={
                  "Traced only through drums, basslines and covers, like a paternal line."
                }
                line={d}
                song={s}
                onReport={onReport}
              />
              <LineageCard
                g={graph}
                title={"Melody line"}
                help={
                  "Traced only through vocals, hooks, replayed melodies and covers, like a maternal line."
                }
                line={f}
                song={s}
                onReport={onReport}
              />
            </section>
          </>
        )}
        <section className={"report-section"}>
          <h2>{"Sample relatives"}</h2>
          {u.length ? (
            <>
              <p className={"lede"}>
                {"Songs that share ancestors with "}
                {s.title}
                {", named the way a family tree would name them."}
              </p>
              <ul className={"relatives"}>
                {u.map((g) => (
                  <li key={g.song.id}>
                    <button onClick={() => onReport(g.song.id)}>
                      {g.song.art ? (
                        <img src={g.song.art} alt={""} />
                      ) : (
                        <span className={"rel-blank"} />
                      )}
                      <span className={"rel-main"}>
                        <span className={"rel-title"}>{g.song.title}</span>
                        <span className={"rel-meta"}>
                          {g.song.artist}
                          {", "}
                          {g.song.year}
                        </span>
                      </span>
                      <span className={"rel-kin"}>
                        <span className={"rel-label"}>{g.label}</span>
                        <span className={"rel-via"}>
                          {g.label.startsWith("Child") || g.label.startsWith("Grand")
                            ? "samples this song"
                            : `through ${g.via.title} (${g.via.year})`}
                        </span>
                      </span>
                      <span className={"rel-shared"}>
                        {formatPercent(g.shared)}
                        <small>{"shared"}</small>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className={"lede"}>
              {"No relatives in this crate yet. Nothing else here shares its ancestors."}
            </p>
          )}
        </section>
        <footer className={"report-foot"}>
          <p>
            {
              "How this is calculated: every song keeps 40% of itself and passes the rest down to the records it sampled, split by what was taken (vocals and hooks weigh a little more than drums). A cover keeps 15%. It's a playful model, not musicology. Every sample link is sourced; open any record in the back track view to see the source."
            }
          </p>
        </footer>
      </article>
    </div>
  );
}
function Methodology() {
  return (
    <svg width={"34"} height={"34"} viewBox={"0 0 34 34"} aria-hidden={true}>
      {Array.from(
        {
          length: 7,
        },
        (e, t) => {
          const n = 4 + t * 4.3,
            r = Math.sin((t / 6) * Math.PI * 2) * 11;
          return (
            <line
              x1={17 - r}
              x2={17 + r}
              y1={n}
              y2={n}
              stroke={"currentColor"}
              strokeWidth={"2.2"}
              strokeLinecap={"round"}
              opacity={0.35 + 0.65 * Math.abs(r / 11)}
              key={t}
            />
          );
        },
      )}
      <path
        d={"M6 4 C 28 12, 6 22, 28 30"}
        fill={"none"}
        stroke={"currentColor"}
        strokeWidth={"2.2"}
      />
      <path
        d={"M28 4 C 6 12, 28 22, 6 30"}
        fill={"none"}
        stroke={"currentColor"}
        strokeWidth={"2.2"}
      />
    </svg>
  );
}
function CompositionBar({ comp: comp, self: self }) {
  const i = 2 * Math.PI * 118,
    s = [
      ...comp.map((o) => ({
        key: o.key,
        color: o.color,
        share: o.share,
      })),
      {
        key: "self",
        color: ORIGINAL_COLOR,
        share: self,
      },
    ];
  let l = 0;
  return (
    <svg
      viewBox={"-160 -160 320 320"}
      className={"donut"}
      role={"img"}
      aria-label={"Ancestry composition"}
    >
      {s.map((o) => {
        const a = o.share * i,
          u = (
            <circle
              r={118}
              fill={"none"}
              stroke={o.color}
              strokeWidth={34}
              strokeDasharray={`${Math.max(0, a - 2)} ${i}`}
              strokeDashoffset={-l}
              transform={"rotate(-90)"}
              className={"donut-seg"}
              key={o.key}
            />
          );
        return ((l += a), u);
      })}
      <text className={"donut-num"} textAnchor={"middle"} y={4}>
        {Math.round((1 - self) * 100)}
        {"%"}
      </text>
      <text className={"donut-cap"} textAnchor={"middle"} y={34}>
        {"inherited"}
      </text>
    </svg>
  );
}
function FamilyBreakdown({ f: f, g: graph, onReport: onReport }) {
  const [r, i] = React.useState(true);
  return (
    <li className={"comp-family"}>
      <button className={"comp-row"} onClick={() => i(!r)} aria-expanded={r}>
        <span
          className={"swatch"}
          style={{
            background: f.color,
          }}
        />
        <span className={"comp-label"}>{f.label}</span>
        <span className={"comp-pct"}>{formatPercent(f.share)}</span>
      </button>
      {r && (
        <ul className={"comp-sub"}>
          {f.children.map((s) => (
            <li key={s.key}>
              <div className={"comp-row genre"}>
                <span className={"comp-label"}>{s.label}</span>
                <span className={"comp-pct"}>{formatPercent(s.share)}</span>
              </div>
              <ul className={"comp-records"}>
                {s.children.map((l) => {
                  const o = graph.byId.get(l.key);
                  return (
                    <li key={l.key}>
                      <button
                        className={"comp-row record"}
                        onClick={() => onReport(l.key)}
                      >
                        <span className={"comp-label"}>
                          {o.title}{" "}
                          <span className={"muted"}>
                            {o.artist}
                            {", "}
                            {o.year}
                          </span>
                        </span>
                        <span className={"comp-pct"}>{formatPercent(l.share)}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
function GenerationBreakdown({ g: graph, gens: gens, onReport: onReport }) {
  const r = Math.max(...gens.map((i) => i.total));
  return (
    <div className={"painting"}>
      {gens.map((i) => (
        <div className={"paint-row"} key={i.gen}>
          <span className={"paint-name"}>
            {GENERATION_LABELS[i.gen] ?? `${i.gen - 2}× great-grandparents`}
          </span>
          <div
            className={"chromosome"}
            style={{
              width: `${(i.total / r) * 100}%`,
            }}
          >
            {i.parts.map((s) => {
              const l = graph.byId.get(s.id),
                o = songFamily(graph, l);
              return (
                <button
                  className={"chromo-seg"}
                  style={{
                    flexGrow: s.share,
                    background: i.gen === 0 ? ORIGINAL_COLOR : o.color,
                  }}
                  title={`${l.title}, ${l.artist} (${l.year}): ${formatPercent(s.share)}`}
                  onClick={() => onReport(s.id)}
                  key={s.id}
                >
                  <span>{l.title}</span>
                </button>
              );
            })}
          </div>
          <span className={"paint-pct"}>{formatPercent(i.total, 0)}</span>
        </div>
      ))}
    </div>
  );
}
function AncestrySummary({ g: graph, dna: dna, song: song }) {
  const r = [...dna.contrib.keys()],
    i = r.map((f) => graph.byId.get(f).year),
    s = Math.floor((Math.min(...i) - 3) / 10) * 10,
    l = Math.max(...i) + 3,
    o = 1e3,
    a = (f) => ((f - s) / (l - s)) * o,
    u = [];
  for (let f = s; f <= l; f += 10) u.push(f);
  const d = song.year - dna.oldest.year;
  return (
    <>
      <p className={"lede"}>
        {"The oldest record in its family tree is "}
        {dna.oldest.title}
        {" by "}
        {dna.oldest.artist}
        {", from "}
        {dna.oldest.year}
        {":"} {d === 0 ? "the same year" : `${d} years before ${song.title}`}
        {"."}
      </p>
      <svg
        className={"timeline"}
        viewBox={`-20 -70 ${o + 40} 130`}
        preserveAspectRatio={"xMidYMid meet"}
      >
        <line x1={0} x2={o} y1={0} y2={0} className={"tl-axis"} />
        {u.map((f) => (
          <g transform={`translate(${a(f)},0)`} key={f}>
            <line y1={-6} y2={6} className={"tl-tick"} />
            <text y={30} textAnchor={"middle"} className={"tl-year"}>
              {f}
            </text>
          </g>
        ))}
        {r
          .sort((f, p) => (dna.contrib.get(p) ?? 0) - (dna.contrib.get(f) ?? 0))
          .map((f) => {
            const p = graph.byId.get(f),
              m = 5 + Math.sqrt(dna.contrib.get(f)) * 26;
            return (
              <circle
                cx={a(p.year)}
                cy={-m - 2}
                r={m}
                fill={f === dna.root ? ORIGINAL_COLOR : songFamily(graph, p).color}
                className={"tl-dot"}
                key={f}
              >
                <title>
                  {p.title}
                  {" ("}
                  {p.year}
                  {")"}
                </title>
              </circle>
            );
          })}
      </svg>
    </>
  );
}
const formatGeneration = (e) =>
  `${e.title
    .replace(/[^A-Za-z0-9 ]/g, "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 3)
    .map((t) => t[0].toUpperCase())
    .join("")}-${e.year}`;
function LineageCard({
  g: graph,
  title: title,
  help: help,
  line: line,
  song: song,
  onReport: onReport,
}) {
  const l = line.length ? graph.byId.get(line[line.length - 1].to) : null;
  return (
    <div className={"line-card"}>
      <h2>{title}</h2>
      <p className={"small muted"}>{help}</p>
      {l ? (
        <>
          <p className={"haplo"}>
            <span className={"haplo-code"}>{formatGeneration(l)}</span>
            <span className={"haplo-name"}>
              {l.title}
              {", "}
              {l.artist}
            </span>
          </p>
          <ol className={"line-chain"}>
            <li>{song.title}</li>
            {line.map((o) => {
              const a = graph.byId.get(o.to);
              return (
                <li key={o.to}>
                  <span className={"chain-type"}>{SAMPLE_LABELS[o.type]}</span>
                  <button onClick={() => onReport(a.id)}>
                    {a.title}{" "}
                    <span className={"muted"}>
                      {"("}
                      {a.year}
                      {")"}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </>
      ) : (
        <p className={"haplo none"}>
          {"None. Every "}
          {title === "Rhythm line" ? "beat" : "hook"}
          {" here was made fresh."}
        </p>
      )}
    </div>
  );
}
export { Originality };
