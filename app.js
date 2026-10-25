import { MODES, migrate, forMode, upsertMachine, dedupeMachines, removeMachine } from './recall.js';
import { enhance } from './combo.js';
import { estimate, ESTIMATES_ON, EST_MODES } from './estimate.js';
import { compute, drill, turn, tap, pick, coolModes, COOL_NAMES, shared303, printedAt, printedRun, matchMat, passOf, cutOf, turnOpOf, turnOpsOf, kindOf, tapTypeOf, boreLimit, gradeList, pickGrade, gradesOf, geoName, css, stickoutFactor, fzFromPerD, matPref, threadPitchIn, inRange, isTaperThread, threadFeed, pitchCovers, distinctName, lowEnd, drillRank, isGun, isMFDrill, rangeText, classifyOverride, classifyEng, engFrac, drillTier, rowDia, rowExcludes, toolLifeOf } from './calc.js';
const $ = id => document.getElementById(id);
const J = u => fetch(u).then(r => r.json());
['matPick', 'brand', 'kind', 'tool', 'grade', 'cond', 'thr', 'dPick', 'recall', 'pB', 'pM', 'pS'].forEach(k => enhance($(k)));
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
$('matPick').add(new Option('Pick a material', ''));
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
{ const d = dedupeMachines(LS.get('machines', [])); if (d.changed) { LS.set('machines', d.list);
  for (const md of MODES) { const v = LS.get('lastMachine:' + md, ''); if (v !== '' && d.map[+v] != null) LS.set('lastMachine:' + md, String(d.map[+v])); } } }
function machines() { const m = LS.get('machines', []); const sel = $('mach'); let cur = LS.get('lastMachine:' + mode, '');
  sel.length = 1; m.forEach((x, i) => x.type !== 'grinder' && (mode === 'bore' || x.type === 'mill-turn' || (['lathe', 'swiss'].includes(x.type)) === (mode === 'turn')) && sel.add(new Option(`${x.name} (${x.type}, ${x.rpm || '?'} RPM, ${x.hp || '?'} HP${x.user ? ', YOUR VALUES' : x.preset ? ', builder spec' : ''})`, i))); if (![...sel.options].some(o => o.value !== '' && o.value === String(cur))) cur = sel.length === 2 ? sel.options[1].value : ''; sel.value = cur; if (sel.value === '') { $('maxRpm').value = ''; $('maxHp').value = ''; } else { $('maxRpm').value = m[sel.value].rpm || ''; $('maxHp').value = m[sel.value].hp || ''; } return m; }
function applyMachine() { const m = LS.get('machines', [])[$('mach').value]; LS.set('lastMachine:' + mode, $('mach').value);
  $('maxRpm').value = m?.rpm || ''; $('maxHp').value = m?.hp || ''; run(); }
$('mSave').onclick = () => { const n = $('mName').value.trim(); if (!n) return; const m = LS.get('machines', []);
  const r = { name: n, type: $('mType').value, rpm: +$('mRpm').value || null, hp: +$('mHp').value || null, thrIpm: +$('mThr').value || null };
  if (PRE) { r.preset = PRE.ref; r.source = PRE.url; r.user = ['type', 'rpm', 'hp', 'thrIpm'].filter(k => r[k] !== PRE[k]); if (!r.user.length) delete r.user; }
  const u = upsertMachine(m, r); LS.set('machines', u.list); machines(); $('mach').value = u.index; applyMachine(); $('mAdd').open = false; };
$('mDel').onclick = () => { $('pB').value = ''; $('pB').onchange(); ['mName', 'mThr', 'mRpm', 'mHp'].forEach(k => $(k).value = ''); $('mType').value = 'mill'; };
enhance($('mach'), { action: o => o.value === '' ? null : { label: '✕', title: 'Delete this saved machine', run: () => {
  const last = Object.fromEntries(MODES.map(md => [md, LS.get('lastMachine:' + md, '')])), r = removeMachine(LS.get('machines', []), +o.value, last);
  LS.set('machines', r.list); MODES.forEach(md => LS.set('lastMachine:' + md, r.last[md])); machines(); $('mach').value = r.last[mode]; applyMachine(); } } });
// Builder presets (data/machines): Builder -> Model -> spindle option, same select pattern as Brand -> Series
let MIDX = null, MDOC = null, PRE = null; const mTypeOf = t => ['mill', 'lathe', 'mill-turn', 'swiss', 'grinder'].includes(t) ? t : 'mill';
const preHp = s => s.hp_cont ?? s.hp_peak ?? (s.kw_cont ?? s.kw_peak ? +((s.kw_cont ?? s.kw_peak) * 1.341).toFixed(1) : null);
async function presetBuilders() { if (MIDX) return; MIDX = await J('data/machines/index.json'); MIDX.builders.forEach(b => $('pB').add(new Option(`${b.builder} (${b.models})`, b.file))); }
$('mSave').closest('details').ontoggle = presetBuilders;
$('pB').onchange = async () => { $('pM').length = 0; $('pS').length = 0; $('pSL').hidden = true; PRE = null; $('pNote').textContent = ''; if (!$('pB').value) return;
  MDOC = await J('data/machines/' + $('pB').value); $('pM').add(new Option('Pick model', '')); MDOC.models.forEach((m, i) => $('pM').add(new Option(`${m.model} · ${m.type}`, i))); };
$('pM').onchange = () => { const m = MDOC?.models[$('pM').value]; $('pS').length = 0; if (!m) return; m.spindles.forEach((s, i) => $('pS').add(new Option(`${s.option} · ${s.rpm || '?'} rpm`, i))); $('pSL').hidden = m.spindles.length < 2; $('pS').onchange(); };
$('pS').onchange = () => { const m = MDOC.models[$('pM').value], s = m.spindles[$('pS').value || 0], hp = preHp(s);
  const der = s.hp_cont == null && s.hp_peak == null && hp != null; const which = s.hp_cont != null || (s.hp_peak == null && s.kw_cont != null) ? 'continuous' : 'peak';
  PRE = { ref: `${MDOC.builder} ${m.model} · ${s.option}`, url: m.source.url, type: mTypeOf(m.type), rpm: s.rpm, hp, thrIpm: m.max_thread_ipm ?? null };
  $('mName').value = `${MDOC.builder} ${m.model}` + (m.spindles.length > 1 ? ` (${s.option})` : ''); $('mType').value = PRE.type; $('mRpm').value = s.rpm ?? ''; $('mHp').value = hp ?? ''; $('mThr').value = PRE.thrIpm ?? '';
  $('pNote').innerHTML = `BUILDER SPEC · ${s.rpm ?? '?'} rpm · ${hp ?? '?'} HP ${which}${der ? ' (DERIVED from kW × 1.341)' : ''}${s.taper ? ' · ' + s.taper : ''}${s.torque_nm ? ' · ' + s.torque_nm + ' Nm' : ''}${s.rating_note ? ' · ' + s.rating_note : ''}${m.type === 'grinder' ? ' · grinder: not used for feeds/speeds limits' : ''} · <a href="${m.source.url}" target="_blank" rel="noopener">source</a> (accessed ${m.source.accessed}). Fields stay editable; changed fields save as YOUR VALUE.`; };
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
function fillBrand() { const cur = $('brand').value; $('brand').length = 0; $('brand').add(new Option('Pick a brand', ''));
  [...new Set(inMode().map(t => t.brand))].sort().forEach(b => $('brand').add(new Option(b, b)));
  $('brand').value = [...$('brand').options].some(o => o.value === cur) ? cur : ''; return fillKind(); }
