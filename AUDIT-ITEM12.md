# Item 12 audit — lumped picker grades

Read-only pass over loaded catalog rows before any remap. A row counts only when it is already linked to the lumped picker id (`materials` contains `ss304`, `p-mild`, `p-alloy`, or `ss400`). Wording is `sourceGroup` (the maker's own line). Hardness numbers are stripped before a grade token is read, so `316 HB` is not grade 316.

EN and JIS names below are the designation the maker printed, not a handbook conversion added later: `SUS304` / `1.4301` / `X5CrNi18-9` / `X5CrNi18-10` are 304-family; `SUS316` / `1.4401` / `1.4404` / `X5CrNiMo17-12-2` are 316-family. `304L` and `316L` stay on 304 and 316 (search aliases). They are not new picker entries. `304B` is not read as 304.

Cover rule used for the remap:

- Names 304-family and 316-family → both grades. The card keeps `sourceGroup`, so the number is not labeled 304-only or 316-only.
- Names only the 304 family → 304 only. Names only the 316 family → 316 only.
- Plain "austenitic stainless" or "300 series" with no grade and no duplex → both (the group plainly covers both).
- "Austenitic … examples 316" → both. The printed word is examples, not a 316-only row.
- "Austenitic stainless (SUS304, etc.)" → both. The heading is the group and `etc.` leaves it open.
- "SUS304, etc." with no austenitic heading and no 316 → 304 only. `etc.` is not read as 316.
- A closed list that names 304 and not 316 (Dormer `303Se, 304H, 304L…`, Garr `304L, Nitronic 50, Duplex`) → 304 only.
- "austenitic, duplex" with no grade → left on the old id only (now 304). Not copied to 316.

2,961 linked `ss304` rows: **both 2,565**, **304 only 300**, **316 only 26**, **left on 304 only 70**.

## 316 printed as its own row

These leave `ss304` and link only to `ss316`. 304 must not show them.

| Brand | Tool / file | What the source prints | Cite |
|---|---|---|---|
| Sandvik Coromant | CoroMill 390 pocket guide, `sandvik-coromant-sandvik-coromill-390-pocket-guide-first-choice.json` (6 rows) | Stainless steel 316 | p.1, https://ecomm-api.vallen.com/content/wp-content/uploads/2019/08/CoroMill-390-Pocket-Guide.pdf |
| Iscar | H690 TNKX, `iscar-mill-h690-tnkx-p541.json`, and MINI-TANG-SLOT, `iscar-mill-mini-tang-slot-p384.json` | austenitic S.S., 316L / 1.4404, 140 HB | H690 p.541 (flipbook p.543), https://www.iscar.com/Catalogs/Publication/Catalogs_Mm/english_1/MILLING_Catalog/Flipview-MILLING_CATALOG/files/page/543.jpg ; MINI-TANG-SLOT p.384 (flipbook p.386), https://www.iscar.com/Catalogs/Publication/Catalogs_Mm/english_1/MILLING_Catalog/Flipview-MILLING_CATALOG/files/page/386.jpg |
| ISCAR | PCD/CBN milling, `iscar-milling-p618-pcd-cbn-adkt.json` (2 rows) | austenitic stainless steel; 316L / DIN 1.4404, 140 HB | p.618 (flipbook p.620), https://www.iscar.com/Catalogs/Publication/Catalogs_Mm/english_1/MILLING_Catalog/Flipview-MILLING_CATALOG/files/page/620.jpg |
| YG-1 | TitaNox, `yg-1-titanox.json` (6 rows) | Stainless steel (SUS 316, 316, X5CrNiMo 17 12 2) (VDI 3323 14.1) | p.32, https://www.yg1usa.com/downloads/YU-TP26_TitaNox.pdf#page=32 |
| M.A. Ford | GP end mills, `m-a-ford-maford-mill-gp-metric.json` (8 rows) | Difficult to Machine (302B, 304B, 309, 310, 316, 316B, 316L, 316Ti, 317, 317L, 321, PH13-8Mo, Nitronics). 304B is not 304. The list is not a pure 316 number; the card shows this wording. | p.244, https://www.maford.com/SiteContent/Documents/2024_catalog/MA%20Ford%20GP%20End%20Mills%20metric%20speeds%20and%20feeds.pdf |

YG-1 Prime Tap is **not** in this list. Its line is "Stainless steel, austenitic · examples SUS 316…", so it stays a group row on both grades.

## 304 printed without 316

These stay on `ss304` and are not copied to 316. Representative lines (300 rows, 27 wordings):

| Brand | File | What the source prints | Cite |
|---|---|---|---|
| Kyocera | `kyocera-mill-mfh.json` (70) | Austenitic Stainless Steel (SUS304) — no `etc.`, no 316 | p.8 (PDF p.9), https://global.kyocera.com/prdct/toolsp/digital/en/assets/pdf/MFH_EN.pdf |
| Union Tool | `union-tool-mill-cesus.json` (42) | STAINLESS STEELS SUS304 | p.4, https://www.uniontool.co.jp/assets/pdf/catalog/em-cesus_vol2.pdf#page=4 |
| Guhring | `guhring-tap.json` (4) | Stainless, austenitic (304) | https://guhring.com/media/speedfeed/3909.pdf (page not stored on the row) |
| Iscar | `iscar-mill-h690-tnkx-p541.json` | austenitic S.S., 304L / 1.4306, 200 HB | p.541, same milling catalog as the 316L line |
| ISCAR | `iscar-ffq-17-fast-feed-mill.json` (8) | Austenitic stainless steel, 304L | p.1, https://www.iscar.com/eCatalog/Ecat/datafileENM/INFO/MILL4FEED_17.pdf |
| OSG | `osg-mill-catalog-v2.json` | Stainless Steel … 304 (side mill / slot). One line also names 4140/4340. No 316. | pp.1389–1392, 1420, 1438, https://osgtool.com/content/literature/8002024CA/ToolingSolutionsProductCatalogVol1.pdf |
| M.A. Ford | `m-a-ford-maford-mill-gp-metric.json` (8) | Moderately Difficult (301, 302, 303, 304, 304L, 305, 420, 15-5PH, 17-4PH, 17-7PH). Not copied to 316. | p.244, same GP chart |
| Tungaloy | several mill/turn files | SUS304 / X5CrNi18-9, etc. The `etc.` does not print 316, so these stay on 304. | e.g. `tungaloy-mill-standard-conditions-2.json` p.13, https://tungaloy.com/wpdata/wp-content/uploads/385.pdf |
| Dormer Pramet | `dormer-pramet-mill-endmills.json` (36) | Austenitic stainless steel (303Se, 304H, 304L…) 200-260 HB. The ellipsis is not read as 316. | pp.14–15, https://5wyuco84ao39w9tsgkkmnmx.blob.core.windows.net/cms/Dormer_EndMill_Brochure_EN.pdf |
| Garr Tool | `garr-tool-milling-general.json` | 300 series stainless (304L, Nitronic 50, Duplex, Super-austenitic). Duplex is in the list and 316 is not. | p.290, https://www.garrtool.com/doc/pdf/tech/TECH_MILLING_GENERAL_f.pdf |
| Shop record | `shop.json` (1) | 304 stainless (shop record) | not a manufacturer page |

## Lumped rows that stay on both grades

2,565 rows. `sourceGroup` is unchanged, so the card shows the maker's group wording. Largest buckets:

| Brand | Rows | Example of what the source prints | Cite |
|---|---|---|---|
| Harvey Tool | 1732 | STAINLESS STEELS - 201 … 304, 304L … 316, 316L … 410, 420, 430 … | p.1 of each SF sheet, e.g. https://harveyperformance.widen.net/content/fwuiv5itqc/original/SF_11400.pdf |
| Emuge | 138 | M 2.1 Stainless austenitic (examples printed: 303/304/316/316L/321) | p.105, https://stoughtoolsales.com/Emuge-Franken-Literature/END-MILL/emuge_franken_cat420_web.pdf |
| Allied | 115 | Stainless Steel 300 Series (304, 316, 17-4PH, etc.) | p.B20: 58, https://alliedmachine.com/AlliedMachine/media/AlliedLiterature/Catalogs/AMPC/B20-CRT/B20-CRT_US-EN.pdf |
| Tungaloy | 113 | Stainless steel (Austenitic) SUS304, SUS316, etc. | DeepTri-Drill web table, https://tungaloy.com/product/hole-making/deeptri-drill/ |
| Kodiak | 101 | Stainless Steel (Austenitic): 200 Series, 302, 303, 304, 316 | p.202, https://www.kodiakcuttingtools.com/CarbideDrillSpeedsandFeeds.pdf |
| YG-1 | 24 | Only One `303/304/316/316L/410/416`, and Prime Tap "austenitic · examples SUS 316" | Only One PDF p.14, https://yg1usa.com/downloads/OnlyOne.pdf ; Prime Tap p.6, https://www.yg1usa.com/downloads/[YU-PT26]_Prime_Tap_USA_Single.pdf#page=6 |
| Sumitomo | 4 | Austenitic (X5CrNi18-10, X5CrNiMo17-12-2, X6CrNiTi18-10, etc.) | p.13, https://api.sumitomotool.com/media/roweb/publication/files/e/-/e-185_ac6020_6030_6135_6145.pdf |
| MAPAL, Carmex, Accupro, Hertel |  | "Stainless steels, austenitic" or "300 Series, Cold Drawn Austenitic" with no single grade | MAPAL milling p.78; Hertel HSS end-mill chart p.1 |

## Not copied to 316

| Brand | Rows | What the source prints | Why it stays off 316 |
|---|---|---|---|
| ISCAR | 70 | stainless steel and cast steel - austenitic, duplex | Austenitic and duplex are one row. 316 is not named. Deep-drill catalog p.91, https://www.iscar.com/Catalogs/Publication/Catalogs_Mm/english_1/DEEP_DRILLING_Catalog/DEEP_DRILLING_flipview/files/page/93.jpg |

The old id `ss304` is kept as 304, so this row still shows for 304, as it did for the lumped entry. It is not a 316 number.

## Hardness

No hardness is stored on the 304 or 316 picker entry. Printed hardness disagrees by row, and many rows print none: Iscar 304L is 200 HB and Iscar 316L is 140 HB on the same H690 page; YG-1's austenitic group line is 180 HB; MAPAL prints austenitic `< 700` (N/mm², not HB). Putting one hardness on the entry would filter rows out. The number stays in `sourceGroup`.

## Other lumped picker entries — left as they are

**Mild (A36, 1018), id `p-mild`.** Sandvik prints "Mild steel 1018" alone (CoroMill 390, p.1). A36 is not printed as its own row. Allied prints "Structural Steel (A36, A285, A516, etc.)". An A36 entry would be borrowed structural-steel numbers. Not split.

**Alloy (4140, 4340), id `p-alloy`.** 4140 and 4340 already have annealed and heat-treated entries (`4140-ann`, `4140-ht`, `4340-ann`, `4340-ht`). Not duplicated. `p-alloy` stays for family lines (`41xx`, `43xx`) and mixed lists.

**400-series stainless, id `ss400`.** 410, 416, 420, 430, and 440 are almost always inside one list ("400 series", "410, 416, 420", "martensitic"). OSG prints one "Stainless Steels 440" line and "Ferritic 430, 405". That is not a 304-vs-316 style split. Left lumped. Search aliases 410 and 416 still open `ss400`.

**303** stays `ss303`. A free-machining or sulphured line is not a 304 or 316 number.

**321 / 347.** No linked row names 321 or 347 alone. They show up inside lists that also name 304 and 316. No 321 entry. The 321 search alias stays on `ss304` (304), and the picker note still says it is not a separate 321 number. 304L stays on 304. 316L moves to 316.

## Id migration

`ss304` remains the id for 304. Favorites, recents, and `?mat=ss304` saved against the lumped entry still open 304. 316 is the new id `ss316`.
