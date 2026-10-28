import assert from 'node:assert/strict';
import fs from 'node:fs';
import { compute, rpm, thinFactor, drill, turn, tap, pick } from './calc.js';
const J = p => JSON.parse(fs.readFileSync(new URL(p, import.meta.url)));
const IDX = J('./data/index.json'); const ALL = m => IDX.files.flatMap(f => J('./data/' + f.file).tools).filter(t => t.mode === m);
assert.equal(Math.round(rpm(400, .5)), 3056);
assert.equal(+thinFactor(.05, .5).toFixed(3), 1.667);
compute({ sfm: 400, d: .5, fpt: .003, z: 4, ae: .25, ap: .5, stickout: 1.5, maxRpm: 10000, maxHp: 15, iso: 'P' });
// pick: start preferred, midpoint labeled, single value, nothing invented
assert.deepEqual(pick({ min: 50, start: 100, max: 150 }).def, 100);
assert.match(pick({ min: 40, max: 80 }).basis, /MIDPOINT/); assert.equal(pick({ min: 40, max: 80 }).def, 60);
assert.equal(pick({ value: 230 }).basis, 'manufacturer value');
assert.equal(pick({ min: 40 }).def, 40); assert.equal(pick({ min: 40 }).max, null); // min-only: source minimum, nothing invented assert.equal(pick(null), null);
// drill: Allied T-A carbide TiN, 4140 175-225 BHN, 15/16" (1C21T-0030): 230 SFM, .012 IPR
const ta = J('./data/allied-drill.json').tools[0].conditions.find(c => c.label === 'Alloy 4140/5140/8640 175-225 BHN · TiN');
assert.equal(ta.sfm.value, 230); const band = ta.feed.bands.find(([a, z]) => .9375 >= a && .9375 <= z); assert.equal(band[2], .012);
const dr = drill({ sfm: 230, d: .9375, ipr: .012 }); assert.equal(Math.round(dr.rpm), 937); assert.equal(+dr.ipm.toFixed(2), 11.25);
// turn: RPM cap and MRR
const t = turn({ sfm: 328, d: 2, ipr: .00984, ap: .04, maxRpm: 500 }); assert.ok(t.capped); assert.equal(t.rpm, 500);
assert.equal(+t.mrr.toFixed(3), +(500 * 2 / 3.82 * 12 * .04 * .00984).toFixed(3));
// tap: 1/4-20 at 60 SFM -> 917 RPM, IPM = RPM/20
const tp = tap({ sfm: 60, d: .25, pitch: .05 }); assert.equal(Math.round(tp.rpm), 917); assert.equal(+tp.ipm.toFixed(2), 45.84);
const th = J('./data/threads.json').threads; assert.equal(th.find(x => x.name === '1/4-20').drill75_in, .2013); assert.equal(th.find(x => x.name === 'M6x1').drill75_mm, 5.03);
// every loaded condition has a source and a feed/speed or explicit absence; no generic tools
for (const m of ['drill', 'turn', 'tap', 'mill']) for (const tl of ALL(m)) { assert.ok(!/generic/i.test(tl.brand)); for (const c of tl.conditions) assert.ok(c.source?.url || ["label","shop"].includes(c.source?.kind), tl.series); }
assert.ok(!IDX.files.some(f => /generic/i.test(f.file + f.brand)));
{ const { validate } = await import('./scripts/validate.mjs');
  const good = { schema: 1, brand: 'X', tools: [{ mode: 'drill', brand: 'X', series: 'S', conditions: [{ label: 'L', iso: 'P', status: 'verified', coolant: null, sfm: { min: 1, max: 2, unit: 'ft/min' }, feed: { kind: 'ipr', unit: 'in', range: { min: .001, max: .002 } }, source: { kind: 'catalog', manufacturer: 'X', catalog: 'C', edition: 'E', url: 'https://x' } }] }] };
  assert.deepEqual(validate(good), []);
  const bad = (f, re) => { const d = structuredClone(good); f(d.tools[0].conditions[0], d); assert.ok(validate(d).some(e => re.test(e)), re); };
  bad(c => delete c.source.url, /url/); bad(c => delete c.coolant, /coolant/); bad(c => c.sfm.unit = 'sfm', /unit/); bad(c => c.status = 'derived', /derivation/);
  bad(c => c.status = 'guess', /status/); bad(c => delete c.source.edition, /edition/); bad(c => c.source.kind = 'shop', /shop/); bad(c => c.sfm.min = 9, /min/); bad((c, d) => d.brand = 'Generic', /generic/); }
console.log('all tests pass');
const TJ = ALL('turn');
const thr = TJ.find(x => x.series === 'Threading IC908').conditions.find(c => c.label.startsWith('Grp 6')); assert.deepEqual([thr.sfm.min, thr.sfm.max], [100, 180]);
const nf = TJ.find(x => x.series === 'VNMG-NF IC807').conditions.find(c => c.label.startsWith('Grp 14')); assert.deepEqual([nf.sfm.min, nf.sfm.max], [100, 200]); assert.match(pick(nf.sfm).basis, /MIDPOINT/);
assert.equal(TJ.find(x => x.series.startsWith('BC8110')).conditions[0].sfm, null);
const em = ALL('tap').find(x => x.brand === 'Emuge').conditions.find(c => c.label.startsWith('P2.1')); assert.deepEqual([em.sfm.min, em.sfm.max], [7, 20]);
assert.equal(J('./data/allied-drill.json').tools[0].conditions[0].coolant, 'through-tool');
console.log('phase3 tests pass');
const sh = J('./data/shop.json').tools[0].conditions[0]; assert.equal(sh.status, 'shop-proven'); assert.notEqual(sh.status, 'verified');
assert.ok(TJ.every(t => t.conditions.every(c => (c.status === 'shop-proven') === (c.source.kind === 'shop'))));
const pe = TJ.find(x => x.series.startsWith('PENTA') && x.conditions[0].sfm).conditions[0]; assert.deepEqual([pe.sfm.min, pe.sfm.max, pe.feed.range.max], [60, 150, .05]);
// Recall dropdown: only setups saved in the current mode; legacy entries get mode from the tool record
{ const { inferMode, migrate, forMode } = await import('./recall.js');
  const tools = [{ key: 'a.json#0', mode: 'tap' }, { key: 'b.json#0', mode: 'mill' }];
  const saved = [{ mode: 'mill', name: 'm1', v: { tool: 'b.json#0' } }, { name: 'legacy', v: { tool: 'a.json#0' } }, { name: 'drill · X · Y', v: { tool: 'gone#9' } }, { mode: 'turn', name: 't1', v: {} }];
  assert.equal(inferMode(saved[1], tools), 'tap'); assert.equal(inferMode(saved[2], tools), 'drill');
  const m = migrate(saved, tools); assert.deepEqual(m.map(s => s.mode), ['mill', 'tap', 'drill', 'turn']);
  assert.deepEqual(forMode(m, 'tap').map(([s, i]) => [s.name, i]), [['legacy', 1]]);
  assert.deepEqual(forMode(m, 'mill').map(([s]) => s.name), ['m1']);
  for (const md of ['mill', 'drill', 'turn', 'tap']) assert.ok(forMode(m, md).every(([s]) => s.mode === md)); }
// Est. power: 1/2" 4FL in P steel, 400 SFM, .003 in/t, 25% WOC x 1xD DOC -> ~2.6 HP (not rounded to 0)
{ const o = compute({ sfm: 400, d: .5, fpt: .003, z: 4, ae: .125, ap: .5, stickout: 1.5, iso: 'P' });
  assert.ok(o.hp > 2 && o.hp < 3.5, String(o.hp)); assert.equal(+o.mrr.toFixed(3), +(o.ipm * .125 * .5).toFixed(3)); }