function fillKind() { const cur = $('kind').value, ks = [...new Set(inMode().filter(t => !$('brand').value || t.brand === $('brand').value).map(kindOf))].sort();
  $('kind').length = 0; if (ks.length > 1) $('kind').add(new Option('All types', '')); ks.forEach(k => $('kind').add(new Option(k, k)));
  $('kind').value = ks.includes(cur) ? cur : ks.length === 1 ? ks[0] : ''; return fillTool(); }
const MAXOPT = 300;
// No tool is picked until both a material and a brand are chosen; then the best match from THAT brand is the default.
const needMsg = () => !$('iso').value && !$('brand').value ? 'Pick a material and a brand' : !$('iso').value ? 'Pick a material' : !$('brand').value ? 'Pick a brand' : '';
function fillTool() { const cur = $('tool').value, b = $('brand').value, words = $('tq').value.toLowerCase().split(/\s+/).filter(Boolean);
  const NEED = needMsg(); if (NEED) { GROUPS = {}; $('tool').length = 0; $('tool').add(new Option(NEED, '')); $('tn').textContent = ''; updateFindLink(); return fillGrade(); }
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
// ESTIMATE candidates (DERIVED): same brand + mode + tool kind with data for the material; loaded only when the picked tool lacks data.
const estCands = () => { const s = SUM.find(x => x.key === realKey()), m = matSel(); if (!s || !m) return [];
  return SUM.filter(x => x.key !== s.key && x.brand === s.brand && x.mode === s.mode && kindOf(x) === kindOf(s) && (x.mats.includes(m.id) || x.dataIsos.includes(m.iso))); };
const estWanted = t => ESTIMATES_ON && EST_MODES.includes(mode) && !!matSel() && !!t && !t.conditions.some(c => isoOk(c) && c.status !== 'shop-proven' && (c.printed || c.sfm && (c.feed || mode === 'tap')));
async function fillCond() {
  await ensure(realKey());
  if (estWanted(curTool())) await Promise.all(estCands().map(x => ensure(x.key)));
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
  if (c.status === 'shop-proven') return `<span class="shop">⚠ Shop-proven, NOT manufacturer data ▸</span>`;
  return `${allMat(c) ? 'Feed table, all materials · ' : ''}${s.manufacturer} ${s.kind === 'label' ? 'box label' : 'catalog'} ✓${c.sourceGroup ? ' · “' + c.sourceGroup + '”' : ''} ▸`; }
let SP = null, FD = null, ESTTRY = false;
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
  const m = mfgEng(c, d); ESPEC = engSpec(c, d);
  if (mode === 'mill') { if (m.ae != null) { frac.ae = m.ae; ENG.ae = 'mfg'; } else if (ENG.ae === 'mfg') { frac.ae = 0.25; ENG.ae = 'default'; }
    if (m.ap != null) { frac.ap = m.ap; ENG.ap = 'mfg'; } else if (ENG.ap === 'mfg') { frac.ap = 1; ENG.ap = 'default'; } showEng(); }
  if (mode === 'turn') { if (m.apIn != null) { setIn('apT', m.apIn); ENG.ap = 'mfg'; } else if (ENG.ap === 'mfg') { setIn('apT', 0.04); ENG.ap = 'default'; } }
  if (mode === 'turn') engTags(); }
const TAG = { mfg: ' · MANUFACTURER value', yours: ' · YOUR VALUE, NOT MANUFACTURER', default: ' · default (no manufacturer value)' };
// Published DOC/WOC spec only (no slot geometry, no app defaults): ae as fraction of D, ap as ×D (mill) or in (turn).
let ESPEC = {}; const esc = t => String(t).replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[m]);
function engSpec(c, d) { const s = {}; if (!c) return s; const u = c.ap ? toIn(1, c.ap.unit) : 1;
  if (c.ap && (c.ap.max != null || c.ap.value != null)) { const rg = c.ap.value == null && c.ap.min != null && c.ap.max != null,
      mx = (c.ap.value ?? c.ap.max) * u, mn = rg ? c.ap.min * u : null, df = rg ? (mn + mx) / 2 : mx;
    s.apIn = { min: mn, max: mx, def: df }; if (d && !c.apx) s.ap = { min: mn != null ? mn / d : null, max: mx / d, def: df / d }; }
  if (c.apx) s.ap = { min: null, max: c.apx, def: c.apx };
  const ae = c.woc ?? c.aex; if (ae) s.ae = { min: null, max: ae, def: ae }; return s; }
function engSpan(k) { const sp = k === 'apT' ? ESPEC.apIn : ESPEC[k]; if (!sp) return null; const d = D();
  let v, fmt;
  if (k === 'ae') { const pct = $('aeU').value === 'pct'; v = engFrac(+$('ae').value / (pct ? 1 : LK()), pct ? 'pct' : 'in', d); fmt = x => pct ? `${+(x * 100).toFixed(1)}% of D` : uLen(x * d); }
  else if (k === 'ap') { const xd = $('apU').value === 'xd'; v = engFrac(+$('ap').value / (xd ? 1 : LK()), xd ? 'xd' : 'in', d); fmt = x => xd ? `${+x.toFixed(2)}×D` : uLen(x * d); }
  else { v = +$('apT').value / LK(); fmt = x => uLen(x); }
  return classifyEng(v, sp, k === 'apT' ? 5e-5 : 1e-3, fmt); }
function engHtml(k, st) { if (st !== 'yours') return esc(TAG[st]); const o = engSpan(k); if (!o) return esc(TAG.yours);
  if (o.state === 'mfr') return esc(TAG.mfg); const c = o.state === 'out' ? 'warn' : 'adjw';
  return ` · <span class="${c}">${o.label}</span>${o.note ? ` <span class="${c}">· ${o.note}</span>` : ''}`; }
function engTags() { if ($('aeX')) $('aeX').innerHTML = esc($('aeX').textContent) + engHtml('ae', ENG.ae); if ($('apX')) $('apX').innerHTML = esc($('apX').textContent) + engHtml('ap', ENG.ap);
  const tl = $('apTX'); if (tl) tl.innerHTML = engHtml('apT', ENG.ap).replace(/^ · /, ''); }
