# Verification

The production build and automated checks pass. A successful build is separate from verification of live external providers.

## Selected library update

- The homepage shows an 11-song selection directly beneath Your Library: Drake's Classic, WNBA, and I'm Spent, plus four PARTYNEXTDOOR tracks and four Bryson Tiller tracks. Artists are interleaved in a saved mixed order that remains stable across reloads. The previous featured-song section is removed.
- The full library shows the same 11 selected tracks. Imported playlists join the selection without replacing separate recordings or queueing the default selection for bulk sample research.
- Apple metadata provides release years, artwork, catalog links, and preview URLs. All 11 selected preview endpoints returned HTTP 206 audio responses; all seven distinct artwork URLs returned HTTP 200.
- Local browser checks opened Break from Toronto and Don't, reached the active Pause state for each preview, and verified Stop and return navigation.
- Automated coverage includes imported order, duplicate handling, verified metadata preparation, research state, and finite timeline positions for missing years.

## Earlier browser verification

- The home screen displayed Back Track branding, the blue theme, artwork, and the earlier starter selection.
- Local search and Enter selection opened Gold Digger's complete graph.
- Gold Digger playback reached the active Pause state with advancing progress; pause, stop, and paired listening worked. Next record changed playback and the detail panel to Ray Charles.
- Graph zoom, fit, and expansion added the gospel branch.
- The Gold Digger originality report displayed 40% original, 24% Ray Charles, and 36% Southern Tones, with a lineage breakdown and timeline.
- The earlier full-library view displayed all 82 curated starter songs; this view is now replaced by the selected library described above.
- A live Spotify import of Daft Punk's Discovery populated 14 real album tracks and their discovered ancestry. Disconnect restored the defaults.
- External search for Massive Attack returned real catalog results. During local verification, opening Teardrop discovered Sometimes I Cry by Les McCann (1973).
- The contribution form saved that verified relationship locally. The server returned the persisted record after restart, and the browser retained one connection after refresh; repeated contributions do not duplicate the graph edge.
- Blood on the Leaves reached the active Pause state in the browser using the Deezer fallback.

## Automated and live API verification

- All 267 song, genre, and tradition graph layouts contain finite coordinates and valid edge endpoints.
- Every curated song's ancestry, generation breakdown, and family composition total 100%.
- All 546 artwork references resolve to the 456 bundled files.
- Contribution persistence, reload hydration, out-of-order chains, duplicate protection, cycle prevention, and malformed input are tested.
- Audio controls, the 11-second queue transition, expired-preview recovery, missing recordings, and stale asynchronous responses are tested with an audio mock.
- API validation, fixed-origin catalog gateways, provider failures/timeouts, source attribution, Spotify parsing, and ListenBrainz deduplication are tested.
- Live Apple search and preview lookup, Genius sample discovery, Wikipedia queries, MusicBrainz recordings, Spotify albums/playlists, and ListenBrainz histories returned real results.
- Deezer fallback for Blood on the Leaves returned an actual audio stream (HTTP 206, audio/mpeg), covering a recording unavailable from Apple. Preview refresh bypasses stale caches.
- Production bundling passed with Vite. Dependency installation reported no known vulnerabilities.

Responsive breakpoints and styles were reviewed statically. No physical mobile device was used. Automated audio checks do not replace the separate browser playback checks above.

## External-service boundary

Public providers can rate limit, return incomplete sample relationships, remove music previews, or deny access to private or deleted playlists. The app reports these conditions through errors or incomplete-history warnings. Third-party availability can change after verification.

## Interface checks

The UI uses icy-blue surfaces, navy text, and cobalt gradients for graphs, charts, player controls, and panels. Category-label text contrast was measured at a minimum of 4.98:1.

Browser checks at port 5173 covered the homepage, Gold Digger graph and detail panel, and the originality report's 40/24/36 breakdown. The API health endpoint reports `back-track`, and the blue favicon returns HTTP 200.

## Serverless deployment checks

- All 40 checks pass with Node.js 24, including hosted origin validation, no filesystem access, bounded caches, visitor isolation, browser persistence, external-song restoration, storage failures, and cycle protection.
- The actual `api/index.js` entry was exercised over HTTP with the bundled graph: health reports all 179 songs, hosted contribution validation succeeds without retaining user data on the server, and unknown APIs return JSON errors.
- Vercel's deployment dry run recognizes the Vite preset and excludes `.env.local`, local runtime data, dependencies, and generated output from uploads.

## Live Vercel verification

- The production URL returns HTTP 200 without credentials; health returns the full catalog and `storage: "browser"`.
- The homepage, Gold Digger graph, and 40/24/36 originality report render with the blue theme. Gold Digger playback reaches the active Pause state, and Stop works.
- A verified Gold Digger/Ray Charles contribution shows "saved in this browser". Refresh retains the graph without duplicate sample edges.
- Live Massive Attack search, iTunes search, MusicBrainz search and nested recording details return real records.
- Gold Digger's Apple preview and Blood on the Leaves' Deezer fallback return playable URLs; a Deezer range request returns HTTP 206 with `audio/mpeg`.
- The public Spotify Discovery album imports all 14 tracks.

## Hosted provider fallback

- Genius rejects requests from the hosted runtime even though local requests succeed. Curated sample relationships remain available, and unknown tracks fall back to exact MusicBrainz recordings and forward sampling relationships.
- A live fallback check with Genius forced unavailable recovered Paper Planes → Straight to Hell from MusicBrainz. Teardrop returned an honest empty partial result when the selected recordings had no documented samples.
- Automated checks verify exact recording matching, relationship direction, bounded request deadlines, accurate source attribution, retrying incomplete histories, and duplicate-free refreshes that preserve curated sample types.
- The interface labels incomplete research and never caches provider failure as a completed history.
