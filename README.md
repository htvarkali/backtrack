# Back Track

Back Track is a music ancestry explorer: search a song and explore its samples, genres, and musical traditions.

## Run

Requires Node.js 22 or newer.

```sh
npm ci
npm run dev
```

Open **http://127.0.0.1:5173**. One command starts both the Vite frontend and the local API. Press Ctrl+C to stop both.

For a production build:

```sh
npm run build
npm start
```

The production server serves the built app and API together at **http://127.0.0.1:3001**. Change the production port with `PORT=8080 npm start`.

Optional settings are listed in `.env.example`. Copy it to `.env` if needed; the server loads it automatically. Public Spotify imports work without credentials. Configured Spotify application credentials can enable the official API for collections available to that application.

## Included

- Home screen, typography, colors, and starter song timelines.
- Full curated dataset: 179 songs, 119 sample connections, 45 genres, 43 traditions, and 154 historical influences.
- Search across the local crate and the live music catalog.
- Interactive ancestry graphs with pan, zoom, fit, deeper ancestry, and record details.
- Song, genre, and tradition listening previews, queue controls, and side-by-side sample listening.
- Originality reports with composition, lineage painting, timeline, rhythm and melody lines, and sample relatives.
- Public Spotify playlist/album and ListenBrainz listening-history import.
- Personal library, remembered imports, browser back/forward navigation, and persistent discoveries.
- Local sample contributions with server persistence.
- Locally bundled fonts and all 456 album-cover images referenced by the curated data.

## Data and network behavior

The curated graph, artwork, fonts, and app are served locally. Live catalog searches, public playlist imports, sample discovery, external source links, and official audio previews require internet access and remain subject to their providers' availability. Private playlists cannot be imported anonymously. The app does not require a Spotify login for public imports.

Contributions and API caches are saved under `.local/`, which Git ignores. Browser discoveries and the selected library also persist in local/session storage. Contributions in this build are saved on this computer.

Server endpoints provide adapters around the bundled data and public music services.

## Structure

```text
frontend/
  public/       # Curated graph, cover art, and fonts
  src/          # React components, hooks, services, and graph utilities
backend/        # Local API, provider adapters, persistence, and tests
scripts/        # Development launcher and verification helpers
docs/           # Provenance and verification notes
dist/           # Generated production build (ignored)
.local/         # Runtime data and caches (ignored)
```

## Verify

```sh
npm test
npm run build
```

See [verification notes](docs/VERIFICATION.md) for exercised browser flows and external-service limitations. See [provenance](docs/PROVENANCE.md) before redistributing source or assets. `package-lock.json` is committed for repeatable installs; credentials, caches, generated output, and `node_modules` are excluded from Git.
