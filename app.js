import { MODES, migrate, forMode } from './recall.js';
import { compute, drill, turn, tap, pick } from './calc.js';
const $ = id => document.getElementById(id);
const J = u => fetch(u).then(r => r.json());
const idx = await J('data/index.json');
const MM = 25.4, toIn = (v, u) => (u === 'mm' ? v / MM : v);
const spdK = u => (u === 'm/min' ? 3.2808 : 1);
// Lazy data: index.json lists every tool; a brand file is fetched only when one of its tools is picked.
const SUM = idx.files.flatMap(f => f.tools.map(t => ({ ...t, file: f.file, key: f.file + '#' + t.i })));
const DOCS = {};
const ensure = async key => { const f = key?.split('#')[0]; if (f && !DOCS[f]) DOCS[f] = await J('data/' + f); };
const toolBy = key => { if (!key) return null; const [f, i] = key.split('#'); return DOCS[f]?.tools[+i] ?? null; };
const curTool = () => toolBy($('tool').value);
const threads = await J('data/threads.json');
threads.threads.forEach((t, i) => $('thr').add(new Option(t.name, i)));
const q = new URLSearchParams(location.search);
const LS = { get: (k, d) => { try { return JSON.parse(localStorage.getItem('fs.' + k)) ?? d; } catch { return d; } }, set: (k, v) => localStorage.setItem('fs.' + k, JSON.stringify(v)) };
let mode = q.get('mode') || 'mill', defs = {};
const MATS = idx.materials, matSel = () => MATS.find(m => m.id === $('mat').value);
$('matPick').add(new Option('All materials', ''));
for (const [k, n] of idx.materialGroups) { $('matPick').add(new Option(`${n}, any · ISO ${k}`, k));
  MATS.filter(m => m.iso === k).forEach(m => $('matPick').add(new Option(`\u00a0\u00a0${m.name} · ISO ${k}`, k + ':' + m.id))); }
const syncPick = () => { $('matPick').value = $('iso').value + ($('mat').value ? ':' + $('mat').value : ''); };
const fillMat = () => { if (matSel() && matSel().iso !== $('iso').value) $('iso').value = matSel().iso; syncPick(); };
const isoOk = c => { const m = matSel(); if (m) return c.materials ? c.materials.includes(m.id) : (c.iso === m.iso || c.iso === '*');
  return !$('iso').value || c.iso === '*' || c.iso === $('iso').value; };
const hasData = c => c.sfm || c.feed;
function feedAt(f, dIn) {
  if (!f) return null;
  if (f.range) return pick(f.range, toIn(1, f.unit));
  if (f.bands) { const u = toIn(1, f.unit), b = f.bands.find(([a, z]) => dIn >= a * u - 1e-4 && dIn <= z * u + 1e-4); return b ? pick({ value: b[2] }, u) : null; }
  if (f.byWoc) { const e = Object.entries(f.byWoc).find(([k]) => Math.abs(+k - frac.ae) < 0.005);
    return e ? pick(typeof e[1] === 'object' ? e[1] : { value: e[1] }, toIn(1, f.unit)) : null; }
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
  mode = m; recallList(); document.querySelectorAll('[data-mode]').forEach(b => b.classList.toggle('on', b.dataset.mode === m));
  document.querySelectorAll('[data-show]').forEach(e => e.hidden = !e.dataset.show.split(' ').includes(m));
  $('feedLbl').firstChild.textContent = m === 'mill' ? 'Chip load (in/tooth)' : m === 'tap' ? 'Pitch (in)' : 'Feed (in/rev)';
  $('dLbl').firstChild.textContent = m === 'turn' ? 'Work dia (in)' : m === 'tap' ? 'Tap dia (in)' : 'Tool dia (in)';
  $('brand').length = 0; $('tool').length = 0; $('tq').value = ''; $('cq').value = ''; return fillBrand();
}
const toolOk = t => { const m = matSel(); if (m && !(t.mats.includes(m.id) || t.isos.includes(m.iso) || t.isos.includes('*'))) return false;
  return !$('onlyData').checked || t.dataIsos.some(i => i === '*' || !(m?.iso || $('iso').value) || i === (m?.iso || $('iso').value)); };