// Coolant classification: through-tool only when stated; no conversion.
{ const { coolModes } = await import('./calc.js');
  assert.deepEqual(coolModes('internal coolant recommended'), ['through']);
  assert.deepEqual(coolModes('valid for use with cutting fluid (table note)'), ['flood']);
  assert.deepEqual(coolModes('dry or air blast'), ['air', 'dry']); assert.deepEqual(coolModes(null), []); }
// Accupro: rows printed for >32/>42 HRC must not link to an (unhardened) app material
{ const d = JSON.parse(fs.readFileSync('data/accupro-mill.json'));
  const bad = d.tools.flatMap(t => t.conditions).filter(c => /[>]\s*\d+\s*HRC/.test(c.label) && c.materials?.length);
  assert.equal(bad.length, 0, 'hardened Accupro rows linked: ' + bad.map(c => c.label).slice(0, 3).join('; ')); }
// Accupro drills (p1 colour band + pp3-4 chart): hardness-limited rows unlinked, values as printed
{ const d = JSON.parse(fs.readFileSync('data/accupro-drill.json')), cs = d.tools.flatMap(t => t.conditions);
  assert.equal(cs.filter(c => /Over 35 Rc|[>]\s*\d+\s*(HRC|HB)/.test(c.label) && c.materials?.length).length, 0);
  assert.equal(d.tools.slice(0, 5).flatMap(t => t.conditions).length, 24); assert.equal(d.tools.slice(5).flatMap(t => t.conditions).length, 372);
  const ti = cs.find(c => c.label.startsWith('Titanium: Pure Titanium')); assert.equal(ti.feed.byDiameter['0.7500'].value, 0.008); assert.deepEqual([ti.sfm.min, ti.sfm.max], [65, 105]);
  const t4 = d.tools.find(t => t.diameters_in?.[0] === 0.5 && t.diameters_in[1] === 0.625), ha = t4.conditions.find(c => /^High Alloy.*Over 35 Rc/.test(c.label) && c.coolant === 'Dry');
  assert.equal(ha.sfm.value, 175); assert.deepEqual([ha.feed.range.min, ha.feed.range.max], [0.003, 0.0035]); }
// Accupro taps (p1): SFM only, feed = pitch
{ const cs = JSON.parse(fs.readFileSync('data/accupro-tap.json')).tools.flatMap(t => t.conditions);
  assert.equal(cs.length, 25); assert.ok(cs.every(c => c.feed === null));
  const m = cs.find(c => c.label.startsWith('Stainless Steels: Martensitic')); assert.deepEqual([m.sfm.min, m.sfm.max], [12, 35]); }
// Accupro thread mills (p2): SFM + FPT by diameter band
{ const cs = JSON.parse(fs.readFileSync('data/accupro-threadmill.json')).tools[0].conditions;
  assert.deepEqual(cs.map(c => c.sfm.value), [1700, 525, 100, 600, 600]);
  assert.deepEqual(cs[2].feed.bands, [[0.085, 0.235, 0.0003], [0.3, 0.37, 0.0006], [0.45, 0.49, 0.001], [0.62, 0.74, 0.0013]]); }
// strictMaterials rows (Accupro drill/tap/thread mill): no ISO-group fallback; "Under 35 Rc" is a ceiling
{ const { matchMat, hardnessHB } = await import('./calc.js'); const M = JSON.parse(fs.readFileSync('data/materials.json')), ms = M.materials ?? M, g = id => ms.find(m => m.id === id);
  assert.deepEqual(hardnessHB('Under 35 Rc')[0], 0);
  const row = { label: 'Carbon Alloy Steels: Free Cutting Mild Steel · <120 HB · Green Band', iso: 'P', strictMaterials: true };
  assert.equal(matchMat(g('4140-ann'), row), null); assert.equal(matchMat(g('p-mild'), row), null);
  assert.equal(matchMat(g('4140-ann'), { ...row, strictMaterials: undefined }), 'group'); // other brands keep group matching
  for (const f of ['drill', 'tap', 'threadmill', 'mill']) assert.ok(JSON.parse(fs.readFileSync(`data/accupro-${f}.json`)).tools.every(t => t.conditions.every(c => c.strictMaterials === true))); }
// link-materials: hardness numbers are not grades
{ const { matchIds } = await import('./scripts/link-materials.mjs');
  assert.deepEqual(matchIds('M', 'Austenitic stainless <321 HB'), []);
  assert.deepEqual(matchIds('M', 'Stainless 420 HB'), []);
  assert.deepEqual(matchIds('M', 'HRC 30 martensitic'), []);
  assert.deepEqual(matchIds('M', 'AISI 321, 347 stainless'), ['ss304']);
  assert.deepEqual(matchIds('P', 'AISI 4140, 300 HB'), ['p-alloy']); }
// 303 printed together with 304/316 is "shared", ranked after 303-specific rows.
{ const { shared303 } = await import('./calc.js');
  assert.equal(shared303({ materials: ['ss303', 'ss304'], sourceGroup: 'M 2.1 303/304/316/316L/321' }), true);
  assert.equal(shared303({ materials: ['ss303'], sourceGroup: 'Free-machining stainless 303' }), false); }
// Per-type diameter limits: legit large tools pass, lost-decimal keys fail.
{ const { diaProblem } = await import('./scripts/validate.mjs');
  assert.equal(diaProblem(4, 'in', { mode: 'mill', type: 'Slitting Saws', diameters_in: [1, 4] }), null);
  assert.equal(diaProblem(66, 'mm', { mode: 'drill', type: 'indexable drill', diameters_mm: [57, 66] }), null);
  assert.equal(diaProblem(5.5, 'in', { mode: 'drill', type: 'spade drill' }), null);
  assert.equal(diaProblem(10, 'in', { mode: 'mill', type: 'face mill' }), null);
  assert.ok(diaProblem(1030, 'in', { mode: 'mill', type: 'end mill' }));
  assert.ok(diaProblem(1181, 'in', { mode: 'drill', type: 'drill' }));
  assert.ok(diaProblem(2.5, 'in', { mode: 'mill', type: 'end mill', diameters_in: [0.03, 0.5] })); }
// printed RPM/table feed: shown as printed, scaled together only by the machine RPM cap.
{ const { printedAt, printedRun } = await import('./calc.js'); const { validate } = await import('./scripts/validate.mjs');
  const c = { printed: { unit: 'mm', byDiameter: { '6': { rpm: 10000, tableFeed: { value: 1270, unit: 'mm/min' } } } } };
  const e = printedAt(c, 6 / 25.4); assert.equal(e.rpm, 10000); assert.equal(printedAt(c, 0.25), null);
  const r = printedRun(e, { dIn: 6 / 25.4, z: 2, maxRpm: 0 }); assert.equal(r.rpm, 10000); assert.ok(Math.abs(r.ipm - 50) < 1e-9); assert.equal(r.capped, false);
  const k = printedRun(e, { dIn: 6 / 25.4, z: 2, maxRpm: 8000 }); assert.equal(k.capped, true); assert.ok(Math.abs(k.ipm - 40) < 1e-9); assert.ok(Math.abs(k.fz - r.fz) < 1e-12);
  const doc = { tools: [{ mode: 'mill', brand: 'X', series: 'S', type: 'Solid carbide end mill', flutes: 2, conditions: [{ label: 'P', iso: 'P', status: 'manufacturer', coolant: null, sfm: null, ...c,
    source: { kind: 'catalog', manufacturer: 'X', catalog: 'C', url: 'https://x', page: '1', retrieved: '2026-10-23' } }] }] };
  const errs = validate(doc, 't'); assert.deepEqual(errs.filter(x => /printed|no data/.test(x)), []); }
