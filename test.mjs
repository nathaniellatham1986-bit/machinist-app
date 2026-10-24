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
assert.equal(pick({ min: 40 }), null); assert.equal(pick(null), null);
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
const pe = TJ.find(x => x.series.startsWith('PENTA')).conditions[0]; assert.deepEqual([pe.sfm.min, pe.sfm.max, pe.feed.range.max], [60, 150, .05]);
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
