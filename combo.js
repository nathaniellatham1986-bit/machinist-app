// Type-to-filter dropdowns. The original <select> stays the source of truth (hidden); picking sets its value and fires 'change'.
export function filterOpts(labels, q) {
  const s = q.trim().toLowerCase(), w = s.split(/\s+/).filter(Boolean);
  const score = l => { l = l.trim().toLowerCase(); return l.startsWith(s) ? 0 : l.split(/[\s(·—,]+/).some(x => x.startsWith(w[0])) ? 1 : 2; };
  return labels.map((l, i) => [l, i]).filter(([l]) => w.every(x => l.toLowerCase().includes(x)))
    .map(([l, i]) => [score(l), i]).sort((a, b) => a[0] - b[0] || a[1] - b[1]).map(x => x[1]);
}
// opts.action(option) -> {label,title,run} or null: adds a per-row button; first tap arms ('Delete?'), second tap runs.
export function enhance(sel, opts = {}) {
  const wrap = document.createElement('div'), inp = document.createElement('input'), list = document.createElement('div');
  wrap.className = 'combo'; inp.type = 'text'; inp.autocomplete = 'off'; inp.setAttribute('role', 'combobox'); list.className = 'combo-list'; list.hidden = true;
  sel.before(wrap); wrap.append(inp, list, sel); sel.hidden = true;
  const txt = () => sel.selectedIndex >= 0 ? sel.options[sel.selectedIndex].text.trim() : '';
  const sync = () => { if (document.activeElement !== inp) inp.value = txt(); inp.disabled = sel.disabled; inp.placeholder = sel.options[0]?.text.trim() ?? ''; };
  const d = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');
  Object.defineProperty(sel, 'value', { get() { return d.get.call(this); }, set(v) { d.set.call(this, v); sync(); } });
  new MutationObserver(sync).observe(sel, { childList: true, subtree: true, attributes: true });
  sel.addEventListener('change', sync);
  let hits = [];
  const show = q => { const o = [...sel.options]; hits = filterOpts(o.map(x => x.text), q).filter(i => !o[i].disabled || q === '');
    list.innerHTML = ''; hits.slice(0, 200).forEach(i => { const b = document.createElement('div'); b.className = 'combo-row' + (o[i].disabled ? ' off' : '') + (i === sel.selectedIndex ? ' cur' : ''); b.dataset.i = i; const t = document.createElement('span'); t.className = 'combo-txt'; t.textContent = o[i].text; b.append(t); const a = opts.action?.(o[i]); if (a) { const x = document.createElement('button'); x.type = 'button'; x.className = 'combo-act'; x.textContent = a.label; x.title = a.title || ''; x.onclick = e => { e.stopPropagation(); if (!x.classList.contains('armed')) { x.classList.add('armed'); x.textContent = 'Delete?'; return; } a.run(); inp.value = ''; show(''); }; b.append(x); } list.append(b); });
    if (!hits.length) list.innerHTML = '<div class="combo-row off">No match</div>'; list.hidden = false; };
  const pick = i => { const o = sel.options[i]; if (!o || o.disabled) return; list.hidden = true; inp.blur(); sel.selectedIndex = i; inp.value = txt(); sel.dispatchEvent(new Event('change', { bubbles: true })); };
  inp.addEventListener('focus', () => { inp.select(); show(''); });
  inp.addEventListener('click', () => { if (list.hidden) show(''); });
  inp.addEventListener('input', () => show(inp.value));
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); const i = hits.find(i => !sel.options[i].disabled); if (i != null) pick(i); } if (e.key === 'Escape') { list.hidden = true; inp.blur(); } });
  inp.addEventListener('blur', () => setTimeout(() => { list.hidden = true; inp.value = txt(); }, 150));
  list.addEventListener('pointerdown', e => e.preventDefault());
  list.addEventListener('click', e => { if (e.target.closest('.combo-act')) return; const r = e.target.closest('.combo-row'); if (r?.dataset.i) pick(+r.dataset.i); });
  sync(); return inp;
}
