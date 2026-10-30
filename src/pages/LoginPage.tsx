import { useEffect, useState, type FormEvent, type CSSProperties } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { friendlyAuthError, type FriendlyError } from "../lib/authErrors";
import { Icon } from "../components/Icon";
import { OtpInput } from "../components/OtpInput";
import { sendLoginOtp } from "../api/auth";
import { ApiError } from "../api/client";
import logo from "../assets/agentdna-logo.png";

interface LocationState {
  from?: { pathname?: string };
}

type Role = "user" | "admin";
type Mode = "login" | "register";
/** How an org user signs in: an emailed code, or their password. Admins always use a password. */
type Method = "code" | "password";

/** The server lets a new code go out a minute after the last one. */
const RESEND_AFTER_S = 60;

const sentenceCase = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

const USER_ORG_ID = "AGENT_DNA_BETA";

export function LoginPage() {
  const { user, login, loginWithOtp, loginAdmin, registerAdmin, registerUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [role, setRole] = useState<Role>("user");
  const [mode, setMode] = useState<Mode>("login");

  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [org] = useState(USER_ORG_ID);

  const [error, setError] = useState<FriendlyError | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Email-code sign-in: which step we're on, the code typed so far, and when "Resend" frees up.
  const [method, setMethod] = useState<Method>("code");
  const [codeSent, setCodeSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [resendAt, setResendAt] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (resendAt <= Date.now()) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [resendAt]);
  const resendIn = Math.max(0, Math.ceil((resendAt - now) / 1000));

  if (user) {
    const to = (location.state as LocationState | null)?.from?.pathname || "/dashboard";
    return <Navigate to={to} replace />;
  }

  const resetFields = () => {
    setEmail(""); setUsername(""); setPassword("");
    setConfirmPassword(""); setError(null);
    setOtp(""); setCodeSent(false); setNotice(null);
  };

  const switchRole = (r: Role) => { setRole(r); setMode("login"); resetFields(); };
  const switchMode = (m: Mode) => { setMode(m); resetFields(); };

  const isRegister = mode === "register";
  const isAdminLogin = role === "admin" && mode === "login";
  const isUserRegister = role === "user" && isRegister;
  const isAdminRegister = role === "admin" && isRegister;
  const isCodeLogin = role === "user" && mode === "login" && method === "code";

  const goAfterLogin = () => {
    const to = (location.state as LocationState | null)?.from?.pathname || "/dashboard";
    navigate(to, { replace: true });
  };

  /** Opens registration with the email already filled in. */
  const toRegister = () => { const keep = email.trim(); setRole("user"); switchMode("register"); setEmail(keep); };

  /** A send-otp / verify-otp failure, by HTTP status as the API asks. */
  const onCodeError = (err: unknown, step: "send" | "verify") => {
    if (!(err instanceof ApiError) || err.status === 0) { setError(friendlyAuthError(err)); return; }
    const data = (err.data ?? {}) as { registered?: boolean; retryAfterSeconds?: number };
    if (err.status === 404 && data.registered === false) {
      setCodeSent(false);
      setError({ message: "This email is not registered. Create an account to sign in.", action: "register" });
    } else if (err.status === 429) {
      // A code already went out: move on to entering it, and hold Resend until the server allows it.
      const wait = Number(data.retryAfterSeconds) || RESEND_AFTER_S;
      setResendAt(Date.now() + wait * 1000); setNow(Date.now());
      setCodeSent(true);
      setNotice(`A code was sent to ${email.trim()} less than a minute ago. Enter it below, or request a new one when the timer runs out.`);
    } else if (step === "verify" && err.status === 400 && !/required/i.test(err.message)) {
      setOtp("");
      setError({ message: "Invalid or expired code. Check it and try again, or request a new code.", action: "resend" });
    } else {
      setError({ message: sentenceCase(err.message) || "Something went wrong. Please try again." });
    }
  };

  const sendCode = async () => {
    setError(null); setNotice(null); setSubmitting(true);
    try {
      await sendLoginOtp(email.trim());
      setCodeSent(true); setOtp("");
      setResendAt(Date.now() + RESEND_AFTER_S * 1000); setNow(Date.now());
      setNotice(`We sent a 6-digit code to ${email.trim()}.`);
    } catch (err) {
      onCodeError(err, "send");
    } finally {
      setSubmitting(false);
    }
  };

  const verifyCode = async (code = otp) => {
    if (code.length !== 6 || submitting) return;
    setError(null); setSubmitting(true);
    try {
      await loginWithOtp(email.trim(), code);
      goAfterLogin();
    } catch (err) {
      onCodeError(err, "verify");
    } finally {
      setSubmitting(false);
    }
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (isCodeLogin) { void (codeSent ? verifyCode() : sendCode()); return; }
    setError(null);
    if (isRegister) {
      if (password !== confirmPassword) { setError({ message: "Passwords do not match." }); return; }
      if (isAdminRegister && !org.trim()) { setError({ message: "Organisation name is required." }); return; }
    }
    setSubmitting(true);
    try {
      if (isAdminRegister) await registerAdmin(username.trim(), email.trim(), password, org.trim());
      else if (isUserRegister) await registerUser(username.trim(), email.trim(), password, USER_ORG_ID);
      else if (isAdminLogin) await loginAdmin(username.trim(), password);
      else await login(email.trim(), password);
      goAfterLogin();
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const heading = isAdminRegister ? "Create admin account"
    : isUserRegister ? "Create your account"
    : role === "admin" ? "Admin sign in"
    : "Welcome back";

  const subheading = isAdminRegister ? "Register a new admin account for your organisation."
    : isUserRegister ? "Sign up to start monitoring your AI agents."
    : role === "admin" ? "Sign in with your admin credentials to manage AgentDNA."
    : isCodeLogin && codeSent ? "Enter the 6-digit code from your email."
    : isCodeLogin ? "We’ll email you a 6-digit code to sign in. No password needed."
    : "Enter your credentials to access the dashboard.";

  const btnLabel = isCodeLogin
    ? codeSent
      ? submitting ? "Verifying…" : "Verify code"
      : submitting ? "Sending code…" : "Send code"
    : submitting
    ? isRegister ? "Creating account…" : "Signing in…"
    : isRegister ? "Create account" : "Sign in";

  return (
    <div style={pageStyle}>

      {/* Navbar */}
      <nav style={navStyle}>
        <div style={navInnerStyle}>
          <img src={logo} alt="AgentDNA" style={{ height: 55, width: "auto", cursor: "pointer" }} onClick={() => navigate("/")} />
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              type="button"
              style={navLinkStyle}
              onClick={() => navigate("/")}
            >
              <Icon name="chevronLeft" size={14} />
              Back to home
            </button>
          </div>
        </div>
      </nav>

      {/* Main content */}
      <div style={contentStyle}>
        <div style={cardStyle}>
          {/* Header */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 4 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <div style={iconBadgeStyle}>
                <Icon name="shield" size={18} style={{ color: "#2563EB" }} />
              </div>
            </div>
            <h1 style={headingStyle}>{heading}</h1>
            <p style={subStyle}>{subheading}</p>
          </div>

          {/* Role toggle */}
          <div style={pillWrapStyle}>
            <button type="button" style={pillBtn(role === "user")} onClick={() => switchRole("user")}>
              User
            </button>
            <button type="button" style={pillBtn(role === "admin")} onClick={() => switchRole("admin")}>
              Admin
            </button>
          </div>

          {/* Login / Register tabs — shown for both roles */}
          <div style={tabRowStyle}>
            <button type="button" style={tabBtn(mode === "login")} onClick={() => switchMode("login")}>
              Sign in
            </button>
            <button type="button" style={tabBtn(mode === "register")} onClick={() => switchMode("register")}>
              Register
            </button>
          </div>

          {/* Form */}
          <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 13 }}>

            {/* Username — shown on register forms and admin login */}
            {(isRegister || role === "admin") && (
              <Field label="Username">
                <input
                  type="text"
                  autoComplete="username"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={role === "admin" ? "admin_username" : "your_username"}
                  style={inputStyle}
                />
              </Field>
            )}

            {/* Email — user login, user register, admin register */}
            {isCodeLogin && codeSent ? (
              <div style={sentToStyle}>
                <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={email.trim()}>
                  {email.trim()}
                </span>
                <button
                  type="button"
                  style={linkBtnStyle}
                  onClick={() => { setCodeSent(false); setOtp(""); setError(null); setNotice(null); }}
                >
                  Change email
                </button>
              </div>
            ) : (role === "user" || isAdminRegister) && (
              <Field label="Email address">
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
            )}

            {isCodeLogin && codeSent && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {notice && <p role="status" style={noticeStyle}>{notice}</p>}
                <OtpInput
                  value={otp}
                  onChange={(v) => { setOtp(v); if (error?.action === "resend") setError(null); }}
                  onComplete={(v) => void verifyCode(v)}
                  disabled={submitting}
                  invalid={error?.action === "resend"}
                  autoFocus
                />
                <div style={codeMetaStyle}>
                  <span>Code expires in 5 minutes</span>
                  <button
                    type="button"
                    style={{ ...linkBtnStyle, ...(resendIn > 0 || submitting ? { color: "var(--fg-faint)", cursor: "default" } : null) }}
                    disabled={resendIn > 0 || submitting}
                    onClick={() => void sendCode()}
                  >
                    {resendIn > 0 ? `Resend code in ${mmss(resendIn)}` : "Resend code"}
                  </button>
                </div>
              </div>
            )}

            {!isCodeLogin && <Field label="Password">
              <input
                type="password"
                autoComplete={isRegister ? "new-password" : "current-password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                style={inputStyle}
              />
            </Field>}

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

                {/* Admin register: editable org name; User register: locked org ID */}
                {isAdminRegister ? (
                  <Field label="Organisation name">
                    <input
                      type="text"
                      readOnly
                      value={org}
                      style={{ ...inputStyle, background: "var(--bg-2)", color: "var(--fg-muted)", cursor: "not-allowed" }}
                    />
                  </Field>
                ) : (
                  <Field label="Organisation ID">
                    <input
                      type="text"
                      readOnly
                      value={USER_ORG_ID}
                      style={{ ...inputStyle, background: "var(--bg-2)", color: "var(--fg-muted)", cursor: "not-allowed" }}
                    />
                  </Field>
                )}
              </>
            )}

            {error && (
              <div role="alert" style={errorStyle}>
                <Icon name="alerts" size={14} style={{ color: "var(--threat)", flexShrink: 0, marginTop: 1 }} />
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <span>{error.message}</span>
                  {error.action === "register" && (
                    <button type="button" style={errorActionStyle} onClick={toRegister}>
                      Register with this email
                    </button>
                  )}
                  {error.action === "resend" && (
                    <button
                      type="button"
                      style={{ ...errorActionStyle, ...(resendIn > 0 ? { opacity: 0.6, cursor: "default", textDecoration: "none" } : null) }}
                      disabled={resendIn > 0 || submitting}
                      onClick={() => void sendCode()}
                    >
                      {resendIn > 0 ? `Request new code in ${mmss(resendIn)}` : "Request new code"}
                    </button>
                  )}
                  {error.action === "signin" && (
                    <button
                      type="button"
                      style={errorActionStyle}
                      onClick={() => { const keep = email; switchMode("login"); setEmail(keep); }}
                    >
                      Sign in instead →
                    </button>
                  )}
                </div>
              </div>
            )}

            {(() => {
              const off = submitting || (isCodeLogin && codeSent && otp.length !== 6);
              return (
                <button type="submit" disabled={off} style={submitBtnStyle(off)}>
                  {btnLabel}
                </button>
              );
            })()}

            {role === "user" && mode === "login" && (
              <button
                type="button"
                style={{ ...linkBtnStyle, alignSelf: "center", fontSize: 11.5 }}
                onClick={() => { setMethod(method === "code" ? "password" : "code"); setError(null); setNotice(null); setOtp(""); setCodeSent(false); setPassword(""); }}
              >
                {method === "code" ? "Sign in with a password instead" : "Email me a sign-in code instead"}
              </button>
            )}
          </form>


          {/* Footer link */}
          <div style={footerStyle}>
            {role === "user" && (
              <span>
                Are you an admin?{" "}
                <button type="button" style={linkBtnStyle} onClick={() => switchRole("admin")}>
                  Admin sign in
                </button>
              </span>
            )}
            {role === "admin" && (
              <span>
                Not an admin?{" "}
                <button type="button" style={linkBtnStyle} onClick={() => switchRole("user")}>
                  User sign in
                </button>
              </span>
            )}
          </div>
        </div>

        <p style={brandFooterStyle}>Secured by AgentDNA</p>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <span style={{ fontSize: 10, fontWeight: 600, color: "var(--fg-dim)", letterSpacing: "0.05em", textTransform: "uppercase" }}>
        {label}
      </span>
      {children}
    </label>
  );
}

