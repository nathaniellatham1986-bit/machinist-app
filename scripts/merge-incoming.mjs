// Merge worker drops: node scripts/merge-incoming.mjs <incomingDir> <brandDir>
// Flat {records[]} files are converted (scripts/convert-flat.mjs). Passing files go to data/<brand>-<name>.json.
// Originals move to <incoming>/_merged/<brand>/. Failures move to <incoming>/_rejected/<brand>/ with <file>.reason.txt.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validate } from './validate.mjs';
import { convert } from './convert-flat.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const [inc, brand] = process.argv.slice(2);
const dir = path.join(inc, brand), slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const mv = (f, sub) => { const d = path.join(inc, sub, brand); fs.mkdirSync(d, { recursive: true }); fs.renameSync(path.join(dir, f), path.join(d, f)); return d; };
const res = { brand, merged: [], rejected: [], records: 0 };
for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort()) {
  let errs = [], doc;
  try { doc = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    if (Array.isArray(doc.records)) { const c = convert(doc); errs = c.errors; doc = c.doc; }
    if (!errs.length) errs = validate(doc, f);
  } catch (e) { errs = [`${f}: ${e.message}`]; }
  if (errs.length) { const d = mv(f, '_rejected'); fs.writeFileSync(path.join(d, f + '.reason.txt'), errs.join('\n') + '\n'); res.rejected.push({ file: f, errors: errs.length, first: errs[0] }); continue; }
  const b = slug(doc.brand), stem = slug(f.replace(/\.json$/, '')), out = stem.startsWith(b) ? `${stem}.json` : `${b}-${stem}.json`;
  fs.writeFileSync(path.join(root, 'data', out), JSON.stringify(doc));
  mv(f, '_merged'); const n = doc.tools.reduce((a, t) => a + t.conditions.length, 0); res.records += n; res.merged.push({ file: out, records: n });
}
console.log(JSON.stringify(res));