function fill() {
  const t = curTool(), c = t?.conditions[$('cond').value];
  fillDia(c);
  if (mode === 'tap') { const th = threads.threads[$('thr').value]; setIn('d', th.d_in); setIn('fpt', th.pitch_in); }
  const d = inV('d'), cool = $('cool').value; LS.set('lastCoolant', cool);
  const shop = c?.status === 'shop-proven';
  let sp = c && pick(c.sfm, spdK(c.sfm?.unit)), fd = mode === 'tap' ? null : c && (feedAt(c.feed, d) ?? (c.feed == null && c.fzPerD ? fzFromPerD(c.fzPerD, d) : null));
  sp = lowEnd(sp); fd = lowEnd(fd); // every mode: range-only records start at the LOW end (labeled)
  OUTROW = mode === 'drill' && c && rowExcludes(c, d); if (OUTROW) { sp = null; fd = null; } // never borrow an out-of-size printed row
  if (shop) { if (sp) sp.basis = 'SHOP-PROVEN value, not manufacturer'; if (fd) fd.basis = 'SHOP-PROVEN value, not manufacturer'; }
  ESTTRY = false; if (ESTIMATES_ON && EST_MODES.includes(mode) && t && matSel() && !shop && (!sp || (!fd && mode !== 'tap')) && !((mode === 'mill' || mode === 'drill') && printedAt(c, d))) {
    ESTTRY = true; const s = SUM.find(x => x.key === realKey()), e = estimate({ target: { ...s, mode }, targetKey: s?.key, cands: estCands().map(x => ({ key: x.key, tool: toolBy(x.key) })).filter(x => x.tool), mat: matSel(), d, cool, need: { sfm: !sp, fpt: !fd && mode !== 'tap' } });
    if (!sp && e.sfm) sp = { def: e.sfm.def, min: null, max: null, est: e.sfm, basis: 'ESTIMATE' }; if (!fd && e.fpt) fd = { def: e.fpt.def, min: null, max: null, est: e.fpt, basis: 'ESTIMATE' }; }
  SP = sp; FD = fd; defs = { sfm: sp?.def ?? null, fpt: mode === 'tap' ? inV('fpt') : fd?.def ?? null };
  prefillEng(t, c, d);
  setIn('sfm', sp ? sp.def : ''); if (mode !== 'tap') setIn('fpt', fd ? fd.def : '');
  $('thrL').hidden = !TH(); if (TH()) { const p = threadPitchIn(+$('tpi').value, $('pitchU').value); setIn('fpt', p ?? ''); FD = p ? { def: p, min: null, basis: 'feed/rev = thread pitch (geometry)' } : null; defs.fpt = p; }
  const NO = '<span class="warn">No manufacturer data</span>';
  let h = '';
  if (!c) h = !t ? '' : `${NO} for ${t ? t.brand + ' ' + t.series : 'this selection'}.` + (t?.notes ? `<br>${t.notes}` : '');
  else {
    const s = c.source, apU = c.ap ? toIn(1, c.ap.unit) : 1;
    const gun = !!t && isGun(t), thru = !gun && mode === 'drill' && cool === 'flood' && (m => m.includes('through') && !m.includes('flood'))(coolModes(c.coolant ?? '')); h = `<details><summary>${badge(c)}</summary><span class="tag">${c.status.toUpperCase()}</span> ${s.manufacturer} · ${s.catalog} · ${s.edition}${s.page ? ' · p.' + s.page : ''}${s.url ? ` · <a style="color:#9cf" href="${s.url}">source</a>` : ''}`
      + (c.sourceGroup ? `<br>Source material group: “${c.sourceGroup}”` : '') + (s.notes ? `<br>${s.notes}` : '') + (t.notes ? `<br>${t.notes}` : '')
      + (c.altSources || []).map(a => `<br><b>Also published:</b> ${a.source.catalog}${a.source.page ? ' · p.' + a.source.page : ''}${a.sfm ? ` · speed ${a.sfm.value ?? a.sfm.start ?? `${a.sfm.min}–${a.sfm.max}`} ${a.sfm.unit}` : ''}${a.feed?.range ? ` · feed ${a.feed.range.value ?? `${a.feed.range.min}–${a.feed.range.max}`} ${a.feed.unit}` : ''}${a.source.url ? ` · <a style="color:#9cf" href="${a.source.url}">source</a>` : ''}`).join('') + '</details>'
      + (c.ap?.value != null ? `<b>DOC ${shop ? '' : 'manufacturer '}stated:</b> ${(c.ap.value * apU).toFixed(3)} in (${c.ap.value} ${c.ap.unit})` : c.ap ? `<br><b>DOC ${shop ? '' : 'manufacturer '}${c.ap.min != null ? 'min–max' : 'max'}:</b> ${c.ap.min != null ? (c.ap.min * apU).toFixed(3) + ' – ' : '≤ '}${(c.ap.max * apU).toFixed(3)} in (${c.ap.min ?? ''}${c.ap.min != null ? '–' : '≤'}${c.ap.max} ${c.ap.unit})` : (mode === 'turn' ? `<br><b>DOC:</b> ${NO}` : ''))
      + (c.apx || c.aex ? `<br>${c.apx ? `ap ${c.apx}×D` : ''}${c.apx && c.aex ? ', ' : ''}${c.aex ? `ae ${c.aex}×D` : ''} (manufacturer)` : '')
      + (c.woc ? `<br>Speed stated for ae = ${(c.woc * 100).toFixed(0)}% of D` : '')
      + (c.feed?.byWoc ? `<br>Chip load published at ae = ${Object.entries(c.feed.byWoc).map(([k, v]) => `${(+k * 100).toFixed(0)}%: ${typeof v === 'object' ? (v.value ?? `${v.min}–${v.max}`) : v} ${c.feed.unit}`).join(', ')}${fd ? '' : ' — set WOC to one of these'}` : '')
      + (c.noseRadius ? `<br>Nose radius ${c.noseRadius.value ?? c.noseRadius.label} ${c.noseRadius.unit}` : '') + (c.leadAngle ? ` · ${c.leadAngle.convention} ${c.leadAngle.deg}°` : '') + (c.toolLife ? ` · tool life ${c.toolLife} min` : '')
      + (c.insertWidth ? `<br>Insert width ${c.insertWidth.value ?? c.insertWidth.label} ${c.insertWidth.unit}` : '')
      + (c.note ? `<br><small>${c.note}</small>` : '') + (c.coolantNote ? `<br><small>${c.coolantNote}</small>` : '')
      + (thru ? `<br><span class="warn">Flood selected, but this drill's record calls for internal/through-tool coolant.</span> Record states: “${c.coolant}” (manufacturer)` : '')
      + (gun ? `<br><span class="warn">Gun drill: needs high-pressure through-tool coolant.</span> ${c.coolant ? `Record states: “${c.coolant}” (manufacturer)` : 'APP GUIDANCE, not manufacturer data'}` : '')
      + (c.coolant ? `<br>Coolant: ${c.coolant} (${shop ? 'shop record' : 'manufacturer stated'})` + (() => { const m = coolModes(c.coolant); return !m.length || gun || thru ? '' : m.includes(cool) ? ` · matches ${COOL_NAMES[cool]}` : `<br><span class="warn">Source states ${m.map(x => COOL_NAMES[x]).join('/')}; you selected ${COOL_NAMES[cool]}. Values are NOT converted between coolant modes.</span>`; })() : `<br><span class="warn">Coolant not stated in source; values not adjusted for ${COOL_NAMES[cool]}.</span>`);
  }
  if (mode === 'tap') { const th = threads.threads[$('thr').value];
    h += `<br><b>Tap drill 75%:</b> ${th.drill75_mm ? th.drill75_mm + ' mm / ' : ''}${th.drill75_in.toFixed(4)} in (geometry)${th.chart ? ' · chart pick ' + th.chart : ''}<br><small>${threads.source.formula}. ${th.chart ? threads.source.chart : ''}</small>`
    + ((t ? tapTypeOf(t) === 'form' : $('tapT').value === 'form') ? `<br><b>Form-tap drill:</b> ${c?.formDrill ? c.formDrill + ' (manufacturer chart)' : NO} <small>(the 75% chart above is for cutting taps)</small>` : '')
    + `<br><b>Rigid tap:</b> feed per rev = pitch (${th.pitch_in.toFixed(4)} in); IPM = RPM × pitch.`; }
  $('src').innerHTML = h; coolNote(); run();
}
// Mill engagement: stored as fraction of D; shown in % / xD or inches.
const frac = { ae: 0.25, ap: 1 };
const D = () => inV('d');
const LK = () => metric ? 25.4 : 1;
function readEng() { const d = D(); frac.ae = $('aeU').value === 'pct' ? +$('ae').value / 100 : (d ? +$('ae').value / LK() / d : 0);
  frac.ap = $('apU').value === 'xd' ? +$('ap').value : (d ? +$('ap').value / LK() / d : 0);
  $('aeX').textContent = $('aeU').value === 'pct' ? `= ${uLen(frac.ae * d)}` : `= ${(frac.ae * 100).toFixed(1)}% of D`;
  $('apX').textContent = $('apU').value === 'xd' ? `= ${uLen(frac.ap * d)}` : `= ${frac.ap.toFixed(2)}×D`; engTags(); }
