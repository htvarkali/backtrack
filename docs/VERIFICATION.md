# Verification

The production build and 21 automated checks passed before handoff. A successful build is separate from verification of live external providers.

## Browser verification completed

- Home screen displays its layout, typeface, artwork, and 12 starter rows with Back Track branding and a blue theme.
- Local search and Enter selection opened Gold Digger's complete graph.
- Gold Digger playback reached the active Pause state with advancing progress; pause, stop, and paired listening worked. Next record changed playback and the detail panel to Ray Charles.
- Graph zoom, fit, and expansion added the gospel branch.
- The Gold Digger originality report displayed: 40% original, 24% Ray Charles, and 36% Southern Tones, with its lineage and timeline.
- The full library displayed all 82 curated starter songs.
- A live Spotify import of Daft Punk's Discovery populated 14 real album tracks and their discovered ancestry. Disconnect returned to the curated crate.
- External search for Massive Attack returned real catalog results. Opening Teardrop discovered Sometimes I Cry by Les McCann (1973).
- The contribution form saved that verified relationship locally. The server returned the persisted record after restart, and the browser retained one connection after refresh; repeated contributions do not duplicate the graph edge.
- Blood on the Leaves reached the active Pause state in the browser using the Deezer fallback.

## Automated and live API verification

- All 267 song, genre, and tradition graph layouts contain finite coordinates and valid edge endpoints.
- Every curated song's ancestry, generation breakdown, and family composition total 100%.
- All 546 artwork references resolve to the 456 mirrored files.
- Contribution persistence, reload hydration, out-of-order chains, duplicate protection, cycle prevention, and malformed input are tested.
- Audio controls, the 11-second queue transition, expired-preview recovery, missing recordings, and stale asynchronous responses are tested with an audio mock.
- API validation, fixed-origin catalog gateways, provider failures/timeouts, source attribution, Spotify parsing, and ListenBrainz deduplication are tested.
- Live Apple search and preview lookup, Genius sample discovery, Wikipedia queries, MusicBrainz recordings, Spotify albums/playlists, and ListenBrainz histories returned real results.
- Deezer fallback for Blood on the Leaves returned an actual audio stream (HTTP 206, audio/mpeg), covering a recording unavailable from Apple. Preview refresh bypasses stale caches.
- Production bundling passed with Vite. Dependency installation reported no known vulnerabilities.

Responsive breakpoints and styles were reviewed statically. No physical mobile device was used. Automated audio checks do not replace the separate browser playback checks above.

## External-service boundary

Public providers can rate limit, return incomplete sample relationships, remove music previews, or deny access to private/deleted playlists. The local app must report these conditions rather than invent a result or claim a successful import. A local server cannot guarantee permanent third-party availability.

## Back Track branding and blue theme

The interface uses Back Track branding. The UI uses icy-blue surfaces, navy text, and cobalt gradients, including graphs, charts, player, controls, and panels. All 847 layout, typography, and motion declarations were compared with the previous stylesheet and remained identical. Category-label text contrast is at least 4.98:1. The curated dataset and artwork remain intact.

After the rename, all 21 automated checks and the production build passed again. The running app at port 5173 was checked in the browser: homepage branding and gradients, Gold Digger graph and detail panel, and the originality report with its unchanged 40/24/36 breakdown. The API health endpoint reports `back-track`, and the new blue favicon returns HTTP 200.
