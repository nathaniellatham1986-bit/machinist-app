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
