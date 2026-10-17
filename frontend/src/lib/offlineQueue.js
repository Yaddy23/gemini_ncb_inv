// Offline scan queue, shared by the app and the service worker.
//
// Items are stored in IndexedDB (a service worker cannot read localStorage).
// Each item carries the request needed to sync it (URL, method, body, auth
// token captured at scan time), so any context with connectivity can replay it.
//
// Drain-safety: the page and the service worker can both try to flush the
// queue at the same time. Each item is claimed (status 'syncing' + claimedAt)
// before its request is sent, and stale claims are reclaimed, so an item is
// never processed twice (a stock patch replayed twice = double decrement).

import {
  STORE_QUEUE,
  STORE_SETTINGS,
  idbGetAll,
  idbGet,
  idbPut,
  idbDelete,
} from './idb';

const STALE_CLAIM_MS = 60 * 1000; // reclaim a claim older than a minute
const SYNC_TAG = 'stock-sync';
const TOKEN_KEY = 'accessToken';

// Mirror of the page's current access token, stored in IndexedDB because the
// service worker cannot read localStorage. Tokens captured at scan time go
// stale (access tokens last 15 minutes), so the drainer always prefers this
// freshest copy; the token stored on each queue item is only a fallback.
export async function saveCurrentToken(token) {
  if (!token) return;
  try {
    await idbPut(STORE_SETTINGS, { key: TOKEN_KEY, token });
  } catch (err) {
    // IDB unavailable - the item's captured token remains the fallback
  }
}

export async function getCurrentToken() {
  try {
    const record = await idbGet(STORE_SETTINGS, TOKEN_KEY);
    return record?.token || null;
  } catch (err) {
    return null;
  }
}

export async function clearCurrentToken() {
  try {
    await idbDelete(STORE_SETTINGS, TOKEN_KEY);
  } catch (err) {
    // IDB unavailable - nothing to clear
  }
}

function notifyQueueChanged() {
  // Only exists in the page context, not in the service worker
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new Event('offline-queue-changed'));
  }
}

// Enqueue a stock scan for later sync. `apiBase` is the resolved API base URL
// (e.g. '/api' or an absolute URL) so the service worker can fetch without
// knowing the app's axios config.
export async function enqueueScan({ apiBase, token, isbn, title, mode, qty = 1 }) {
  const item = {
    id: Date.now() + Math.random(),
    url: `${apiBase}/stock/${isbn}/stock`,
    method: 'PATCH',
    token,
    body: { action: mode === 'inbound' ? 'INBOUND' : 'OUTBOUND', qtyChanged: qty },
    meta: { isbn, title: title || '', mode, qty, timestamp: new Date().toLocaleTimeString() },
    status: 'pending',
    claimedAt: 0
  };
  await idbPut(STORE_QUEUE, item);
  notifyQueueChanged();
  return item;
}

// Pending (and stale-claimed) items — used for queue counts, the pending list
// UI, and the pending-outbound stock validation during scans.
export async function getPendingItems() {
  const all = await idbGetAll(STORE_QUEUE);
  const now = Date.now();
  return all.filter(
    item => item.status === 'pending' ||
      (item.status === 'syncing' && now - (item.claimedAt || 0) > STALE_CLAIM_MS)
  );
}

export async function getQueuedCount() {
  return (await getPendingItems()).length;
}

export async function getItem(id) {
  return idbGet(STORE_QUEUE, id);
}

export async function removeItem(id) {
  await idbDelete(STORE_QUEUE, id);
  notifyQueueChanged();
}

