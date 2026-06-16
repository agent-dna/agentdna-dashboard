import { useState, type FormEvent, type CSSProperties } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ApiError } from "../api/client";
import logo from "../assets/agentdna-logo.png";

interface LocationState {
  from?: { pathname?: string };
}

type Role = "user" | "admin";
type AdminMode = "login" | "register";

export function LoginPage() {
  const { user, login, loginAdmin, registerAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [role, setRole] = useState<Role>("user");
  const [adminMode, setAdminMode] = useState<AdminMode>("login");

  // User login: email field. Admin login/register: username field.
  const [email, setEmail] = useState("");       // user login only
  const [username, setUsername] = useState(""); // admin login + register
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [org, setOrg] = useState(""); // admin register: org name

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (user) {
    const to = (location.state as LocationState | null)?.from?.pathname || "/";
    return <Navigate to={to} replace />;
  }

  const resetFields = () => {
    setEmail("");
    setUsername("");
    setPassword("");
    setConfirmPassword("");
    setOrg("");
    setError(null);
  };

  const switchRole = (r: Role) => {
    setRole(r);
    resetFields();
  };

  const switchAdminMode = (m: AdminMode) => {
    setAdminMode(m);
    resetFields();
  };

  const isRegister = role === "admin" && adminMode === "register";
  const isAdminLogin = role === "admin" && adminMode === "login";

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (isRegister) {
      if (password !== confirmPassword) {
        setError("Passwords do not match.");
        return;
      }
      if (!org.trim()) {
        setError("Organisation name is required.");
        return;
      }
    }

    setSubmitting(true);
    try {
      if (isRegister) {
        await registerAdmin(username.trim(), password, org.trim());
      } else if (isAdminLogin) {
        await loginAdmin(username.trim(), password);
      } else {
        await login(email.trim(), password);
      }
      const to = (location.state as LocationState | null)?.from?.pathname || "/";
      navigate(to, { replace: true });
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Something went wrong. Please try again.";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const heading = isRegister
    ? "Create admin account"
    : role === "admin"
    ? "Admin sign in"
    : "Sign in";

  const subheading = isRegister
    ? "Register a new admin account for your organisation."
    : role === "admin"
    ? "Sign in to your admin account to manage AgentDNA."
    : "Welcome back. Enter your credentials to continue.";

  const btnLabel = submitting
    ? isRegister
      ? "Creating account…"
      : "Signing in…"
    : isRegister
    ? "Create account"
    : "Sign in";

  return (
    <div style={pageStyle}>
      {/* Grid dot background */}
      <div style={gridStyle} />

      <div style={cardStyle}>
        {/* Logo + headings */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, marginBottom: 8 }}>
          <img src={logo} alt="AgentDNA" style={{ height: 34, width: "auto" }} />
          <div style={{ textAlign: "center" }}>
            <h1 style={headingStyle}>{heading}</h1>
            <p style={subStyle}>{subheading}</p>
          </div>
        </div>

        {/* Role toggle — User / Admin */}
        <div style={pillWrapStyle}>
          <button
            type="button"
            style={pillBtn(role === "user")}
            onClick={() => switchRole("user")}
          >
            User
          </button>
          <button
            type="button"
            style={pillBtn(role === "admin")}
            onClick={() => switchRole("admin")}
          >
            Admin
          </button>
        </div>

        {/* Admin mode tabs — Login / Register */}
        {role === "admin" && (
          <div style={tabRowStyle}>
            <button
              type="button"
              style={tabBtn(adminMode === "login")}
              onClick={() => switchAdminMode("login")}
            >
              Login
            </button>
            <button
              type="button"
              style={tabBtn(adminMode === "register")}
              onClick={() => switchAdminMode("register")}
            >
              Register
            </button>
          </div>
        )}

        {/* Form */}
        <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>

          {/* User login uses email; Admin flows use username */}
          {role === "user" ? (
            <Field label="Email">
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                style={inputStyle}
              />
            </Field>
          ) : (
            <Field label="Username">
              <input
                type="text"
                autoComplete="username"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin_username"
                style={inputStyle}
              />
            </Field>
          )}

          <Field label="Password">
            <input
              type="password"
              autoComplete={isRegister ? "new-password" : "current-password"}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              style={inputStyle}
            />
          </Field>

          {isRegister && (
            <>
              <Field label="Confirm password">
                <input
                  type="password"
                  autoComplete="new-password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  style={inputStyle}
                />
              </Field>
              <Field label="Organisation">
                <input
                  type="text"
                  required
                  value={org}
                  onChange={(e) => setOrg(e.target.value)}
                  placeholder="my-org"
                  style={inputStyle}
                />
              </Field>
            </>
          )}

          {error && <div style={errorStyle}>{error}</div>}

          <button
            type="submit"
            disabled={submitting}
            style={submitBtnStyle(submitting)}
          >
            {btnLabel}
          </button>
        </form>

        {/* Footer */}
        <div style={footerStyle}>
          {role === "admin" && adminMode === "login" && (
            <span>
              Don't have an account?{" "}
              <button type="button" style={linkBtnStyle} onClick={() => switchAdminMode("register")}>
                Register
              </button>
            </span>
          )}
          {role === "admin" && adminMode === "register" && (
            <span>
              Already have an account?{" "}
              <button type="button" style={linkBtnStyle} onClick={() => switchAdminMode("login")}>
                Sign in
              </button>
            </span>
          )}
          {role === "user" && (
            <span>
              Are you an admin?{" "}
              <button type="button" style={linkBtnStyle} onClick={() => switchRole("admin")}>
                Admin sign in
              </button>
            </span>
          )}
        </div>
      </div>

      <div style={brandFooterStyle}>Secured by AgentDNA · org-scoped JWT</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--fg-dim)", letterSpacing: "0.04em", textTransform: "uppercase" }}>
        {label}
      </span>
      {children}
    </label>
  );
}