const inMode = () => SUM.filter(t => t.mode === mode && toolOk(t));
function fillBrand() { const cur = $('brand').value; $('brand').length = 0; $('brand').add(new Option('All brands', ''));
  [...new Set(inMode().map(t => t.brand))].sort().forEach(b => $('brand').add(new Option(b, b)));
  $('brand').value = [...$('brand').options].some(o => o.value === cur) ? cur : ''; return fillTool(); }
const MAXOPT = 300;
function fillTool() { const cur = $('tool').value, b = $('brand').value, words = $('tq').value.toLowerCase().split(/\s+/).filter(Boolean);
  const hits = inMode().filter(t => (!b || t.brand === b) && words.every(w => `${t.brand} ${t.series} ${t.type ?? ''}`.toLowerCase().includes(w)));
  const iso = matSel()?.iso || $('iso').value, rank = t => { const f = t.fullIsos || [], ok = i => !iso || i === iso || i === '*';
    return f.some(x => !x.includes('~') && ok(x)) ? 0 : f.some(x => ok(x.replace('~', ''))) ? 1 : 2; };
  const r2 = t => rank(t) + (/parting|groov|thread/i.test(t.series + (t.type ?? '')) ? .5 : 0); hits.sort((x, y) => r2(x) - r2(y));
  $('tool').length = 0; hits.slice(0, MAXOPT).forEach(t => $('tool').add(new Option(b ? t.series : `${t.brand} — ${t.series}`, t.key)));
  $('tn').textContent = hits.length > MAXOPT ? `(${MAXOPT} of ${hits.length}; refine search)` : `(${hits.length})`;
  if ([...$('tool').options].some(o => o.value === cur)) $('tool').value = cur; return fillCond(); }
async function fillCond() {
  await ensure($('tool').value);
  const t = curTool(); $('cond').length = 0;
  const cw = $('cq').value.toLowerCase().split(/\s+/).filter(Boolean); let nc = 0;
  $('cqL').hidden = (t?.conditions.length ?? 0) < 25 && !cw.length;
  (t?.conditions || []).forEach((c, i) => { if (isoOk(c) && cw.every(w => c.label.toLowerCase().includes(w)) && nc++ < 400) $('cond').add(new Option(c.label + (c.status === 'shop-proven' ? ' · SHOP-PROVEN' : '') + (matSel() && !c.materials ? ' · ISO group only' : ''), i)); });
  { const opts = [...$('cond').options].map(o => [o.value, t.conditions[+o.value]]), full = c => c.sfm && (c.feed || mode === 'tap') && c.status !== 'shop-proven';
    const best = opts.find(([, c]) => full(c) && c.source.kind === 'catalog') || opts.find(([, c]) => full(c)) || opts.find(([, c]) => hasData(c)); if (best) $('cond').value = best[0]; }
  if (t?.flutes) $('z').value = t.flutes;
  fill(); recent();
}
function coolNote() { const c = curTool()?.conditions[$('cond').value];
  $('coolNote').textContent = c ? (c.coolant ? `Coolant (source): ${c.coolant}` : 'Coolant: not stated by source') : '';
}
function badge(c) { const s = c.source;
  if (c.status === 'shop-proven') return `<span class="shop">⚠ Shop-proven, NOT manufacturer data ▸</span>`;
  return `${s.manufacturer} ${s.kind === 'label' ? 'box label' : 'catalog'} ✓${c.sourceGroup ? ' · “' + c.sourceGroup + '”' : ''} ▸`; }
let SP = null, FD = null;
const diaList = c => { const f = c?.feed; if (!f) return []; const u = toIn(1, f.unit);
  if (f.byDiameter) return Object.keys(f.byDiameter).map(k => +k * u).sort((x, y) => x - y);
  if (f.bands) return f.bands.map(([a, z]) => (a + z) / 2 * u); return []; };
