# Union Tool load — paused

Paused before any catalog number was written. No new `data/*.json` rows. Existing `data/union-tool-mill-hgrrs.json` was not edited.

## Done

- Schema and display path checked. Union Tool prints spindle speed (min-1), table feed (mm/min), ap and ae. Those belong in a condition `printed` block, keyed by the exact model number and diameter. The app already shows that RPM and table feed as manufacturer-printed and labels SFM and chip load DERIVED. Do not store a computed SFM or chip load as a Union Tool number.
- The existing HGRRS file does the opposite: it stores computed m/min and fz with `status: "derived"`. Leave it until a later pass rewrites it from the printed table. It is not part of this batch.
- English catalog index read: https://www.uniontool.co.jp/en/catalog/endmill.html
- PDFs were downloaded only under `/tmp/ut` (not in git) and text-extracted. Nothing was transcribed.

| File | URL | Pages | Notes |
|---|---|---|---|
| Vol.22 | https://www.uniontool.co.jp/en/assets/pdf/catalog/endmill_vol22_en.pdf | 792 | Title metadata `endmill_catalog_cn`. Created 2025-10-16. Copy-restricted. Not read for numbers. |
| HGS | https://www.uniontool.co.jp/assets/pdf/catalog/endmill_hgs.pdf | 8 | Created 2025-06-24. Text extracted, not transcribed. |
| VHGLRS | https://www.uniontool.co.jp/en/assets/pdf/catalog/endmill_vseries_vhglrs_en.pdf | 6 | Created 2024-10-30. Text extracted, not transcribed. |
| DLC-ALES | https://www.uniontool.co.jp/assets/pdf/catalog/endmill_dlc-ales.pdf | 6 | Created 2024-10-23. Text extracted, not transcribed. |
| CESUS | https://www.uniontool.co.jp/assets/pdf/catalog/em-cesus_vol2.pdf | 6 | Created 2018-10-15. Text extracted, not transcribed. |
| DLCES | https://www.uniontool.co.jp/assets/pdf/catalog/endmill_dlces2000-4000.pdf | 6 | PDF title is Japanese. Text extracted, not transcribed. |
| CWLB | https://www.uniontool.co.jp/en/assets/pdf/catalog/endmill_cwlb_en.pdf | 12 | Created 2023-08-29. Text extracted, not transcribed. |
| HGLRS URL | https://www.uniontool.co.jp/assets/pdf/catalog/endmill_hglrs_2023_04.pdf | 16 | `pdfinfo` title came back as UNIMAX, 11 MB. Do not use until the file is confirmed against the HGLRS leaflet. |
| V series | https://www.uniontool.co.jp/en/assets/pdf/catalog/endmill_vseriescatalog_en.pdf | 52 | Created 2024-04-26. Not transcribed. |

## Left

- Transcribe printed milling conditions only, one commit per series family. Cite each number with the PDF URL plus `#page=`, catalog or edition, and printed page.
- No invented sizes, no interpolation. Specs (substrate, flutes, UTCOAT / HMGCOAT / DLC, end shape) only where the page prints them.
- Materials: link only app materials the page names, and only inside the printed hardness band. NAK/STAVAX, SKD11, copper, aluminum, and cemented carbide do not get a guessed id. Neck length and effective length stay in a note if the schema cannot hold them.
- Validators not run this pause: no JSON changed. On resume: `node scripts/validate.mjs`, `node scripts/build-index.mjs` (commit the index and `sw.js` cache stamp), `node test.mjs`, `node scripts/validate-machines.mjs`.
- Spot-check at least four results against the printed tables. Phone screenshots (390×844): one Union Tool card in hardened steel, one in another material.
- Rebase onto `master` if it moves (other loads, including YG-1, are in flight) and rerun `build-index`.
