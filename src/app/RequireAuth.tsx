import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { SessionLoading } from '../components/layout/SessionLoading';
import { DataGate } from './DataGate';

/** Every data screen sits under this guard: no session → /masuk; with a session → the data source is opened first. */
export function RequireAuth() {
  const { state } = useAuth();
  const location = useLocation();

  if (state.status === 'loading') return <SessionLoading />;
  if (state.status === 'signedOut') {
    // Only an unplanned loss of session (none yet, expired, revoked elsewhere) returns to the screen asked for. After
    // Keluar, an old history entry (Back, or the reload after signing out everywhere) is not a destination.
    const from = state.byUser ? undefined : { from: `${location.pathname}${location.search}` };
    return <Navigate to="/masuk" replace state={from} />;
  }
  return (
    <DataGate userId={state.user.id}>
      <Outlet />
    </DataGate>
  );
}
