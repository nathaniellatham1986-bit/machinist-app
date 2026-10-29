// Proof for the INDEXABLE kill switch: dump every calculator output over all data with the feature on and off, then diff.
// Usage: node scripts/dump-indexable.mjs   (prints the diff summary; exit 1 if any tool without bodies changes)
import fs from 'node:fs';
import * as C from '../calc.js';
const J = p => JSON.parse(fs.readFileSync(new URL('../data/' + p, import.meta.url)));
const IDX = J('index.json'), MATS = J('materials.json').materials;
const BODY_KIND = { face: 'Face mill', shoulder: 'Shoulder mill', 'high-feed': 'High-feed mill', round: 'Round-insert mill', drill: 'Indexable drill' };
const r6 = x => x == null || !Number.isFinite(x) ? x : +x.toPrecision(6);
const clean = o => JSON.parse(JSON.stringify(o, (k, v) => typeof v === 'number' ? r6(v) : v));
function dump(on) { const out = {};
  for (const f of IDX.files) { const doc = J(f.file);
    f.tools.forEach((s0, i) => { const t = C.withPairs(doc.tools[i]), key = f.file + '#' + i, rows = [];
      const s = { ...s0 }; if (on && s.bd?.length) Object.assign(s, { ps: s.bd, dr: [Math.min(...s.bd) - 5e-3, Math.max(...s.bd) + 5e-3], dd: (s.bIsos ?? []).flatMap(k => s.bd.map(x => [k, x - 5e-3, x + 5e-3])), fullIsos: s.bIsos ?? [] });
      const kind = on && t.bodies?.[0] ? BODY_KIND[t.bodies[0].type] : C.kindOf(s);
      const dias = [...new Set([...(s0.ps ?? []), ...(s.bd ?? []), 0.5])].slice(0, 6);
      t.conditions.forEach((c, ci) => { const sp = C.pick(c.sfm, c.sfm?.unit === 'm/min' ? 3.2808 : 1)?.def;
        for (const d of dias) { const ix = on && t.mode === 'mill' && t.bodies && C.bodyAt(t, d);
          if (ix) { if (c.kind !== 'insert-selection') continue; for (const g of [c.grade]) for (const w of C.indexableWocs(c)) { const P = C.indexablePair(t, c, g, w);
              rows.push(['ix', ci, d, w, P.sfm, P.fz, P.sfm != null ? clean(C.millIndexable({ sfm: P.sfm, body: ix, inserts: ix.z, fz: P.fz, woc: w, ap: c.ap?.value ?? .1, maxRpm: 0, maxHp: 0, iso: c.iso })) : null]); } continue; }
          if (!sp) { rows.push(['nodata', ci, d]); continue; }
          if (t.mode === 'mill') { const fz = c.feed?.range ? C.pick(c.feed.range)?.def : null; rows.push(['mill', ci, d, fz ? clean(C.compute({ sfm: sp, d, fpt: fz, z: t.flutes || 4, ae: .25 * d, ap: d, stickout: 3 * d, maxRpm: 10000, maxHp: 15, iso: c.iso })) : r6(C.rpm(sp, d))]); }
          else if (t.mode === 'drill') rows.push(['drill', ci, d, clean(C.drill({ sfm: sp, d, ipr: .005, maxRpm: 10000 }))]);
          else if (t.mode === 'turn') rows.push(['turn', ci, clean(C.turn({ sfm: sp, d: 2, ipr: .008, ap: .05, maxRpm: 4000 }))]);
          else if (t.mode === 'tap') rows.push(['tap', ci, clean(C.tap({ sfm: sp, d: .25, pitch: .05, maxRpm: 4000 }))]);
          else rows.push([t.mode, ci, clean(C.drill({ sfm: sp, d, ipr: .004, maxRpm: 10000 }))]); if (t.mode === 'turn' || t.mode === 'tap') break; } });
      out[key] = { kind, index: s, rows, bodies: !!t.bodies }; }); }
  return out; }
const off = dump(false), on = dump(true), changed = Object.keys(off).filter(k => JSON.stringify(off[k]) !== JSON.stringify(on[k]));
const bad = changed.filter(k => !off[k].bodies);
fs.writeFileSync('/tmp/ix-off.json', JSON.stringify(off)); fs.writeFileSync('/tmp/ix-on.json', JSON.stringify(on));
console.log(`tools ${Object.keys(off).length}, rows ${Object.values(off).reduce((n, x) => n + x.rows.length, 0)}; changed ${changed.length} (all with printed bodies: ${!bad.length}) ${changed.join(', ')}`);
if (bad.length) { console.log('UNEXPECTED:', bad.slice(0, 20)); process.exit(1); }
