/* Путь кармы v2 — офлайн. Версия кэша меняется при каждой сборке (см. build.py). */
const VERSION = "20261016-f9411385";
const CACHE = "put-karmy-" + VERSION;
const CORE = ["./", "./index.html", "./styles.css", "./content.js", "./rules.js", "./store.js", "./app.js", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png",
  "./img/bg-morning.webp", "./img/bg-evening.webp", "./img/traveler.webp", "./img/astrolabe.webp",
  ...["sunrise", "moon", "mirror", "stone", "mountain", "star", "key", "flame", "eye", "flag", "backpack", "hourglass"].map(n => `./img/ic-${n}.webp`),
  ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `./img/num-${n}.webp`)];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE))); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith("put-karmy-") && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("message", e => { if (e.data && e.data.type === "SKIP_WAITING") self.skipWaiting(); });
self.addEventListener("fetch", e => {
  const r = e.request; if (r.method !== "GET") return;
  const u = new URL(r.url); if (u.origin !== location.origin) return;
  const isNav = r.mode === "navigate";
  const isCode = /\.(js|css|webmanifest)$/.test(u.pathname) || isNav;
  if (isCode) {
    /* Сеть сначала, чтобы обновления приходили; без сети — кэш. Кэшируем только успешные ответы. */
    e.respondWith(fetch(r).then(res => { if (res && res.ok) caches.open(CACHE).then(c => c.put(r, res.clone())); return res; })
      .catch(() => caches.match(r, { ignoreSearch: true }).then(m => m || (isNav ? caches.match("./index.html") : Response.error()))));
  } else {
    /* Картинки и прочее: кэш сначала. Отсутствующий ассет не подменяем HTML. */
    e.respondWith(caches.match(r, { ignoreSearch: true }).then(m => m || fetch(r).then(res => { if (res && res.ok) caches.open(CACHE).then(c => c.put(r, res.clone())); return res; }).catch(() => Response.error())));
  }
});
