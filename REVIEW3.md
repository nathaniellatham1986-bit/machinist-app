# Review #3 (Manufacturing Engineer, build 80bdf12) — plan and status
Approved by Nathaniel (App Build chat, 2026-10-25): items 1–12 and 16; #6 modified (Recall + Machine picker stay visible). NOT approved: 13, 14, 15, estimate follow-ups.
One commit per item. After each: validate.mjs, test.mjs, validate-machines.mjs, build-index, phone check (390×844), shots in /workspace/shots/review3/.

## Plan (short)
1. Brand change re-fills Type list (was only re-filling Series). kindOf: phrase rules (word-boundary 'boring', counterbore → Counterbore), not substring 'bor'.
2. Ranking: tools whose size range misses the entered Ø or lack data for the material sort last (mill + drill + bore); Brand list grays brands with no data for the material.
3. Material→row mapping table (alloy class + hardness band) used in matPref; audit script scripts/audit-materials.mjs, counts before/after.
4. Face uses Turn inserts; Pass with no rows falls back to Any with a note.
5. XCMT-MF out of turning; Harvey 7000xx → drill; Reamer / Counterbore types.
6. Setup section (Pass, Cut, Condition) collapsed with summary; order Material → Diameter → Brand/Tool; Pass hidden in Drill/Tap.
7. Groove/Part need a stock Ø first; warn when no machine max RPM.
8. Mode switch resets engagement/pass/cut to that mode's defaults (keeps material, coolant, machine).
9. Thread feed = pitch, shown as DERIVED from pitch.
10. Nearest options: 3 short chips + 'more'.
11. Tap opens on 1/4-20, thread picker first, tap drill on the result card (labelled source).
12. Display-name cleanup map (labels only).
16. One CALCULATED note under the cards.

