import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { App } from './app/App';
import { ConfigError } from './app/ConfigError';
import { AuthProvider } from './auth/AuthProvider';
import { addressWithoutAuthLink, parseAuthLink } from './auth/authLink';
import { createFixtureAuthService, createSupabaseAuthService } from './auth/authService';
import { appConfig } from './lib/env';
import { getSupabase } from './lib/supabase';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, retryDelay: 400, staleTime: 30_000, refetchOnWindowFocus: false },
  },
});

// Before anything renders, whatever the config: an email link's result (and session tokens) must not stay in the
// address bar or in the history entry. The session itself is revoked below once Supabase is available.
const authLink = parseAuthLink(window.location.hash);
if (authLink) window.history.replaceState(null, '', addressWithoutAuthLink(window.location.href, authLink));

const root = document.getElementById('root');
if (!root) throw new Error('Elemen #root tidak ditemukan');

if (appConfig.kind === 'invalid') {
  createRoot(root).render(
    <StrictMode>
      <ConfigError problems={appConfig.problems} />
    </StrictMode>,
  );
} else {
  const authService = appConfig.kind === 'fixture' ? createFixtureAuthService() : createSupabaseAuthService(getSupabase());
  if (authLink?.accessToken) void authService.revokeLinkSession(authLink.accessToken);
  createRoot(root).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider service={authService}>
            <App />
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </StrictMode>,
  );
}