function fillDia(c) { const L = mode === 'mill' || mode === 'drill' ? diaList(c) : [], s = $('dPick'); s.length = 0;
  $('dPickL').hidden = L.length < 2; if (!L.length) return;
  const f = c.feed; if (f.byDiameter) L.forEach(x => s.add(new Option(x.toFixed(4) + ' in', x)));
  else f.bands.forEach(([a, z]) => { const u = toIn(1, f.unit); s.add(new Option(`${(a * u).toFixed(3)}–${(z * u).toFixed(3)} in`, (a + z) / 2 * u)); });
  const d = +$('d').value; if (L.length === 1 || !feedAt(f, d)) { const best = L.reduce((p, x) => Math.abs(x - d) < Math.abs(p - d) ? x : p, L[0]); if (L.length === 1 && f.byDiameter) $('d').value = +best.toFixed(4); }
  const hit = [...s.options].find(o => Math.abs(+o.value - +$('d').value) < 0.02); s.value = hit ? hit.value : ''; }
function fill() {
  const t = curTool(), c = t?.conditions[$('cond').value];
  fillDia(c);
  if (mode === 'tap') { const th = threads.threads[$('thr').value]; $('d').value = th.d_in; $('fpt').value = th.pitch_in; }
  const d = +$('d').value, cool = $('cool').value; LS.set('lastCoolant', cool);
  const shop = c?.status === 'shop-proven';
  const sp = c && pick(c.sfm, spdK(c.sfm?.unit)), fd = mode === 'tap' ? null : c && feedAt(c.feed, d);
  if (shop) { if (sp) sp.basis = 'SHOP-PROVEN value, not manufacturer'; if (fd) fd.basis = 'SHOP-PROVEN value, not manufacturer'; }
  SP = sp; FD = fd; defs = { sfm: sp?.def ?? null, fpt: mode === 'tap' ? +$('fpt').value : fd?.def ?? null };
  $('sfm').value = sp ? Math.round(sp.def) : ''; if (mode !== 'tap') $('fpt').value = fd ? fd.def.toFixed(4) : '';
  const NO = '<span class="warn">No manufacturer data</span>';
  let h = '';
  if (!c) h = `${NO} for ${t ? t.brand + ' ' + t.series : 'this selection'}.` + (t?.notes ? `<br>${t.notes}` : '');
  else {
    const s = c.source, apU = c.ap ? toIn(1, c.ap.unit) : 1;
    h = `<details><summary>${badge(c)}</summary><span class="tag">${c.status.toUpperCase()}</span> ${s.manufacturer} · ${s.catalog} · ${s.edition}${s.page ? ' · p.' + s.page : ''}${s.url ? ` · <a style="color:#9cf" href="${s.url}">source</a>` : ''}`
      + (c.sourceGroup ? `<br>Source material group: “${c.sourceGroup}”` : '') + (s.notes ? `<br>${s.notes}` : '') + (t.notes ? `<br>${t.notes}` : '')
      + (c.altSources || []).map(a => `<br><b>Also published:</b> ${a.source.catalog}${a.source.page ? ' · p.' + a.source.page : ''}${a.sfm ? ` · speed ${a.sfm.value ?? a.sfm.start ?? `${a.sfm.min}–${a.sfm.max}`} ${a.sfm.unit}` : ''}${a.feed?.range ? ` · feed ${a.feed.range.value ?? `${a.feed.range.min}–${a.feed.range.max}`} ${a.feed.unit}` : ''}${a.source.url ? ` · <a style="color:#9cf" href="${a.source.url}">source</a>` : ''}`).join('') + '</details>'
      + (c.ap?.value != null ? `<b>DOC ${shop ? '' : 'manufacturer '}stated:</b> ${(c.ap.value * apU).toFixed(3)} in (${c.ap.value} ${c.ap.unit})` : c.ap ? `<br><b>DOC ${shop ? '' : 'manufacturer '}${c.ap.min != null ? 'min–max' : 'max'}:</b> ${c.ap.min != null ? (c.ap.min * apU).toFixed(3) + ' – ' : '≤ '}${(c.ap.max * apU).toFixed(3)} in (${c.ap.min ?? ''}${c.ap.min != null ? '–' : '≤'}${c.ap.max} ${c.ap.unit})` : (mode === 'turn' ? `<br><b>DOC:</b> ${NO}` : ''))
      + (c.apx || c.aex ? `<br>${c.apx ? `ap ${c.apx}×D` : ''}${c.apx && c.aex ? ', ' : ''}${c.aex ? `ae ${c.aex}×D` : ''} (manufacturer)` : '')
      + (c.woc ? `<br>Speed stated for ae = ${(c.woc * 100).toFixed(0)}% of D` : '')
      + (c.feed?.byWoc ? `<br>Chip load published at ae = ${Object.entries(c.feed.byWoc).map(([k, v]) => `${(+k * 100).toFixed(0)}%: ${typeof v === 'object' ? (v.value ?? `${v.min}–${v.max}`) : v} ${c.feed.unit}`).join(', ')}${fd ? '' : ' — set WOC to one of these'}` : '')
      + (c.noseRadius ? `<br>Nose radius ${c.noseRadius.value ?? c.noseRadius.label} ${c.noseRadius.unit}` : '') + (c.leadAngle ? ` · ${c.leadAngle.convention} ${c.leadAngle.deg}°` : '') + (c.toolLife ? ` · tool life ${c.toolLife} min` : '')
      + (c.insertWidth ? `<br>Insert width ${c.insertWidth.value ?? c.insertWidth.label} ${c.insertWidth.unit}` : '')
      + (c.note ? `<br><small>${c.note}</small>` : '') + (c.coolantNote ? `<br><small>${c.coolantNote}</small>` : '')
      + (c.coolant ? `<br>Coolant: ${c.coolant} (${shop ? 'shop record' : 'manufacturer stated'})` : `<br><span class="warn">Coolant not stated in source; values not adjusted for ${cool}.</span>`);
  }
  if (mode === 'tap') { const th = threads.threads[$('thr').value];
    h += `<br><b>Tap drill 75%:</b> ${th.drill75_mm ? th.drill75_mm + ' mm / ' : ''}${th.drill75_in.toFixed(4)} in (geometry)${th.chart ? ' · chart pick ' + th.chart : ''}<br><small>${threads.source.formula}. ${th.chart ? threads.source.chart : ''}</small>`; }
  $('src').innerHTML = h; coolNote(); run();
}
// Mill engagement: stored as fraction of D; shown in % / xD or inches.
const frac = { ae: 0.25, ap: 1 };
const D = () => +$('d').value || 0;
function readEng() { const d = D(); frac.ae = $('aeU').value === 'pct' ? +$('ae').value / 100 : (d ? +$('ae').value / d : 0);
  frac.ap = $('apU').value === 'xd' ? +$('ap').value : (d ? +$('ap').value / d : 0);
  $('aeX').textContent = $('aeU').value === 'pct' ? `= ${(frac.ae * d).toFixed(4)} in` : `= ${(frac.ae * 100).toFixed(1)}% of D`;
  $('apX').textContent = $('apU').value === 'xd' ? `= ${(frac.ap * d).toFixed(4)} in` : `= ${frac.ap.toFixed(2)}×D`; }
