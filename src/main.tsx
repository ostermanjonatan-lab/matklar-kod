import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// The fonts are part of the app, so nothing is fetched from Google when it opens
import '@fontsource-variable/fraunces/opsz.css';
import '@fontsource-variable/plus-jakarta-sans';
import './index.css';
import './styles/dark.css';
import { applyTheme, watchSystemTheme } from './utils/theme';
// Reads a shared recipe link before the app uses the address for its tabs
import './utils/recipeLink';
import App from './App.tsx';
import { ErrorBoundary } from './components/layout/ErrorBoundary';
import { registerServiceWorker } from './serviceWorkerRegistration';

if (typeof window !== 'undefined' && 'scrollRestoration' in window.history) {
  window.history.scrollRestoration = 'manual';
}

applyTheme();
watchSystemTheme();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);

// Register PWA service worker
registerServiceWorker();
