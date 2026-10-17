# Vercel deployment

Production: https://backtrack-kappa-dusky.vercel.app/

Vercel project: `ytmolecular-1435s-projects/backtrack`. The project is connected to `htvarkali/backtrack`; pushes to `main` deploy automatically. The production URL is publicly accessible without signing in to Vercel.

Deploy from the repository root, with Node.js 24. `vercel.json` sets the Vite build, `dist/` output, and a single API function. The frontend keeps its existing hash routes, so links such as `/#/song/gold-digger` do not require an additional page rewrite.

## Runtime

- Vercel serves the frontend, artwork, graph, and fonts as static files.
- `api/index.js` initializes the shared Express API without starting a listening server or writing files.
- Public-provider API caches are bounded in-memory caches. They may reset between function instances.
- Hosted contributions are validated by the API and saved in the current browser. They are not stored in a shared server database. The app confirms a save only after the browser accepts the data.
- Local `npm run dev` and `npm start` retain their existing file-based contribution storage in `.local/`.
- Optional Spotify credentials belong in Vercel environment settings, never in the frontend or Git repository. The anonymous public import path works without them when Spotify makes a collection available.

## Commands

```sh
npm ci
npm run check
npx vercel login
npx vercel --prod
```

The CLI creates an ignored `.vercel/` link to the selected account/project. `.vercelignore` excludes local data, credentials, dependencies, and generated output from deployment uploads.

## Production checks

Confirm the public URL opens without a Vercel login. Verify `/api/health`, local and external search, an originality report, playable music previews, and a sample contribution that remains after refresh. Test `/api/catalog/musicbrainz/...` as well as simple API paths to check the function rewrite.

Music providers can restrict requests from hosting networks independently of local access. Report provider failures accurately; a successful build alone does not establish that every external provider is reachable.

Genius currently rejects requests from Vercel. Curated relationships remain available, and other tracks use a bounded MusicBrainz fallback. Incomplete histories show a warning and can be retried after refresh.
