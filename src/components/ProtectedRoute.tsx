import { Navigate, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "../context/AuthContext";

interface ProtectedRouteProps {
  children: ReactNode;
  adminOnly?: boolean;
}

export function ProtectedRoute({ children, adminOnly }: ProtectedRouteProps) {
  const { user, ready } = useAuth();
  const location = useLocation();

  // Until GET /session answers we don't know yet; redirecting now would bounce a signed-in user.
  if (!ready) return null;
  if (!user) {
    return <Navigate to="/" state={{ from: location }} replace />;
  }
  if (adminOnly && !user.is_admin) {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
}
