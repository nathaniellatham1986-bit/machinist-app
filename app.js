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
let mode = q.get('mode') || 'mill', defs = {};
function feedAt(f, dIn) {
  if (!f) return null;
  if (f.range) return pick(f.range, toIn(1, f.unit));
  if (f.bands) { const b = f.bands.find(([a, z]) => dIn >= a - 1e-4 && dIn <= z + 1e-4); return b ? pick({ value: b[2] }) : null; }
  for (const [k, v] of Object.entries(f.byDiameter || {})) if (Math.abs(toIn(+k, f.unit) - dIn) < 0.02)
    return pick(typeof v === 'object' ? v : { value: v }, toIn(1, f.unit));
  return null;
}
const fmt = (p, dp) => p ? (p.min != null ? `${p.min.toFixed(dp)} – ${p.def.toFixed(dp)} – ${p.max.toFixed(dp)}` : p.def.toFixed(dp)) : '';
function setMode(m) {
  mode = m; document.querySelectorAll('[data-mode]').forEach(b => b.classList.toggle('on', b.dataset.mode === m));
  document.querySelectorAll('[data-show]').forEach(e => e.hidden = !e.dataset.show.split(' ').includes(m));
  $('feedLbl').firstChild.textContent = m === 'mill' ? 'Chip load (in/tooth)' : m === 'tap' ? 'Pitch (in)' : 'Feed (in/rev)';
  $('dLbl').firstChild.textContent = m === 'turn' ? 'Work dia (in)' : m === 'tap' ? 'Tap dia (in)' : 'Tool dia (in)';
  $('tool').length = 0; TOOLS[m].forEach((t, i) => $('tool').add(new Option(`${t.brand} — ${t.series}`, i)));
  fillCond();
}
function fillCond() {
  const t = TOOLS[mode][$('tool').value]; $('cond').length = 0;
  (t?.conditions || []).forEach((c, i) => $('cond').add(new Option(c.label + (c.coolant ? ` · ${c.coolant}` : ''), i)));
  if (t?.flutes) $('z').value = t.flutes;
  fill();
}
function fill() {
  const t = TOOLS[mode][$('tool').value], c = t?.conditions[$('cond').value];
  if (mode === 'tap') { const th = threads.threads[$('thr').value]; $('d').value = th.d_in; $('fpt').value = th.pitch_in; }
  const d = +$('d').value, cool = $('cool').value;
  const sp = c && pick(c.sfm, spdK(c.sfm?.unit)), fd = mode === 'tap' ? null : c && feedAt(c.feed, d);
  defs = { sfm: sp?.def ?? null, fpt: mode === 'tap' ? +$('fpt').value : fd?.def ?? null };
  $('sfm').value = sp ? Math.round(sp.def) : ''; if (mode !== 'tap') $('fpt').value = fd ? fd.def.toFixed(4) : '';
  const NO = '<span class="warn">No manufacturer data</span>';
  let h = '';
  if (!c) h = `${NO} for ${t ? t.brand + ' ' + t.series : 'this mode'}.` + (t?.notes ? `<br>${t.notes}` : '');
  else {
    const s = c.source;
    h = `<span class="tag">${c.status.toUpperCase()}</span> ${s.manufacturer} · ${s.catalog} · ${s.edition}${s.page ? ' · ' + s.page : ''} · <a style="color:#9cf" href="${s.url}">source</a>`
      + `<br><b>SFM:</b> ${sp ? fmt(sp, 0) + ' ft/min — default = ' + sp.basis : NO}`
      + (mode === 'tap' ? '' : `<br><b>${mode === 'mill' ? 'Chip load' : 'Feed/rev'}:</b> ${fd ? fmt(fd, 4) + ' in — default = ' + fd.basis : NO + ' at this diameter'}`)
      + (c.ap ? `<br>ap ${c.ap.min ?? '≤'}${c.ap.min != null ? '–' : ''}${c.ap.max} ${c.ap.unit}` : '') + (c.apx ? `<br>ap ${c.apx}×D, ae ${c.aex}×D` : '')
      + (c.coolant ? `<br>Coolant: ${c.coolant} (manufacturer stated)` : `<br><span class="warn">Coolant not stated in source; values not adjusted for ${cool}.</span>`)
      + (s.notes ? `<br>${s.notes}` : '') + (t.notes ? `<br>${t.notes}` : '');
  }
  if (mode === 'tap') { const th = threads.threads[$('thr').value];
    h += `<br><b>Tap drill 75%:</b> ${th.drill75_mm ? th.drill75_mm + ' mm / ' : ''}${th.drill75_in.toFixed(4)} in (geometry)${th.chart ? ' · chart pick ' + th.chart : ''}<br><small>${threads.source.formula}. ${th.chart ? threads.source.chart : ''}</small>`; }
  $('src').innerHTML = h; run();
}
const mine = k => defs[k] == null || Math.abs(+$(k).value - defs[k]) > (k === 'sfm' ? 0.5 : 5e-5);
function run() {
  const v = k => +$(k).value, tag = k => mine(k) && $(k).value ? ' <span class="tag warn">YOUR VALUE, NOT MANUFACTURER</span>' : '';
  if (!v('sfm') || !v('fpt') || !v('d')) { $('out').innerHTML = '<span class="warn">No manufacturer data</span> — results need SFM and feed. You may type your own (it will be labeled as yours).'; return; }
  let o, h = '';
  if (mode === 'mill') { o = compute({ sfm: v('sfm'), d: v('d'), fpt: v('fpt'), z: v('z'), ae: v('ae'), ap: v('ap'), stickout: v('so'), maxRpm: v('maxRpm'), maxHp: v('maxHp'), iso: TOOLS.mill[$('tool').value].conditions[$('cond').value]?.iso });
    h = `Feed IPM<div class="big">${o.ipm.toFixed(1)}</div>${o.hpCapped ? '<div class="warn">Feed cut to fit machine HP</div>' : ''}Adjusted chip load ${o.fpt.toFixed(4)} in/t <span class="tag">thinning + stickout (derived)</span><br>Est. power ${o.hp.toFixed(1)} HP <span class="tag">DERIVED</span>`; }
  if (mode === 'drill') { o = drill({ sfm: v('sfm'), d: v('d'), ipr: v('fpt'), maxRpm: v('maxRpm') }); h = `Feed IPM<div class="big">${o.ipm.toFixed(2)}</div>`; }
  if (mode === 'turn') { o = turn({ sfm: v('sfm'), d: v('d'), ipr: v('fpt'), ap: v('apT'), maxRpm: v('maxRpm') });
    h = `Feed IPM<div class="big">${o.ipm.toFixed(2)}</div>MRR ${o.mrr.toFixed(2)} in³/min${o.capped ? ` (at capped ${Math.round(o.sfmActual)} SFM)` : ''}`; }
  if (mode === 'tap') { o = tap({ sfm: v('sfm'), d: v('d'), pitch: v('fpt'), maxRpm: v('maxRpm') }); h = `Feed IPM (RPM × pitch)<div class="big">${o.ipm.toFixed(2)}</div>`; }
  $('out').innerHTML = `RPM<div class="big">${Math.round(o.rpm)}</div>${o.capped ? '<div class="warn">Capped at machine max RPM</div>' : ''}${h}<br>SFM ${v('sfm')}${tag('sfm')}${mode === 'tap' ? '' : '<br>Feed ' + v('fpt') + tag('fpt')}`;
}
document.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => setMode(b.dataset.mode));
$('tool').onchange = fillCond; ['cond', 'd', 'cool', 'thr'].forEach(k => $(k).onchange = fill);
['z', 'sfm', 'fpt', 'ae', 'ap', 'apT', 'so', 'maxRpm', 'maxHp'].forEach(k => $(k).oninput = run);
if (q.get('d')) $('d').value = q.get('d');
setMode(mode);
for (const k of ['tool', 'cond', 'thr']) if (q.get(k)) { $(k).value = q.get(k); k === 'tool' ? fillCond() : fill(); }
if (q.get('d')) { $('d').value = q.get('d'); fill(); }
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
