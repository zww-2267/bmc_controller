import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@shared/stores/authStore';

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  if (!isLoggedIn) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
