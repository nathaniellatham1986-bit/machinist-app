import { compute } from './calc.js';
const $ = id => document.getElementById(id);
const idx = await (await fetch('data/index.json')).json();
const tools = (await Promise.all(idx.brands.map(b => fetch('data/' + b).then(r => r.json())))).flatMap(b => b.tools);
tools.forEach((t, i) => $('tool').add(new Option(`${t.brand} — ${t.series}`, i)));
idx.materialGroups.forEach(([k, v]) => $('mat').add(new Option(`${k} — ${v}`, k)));
const q=new URLSearchParams(location.search); if(q.get("tool")) $("tool").value=q.get("tool"); if(q.get("mat")) $("mat").value=q.get("mat"); if(q.get("d")) $("d").value=q.get("d");
const MM = 25.4, toIn = (v, u) => u === 'mm' ? v / MM : v;
function nearest(byD, unit, dIn) {
  let best = null, err = 1e9;
  for (const [k, v] of Object.entries(byD)) { const e = Math.abs(toIn(+k, unit) - dIn); if (e < err) { err = e; best = [k, v]; } }
  return err < 0.02 ? best : null; // exact-size match only; never interpolate
}
function fillFromData() {
  const t = tools[$('tool').value], iso = $('mat').value, d = +$('d').value;
  if (t.flutes) $('z').value = t.flutes;
  const cool = $('cool').value;
  const r = t.recommendations.find(r => r.iso === iso && r.coolant === cool) || t.recommendations.find(r => r.iso === iso && r.coolant == null);
  let note = t.notes ? `<span class="tag">GUIDELINE</span> ${t.notes}` : '';
  $('sfm').value = ''; $('fpt').value = '';
  if (r) {
    const vc = r.vc; let sfm = null;
    if (vc) { const v = vc.start ?? (vc.min + vc.max) / 2; sfm = vc.unit === 'm/min' ? v * 3.2808 : v; $('sfm').value = Math.round(sfm); }
    const m = nearest(r.fz.byDiameter, r.fz.unit, d);
    if (m) { const v = typeof m[1] === 'object' ? (m[1].min + m[1].max) / 2 : m[1]; $('fpt').value = toIn(v, r.fz.unit).toFixed(4); }
    const s = r.source;
    note = `<span class="tag">${r.status.toUpperCase()}</span> ${s.manufacturer} · ${s.catalog} · ${s.edition} · <a style="color:#9cf" href="${s.url}">source</a>`
      + (vc ? `<br>vc range: ${vc.min ?? vc.start}–${vc.max ?? vc.start} ${vc.unit} (midpoint shown)` : '<br><span class="warn">No cutting speed published in source — enter SFM.</span>')
      + (m ? `<br>fz @ ${m[0]} ${r.fz.unit === 'mm' ? 'mm' : 'in'} catalog size` : '<br><span class="warn">No catalog fz at this exact diameter — enter chip load.</span>')
      + (r.ap_xD ? `<br>ap ${r.ap_xD}×D, ae ${r.ae_xD}×D` : '') + (r.coolant ? `<br>Coolant: ${r.coolant} (manufacturer stated)` : `<br><span class="warn">Coolant condition not stated in source; values not adjusted for ${cool}.</span>`) + (s.notes ? `<br>${s.notes}` : '');
  } else if (!t.notes) note = '<span class="warn">No sourced data for this tool/material — enter values.</span>';
  $('src').innerHTML = note; run();
}
function run() {
  const v = k => +$(k).value;
  if (!v('sfm') || !v('fpt') || !v('d')) { $('out').innerHTML = 'Enter SFM and chip load'; return; }
  const o = compute({ sfm: v('sfm'), d: v('d'), fpt: v('fpt'), z: v('z'), ae: v('ae'), ap: v('ap'), stickout: v('so'), maxRpm: v('maxRpm'), maxHp: v('maxHp'), iso: $('mat').value });
  $('out').innerHTML = `RPM<div class="big">${Math.round(o.rpm)}</div>${o.capped ? '<div class="warn">Capped at machine max RPM</div>' : ''}
  Feed IPM<div class="big">${o.ipm.toFixed(1)}</div>${o.hpCapped ? '<div class="warn">Feed cut to fit machine HP</div>' : ''}
  Adjusted chip load ${o.fpt.toFixed(4)} in/t <span class="tag">thinning + stickout (derived)</span><br>
  Est. power ${o.hp.toFixed(1)} HP <span class="tag">DERIVED</span>`;
}
['tool', 'mat', 'd', 'cool'].forEach(k => $(k).onchange = fillFromData);
['z', 'sfm', 'fpt', 'ae', 'ap', 'so', 'maxRpm', 'maxHp'].forEach(k => $(k).oninput = run);
fillFromData();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