// Bore mode: fz and ipr both valid; fz still rejected on drills.
{ const { validate } = await import('./scripts/validate.mjs');
  const mk = (mode, kind) => ({ schema: 1, brand: 'X', tools: [{ mode, brand: 'X', series: 'S', type: 'boring head', conditions: [{ label: 'P', iso: 'P', status: 'verified', coolant: null, sfm: { min: 475, max: 925, unit: 'ft/min' }, feed: { kind, unit: 'in', range: { min: 0.001, max: 0.003 } },
    source: { kind: 'catalog', manufacturer: 'X', catalog: 'C', edition: 'e', url: 'https://x', page: '1', retrieved: '2026-10-23' } }] }] });
  assert.deepEqual(validate(mk('bore', 'fz'), 't'), []); assert.deepEqual(validate(mk('bore', 'ipr'), 't'), []);
  assert.ok(validate(mk('drill', 'fz'), 't').some(e => /fz/.test(e))); }
{ const { hardnessHB, matchMat, css, boreLimit } = await import('./calc.js');
  assert.deepEqual(hardnessHB('HB 180-250'), [180, 250]); assert.deepEqual(hardnessHB('48 - 52 HRC'), [451, 500]);
  const h13h = { id: 'h13-hard', iso: 'H', named: '\\bH13\\b', hb: [409, 500] };
  assert.equal(matchMat(h13h, { iso: 'H', label: 'Hardened tool steel 48 - 52 HRC' }), 'group');
  assert.equal(matchMat(h13h, { iso: 'H', label: 'Hardened 56 - 60 HRC' }), null);
  assert.equal(matchMat(h13h, { iso: 'H', label: 'H13 48 HRC' }), 'named');
  const c = css({ sfm: 500, d0: 4, d1: 0.5, maxRpm: 3000 }); assert.equal(c.rpm1, 3000); assert.ok(Math.abs(c.clampDia - 0.6366) < 1e-3);
  assert.equal(boreLimit('steel'), 4); assert.equal(boreLimit('carbide'), 6); console.log('review1 tests pass'); }
{ const { gradeList, pickGrade, geoName } = await import('./calc.js');
  const T = { conditions: [
    { grade: 'A1', iso: 'K', label: 'cast iron', sfm: 1 },
    { grade: 'B2', iso: 'P', label: 'steel', sfm: 1 },
    { grade: 'C3, D4', iso: 'P', label: 'steel · Priority: First choice', sfm: 1 },
    { grade: 'E5', iso: 'P', label: 'steel', sfm: null } ] };
  const ok = c => c.iso === 'P' && !!c.sfm, L = gradeList([{ key: 'f#0', tool: T }], ok);
  assert.deepEqual(L.map(o => o.g), ['B2', 'C3', 'D4', 'A1', 'E5'], 'data grades first in record order, no-data last');
  assert.deepEqual(L.map(o => o.has), [true, true, true, false, false]);
  assert.equal(pickGrade(L, '').pick.g, 'C3'); assert.equal(pickGrade(L, '').why, 'rec');
  assert.equal(pickGrade(L, 'f#0|B2').why, 'kept', 'user choice survives');
  assert.equal(pickGrade(L, 'f#0|A1').pick.g, 'C3', 'no-data choice not kept');
  const N = gradeList([{ key: 'k', tool: { conditions: [{ grade: 'X', label: 'steel', sfm: 1 }, { grade: 'Y', label: 'steel', sfm: 1 }] } }], () => true);
  assert.deepEqual(pickGrade(N, '').why, 'auto'); assert.equal(pickGrade(N, '').pick.g, 'X');
  assert.equal(pickGrade(gradeList([{ key: 'k', tool: T }], () => false), '').pick, null);
  assert.equal(geoName({ series: 'CB7015 turning grade (2015 catalogue, inch start values)', type: 'Turning insert grade — general turning', grade: 'CB7015' }), 'Turning inserts (pick grade below)');
  assert.equal(geoName({ series: 'TungCut AH7025', grade: 'AH7025' }), 'TungCut');
  console.log('grade tests pass'); }
{ const { fzFromPerD } = await import('./calc.js');
  const a = fzFromPerD({ min: 0.005, start: 0.006, max: 0.01 }, 0.5);
  assert.ok(Math.abs(a.def - 0.003) < 1e-12 && Math.abs(a.min - 0.0025) < 1e-12 && Math.abs(a.max - 0.005) < 1e-12);
  assert.match(a.basis, /^MFR FORMULA \(0\.006×D\)/); assert.doesNotMatch(a.basis, /DERIVED/);
  const b = fzFromPerD({ min: 0.005, max: 0.01 }, 10); assert.ok(Math.abs(b.def - 0.05) < 1e-12); assert.match(b.basis, /MFR FORMULA \(0\.005×D\), LOW END/);
  assert.equal(fzFromPerD({ start: 0.006 }, 0), null);
  console.log('fzPerD tests pass'); }
{ const { turnOpsOf } = await import('./calc.js');
  assert.deepEqual(turnOpsOf({ series: 'DGN inserts', type: 'parting / grooving insert' }), ['Part', 'Groove']);
  assert.deepEqual(turnOpsOf({ series: 'CNMG', type: 'turning insert' }), ['Turn']);
  console.log('turnOps tests pass'); }
{ const { matPref } = await import('./calc.js');
  assert.equal(matPref('4140-ann', { label: 'Low alloy steel, annealed (4140)' }), 0);
  assert.equal(matPref('p-alloy', { label: 'non-alloy steel and cast steel, free cutting steel' }), 2);
  assert.equal(matPref('4340-ht', { label: 'Unalloyed steel: C = 0.1–0.25%' }), 2);
  console.log('ME1 alloy pref tests pass'); }
{ const { matPref } = await import('./calc.js');
  assert.equal(matPref('ss304', { label: 'Austenitic stainless — CMC 05.21 / MC M1.0.0.AN' }), 0);
  assert.equal(matPref('ss304', { label: 'Ferritic/martensitic stainless — CMC 05.11' }), 2);
  console.log('ME2 austenitic pref tests pass'); }
{ const { threadPitchIn } = await import('./calc.js');
  assert.equal(threadPitchIn(20, 'tpi'), 0.05); assert.ok(Math.abs(threadPitchIn(1.5, 'mm') - 0.059055) < 1e-5); assert.equal(threadPitchIn(0, 'tpi'), null);
  console.log('ME3 thread pitch tests pass'); }
{ const { sizeRange, inRange } = await import('./calc.js');
  const t = { diameters_mm: [3, 20], conditions: [{ feed: { unit: 'in', byDiameter: { '0.125': 0.002, '0.5': 0.006 } } }] };
  const r = sizeRange(t); assert.ok(Math.abs(r[0] - 0.118) < 1e-3 && Math.abs(r[1] - 0.787) < 1e-3);
  assert.equal(inRange(r, 0.5), true); assert.equal(inRange(r, 1), false); assert.equal(inRange(null, 1), null);
  console.log('ME5 drill size range tests pass'); }
{ const { isTaperThread } = await import('./calc.js');
  assert.equal(isTaperThread('Rekord 2-KEG R15-VA NPT spiral flute'), true); assert.equal(isTaperThread('1/4-18 NPT'), true); assert.equal(isTaperThread('1/4-20 UNC'), false); assert.equal(isTaperThread('M8x1.25'), false);
  console.log('ME6 NPT tap tests pass'); }
{ const { tapName } = await import('./calc.js');
  assert.equal(tapName({ type: 'HSS-E machine tap; color code M; surface -; flute hand/angle R40°; lead DIN 2197 form C; hole types 1-2-3' }), 'HSS-E spiral flute R40° form C lead, color code M');
  assert.equal(tapName({ type: 'HSS-E machine tap; color code M; surface TI; flute hand/angle -; lead DIN 2197 form B' }), 'HSS-E form B lead, TI, color code M');
  console.log('ME7 Iscar tap name tests pass'); }
{ const { brandName } = await import('./calc.js');
  assert.equal(brandName('ISCAR'), 'Iscar'); assert.equal(brandName('Sumitomo Electric'), 'Sumitomo Electric Hardmetal'); assert.equal(brandName('KYOCERA SGS'), 'Kyocera SGS'); assert.equal(brandName('SGS'), 'Kyocera SGS'); assert.equal(brandName('Kyocera'), 'Kyocera');
  console.log('ME8 brand alias tests pass'); }
{ const { geoName } = await import('./calc.js');
  assert.equal(geoName({ mode: 'turn', grade: 'GC1125', series: 'GC1125 parting & grooving grade (Supplement 19.2 start values)', type: 'Parting and grooving insert grade — cutting speed recommendations' }), 'Parting and grooving inserts (pick grade below)');
  console.log('ME followup Sandvik parting name tests pass'); }
{ const { threadFeed } = await import('./calc.js');
  let r = threadFeed({ rpm: 4760, lead: 1 / 13 }); assert.ok(r.high && !r.capped && Math.round(r.ipm) === 366);
  r = threadFeed({ rpm: 4760, lead: 1 / 13, maxIpm: 150 }); assert.ok(r.capped && Math.round(r.rpm) === 1950 && r.ipm === 150);
  r = threadFeed({ rpm: 1000, lead: 1 / 13, maxIpm: 150 }); assert.ok(!r.capped && !r.high);
  console.log('thread feed cap tests pass'); }
{ const { tapTypeOf } = await import('./calc.js');
  assert.equal(tapTypeOf({ series: 'x', type: 'HSS-E machine tap; color code M; surface -; flute hand/angle -; lead DIN 2197 form B' }), 'point');
  assert.equal(tapTypeOf({ series: 'x', type: 'HSS-E machine tap; flute hand/angle R40°; lead DIN 2197 form C' }), 'flute');
  assert.equal(tapTypeOf({ series: 'InnoForm roll tap' }), 'form'); assert.equal(tapTypeOf({ series: 'List 16250', type: 'FORMING HSS-Co' }), 'form'); assert.equal(tapTypeOf({ series: 'Fluteless thread forming tap' }), 'form');
  console.log('ME10 #1 tap type tests pass'); }
{ const { pitchCovers } = await import('./calc.js');
  assert.equal(pitchCovers({ label: 'P1 … — WMP22G, pitch 1,5–5,0 mm' }, 1 / 13), true); assert.equal(pitchCovers({ label: 'P1 … pitch 0,5–1,25 mm' }, 1 / 13), false); assert.equal(pitchCovers({ label: 'x' }, 1 / 13), null);
  console.log('ME10 #3 pitch range tests pass'); }
{ const { seriesGrade, geoName } = await import('./calc.js');
  assert.equal(seriesGrade({ mode: 'turn', series: 'CNMG432-MF4 TM2000' }), 'TM2000'); assert.equal(seriesGrade({ mode: 'turn', series: 'PENTA inserts (p.593)' }), null);
  assert.equal(geoName({ mode: 'turn', series: 'CNMG432-MF4 TP2501', grade: 'TP2501' }), 'CNMG432-MF4');
  console.log('ME10 #4 series grade tests pass'); }
{ const { distinctName } = await import('./calc.js');
  assert.equal(distinctName('Iscar — PENTA inserts', { series: 'PENTA inserts (p.593)', ins: ['PENTA D22N200J020', 12] }, true), 'Iscar — PENTA inserts · p.593 · D22N200J020 +11');
  assert.equal(distinctName('X', { series: 'X' }, false), 'X');
  console.log('ME10 #5 distinct name tests pass'); }
{ const { lowEnd, pick } = await import('./calc.js');
  const r = lowEnd(pick({ min: 0.05, max: 0.16 })); assert.equal(r.def, 0.05); assert.match(r.basis, /^LOW END of manufacturer range/);
  assert.equal(lowEnd(pick({ min: 1, max: 3, start: 2 })).def, 2);
  console.log('ME10 #7 low end tests pass'); }
{ const { drillRank } = await import('./calc.js');
  assert.ok(drillRank({ series: 'X', cl: ['flood'] }, 'flood') < drillRank({ series: 'X', cl: ['through'] }, 'flood'));
  assert.ok(drillRank({ series: 'X', cl: ['through'] }, 'flood') < drillRank({ series: 'T-A carbide insert, Flat Bottom Geometry', cl: ['flood'] }, 'flood'));
  console.log('ME10 #10 drill rank tests pass'); }
{ const { drillRank, isGun } = await import('./calc.js');
  const g = { mode: 'drill', series: 'SUMOGUN MNSNT', type: 'modular gundrill head', cl: ['flood'] };
  assert.ok(isGun(g)); assert.ok(drillRank(g, 'flood') > drillRank({ mode: 'drill', series: 'DE10' }, 'flood'));
  console.log('ME11 #1 gundrill tests pass'); }
{ const { geoName, isMFDrill } = await import('./calc.js');
  const x = { mode: 'turn', series: 'XCMT-MF insert - grooving' }; assert.ok(isMFDrill(x)); assert.equal(geoName(x), 'XCMT-MF (multi-function drill insert)');
  console.log('ME11 #2 XCMT-MF tests pass'); }
{ const fs = await import('node:fs'); const j = JSON.parse(fs.readFileSync('./data/index.json'));
  const tt = j.files.flatMap(f => f.tools).filter(t => t.mode === 'turn'); assert.ok(tt.filter(t => t.ps?.includes('Finish')).length > 10);
  assert.ok(tt.some(t => t.ps && !t.ps.includes('Finish')));
  console.log('ME11 #3 turn pass index tests pass'); }
{ const { rangeText, lowEnd, pick } = await import('./calc.js');
  assert.equal(rangeText(lowEnd(pick({ min: 164, max: 656 })), 0), '164–656 · using low end'); assert.equal(rangeText(pick({ min: 1, max: 3 }), 0), '1–3 · using midpoint');
  assert.equal(rangeText(pick({ min: 1, max: 3, start: 2 }), 0), '1 – 2 – 3');
  console.log('ME11 #4 range text tests pass'); }
{ const { drillSpans, drillTier, drillRank } = await import('./calc.js');
  const withData = { mode: 'drill', series: 'A', conditions: [{ iso: 'P', sfm: { min: 1, max: 2 }, feed: { unit: 'mm', bands: [[12, 13, 0.2]] } }] };
  const rangeOnly = { mode: 'drill', series: 'B', dr: [0.3, 0.8], conditions: [{ iso: 'P', sfm: { min: 1, max: 2 }, feed: { unit: 'mm', bands: [[3, 4, 0.1]] } }] };
  withData.dd = drillSpans(withData); rangeOnly.dd = drillSpans(rangeOnly);
  assert.equal(drillTier(withData, 0.5, 'P'), 0); assert.equal(drillTier(rangeOnly, 0.5, 'P'), 1); assert.equal(drillTier({ dr: [1, 2] }, 0.5, 'P'), 2);
  assert.equal(drillTier(withData, 0.5, 'M'), 2);
  const gunData = { ...withData, series: 'SUMOGUN', type: 'gundrill' }; // inside a tier, specials still sort after
  assert.ok(20 * drillTier(gunData, 0.5, 'P') + drillRank(gunData, 'flood') < 20 * drillTier(rangeOnly, 0.5, 'P') + drillRank(rangeOnly, 'flood'));
  assert.ok(drillRank(gunData, 'flood') > drillRank(withData, 'flood'));
  console.log('ME11 #6 drill data tier tests pass'); }
{ const { drillSpans, dataAt } = await import('./calc.js');
  const t = { mode: 'drill', series: 'DRZ', conditions: [{ iso: 'P', label: 'Alloy steel · DC ø13~ø15.5', sfm: { min: 1, max: 2 }, feed: { unit: 'mm', range: { min: .06, max: .1 } } }] }; t.dd = drillSpans(t);
  assert.equal(dataAt(t, 0.5, 'P'), false); assert.equal(dataAt(t, 0.55, 'P'), true);
  console.log('ME11 #6 label row diameter tests pass'); }
{ const { rowExcludes } = await import('./calc.js');
  assert.equal(rowExcludes({ label: 'Alloy steel · DC ø13~ø15.5' }, 0.5), true); assert.equal(rowExcludes({ label: 'Alloy steel · DC ø13~ø15.5' }, 0.55), false);
  assert.equal(rowExcludes({ label: 'no size' }, 0.5), false); assert.equal(rowExcludes({ diameterRange: { min: 10, max: 13, unit: 'mm' } }, 0.5), false);
  console.log('ME11 #7 out-of-size row tests pass'); }
{ const { rowExcludes } = await import('./calc.js'); assert.equal(rowExcludes({ label: 'Alloy · 2D · DC ø50~ · x' }, 0.5), true); assert.equal(rowExcludes({ label: 'DC ø50~' }, 2.1), false); console.log('ME11 #7 open-ended row tests pass'); }
{ const { coolModes, drillRank } = await import('./calc.js');
  assert.deepEqual(coolModes('Use internal coolant'), ['through']); assert.ok(!coolModes('Internal coolant is recommended').includes('flood'));
  assert.ok(coolModes('emulsion or oil').includes('flood')); assert.ok(coolModes('combination of internal and external coolant').includes('flood'));
  const F = drillRank({ series: 'A', cl: ['flood'] }, 'flood'), N = drillRank({ series: 'B', cl: [] }, 'flood'), T = drillRank({ series: 'C', cl: ['through'] }, 'flood');
  assert.ok(F < N && N < T); assert.equal(drillRank({ series: 'C', cl: ['through'] }, 'through'), 0); console.log('ME11 #8 coolant rank tests pass'); }
{ const { toolLifeOf } = await import('./calc.js');
  assert.equal(toolLifeOf({ toolLife: 10 }), 10); assert.equal(toolLifeOf({ coolantNote: 'Catalog: vc calculated for 15 min tool life with external flood coolant.' }), 15);
  assert.equal(toolLifeOf({ note: 'if dry machining is possible, tool life is reduced by 20–30% on average' }), null); assert.equal(toolLifeOf({}), null);
  console.log('AM #2 tool life tests pass'); }
{ const { threadFeed } = await import('./calc.js');
  assert.deepEqual(threadFeed({ rpm: 2000, lead: 0.125 }), { rpm: 2000, ipm: 250, capped: false, high: true });
  const c = threadFeed({ rpm: 2000, lead: 0.125, maxIpm: 300 }); assert.equal(c.high, false); assert.equal(c.capped, false);
  const d = threadFeed({ rpm: 2000, lead: 0.125, maxIpm: 150 }); assert.equal(d.capped, true); assert.equal(d.rpm, 1200);
  console.log('AM #3 threading guard tests pass'); }
{ const { pick, rangeText, lowEnd } = await import('./calc.js'); const { validate } = await import('./scripts/validate.mjs');
  const r = lowEnd(pick({ min: 500 })); assert.equal(r.def, 500); assert.equal(r.max, null); assert.equal(rangeText(r, 0), 'min 500 (mfr gives minimum only)');
  const doc = { schema: 1, brand: 'X', tools: [{ mode: 'mill', brand: 'X', series: 'Y', conditions: [{ label: 'a', iso: 'N', status: 'verified', coolant: null, sfm: { min: 500, unit: 'ft/min' }, source: { kind: 'catalog', manufacturer: 'X', catalog: 'c', edition: 'e', url: 'https://x' } }] }] };
  assert.deepEqual(validate(doc).filter(e => /sfm/.test(e)), []);
  console.log('AM #4 min-only tests pass'); }
{ const { validateMachines } = await import('./scripts/validate-machines.mjs'); const MI = J('./data/machines/index.json');
  for (const b of MI.builders) assert.deepEqual(validateMachines(J('./data/machines/' + b.file), b.file), []);
  const qt = J('./data/machines/mazak.json').models.find(m => m.model === 'QUICK TURN 350MY'); assert.equal(qt.spindles[0].rpm, 3300);
  assert.ok(validateMachines({ schema: 1, builder: 'X', models: [{ model: 'M', type: 'mill', spindles: [{ option: 'o', rpm: null }], source: { url: 'https://x', accessed: '2026-01-01' } }] }).length);
  console.log('machine preset tests pass'); }
{ const { filterOpts } = await import('./combo.js'); const L = ['All brands', 'Allied', 'Sandvik Coromant', 'Guhring', '\u00a0\u00a0Steel 4140 · ISO P'];
  assert.deepEqual(filterOpts(L, ''), [0, 1, 2, 3, 4]); assert.deepEqual(filterOpts(L, 'al'), [0, 1]); assert.deepEqual(filterOpts(L, 'coro sand'), [2]); assert.deepEqual(filterOpts(L, '4140'), [4]); assert.deepEqual(filterOpts(L, 'zz'), []); }
