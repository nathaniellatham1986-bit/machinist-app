import { compute, drill, turn, tap, pick } from './calc.js';
const $ = id => document.getElementById(id);
const J = u => fetch(u).then(r => r.json());
const idx = await J('data/index.json');
const MM = 25.4, toIn = (v, u) => (u === 'mm' ? v / MM : v);
const spdK = u => (u === 'm/min' ? 3.2808 : 1);
// Adapt v0 milling records to the shared condition shape.
const millTools = (await Promise.all(idx.brands.map(b => J('data/' + b)))).flatMap(b => b.tools).map(t => ({
  mode: 'mill', brand: t.brand, series: t.series, flutes: t.flutes, notes: t.notes,
  conditions: t.recommendations.map(r => ({ label: `ISO ${r.iso} ${r.subgroup ?? ''}`.trim(), iso: r.iso, coolant: r.coolant, sfm: r.vc, status: r.status, source: r.source,
    feed: { kind: 'fz', unit: r.fz.unit, byDiameter: r.fz.byDiameter }, apx: r.ap_xD, aex: r.ae_xD }))
}));
const load = async k => (await Promise.all((idx[k] || []).map(b => J('data/' + b)))).flatMap(b => b.tools);
const TOOLS = { mill: millTools, drill: await load('drill'), turn: await load('turn'), tap: await load('tap') };
const threads = await J('data/threads.json');
threads.threads.forEach((t, i) => $('thr').add(new Option(t.name, i)));
const q = new URLSearchParams(location.search);
const LS = { get: (k, d) => { try { return JSON.parse(localStorage.getItem('fs.' + k)) ?? d; } catch { return d; } }, set: (k, v) => localStorage.setItem('fs.' + k, JSON.stringify(v)) };
let mode = q.get('mode') || 'mill', defs = {};
const ISO = [['', 'All materials'], ...idx.materialGroups];
ISO.forEach(([k, n]) => $('iso').add(new Option(k ? `${k} — ${n}` : n, k)));
const isoOk = c => !$('iso').value || c.iso === '*' || c.iso === $('iso').value;
const hasData = c => c.sfm || c.feed;
function feedAt(f, dIn) {
  if (!f) return null;
  if (f.range) return pick(f.range, toIn(1, f.unit));
  if (f.bands) { const b = f.bands.find(([a, z]) => dIn >= a - 1e-4 && dIn <= z + 1e-4); return b ? pick({ value: b[2] }) : null; }
  for (const [k, v] of Object.entries(f.byDiameter || {})) if (Math.abs(toIn(+k, f.unit) - dIn) < 0.02)
    return pick(typeof v === 'object' ? v : { value: v }, toIn(1, f.unit));
  return null;
}
const fmt = (p, dp) => p ? (p.min != null ? `${p.min.toFixed(dp)} – ${p.def.toFixed(dp)} – ${p.max.toFixed(dp)}` : p.def.toFixed(dp)) : '';
// Machines
function machines() { const m = LS.get('machines', []); const sel = $('mach'), cur = sel.value || LS.get('lastMachine', '');
  sel.length = 1; m.forEach((x, i) => sel.add(new Option(`${x.name} (${x.type}, ${x.rpm || '?'} RPM, ${x.hp || '?'} HP)`, i))); sel.value = m[cur] ? cur : ''; return m; }
function applyMachine() { const m = LS.get('machines', [])[$('mach').value]; LS.set('lastMachine', $('mach').value);
  if (m) { $('maxRpm').value = m.rpm || ''; $('maxHp').value = m.hp || ''; } run(); }
$('mSave').onclick = () => { const n = $('mName').value.trim(); if (!n) return; const m = LS.get('machines', []);
  m.push({ name: n, type: $('mType').value, rpm: +$('mRpm').value || null, hp: +$('mHp').value || null }); LS.set('machines', m); machines(); $('mach').value = m.length - 1; applyMachine(); };