/* ── Styles ─────────────────────────────────────── */

const pageStyle: CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  flexDirection: "column",
  background: "#ffffff",
};

const navStyle: CSSProperties = {
  width: "100%",
  background: "#ffffff",
  borderBottom: "1px solid var(--line)",
};

const navInnerStyle: CSSProperties = {
  maxWidth: 1100,
  margin: "0 auto",
  padding: "0 32px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  height: 68,
};

const navLinkStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  background: "none",
  border: "1px solid var(--line)",
  borderRadius: 8,
  padding: "7px 14px",
  fontSize: 13,
  fontWeight: 600,
  color: "var(--fg-dim)",
  cursor: "pointer",
  fontFamily: "var(--font-body)",
  transition: "background 120ms, color 120ms",
};

const contentStyle: CSSProperties = {
  flex: 1,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  padding: "38px 24px 32px",
  gap: 16,
};

const cardStyle: CSSProperties = {
  position: "relative",
  width: 400,
  maxWidth: "100%",
  background: "var(--bg-1)",
  border: "1px solid var(--line-strong)",
  borderRadius: 16,
  padding: "32px 35px 28px",
  boxShadow: "0 24px 64px rgba(15,32,70,0.10), 0 2px 8px rgba(15,32,70,0.06)",
  display: "flex",
  flexDirection: "column",
  gap: 18,
};

