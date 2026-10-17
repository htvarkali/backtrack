import { lookupFirstReleaseYear, sameRecording } from "./research.js";
import { lookupRecording } from "./catalog.js";

function parseRoute(e, t) {
  var s, l;
  const [, n, r] = e.replace(/^#\/?/, "/").split("/"),
    i = (o) => !!o && (!t || t.byId.has(o));
  return n === "song" && i(r)
    ? {
        name: "song",
        id: r,
      }
    : n === "dna" &&
        i(r) &&
        !((s = t == null ? undefined : t.byId.get(r)) != null && s.kind)
      ? {
          name: "dna",
          id: r,
        }
      : n === "all"
        ? {
            name: "all",
            focus:
              i(r) && !((l = t == null ? undefined : t.byId.get(r)) != null && l.external)
                ? r
                : undefined,
          }
        : {
            name: "home",
          };
}
const navigate = (e) => {
    window.location.hash = e;
  },
  EXTRA_SONGS_KEY = "nn-extra",
  readExtraSongs = () => {
    try {
      return JSON.parse(localStorage.getItem(EXTRA_SONGS_KEY) ?? "[]");
    } catch {
      return [];
    }
  },
  saveExtraSongs = (e) => {
    try {
      localStorage.setItem(EXTRA_SONGS_KEY, JSON.stringify(e.slice(-600)));
    } catch {}
  },
  EXTRA_LINKS_KEY = "nn-links",
  readExtraLinks = () => {
    try {
      return JSON.parse(localStorage.getItem(EXTRA_LINKS_KEY) ?? "[]");
    } catch {
      return [];
    }
  },
  saveExtraLinks = (e) => {
    try {
      localStorage.setItem(EXTRA_LINKS_KEY, JSON.stringify(e.slice(-1500)));
    } catch {}
  },
  slugify = (e) =>
    e
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60);
async function materializeSamples(e, t, n, r) {
  const i = [...e.byId.values()].filter((o) => !o.kind && !o.listenOf),
    s = [],
    l = [];
  for (const o of n) {
    let a = i.find((u) => sameRecording(u, o)) ?? s.find((u) => sameRecording(u, o));
    if (!a) {
      const u = await lookupRecording(o),
        d =
          o.year ??
          u.year ??
          (r ? undefined : await lookupFirstReleaseYear(o.title, o.artist));
      a = {
        id: `x-${slugify(`${o.artist} ${o.title}`)}`,
        title: o.title,
        artist: o.artist,
        year: Math.min(d ?? t.year, t.year),
        genres: [],
        preview: u.preview,
        art: u.art,
        external: true,
      };
      s.push(a);
    }
    a.id !== t.id &&
      l.push({
        from: t.id,
        to: a.id,
        type: o.type,
        element: "",
        source: o.source,
        evidence: {
          kind: "found",
          source: o.sourceName,
        },
      });
  }
  return {
    newSongs: s,
    newLinks: l,
  };
}
export {
  materializeSamples,
  navigate,
  parseRoute,
  readExtraLinks,
  readExtraSongs,
  saveExtraLinks,
  saveExtraSongs,
};
