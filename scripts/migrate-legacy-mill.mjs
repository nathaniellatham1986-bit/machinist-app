// One-time: convert v0 mill files (tools[].recommendations) to schema 1 (tools[].conditions).
import fs from 'node:fs';
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
for (const f of ['kennametal', 'sandvik', 'iscar']) {
  const p = `data/${f}.json`; if (!fs.existsSync(p)) continue;
  const d = JSON.parse(fs.readFileSync(p));
  const tools = d.tools.map(({ recommendations, ...t }) => ({ mode: 'mill', ...t, conditions: recommendations.map(r => ({
    label: `ISO ${r.iso} ${r.subgroup ?? ''}`.trim(), iso: r.iso, ...(r.subgroup ? { subgroup: r.subgroup } : {}), status: r.status, coolant: r.coolant ?? null,
    sfm: r.vc ?? null, feed: r.fz ? { kind: 'fz', unit: r.fz.unit, byDiameter: r.fz.byDiameter } : null,
    ...(r.ap_xD != null ? { apx: r.ap_xD } : {}), ...(r.ae_xD != null ? { aex: r.ae_xD } : {}), source: { kind: 'catalog', ...r.source } })) }));
  fs.writeFileSync(`data/${slug(d.brand)}-mill.json`, JSON.stringify({ schema: 1, brand: d.brand, tools }, null, 1)); fs.unlinkSync(p);
}