// machine profiles: Use never duplicates
{ const { upsertMachine: up, dedupeMachines: dd } = await import('./recall.js');
  const vf2 = { name: 'Haas VF-2', type: 'mill', rpm: 8100, hp: 30, thrIpm: null, preset: 'haas/vf-2/std' };
  let a = up([], vf2); assert.equal(a.action, 'added'); a = up(a.list, { ...vf2 }); assert.equal(a.action, 'existing'); assert.equal(a.list.length, 1);
  a = up(a.list, { ...vf2, rpm: 7000, user: ['rpm'] }); assert.equal(a.action, 'updated'); assert.equal(a.list.length, 1); assert.equal(a.list[0].rpm, 7000);
  a = up(a.list, { ...vf2, preset: 'haas/vf-2/12k', rpm: 12000 }); assert.equal(a.list.length, 2);
  const cu = { name: 'Shop mill', type: 'mill', rpm: 6000, hp: 10, thrIpm: null };
  a = up(a.list, cu); a = up(a.list, { ...cu, name: ' shop mill ' }); assert.equal(a.list.length, 3); assert.equal(a.action, 'existing');
  const d = dd([vf2, cu, { ...vf2 }, { ...vf2, rpm: 7000 }, { ...cu }]); assert.equal(d.list.length, 3); assert.deepEqual(d.map, [0, 1, 0, 2, 1]);
  assert.equal(dd([vf2, cu]).changed, false); }
{ const { removeMachine: rm } = await import('./recall.js'); const r = rm([{ name: 'a' }, { name: 'b' }, { name: 'c' }], 1, { mill: '1', turn: '2', drill: '0', tap: '' });
  assert.deepEqual(r.list.map(x => x.name), ['a', 'c']); assert.deepEqual(r.last, { mill: '', turn: '1', drill: '0', tap: '' }); console.log('ok removeMachine'); }
{ const { filterOpts } = await import('./combo.js'); assert.deepEqual(filterOpts(['x', 'y'], ''), [0, 1]); }
// classifyOverride: amber inside mfr range, red outside
{ const { classifyOverride: C } = await import('./calc.js'); const R = { min: 300, max: 550, def: 300 };
  assert.equal(C(300, R, 2).state, 'mfr'); assert.equal(C(500, R, 2).state, 'within'); assert.equal(C(500, R, 2).label, 'Adjusted, within mfr range 300–550');
  assert.equal(C(550, R, 2).state, 'within'); assert.equal(C(301, { ...R, def: 425 }, 0).state, 'within');
  assert.deepEqual([C(600, R, 2).state, C(600, R, 2).side, C(600, R, 2).note], ['out', 'above', 'above mfr range (300–550)']);
  assert.deepEqual([C(250, R, 2).state, C(250, R, 2).side, C(250, R, 2).note], ['out', 'below', 'below mfr range (300–550)']);
  const M = { min: 500, max: null, def: 500 }; assert.equal(C(500, M, 2).state, 'mfr'); assert.equal(C(505, M, 2).label, 'Adjusted, at/above mfr minimum 500'); assert.equal(C(505, M, 2).note, '');
  assert.equal(C(700, M, 2).state, 'within'); assert.equal(C(700, M, 2).note, 'mfr minimum only, no upper limit published'); assert.equal(C(450, M, 2).note, 'below mfr minimum (500)');
  const S = { min: null, max: null, def: 200 }; assert.equal(C(210, S, 0).label, 'Adjusted from mfr value 200'); assert.equal(C(190, S, 0).state, 'within');
  assert.equal(C(250, S, 0).state, 'out'); assert.equal(C(150, S, 0).side, 'below'); assert.match(C(250, S, 0).note, /20% is a rule of thumb, not a manufacturer limit/);
  assert.equal(C(.004, { min: .003, max: .006, def: .003 }, 5e-5, 4).label, 'Adjusted, within mfr range 0.0030–0.0060'); }