function showEng() { const d = D(); $('ae').value = $('aeU').value === 'pct' ? +(frac.ae * 100).toFixed(2) : +(frac.ae * d).toFixed(4);
  $('ap').value = $('apU').value === 'xd' ? +frac.ap.toFixed(3) : +(frac.ap * d).toFixed(4); readEng(); }
$('aeU').onchange = () => { showEng(); run(); }; $('apU').onchange = () => { showEng(); run(); };
const mine = k => defs[k] == null || Math.abs(+$(k).value - defs[k]) > (k === 'sfm' ? 0.5 : 5e-5);
function run() { if (mode === 'mill') readEng();
  const v = k => +$(k).value, tag = k => mine(k) && $(k).value ? ' <span class="tag warn">YOUR VALUE, NOT MANUFACTURER</span>' : '';
  const c = curTool()?.conditions[$('cond').value];
  let w = '';
  if (mode === 'turn') {
    if (c?.ap && v('apT')) { const u = toIn(1, c.ap.unit), a = v('apT'); if ((c.ap.min != null && a < c.ap.min * u - 1e-6) || a > c.ap.max * u + 1e-6) w += `<div class="warn">DOC ${a} in is outside the ${c.status === 'shop-proven' ? 'recorded' : 'manufacturer'} range</div>`; }
    if (v('len') && v('d') && v('len') / v('d') > 4 && $('sup').value === 'none') w += `<div class="warn">Slender part: L/D ${(v('len') / v('d')).toFixed(1)} > 4 with no support. Consider a tailstock or steady rest. <span class="tag">GENERAL GUIDELINE, not manufacturer data</span></div>`;
  }
  const t = curTool(), src = c ? (c.status === 'shop-proven' ? '⚠ SHOP-PROVEN, not manufacturer' : `${c.source.manufacturer} ${c.source.kind === 'label' ? 'box label' : 'catalog'}${c.source.page ? ' p.' + c.source.page : ''} ✓`) : '';
  const YOURS = '<span class="warn">YOUR VALUE, NOT MANUFACTURER</span>';
  const card = (k, val, b, cls = '') => `<div class="card ${cls}"><div class="k">${k}</div><div class="v">${val}</div><div class="b">${b}</div></div>`;
  const fk = mode === 'mill' ? 'Chip load (in/tooth)' : mode === 'tap' ? 'Pitch (in)' : 'Feed (in/rev)';
  let cards = '';
  const sfmB = mine('sfm') && v('sfm') ? YOURS : SP ? `${src} · ${SP.basis}${SP.min != null ? ` · range ${fmt(SP, 0)}` : ''}` : '';
  const fB = mode === 'tap' ? 'thread pitch (geometry)' : mine('fpt') && v('fpt') ? YOURS : FD ? `${src} · ${FD.basis}${FD.min != null ? ` · range ${fmt(FD, 4)}` : ''}` : '';
  cards += v('sfm') ? card('SFM', Math.round(v('sfm')), sfmB, mine('sfm') ? 'mine' : '') : card('SFM', 'No manufacturer data', '', 'none');
  cards += v('fpt') ? card(fk, mode === 'tap' ? v('fpt').toFixed(4) : v('fpt').toFixed(4), fB, mode !== 'tap' && mine('fpt') ? 'mine' : '') : card(fk, 'No manufacturer data' + (c?.feed ? ' at this diameter' : ''), '', 'none');
  let o = null, extra = '';
  if (v('sfm') && v('fpt') && v('d')) {
    if (mode === 'mill') { o = compute({ sfm: v('sfm'), d: v('d'), fpt: v('fpt'), z: v('z'), ae: frac.ae * v('d'), ap: frac.ap * v('d'), stickout: v('so'), maxRpm: v('maxRpm'), maxHp: v('maxHp'), iso: c?.iso });
      extra = card('Est. power', (o.hp < 1 ? o.hp.toFixed(2) : o.hp.toFixed(1)) + ' HP', `DERIVED · MRR ${o.mrr.toFixed(3)} in³/min at WOC ${(frac.ae * v('d')).toFixed(3)} × DOC ${(frac.ap * v('d')).toFixed(3)} in`) + `<div class="card wide"><div class="b">Chip load used for IPM: ${o.fpt.toFixed(4)} in/t (chip thinning + stickout, DERIVED)${o.hpCapped ? ' · <span class="warn">feed cut to fit machine HP</span>' : ''}</div></div>`; }
    if (mode === 'drill') o = drill({ sfm: v('sfm'), d: v('d'), ipr: v('fpt'), maxRpm: v('maxRpm') });
    if (mode === 'turn') { o = turn({ sfm: v('sfm'), d: v('d'), ipr: v('fpt'), ap: v('apT'), maxRpm: v('maxRpm') }); extra = card('MRR', o.mrr.toFixed(2) + ' in³/min', 'DERIVED' + (o.capped ? ` at capped ${Math.round(o.sfmActual)} SFM` : '')); }
    if (mode === 'tap') o = tap({ sfm: v('sfm'), d: v('d'), pitch: v('fpt'), maxRpm: v('maxRpm') });
    const calc = 'CALCULATED from the values above' + (!v('maxRpm') ? ' · <span class="warn">no machine max RPM set</span>' : '');
    cards += card('RPM', Math.round(o.rpm), (o.capped ? '<span class="warn">capped at machine max RPM</span> · ' : '') + calc) + card('Feed IPM', o.ipm.toFixed(mode === 'mill' ? 1 : 2), calc) + extra;
  }
  if (c) { const apU = c.ap ? toIn(1, c.ap.unit) : 1, d = v('d'); let doc = [];
    if (c.ap?.value != null) doc.push(`DOC ${(c.ap.value * apU).toFixed(3)} in`); else if (c.ap) doc.push(`DOC ${c.ap.min != null ? (c.ap.min * apU).toFixed(3) + '–' : '≤ '}${(c.ap.max * apU).toFixed(3)} in`);
    if (c.apx) doc.push(`DOC ${c.apx}×D${d ? ` = ${(c.apx * d).toFixed(3)} in` : ''}`); if (c.aex) doc.push(`WOC ${c.aex}×D${d ? ` = ${(c.aex * d).toFixed(3)} in` : ''}`);
    if (c.woc) doc.push(`WOC ${(c.woc * 100).toFixed(0)}% of D`);
    if (c.feed?.byWoc) doc.push('WOC published at ' + Object.keys(c.feed.byWoc).map(k => (+k * 100).toFixed(0) + '%').join(', '));
    cards += card('DOC / WOC', doc.length ? `<span style="font-size:22px">${doc.join('<br>')}</span>` : 'No manufacturer data', doc.length ? src : '', 'wide' + (doc.length ? '' : ' none')); }
  // nearest options with data, as chips
  let chips = []; const sig = x => JSON.stringify([x.iso, x.sfm, x.feed, x.ap, x.source?.catalog, x.source?.page]), seen = new Set(c ? [sig(c), c.label] : []);
  const fresh = x => { const s = sig(x); if (seen.has(s) || seen.has(x.label)) return false; seen.add(s); seen.add(x.label); return true; };
  if (t && (!c || !SP || !FD)) {
    if (c && !FD && c.feed && mode !== 'tap') diaList(c).slice(0, 12).forEach(x => chips.push([`Ø ${x.toFixed(4)} in`, `d:${x}`]));
    t.conditions.forEach((x, i) => { if (chips.length < 12 && String(i) !== $('cond').value && x.sfm && (mode === 'tap' || x.feed) && isoOk(x) && fresh(x)) chips.push([x.label, `c:${i}`]); });
    t.conditions.forEach((x, i) => { if (chips.length < 16 && x.sfm && (mode === 'tap' || x.feed) && !isoOk(x) && fresh(x)) chips.push([x.label + ' (other material)', `m:${i}`]); });
  }
  const miss = !c || !v('sfm') || !v('fpt');
  $('cards').innerHTML = w + (miss ? `<div class="out"><span class="warn">No manufacturer data for this combo.</span>${chips.length ? '<br>Nearest options from this tool with data:<div class="chips">' + chips.map(([l, k]) => `<button class="chip" data-k="${k}">${l}</button>`).join('') + '</div>' : ''}</div>` : '') + `<div class="cards">${cards}</div>`;
  $('out').hidden = true;
}
$('cards').onclick = e => { const k = e.target.closest('.chip')?.dataset.k; if (!k) return; const [ty, x] = k.split(/:(.*)/);
  if (ty === 'd') { $('d').value = +(+x).toFixed(4); if (mode === 'mill') showEng(); fill(); }
  if (ty === 'c') { $('cond').value = x; fill(); recent(); }
  if (ty === 'm') { $('iso').value = ''; $('mat').value = ''; syncPick(); fillCond().then(() => { $('cond').value = x; fill(); recent(); }); } };
