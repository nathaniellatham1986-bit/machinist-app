import { MODES, migrate, forMode } from './recall.js';
import { compute, drill, turn, tap, pick, coolModes, COOL_NAMES, shared303, printedAt, printedRun, matchMat, passOf, cutOf, turnOpOf, turnOpsOf, kindOf, tapTypeOf, boreLimit, gradeList, pickGrade, gradesOf, geoName, css, stickoutFactor, fzFromPerD, matPref, threadPitchIn, inRange, isTaperThread, threadFeed, pitchCovers, distinctName, lowEnd, drillRank, isGun, isMFDrill, rangeText, drillTier, rowDia, rowExcludes, toolLifeOf } from './calc.js';
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
const realKey = () => $('grade').value.split('|')[0] || $('tool').value, curTool = () => toolBy(realKey());
const threads = await J('data/threads.json');
threads.threads.forEach((t, i) => $('thr').add(new Option(t.name, i)));
const q = new URLSearchParams(location.search);
// Units: values are kept in inches internally; metric only changes what is shown/typed.
let metric = false; const LEN = ['d', 'fD', 'so', 'apT', 'hd', 'bd', 'len'];
const UF = k => !metric ? 1 : LEN.includes(k) || k === 'fpt' ? 25.4 : k === 'sfm' ? 0.3048 : 1;
const inV = k => (+$(k).value || 0) / UF(k);
const setIn = (k, x) => { $(k).value = x === '' || x == null ? '' : +(x * UF(k)).toFixed(k === 'sfm' ? 0 : k === 'fpt' ? (metric ? 4 : 5) : metric ? 3 : 4); };
const UL = () => metric ? 'mm' : 'in', uLen = (x, dp = 4) => metric ? (x * 25.4).toFixed(Math.max(dp - 2, 1)) + ' mm' : x.toFixed(dp) + ' in';
const uSp = x => metric ? Math.round(x * 0.3048) : Math.round(x), uFeed = (x, dp = 4) => metric ? (x * 25.4).toFixed(Math.max(dp - 1, 2)) : x.toFixed(dp), uIpm = (x, dp = 1) => metric ? Math.round(x * 25.4) : x.toFixed(dp);
const LS = { get: (k, d) => { try { return JSON.parse(localStorage.getItem('fs.' + k)) ?? d; } catch { return d; } }, set: (k, v) => localStorage.setItem('fs.' + k, JSON.stringify(v)) };
let mode = q.get('mode') || 'mill', defs = {};
const MATS = idx.materials, matSel = () => MATS.find(m => m.id === $('mat').value);
$('matPick').add(new Option('All materials', ''));
for (const [k, n] of idx.materialGroups) { $('matPick').add(new Option(`${n}, any · ISO ${k}`, k));
  MATS.filter(m => m.iso === k).forEach(m => $('matPick').add(new Option(`\u00a0\u00a0${m.name} · ISO ${k}`, k + ':' + m.id))); }
const syncPick = () => { $('matPick').value = $('iso').value + ($('mat').value ? ':' + $('mat').value : ''); };
const fillMat = () => { if (matSel() && matSel().iso !== $('iso').value) $('iso').value = matSel().iso; syncPick(); };
const isoOk = c => { const m = matSel(); if (m) return !!matchMat(m, c);
  return !$('iso').value || c.iso === '*' || c.iso === $('iso').value; };
const hasData = c => c.sfm || c.feed || c.printed;
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
const fmt = rangeText;
// Machines
function machines() { const m = LS.get('machines', []); const sel = $('mach'); let cur = LS.get('lastMachine:' + mode, '');
  sel.length = 1; m.forEach((x, i) => (mode === 'bore' || (x.type === 'lathe') === (mode === 'turn')) && sel.add(new Option(`${x.name} (${x.type}, ${x.rpm || '?'} RPM, ${x.hp || '?'} HP)`, i))); if (![...sel.options].some(o => o.value !== '' && o.value === String(cur))) cur = sel.length === 2 ? sel.options[1].value : ''; sel.value = cur; if (sel.value === '') { $('maxRpm').value = ''; $('maxHp').value = ''; } else { $('maxRpm').value = m[sel.value].rpm || ''; $('maxHp').value = m[sel.value].hp || ''; } return m; }
function applyMachine() { const m = LS.get('machines', [])[$('mach').value]; LS.set('lastMachine:' + mode, $('mach').value);
  $('maxRpm').value = m?.rpm || ''; $('maxHp').value = m?.hp || ''; run(); }
