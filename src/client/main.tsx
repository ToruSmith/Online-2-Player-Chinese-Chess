import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { applyTheme, getSettings } from './lib/settings';
import './styles/app.css';

applyTheme(getSettings().theme);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

if (__DEV_RELOAD_URL__) {
  new EventSource(__DEV_RELOAD_URL__).addEventListener('change', () => location.reload());
} else if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error: unknown) => {
      console.warn('無法註冊離線功能', error);
    });
  });
}
