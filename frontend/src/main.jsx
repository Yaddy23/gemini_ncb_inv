import React from 'react';
import ReactDOM from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import './index.css';

// Register the service worker (precache app shell + Background Sync).
// autoUpdate: new SW versions activate immediately on next visit.
registerSW({ immediate: true });

// When a NEW service worker takes control of this page (skipWaiting), the
// page is still running the OLD bundle. Reload once so users never stay on
// a stale cached version. Only armed when a controller already existed at
// load, so the very first visit doesn't reload.
if (navigator.serviceWorker?.controller) {
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!reloaded) {
      reloaded = true;
      window.location.reload();
    }
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);