$('mSave').onclick = () => { const n = $('mName').value.trim(); if (!n) return; const m = LS.get('machines', []);
  m.push({ name: n, type: $('mType').value, rpm: +$('mRpm').value || null, hp: +$('mHp').value || null, thrIpm: +$('mThr').value || null }); LS.set('machines', m); machines(); $('mach').value = m.length - 1; applyMachine(); };
$('mDel').onclick = () => { const m = LS.get('machines', []); if ($('mach').value === '') return; m.splice(+$('mach').value, 1); LS.set('machines', m); $('mach').value = ''; machines(); };
// Selection chain: material -> brand -> tool -> condition
function setMode(m) {
  mode = m; TUSER = false; Object.assign(ENG, { key: '', ae: 'default', ap: 'default' }); // YOUR VALUE tags belong to one tab
  recallList(); document.querySelectorAll('[data-mode]').forEach(b => b.classList.toggle('on', b.dataset.mode === m));
  document.querySelectorAll('[data-show]').forEach(e => e.hidden = !e.dataset.show.split(' ').includes(m));
  $('feedLbl').firstChild.textContent = m === 'mill' ? `Chip load (${UL()}/tooth)` : m === 'tap' ? `Pitch (${UL()})` : m === 'bore' ? `Feed (${UL()}, per tooth or per rev as printed)` : `Feed (${UL()}/rev)`;
  $('dLbl').firstChild.textContent = (m === 'turn' ? 'Start dia' : m === 'tap' ? 'Tap dia' : m === 'bore' ? 'Bore dia' : 'Tool dia') + ` (${UL()})`; machines();
  $('zLbl').firstChild.textContent = m === 'bore' ? 'Cutting edges' : 'Flutes'; if (m === 'bore') $('z').value = 1;
  $('pass').value = ''; $('cut').value = ''; $('brand').length = 0; $('tool').length = 0; $('tq').value = ''; $('cq').value = ''; return fillBrand();
}
const toolOk = t => { const m = matSel(); if (m && !(t.mats.includes(m.id) || t.isos.includes(m.iso) || t.isos.includes('*'))) return false;
  return !$('onlyData').checked || t.dataIsos.some(i => i === '*' || !(m?.iso || $('iso').value) || i === (m?.iso || $('iso').value)); };
const inMode = () => SUM.filter(t => t.mode === mode && toolOk(t) && (mode !== 'tap' || (!$('tapT').value || tapTypeOf(t) === $('tapT').value) && isTaperThread(`${t.series} ${t.type ?? ''}`) === isTaperThread(threads.threads[$('thr').value]?.name))
  && (mode !== 'turn' || (() => { return turnOpsOf(t).includes($('top').value); })())
  && (mode !== 'turn' || !$('pass').value || (t.ps ?? []).includes($('pass').value))); // Turn: a set Pass lists only tools with data for it
let GROUPS = {}, GUSER = false, TUSER = false; // TUSER: user picked the tool by hand, so a coolant change keeps it
const geo = geoName;
// Part and Groove: depth of cut and MRR do not apply; Part runs to center (finish Ø 0).
const PG = () => mode === 'turn' && /Groove|Part/.test($('top').value), PART = () => mode === 'turn' && /Part/.test($('top').value);
const short = s => s.replace(/\s*\([^)]*\)/g, '').replace(/\s+/g, ' ').trim().slice(0, 48);
function fillBrand() { const cur = $('brand').value; $('brand').length = 0; $('brand').add(new Option('All brands', ''));
  [...new Set(inMode().map(t => t.brand))].sort().forEach(b => $('brand').add(new Option(b, b)));
  $('brand').value = [...$('brand').options].some(o => o.value === cur) ? cur : ''; return fillKind(); }
function fillKind() { const cur = $('kind').value, ks = [...new Set(inMode().filter(t => !$('brand').value || t.brand === $('brand').value).map(kindOf))].sort();
  $('kind').length = 0; if (ks.length > 1) $('kind').add(new Option('All types', '')); ks.forEach(k => $('kind').add(new Option(k, k)));
  $('kind').value = ks.includes(cur) ? cur : ks.length === 1 ? ks[0] : ''; return fillTool(); }