## Status
| # | Commit | Result | Note |
|---|--------|--------|------|
| 1 | (see git) | PASS | Brand change re-fills Type; kindOf phrase rules. Mill>Sandvik: End mill/Insert only. |
| 2 | (see git) | PASS | Out-of-range / no-data tools never auto-picked (mill+drill; mill now has dr/dd in index). Brands without data grayed 'no data for this material'. |
| 3 | (see git) | PASS | MAT_CLASS table + HRB-aware hardness bands. Audit (scripts/audit-materials.mjs): 29,462 combos; default row names wrong class 6,222 → 2,332; avoidable 3,890 → 0 (rest: tool has only other-class rows). Guhring 205/206+4140 → Unalloyed heat-treatable; Helical P20 → Tool Steel 21–36 HRC; Ti-6Al-4V → Titanium Alloy. |
| 4 | (see git) | PASS | Face lists Turn-capable inserts and uses their turning rows (note shown). Pass with no rows → 'No Finish data for this tool — showing Any.' |
| 5 | (see git) | PASS | XCMT-MF turning/grooving entries removed (drill entry kept). Harvey 7000xx → Drill (feed/rev = printed chip load × 2 printed flutes, labelled). Reamer (16) and Counterbore (3 drill, 4 mill) types calculate from mfr rows. |
| 6 | (see git) | PASS | Pass/Cut/Condition (+nose/chipbreaker) folded into collapsed 'Setup' with one-line summary; order Material → Diameter → Brand/Type → Series; Pass hidden in Drill/Tap; Recall + machine picker unchanged. Results top 1,525 → 1,411 px (page 2,214 → 2,100), Mill/4140/Helical. |
| 7 | (see git) | PASS | Groove/Part: diameter label becomes 'Stock dia', field cleared (placeholder 'enter real stock Ø') and results replaced by 'Enter the real stock diameter first' until typed; bar says 'No machine selected — RPM not limited'. Sandvik part 4140 @2.5in → 477 RPM. Shots 7-part-ask-stock, 7-part-2.5. |
| 8 | (see git) | PASS | setMode resets frac.ae/ap, WOC 25 % / DOC 1×D inputs, Pass/Cut to Any; material, coolant, machine kept. Verified mill(60 %,0.3,Rough)→drill→mill = 25 %/1×D/Any, 4140 kept. Shot 8-mode-reset. |
| 9 | (see git) | PASS | Thread/tap feed card: label 'Feed = pitch (in/rev)', basis 'DERIVED from thread pitch (feed/rev = pitch = 1/TPI) — fixed by geometry, not missing data'. Walter thread 8 TPI → 0.1250. Shot 9-thread-feed. |
| 10 | (see git) | PASS | Nearest options: first 3 chips shown as 'brand series · size/material', rest behind 'more (n)' expander; full row label kept as tooltip; chip click unchanged. Walter thread 4140: 3 visible + 13 in more. Shots 10-nearest-3, 10-nearest-more. |
| 11 | (see git) | PASS | Tap opens on 1/4-20; Thread picker moved to the top (above Material) in Tap mode. New wide 'Tap drill' result card: manufacturer chart if the record prints one, else STANDARD chart (#7 (.2010), Drill-HQ 75%) with formula value, else 'DERIVED (standard formula)'; form taps show '—' + warning (75% drill is for cutting taps). Shots 11-tap-top, 11-tap-drill, 11-form-tap. |
| 12 | (see git) | PASS | Display-only label map NICE/nice() in calc.js (data + source citations untouched): bare 'Grades' (70 Iscar/Kodiak tools; root cause was a trailing comma after the grade was cut) → real series e.g. 'Groove-Turn inserts'; 'Turning insert grades · 2015 catalogue / Supplement 16.2/17.2/19.2 start values' → 'Turning inserts (pick grade below)'; 'X – Standard cutting conditions (for Y)' → 'X (· Y)'; 'Grades: A,B' in row labels → 'grade A / B'; 'List 16250' → 'List 16250 forming tap, HSS-Co'. Mitsubishi BTAH checked against Mitsubishi catalog D018–D019: back-turning holder for Swiss/gang tool posts using BTAT inserts → shown as 'BTAH back-turning holder'. OSG 'List NNNN' kept (real EDP codes). Shots 12-mitsu-names, 12-iscar-names. |
| 16 | (see git) | PASS | Per-card 'CALCULATED from the values above' tag removed; one note under the results: 'CALCULATED: RPM and feed rate are computed from the speed and feed above' (+ blue 'includes an ESTIMATE' when used, + 'No machine max RPM set — RPM not limited'). Blue 'uses an ESTIMATE' stays on RPM/IPM cards. Page now has exactly 1 'CALCULATED'. Shot 16-one-calc-note. |
| 13–15 | — | NOT DONE | Not approved by Nathaniel. |

## Estimate follow-ups
| A | Estimates borrow only from same end geometry (ball/bull/square; unknown → none) | PASS — 4097 → 1795 combos (−2302) | ui/12-A-ball-estimate.png |
| B | Estimates only for materials the tool's own records name (class-level: Ti rows don't qualify Inconel) | PASS — 1795 → 573 (−1222) | ui/12-B-multicut-in718-no-estimate.png |
| C | Saved favorite of an estimate setup recalls blue after reload | PASS — no code change needed (Recall label shows ESTIMATE; blue box restored) | ui/12-C-fav-estimate-recalled.png |
| D | Sources list flags close-size rows ("size … — close to your 1 in, not exact"), basis says "sizes close to yours" | PASS | ui/12-D-close-size-sources.png |
| Coolant/More | Coolant beside Machine profile at top; More removed (search box dropped, condition search + "only tools with data" moved into Setup, length/support under Dia in Turn) | PASS | ui/13-coolant-top.png, ui/13-turn-len-under-dia.png |
| Tap drill box | Drill-size box beside Tap dia (mfr → STANDARD → DERIVED; form tap without mfr drill → — + warning); full Tap drill card kept for source detail | PASS | ui/14-tapdrill-*.png |
| Iscar Turn bug | Brand-has-data used "SFM or feed" rows, series ranking used "SFM and feed in one record" → brands listed with no usable tool. One shared test (brandUsable); thread-turning counts SFM alone (feed = pitch). Audit 42 → 0 | PASS (Iscar Turn op has no complete record → now greyed; Groove/Thread usable) | ui/15-iscar-*.png |
| Common drill | Tap drill box shows nearest standard metric drill beside formula (M8×1.25: 6.78 mm · 6.8 mm common size, DERIVED) | PASS | ui/16-tapdrill-m8-common.png |
| ME 1 Harvey default | Reproduced live (Mill 4140 ann ½": Harvey 126xx, no data). Index gains per-tool `nm` (materials whose ISO group has data but no row fits, e.g. Harvey 4xxx rows are 29–37 Rc only); ranking + brand list use it; non-ferrous saws no longer count for steel. Harvey now greyed for 4140 ann; 4140 pre-hard defaults to 129xx with 200 SFM / .0015 | PASS | ui/17-1-harvey-default.png, ui/live/j2-mill-4140.png |
| ME 4 Nearest options | Reproduced live (Mill 4140 ann ½" Harvey: 3 identical "Harvey 126xx… · M STAINLESS STEELS - 203 E (other mat.)"). Chips drop the brand/series prefix (already on screen), add op + hardness, dedupe by shown text, same-ISO rows first → "P TOOL STEELS - D 38-45Rc (other mat.) · Slot / · Rough / · Finish". UI-only (no unit test) | PASS | ui/17-4-nearest.png, ui/live/L4-Harvey Tool.png |
| ME 5 Coolant/drill | Reproduced live (Drill ⅜" 304 Guhring 235/245 & OSG ADO: Flood = Through-tool, no note). Guhring/OSG records state no coolant → card now says "this catalog gives one speed and feed for all coolants". Where records differ by coolant (44 drill tools, e.g. Nachi AQDEXOHPLT Wet vs MQL) the default row follows the Coolant picker | PASS | ui/17-5-coolant-note.png, ui/17-5-nachi-flood.png, ui/17-5-nachi-air.png, ui/live/j3-drill-304.png |
| ME 7 Wrong-material rows | Reproduced live (Guhring 4140 "Tool steels" 1 row; Helical P20 "Carbon Steel" 2; Helical Ti-6Al-4V "Pure Titanium" 6, all in Condition list). Material match now requires !matBad; matBad ignores transcriber notes ("member alloy list not transcribed") that made Pure Ti look like an alloy. Local: 0 / 0 / 0 rows. 3 unit tests | PASS | ui/17-7-*.png, ui/live/L7-*.png |
| ME 8 Groove default | Reproduced live (Turn Groove 4140 ann Ø2 Iscar → GFQR face grooving). Face-grooving penalty .3 → 1.5 so an OD grooving tool with data wins; face tools stay listed. Now PENTA grooving IC1008 (Iscar box label 197–492 SFM). UI-only | PASS | ui/17-8-groove-default.png, ui/live/j-Groove.png |
| ME 9 Tap ranking | Reproduced live (Tap 1/4-20 mild steel, Iscar → "HSS-E form B lead, M (stainless)"). Root cause: "(stainless)" was our guess that ISCAR color code M = ISO M; ISCAR p.408 says it is the tap color code (ring colour). Label now "color code M". Ranking by material NOT done: the only evidence is the p.409 Recommended/Suitable dots, which were not captured in data ("suitable dots not captured") | PARTIAL | ui/17-9-tap-label.png, ui/live/j4-tap-1420.png |

| ME 6 | — | NOT REPRODUCIBLE | Live Iscar Groove (4140, 304, no material): list shows GFQR, MIFR×3, PENTA; no XCMT. | ui/live/L6-groove-iscar.png |
| estimate (a) | a80ca92 | PASS | byDiameter never uses a larger published Ø. | test.mjs |
| estimate (b1) | 0097bdc | PASS | range feed only when size covers or is smaller (nearSize accepted larger). | test.mjs |
| estimate (b2) | 782d386 | PASS | Bands all numeric and non-overlapping, but 683 shared edges: Ø on an edge now takes the lower value. | test.mjs |
| estimate (b3) | see log | PASS | fpt close flag uses f.at. | test.mjs |
| Number check: Guhring 235/245 in 304 | — | REPORT | 25 SFM/.005 IPR is from 235.pdf "Stainless, sulphured (HRC<28)"; austenitic row blank; 245 has no stainless data but is merged with 235. Not fixed. | — |
| Number check: Iscar VNMG-NF IC807 304 | — | REPORT | 656 SFM = low end of 200–300 m/min; feed shows .0032 vs range text .0031 (rounding). No change. | — |
| Iscar Turn no data (reopened) | c9f2506 | PASS (audit) | Root cause: the old audit asked "has this brand usable data anywhere in Turn mode", and Iscar passed on its Thread rows. The picker ranks each tool per operation. In the data, Iscar/Kennametal/Kyocera turning speed (grade table) and feed (insert page) are separate records, and a usable row needs both. scripts/audit-picker.mjs now uses the picker's own dataRank. | test.mjs, audit-picker |
| Iscar Turn speed+feed pairing | c52e2f3 | PARTIAL | Pairs only inside one tool record (VNMG-NF IC807: p.246 speed × p.165 feed). The card is labeled PAIRED BY THIS APP with both pages. Iscar Turn 4140/mild 0/44 → 1/44. Other Iscar tools hold speed only or feed only (no grade named), so they can't be paired honestly. Iscar prints no "4140"/"1018"; the mapping is group 6 "low alloy annealed" / group 1 "non-alloy <0.25%C" (the 4140/mild-steel notes are our own). For 4140, an alloy row now ranks above a non-alloy row. | test.mjs, shots/ui/18-* |
| Honest no-data labels | 29c1451 | PASS | Tool list says "speed only, no feed printed" (Kennametal/Kyocera Turn) or "feed only, no speed printed" (Iscar Part 65/66). | test.mjs, shots/ui/19-* |
| ME1 default without data at Ø | 94c10fc | PASS | A tool is never auto-picked without manufacturer data at the entered Ø (all brands, mill/drill). Dormer 17-4 at 1/2": no Dormer tool has M data at 0.500, so the header says so. 12 mm → S116 with data. | test.mjs, shots/ui/20-* |
| ME2 estimate sources repeat | 517230c | PASS | Each tool is listed once (its lowest row). | test.mjs, shots/ui/21-* |
| ME3 Thread before TPI | d928b32 | PASS | Shows "Enter TPI". | test.mjs, shots/ui/22-* |
| ME4 Guhring sulphured row in 304 | 6bd1837 | PASS | Labeled NOT A 304 NUMBER / 303 type (card, SFM basis, condition list). | test.mjs, shots/ui/23-* |

## Dia group after Brand/Type (approved single change, 2026-10-25)
Mill/Drill: Published diameters + Tool dia + Flutes now sit after Brand/Type, before Series; list = every published size of that brand+type (all series, deduped, `ps` index field), narrowed to sizes with data for the material when Only-tools-with-data is on. Picking a size re-ranks Series (94c10fc no-auto-pick kept). Tap: after Tap type (tdBox stays beside Tap dia). Turn/Bore: unchanged position (workpiece/bore measure). PASS — shots/ui/dia/.

## Tool library buildout: Niagara + Accupro (2026-10-25)
- Niagara Cutter (data/niagara-mill.json): 24 series, 319 rows from Navigator Niagara Solid Milling Catalog 2023.1 (iPaper HTML text; PDF not used, robots disallows *.ashx). Only the 18 START VALUES tables that pass vc=n·πD/12 and vf=n·fz·Z self-checks were loaded; ~46 other tables skipped (PARTIAL). ISO P/M/K/S/H only — no N (aluminum) tables passed, so Niagara is off for aluminum. SMG codes only, no alloy links (like Seco). No coating, no ap/ae stored.
- Accupro (data/accupro-mill.json): 3 families, 285 rows from MSC Accupro technical PDF (2014-12-19, pp.5–16). Flutes not stated. 25 rows flagged in-note where a printed chip load is out of sequence (copied as printed). Aluminum "1200+"/"600+" SFM stored as start. One p16 row with no printed hardness skipped. 304L rows are labelled as printed; 303 stays its own link.
- PASS: validate, test.mjs, r3.sh, picker at 390x844 (shots/ui/niagara, shots/ui/accupro), Find this tool builds MSC search for both.
- Fixed: forcing a disabled brand option no longer throws in fillTool (options[0] guard).
- Accupro rows printed >32 / >42 HRC (74) are not linked to any app material (no hardness-matched material exists); guarded by test.mjs.
- Accupro (MSC catalog, same PDF Nathaniel supplied): added drills (p1 colour band 24 rows; pp3-4 Non-coolant/Coolant FED chart 372 rows as 6 diameter-band tools), taps (p1, 25 rows, SFM only) and thread mills (p2, 5 rows). Skipped: p1 Free Cutting stainless drill (speed printed reversed "40 -27"). Flagged in notes, copied as printed: p1 drill 0.001 (Free Cutting Mild Steel, 3/8), 0.0011 (Brass Soft, 5/16), Pure Copper blank Tons/sq.in; p4 Austenitic 5/8-3/4 band starts below 1/2-5/8; p4 ISO-P printed for High Temp Alloys (loaded as S). "Over 35 Rc" rows not linked to materials (test.mjs guard).
- Fixed: Accupro Drill with 4140 showed the p1 Green Band "Free Cutting Mild Steel <120 HB" row. Cause: calc.js matchMat let materials with a grade regex (4140-ann etc.) fall through to ISO-group matching on any row (no materials, or materials that don't include them). Accupro drill/tap/thread mill rows now set strictMaterials: they match only their own materials list or a printed grade name. "Under 35 Rc" now reads as a ceiling. Every other brand's material-to-row matches are unchanged (per-row diff 0; audit-picker identical). Unmatched materials (e.g. 4140 on the color-band drills, all thread mill rows, 303 on taps) show "No manufacturer data".

## Accupro end mills strict (e314f03)
- All 285 rows in data/accupro-mill.json now carry strictMaterials; the 40 existing links are unchanged. No ISO-group fallback anymore.
- Match diff: 0 non-Accupro lines changed; 218 Accupro mill rows lost group matches. Picker: only Accupro changed (14 combos dropped mill coverage: 4140-ann/ht, 4340, p20, h13, brass-c360, cast irons, 17-4, 303, ti64, in718).
- 390x844 shots (shots/ui/accupro/mill_*_strict.png): mild → "Low Alloy Steels Maraging--10XX, 11XX, 13XX <32 HRC" 100 SFM / .0030; 304 → "Austenitic--200 Series, 302, 303, 304L, 316L <32 HRC" 100 / .0025; 6061 → "Aluminum Alloys--2024..6061-T6/T651.. <32 HRC" 800 / .0060; 4140 annealed → Accupro not offered (no linked row; "41xx" rows not linked to 4140).

## Accupro end mills: 4140/4340 annealed links (3764e92)
- 9 p.8 "Alloy Steels: 40xx, 41xx, 42xx, 43xx, 44xx, 46xx, 86xx Series · <32 HRC" rows → +4140-ann, +4340-ann. p.5 "High Strength Steels--4340, 6150, 52100, H-11, H-13 · <32 HRC" → +4340-ann (no 41xx printed, so no 4140). Row notes cite the wording. strictMaterials kept; no 4140-ht, no >32/>42 rows.
- Match diff: only those 9 rows changed (+4140-ann,+4340-ann named); the High Strength row already matched 4340-ann/4340-ht by name. Picker: only Accupro mill 4140-ann 0/3→1/3, 4340-ann 1/3→2/3.
- Shots: 4140 ann → HP Progressive Helix, Shallow Slotting <32, 180 SFM (180–220) / .0028, p.8; 4340 ann → General Purpose, High Strength <32, 150 (150–250) / .0024, p.5; mild unchanged 100 / .0030 p.5.

## Plan: material-borrowed ESTIMATE (2026-10-27) — STOPPED before build, needs a decision
Intended design: a class table in estimate.js (id → family, gummy flag; ISO and hardness from data/materials.json), one pure `borrow()` called only after the existing estimate returns null, same tool record only, mill/drill/tap only (never turn/bore), lowest low-end of the harder/slower lender, blue ESTIMATE card "Estimated from [material, hardness, page]"; tool list labels borrowed combos "— estimate only" and picker defaults never pick them.
Hole count measured first (/tmp/holes.mjs, every mill/drill/tap tool × each of our 20 materials with no row): 26,918 no-data combos.
- Rules as agreed, classifying only materials both in the brief and in materials.json: **0 combos filled.** Only 8 materials carry hardness data (H13, P20, 4140, 4340 ann/ht); of those only 4140-ann/4140-ht are classified, and that pair is refused.
- Adding 4340-ann/ht as non-gummy alloy (not in the brief): 2 (Accupro General Purpose: 4140-ann←4340-ann, 4140-ht←4340-ht; the second rests on the open 4340-ht question).
- Also treating "no hardness on either side" as a match: 5 (adds gray↔ductile iron on Hertel HSS and Sandvik CoroMill 390).
Also: our materials list has no separate 316/316L/321 (ss304 = "304, 316"), so the 304↔316 test case cannot exist in the app.

## Rung 3 (other maker's number, same tool class): count and plan, 2026-10-27

Approved by Nathaniel ("go", App Build room) for the count and the plan only. Nothing is built. Counter: /tmp/r3/r3.mjs (read-only, uses calc.js matchMat/matBad/kindOf/endGeom/tapTypeOf/gradesOf/rowDia/sizeRange).

Guards as counted: different brand; same mode (mill/drill/tap only) and kindOf; same end geometry (mill) or tap type (tap); same substrate (carbide/HSS) from the tool's own text; same coating class (uncoated, TiN, TiCN, Al-based, diamond/DLC, ZrN/TiB2); flutes within 1 (end mills, thread mills); a source row size in the same size band (<1/8, 1/8–1/4, 1/4–1/2, 1/2–1, ≥1 in); material by strict named match only (matchMat = 'named', not matBad, 303/304 rule from estimate.js); catalog/label rows only; lowest SFM low end, with feed from the same row. Coolant is checked at runtime against the chosen mode, so these counts are an upper bound before coolant.

### (a)/(b) Counts (holes = 26,918 tool × material combos with no row)

| Scenario | Filled | Still holes |
|---|---|---|
| All guards, as agreed | **0** | 26,918 |
| Same, but unknown substrate is assumed carbide | **0** | 26,918 |
| Substrate guard kept, flute/coating/end-geometry guards dropped | 2,896 | 24,022 |
| Upper bound: assume carbide and drop the flute/coating/end-geometry guards | 12,284 | 14,634 |

Why the agreed guards fill 0: the data doesn't hold the fields the guards check.
- Substrate is unknown for 22,252 holes. There's no substrate field, and tool text names carbide or HSS for only about 20% of tools. Harvey (663 tools), FRAISA (269), Guhring (155), Accupro, Niagara, Union Tool and MAPAL never say it.
- Flutes: only 456 of 3,189 tools carry `flutes`.
- Coating: only 44 tools carry `coating`, and `grade` is mostly insert grades.
- End geometry is unknown on 6,192 end-mill holes.

Relaxed scenario, 2,896 filled, by type: Drill 746, End mill (geometry unknown) 2,094, Thread mill 31, ball 15, bull 10, Tap 0. By material: plastic 341, al6061 229, h13-hard 221, ss400 180, ti64 180, ss17-4ph 175, ductile 185, in718 170, gray-iron 169, ss303 150, ss304 139, p20-pre 95, p-mild 94, p20-ann 90, 4140-ann 89, 4340-ann 88, p-alloy 74, 4140-ht 71, 4340-ht 70, h13-ann 86, brass 0.

Upper bound, 12,284 filled, by type: Drill 2,436, End mill (unknown geometry) 4,629, bull 1,964, ball 1,076, square 931, Thread mill 654, indexable "Insert" mills 578 (these should be excluded, same as turning), Reamer 14, Counterbore 2, Tap 0. Taps fill 0 in every scenario because no other maker's tap row passes the strict match and tap-type guard.

### (c) Examples (relaxed scenario, the source row the counter picked)
1. Accupro Color Band drill (Blue) × p-mild ← OSG NEXUS GDS/GDR "Steels 1035, 1045", 60 SFM low, OSG Tooling Solutions catalog p.350
2. same × p-alloy ← OSG VPH "Alloy Steels 4140, 4330", 30 SFM, p.342
3. same × ss303 ← Kyocera SGS 2 Flute Drills 101 "Free machining 303, 416…", 88 SFM, 2023 Global Catalog p.344
4. same × ss17-4ph ← SGS 101M/108M "304, 316, 321, 13-8, 15-5, 17-4, Custom 450 ≤40 HRc", 43 SFM, p.346
5. same × ss400 ← Guhring 280/281 "martensitic HRC<46", 20 SFM, chart p.1
6. same × al6061 ← OSG MAX-MINI WX-MS "Aluminum 6061, 7075", 100 SFM, p.332
7. same × gray-iron ← SGS Hi-PerCarb 141K 5D "Gray cast iron ≤220 Bhn", 91 SFM
8. same × ti64 ← OSG HELIOS 10D/15D/20D "Ti-6Al-4V", 20 SFM, p.348
9. same × in718 ← Tungaloy deeptri-drill "Inconel 718 · AH725 · ø14–18", 66 SFM (product page)
10. same × 4340-ann ← OSG V-Select "Alloy Steels 4140, 4340", 40 SFM, p.349
11. Allied AccuThread 856 thread mill × ti64 ← Kodiak High Performance Thread Mill "Titanium 6Al-4V", 80 SFM, p.222
12. Dormer S129 end mill (4 fl) × al6061 ← Garr TMS/TMR "Aluminum 6061-T6", 300 SFM, p.304
13. Dormer S108 end mill (2 fl) × h13-hard ← Kyocera SGS Power-Carb 57 "Tool steels … ≤65 HRc · Slot", 52 SFM, p.117
14. Carmex CR-Supercut (aluminum end mill) × ti64 ← OSG AE-VML multi-flute "Ti-6Al-4V", 65 SFM, p.1341

### (d) Risky pairings seen
- **Purpose-built tools get numbers for materials they're not made for** (example 14: an aluminum-only end mill gets a titanium number). We need a guard: borrow only into materials the target tool's own maker lists for that tool. This is estimate.js `ownNames` rule B.
- **Flute mismatch**: 745 upper-bound fills cross flute count by more than one, or one side is unknown (example 13: a 2-flute tool takes a row whose flute count isn't stated).
- **Hardness collapses**: rows without a printed hardness ("Alloy Steels 4140, 4330") would fill both 4140-ann and 4140-ht, and both 4340-ann and 4340-ht, with one number. Heat-treated targets should require a printed hardness on the source row.
- **Wide hardness bands**: "≤65 HRc" covers both H13 annealed and hardened.
- **Insert-type mills** pass kindOf as "Insert" (578 fills). Their numbers depend on insert grade, just like turning, so exclude them.
- **Multi-grade stainless rows** (304/316/321/17-4) fill 17-4 PH. That's a named match, but 17-4 annealed versus H900 isn't separated.
- **Accupro Color Band drills** were classed as carbide only from note text. Their substrate needs checking against the catalog.

### (e) Plan (not started)
1. **Data commit (the main job).** Add `substrate`, `flutes` and `coatingClass` to each tool, transcribed only from the maker's own page and cited. Leave a field unset rather than guess. Validator: enum check. Also add `endGeom` where the series name doesn't say it. Until this is done, rung 3 fills 0 under the agreed guards.
2. **Logic commit.** In estimate.js, add `borrowOtherMaker()` with the same signature as `estimate()`, called in calc.js only after the maker row, then `estimate()`, then the borrowed-material estimate all return nothing. Guards as listed, plus: ownNames, no insert/turn/bore/part-off, coolant match (`coolModes`), feed via `feedLow` (never from a larger Ø), DOC/WOC from the same row, with the lower value kept. Use a kill switch (`RUNG3_ON`). Results are never written to recall or saved setups as maker data.
3. **UI commit.** Purple value and the label "Starting point, work up from here. From [Brand, series, page], not this maker's number. Check with your tool's maker." Amber and red overrides stay unchanged.
4. **Tests.** Before and after: 0 existing rows and 0 existing estimates change. 10+ spot checks. 303 never comes from a 304-only row. No turning, boring or part-off results. Coolant mismatch refuses. A 2-flute target never takes a 6-flute row. An aluminum-only tool never gets ti64. Screenshots.
5. **Effort.** Step 1 is the bulk, about 3,200 tools across 36 brands from their own catalogs, and it's a library-sized data job. Steps 2–4 are small, roughly one session.

Rung 4 (generic chart) remains NOT approved. After rung 3, the honest remaining holes are an estimated 14,634+ (upper bound), mostly brass, taps, and tool/material classes no other maker prints.

## Everyday-materials coverage matrix (Step 1, read-only), 2026-10-28

Approved by Nathaniel ("Go", App Build room). Nothing was tagged or loaded. Counter: /tmp/r3/cov.mjs.

Method:
- Only catalog or label rows with an SFM count. Estimates and shop-proven rows are left out.
- A row counts for a material if the app's own `matchMat` matches it and `matBad` doesn't reject it, with the 303/304 rule from estimate.js.
- Tool types come from `kindOf`: End mill, Drill, Tap and Thread mill. Turning, boring, part-off, insert mills, reamers and counterbores are left out.

Each cell shows **brands with a cited number**, then (brands whose row names the grade itself) in brackets. The rest match through the ISO group, which the app accepts. ⚠ marks a thin cell (0–1 brands).

| Material | End mill | Drill | Tap | Thread mill |
|---|---|---|---|---|
| 1018 / mild (p-mild) | 28 (13) | 16 (7) | 5 (3) | 8 (3) |
| 4140 annealed | 26 (7) | 13 (6) | 4 (2) | 7 (2) |
| 4140 pre-hard 28–40 HRC | 26 (7) | 16 (7) | 3 (1) | 8 (2) |
| 304/316 (single entry) | 11 (11) | 9 (9) | 3 (3) | 3 (3) |
| 17-4 PH | 24 (14) | 14 (7) | 3 (2) | 7 (3) |
| 6061 | 18 (5) | 12 (4) | 3 (2) | 6 (2) |
| Gray iron | 21 (16) | 12 (9) | 3 (2) | 6 (3) |
| Ti-6Al-4V | 19 (10) | 8 (5) | 2 (0) | 8 (1) |
| 303 | 5 (5) | 2 (2) | 2 (2) | 2 (2) |
| Brass C360 | 15 (0) | 9 (0) | **1 (0) ⚠ Iscar only** | 6 (0) |
| Ductile iron | 20 (15) | 12 (10) | 3 (2) | 6 (4) |

Only one cell is thin by the 0–1 rule: brass taps. Near-thin cells (2–3 brands):
- **Taps:** 4140 pre-hard (Iscar, OSG, Walter), 304/316 (Accupro, Guhring, YG-1), 17-4 (OSG, Walter, YG-1), 6061, gray iron and ductile iron (Accupro, Iscar, OSG each), Ti-6Al-4V (Iscar, OSG), 303 (Guhring, YG-1).
- **Thread mills:** 304/316 (Allied, Harvey, Kodiak), 303 (Allied, Harvey).
- **Drills:** 303 (Kodiak, Kyocera SGS).

Brass is never printed as a named grade; it always matches through the N group. The Ti-6Al-4V tap cells also rest on group matches.

**304/316 single entry.** `ss304` reads "Stainless, austenitic (304, 316)". Because of the 303/304 rule, only rows that name 304 or 316 count, which is why its cells are smaller (11/9/3/3) than 17-4's. 316 has no row or hardness of its own, so a 316-only row and a 304-only row both feed the same entry. Splitting it into separate 304 and 316 entries is a data job. Do it only where a maker prints the two separately, so each entry's count would likely shrink. No combos change until then.

### Tools that supply these cells: fields recorded vs missing (1,794 tools)
Recorded means stated in the tool's own fields or text. End shape applies to end mills only.

| Brand | Tools | Substrate | Flutes | Coating | End shape (of end mills) |
|---|---|---|---|---|---|
| Harvey Tool | 495* | 2 | 27 | 0 | 385/460 |
| OSG | 291 | 62 | 46 | 7 | 18/75 |
| FRAISA | 183 | 0 | 152 | 0 | 165/183 |
| Guhring | 152 | 1 | 2 | 1 | 3/23 |
| Seco | 125 | 5 | 0 | 0 | 0/105 |
| Kyocera SGS | 69 | 68 | 24 | 0 | 0/53 |
| Walter | 67 | 61 | 0 | 5 | 0/1 |
| Iscar | 52 | 29 | 0 | 11 | 0/17 |
| Dormer Pramet | 51 | 51 | 46 | 0 | 0/51 |
| Emuge | 50 | 47 | 8 | 3 | 13/47 |
| Helical | 43 | 43 | 0 | 0 | 0/43 |
| Mitsubishi | 33 | 31 | 25 | 0 | 0/29 |
| Niagara | 24 | 0 | 24 | 0 | 20/24 |
| Korloy | 21 | 21 | 21 | 0 | 0/21 |
| Kodiak | 20 | 10 | 11 | 9 | 0/14 |
| Tungaloy | 19 | 2 | 1 | 0 | 0/1 |
| Accupro | 17 | 0 | 0 | 1 | 0/3 |
| YG-1 | 12 | 12 | 10 | 2 | 2/11 |
| MAPAL | 10 | 0 | 0 | 0 | 0/10 |
| Kennametal | 8 | 7 | 5 | 2 | 0/6 |
| Allied | 7 | 5 | 0 | 1 | 0/0 |
| Others (Garr 6, Sumitomo 6, Carmex 5, Lakeshore 5, Nachi 4, M.A. Ford 3, Kyocera 2, Sandvik 2, Data Flute 1, Hertel 1) | 35 | – | – | – | – |

\*Harvey is about 505 tools. About 10 more appear as stray keys in the raw output because a counter bug splits on a "#" inside their series names.

Totals: substrate ~570 of 1,794 recorded, flutes ~430, coating ~45. Coating is the biggest gap. End shape is recorded for about 600 of 1,270 end mills.

### Recommended tagging order
1. **Shop brands from memory:** Kennametal (8), Iscar (52), Guhring (152), Allied (7), Sumitomo (6) and Sandvik (2). These total about 227 tools and are the tooling the shop actually runs. Guhring is the main gap: substrate, flutes and coating are all almost entirely missing.
2. **Quoted brands:** OSG (291), YG-1 (12), Emuge (50), Harvey (~505), Tungaloy (19) and Mitsubishi (33). OSG and Harvey hold most of the depth. Harvey needs coating and substrate, and Harvey is all solid carbide per its catalog, but that must be cited.
3. **Tap and thread-mill depth** (the near-thin cells): taps from Accupro, OSG, Walter and YG-1; thread mills from Allied, Harvey and Kodiak.
4. **Deep end-mill brands last:** FRAISA, Seco, Kyocera SGS, Helical, Dormer and the rest.

This covers about 1,794 tools rather than ~3,200. Steps 1–2 total about 1,100 tools.
