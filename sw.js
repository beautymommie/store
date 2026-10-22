const V = "katalog-v28", IMG = "katalog-img-v1";
const SHELL = ["./", "index.html", "admin.html", "manifest.json", "manifest-admin.json", "icon-192.png", "icon-512.png", "icon-maskable-512.png", "apple-touch-icon.png"];

// Satu file yang gagal diunduh tidak boleh membatalkan pemasangan service worker
self.addEventListener("install", e => e.waitUntil(
  caches.open(V).then(c => Promise.all(SHELL.map(u => c.add(u).catch(() => {})))).then(() => self.skipWaiting())));
self.addEventListener("activate", e => e.waitUntil(
  caches.keys().then(k => Promise.all(k.filter(x => x !== V && x !== IMG).map(x => caches.delete(x)))).then(() => self.clients.claim())));

self.addEventListener("fetch", e => {
  const r = e.request; if (r.method !== "GET") return;
  const u = new URL(r.url);

  // Halaman & file aplikasi: tampil dari cache, diperbarui di latar belakang
  if (u.origin === location.origin) {
    e.respondWith(caches.open(V).then(async c => {
      const hit = await c.match(r, { ignoreSearch: true });
      const net = fetch(r).then(res => { if (res.ok) c.put(r, res.clone()); return res; }).catch(() => null);
      if (hit) { e.waitUntil(net); return hit; }
      const res = await net;
      if (res && res.ok) return res;
      // Halaman 404 / offline tidak ditampilkan di dalam aplikasi: pakai salinan halaman utama
      if (r.mode === "navigate") {
        const f = await c.match(u.pathname.endsWith("admin.html") ? "admin.html" : "index.html");
        if (f) return f;
      }
      return res || Response.error();
    }));
    return;
  }

  // Foto produk (Google Drive): cache dulu agar langsung muncul
  if (/googleusercontent\.com$/.test(u.hostname) || (u.hostname === "drive.google.com" && u.pathname.startsWith("/thumbnail"))) {
    e.respondWith(caches.open(IMG).then(async c => {
      const hit = await c.match(r); if (hit) return hit;
      try {
        const res = await fetch(r);
        if (res.ok || res.type === "opaque") { c.put(r, res.clone()); c.keys().then(k => { if (k.length > 200) c.delete(k[0]); }); }
        return res;
      } catch { return Response.error(); }
    }));
  }
  // Data produk (script.google.com) tidak dicegat; cache-nya diatur di halaman
});