const MAXOPT = 300;
function fillTool() { const cur = $('tool').value, b = $('brand').value, words = $('tq').value.toLowerCase().split(/\s+/).filter(Boolean);
  const kd = $('kind').value, hits = inMode().filter(t => (!b || t.brand === b) && (!kd || kindOf(t) === kd) && words.every(w => `${t.brand} ${t.series} ${t.type ?? ''}`.toLowerCase().includes(w)));
  const iso = matSel()?.iso || $('iso').value, rank = t => { const f = t.fullIsos || [], ok = i => !iso || i === iso || i === '*';
    const gen = !iso && mode !== 'tap' ? (f.includes('P') ? 0 : .25) + (mode === 'turn' && !(t.pFeed >= .012 && t.pFeed <= .025) ? .2 : 0) : 0; return gen + (f.some(x => !x.includes('~') && ok(x)) ? 0 : f.some(x => ok(x.replace('~', ''))) ? 1 : 2); };
  const r2 = t => rank(t) + (/parting|groov|thread/i.test(t.series + (t.type ?? '')) ? .5 : 0); const dD = mode === 'drill' ? inV('d') : 0, out = t => inRange(t.dr, dD) === false;
  const GEN = /\b[CWDVTS]NMG/i, r2b = t => r2(t) + (mode === 'turn' && $('top').value === 'Turn' && !GEN.test(`${t.series} ${t.type ?? ''}`) ? .3 : 0);
  const r2c = t => r2b(t) + (mode === 'turn' && $('top').value === 'Groove' && /face/i.test(`${t.series} ${t.type ?? ''}`) ? .3 : 0) + (/Groove|Turn/.test($('top').value) && isMFDrill(t) ? .9 : 0);
  const blind = mode === 'tap' && $('hole').value === 'blind', bl = t => !blind ? 0 : { flute: 0, form: 0, '': 1 }[tapTypeOf(t)] ?? 3;
  const r3 = t => r2c(t) + bl(t) + (mode === 'drill' ? drillRank(t, $('cool').value) : 0) + (matSel()?.id === 'ss303' && !t.only303 ? .1 : 0) + (dD ? 20 * drillTier(t, dD, iso) : 0); hits.sort((x, y) => r3(x) - r3(y));
  // Grade/coating split: tools that differ only by grade collapse into one geometry entry; the grade picks the member.
  GROUPS = {}; const seen = {}; const list = [];
  for (const t of hits) { const g = geo(t), k = t.grade ? `${t.brand}|${g}` : t.key;
    if (seen[k]) { GROUPS[seen[k]].push(t.key); continue; } seen[k] = t.key; GROUPS[t.key] = [t.key]; list.push([t, g]); }
  const nm = ([t, g]) => b ? g : `${t.brand} — ${g}`, cnt = {}; list.forEach(x => cnt[nm(x)] = (cnt[nm(x)] || 0) + 1);
  $('tool').length = 0; list.slice(0, MAXOPT).forEach(([t, g]) => $('tool').add(new Option(distinctName(nm([t, g]), t, cnt[nm([t, g])] > 1) + (dD && out(t) ? ' — outside mfr size range' : '') + (blind && tapTypeOf(t) === 'point' ? ' — spiral point pushes chips ahead, not for blind holes' : ''), t.key)));
  $('tn').textContent = !hits.length && mode === 'turn' && $('top').value === 'Face' ? '(none: no record says facing)' : hits.length > MAXOPT ? `(${MAXOPT} of ${hits.length}; refine search)` : `(${hits.length})`;
  if (cur && !GROUPS[cur]) { const g = Object.keys(GROUPS).find(k => GROUPS[k].includes(cur)); if (g) $('tool').value = g; } else if ([...$('tool').options].some(o => o.value === cur)) $('tool').value = cur; updateFindLink(); return fillGrade(); }
async function fillGrade(keep) { const keys = GROUPS[$('tool').value] ?? ($('tool').value ? [$('tool').value] : []); await Promise.all(keys.map(ensure));
  const cur = keep ?? (GUSER ? $('grade').value : ''), L = gradeList(keys.map(k => ({ key: k, tool: toolBy(k) })).filter(m => m.tool), c => isoOk(c) && !!hasData(c));
  const s = $('grade'); s.length = 0; const kd = kindOf(SUM.find(x => x.key === keys[0]) ?? {});
  const ts = SUM.find(x => x.key === keys[0]) ?? {}, tx = `${ts.type ?? ''} ${ts.series ?? ''}`;
  $('gradeT').textContent = kd === 'Tap' || ts.coating || (!/Insert|Boring/.test(kd) && !/insert|indexable/i.test(tx) && /solid|end ?mill|HSS|twist|carbide drill/i.test(tx)) ? 'Coating' : 'Grade';
  $('gradeL').hidden = L.length < 2 && keys.length < 2; if ($('gradeL').hidden) { $('gNote').textContent = ''; return fillCond(); }
  L.filter(o => o.has).forEach(o => s.add(new Option(o.g, o.id)));
  L.filter(o => !o.has).forEach(o => { const x = new Option(`${o.g} · No mfr data for this material`, o.id); x.disabled = true; x.style.color = '#777'; s.add(x); });
  const mat = matSel()?.name ?? (idx.materialGroups.find(([k]) => k === $('iso').value)?.[1]) ?? 'this material', { pick: P, why } = pickGrade(L, cur);
  s.value = P ? P.id : '';
  $('gNote').textContent = !P ? 'No grade has manufacturer data for this material' : why === 'rec' ? `Mfr recommended for ${mat}` : why === 'kept' ? 'Your pick' : 'Auto-picked, not a manufacturer recommendation';
  return fillCond(); }