function showEng() { const d = D(); $('ae').value = $('aeU').value === 'pct' ? +(frac.ae * 100).toFixed(2) : +(frac.ae * d * LK()).toFixed(metric ? 3 : 4);
  $('ap').value = $('apU').value === 'xd' ? +frac.ap.toFixed(3) : +(frac.ap * d * LK()).toFixed(metric ? 3 : 4); readEng(); }
$('aeU').onchange = () => { showEng(); run(); }; $('apU').onchange = () => { showEng(); run(); };
const mine = k => defs[k] == null || Math.abs(inV(k) - defs[k]) > (k === 'sfm' ? 2 : 5e-5);
const ovc = k => { const p = k === 'sfm' ? SP : FD; if (p?.est) return mine(k) ? { state: 'out', label: 'YOUR VALUE, NOT MANUFACTURER', note: 'changed from the ESTIMATE (an estimate has no manufacturer range)' } : { state: 'est', label: '' }; if (defs[k] == null || !p) return { state: mine(k) ? 'out' : 'mfr', label: 'YOUR VALUE, NOT MANUFACTURER', note: '' }; return classifyOverride(inV(k), p, k === 'sfm' ? 2 : 5e-5, k === 'sfm' ? 0 : 4); };
const ovHtml = o => `<span class="${o.state === 'out' ? 'warn' : 'adjw'}">${o.label}</span>${o.note ? `<br><span class="${o.state === 'out' ? 'warn' : 'adjw'}">${o.note}</span>` : ''}`;
const ovCls = o => o.state === 'out' ? 'mine' : o.state === 'within' ? 'adj' : o.state === 'est' ? 'est' : '';
// Blue ESTIMATE body: label + basis; tapping it lists each source record (brand, series, coating, value, catalog/edition).
const estHtml = (e, dp, u) => `<details class="estd"><summary><span class="estw">ESTIMATE, not manufacturer data</span><br>from ${e.n} published ${esc(e.sources[0].brand)} tools (same type, material group, size range); lowest low end used ▸</summary>${e.sources.map(x => `<div class="estrow">${esc(x.brand)} ${esc(x.series)}${x.coating ? ' · ' + esc(x.coating) : ''} · <b>${u(x.value)}</b>${x.at ? ` at Ø${x.at.toFixed(4)} in` : ''} · ${esc(x.label)} · ${esc(x.source)}${x.url ? ` · <a style="color:#9cf" href="${x.url}" target="_blank" rel="noopener">source</a>` : ''}</div>`).join('')}</details>`;
function run() { updateFindLink(); favMark();
  if (!curTool()) { const m = needMsg() ? needMsg() + ' to see manufacturer numbers.' : `${$('brand').value} has no ${mode} tool with data for this material and these filters.`;
    $('cards').innerHTML = `<div class="out"><span class="warn">${m}</span></div>`; $('bar').innerHTML = `<small>${m}</small>`; return; } if (PART()) $('fD').value = '0'; if (mode === 'mill') readEng();
  const v = inV, tag = k => mine(k) && $(k).value ? ' <span class="tag warn">YOUR VALUE, NOT MANUFACTURER</span>' : '';
  const c = curTool()?.conditions[$('cond').value];
  let w = '';
  if (mode === 'turn') {
    if (c?.ap && v('apT')) { const u = toIn(1, c.ap.unit), a = v('apT'); if ((c.ap.min != null && a < c.ap.min * u - 1e-6) || a > c.ap.max * u + 1e-6) w += `<div class="warn">DOC ${a} in is outside the ${c.status === 'shop-proven' ? 'recorded' : 'manufacturer'} range</div>`; }
    if (/Groove|Part/.test($('top').value)) w += `<div class="out">${c?.insertWidth ? `Blade / insert width: ${c.insertWidth.value ?? c.insertWidth.label} ${c.insertWidth.unit} (manufacturer)<br>` : ''}Reduce feed near center${$('top').value === 'Part' ? ' (last ~0.1 in before part-off)' : ''}. <span class="tag">GENERAL GUIDANCE, not manufacturer data</span></div>`;
    if (v('len') && v('d') && v('len') / v('d') > 4 && $('sup').value === 'none') w += `<div class="warn">Slender part: L/D ${(v('len') / v('d')).toFixed(1)} > 4 with no support. Consider a tailstock or steady rest. <span class="tag">GENERAL GUIDELINE, not manufacturer data</span></div>`;
  }
  if (mode === 'drill' && v('hd') && v('d')) { const r = v('hd') / v('d'); w += `<div class="out">Hole depth ${uLen(v('hd'), 3)} = ${r.toFixed(1)}×D${r > 3 ? ' · <span class="warn">past ~3×D: consider peck drilling / chip clearing</span>' : ''} <span class="tag">GENERAL GUIDANCE, not manufacturer</span></div>`; }
  if (mode === 'bore' && v('so')) { const bd = v('bd') || v('d'), lim = boreLimit($('shk').value), r = v('so') / bd;
    w += `<div class="${r > lim ? 'warn' : 'out'}">Bar L/D ${r.toFixed(1)}:1 (${$('shk').value} shank, limit ~${lim}×D)${r > lim ? ' · past the usual limit: expect chatter; shorten stickout, use a ' + ($('shk').value === 'steel' ? 'carbide or ' : '') + 'damped bar, or reduce speed/feed' : ''} <span class="tag">GENERAL GUIDANCE, not manufacturer data</span></div>`; }
  const t = curTool(), src = c ? (c.status === 'shop-proven' ? '⚠ SHOP-PROVEN, not manufacturer' : `${c.source.manufacturer} ${c.source.kind === 'label' ? 'box label' : 'catalog'}${c.source.page ? ' p.' + c.source.page : ''} ✓`) : '';
  const BAR = []; const card = (k, val, b, cls = '', ov, rl) => `<div class="card ${cls}"${ov ? ` data-ov="${ov}"` : ''}><div class="k">${k}${ov ? ' <span class="tap">✎ tap to change</span>' : ''}</div><div class="v">${val}</div><div class="b">${b}</div>${ov && (cls === 'mine' || cls === 'adj') ? '<button class="sm rst" data-reset="' + ov + '">' + (rl ?? 'Reset to manufacturer') + '</button>' : ''}</div>`;
  const boreFz = mode === 'bore' && c?.feed?.kind === 'fz', fk = (mode === 'mill' ? 'Chip load' : mode === 'tap' ? 'Pitch' : 'Feed') + ` (${UL()}/${mode === 'mill' || boreFz ? 'tooth' : 'rev'})`, SPL = metric ? 'm/min' : 'SFM', FPL = metric ? 'Feed mm/min' : 'Feed IPM';
  let cards = '';
  const tl = toolLifeOf(c), sfmB = SP?.est && ovc('sfm').state === 'est' ? estHtml(SP.est, 0, x => uSp(x) + (metric ? ' m/min' : ' SFM')) : ovc('sfm').state !== 'mfr' && v('sfm') ? ovHtml(ovc('sfm')) : SP ? `${src} · ${SP.basis}${SP.min != null ? ` · range ${fmt(SP, 0)}` : ''}${tl ? ` · <b>at ${tl} min tool life</b> (source)` : ''}` : '';
  const fB = mode === 'tap' || TH() ? (TH() && !v('fpt') ? 'enter TPI or pitch' : 'feed/rev = thread pitch (geometry)') : false ? '' : mode === 'tap' ? 'thread pitch (geometry)' : FD?.est && ovc('fpt').state === 'est' ? estHtml(FD.est, 4, x => uFeed(x) + ' ' + UL() + (mode === 'mill' ? '/t' : '/rev')) : ovc('fpt').state !== 'mfr' && v('fpt') ? ovHtml(ovc('fpt')) : FD ? `${src} · ${FD.basis}${FD.min != null ? ` · range ${fmt(FD, 4)}` : ''}` : '';
  const PR = mode === 'mill' || mode === 'drill' || mode === 'bore' ? printedAt(c, v('d')) : null;
  if (PR) { const r = printedRun(PR, { dIn: v('d'), z: v('z'), maxRpm: v('maxRpm') }), ps = `${src} · printed for Ø${PR.key} ${PR.unit}`;
    const capT = r.capped ? `<span class="warn">CAPPED: printed ${PR.rpm} RPM scaled to machine max; feed scaled by the same ratio</span> · ` : '';
    BAR.push(['RPM', Math.round(r.rpm)], [metric ? 'mm/min' : 'IPM', r.ipm != null ? uIpm(r.ipm) : '—']); cards += card('RPM', Math.round(r.rpm), capT + 'MANUFACTURER PRINTED · ' + ps) + (r.ipm != null ? card(FPL, uIpm(r.ipm), capT + 'MANUFACTURER PRINTED table feed' + (PR.tableFeed.unit === 'mm/min' ? ` (${PR.tableFeed.value} mm/min)` : '') + ' · ' + ps) : card(FPL, 'No manufacturer data', '', 'none'))
      + card(SPL, uSp(r.sfm), 'DERIVED from printed RPM × diameter') + (r.fz != null ? card(mode === 'drill' ? 'IPR' : 'Chip load', uFeed(mode === 'drill' ? r.ipm / r.rpm : r.fz), 'DERIVED from printed feed ÷ (RPM' + (mode === 'drill' ? ')' : ' × flutes)')) : ''); }
  else {
  const noEst = ESTTRY ? '<span class="estw">No estimate available</span> (fewer than 2 matching published tools from this maker)' : '';
  cards += v('sfm') ? card(SPL, uSp(v('sfm')), sfmB + (SP?.est ? (ovc('sfm').state === 'out' ? ` · ESTIMATE was ${uSp(SP.def)}` : '') : ovc('sfm').state !== 'mfr' && SP ? ` · manufacturer ${fmt(SP, 0)}` : ''), ovCls(ovc('sfm')), SP ? 'sfm' : '', SP?.est ? 'Reset to estimate' : null) : card(SPL, 'No manufacturer data', c && allMat(c) ? 'Feed table, all materials: no speed printed' : noEst, 'none');
  cards += v('fpt') ? card(fk, uFeed(v('fpt')), fB + (mode !== 'tap' && !TH() && FD?.est ? (ovc('fpt').state === 'out' ? ` · ESTIMATE was ${uFeed(FD.def)}` : '') : mode !== 'tap' && !TH() && ovc('fpt').state !== 'mfr' && FD ? ` · manufacturer ${fmt(FD, 4)}` : ''), mode !== 'tap' && !TH() ? ovCls(ovc('fpt')) : '', FD && mode !== 'tap' && !TH() ? 'fpt' : '', FD?.est ? 'Reset to estimate' : null) : card(fk, 'No manufacturer data' + (c?.feed ? ' at this diameter' : ''), mode !== 'tap' ? noEst : '', 'none');
  let o = null, extra = '';
  if (v('sfm') && v('fpt') && v('d')) {
    if (mode === 'mill') { o = compute({ sfm: v('sfm'), d: v('d'), fpt: v('fpt'), z: v('z'), ae: frac.ae * v('d'), ap: frac.ap * v('d'), stickout: v('so'), maxRpm: v('maxRpm'), maxHp: v('maxHp'), iso: c?.iso });
      extra = card('Est. power', (o.hp < 1 ? o.hp.toFixed(2) : o.hp.toFixed(1)) + ' HP', `DERIVED · DOC ${ENG.ap === 'mfg' ? 'manufacturer' : ENG.ap === 'yours' ? 'YOUR VALUE' : 'default'}, WOC ${ENG.ae === 'mfg' ? 'manufacturer' : ENG.ae === 'yours' ? 'YOUR VALUE' : 'default 25%'} · MRR ${o.mrr.toFixed(3)} in³/min at WOC ${(frac.ae * v('d')).toFixed(3)} × DOC ${(frac.ap * v('d')).toFixed(3)} in`) + `<div class="card wide"><div class="b">Chip load used for IPM: ${o.fpt.toFixed(4)} in/t (chip thinning + stickout, DERIVED)${o.hpCapped ? ' · <span class="warn">feed cut to fit machine HP</span>' : ''}</div></div>`; }
    if (mode === 'drill') o = drill({ sfm: v('sfm'), d: v('d'), ipr: v('fpt'), maxRpm: v('maxRpm') });
    if (mode === 'turn') { o = turn({ sfm: v('sfm'), d: v('d'), ipr: v('fpt'), ap: v('apT'), maxRpm: v('maxRpm') }); extra = TH() || PG() ? '' : card('MRR', metric ? (o.mrr * 16.387).toFixed(1) + ' cm³/min' : o.mrr.toFixed(2) + ' in³/min', 'DERIVED' + (o.capped ? ` at capped ${Math.round(o.sfmActual)} SFM` : ''));
      const d1 = PART() ? 0 : v('fD') || v('d'), cs = css({ sfm: v('sfm'), d0: v('d'), d1, maxRpm: v('maxRpm') });
      if (TH()) { const tf = threadFeed({ rpm: o.rpm, lead: v('fpt'), maxIpm: LS.get('machines', [])[$('mach').value]?.thrIpm }); o.rpm = tf.rpm; o.ipm = tf.ipm; const mx = LS.get('machines', [])[$('mach').value]?.thrIpm; o.thrW = tf.capped ? `<span class="warn">RPM capped by machine max threading feed ${mx} IPM</span> (your machine profile; replaces the 200 IPM rule of thumb) · ` : tf.high ? `<span class="warn">Threading feed ${Math.round(tf.ipm)} IPM is over ~200 IPM.</span> Shop rule of thumb (fallback, not manufacturer data) used because no machine max threading feed is set. Set it in the machine profile to replace this check. · ` : mx > 0 ? `within machine max threading feed ${mx} IPM · ` : ''; }
      if (TH()) extra = card('Constant RPM (G97)', `<span style="font-size:22px">G97 S${Math.round(o.rpm)}</span>`, (o.thrW || '') + `threading feed ${Math.round(o.ipm)} IPM (RPM × lead) · threading runs at a locked RPM · manufacturer SFM at part Ø${uLen(v('d'), 3)}` + (o.capped ? ' · <span class="warn">capped at machine max RPM</span>' : '') + ' · DERIVED'); else
      extra += card('RPM start → finish', `${Math.round(cs.rpm0)} → ${isFinite(cs.rpm1) ? Math.round(cs.rpm1) : '— (set a lathe profile for G50)'}`, `at Ø${uLen(v('d'), 3)} → Ø${uLen(d1, 3)}${PART() ? ' (part-off to center)' : ''} · DERIVED`)
        + card('CSS (G96)', `<span style="font-size:22px">G96 S${metric ? uSp(v('sfm')) : Math.round(v('sfm'))}<br>G50 S${v('maxRpm') || '—'}</span>`, (metric ? 'S in m/min (G21)' : 'S in SFM (G20)') + (cs.clampDia ? ` · RPM clamps at G50 below Ø${uLen(cs.clampDia, 3)}` : ' · <span class="warn">set a lathe profile for the G50 clamp</span>') + ' · DERIVED'); BAR.ipr = true; }
    if (mode === 'bore') { o = drill({ sfm: v('sfm'), d: v('d'), ipr: boreFz ? v('fpt') * (v('z') || 1) : v('fpt'), maxRpm: v('maxRpm') });
      extra = `<div class="card wide"><div class="b">Bore: RPM from SFM at bore Ø ${v('d')} in; ${boreFz ? `IPM = RPM × feed/tooth × ${v('z') || 1} cutting edge(s) (manufacturer prints per tooth)` : 'IPM = RPM × feed/rev (manufacturer prints per rev)'} · DERIVED</div></div>`; }
    if (mode === 'tap') o = tap({ sfm: v('sfm'), d: v('d'), pitch: v('fpt'), maxRpm: v('maxRpm') });
    const calc = 'CALCULATED from the values above' + (SP?.est || FD?.est ? ' · <span class="estw">uses an ESTIMATE</span>' : '') + (!v('maxRpm') ? ' · <span class="warn">no machine max RPM set</span>' : '');
    const soN = mode === 'mill' && stickoutFactor(v('so'), v('d')) < 1 ? ` · <span class="warn">feed reduced ${Math.round((1 - stickoutFactor(v('so'), v('d'))) * 100)}% for stickout</span> (DERIVED)` : '';
    cards += card('RPM', Math.round(o.rpm), (o.capped ? '<span class="warn">capped at machine max RPM</span> · ' : '') + calc) + (TH() ? '' : card(FPL, uIpm(o.ipm, mode === 'mill' ? 1 : 2), calc + soN)) + extra;
    BAR.push(['RPM', Math.round(o.rpm)], BAR.ipr ? [metric ? 'mm/rev' : 'IPR', uFeed(v('fpt'))] : [metric ? 'mm/min' : 'IPM', uIpm(o.ipm, mode === 'mill' ? 1 : 2)]);
  }
  }
  $('apT').closest('label').style.display = PG() ? 'none' : '';
  if (c && !PG()) { const apU = c.ap ? toIn(1, c.ap.unit) : 1, d = v('d'); let doc = [];
    if (c.ap?.value != null) doc.push(`DOC ${(c.ap.value * apU).toFixed(3)} in`); else if (c.ap) doc.push(`DOC ${c.ap.min != null ? (c.ap.min * apU).toFixed(3) + '–' : '≤ '}${(c.ap.max * apU).toFixed(3)} in`);
    if (c.apx) doc.push(`DOC ${c.apx}×D${d ? ` = ${(c.apx * d).toFixed(3)} in` : ''}`); if (c.aex) doc.push(`WOC ${c.aex}×D${d ? ` = ${(c.aex * d).toFixed(3)} in` : ''}`);
    if (PR?.ap) doc.push(`DOC ${PR.ap.value} ${PR.ap.unit} (printed for Ø${PR.key} ${PR.unit})`); if (PR?.ae) doc.push(`WOC ${PR.ae.value} ${PR.ae.unit} (printed for Ø${PR.key} ${PR.unit})`);
    if (c.woc) doc.push(`WOC ${(c.woc * 100).toFixed(0)}% of D`);
    if (c.feed?.byWoc) doc.push('WOC published at ' + Object.keys(c.feed.byWoc).map(k => (+k * 100).toFixed(0) + '%').join(', '));
    if (doc.length) cards += card('DOC / WOC', `<span style="font-size:22px">${doc.join('<br>')}</span>`, src, 'wide'); } // no card when it would only say No manufacturer data
  // nearest options with data, as chips
  let chips = []; const sig = x => JSON.stringify([x.iso, x.sfm, x.feed, x.ap, x.source?.catalog, x.source?.page]), seen = new Set(c ? [sig(c), c.label] : []);
  const fresh = x => { const s = sig(x); if (seen.has(s) || seen.has(x.label)) return false; seen.add(s); seen.add(x.label); return true; };
  if (t && (!c || !SP || !FD)) {
    if (OUTROW) t.conditions.map((x, i) => [x, i, rowDia(x)]).filter(([x, i, r]) => r && isoOk(x) && x.sfm && x.feed && String(i) !== $('cond').value && fresh(x)).sort((a, b) => Math.min(Math.abs(a[2][0] - inV('d')), Math.abs(a[2][1] - inV('d'))) - Math.min(Math.abs(b[2][0] - inV('d')), Math.abs(b[2][1] - inV('d')))).slice(0, 8).forEach(([x, i]) => chips.push([x.label, `c:${i}`]));
    if (c && !FD && c.feed && mode !== 'tap' && !OUTROW) diaList(c).slice(0, 12).forEach(x => chips.push([`Ø ${x.toFixed(4)} in`, `d:${x}`]));
    t.conditions.forEach((x, i) => { if (chips.length < 12 && String(i) !== $('cond').value && x.sfm && (mode === 'tap' || x.feed) && isoOk(x) && fresh(x)) chips.push([x.label, `c:${i}`]); });
    t.conditions.forEach((x, i) => { if (chips.length < 16 && x.sfm && (mode === 'tap' || x.feed) && !isoOk(x) && fresh(x)) chips.push([x.label + ' (other material)', `m:${i}`]); });
  }
  const usesEst = !!(SP?.est || FD?.est), miss = !c || usesEst || (!PR && (!v('sfm') || !v('fpt')));
  $('cards').innerHTML = w + (miss ? `<div class="out"><span class="warn">${OUTROW ? 'No mfr data at this size.' : 'No manufacturer data for this combo.'}</span>${usesEst ? ' <span class="estw">Blue boxes are ESTIMATES from this maker\'s other tools, not manufacturer data.</span>' : ''}${chips.length ? '<br>Nearest options from this tool with data:<div class="chips">' + chips.map(([l, k]) => `<button class="chip" data-k="${k}">${l}</button>`).join('') + '</div>' : ''}</div>` : '') + `<div class="cards">${cards}</div>`;
  if (mode === 'turn' && $('top').value === 'Face' && !c) { // no facing record: point to Turn, invent nothing
    $('cards').innerHTML = `<div class="out"><span class="warn">Catalogs don't print facing separately. Use the Turn numbers for the same insert.</span><br><button id="faceTurn" class="chip">Switch Operation to Turn</button></div>`;
    $('faceTurn').onclick = () => { $('top').value = 'Turn'; fillBrand(); }; }
  $('out').hidden = true;
  $('bar').innerHTML = BAR.length ? BAR.map(([k, x]) => `<span>${x} <small>${k}</small></span>`).join('') + `<small>${t ? (mode === 'tap' ? geo(t) : short(t.series)) : ''}</small>` + (usesEst ? '<small class="estw">ESTIMATE</small>' : '') : '<small>No manufacturer data for this combo</small>';
  if (!$('mach').value) $('bar').innerHTML += '<span class="warn" style="font-size:15px;width:100%">⚠ Pick a machine for RPM limits</span>';
}
$('cards').onclick = e => { if (e.target.closest('.estd')) return; const rs = e.target.closest('[data-reset]')?.dataset.reset; if (rs) { setIn(rs, defs[rs]); return run(); }
  const ov = e.target.closest('[data-ov]'); if (ov && !ov.querySelector('input')) { const f = ov.dataset.ov, box = ov.querySelector('.v'), x = document.createElement('input');
    x.type = 'number'; x.inputMode = 'decimal'; x.step = 'any'; x.value = $(f).value; box.replaceChildren(x); x.focus(); x.select(); let done = false;
    const end = ok => { if (done) return; done = true; if (ok && +x.value > 0) $(f).value = x.value; run(); };
    x.onkeydown = ev => { if (ev.key === 'Enter') end(true); if (ev.key === 'Escape') end(false); }; x.onblur = () => end(true); return; }
  const k = e.target.closest('.chip')?.dataset.k; if (!k) return; const [ty, x] = k.split(/:(.*)/);
  if (ty === 'd') { setIn('d', +x); if (mode === 'mill') showEng(); fill(); }
  if (ty === 'c') { $('cond').value = x; fill(); recent(); }
  if (ty === 'm') { $('iso').value = ''; $('mat').value = ''; syncPick(); fillCond().then(() => { $('cond').value = x; fill(); recent(); }); } };
