// Validate data/machines/*.json (builder machine presets). Usage: node scripts/validate-machines.mjs
import fs from 'node:fs';
const dir = new URL('../data/machines/', import.meta.url);
const TYPES = new Set(['mill', 'lathe', 'mill-turn', 'swiss', 'grinder', 'manual-mill', 'manual-lathe']);
const num = x => x === null || (typeof x === 'number' && x > 0);
export function validateMachines(doc, name = '') {
  const e = []; const E = (w, m) => e.push(`${name} ${w}: ${m}`);
  if (doc.schema !== 1) E('', 'schema must be 1'); if (!doc.builder) E('', 'builder required');
  if (!Array.isArray(doc.models) || !doc.models.length) E('', 'models must be non-empty');
  for (const m of doc.models || []) { const w = m.model || '?';
    if (!m.model) E(w, 'model required'); if (!TYPES.has(m.type)) E(w, 'bad type ' + m.type);
    if (!/^https:\/\//.test(m.source?.url || '')) E(w, 'source.url (https) required'); if (!/^\d{4}-\d\d-\d\d$/.test(m.source?.accessed || '')) E(w, 'source.accessed date required');
    for (const k of ['rapid_ipm', 'max_thread_ipm']) if (!num(m[k] ?? null)) E(w, k + ' must be number or null');
    if (!Array.isArray(m.spindles) || !m.spindles.length) E(w, 'spindles must be non-empty');
    for (const s of m.spindles || []) { if (!s.option) E(w, 'spindle option name required');
      for (const k of ['rpm', 'kw_peak', 'kw_cont', 'hp_peak', 'hp_cont', 'torque_nm']) if (!num(s[k] ?? null)) E(w, `${s.option} ${k} must be number or null`);
      if (m.type !== 'grinder' && !s.rpm) E(w, s.option + ' rpm required for non-grinder'); } }
  return e;
}
if (process.argv[1]?.endsWith('validate-machines.mjs')) {
  const idx = JSON.parse(fs.readFileSync(new URL('index.json', dir))); const errs = [];
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json') && f !== 'index.json');
  for (const f of files) { if (!idx.builders.some(b => b.file === f)) errs.push(f + ' missing from index.json'); errs.push(...validateMachines(JSON.parse(fs.readFileSync(new URL(f, dir))), f)); }
  if (errs.length) { console.error(errs.join('\n')); process.exit(1); } console.log(`machines ok: ${files.length} builders`);
}
