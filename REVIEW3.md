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
- Note (pre-existing, not fixed): forcing a disabled brand option in the combo throws in fillTool (options[0] undefined).
