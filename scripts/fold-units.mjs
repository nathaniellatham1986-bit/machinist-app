// Fold metric duplicates of inch conditions into altSources on the inch condition so each condition shows once.
// A metric row pairs with an inch row only if iso, subgroup and feed (mm/25.4 vs in, ±20%) match; otherwise both stay visible.
// node scripts/fold-units.mjs primary.json [alt.json]  (alt file: matched by tool grade, then deleted if fully folded)
import fs from 'node:fs';
const [pp, ap] = process.argv.slice(2), P = JSON.parse(fs.readFileSync(pp)), A = ap ? JSON.parse(fs.readFileSync(ap)) : null;
const fv = c => { const r = c.feed?.range; return r ? (r.value ?? r.start ?? (r.min + r.max) / 2) : null; };
const sv = c => c.sfm?.value ?? c.sfm?.start ?? (c.sfm ? (c.sfm.min + c.sfm.max) / 2 : null);
let n = 0, left = 0;
P.tools.forEach(t => {
  const pool = A ? (A.tools.find(x => x.grade === t.grade)?.conditions ?? []) : t.conditions.filter(c => c.sfm?.unit === 'm/min');
  const used = new Set();
  for (const c of t.conditions) { if (c.sfm?.unit !== 'ft/min') continue;
    const m = pool.find(a => !used.has(a) && a.iso === c.iso && a.subgroup === c.subgroup && fv(a) != null && fv(c) != null
      && Math.abs(fv(a) / 25.4 / fv(c) - 1) < 0.2 && (sv(a) == null || sv(c) == null || Math.abs(sv(c) / (sv(a) * 3.2808) - 1) < 0.15));
    if (!m) continue; used.add(m); n++;
    c.altSources = [...(c.altSources || []), { source: m.source, label: m.label, ...(m.sfm ? { sfm: m.sfm } : {}), ...(m.feed ? { feed: m.feed } : {}) }]; }
  if (A) { const at = A.tools.find(x => x.grade === t.grade); if (at) { at.conditions = at.conditions.filter(a => !used.has(a)); left += at.conditions.length; } }
  else { t.conditions = t.conditions.filter(c => !used.has(c)); left += t.conditions.filter(c => c.sfm?.unit === 'm/min').length; }
});
fs.writeFileSync(pp, JSON.stringify(P));
if (A) { A.tools = A.tools.filter(t => t.conditions.length); if (A.tools.length) fs.writeFileSync(ap, JSON.stringify(A)); else fs.unlinkSync(ap); }
console.log(pp, 'folded', n, 'metric rows left unpaired', left);
