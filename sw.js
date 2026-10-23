const C='fs-v1',F=['./','index.html','app.js','calc.js','manifest.json','data/index.json','data/kennametal.json','data/sandvik.json','data/iscar.json','data/drill-allied.json','data/turn.json','data/tap.json','data/threads.json'];
self.oninstall=e=>{self.skipWaiting();e.waitUntil(caches.open(C).then(c=>c.addAll(F)))};
self.onactivate=e=>e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))).then(()=>self.clients.claim()));
self.onfetch=e=>e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)));