/* ---- Styles ---- */

const pageStyle: CSSProperties = {
  minHeight: "100vh",
  display: "grid",
  placeItems: "center",
  padding: 24,
  background: "var(--bg-0)",
  position: "relative",
  overflow: "hidden",
};

const gridStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  backgroundImage:
    "radial-gradient(circle, rgba(37,99,235,0.07) 1px, transparent 1px)",
  backgroundSize: "28px 28px",
  pointerEvents: "none",
};

const cardStyle: CSSProperties = {
  position: "relative",
  width: 420,
  maxWidth: "100%",
  background: "var(--bg-1)",
  border: "1px solid var(--line-strong)",
  borderRadius: 20,
  padding: "32px 36px 28px",
  boxShadow: "0 32px 80px rgba(15,32,70,0.10), 0 2px 8px rgba(15,32,70,0.06)",
  display: "flex",
  flexDirection: "column",
  gap: 20,
};

const headingStyle: CSSProperties = {
  fontFamily: "var(--font-display)",
  fontSize: 21,
  fontWeight: 700,
  letterSpacing: "-0.02em",
  margin: "6px 0 4px",
  color: "var(--fg)",
};

const subStyle: CSSProperties = {
  fontSize: 13,
  color: "var(--fg-muted)",
  margin: 0,
  lineHeight: 1.5,
};

const pillWrapStyle: CSSProperties = {
  display: "flex",
  background: "var(--bg-2)",
  border: "1px solid var(--line)",
  borderRadius: 10,
  padding: 3,
  gap: 2,
};

const pillBtn = (active: boolean): CSSProperties => ({
  flex: 1,
  padding: "7px 0",
  border: "none",
  borderRadius: 8,
  cursor: "pointer",
  fontFamily: "var(--font-body)",
  fontSize: 13,
  fontWeight: 600,
  transition: "all 140ms",
  background: active ? "var(--bg-1)" : "transparent",
  color: active ? "var(--fg)" : "var(--fg-muted)",
  boxShadow: active ? "0 1px 4px rgba(15,32,70,0.10)" : "none",
});

const tabRowStyle: CSSProperties = {
  display: "flex",
  borderBottom: "1px solid var(--line)",
  gap: 0,
  marginTop: -6,
};

const tabBtn = (active: boolean): CSSProperties => ({
  flex: 1,
  padding: "9px 0",
  border: "none",
  borderBottom: active ? "2px solid var(--accent)" : "2px solid transparent",
  background: "transparent",
  cursor: "pointer",
  fontFamily: "var(--font-body)",
  fontSize: 13,
  fontWeight: 600,
  color: active ? "var(--accent)" : "var(--fg-muted)",
  transition: "color 120ms, border-color 120ms",
  marginBottom: -1,
});

const inputStyle: CSSProperties = {
  width: "100%",
  background: "var(--bg-0)",
  border: "1px solid var(--line-strong)",
  color: "var(--fg)",
  padding: "10px 13px",
  borderRadius: 9,
  fontFamily: "var(--font-body)",
  fontSize: 13.5,
  outline: "none",
  boxSizing: "border-box",
  transition: "border-color 120ms",
};

const errorStyle: CSSProperties = {
  fontSize: 12.5,
  color: "var(--threat)",
  background: "rgba(220,38,38,0.06)",
  border: "1px solid rgba(220,38,38,0.18)",
  borderRadius: 8,
  padding: "8px 12px",
};

const submitBtnStyle = (disabled: boolean): CSSProperties => ({
  width: "100%",
  padding: "11px 0",
  border: "none",
  borderRadius: 10,
  background: disabled ? "rgba(37,99,235,0.5)" : "var(--accent)",
  color: "#fff",
  fontFamily: "var(--font-display)",
  fontSize: 14,
  fontWeight: 600,
  cursor: disabled ? "not-allowed" : "pointer",
  letterSpacing: "-0.01em",
  transition: "background 140ms, transform 80ms",
  marginTop: 4,
});

const footerStyle: CSSProperties = {
  fontSize: 12.5,
  color: "var(--fg-muted)",
  textAlign: "center",
  marginTop: -4,
};

const linkBtnStyle: CSSProperties = {
  background: "none",
  border: "none",
  color: "var(--accent)",
  cursor: "pointer",
  fontFamily: "var(--font-body)",
  fontSize: 12.5,
  fontWeight: 600,
  padding: 0,
};

const brandFooterStyle: CSSProperties = {
  position: "absolute",
  bottom: 20,
  fontSize: 11,
  color: "var(--fg-faint)",
  letterSpacing: "0.04em",
};
