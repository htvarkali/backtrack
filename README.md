# Back Track

**Live website:** [Back Track](https://backtrackmusic.vercel.app/)

Back Track is a music ancestry explorer: search a song and explore its samples, genres, and musical traditions. Use the live website or run the complete app locally.

## Run

Requires Node.js 24.

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

- Layout, typography, and starter song timelines with Back Track branding and a blue palette.
- Full curated dataset: 179 songs, 119 sample connections, 45 genres, 43 traditions, and 154 historical influences.
- Search across the local crate and the live music catalog.
- Interactive ancestry graphs with pan, zoom, fit, earlier influences, and record details.
- Song, genre, and tradition listening previews, queue controls, and side-by-side sample listening.
- Originality reports with composition, lineage painting, timeline, rhythm and melody lines, and sample relatives.
- Public Spotify playlist/album and ListenBrainz listening-history import.
- Personal library, remembered imports, browser back/forward navigation, and persistent discoveries.
- Local sample contributions with server persistence.
- Locally bundled fonts and all 456 album-cover images referenced by the curated data.

## Data and network behavior

The curated graph, artwork, fonts, and app are served locally. Live catalog searches, public playlist imports, sample discovery, external source links, and official audio previews require internet access and remain subject to their providers' availability. Private playlists cannot be imported anonymously. The app does not require a Spotify login for public imports.

When running locally, contributions and API caches are saved under `.local/`, which Git ignores. Browser discoveries and the selected library also persist in local/session storage. On Vercel, personal sample contributions are saved in the visitor's browser, and provider caches are temporary server memory. Contributions are not shared with other visitors. Clearing browser data removes that browser's saved contributions.

Server endpoints provide adapters around the bundled data and public music services.

## Structure

```text
frontend/
  public/       # Curated graph, cover art, and fonts
  src/          # React components, hooks, services, and graph utilities
backend/        # Local API, provider adapters, persistence, and tests
api/            # Vercel serverless entry point for the same API
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

## Deploy to Vercel

Import this repository with the repository root as the Root Directory. The committed `vercel.json` selects Vite, builds with `npm run build`, serves `dist/`, and routes `/api/*` to the Node function. No environment variables are required for public music services.

For a CLI deployment, sign in with `npx vercel login`, then run `npx vercel --prod`. See [deployment notes](docs/DEPLOYMENT.md) for the hosted storage behavior and checks.
