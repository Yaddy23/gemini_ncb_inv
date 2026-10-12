// Custom service worker source, bundled by vite-plugin-pwa
// (strategies: 'injectManifest') into dist/sw.js.
//
// Responsibilities:
//  - Precache the app shell so the app opens offline
//  - Serve index.html for SPA navigations (workbox NavigationRoute)
//  - Background Sync: drain the offline scan queue (IndexedDB) when
//    connectivity returns, even if the page is closed (Chromium browsers)
//
// API requests are intentionally NOT cached: stock data must always come
// from the network when available.

import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { drainQueue } from './lib/offlineQueue';

// autoUpdate behaviour: activate new SW versions immediately
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

// SPA navigation fallback - serve the precached shell for any in-app route
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')));

// Background Sync: replay queued stock scans when connectivity returns.
// On browsers without Background Sync (Firefox, Safari) the page-driven
// flush on the 'online' event is the fallback.
self.addEventListener('sync', (event) => {
  if (event.tag !== 'stock-sync') return;
  event.waitUntil(drainQueueInBackground());
});

async function drainQueueInBackground() {
  const summary = await drainQueue();

  // Tell any open page so it can refresh its pending-queue UI and toast
  // the outcome
  const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  clients.forEach(client => {
    client.postMessage({ type: 'STOCK_SYNC_DONE', summary });
  });

  // Some items could not be synced (server/network error) - ask to be
  // woken again on the next connectivity window
  if (summary.remaining > 0) {
    try {
      await self.registration.sync.register('stock-sync');
    } catch (err) {
      // Sync registration can fail on some platforms - ignore, the page
      // flush will retry when the app is next opened
    }
  }
}

// Manual drain trigger from the page (e.g. after enqueueing while online)
self.addEventListener('message', (event) => {
  if (!event.data) return;
  if (event.data.type === 'SKIP_WAITING') self.skipWaiting();
  if (event.data.type === 'FLUSH_QUEUE') {
    event.waitUntil(drainQueueInBackground());
  }
});