// classifyEng: DOC/WOC vs mfr max / range, units via engFrac
{ const { classifyEng: E, engFrac: F } = await import('./calc.js'); const M = { min: null, max: 0.3, def: 0.3 }, f = x => `${+(x * 100).toFixed(1)}% of D`;
  assert.equal(E(0.3, M, 1e-3, f).state, 'mfr');
  assert.deepEqual([E(0.2, M, 1e-3, f).state, E(0.2, M, 1e-3, f).label], ['within', 'Adjusted, within mfr max 30% of D']);
  assert.deepEqual([E(0.4, M, 1e-3, f).state, E(0.4, M, 1e-3, f).label, E(0.4, M, 1e-3, f).note], ['out', 'YOUR VALUE, NOT MANUFACTURER', 'above mfr max (30% of D)']);
  const R = { min: 0.5, max: 1.5, def: 1 }; assert.equal(E(1, R).state, 'mfr'); assert.equal(E(1.2, R).label, 'Adjusted, within mfr range 0.5–1.5');
  assert.equal(E(1.5, R).state, 'within'); assert.equal(E(2, R).note, 'above mfr range (0.5–1.5)'); assert.equal(E(0.3, R).note, 'below mfr range (0.5–1.5)');
  assert.equal(F(30, 'pct', 0.5), 0.3); assert.equal(F(0.15, 'in', 0.5), 0.3); assert.equal(F(1.5, 'xd', 0.5), 1.5);
  assert.equal(E(F(0.15, 'in', 0.5), M).state, 'mfr'); assert.equal(E(F(0.1, 'in', 0.5), M).state, 'within'); assert.equal(E(F(0.2, 'in', 0.5), M).state, 'out');
  assert.equal(E(0.5, null), null); assert.equal(E(0.5, { min: null, max: null }), null); console.log('ok classifyEng'); }
