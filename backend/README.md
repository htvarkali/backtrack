# Local Back Track API

The Express API serves the built application from `../dist` and reads the checked-in catalog at `../frontend/public/data/graph.json`. The same API also runs through the Vercel function entry point in `api/index.js`.

From the repository root, `npm run dev` starts the API at **http://127.0.0.1:3001** and the Vite app at **http://127.0.0.1:5173**. For a production build, run `npm run build` then `npm start` and open **http://127.0.0.1:3001**. Node.js 24 is required and was used for verification.

## Configuration

No account, API key, or secret is required by default. Configuration can be supplied through shell environment variables:

```sh
PORT=3001 npm start
```

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3001` | Local HTTP port; the server binds to `127.0.0.1`. |
| `BACK_TRACK_DATA_DIR` | Project `.local/` directory | Absolute or working-directory-relative path for the persistent cache and local contributions. |
| `SPOTIFY_CLIENT_ID` | Empty | Optional Spotify developer application client ID. |
| `SPOTIFY_CLIENT_SECRET` | Empty | Optional Spotify developer application secret. Both Spotify values must be set to enable its Web API. |

The server uses ordinary process environment variables. A `.env` file must be loaded by the launcher (for example, `node --env-file-if-exists=.env backend/server.js`) if you choose to use one. Do not commit credentials. Spotify access tokens are kept in memory only.

## Routes

All API failures return a non-2xx status with `{ "error": "human readable explanation", "code": "ERROR_CODE" }`.

| Endpoint | Behavior |
| --- | --- |
| `GET /api/health` | Server status and checked-in song/sample counts. |
| `GET /api/search?q=...` | Local catalog matches plus Apple song search. Returns `tracks` and Apple-compatible `results`. |
| `GET /api/preview?title=...&artist=...` | Exact normalized song/artist match, preview URL, artwork, and year. Tries Apple, then Deezer, then bundled catalog media. Add `refresh=1` to bypass both preview and Apple caches. No match returns `preview: null`. |
| `GET /api/samples?title=...&artist=...` | Forward sample and interpolation relationships from Genius metadata, merged with the checked-in graph and saved local contributions. When Genius is unavailable, unknown tracks use a bounded MusicBrainz fallback. Relationships carry their sources, and incomplete research includes a warning. |
| `GET /api/listening?from=...` | Imports available public Spotify playlist/album tracks or a ListenBrainz user's recent public listens. Accepts Spotify URLs/URIs, ListenBrainz profile URLs, or usernames. |
| `POST /api/contribute` | Validates a contribution. Local installations save it on disk; hosted responses instruct the client to save it in the current browser. JSON fields: `title`, `artist`, `sampleTitle`, `sampleArtist`, optional `sampleYear`, optional `part`. Returns the saved entry and `ok: true`. |
| `GET /api/contributions` | Reads contributions saved by a local server. The hosted API returns an empty list because visitor contributions remain in browser storage. |
| `GET /api/catalog/itunes?...` | Cached Apple Search API gateway, preserving its response shape. |
| `GET /api/catalog/wikipedia?...` | Read-only Wikipedia query gateway. |
| `GET /api/catalog/musicbrainz/<entity or entity/id>?...` | Read-only MusicBrainz gateway with global request pacing. |

## Data and availability

- Local contributions survive server restarts in `.local/contributions.json`. Writes are serialized and atomic; duplicate submissions are idempotent. Hosted contributions are retained in the current browser and are not shared with other visitors. Contributions are not submitted to music providers. Self-sampling and graph cycles are rejected.
- Public metadata is cached in `.local/cache.json`. Search/research data is cached for 24 hours, preview responses for at most five minutes (including signed Deezer URLs), and imports for five minutes. The cache can be removed while the server is stopped. Keep `contributions.json` to preserve contributed links.
- The curated catalog, bundled artwork, and fonts remain usable offline. Recording previews, new searches, discoveries, and imports need network access. External outages produce errors or an explicitly reported curated fallback; no fabricated songs or sample relationships are returned.
- Spotify's public embed exposes the tracks that Spotify elects to share. Private, removed, restricted, or unavailable collections cannot be imported. Large public playlists can be limited by the embed. When optional Spotify application credentials have access, the Web API is attempted first, with a bounded maximum of ten pages and a `truncated` flag when applicable.
- ListenBrainz imports the latest 100 listens, deduplicated by title and artist. A user with no public history returns an error rather than a fake empty success.
- Preview links and remote catalog availability can change. The player can request a fresh preview from this server. Services have request timeouts and only fixed upstream hosts are accessible; the API is not an open proxy.

## Verification

Run `node --test backend/tests/*.test.js` (or the repository's `npm test`). Tests isolate storage in temporary directories and stub external requests. They cover validation, provider failures/timeouts, durable and concurrent contributions, cycles, Genius relationship direction, matching song previews, Spotify parsing, ListenBrainz deduplication, and fixed proxy destinations.

Live checks were also performed with Apple song search/previews, Genius metadata for “Stronger” by Kanye West, Spotify's public RapCaviar playlist (50 tracks), Daft Punk's Discovery album (14 tracks), ListenBrainz recent listens, Wikipedia search, and MusicBrainz recording search. These checks establish integration behavior at verification time; upstream catalogs can subsequently change.

Provider references: [Apple Search API](https://performance-partners.apple.com/search-api), [ListenBrainz API](https://listenbrainz.readthedocs.io/en/latest/users/api/core.html), [Spotify Web API](https://developer.spotify.com/documentation/web-api/reference/get-playlists-tracks), [MusicBrainz API](https://musicbrainz.org/doc/MusicBrainz_API), [MediaWiki API](https://www.mediawiki.org/wiki/API:Main_page).
