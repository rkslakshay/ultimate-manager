import { Navigate, Outlet, useLocation } from 'react-router';
import { FullPageSpinner } from '@/components/FullPageSpinner';
import { useMe } from './api';

/** Renders child routes only for signed-in users; otherwise redirects to /login. */
export function RequireAuth() {
  const { data: user, isPending, isError } = useMe();
  const location = useLocation();
  if (isPending) return <FullPageSpinner />;
  if (isError || !user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <Outlet />;
}

/** Login/register: bounce signed-in users to their saves. */
export function PublicOnly() {
  const { data: user, isPending } = useMe();
  if (isPending) return <FullPageSpinner />;
  if (user) return <Navigate to="/saves" replace />;
  return <Outlet />;
}
