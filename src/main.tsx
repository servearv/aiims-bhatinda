import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// ── PWA Service Worker Registration ─────────────────────────────────────────
// vite-plugin-pwa injects `virtual:pwa-register` at build time.
// In dev mode (devOptions.enabled = false) this module is a no-op,
// so importing it is always safe.
import { registerSW } from 'virtual:pwa-register';

registerSW({
  // Called when a new SW version is waiting to take control.
  // We reload immediately so users always get the latest deployment.
  onNeedRefresh() {
    // Silent auto-update: the new SW takes over on next navigation.
    // For a more polite UX, you could show a toast here instead.
    console.info('[PWA] New version available — reloading...');
    window.location.reload();
  },
  onOfflineReady() {
    console.info('[PWA] App is ready to work offline.');
  },
  onRegistered(r) {
    if (r) {
      // Check for SW updates every 60 minutes while app is open
      setInterval(() => r.update(), 60 * 60 * 1000);
    }
  },
  onRegisterError(error) {
    console.error('[PWA] Service Worker registration failed:', error);
  },
});

// ── Online / Offline State Broadcasting ─────────────────────────────────────
// Dispatches a custom event that components can listen to via the
// `useOnlineStatus` hook (see App.tsx). This avoids polling navigator.onLine.
function broadcastOnlineStatus() {
  window.dispatchEvent(
    new CustomEvent('app:onlinestatus', { detail: { online: navigator.onLine } })
  );
}

window.addEventListener('online', broadcastOnlineStatus);
window.addEventListener('offline', broadcastOnlineStatus);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
