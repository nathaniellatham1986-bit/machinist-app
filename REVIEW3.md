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