const iconBadgeStyle: CSSProperties = {
  width: 35,
  height: 35,
  borderRadius: 9,
  background: "rgba(37,99,235,0.09)",
  border: "1px solid rgba(37,99,235,0.16)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const headingStyle: CSSProperties = {
  fontFamily: "var(--font-display)",
  fontSize: 22,
  fontWeight: 800,
  letterSpacing: "-0.03em",
  margin: "3px 0 0",
  color: "var(--fg)",
  lineHeight: 1.2,
};

const subStyle: CSSProperties = {
  fontSize: 12,
  color: "var(--fg-muted)",
  margin: 0,
  lineHeight: 1.55,
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
  fontSize: 12,
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
  padding: "8px 0",
  border: "none",
  borderBottom: active ? "2px solid var(--accent)" : "2px solid transparent",
  background: "transparent",
  cursor: "pointer",
  fontFamily: "var(--font-body)",
  fontSize: 12,
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
  padding: "9px 12px",
  borderRadius: 8,
  fontFamily: "var(--font-body)",
  fontSize: 12,
  outline: "none",
  boxSizing: "border-box",
  transition: "border-color 120ms, box-shadow 120ms",
};

const errorStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: 8,
  fontSize: 11,
  lineHeight: 1.45,
  color: "var(--threat)",
  background: "rgba(220,38,38,0.06)",
  border: "1px solid rgba(220,38,38,0.18)",
  borderRadius: 7,
  padding: "9px 11px",
};