// ---- Estimates (DERIVED, same maker only) ----
{ const { estimate } = await import('./estimate.js'); const M = id => IDX.materials.find(m => m.id === id);
  const src = { kind: 'catalog', manufacturer: 'A', catalog: 'Cat', edition: '2024', url: 'https://x' };
  const cond = (o = {}) => ({ label: '4140', iso: 'P', materials: ['4140-ann'], status: 'verified', coolant: 'flood', sfm: { min: 300, max: 400, unit: 'ft/min' }, feed: { kind: 'fz', unit: 'in', byDiameter: { '0.5': { min: .002, max: .003 } } }, source: src, ...o });
  const tool = (brand, o = {}, c = {}) => ({ mode: 'mill', brand, series: 'S' + Math.random(), type: 'square end mill', diameters_in: [.25, .75], conditions: [cond(c)], ...o });
  const target = { brand: 'A', mode: 'mill', series: 'T', type: 'square end mill' }, run = (cands, o = {}) => estimate({ target, targetKey: 'T', cands: cands.map((tool, i) => ({ key: 'k' + i, tool })), mat: M('4140-ann'), d: .5, cool: 'flood', ...o });
  // needs >=2 same-maker tools; null with 0 or 1
  assert.equal(run([]).sfm, null); assert.equal(run([tool('A')]).sfm, null); assert.equal(run([tool('A')]).fpt, null);
  const two = run([tool('A'), tool('A', {}, { sfm: { min: 250, max: 500, unit: 'ft/min' }, feed: { kind: 'fz', unit: 'in', byDiameter: { '0.5': { min: .0015, max: .004 } } } })]);
  assert.equal(two.sfm.def, 250); assert.equal(two.fpt.def, .0015); assert.equal(two.sfm.n, 2); assert.ok(two.sfm.derived && two.sfm.est); // lowest low end, no averaging
  { const fz = { feed: { kind: 'fz', unit: 'in', byDiameter: { '0.4': .001 } } }, e = run([tool('A', { diameters_in: [.25, .75] }, fz), tool('A', { diameters_in: [.25, .75] }, fz)]); assert.equal(e.fpt.def, .001); assert.equal(e.fpt.close, true); } // estimate (b3): feed from a smaller published Ø is flagged close even when the tool range covers Ø
  // never another brand, never another tool type
  assert.equal(run([tool('A'), tool('B')]).sfm, null);
  assert.equal(run([tool('A'), tool('A', { mode: 'drill', type: 'drill' })]).sfm, null);
  assert.equal(run([tool('A'), tool('A', { series: 'Thread mill X', type: 'thread mill' })]).sfm, null);
  // size: 1/8" tool numbers never carry to 1"; within 25% ok
  const small = c => tool('A', { diameters_in: [.0625, .125] }, { feed: { kind: 'fz', unit: 'in', byDiameter: { '0.125': .001 } }, ...c });
  assert.equal(run([small(), small()], { d: 1 }).sfm, null); assert.equal(run([small(), small()], { d: 1 }).fpt, null);
  assert.equal(run([small(), small()], { d: .15 }).sfm.def, 300); assert.equal(run([small(), small()], { d: .15 }).fpt.def, .001);
  assert.equal(run([tool('A'), tool('A')], { d: .45 }).fpt, null); // never borrows a LARGER Ø chip load
  // coolant mismatch excluded (unstated allowed)
  assert.equal(run([tool('A'), tool('A', {}, { coolant: 'through-tool coolant' })]).sfm, null);
  assert.equal(run([tool('A'), tool('A', {}, { coolant: null })]).sfm.n, 2);
  // 303 vs 304 never mixed
  const ss = (m, lbl) => tool('A', {}, { iso: 'M', materials: m, label: lbl, sourceGroup: lbl });
  assert.equal(run([ss(['ss304'], '304'), ss(['ss304'], '304')], { mat: M('ss303') }).sfm, null);
  assert.equal(run([ss(['ss303', 'ss304'], '303/304'), ss(['ss303', 'ss304'], '303/304')], { mat: M('ss304') }).sfm, null);
  assert.equal(run([ss(['ss304'], '304'), ss(['ss304'], '304')], { mat: M('ss304') }).sfm.n, 2);
  // kill switch
  assert.equal(run([tool('A'), tool('A')], { on: false }).sfm, null);
}
console.log('estimate tests ok');
// Review3 #3: material class + hardness band mapping
{ const { matPref, matchMat } = await import('./calc.js'); const M = JSON.parse((await import('node:fs')).readFileSync('data/materials.json')).materials, g = id => M.find(m => m.id === id);
  assert.equal(matPref('4140-ann', { label: 'Tool steels (HRC < 25, BHN < 255)' }, g('4140-ann')), 2);
  assert.ok(matPref('4140-ann', { label: 'Unalloyed heat-treatable steels (HRC < 20, BHN < 220)' }, g('4140-ann')) < 2);
  assert.equal(matchMat(g('p20-pre'), { iso: 'P', label: 'Carbon Steel (10XX) < 75 HRB - Fin' }), null);
  assert.equal(matPref('ti64', { label: 'Pure Titanium (Ti Grade 1, Ti Grade 2) 21 - 36 HRC' }, g('ti64')), 2);
  assert.equal(matPref('ti64', { label: 'Titanium Alloy (Ti 3Al-2.5V, Ti 6Al-4V) 21 - 36 HRC' }, g('ti64')), 0);
  console.log('material class tests ok'); }
{ const { nice } = await import('./calc.js'); assert.equal(nice('BTAH'), 'BTAH back-turning holder (Swiss/gang, BTAT insert)'); assert.equal(nice('Superalloys Inconel718, etc. · Grades: SH7025,SH725'), 'Superalloys Inconel718, etc. · grade SH7025 / SH725'); assert.equal(nice('streamjetbar – Standard cutting conditions'), 'streamjetbar'); }