const nrKey = c => c.noseRadius ? `${c.noseRadius.value ?? c.noseRadius.label} ${c.noseRadius.unit}` : '';
// Turn nose radius / chipbreaker: only the values published in this tool's matching records; read-only when there is one.
function fillTurnOpts(t, okC) { if (mode !== 'turn') return; for (const [id, f] of [['nose', nrKey], ['cb', c => c.chipbreaker ?? '']]) { const s = $(id), cur = s.value;
  const vals = [...new Set((t?.conditions || []).filter(okC).map(f).filter(Boolean))].sort(); s.length = 0;
  if (!vals.length) s.add(new Option('No manufacturer data', '')); else { if (vals.length > 1) s.add(new Option('Any published', '')); vals.forEach(x => s.add(new Option(x, x))); }
  s.value = vals.includes(cur) ? cur : vals.length === 1 ? vals[0] : ''; s.disabled = vals.length < 2; } }
async function fillCond() {
  await ensure(realKey());
  const t = curTool(); $('cond').length = 0;
  const cw = $('cq').value.toLowerCase().split(/\s+/).filter(Boolean); let nc = 0;
  $('cqL').hidden = (t?.conditions.length ?? 0) < 25 && !cw.length;
  const gSel = $('gradeL').hidden ? '' : $('grade').value.split('|')[1] ?? '', okC = c => (!gSel || gradesOf(t, c).includes(gSel)) && isoOk(c) && (!$('pass').value || passOf(c) === $('pass').value) && (mode !== 'mill' || !$('cut').value || cutOf(c) === $('cut').value);
  fillTurnOpts(t, okC);
  const nrOk = c => mode !== 'turn' || ((!$('nose').value || nrKey(c) === $('nose').value) && (!$('cb').value || (c.chipbreaker ?? '') === $('cb').value));
  (t?.conditions || []).forEach((c, i) => { if (okC(c) && nrOk(c) && cw.every(w => c.label.toLowerCase().includes(w)) && nc++ < 400) $('cond').add(new Option(c.label + (allMat(c) ? ' · Feed table, all materials' : '') + (c.status === 'shop-proven' ? ' · SHOP-PROVEN' : '') + (matSel() && !allMat(c) && matchMat(matSel(), c) === 'group' ? ` · matched by group: ${c.sourceGroup ?? c.subgroup ?? c.material ?? 'ISO ' + c.iso}` : '') + (matSel()?.id === 'ss303' && shared303(c) ? ' · 303 grouped with 304/316 as printed' : ''), i)); });
  { const opts = [...$('cond').options].map(o => [o.value, t.conditions[+o.value]]), full = c => (c.printed || c.sfm && (c.feed || mode === 'tap')) && c.status !== 'shop-proven' && !(mode === 'drill' && rowExcludes(c, inV('d')));
    const want = matSel()?.iso || $('iso').value || 'P', cat = opts.filter(([, c]) => full(c) && c.source.kind === 'catalog');
    // General default: preferred ISO group, first material subgroup, middle (medium) published feed rather than the finishing/roughing extremes.
    const mp = c => matPref(matSel()?.id, c); let cat2 = cat; if (matSel() && cat.some(([, c]) => mp(c) === 0)) cat2 = cat.filter(([, c]) => mp(c) === 0); else if (matSel() && cat.some(([, c]) => mp(c) < 2)) cat2 = cat.filter(([, c]) => mp(c) < 2);
    if (TH()) { const pI = threadPitchIn(+$('tpi').value, $('pitchU').value); if (cat2.some(([, c]) => pitchCovers(c, pI))) cat2 = cat2.filter(([, c]) => pitchCovers(c, pI)); }
    if (matSel()?.id === 'ss303' && cat2.some(([, c]) => !shared303(c))) cat2 = cat2.filter(([, c]) => !shared303(c));
    const pool = cat2.filter(([, c]) => c.iso === want).length ? cat2.filter(([, c]) => c.iso === want) : cat2, sg = pool[0]?.[1].subgroup ?? pool[0]?.[1].label;
    const same = pool.filter(([, c]) => (c.subgroup ?? c.label) === sg), mid = same[Math.floor((same.length - 1) / 2)];
    const best = mid || opts.find(([, c]) => full(c) && c.source.kind === 'catalog') || opts.find(([, c]) => full(c)) || opts.find(([, c]) => hasData(c) && !(mode === 'drill' && rowExcludes(c, inV('d')))) || opts[0]; if (best) $('cond').value = best[0]; }
  if (t?.flutes) $('z').value = t.flutes;
  fill(); recent();
}
function coolNote() { const c = curTool()?.conditions[$('cond').value];
  $('coolNote').textContent = c ? (c.coolant ? `Coolant (source): ${c.coolant}` : 'Coolant: not stated by source') : '';
}
const TH = () => mode === 'turn' && $('top').value === 'Thread';
const allMat = c => c.iso === '*' && !c.material && !c.materials?.length;
function badge(c) { const s = c.source;
  if (c.status === 'shop-proven') return `<span class=\"shop\">⚠ Shop-proven, NOT manufacturer data ▸</span>`;
  return `${allMat(c) ? 'Feed table, all materials · ' : ''}${s.manufacturer} ${s.kind === 'label' ? 'box label' : 'catalog'} ✓${c.sourceGroup ? ' · “' + c.sourceGroup + '”' : ''} ▸`; }