const errorActionStyle: CSSProperties = {
  alignSelf: "flex-start",
  background: "none",
  border: "none",
  padding: 0,
  color: "var(--threat)",
  fontFamily: "var(--font-body)",
  fontSize: 11,
  fontWeight: 600,
  textDecoration: "underline",
  cursor: "pointer",
};

const submitBtnStyle = (disabled: boolean): CSSProperties => ({
  width: "100%",
  padding: "10px 0",
  border: "none",
  borderRadius: 9,
  background: disabled ? "rgba(37,99,235,0.5)" : "var(--accent)",
  color: "#fff",
  fontFamily: "var(--font-display)",
  fontSize: 12.5,
  fontWeight: 700,
  cursor: disabled ? "not-allowed" : "pointer",
  letterSpacing: "-0.01em",
  transition: "background 140ms",
  marginTop: 2,
});

const sentToStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  padding: "9px 12px",
  borderRadius: 8,
  background: "var(--bg-2)",
  border: "1px solid var(--line)",
  fontSize: 12.5,
  fontWeight: 600,
  color: "var(--fg)",
};

const noticeStyle: CSSProperties = {
  margin: 0,
  fontSize: 11.5,
  lineHeight: 1.5,
  color: "var(--fg-dim)",
};

const codeMetaStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  fontSize: 11,
  color: "var(--fg-muted)",
};

const footerStyle: CSSProperties = {
  fontSize: 11,
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
  fontSize: 11,
  fontWeight: 600,
  padding: 0,
};

const brandFooterStyle: CSSProperties = {
  fontSize: 11.5,
  color: "var(--fg-faint)",
  letterSpacing: "0.04em",
};