$('mDel').onclick = () => { const m = LS.get('machines', []); if ($('mach').value === '') return; m.splice(+$('mach').value, 1); LS.set('machines', m); $('mach').value = ''; machines(); };
// Selection chain: material -> brand -> tool -> condition
function setMode(m) {
  mode = m; document.querySelectorAll('[data-mode]').forEach(b => b.classList.toggle('on', b.dataset.mode === m));
  document.querySelectorAll('[data-show]').forEach(e => e.hidden = !e.dataset.show.split(' ').includes(m));
  $('feedLbl').firstChild.textContent = m === 'mill' ? 'Chip load (in/tooth)' : m === 'tap' ? 'Pitch (in)' : 'Feed (in/rev)';
  $('dLbl').firstChild.textContent = m === 'turn' ? 'Work dia (in)' : m === 'tap' ? 'Tap dia (in)' : 'Tool dia (in)';
  $('brand').length = 0; $('tool').length = 0; fillBrand();
}
const toolOk = t => !$('onlyData').checked || t.conditions.some(c => isoOk(c) && hasData(c));
function fillBrand() { const cur = $('brand').value; $('brand').length = 0;
  [...new Set(TOOLS[mode].filter(toolOk).map(t => t.brand))].forEach(b => $('brand').add(new Option(b, b)));
  if ([...$('brand').options].some(o => o.value === cur)) $('brand').value = cur; fillTool(); }
function fillTool() { const cur = $('tool').value; $('tool').length = 0;
  TOOLS[mode].forEach((t, i) => { if (t.brand === $('brand').value && toolOk(t)) $('tool').add(new Option(t.series, i)); });
  if ([...$('tool').options].some(o => o.value === cur)) $('tool').value = cur; fillCond(); }
function fillCond() {
  const t = TOOLS[mode][$('tool').value]; $('cond').length = 0;
  (t?.conditions || []).forEach((c, i) => { if (isoOk(c)) $('cond').add(new Option(c.label + (c.coolant ? ` · ${c.coolant}` : '') + (c.status === 'shop-proven' ? ' · SHOP-PROVEN' : ''), i)); });
  if (t?.flutes) $('z').value = t.flutes;
  fill(); recent();
}
function badge(c) { const s = c.source;
  if (c.status === 'shop-proven') return `<span class="shop">⚠ Shop-proven, NOT manufacturer data ▸</span>`;
  return `${s.manufacturer} ${s.kind === 'label' ? 'box label' : 'catalog'} ✓ ▸`; }
