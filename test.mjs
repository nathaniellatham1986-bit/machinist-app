import assert from 'node:assert/strict';
import fs from 'node:fs';
import { compute, rpm, thinFactor, drill, turn, tap, pick } from './calc.js';
const J = p => JSON.parse(fs.readFileSync(new URL(p, import.meta.url)));
assert.equal(Math.round(rpm(400, .5)), 3056);
assert.equal(+thinFactor(.05, .5).toFixed(3), 1.667);
compute({ sfm: 400, d: .5, fpt: .003, z: 4, ae: .25, ap: .5, stickout: 1.5, maxRpm: 10000, maxHp: 15, iso: 'P' });
// pick: start preferred, midpoint labeled, single value, nothing invented
assert.deepEqual(pick({ min: 50, start: 100, max: 150 }).def, 100);
assert.match(pick({ min: 40, max: 80 }).basis, /MIDPOINT/); assert.equal(pick({ min: 40, max: 80 }).def, 60);
assert.equal(pick({ value: 230 }).basis, 'manufacturer value');
assert.equal(pick({ min: 40 }), null); assert.equal(pick(null), null);
// drill: Allied T-A carbide TiN, 4140 175-225 BHN, 15/16" (1C21T-0030): 230 SFM, .012 IPR
const ta = J('./data/drill-allied.json').tools[0].conditions.find(c => c.label === 'Alloy 4140/5140/8640 175-225 BHN · TiN');
assert.equal(ta.sfm.value, 230); const band = ta.feed.bands.find(([a, z]) => .9375 >= a && .9375 <= z); assert.equal(band[2], .012);
const dr = drill({ sfm: 230, d: .9375, ipr: .012 }); assert.equal(Math.round(dr.rpm), 937); assert.equal(+dr.ipm.toFixed(2), 11.25);
// turn: RPM cap and MRR
const t = turn({ sfm: 328, d: 2, ipr: .00984, ap: .04, maxRpm: 500 }); assert.ok(t.capped); assert.equal(t.rpm, 500);
assert.equal(+t.mrr.toFixed(3), +(500 * 2 / 3.82 * 12 * .04 * .00984).toFixed(3));
// tap: 1/4-20 at 60 SFM -> 917 RPM, IPM = RPM/20
const tp = tap({ sfm: 60, d: .25, pitch: .05 }); assert.equal(Math.round(tp.rpm), 917); assert.equal(+tp.ipm.toFixed(2), 45.84);
const th = J('./data/threads.json').threads; assert.equal(th.find(x => x.name === '1/4-20').drill75_in, .2013); assert.equal(th.find(x => x.name === 'M6x1').drill75_mm, 5.03);
// every loaded condition has a source and a feed/speed or explicit absence; no generic tools
for (const f of ['drill-allied', 'turn', 'tap']) for (const tl of J(`./data/${f}.json`).tools) { assert.ok(!/generic/i.test(tl.brand)); for (const c of tl.conditions) assert.ok(c.source?.url, tl.series); }
assert.ok(!J('./data/index.json').brands.includes('generic.json'));
console.log('all tests pass');
const TJ = J('./data/turn.json').tools;
const thr = TJ.find(x => x.series === 'Threading IC908').conditions.find(c => c.label.startsWith('Grp 6')); assert.deepEqual([thr.sfm.min, thr.sfm.max], [100, 180]);
const nf = TJ.find(x => x.series === 'VNMG-NF IC807').conditions.find(c => c.label.startsWith('Grp 14')); assert.deepEqual([nf.sfm.min, nf.sfm.max], [100, 200]); assert.match(pick(nf.sfm).basis, /MIDPOINT/);
assert.equal(TJ.find(x => x.series.startsWith('BC8110')).conditions[0].sfm, null);
const em = J('./data/tap.json').tools.find(x => x.brand === 'Emuge').conditions.find(c => c.label.startsWith('P2.1')); assert.deepEqual([em.sfm.min, em.sfm.max], [7, 20]);
assert.equal(J('./data/drill-allied.json').tools[0].conditions[0].coolant, 'through-tool');
console.log('phase3 tests pass');
