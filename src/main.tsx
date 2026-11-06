import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
// Reads a shared recipe link before the app uses the address for its tabs
import './utils/recipeLink';
import App from './App.tsx';
import { registerServiceWorker } from './serviceWorkerRegistration';

if (typeof window !== 'undefined' && 'scrollRestoration' in window.history) {
  window.history.scrollRestoration = 'manual';
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Register PWA service worker
registerServiceWorker();