function fill() {
  const t = TOOLS[mode][$('tool').value], c = t?.conditions[$('cond').value];
  if (mode === 'tap') { const th = threads.threads[$('thr').value]; $('d').value = th.d_in; $('fpt').value = th.pitch_in; }
  const d = +$('d').value, cool = $('cool').value; LS.set('lastCoolant', cool);
  const shop = c?.status === 'shop-proven';
  const sp = c && pick(c.sfm, spdK(c.sfm?.unit)), fd = mode === 'tap' ? null : c && feedAt(c.feed, d);
  if (shop) { if (sp) sp.basis = 'SHOP-PROVEN value, not manufacturer'; if (fd) fd.basis = 'SHOP-PROVEN value, not manufacturer'; }
  defs = { sfm: sp?.def ?? null, fpt: mode === 'tap' ? +$('fpt').value : fd?.def ?? null };
  $('sfm').value = sp ? Math.round(sp.def) : ''; if (mode !== 'tap') $('fpt').value = fd ? fd.def.toFixed(4) : '';
  const NO = '<span class="warn">No manufacturer data</span>';
  let h = '';
  if (!c) h = `${NO} for ${t ? t.brand + ' ' + t.series : 'this selection'}.` + (t?.notes ? `<br>${t.notes}` : '');
  else {
    const s = c.source, apU = c.ap ? toIn(1, c.ap.unit) : 1;
    h = `<details><summary>${badge(c)}</summary><span class="tag">${c.status.toUpperCase()}</span> ${s.manufacturer} · ${s.catalog} · ${s.edition}${s.page ? ' · p.' + s.page : ''}${s.url ? ` · <a style="color:#9cf" href="${s.url}">source</a>` : ''}`
      + (s.notes ? `<br>${s.notes}` : '') + (t.notes ? `<br>${t.notes}` : '') + '</details>'
      + `<b>SFM:</b> ${sp ? fmt(sp, 0) + ' ft/min — default = ' + sp.basis : NO}`
      + (mode === 'tap' ? '' : `<br><b>${mode === 'mill' ? 'Chip load' : 'Feed/rev'}:</b> ${fd ? fmt(fd, 4) + ' in — default = ' + fd.basis : NO + ' at this diameter'}`)
      + (c.ap ? `<br><b>DOC ${shop ? '' : 'manufacturer '}${c.ap.min != null ? 'min–max' : 'max'}:</b> ${c.ap.min != null ? (c.ap.min * apU).toFixed(3) + ' – ' : '≤ '}${(c.ap.max * apU).toFixed(3)} in (${c.ap.min ?? ''}${c.ap.min != null ? '–' : '≤'}${c.ap.max} ${c.ap.unit})` : (mode === 'turn' ? `<br><b>DOC:</b> ${NO}` : ''))
      + (c.apx ? `<br>ap ${c.apx}×D, ae ${c.aex}×D` : '')
      + (c.coolant ? `<br>Coolant: ${c.coolant} (${shop ? 'shop record' : 'manufacturer stated'})` : `<br><span class="warn">Coolant not stated in source; values not adjusted for ${cool}.</span>`);
  }
  if (mode === 'tap') { const th = threads.threads[$('thr').value];
    h += `<br><b>Tap drill 75%:</b> ${th.drill75_mm ? th.drill75_mm + ' mm / ' : ''}${th.drill75_in.toFixed(4)} in (geometry)${th.chart ? ' · chart pick ' + th.chart : ''}<br><small>${threads.source.formula}. ${th.chart ? threads.source.chart : ''}</small>`; }
  $('src').innerHTML = h; run();
}
const mine = k => defs[k] == null || Math.abs(+$(k).value - defs[k]) > (k === 'sfm' ? 0.5 : 5e-5);
function run() {
  const v = k => +$(k).value, tag = k => mine(k) && $(k).value ? ' <span class="tag warn">YOUR VALUE, NOT MANUFACTURER</span>' : '';
  const c = TOOLS[mode][$('tool').value]?.conditions[$('cond').value];
  let w = '';
  if (mode === 'turn') {
    if (c?.ap && v('apT')) { const u = toIn(1, c.ap.unit), a = v('apT'); if ((c.ap.min != null && a < c.ap.min * u - 1e-6) || a > c.ap.max * u + 1e-6) w += `<div class="warn">DOC ${a} in is outside the ${c.status === 'shop-proven' ? 'recorded' : 'manufacturer'} range</div>`; }
    if (v('len') && v('d') && v('len') / v('d') > 4 && $('sup').value === 'none') w += `<div class="warn">Slender part: L/D ${(v('len') / v('d')).toFixed(1)} > 4 with no support. Consider a tailstock or steady rest. <span class="tag">GENERAL GUIDELINE, not manufacturer data</span></div>`;
  }
  if (!v('sfm') || !v('fpt') || !v('d')) { $('out').innerHTML = w + '<span class="warn">No manufacturer data</span> — results need SFM and feed. You may type your own (it will be labeled as yours).'; return; }
  let o, h = '';
  if (mode === 'mill') { o = compute({ sfm: v('sfm'), d: v('d'), fpt: v('fpt'), z: v('z'), ae: v('ae'), ap: v('ap'), stickout: v('so'), maxRpm: v('maxRpm'), maxHp: v('maxHp'), iso: c?.iso });
    h = `Feed IPM<div class="big">${o.ipm.toFixed(1)}</div>${o.hpCapped ? '<div class="warn">Feed cut to fit machine HP</div>' : ''}Adjusted chip load ${o.fpt.toFixed(4)} in/t <span class="tag">thinning + stickout (derived)</span><br>Est. power ${o.hp.toFixed(1)} HP <span class="tag">DERIVED</span>`; }
  if (mode === 'drill') { o = drill({ sfm: v('sfm'), d: v('d'), ipr: v('fpt'), maxRpm: v('maxRpm') }); h = `Feed IPM<div class="big">${o.ipm.toFixed(2)}</div>`; }
  if (mode === 'turn') { o = turn({ sfm: v('sfm'), d: v('d'), ipr: v('fpt'), ap: v('apT'), maxRpm: v('maxRpm') });
    h = `Feed IPM<div class="big">${o.ipm.toFixed(2)}</div>MRR ${o.mrr.toFixed(2)} in³/min${o.capped ? ` (at capped ${Math.round(o.sfmActual)} SFM)` : ''}`; }
  if (mode === 'tap') { o = tap({ sfm: v('sfm'), d: v('d'), pitch: v('fpt'), maxRpm: v('maxRpm') }); h = `Feed IPM (RPM × pitch)<div class="big">${o.ipm.toFixed(2)}</div>`; }
  $('out').innerHTML = w + `RPM<div class="big">${Math.round(o.rpm)}</div>${o.capped ? '<div class="warn">Capped at machine max RPM</div>' : ''}${!v('maxRpm') ? '<div class="warn">No machine max RPM set</div>' : ''}${h}<br>SFM ${v('sfm')}${tag('sfm')}${mode === 'tap' ? '' : '<br>Feed ' + v('fpt') + tag('fpt')}`;
}
// Favorites & recent setups
const FIELDS = ['iso', 'brand', 'tool', 'cond', 'thr', 'd', 'z', 'sfm', 'fpt', 'ae', 'ap', 'apT', 'so', 'nose', 'cb', 'len', 'sup', 'cool'];
const snap = () => { const t = TOOLS[mode][$('tool').value], c = t?.conditions[$('cond').value];
  return { mode, name: `${mode} · ${t ? t.brand + ' ' + t.series : '?'} · ${c?.label ?? ''}${$('cb').value ? ' · ' + $('cb').value : ''}`, v: Object.fromEntries(FIELDS.map(k => [k, $(k).value])) }; };