let SP = null, FD = null;
const diaFeed = c => c?.printed && !c.feed?.byDiameter ? { byDiameter: c.printed.byDiameter, unit: c.printed.unit } : c?.feed;
const diaList = c => { const f = diaFeed(c); if (!f) return []; const u = toIn(1, f.unit);
  if (f.byDiameter) return Object.keys(f.byDiameter).map(k => +k * u).sort((x, y) => x - y);
  if (f.bands) return f.bands.map(([a, z]) => (a + z) / 2 * u); return []; };
function fillDia(c) { const L = mode === 'mill' || mode === 'drill' || mode === 'bore' ? diaList(c) : [], s = $('dPick'); s.length = 0;
  $('dPickL').hidden = L.length < 2; if (!L.length) return;
  const f = diaFeed(c); if (f.byDiameter) L.forEach(x => s.add(new Option(x.toFixed(4) + ' in', x)));
  else f.bands.forEach(([a, z]) => { const u = toIn(1, f.unit); s.add(new Option(`${(a * u).toFixed(3)}–${(z * u).toFixed(3)} in`, (a + z) / 2 * u)); });
  const d = inV('d'); if (L.length === 1 || !feedAt(f, d)) { const best = L.reduce((p, x) => Math.abs(x - d) < Math.abs(p - d) ? x : p, L[0]); if (L.length === 1 && f.byDiameter) setIn('d', best); }
  const hit = [...s.options].find(o => Math.abs(+o.value - inV('d')) < 0.02); s.value = hit ? hit.value : ''; }
// Manufacturer DOC/WOC -> prefill engagement once per tool/condition/diameter; user edits are tagged YOUR VALUE.
const ENG = { key: '', ae: 'default', ap: 'default' };
let OUTROW = false; // drill row printed for another Ø (set in fill, read in run)
function mfgEng(c, d) { if (!c) return {}; const r = {}, u = c.ap ? toIn(1, c.ap.unit) : 1;
  const apIn = c.ap ? (c.ap.value ?? (c.ap.min != null ? (c.ap.min + c.ap.max) / 2 : c.ap.max)) * u : null;
  if (c.apx) r.ap = c.apx; else if (apIn != null && d) r.ap = apIn / d; if (apIn != null) r.apIn = apIn;
  if (c.woc) r.ae = c.woc; else if (c.aex) r.ae = c.aex; else if (cutOf(c) === 'Slot') r.ae = 1; return r; }
function prefillEng(t, c, d) { const k = `${$('tool').value}|${$('cond').value}|${d}`; if (k === ENG.key) return; ENG.key = k;
  const m = mfgEng(c, d);
  if (mode === 'mill') { if (m.ae != null) { frac.ae = m.ae; ENG.ae = 'mfg'; } else if (ENG.ae === 'mfg') { frac.ae = [+27200 bytes truncated for this call]