$('dPick').onchange = () => { setIn('d', +$('dPick').value); if (mode === 'mill') showEng(); fill(); };
// Favorites & recent setups
const FIELDS = ['iso', 'mat', 'brand', 'kind', 'top', 'tapT', 'hole', 'pass', 'cut', 'tool', 'cond', 'thr', 'd', 'z', 'sfm', 'fpt', 'aeU', 'apU', 'ae', 'ap', 'apT', 'so', 'nose', 'cb', 'len', 'sup', 'cool', 'fD', 'hd', 'bd', 'shk'];
const snap = () => { const t = curTool(), c = t?.conditions[$('cond').value];
  const est = !!(SP?.est || FD?.est);
  return { mode, name: `${mode} · ${t ? t.brand + ' ' + t.series : '?'} · ${c?.label ?? ''}${$('cb').value ? ' · ' + $('cb').value : ''}${est ? ' · ESTIMATE' : ''}`, ...(est ? { est: true } : {}), v: Object.fromEntries(FIELDS.map(k => [k, $(k).value])) }; };
function recent() { const t = curTool(); if (!t) return; const s = snap(), r = LS.get('recent', []).filter(x => x.name !== s.name); r.unshift(s); LS.set('recent', r.slice(0, 8)); recallList(); }
function recallList() { const sel = $('recall'); if (!sel) return; sel.length = 1;
  for (const k of ['fav', 'recent']) { const l = LS.get(k, []); if (l.some(x => !MODES.includes(x.mode))) LS.set(k, migrate(l, SUM)); }
  forMode(LS.get('fav', []), mode).forEach(([x, i]) => sel.add(new Option('★ ' + x.name, 'f' + i))); forMode(LS.get('recent', []), mode).forEach(([x, i]) => sel.add(new Option('↺ ' + x.name, 'r' + i))); favMark(); }
