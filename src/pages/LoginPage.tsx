import { useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ApiError } from "../api/client";
import logo from "../assets/agentdna-logo.png";

interface LocationState {
  from?: { pathname?: string };
}

export function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (user) {
    const to = (location.state as LocationState | null)?.from?.pathname || "/";
    return <Navigate to={to} replace />;
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email.trim(), password);
      const to = (location.state as LocationState | null)?.from?.pathname || "/";
      navigate(to, { replace: true });
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Login failed. Check your credentials.";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        background: "var(--bg-0)",
        position: "relative",
      }}
    >
      <form
        onSubmit={onSubmit}
        style={{
          width: 380,
          maxWidth: "100%",
          background: "var(--bg-1)",
          border: "1px solid var(--line)",
          borderRadius: 16,
          padding: 32,
          boxShadow: "0 24px 64px rgba(15, 32, 70, 0.08)",
          display: "flex",
          flexDirection: "column",
          gap: 18,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, marginBottom: 4 }}>
          <img src={logo} alt="AgentDNA" style={{ height: 36, width: "auto" }} />
          <div style={{ textAlign: "center" }}>
            <h1
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 20,
                fontWeight: 600,
                letterSpacing: "-0.02em",
                margin: "4px 0 6px",
                color: "var(--fg)",
              }}
            >
              Sign in to AgentDNA
            </h1>
            <div style={{ fontSize: 13, color: "var(--fg-muted)" }}>
              Welcome back. Enter your credentials to continue.
            </div>
          </div>
        </div>

        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 500, color: "var(--fg-dim)" }}>Email</span>
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            style={inputStyle}
          />
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 500, color: "var(--fg-dim)" }}>Password</span>
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            style={inputStyle}
          />
        </label>

        {error && (
          <div
            style={{
              fontSize: 12.5,
              color: "var(--threat)",
              background: "rgba(220, 38, 38, 0.06)",
              border: "1px solid rgba(220, 38, 38, 0.18)",
              borderRadius: 8,
              padding: "8px 12px",
            }}
          >
            {error}
          </div>
        )}

        <button type="submit" className="btn primary" disabled={submitting} style={{ justifyContent: "center", marginTop: 4 }}>
          {submitting ? "Signing in…" : "Sign in"}
        </button>

        <div style={{ fontSize: 11.5, color: "var(--fg-faint)", textAlign: "center" }}>
          Secured by AgentDNA · org-scoped JWT
        </div>
      </form>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "var(--bg-1)",
  border: "1px solid var(--line)",
  color: "var(--fg)",
  padding: "10px 12px",
  borderRadius: 8,
  fontFamily: "inherit",
  fontSize: 13.5,
  outline: "none",
};
