import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ApiError } from './api/client';
import { PlayerProvider } from './context/PlayerContext';
import { PrefsProvider } from './context/PrefsContext';
import App from './App';
import { pushSupported, registerServiceWorker } from './lib/push';
import './styles.css';
import './styles/themes.css'; // team/light palettes — loaded after base so overrides win

// Register the service worker (enables installability + push). Best-effort.
if (pushSupported()) {
  window.addEventListener('load', () => { void registerServiceWorker().catch(() => {}); });
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // Don't burn retries on deterministic client errors: 401 (expired session, handled
      // by the global logout) and 429 (rate limit, where retrying makes it worse). Network
      // failures and 5xx still get the default three attempts.
      retry: (failureCount, error) =>
        !(error instanceof ApiError && error.status >= 400 && error.status < 500) && failureCount < 3,
      // Re-sync on return-to-app and on network recovery so the UI is never stuck on
      // stale data (e.g. you switch away to watch the match, come back → scores are fresh).
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      // Per-query polling intervals pause automatically while the tab is hidden, so we
      // never poll in the background — battery/network is only used while on-screen.
      refetchIntervalInBackground: false,
    },
  },
});

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Root element not found');

createRoot(rootEl).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <PlayerProvider>
          <PrefsProvider>
            <App />
          </PrefsProvider>
        </PlayerProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