const favAt = () => { const n = snap().name; return LS.get('fav', []).findIndex(x => x.name === n && x.mode === mode); };
const favMark = () => { const on = curTool() && favAt() >= 0; $('fav').textContent = on ? '★' : '☆'; $('fav').style.color = on ? '#ffd400' : '#fff'; };
$('fav').onclick = () => { if (!curTool()) return; const f = LS.get('fav', []), i = favAt(); if (i >= 0) f.splice(i, 1); else f.unshift(snap()); LS.set('fav', f.slice(0, 30)); recallList(); favMark(); };
$('recall').onchange = async () => { const k = $('recall').value; if (!k) return; const s = LS.get(k[0] === 'f' ? 'fav' : 'recent', [])[+k.slice(1)]; if (!s) return;
  await setMode(s.mode); $('iso').value = s.v.iso; $('mat').value = s.v.mat ?? ''; fillMat(); $('onlyData').checked = false; await fillBrand(); $('brand').value = s.v.brand; await fillTool(); $('tool').value = s.v.tool; await fillCond();
  for (const k2 of FIELDS) if (!['iso', 'mat', 'brand', 'tool', 'sfm', 'fpt'].includes(k2)) $(k2).value = s.v[k2];
  fill(); $('sfm').value = s.v.sfm; $('fpt').value = s.v.fpt; run(); $('recall').value = ''; };
