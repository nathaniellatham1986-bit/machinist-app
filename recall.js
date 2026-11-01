// Recall list helpers: each saved setup carries its mode; legacy entries get it inferred from the tool record.
export const MODES = ['mill', 'drill', 'turn', 'tap', 'bore'];
export function inferMode(s, tools) {
  if (MODES.includes(s?.mode)) return s.mode;
  const t = tools.find(x => x.key === s?.v?.tool); if (t?.mode) return t.mode;
  const m = /^(\w+) ·/.exec(s?.name ?? ''); return m && MODES.includes(m[1]) ? m[1] : null;
}
export const migrate = (list, tools) => list.map(s => ({ ...s, mode: inferMode(s, tools) }));
// entries for the current mode, keeping each one's index in the stored list
export const forMode = (list, mode) => list.map((s, i) => [s, i]).filter(([s]) => s.mode === mode);

// Machine profiles: no duplicates. Key = builder preset ref (builder+model+spindle option) or custom name.
const MVALS = ['type', 'rpm', 'hp', 'thrIpm'];
export const machKey = x => x.preset ? 'p:' + x.preset : 'c:' + String(x.name || '').trim().toLowerCase();
export const sameMach = (a, b) => machKey(a) === machKey(b) && MVALS.every(k => (a[k] ?? null) === (b[k] ?? null)) && JSON.stringify(a.live ?? null) === JSON.stringify(b.live ?? null);
// Live tooling (lathe turrets): only lathe-type profiles; every limit is the user's own number from the manual (null = not entered).
export const LATHE_TYPES = ['lathe', 'swiss', 'mill-turn'];
export const FTLB_NM = 1.35582;
export function liveFrom({ type, on, rpm, hp, torque, torqueU, holder }) {
  if (!on || !LATHE_TYPES.includes(type)) return null; const n = x => (+x > 0 ? +x : null), t = n(torque);
  return { rpm: n(rpm), hp: n(hp), torqueNm: t == null ? null : torqueU === 'ftlb' ? +(t * FTLB_NM).toFixed(2) : t, torqueU: torqueU === 'ftlb' ? 'ftlb' : 'nm', holder: ['axial', 'radial', 'both'].includes(holder) ? holder : null };
}
// Returns { list, index, action }: 'existing' (identical, just select), 'updated' (same key, edited values, in place), 'added'.
export function upsertMachine(list, r) {
  const out = list.slice(), same = out.findIndex(x => sameMach(x, r));
  if (same >= 0) return { list: out, index: same, action: 'existing' };
  const k = out.findIndex(x => machKey(x) === machKey(r));
  if (k >= 0) { out[k] = r; return { list: out, index: k, action: 'updated' }; }
  out.push(r); return { list: out, index: out.length - 1, action: 'added' };
}
// Merge exact duplicates only; distinct profiles are kept. map[oldIndex] = newIndex.
export function dedupeMachines(list) {
  const out = [], map = [];
  list.forEach((x, i) => { const j = out.findIndex(y => sameMach(y, x)); if (j >= 0) map[i] = j; else { map[i] = out.length; out.push(x); } });
  return { list: out, map, changed: out.length !== list.length };
}
// Delete saved machine i; remap per-mode active indices (deleted one -> '' = none).
export function removeMachine(list, i, last) {
  const out = {}; for (const [k, v] of Object.entries(last)) out[k] = v === '' || v == null ? '' : +v === i ? '' : +v > i ? String(+v - 1) : String(v);
  return { list: list.filter((_, j) => j !== i), last: out };
}