{ // Estimate A: same end geometry only; unknown geometry → none. B: target's own records must name the material.
  const { estimate } = await import('./estimate.js'); const { endGeom } = await import('./calc.js');
  assert.equal(endGeom({ series: 'Miniature End Mills - Ball' }), 'ball'); assert.equal(endGeom({ series: 'Finishers - Corner Radius' }), 'bull'); assert.equal(endGeom({ series: 'X - Square' }), 'square');
  assert.equal(endGeom({ series: 'Square & Corner Radius' }), null); assert.equal(endGeom({ series: 'R217.79-10' }), null);
  const M = id => JSON.parse(fs.readFileSync('data/materials.json')).materials.find(m => m.id === id);
  const src = { kind: 'catalog', manufacturer: 'A', catalog: 'Cat' }, c = { label: '4140', iso: 'P', materials: ['4140-ann'], status: 'verified', sfm: { min: 300, max: 400, unit: 'ft/min' }, source: src };
  const tl = (g, o = {}) => ({ mode: 'mill', brand: 'A', series: 'S ' + g + Math.random(), diameters_in: [.25, .75], conditions: [c], ...o });
  const r = (tg, cands, extra = {}) => estimate({ target: { brand: 'A', mode: 'mill', series: 'T ' + tg }, targetKey: 'T', cands: cands.map((tool, i) => ({ key: 'k' + i, tool })), mat: M('4140-ann'), d: .5, cool: 'flood', need: { sfm: true, fpt: false }, ...extra }).sfm;
  assert.ok(r('Ball', [tl('Ball'), tl('Ball')])); assert.equal(r('Ball', [tl('Square'), tl('Square')]), null); assert.equal(r('', [tl('Ball'), tl('Ball')]), null);
  const own = iso => ({ conditions: [{ label: 'Alloy steel', iso, source: src }] });
  assert.equal(r('Ball', [tl('Ball'), tl('Ball')], { targetTool: own('N') }), null); assert.ok(r('Ball', [tl('Ball'), tl('Ball')], { targetTool: own('P') }));
  const ti = { conditions: [{ label: 'S 1.2 Titanium alloys ≤27 HRC (6Al4V)', iso: 'S', source: src }] }, ni = { conditions: [{ label: 'S 2.1 Nickel alloys (Inconel 718)', iso: 'S', source: src }] }, { ownNames } = await import('./calc.js');
  assert.equal(ownNames(ti, M('in718')), false); assert.equal(ownNames(ni, M('in718')), true); assert.equal(ownNames(ti, M('ti64')), true);
}
{ const { sizeTxt } = await import('./estimate.js'); const assert = (await import('node:assert')).default;
  assert.equal(sizeTxt(0.375), '3/8 in'); assert.equal(sizeTxt(1.25), '1 1/4 in'); assert.equal(sizeTxt(0.3937), '0.3937 in'); console.log('D size text tests pass'); }
{ const { brandUsable } = await import('./calc.js'); const assert = (await import('node:assert')).default; const m = { id: '4140-ann', iso: 'P' };
  const speedOnly = { mats: [], isos: ['P'], dataIsos: ['P'], fullIsos: [] }, full = { mats: [], isos: ['P'], dataIsos: ['P'], fullIsos: ['P'] }, label = { mats: [], isos: ['*'], dataIsos: ['*'], fullIsos: ['*~'] };
  assert.equal(brandUsable(speedOnly, m), false); assert.equal(brandUsable(full, m), true); assert.equal(brandUsable(label, m), true); assert.equal(brandUsable(speedOnly, m, false), true);
  assert.equal(brandUsable({ ...full, nm: ["4140-ann"] }, m), false); // item 1: ISO P has data but no row fits annealed 4140
{ const I = JSON.parse((await import("node:fs")).readFileSync("data/index.json")); const h = I.files.filter(f => /harvey/i.test(f.brand)).flatMap(f => f.tools).filter(t => t.mode === "mill" && /^126xx/.test(t.series)); assert.ok(h.length && h.every(t => t.nm?.includes("4140-ann"))); }
  console.log('Iscar brand-has-data consistency tests pass'); }
{ const { commonDrillMm } = await import('./calc.js'); const assert = (await import('node:assert')).default;
  assert.equal(commonDrillMm(6.78), 6.8); assert.equal(commonDrillMm(2.47), 2.45); assert.equal(commonDrillMm(17.6), 17.5); console.log('common drill size tests pass'); }
{ const { matBad } = await import('./calc.js'); const assert = (await import('node:assert')).default; // ME item 7
  assert.ok(matBad({ id: 'ti64', iso: 'S' }, { label: 'Pure Titanium < 75 HRB - Slot', subgroup: 'Pure Titanium, < 75 HRB', material: 'Pure Titanium (Helical material-guide group heading; member alloy list not transcribed - see PDF)' }));
  assert.ok(matBad({ id: 'p20-pre', iso: 'P' }, { label: 'Carbon Steel < 75 HRB - Slot' }));
  assert.ok(matBad({ id: '4140-ann', iso: 'P' }, { label: 'Tool steels (HRC < 25, BHN < 255)' }));
  console.log('wrong-material rows excluded'); }
{ const { feedLow } = await import('./estimate.js'); const assert = (await import('node:assert')).default; // estimate (a): byDiameter never uses a larger Ø
  const c = { feed: { kind: 'fz', unit: 'in', byDiameter: { '0.5': 0.002, '0.515': 0.003 } } };
  assert.equal(feedLow(c, {}, 0.51).at, 0.5); assert.equal(feedLow(c, {}, 0.51).v, 0.002);
  assert.equal(feedLow({ feed: { kind: 'fz', unit: 'in', byDiameter: { '0.52': 0.003 } } }, {}, 0.51), null);
  console.log('estimate byDiameter smaller-only ok'); }
{ const { feedLow } = await import('./estimate.js'); const assert = (await import('node:assert')).default; // estimate (b1): f.range never from a larger tool
  const c = r => ({ diameters_in: r, feed: { kind: 'fz', unit: 'in', range: { min: 0.002, max: 0.004 } } });
  assert.equal(feedLow({ feed: c().feed }, { diameters_in: [0.55, 0.6] }, 0.5), null);
  assert.equal(feedLow({ feed: c().feed }, { diameters_in: [0.4, 0.45] }, 0.5)?.v, 0.002);
  console.log('estimate range smaller-only ok'); }
{ const { feedLow } = await import('./estimate.js'); const assert = (await import('node:assert')).default; // estimate (b2): shared band edge takes the lower value
  const f = { feed: { kind: 'fz', unit: 'in', bands: [[.25, .5, .001], [.5, .75, .002]] } };
  assert.equal(feedLow(f, {}, .5).v, .001); assert.equal(feedLow(f, {}, .6).v, .002); assert.equal(feedLow(f, {}, .8).v, .002);
  console.log('estimate band edge low ok'); }
{ const { dataRank } = await import('./calc.js'); const assert = (await import('node:assert')).default; // picker rank shared with audit-picker.mjs
  assert.equal(dataRank({ fullIsos: ['P'] }, '4140-ann', 'P'), 0); assert.equal(dataRank({ fullIsos: ['P~'] }, '4140-ann', 'P'), 1);
  assert.equal(dataRank({ fullIsos: ['M'] }, '4140-ann', 'P'), 2); assert.equal(dataRank({ fullIsos: ['P'], nm: ['4140-ann'] }, '4140-ann', 'P'), 2);
  console.log('dataRank ok'); }