document.querySelectorAll('[data-mode]').forEach(b => { b.onclick = () => setMode(b.dataset.mode); b.hidden = !SUM.some(t => t.mode === b.dataset.mode); });
['top', 'tapT'].forEach(k => $(k).onchange = fillBrand); $('kind').onchange = fillTool; ['pass', 'cut', 'nose', 'cb'].forEach(k => $(k).onchange = fillCond); $('pass').onchange = () => mode === 'turn' ? fillTool() : fillCond();
['fD', 'hd', 'bd', 'so'].forEach(k => $(k).oninput = run); $('tpi').oninput = $('pitchU').onchange = () => fillCond(); $('shk').onchange = run; $('hole').onchange = () => { const k = $('tool').value; fillTool(); if ($('tool').value === k) fill(); };
$('unit').onclick = () => { const KS = [...LEN, 'sfm', 'fpt'], x = Object.fromEntries(KS.map(k => [k, $(k).value === '' ? '' : inV(k)])); metric = !metric; LS.set('metric', metric);
  KS.forEach(k => setIn(k, x[k])); $('aeU').options[1].text = $('apU').options[1].text = UL(); showEng(); $('sfmLbl').firstChild.textContent = metric ? 'Speed (m/min)' : 'SFM';
  $('feedLbl').firstChild.textContent = $('feedLbl').firstChild.textContent.replace(/\b(in|mm)\//, UL() + '/').replace(/\((in|mm)\)/, `(${UL()})`); $('unit').textContent = metric ? 'mm' : 'inch'; document.querySelectorAll('.u').forEach(e => e.textContent = `(${UL()})`);
  $('dLbl').firstChild.textContent = $('dLbl').firstChild.textContent.replace(/\((in|mm)\)/, `(${UL()})`); run(); };
$('matPick').onchange = () => { TUSER = false; const [i, m] = $('matPick').value.split(':'); $('iso').value = i; $('mat').value = m ?? ''; fillBrand(); }; $('onlyData').onchange = fillBrand; $('brand').onchange = fillTool; $('tq').oninput = fillTool; $('cq').oninput = fillCond; $('tool').onchange = () => { TUSER = true; GUSER = false; $('cq').value = ''; fillGrade(''); }; $('grade').onchange = () => { GUSER = true; fillGrade(); updateFindLink(); }; $('mach').onchange = applyMachine;
$('cond').onchange = () => { fill(); recent(); }; $('cool').onchange = () => { if (mode === 'drill') { const k = $('tool').value; if (!TUSER) $('tool').value = ''; fillTool(); if ($('tool').value === k) fill(); } else fill(); }; $('thr').onchange = fillBrand; $('d').onchange = () => { TUSER = false; if (mode === 'mill') showEng(); if (mode === 'drill') { const k = $('tool').value; fillTool(); if ($('tool').value === k) return fill(); return; } fill(); };
['ae', 'aeU'].forEach(i => $(i).addEventListener('input', () => { if (i === 'ae') ENG.ae = 'yours'; readEng(); }));
['ap', 'apU'].forEach(i => $(i).addEventListener('input', () => { if (i === 'ap') ENG.ap = 'yours'; readEng(); }));
$('apT').addEventListener('input', () => { ENG.ap = 'yours'; engTags(); });
$('ae').onchange = () => { if (curTool()?.conditions[$('cond').value]?.feed?.byWoc) { readEng(); fill(); } };
['z', 'sfm', 'fpt', 'ae', 'ap', 'apT', 'len'].forEach(k => $(k).oninput = run); $('sup').onchange = run;
if (LS.get('metric', false)) $('unit').onclick(); $('cool').value = LS.get('lastCoolant', 'flood'); machines(); { const m = LS.get('machines', [])[$('mach').value]; if (m) { $('maxRpm').value = m.rpm || ''; $('maxHp').value = m.hp || ''; } }
recallList();
if (q.get('iso')) $('iso').value = q.get('iso');
if (q.get('mat')) $('mat').value = q.get('mat'); fillMat();
if (q.get('d')) $('d').value = q.get('d');
for (const k of ['len', 'sup', 'apT', 'maxRpm']) if (q.get(k)) $(k).value = q.get(k);
await setMode(mode);
if (q.get('tool')) { const t = SUM.find(x => x.key === q.get('tool')); if (t) { $('onlyData').checked = false; if (t.mode !== mode) await setMode(t.mode); await fillBrand(); $('brand').value = t.brand; await fillTool(); const g = Object.keys(GROUPS).find(k => GROUPS[k].includes(t.key)) ?? t.key; $('tool').value = g; await fillGrade(''); if ([...$('grade').options].some(o => o.value.startsWith(t.key + '|') && !o.disabled) && !$('grade').value.startsWith(t.key + '|')) { $('grade').value = [...$('grade').options].find(o => o.value.startsWith(t.key + '|') && !o.disabled).value; await fillCond(); } } }
if (q.get('cond')) { $('cond').value = q.get('cond'); fill(); }
if (q.get('thr')) { $('thr').value = q.get('thr'); fill(); }
if (q.get('d')) { $('d').value = q.get('d'); fill(); }
if (q.get('open')) document.querySelector('#src details')?.setAttribute('open', '');
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');

// MSC search for the exact tool picked: brand, series, grade/coating, size (native unit), flutes, type. Rebuilt on every run().
function mscBrand(b) { return ({ 'Allied': 'Allied Machine', 'Helical Solutions': 'Helical Solutions', 'Sandvik Coromant': 'Sandvik Coromant',  'Kodiak Cutting Tools': 'Kodiak', 'Sumitomo Electric Hardmetal': 'Sumitomo', 'Sumitomo Electric': 'Sumitomo', 'Mitsubishi Materials': 'Mitsubishi', 'KYOCERA SGS': 'SGS', 'Kyocera SGS': 'SGS', 'Dormer Pramet': 'Dormer', 'Lakeshore Carbide': 'Lakeshore', 'Data Flute': 'Data Flute', 'Garr Tool': 'Garr', 'Harvey Tool': 'Harvey Tool', 'Union Tool': 'Union Tool', 'ISCAR': 'Iscar', 'KORLOY': 'Korloy', 'FRAISA': 'Fraisa', 'MAPAL': 'Mapal' })[b]; }
function fracIn(x) { for (const den of [2, 4, 8, 16, 32, 64]) { const n = x * den; if (Math.abs(n - Math.round(n)) < 1e-4) { const w = Math.floor(Math.round(n) / den), r = Math.round(n) % den, g = (a, b) => b ? g(b, a % b) : a, k = g(r, den);
  return r ? `${w ? w + '-' : ''}${r / k}/${den / k}"` : `${w}"`; } } return +x.toFixed(4) + '"'; };
function findQuery() { const t = curTool(); if (!t || /shop-proven/i.test(t.brand)) return null; const c = t.conditions?.[$('cond').value] ?? {};
  const brand = /^Criterion\b/i.test(t.series) ? 'Criterion' : mscBrand(t.brand) ?? t.brand.replace(/\s+(Cutting Tools|Precision Tools|Coromant|Hardmetal)$/i, '');
  const blob = `${t.series} ${t.type ?? ''}`, ins = /insert|indexable|exchangeable|head|cutter|parting|groov|cut-off/i.test(blob) || mode === 'turn';
  const strip = x => String(x ?? '').replace(/[®™©]/g, '').replace(/\(.*?\)|\(.*$/g, ' ');
  let series = strip(t.series).split(/\s+[—–]\s+|[,:;]|\s-\s/)[0].replace(/\b\d\s*(fl|flutes?)\b|\b(series|list|grade|grades|inserts?|tools?|end ?mills?|drills?|taps?|turning|thread|threading|parting|grooving|cut-off|start values|recommended|cutting|conditions|standard|ball|nose|square|criterion|finish|boring|internal|external)\b/gi, ' ').replace(/&/g, ' ');
  series = series.split(/\s+/).filter(w => w && !/^(\d{1,2}x?|e\.g\.|and|for|of|the|with|&|\/|[-–—·])$/i.test(w) && w.toLowerCase() !== brand.toLowerCase() && !brand.toLowerCase().includes(w.toLowerCase())).slice(0, 3).join(' ');
  const gSel = $('grade'); let grade = !$('gradeL').hidden && gSel.selectedIndex >= 0 ? gSel.options[gSel.selectedIndex].textContent.replace(/ · .*$/, '') : (t.grade || t.coating || c.grade || '');
  grade = String(grade).split(/\s*[\/,]\s*|\s+or\s+/)[0].replace(/\(.*?\)/g, '').trim(); if (!/^[A-Z0-9][\w.\-]{1,11}$/i.test(grade) || /^(any|none|uncoated|carbide|hss|-)$/i.test(grade) && !/^(TiN|AlTiN|TiAlN|TiCN)$/i.test(grade)) grade = '';
  const insD = /\d/.test(c.insert ?? '') && /[A-Z]/.test(c.insert) && !/insert|negative|positive|inboard|outboard/i.test(c.insert) ? c.insert.trim() : '';
  const parts = [brand];
  if (insD) parts.push(insD); else if (series && !(grade && series.includes(grade))) parts.push(series); else if (series) parts.push(series);
  if (grade && !parts.join(' ').includes(grade)) parts.push(grade);
  if (mode === 'tap') { const th = threads.threads[$('thr').value]; if (th?.name) parts.push(th.name.replace(/^#/, '#')); parts.push('tap'); return parts; }
  const thMill = /thread ?mill/i.test(blob);
  if (!ins || mode === 'drill' && !/insert/i.test(t.type ?? '')) { const d = inV('d'); if (d > 0 && !thMill) { const mm = t.diameters_mm && !t.diameters_in || /metric|\bmm\b|ø/i.test(blob) && !/inch|fraction/i.test(blob); parts.push(mm ? `${+(d * 25.4).toFixed(2)} mm` : fracIn(d)); } }
  const zs = /(\d)\s*(?:fl\b|flutes?)/i.exec(t.series) ?? /^[A-Z]+\d+[A-Z]*-(\d)$/.exec(t.series.trim()), z = t.flutes || (zs ? +zs[1] : +$('z').value); if (mode === 'mill' && !ins && !thMill && z > 0) parts.push(`${z} Flute`);
  parts.push(thMill ? 'thread mill' : mode === 'mill' ? (ins ? (insD ? 'insert' : 'indexable mill') : 'end mill') : mode === 'drill' ? (insD || /insert/i.test(t.type ?? '') ? 'drill insert' : 'drill') : mode === 'bore' ? 'boring' : TH() ? 'threading insert' : PART() ? 'cut-off insert' : PG() ? 'grooving insert' : 'turning insert');
  return parts; }
function updateFindLink() {
  const a = $('findTool'); if (!a) return; const p = $('tool').value ? findQuery() : null;
  if (!p) { a.hidden = true; return; }
  const q = p.filter(x => x && !/^(undefined|null|NaN)$/.test(x) && !/DERIVED|MFR|YOUR VALUE/i.test(x)).join(' ').replace(/\s+/g, ' ').trim();
  a.href = 'https://www.mscdirect.com/browse/tn?searchterm=' + encodeURIComponent(q); a.dataset.q = q; a.textContent = 'Find this tool ↗'; a.title = 'MSC search: ' + q; a.hidden = false;
}
