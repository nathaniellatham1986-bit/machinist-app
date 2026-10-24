const C='fs-machines-v1',F=['./','index.html','app.js','calc.js','recall.js','manifest.json','data/index.json','data/threads.json'];
// Shell is precached; brand data files are cached on first use (lazy). Cache name is stamped by scripts/build-index.mjs.
self.oninstall=e=>{self.skipWaiting();e.waitUntil(caches.open(C).then(c=>c.addAll(F)))};
self.onactivate=e=>e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))).then(()=>self.clients.claim()));
self.onfetch=e=>{if(e.request.method!=='GET')return;e.respondWith(caches.match(e.request,{ignoreSearch:true}).then(r=>r||fetch(e.request).then(n=>{if(n.ok&&new URL(e.request.url).origin===location.origin){const c=n.clone();caches.open(C).then(x=>x.put(e.request,c))}return n})))};
