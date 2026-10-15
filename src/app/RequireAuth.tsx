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
    return <Navigate to="/masuk" replace state={{ from: `${location.pathname}${location.search}` }} />;
  }
  return (
    <DataGate userId={state.user.id}>
      <Outlet />
    </DataGate>
  );
}