$('dPick').onchange = () => { $('d').value = +(+$('dPick').value).toFixed(4); if (mode === 'mill') showEng(); fill(); };
// Favorites & recent setups
const FIELDS = ['iso', 'mat', 'brand', 'tool', 'cond', 'thr', 'd', 'z', 'sfm', 'fpt', 'aeU', 'apU', 'ae', 'ap', 'apT', 'so', 'nose', 'cb', 'len', 'sup', 'cool'];
const snap = () => { const t = curTool(), c = t?.conditions[$('cond').value];
  return { mode, name: `${mode} · ${t ? t.brand + ' ' + t.series : '?'} · ${c?.label ?? ''}${$('cb').value ? ' · ' + $('cb').value : ''}`, v: Object.fromEntries(FIELDS.map(k => [k, $(k).value])) }; };
function recent() { const t = curTool(); if (!t) return; const s = snap(), r = LS.get('recent', []).filter(x => x.name !== s.name); r.unshift(s); LS.set('recent', r.slice(0, 8)); recallList(); }
function recallList() { const sel = $('recall'); if (!sel) return; sel.length = 1;
  for (const k of ['fav', 'recent']) { const l = LS.get(k, []); if (l.some(x => !MODES.includes(x.mode))) LS.set(k, migrate(l, SUM)); }
  forMode(LS.get('fav', []), mode).forEach(([x, i]) => sel.add(new Option('★ ' + x.name, 'f' + i))); forMode(LS.get('recent', []), mode).forEach(([x, i]) => sel.add(new Option('↺ ' + x.name, 'r' + i))); }
