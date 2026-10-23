import { Navigate } from "react-router-dom";
import { UsersTab } from "./requests/UsersTab";
import { useAuth } from "../context/AuthContext";

/** Admin-only list of the organization's users; others land back on Home. */
export function UsersPage() {
  const { user } = useAuth();
  if (!user?.is_admin) return <Navigate to="/dashboard" replace />;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Users</h1>
          <div className="sub">Organization members and their agent access</div>
        </div>
      </div>

      <div className="card">
        <UsersTab />
      </div>
    </div>
  );
}
