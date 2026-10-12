// Global online/offline state for the whole app:
//  - tracks connectivity (navigator.onLine + online/offline events)
//  - tracks the offline scan queue depth (IndexedDB-backed)
//  - refreshes the offline book catalog when connectivity returns
//  - renders a global banner (see OnlineBanner) so users always know
//    whether they are offline and how many scans are waiting to sync
//
// The Scan page consumes this context instead of keeping its own
// isOnline state, so both the banner and the scan page agree.

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Wifi, WifiOff, Loader, RefreshCw } from 'lucide-react';
import { useToast } from '../components/Toast';
import api from '../api/axios';
import { getQueuedCount, drainQueue, migrateLocalStorageQueue, registerBackgroundSync } from '../lib/offlineQueue';
import { refreshCatalog } from '../lib/bookCatalog';

const OnlineContext = createContext({
  isOnline: true,
  queuedCount: 0,
  syncing: false,
  refreshQueuedCount: () => {},
  requestFlush: () => {},
  registerDrainHandler: () => {}
});

export const useOnline = () => useContext(OnlineContext);

export const OnlineProvider = ({ children }) => {
  const { toast } = useToast();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [queuedCount, setQueuedCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const flushingRef = useRef(false);
  // The Scan page registers its own drain (it updates recent-scans UI per
  // item); while it is mounted it owns the flush, otherwise this context
  // drains with a plain summary toast.
  const drainHandlerRef = useRef(null);

  const refreshQueuedCount = useCallback(() => {
    getQueuedCount().then(count => setQueuedCount(count)).catch(() => {});
  }, []);

  // One-time: migrate the pre-PWA localStorage scan queue into IndexedDB
  useEffect(() => {
    migrateLocalStorageQueue(api.defaults.baseURL || '/api', () => localStorage.getItem('token'))
      .then(() => refreshQueuedCount())
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Connectivity + queue-change listeners
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Refresh the offline catalog, then let the queue flush below
      refreshCatalog().catch(() => {});
    };
    const handleOffline = () => setIsOnline(false);
    const handleQueueChanged = () => refreshQueuedCount();

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('offline-queue-changed', handleQueueChanged);
    refreshQueuedCount();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('offline-queue-changed', handleQueueChanged);
    };
  }, [refreshQueuedCount]);

  // Results pushed by the service worker after a Background Sync drain
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const handleMessage = (event) => {
      if (event.data?.type !== 'STOCK_SYNC_DONE') return;
      refreshQueuedCount();
      const { ok, rejected, auth, notFound } = event.data.summary || {};
      if (ok > 0) toast.success(`Synced ${ok} offline scan${ok > 1 ? 's' : ''} in the background`);
      if (rejected > 0) toast.error(`${rejected} queued scan${rejected > 1 ? 's were' : ' was'} rejected by the server (stock validation)`);
      if (notFound > 0) toast.error(`${notFound} queued scan${notFound > 1 ? 's' : ''} dropped - book no longer in inventory`);
      if (auth > 0) toast.error('Some queued scans were dropped - your session expired, please log in again');
    };
    navigator.serviceWorker.addEventListener('message', handleMessage);
    return () => navigator.serviceWorker.removeEventListener('message', handleMessage);
  }, [toast, refreshQueuedCount]);

  const registerDrainHandler = useCallback((handler) => {
    drainHandlerRef.current = handler;
    return () => {
      if (drainHandlerRef.current === handler) drainHandlerRef.current = null;
    };
  }, []);

  const requestFlush = useCallback(async () => {
    if (!navigator.onLine) return;
    // A mounted Scan page owns the drain (per-item UI updates)
    if (drainHandlerRef.current) {
      drainHandlerRef.current();
      return;
    }
    if (flushingRef.current) return;
    flushingRef.current = true;
    setSyncing(true);
    try {
      const summary = await drainQueue();
      refreshQueuedCount();
      if (summary.ok > 0) toast.success(`Synced ${summary.ok} offline scan${summary.ok > 1 ? 's' : ''}`);
      if (summary.rejected > 0) toast.error(`${summary.rejected} queued scan${summary.rejected > 1 ? 's were' : ' was'} rejected by the server (stock validation)`);
      if (summary.notFound > 0) toast.error(`${summary.notFound} queued scan${summary.notFound > 1 ? 's' : ''} dropped - book no longer in inventory`);
      if (summary.auth > 0) toast.error('Some queued scans were dropped - your session expired, please log in again');
      if (summary.remaining > 0) {
        // Couldn't finish (e.g. connection dropped mid-flush) - try again
        // when the browser detects connectivity
        await registerBackgroundSync();
      }
    } catch (err) {
      // flush failures are non-fatal - items stay queued
    } finally {
      flushingRef.current = false;
      setSyncing(false);
    }
  }, [refreshQueuedCount, toast]);

  // When connectivity returns (or app opens online), flush anything queued
  useEffect(() => {
    if (isOnline && queuedCount > 0) {
      requestFlush();
    }
  }, [isOnline, queuedCount, requestFlush]);

  return (
    <OnlineContext.Provider value={{ isOnline, queuedCount, syncing, refreshQueuedCount, requestFlush, registerDrainHandler }}>
      {children}
    </OnlineContext.Provider>
  );
};

// Global banner shown at the top of the content area. Mount it once,
// inside the app layout (App.jsx places it at the top of <main>).
export const OnlineBanner = () => {
  const { isOnline, queuedCount, syncing, requestFlush } = useOnline();

  if (isOnline && queuedCount === 0 && !syncing) return null;

  return (
    <div
      className={`mb-4 rounded-lg border px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 ${
        isOnline
          ? 'bg-blue-50 border-blue-200 text-blue-800'
          : 'bg-amber-50 border-amber-300 text-amber-900'
      }`}
      role="status"
    >
      <div className="flex items-center space-x-3">
        {syncing ? (
          <Loader className="w-5 h-5 flex-shrink-0 animate-spin text-blue-600" />
        ) : isOnline ? (
          <Wifi className="w-5 h-5 flex-shrink-0 text-blue-600" />
        ) : (
          <WifiOff className="w-5 h-5 flex-shrink-0 text-amber-600" />
        )}
        <div>
          {!isOnline ? (
            <p className="font-medium">
              You're offline{queuedCount > 0 ? ` — ${queuedCount} scan${queuedCount > 1 ? 's' : ''} queued, will sync when connected` : ' — some actions are unavailable'}
            </p>
          ) : syncing ? (
            <p className="font-medium">Syncing queued scans…</p>
          ) : (
            <p className="font-medium">{queuedCount} scan{queuedCount > 1 ? 's' : ''} queued for sync</p>
          )}
          {!isOnline && (
            <p className="text-xs opacity-80">Scanning still works — stock is validated against the last synced catalog</p>
          )}
        </div>
      </div>
      {isOnline && !syncing && queuedCount > 0 && (
        <button
          onClick={requestFlush}
          className="flex-shrink-0 flex items-center space-x-1.5 px-3 py-1.5 text-sm font-medium bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 min-h-[36px]"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Sync now</span>
        </button>
      )}
    </div>
  );
};
