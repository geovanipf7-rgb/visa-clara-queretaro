// App instalable y modo sin conexión: guarda la app (no los datos) para que el Semáforo con reglas,
// la Guía, la Autoevaluación y el asistente gratuito funcionen aunque se caiga la señal.
// Nunca guarda nada de /api/: ni textos, ni respuestas, ni contadores.
const CACHE = 'visa-clara-v2';
const RAIZ = new URL('./', self.registration.scope).href;

async function guardarApp() {
  const cache = await caches.open(CACHE);
  const respuesta = await fetch(RAIZ, { cache: 'no-store' });
  const html = await respuesta.clone().text();
  await cache.put(RAIZ, respuesta);
  // Los archivos de la app cambian de nombre en cada versión: se leen del HTML (rutas absolutas o relativas).
  const archivos = [...html.matchAll(/(?:src|href)="((?:\.\/|\/)[^"]+)"/g)].map((m) => new URL(m[1], RAIZ).href);
  await cache.addAll([...new Set(archivos)]);
}

self.addEventListener('install', (evento) => {
  evento.waitUntil(guardarApp().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((claves) => Promise.all(claves.filter((c) => c !== CACHE).map((c) => caches.delete(c))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (evento) => {
  const peticion = evento.request;
  const url = new URL(peticion.url);
  if (peticion.method !== 'GET' || url.origin !== self.location.origin || url.pathname.includes('/api/')) return;

  // Primero la red (para tener siempre la versión nueva); si no hay red, lo guardado.
  evento.respondWith(
    fetch(peticion)
      .then((respuesta) => {
        if (respuesta.ok) {
          const copia = respuesta.clone();
          caches.open(CACHE).then((cache) => cache.put(peticion, copia));
        }
        return respuesta;
      })
      .catch(() => caches.match(peticion).then((guardada) => guardada || caches.match(RAIZ))),
  );
});
