// Link conditions to app materials only where the source's own material text names the alloy.
// Text = c.material (source's group wording) or, failing that, c.label. Seco SMG codes name no alloys, so Seco is left on its codes.
// sourceGroup is set to the source's wording verbatim so the badge shows it. 303 and 304/316 stay separate.
import fs from 'node:fs';
const RULES = [
  ['ss303', 'M', /\b303\b|free[- ]?machin\w*\s+stainless/i],
  ['ss304', 'M', /\b30[14]L?\b|\b316L?\b|\b321\b|\b347\b/i],
  ['ss17-4ph', 'M', /\b17-?4\b/i],
  ['ss400', 'M', /\b4[0-4]\d\b/],
  ['p-mild', 'P', /\b10\d\d\b|\b10XX\b|\b11XX\b|\b12L?XX\b|\b12L14\b|\bA36\b/i],
  ['p-alloy', 'P', /\b41\d\d\b|\b43\d\d\b|\b41XX\b|\b43XX\b|\b86\d\d\b|\b86XX\b/i],
];
// Hardness/strength numbers (e.g. "<321 HB", "HRC 45", "1000 N/mm²") are not grade numbers: strip them before matching.
export const stripHardness = s => s.replace(/[<>≤≥~]?\s*\d+(?:[.,]\d+)?(?:\s*[-–]\s*\d+(?:[.,]\d+)?)?\s*(?:HBW?|HRC|HRB|HV\d*|N\/mm²?|MPa|ksi)(?![A-Za-z])/gi, ' ')
  .replace(/\b(?:HBW?|HRC|HRB|HV)\s*[<>≤≥]?\s*\d+(?:[.,]\d+)?/gi, ' ');
export const matchIds = (iso, txt) => { const s = stripHardness(txt); return RULES.filter(([, i, re]) => i === iso && re.test(s)).map(([id]) => id); };
export function linkMaterials(doc) {
  let n = 0; if (/^seco/i.test(doc.brand)) return 0;
  for (const t of doc.tools) for (const c of t.conditions) {
    if (c.materials?.length || c.status === 'shop-proven') continue;
    const txt = c.material ?? c.label; const m = matchIds(c.iso, txt);
    if (!m.length) continue; c.materials = m; c.sourceGroup = txt; n++; }
  return n;
}
if (process.argv[1]?.endsWith('link-materials.mjs')) for (const p of process.argv.slice(2)) {
  const d = JSON.parse(fs.readFileSync(p)); const n = linkMaterials(d); if (n) fs.writeFileSync(p, JSON.stringify(d)); console.log(p, n); }
