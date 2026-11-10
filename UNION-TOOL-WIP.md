# Union Tool load — partial

Paused again at the Tuesday deadline. Rows below are in `data/` and passed `validate.mjs`, `build-index.mjs`, `test.mjs`, and `validate-machines.mjs`.

Printed RPM, mm/min, ap and ae are stored in `printed`. SFM and chip load are not stored. The app labels those DERIVED from the printed RPM, feed and flute count.

## Loaded

| Series | File | Tools | Rows | Source |
|---|---|---|---|---|
| HGS | `data/union-tool-mill-hgs.json` | 27 | 162 | [HGS leaflet](https://www.uniontool.co.jp/assets/pdf/catalog/endmill_hgs.pdf) PDF p.6–7, printed p.6 roughing and p.7 finishing. Edition `202506_HGS_14KA`. |
| CESUS | `data/union-tool-mill-cesus.json` | 21 | 126 | [CESUS leaflet](https://www.uniontool.co.jp/assets/pdf/catalog/em-cesus_vol2.pdf) PDF p.4, printed p.4, side milling and slotting. Edition `1811 SUS2_6KA`. |
| DLC-ALES | `data/union-tool-mill-dlc-ales.json` | 18 | 36 | [DLC-ALES leaflet](https://www.uniontool.co.jp/assets/pdf/catalog/endmill_dlc-ales.pdf) PDF p.5, printed p.4. Edition `202411_DLC-ALES_re_10KA`. Dashed cells omitted. |
| VHGLRS | `data/union-tool-mill-vhglrs.json` | 30 | 120 | [VHGLRS leaflet](https://www.uniontool.co.jp/en/assets/pdf/catalog/endmill_vseries_vhglrs_en.pdf) PDF p.5, printed p.4. Edition `Nov.2024_VHGLRS_en_1.5KA`. |

Existing `data/union-tool-mill-hgrrs.json` was not edited. It still stores computed m/min and fz.

## Materials

Linked: CESUS `SUS304` → `ss304`.

Not linked: SKD11 55–62HRC, HAP10, HAP72, NAK/STAVAX up to 55HRC (no matching app material and hardness), S45C/S50C annealed (~225HB), SK/SCM annealed 225–325HB, A5052/A7075. Those rows stay on their ISO group only (`strictMaterials`).

## Not stored

Neck diameter, inclined-angle effective length, overall length and shank diameter. Corner radius and effective length for VHGLRS are in the row note. Length of cut is in the row note.

## Left

General Catalog Vol.22 (792 pages) and the other series leaflets (CWLB, DLCES, and the rest of the English catalog index) are not transcribed. The file downloaded from the HGLRS URL came back titled UNIMAX; do not use it until that PDF is confirmed. Rebase if `master` moves and rerun `build-index`.