// One-time migration of the old localStorage scan queue (pre-PWA versions)
export async function migrateLocalStorageQueue(apiBase, getToken) {
  if (typeof window === 'undefined') return 0;
  let legacy = null;
  try {
    const raw = window.localStorage.getItem('scanQueue_v1');
    if (raw) legacy = JSON.parse(raw);
  } catch (err) {
    legacy = null;
  }
  if (!Array.isArray(legacy) || legacy.length === 0) {
    try { window.localStorage.removeItem('scanQueue_v1'); } catch (err) { /* ignore */ }
    return 0;
  }

  const existing = await idbGetAll(STORE_QUEUE);
  const existingIds = new Set(existing.map(item => item.id));

  let migrated = 0;
  for (const old of legacy) {
    if (!old?.isbn || existingIds.has(old.id)) continue;
    const item = {
      id: old.id || (Date.now() + Math.random()),
      url: `${apiBase}/stock/${old.isbn}/stock`,
      method: 'PATCH',
      token: getToken(),
      body: { action: old.mode === 'inbound' ? 'INBOUND' : 'OUTBOUND', qtyChanged: old.qty || 1 },
      meta: {
        isbn: old.isbn,
        title: '',
        mode: old.mode,
        qty: old.qty || 1,
        timestamp: old.timestamp || new Date().toLocaleTimeString()
      },
      status: 'pending',
      claimedAt: 0
    };
    await idbPut(STORE_QUEUE, item);
    migrated++;
  }

  try { window.localStorage.removeItem('scanQueue_v1'); } catch (err) { /* ignore */ }
  if (migrated > 0) notifyQueueChanged();
  return migrated;
}

// Ask the service worker to drain the queue when connectivity returns, even
// if the page is closed by then (Background Sync - Chromium browsers only).
export async function registerBackgroundSync() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (reg && 'sync' in reg) {
      await reg.sync.register(SYNC_TAG);
    }
  } catch (err) {
    // Background Sync unsupported or SW not ready - the page-driven flush
    // on the 'online' event is the fallback everywhere
  }
}

// Claim the next pending (or stale-claimed) item, or null when the queue is
// empty / fully claimed by someone else.
async function claimNextItem() {
  const items = await getPendingItems();
  if (items.length === 0) return null;
  const item = items[0];
  item.status = 'syncing';
  item.claimedAt = Date.now();
  await idbPut(STORE_QUEUE, item);
  return item;
}

async function releaseItem(item) {
  item.status = 'pending';
  item.claimedAt = 0;
  await idbPut(STORE_QUEUE, item);
}

async function readMessage(response) {
  try {
    const data = await response.json();
    return data?.message || `HTTP ${response.status}`;
  } catch (err) {
    return `HTTP ${response.status}`;
  }
}

// Drain the queue sequentially. Runs identically in the page and in the
// service worker. `onResult` receives { status, item, book?, message? } for
// each finished item, where status is one of:
//   'ok'        - synced, book is the updated book from the server
//   'not-found' - dropped, ISBN no longer exists server-side
//   'rejected'  - dropped, stock validation refused it (e.g. reserved stock)
//   'auth'      - kept queued, token (even refreshed) was rejected - log in again
// Returns a summary { ok, notFound, rejected, auth, remaining }.
export async function drainQueue(onResult = () => {}) {
  const summary = { ok: 0, notFound: 0, rejected: 0, auth: 0, remaining: 0 };

  // Drain only while there is connectivity
  while (typeof navigator === 'undefined' || navigator.onLine) {
    const item = await claimNextItem();
    if (!item) break;

    try {
      // Prefer the mirrored current token over the one captured at scan
      // time - queued scans routinely outlive the 15-minute access token
      const currentToken = await getCurrentToken();
      const token = currentToken || item.token;
      const response = await fetch(item.url, {
        method: item.method || 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify(item.body)
      });

      if (response.ok) {
        const book = await response.json().catch(() => null);
        await removeItem(item.id);
        summary.ok++;
        onResult({ status: 'ok', item, book });
      } else if (response.status === 404) {
        await removeItem(item.id);
        summary.notFound++;
        onResult({ status: 'not-found', item, message: await readMessage(response) });
      } else if (response.status === 400) {
        await removeItem(item.id);
        summary.rejected++;
        onResult({ status: 'rejected', item, message: await readMessage(response) });
      } else if (response.status === 401) {
        // Keep the scan queued - dropping it would silently lose a stock
        // movement. Stop the drain: logging in again (which refreshes the
        // mirror above) is the fix, and the next flush retries the item.
        await releaseItem(item);
        summary.auth++;
        onResult({ status: 'auth', item, message: 'Session expired' });
        break;
      } else {
        // Server error (5xx) - release the claim and stop; retry on next trigger
        await releaseItem(item);
        break;
      }
    } catch (err) {
      // Network failure - release the claim and stop; retry on next trigger
      await releaseItem(item);
      break;
    }

    // Small delay to avoid overwhelming the server
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  summary.remaining = await getQueuedCount();
  return summary;
}
