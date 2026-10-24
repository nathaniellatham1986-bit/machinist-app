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
- v3/v4 UI: material -> brand -> tool chain with a data filter, machine profiles (localStorage), turn nose radius/chipbreaker, DOC range warning, slender L/D>4 warning (general guideline), source badges, favorites/recents, remembered coolant and machine. Data: Iscar box labels (PENTA IC1008, VNMG 12T308-NF ISO M), a separate shop-proven record type (shop.json).
- Open: BC8110 is a Mitsubishi grade per Sumitomo's own comparison chart. No Sumitomo BC8110 data exists, so it was kept as Mitsubishi.

## v6 (schema 1)
- Brand files split per brand and mode, with the canonical conditions shape. The legacy mill shape is gone (scripts/migrate-legacy-mill.mjs).
- data/SCHEMA.md, scripts/validate.mjs and scripts/build-index.mjs added. The index and SW cache name are generated.
- Data files lazy-load, and the tool picker has search (cross-brand, capped at 300 options).
- Specific materials (data/materials.json): 303 and 304 are split, each record is mapped to what its source names, and the badge shows the source's group wording.