// Iscar Turn: speed-only grade table + feed-only insert table in the same tool record are paired, labeled, sources kept separate.
{ const { withPairs, matPref } = await import('./calc.js'); const fs = await import('node:fs');
  const t = JSON.parse(fs.readFileSync('data/iscar-turn.json')).tools.find(t => t.series === 'VNMG-NF IC807'), p = withPairs(t).conditions.filter(c => c.paired);
  assert.ok(p.length > 0 && p.every(c => c.sfm && c.feed && c.feedSource && c.source.page == 246 && /p\.165/.test(c.feedSource.catalog)));
  assert.ok(p.every(c => c.iso !== '*'));
  assert.equal(withPairs(withPairs(t)).conditions.length, withPairs(t).conditions.length);
  const g6 = p.find(c => /Grp 6/.test(c.label)), g1 = p.find(c => /Grp 1 /.test(c.label));
  assert.ok(matPref('4140-ann', g6) < matPref('4140-ann', g1));
  const noFeed = { mode: 'turn', conditions: [{ iso: 'P', sfm: { min: 1 }, label: 'a', source: { page: 1 } }] }; assert.equal(withPairs(noFeed), noFeed); }
{ const { noDataWhy } = await import('./calc.js');
  assert.equal(noDataWhy({ speedIsos: ['P'] }, '4140-ann', 'P'), 'speed only, no feed printed');
  assert.equal(noDataWhy({ feedIsos: ['*'] }, '4140-ann', 'P'), 'feed only, no speed printed');
  assert.equal(noDataWhy({ speedIsos: ['P'], nm: ['4140-ann'] }, '4140-ann', 'P'), 'no data for this material');
  assert.equal(noDataWhy({}, 'x', 'P'), 'no data for this material'); }
// ME1: Dormer S116 has no M data at 0.5 in (published 12 and 14 mm only), so it must never be the auto-picked default there.
{ const { dataAt } = await import('./calc.js'); const fs = await import('node:fs'); const ix = JSON.parse(fs.readFileSync('data/index.json'));
  const t = ix.files.find(f => f.file === 'dormer-pramet-mill-endmills.json').tools.find(t => t.series === 'Dormer S116');
  assert.equal(dataAt(t, 0.5, 'M'), false); assert.equal(dataAt(t, 0.4724, 'M'), true);
  const app = fs.readFileSync('app.js', 'utf8'); assert.ok(/bad = t => [^;]*noAt\(t\)/.test(app)); }
// ME2: a tool with several matching rows is listed once in the estimate sources (its lowest row); n equals rows shown.
{ const { estimate } = await import('./estimate.js'); const M = id => IDX.materials.find(m => m.id === id);
  const src = { kind: 'catalog', manufacturer: 'A', catalog: 'Cat', url: 'https://x' };
  const cond = s => ({ label: '4140 ' + s, iso: 'P', materials: ['4140-ann'], status: 'verified', coolant: 'flood', sfm: { min: s, max: s + 100, unit: 'ft/min' }, feed: { kind: 'fz', unit: 'in', byDiameter: { '0.5': { min: .002, max: .003 } } }, source: src });
  const tool = n => ({ mode: 'mill', brand: 'A', series: n, type: 'square end mill', diameters_in: [.25, .75], conditions: [cond(300), cond(250), cond(350)] });
  const e = estimate({ target: { brand: 'A', mode: 'mill', series: 'T', type: 'square end mill' }, targetKey: 'T', cands: [{ key: 'a', tool: tool('X') }, { key: 'b', tool: tool('Y') }], mat: M('4140-ann'), d: .5, cool: 'flood' });
  assert.equal(e.sfm.sources.length, 2); assert.equal(e.sfm.n, 2); assert.equal(e.sfm.def, 250); assert.equal(e.fpt.sources.length, 2); }
// ME3: Thread before a TPI is entered says 'Enter TPI', not 'No manufacturer data'.
{ const fs = await import('node:fs'), app = fs.readFileSync('app.js', 'utf8'); assert.equal((app.match(/TH\(\)[^?]*!threadPitchIn\(\+\$\('tpi'\)\.value, \$\('pitchU'\)\.value\) \? [^:]*Enter TPI/g) ?? []).length, 3);
  const { threadPitchIn } = await import('./calc.js'); assert.ok(!threadPitchIn(0, 'tpi')); }
// ME4: Guhring 'Stainless steels, sulphured' is a 303-type row; flagged NOT 304. Plain austenitic / 304 rows are not flagged.
{ const { sulph303 } = await import('./calc.js');
  assert.ok(sulph303({ label: 'Stainless steels, sulphured (HRC < 28, BHN < 273)' })); assert.ok(sulph303({ label: 'Stainless, sulphured (e.g. 303) <180 HB' }));
  assert.ok(!sulph303({ label: 'Stainless steels, austenitic (304, 316)' })); assert.ok(!sulph303({ label: 'Grp 14 Austenitic stainless' })); }
{ // dia group after Brand/Type: published sizes per tool (ps) + placement code
  const fs = await import('fs'); const ix = JSON.parse(fs.readFileSync(new URL('./data/index.json', import.meta.url)));
  const ts = ix.files.flatMap(f => f.tools); const m = ts.filter(t => t.mode === 'mill' && t.ps);
  if (m.length < 50 || !m.every(t => t.ps.every((x, i) => x > 0 && (!i || x > t.ps[i - 1])))) throw 'ps missing/unsorted';
  if (!ts.some(t => t.ps && t.mode === 'drill')) throw 'ps missing on drills';
  const h = fs.readFileSync(new URL('./index.html', import.meta.url), 'utf8'), a = fs.readFileSync(new URL('./app.js', import.meta.url), 'utf8');
  if (!/id="diaHome"><\/div><div id="diaGrp">/.test(h) || !/id="bkRow"/.test(h) || !/id="tapRow"/.test(h) || !/\$\('diaHome'\)\.after\(g\)/.test(a) || !/\$\('topL'\)\.after\(g\)/.test(a)) throw 'dia group placement';
  console.log('diaGrp ok');
}