function recent() { const t = TOOLS[mode][$('tool').value]; if (!t) return; const s = snap(), r = LS.get('recent', []).filter(x => x.name !== s.name); r.unshift(s); LS.set('recent', r.slice(0, 8)); recallList(); }
function recallList() { const sel = $('recall'); sel.length = 1;
  LS.get('fav', []).forEach((x, i) => sel.add(new Option('★ ' + x.name, 'f' + i))); LS.get('recent', []).forEach((x, i) => sel.add(new Option('↺ ' + x.name, 'r' + i))); }
$('fav').onclick = () => { const f = LS.get('fav', []); f.unshift(snap()); LS.set('fav', f.slice(0, 30)); recallList(); $('fav').textContent = '★ Saved'; setTimeout(() => $('fav').textContent = '★ Save setup as favorite', 1200); };
$('recall').onchange = () => { const k = $('recall').value; if (!k) return; const s = LS.get(k[0] === 'f' ? 'fav' : 'recent', [])[+k.slice(1)]; if (!s) return;
  setMode(s.mode); $('iso').value = s.v.iso; fillBrand(); $('brand').value = s.v.brand; fillTool(); $('tool').value = s.v.tool; fillCond();
  for (const k2 of FIELDS) if (!['iso', 'brand', 'tool', 'sfm', 'fpt'].includes(k2)) $(k2).value = s.v[k2];
  fill(); $('sfm').value = s.v.sfm; $('fpt').value = s.v.fpt; run(); $('recall').value = ''; };
document.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => setMode(b.dataset.mode));
$('iso').onchange = fillBrand; $('onlyData').onchange = fillBrand; $('brand').onchange = fillTool; $('tool').onchange = fillCond; $('mach').onchange = applyMachine;
$('cond').onchange = () => { fill(); recent(); }; ['d', 'cool', 'thr'].forEach(k => $(k).onchange = fill);
['z', 'sfm', 'fpt', 'ae', 'ap', 'apT', 'so', 'maxRpm', 'maxHp', 'len', 'nose'].forEach(k => $(k).oninput = run); $('sup').onchange = run;
$('cool').value = LS.get('lastCoolant', 'flood'); machines(); { const m = LS.get('machines', [])[$('mach').value]; if (m) { $('maxRpm').value = m.rpm || ''; $('maxHp').value = m.hp || ''; } }
recallList();
if (q.get('iso')) $('iso').value = q.get('iso');
if (q.get('d')) $('d').value = q.get('d');
for (const k of ['len', 'sup', 'apT', 'maxRpm']) if (q.get(k)) $(k).value = q.get(k);
setMode(mode);
if (q.get('tool')) { const t = TOOLS[mode][q.get('tool')]; if (t) { $('onlyData').checked = false; fillBrand(); $('brand').value = t.brand; fillTool(); $('tool').value = q.get('tool'); fillCond(); } }
if (q.get('cond')) { $('cond').value = q.get('cond'); fill(); }
if (q.get('thr')) { $('thr').value = q.get('thr'); fill(); }
if (q.get('d')) { $('d').value = q.get('d'); fill(); }
if (q.get('open')) document.querySelector('#src details')?.setAttribute('open', '');
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
