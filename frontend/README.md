# Back Track frontend

The React client provides song search, interactive ancestry graphs, recording previews, playlist imports, originality reports, and personal sample contributions. D3 supports graph navigation and transitions.

Music research requests use the same-origin API. Contributions are validated by the API and retained in a verified browser ledger, including the metadata needed to restore external songs after a refresh. Local installations also save contributions on disk; the hosted app does not retain them in a shared server database.

Artwork and fonts are bundled under `public/`. Recording previews and new catalog research require their music providers to be available. Incomplete research is labeled and can be retried after refresh.

- `src/components`: home, search, library, interactive graph, song inspector, originality report, player
- `src/services`: catalog, research, listening imports, contribution persistence, playback
- `src/utils`: graph traversal, inheritance math, layout
- `src/hooks`: listening and responsive inspector state
- `src/data`: graph loading, indexes, contribution restoration
- `src/styles`: blue theme and presentation palette

Run the commands in the repository README. Asset and dependency licensing notes are in `docs/PROVENANCE.md`.
