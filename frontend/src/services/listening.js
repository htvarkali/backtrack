const LISTENING_SOURCE_KEY = "nn-source";
function readListeningSource() {
  try {
    return JSON.parse(localStorage.getItem(LISTENING_SOURCE_KEY) ?? "null");
  } catch {
    return null;
  }
}
function saveListeningSource(e) {
  try {
    e
      ? localStorage.setItem(LISTENING_SOURCE_KEY, JSON.stringify(e))
      : localStorage.removeItem(LISTENING_SOURCE_KEY);
    sessionStorage.removeItem("nn-listening");
  } catch {}
}
try {
  localStorage.removeItem("nn-spotify");
} catch {}
async function fetchListening(e) {
  const t = await fetch(
      `/api/listening?${new URLSearchParams({
        from: e,
      })}`,
    ),
    n = await t.json().catch(() => ({}));
  if (!t.ok) throw new Error(n.error || "couldn't reach that right now.");
  const r = new Date().getFullYear();
  return {
    name: n.name,
    recent: n.recent,
    tracks: n.tracks.map((i) => ({
      ...i,
      year: r,
      guessed: true,
    })),
  };
}
export { fetchListening, readListeningSource, saveListeningSource };
