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