$('fav').onclick = () => { const f = LS.get('fav', []); f.unshift(snap()); LS.set('fav', f.slice(0, 30)); recallList(); $('fav').textContent = '★ Saved'; setTimeout(() => $('fav').textContent = '★ Save setup as favorite', 1200); };
$('recall').onchange = async () => { const k = $('recall').value; if (!k) return; const s = LS.get(k[0] === 'f' ? 'fav' : 'recent', [])[+k.slice(1)]; if (!s) return;
  await setMode(s.mode); $('iso').value = s.v.iso; $('mat').value = s.v.mat ?? ''; fillMat(); $('onlyData').checked = false; await fillBrand(); $('brand').value = s.v.brand; await fillTool(); $('tool').value = s.v.tool; await fillCond();
  for (const k2 of FIELDS) if (!['iso', 'mat', 'brand', 'tool', 'sfm', 'fpt'].includes(k2)) $(k2).value = s.v[k2];
  fill(); $('sfm').value = s.v.sfm; $('fpt').value = s.v.fpt; run(); $('recall').value = ''; };
document.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => setMode(b.dataset.mode));
$('matPick').onchange = () => { const [i, m] = $('matPick').value.split(':'); $('iso').value = i; $('mat').value = m ?? ''; fillBrand(); }; $('onlyData').onchange = fillBrand; $('brand').onchange = fillTool; $('tq').oninput = fillTool; $('cq').oninput = fillCond; $('tool').onchange = () => { $('cq').value = ''; fillCond(); }; $('mach').onchange = applyMachine;
$('cond').onchange = () => { fill(); recent(); }; ['cool', 'thr'].forEach(k => $(k).onchange = fill); $('d').onchange = () => { if (mode === 'mill') showEng(); fill(); };
$('ae').onchange = () => { if (curTool()?.conditions[$('cond').value]?.feed?.byWoc) { readEng(); fill(); } };
['z', 'sfm', 'fpt', 'ae', 'ap', 'apT', 'so', 'maxRpm', 'maxHp', 'len', 'nose'].forEach(k => $(k).oninput = run); $('sup').onchange = run;
$('cool').value = LS.get('lastCoolant', 'flood'); machines(); { const m = LS.get('machines', [])[$('mach').value]; if (m) { $('maxRpm').value = m.rpm || ''; $('maxHp').value = m.hp || ''; } }
recallList();
if (q.get('iso')) $('iso').value = q.get('iso');
if (q.get('mat')) $('mat').value = q.get('mat'); fillMat();
if (q.get('d')) $('d').value = q.get('d');
for (const k of ['len', 'sup', 'apT', 'maxRpm']) if (q.get(k)) $(k).value = q.get(k);
await setMode(mode);
if (q.get('tool')) { const t = SUM.find(x => x.key === q.get('tool')); if (t) { $('onlyData').checked = false; await fillBrand(); $('brand').value = t.brand; await fillTool(); $('tool').value = t.key; await fillCond(); } }
if (q.get('cond')) { $('cond').value = q.get('cond'); fill(); }
if (q.get('thr')) { $('thr').value = q.get('thr'); fill(); }
if (q.get('d')) { $('d').value = q.get('d'); fill(); }
if (q.get('open')) document.querySelector('#src details')?.setAttribute('open', '');
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
