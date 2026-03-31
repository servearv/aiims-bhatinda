import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {registerSW} from 'virtual:pwa-register';
import App from './App.tsx';
import './index.css';

// Register PWA service worker
const updateSW = registerSW({
  onNeedRefresh() {
    // Dispatch custom event for UpdatePrompt component to listen
    window.dispatchEvent(new CustomEvent('sw-update-available'));
  },
  onOfflineReady() {
    console.log('[PWA] App ready for offline use');
  },
  onRegisteredSW(swUrl, registration) {
    // Check for updates every 60 minutes
    if (registration) {
      setInterval(() => {
        registration.update();
      }, 60 * 60 * 1000);
    }
  },
});

// Expose updateSW globally for the UpdatePrompt component
(window as any).__updateSW = updateSW;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
