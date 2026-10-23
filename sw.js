const C='fs-v0',F=['./','index.html','app.js','calc.js','manifest.json','data/index.json','data/generic.json','data/kennametal.json','data/sandvik.json','data/iscar.json'];
self.oninstall=e=>e.waitUntil(caches.open(C).then(c=>c.addAll(F)));
self.onfetch=e=>e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)));
