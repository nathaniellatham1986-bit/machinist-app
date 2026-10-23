# Backlog (not in v0)
In use: Allied Machine T-A spade drills (1C21T-0030 TiN); Iscar Tang-Grip grooving.
Quoted: Tungaloy AH6235; Sandvik VNMG 331-MF 1125; Kennametal KCU25; YG-1 DH500 drills; OSG WH70 drills, HY-PRO taps; Emuge taps; Harvey spot drills; ARCH boring bars.
Shop defaults to model: 135° cobalt drills; spiral-flute TiCN/TiAlN taps.
Modules: drilling, tapping, turning, grooving (add data/<brand>.json + module calc).
Data gaps: Iscar ECK-H4M vc; Sandvik Plura per-series data; Kennametal P/M grade-specific inch tables.

## v1 data gaps (manufacturer data only; no generic/handbook SFM or chip load)
- Iscar VNMG-NF IC807: feed/ap loaded, Vc not yet transcribed from Iscar grade tables (No manufacturer data shown).
- Iscar F3M IC806, CNMG, PENTA IC1008, Tang-Grip TGSU, threading IC908: not sourced.
- BC8110 is Mitsubishi (not Sumitomo); B215E has test conditions/charts only. Sumitomo BNC8115 loaded instead for hardened steel.
- Emuge tap speeds: not sourced. Guhring 3909 sheet covers stainless only.
- Allied coolant charts (pp.126-127) not transcribed; 303 not listed by Allied (not mapped).
- Generic carbide end mill and generic 135° cobalt drill removed per owner rule.

## Phase 3 (2026-10-23)
- Done: Iscar IC807 Vc (p.246), TGSU groove-turn Vc for IC807/808/908/830 (pp.432-433), IC908 threading Vc (pp.710-711), Mitsubishi BC8110 feed/ap/coolant (Tool News B215G), Allied through-tool coolant (A30 pp.126-127), Emuge Rekord 2-KEG R15-VA NPT SFM (Cat. 510).
- Gaps: IC806 P/M Vc, IC1008 PENTA Vc, BC8110 Vc, CNMG chipformer/grade, GEN2 coolant charts, 303 not in Allied's table, calculator spot-check (NOVO/CoroPlus need login; Allied's calculator is only a mobile app).
