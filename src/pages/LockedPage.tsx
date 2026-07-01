import { useState, useEffect, useRef, type FormEvent, type CSSProperties } from "react";
import { useNavigate, useLocation, Navigate } from "react-router-dom";
import logo from "../assets/agentdna-logo.png";
import { useAuth } from "../context/AuthContext";
import { ApiError } from "../api/client";
import { fetchPublicMetrics } from "../data/api";
import { sendOtp } from "../api/auth";
import type { PublicMetrics } from "../types";

const USER_ORG_ID = "AGENT_DNA_BETA";

/* ── Helpers ────────────────────────────────────────────────────── */

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}


/* ── Types ──────────────────────────────────────────────────────── */
type Mode = "signin" | "register";
type Role = "user" | "admin";
interface LocationState { from?: { pathname?: string } }

/* ── Component ──────────────────────────────────────────────────── */

export function LandingPage() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { user, login, loginAdmin, registerAdmin, registerUser } = useAuth();

  const [mode, setMode]             = useState<Mode>("signin");
  const [role, setRole]             = useState<Role>("user");
  const [email, setEmail]           = useState("");
  const [username, setUsername]     = useState("");
  const [password, setPassword]     = useState("");
  const [confirm, setConfirm]       = useState("");
  const [error, setError]           = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [metrics, setMetrics]       = useState<PublicMetrics | null>(null);

  // OTP flow
  const [otp, setOtp]               = useState("");
  const [otpSent, setOtpSent]       = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError]     = useState<string | null>(null);
  const [countdown, setCountdown]   = useState(0);
  const timerRef                    = useRef<ReturnType<typeof setInterval> | null>(null);

  // countdown tick
  useEffect(() => {
    if (countdown <= 0) { if (timerRef.current) clearInterval(timerRef.current); return; }
    timerRef.current = setInterval(() => setCountdown((c) => c - 1), 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [countdown]);

  useEffect(() => {
    fetchPublicMetrics().then(setMetrics).catch(() => {});
  }, []);

  const stats = [
    { label: "Agents",       value: metrics ? fmt(metrics.totalAgents)       : "—", trend: "+12.4%", up: true  },
    { label: "Users",        value: metrics ? fmt(metrics.totalUsers)         : "—", trend: "+6.1%",  up: true  },
    { label: "Interactions", value: metrics ? fmt(metrics.totalInteractions)  : "—", trend: "+18.9%", up: true  },
    { label: "Intents",      value: metrics ? fmt(metrics.totalIntents)       : "—", trend: "+4.2%",  up: true  },
    { label: "Threats",      value: metrics ? fmt(metrics.totalThreats)       : "—", trend: "9.3%",   up: false },
  ];

  if (user) {
    const to = (location.state as LocationState | null)?.from?.pathname || "/dashboard";
    return <Navigate to={to} replace />;
  }

  const isRegister      = mode === "register";
  const isAdminLogin    = role === "admin" && mode === "signin";
  const isUserRegister  = role === "user"  && isRegister;
  const isAdminRegister = role === "admin" && isRegister;

  const resetOtp = () => { setOtp(""); setOtpSent(false); setOtpError(null); setCountdown(0); };
  const switchMode = (m: Mode) => { setMode(m); setError(null); setEmail(""); setUsername(""); setPassword(""); setConfirm(""); resetOtp(); };
  const switchRole = (r: Role) => { setRole(r); setMode("signin"); setError(null); resetOtp(); };

  const handleSendOtp = async () => {
    if (!email.trim()) { setOtpError("Enter your email first."); return; }
    setOtpLoading(true); setOtpError(null);
    try {
      await sendOtp(email.trim());
      setOtpSent(true);
      setCountdown(300); // 5 min
    } catch (err) {
      setOtpError(err instanceof ApiError ? err.message : "Failed to send OTP.");
    } finally {
      setOtpLoading(false);
    }
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (isRegister && password !== confirm) { setError("Passwords do not match."); return; }
    if (isRegister && !otp.trim()) { setError("Enter the OTP sent to your email."); return; }
    setSubmitting(true);
    try {
      if (isAdminRegister)     await registerAdmin(username.trim(), email.trim(), password, USER_ORG_ID, otp.trim());
      else if (isUserRegister) await registerUser(username.trim(), email.trim(), password, USER_ORG_ID, otp.trim());
      else if (isAdminLogin)   await loginAdmin(username.trim(), password);
      else                     await login(email.trim(), password);
      const to = (location.state as LocationState | null)?.from?.pathname || "/dashboard";
      navigate(to, { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  const heading  = isAdminRegister ? "Create admin account" : isUserRegister ? "Create your account" : role === "admin" ? "Admin sign in" : "Welcome back";
  const btnLabel = submitting ? (isRegister ? "Creating…" : "Signing in…") : (isRegister ? "Create account →" : "Sign in →");

  return (
    <div style={page}>
      <style>{`
        @keyframes agdPulse { 0%,100%{ opacity:1; } 50%{ opacity:0.35; } }
        .agd-sc:hover { background:rgba(255,255,255,0.075)!important; transform:translateY(-2px); }
        .agd-fc:hover { background:rgba(255,255,255,0.08)!important; }
        .agd-ton  { background:#FFFFFF!important; color:#0A2240!important; box-shadow:0 2px 6px rgba(15,32,70,0.12)!important; }
        .agd-toff { background:transparent!important; color:#5F73A0!important; }
        .agd-pon  { background:#0A2240!important; color:#fff!important; border-color:#0A2240!important; }
        .agd-poff { background:#fff!important; color:#5F73A0!important; }
        .agd-in { font-family:var(--font-body); font-size:13px; color:#0A2240; padding:7px 11px; background:#fff; border:1.5px solid rgba(15,32,70,0.16); border-radius:9px; width:100%; box-sizing:border-box; transition:border-color 0.15s,box-shadow 0.15s; }
        .agd-in:focus { outline:none; border-color:#2563EB!important; box-shadow:0 0 0 3px rgba(37,99,235,0.14)!important; }
        .agd-in::placeholder { color:#9FB2D6; }
        .agd-in[readonly] { background:#F1F5FB; color:#8AA0C9; cursor:not-allowed; }
        .agd-btn:hover:not(:disabled) { background:#1D4ED8!important; }
        .agd-btn:disabled { opacity:0.65; cursor:not-allowed; }
        .agd-soc:hover { background:#F1F5FB!important; }
      `}</style>

      {/* ── LEFT 65% ─────────────────────────────────────────────── */}
      <div style={left}>
        <div style={dotGrid} />
        <div style={gTR} />
        <div style={gBL} />


        {/* hero */}
        <div style={{ position:"relative", marginTop:32 }}>
          <div style={eyebrow}>
            <span style={{ width:13, height:10, borderRadius:3, border:"2px solid #7FB0FF", marginTop:3, flexShrink:0 }} />
            <span style={eyebrowTxt}>AI Agent Observability &amp; Security</span>
          </div>
          <h1 style={h1}>
            The control plane for<br />
            AI agent <span style={{ color:"#7FB0FF" }}>observability</span> &amp; security.
          </h1>
          <p style={sub}>
            Real-time monitoring, intent analytics, and autonomous threat detection
            for every agent in your fleet.
          </p>
        </div>

        {/* metrics */}
        <div style={{ position:"relative", marginTop:"auto", paddingTop:32 }}>
          <div style={mLabel}>
            <span style={mDot} />
            <span style={mTxt}>Live Network Metrics</span>
            <span style={{ flex:1, height:1, background:"rgba(255,255,255,0.10)" }} />
            <span style={mAge}>refreshed 2s ago</span>
          </div>
          <div style={mGrid}>
            {stats.map((s) => (
              <div key={s.label} className="agd-sc" style={sc}>
                <span style={sl}>{s.label}</span>
                <div style={sv}>{s.value}</div>
                <div style={{ display:"inline-flex", alignItems:"center", gap:3, fontFamily:"var(--font-mono)", fontSize:9.5, fontWeight:600, color:s.up ? "#34D399" : "#FCA5A5", marginTop:7 }}>
                  <span style={{ fontSize:8 }}>{s.up ? "▲" : "▼"}</span>{s.trend}
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* ── RIGHT 35% · auth ─────────────────────────────────────── */}
      <div style={right}>

        {/* logo left · tabs right */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <img src={logo} alt="AgentDNA" style={{ height:38, width:"auto" }} />
          <div style={tabs}>
            <div className={mode === "signin"   ? "agd-ton" : "agd-toff"} onClick={() => switchMode("signin")}   style={tab}>Sign in</div>
            <div className={mode === "register" ? "agd-ton" : "agd-toff"} onClick={() => switchMode("register")} style={tab}>Register</div>
          </div>
        </div>

        {/* form area */}
        <div style={{ flex:1, display:"flex", flexDirection:"column" as const, justifyContent:"center", gap:0 }}>

          <h2 style={fH2}>{heading}</h2>

          {/* role pills */}
          <div style={{ display:"flex", gap:7, marginTop:14 }}>
            {(["user","admin"] as Role[]).map((r) => (
              <button key={r} type="button"
                className={role === r ? "agd-pon" : "agd-poff"}
                onClick={() => switchRole(r)}
                style={pBtn}
              >
                {r === "user" ? "User" : "Admin"}
              </button>
            ))}
          </div>

          {/* fields */}
          <form onSubmit={onSubmit} style={{ marginTop:14, display:"flex", flexDirection:"column" as const, gap:9 }}>
            {/* name / username */}
            {(isRegister || role === "admin") && (
              <label style={fl}>
                <span style={flt}>{role === "admin" ? "Username" : "Full name"}</span>
                <input className="agd-in" type="text" required value={username} onChange={(e) => setUsername(e.target.value)} placeholder={role === "admin" ? "admin_username" : "Ada Lovelace"} />
              </label>
            )}

            {/* email */}
            {(role === "user" || isRegister) && (
              <label style={fl}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <span style={flt}>Work email</span>
                  {isRegister && (
                    <button
                      type="button"
                      disabled={otpLoading || countdown > 0}
                      onClick={handleSendOtp}
                      style={{ fontFamily:"var(--font-body)", fontSize:11, fontWeight:700, color: countdown > 0 ? "#9FB2D6" : "#2563EB", background:"none", border:"none", cursor: countdown > 0 ? "default" : "pointer", padding:0 }}
                    >
                      {otpLoading ? "Sending…" : countdown > 0 ? `Resend in ${Math.floor(countdown/60)}:${String(countdown%60).padStart(2,"0")}` : otpSent ? "Resend OTP" : "Send OTP →"}
                    </button>
                  )}
                </div>
                <input className="agd-in" type="email" required value={email} onChange={(e) => { setEmail(e.target.value); resetOtp(); }} placeholder="you@company.com" />
              </label>
            )}

            {/* OTP input — register only, appears after OTP is sent */}
            {isRegister && otpSent && (
              <label style={fl}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <span style={flt}>OTP code</span>
                  <span style={{ fontFamily:"var(--font-mono)", fontSize:10.5, color:"#059669" }}>✓ Sent to {email}</span>
                </div>
                <input
                  className="agd-in"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  required
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="Enter 6-digit code"
                  style={{ letterSpacing: "0.2em", fontFamily:"var(--font-mono)", fontSize:16 }}
                />
                {otpError && <span style={{ fontFamily:"var(--font-body)", fontSize:11.5, color:"#DC2626" }}>{otpError}</span>}
              </label>
            )}
            {isRegister && !otpSent && otpError && (
              <span style={{ fontFamily:"var(--font-body)", fontSize:11.5, color:"#DC2626", marginTop:-4 }}>{otpError}</span>
            )}

            {/* password */}
            <label style={fl}>
              <div style={{ display:"flex", justifyContent:"space-between" }}>
                <span style={flt}>Password</span>
                {mode === "signin" && <span style={{ fontFamily:"var(--font-body)", fontSize:11.5, fontWeight:600, color:"#2563EB", cursor:"pointer" }}>Forgot?</span>}
              </div>
              <input className="agd-in" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••••••" />
            </label>

            {/* confirm */}
            {isRegister && (
              <label style={fl}>
                <span style={flt}>Confirm password</span>
                <input className="agd-in" type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="••••••••••••" />
              </label>
            )}

            {/* org (grayed) */}
            {isRegister && (
              <label style={fl}>
                <span style={flt}>Organisation</span>
                <input className="agd-in" type="text" readOnly value={USER_ORG_ID} />
              </label>
            )}

            {error && (
              <div style={{ padding:"8px 12px", borderRadius:8, background:"rgba(220,38,38,0.06)", border:"1px solid rgba(220,38,38,0.18)", color:"#DC2626", fontSize:12.5 }}>
                {error}
              </div>
            )}

            <button type="submit" disabled={submitting} className="agd-btn" style={subBtn}>
              {btnLabel}
            </button>
          </form>

          {/* divider */}
          {/* <div style={div}>
            <span style={{ flex:1, height:1, background:"rgba(15,32,70,0.10)" }} />
            <span style={divTxt}>or continue with</span>
            <span style={{ flex:1, height:1, background:"rgba(15,32,70,0.10)" }} />
          </div> */}

          {/* social — disabled */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:9 }}>

            {/* Okta */}
            {/* <button disabled style={socBtnDisabled} title="Coming soon">
              <svg width="16" height="16" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="100" cy="100" r="100" fill="#007DC1"/>
                <circle cx="100" cy="100" r="42" fill="white"/>
                <circle cx="100" cy="100" r="17" fill="#007DC1"/>
              </svg>
              Continue with Okta
            </button> */}

            {/* Google */}
            {/* <button disabled style={socBtnDisabled} title="Coming soon">
              <svg width="16" height="16" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                <path fill="#4285F4" d="M47.5 24.6c0-1.6-.1-3.1-.4-4.6H24v8.7h13.2c-.6 3-2.4 5.5-5 7.2v6h8c4.8-4.4 7.3-10.8 7.3-17.3z"/>
                <path fill="#34A853" d="M24 48c6.5 0 12-2.2 16-5.9l-8-6c-2.2 1.5-5 2.3-8 2.3-6.2 0-11.4-4.2-13.3-9.9H2.7v6.2C6.7 42.5 14.8 48 24 48z"/>
                <path fill="#FBBC05" d="M10.7 28.5c-.5-1.5-.8-3-.8-4.5s.3-3 .8-4.5v-6.2H2.7C1 16.8 0 20.3 0 24s1 7.2 2.7 10.7l8-6.2z"/>
                <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.9 2.2 30.4 0 24 0 14.8 0 6.7 5.5 2.7 13.3l8 6.2C12.6 13.7 17.8 9.5 24 9.5z"/>
              </svg>
              Continue with Google
            </button> */}
          </div>
        </div>

        {/* footer */}
        <div style={rFooter}>
          <span style={{ display:"inline-flex", alignItems:"center", gap:6, fontFamily:"var(--font-mono)", fontSize:10.5, color:"#5F73A0" }}>
            <span style={{ width:10, height:8, borderRadius:"2px 2px 0 0", border:"1.5px solid #059669", borderBottom:"none", marginTop:2 }} />
          </span>
          {/* <span style={{ fontFamily:"var(--font-body)", fontSize:12, color:"#5F73A0" }}>
            Need access?{" "}<span style={{ color:"#2563EB", fontWeight:600, cursor:"pointer" }}>Book a demo</span>
          </span> */}
        </div>
      </div>
    </div>
  );
}

/* ── Styles ─────────────────────────────────────────────────────── */

const page: CSSProperties = {
  height: "100vh",
  overflow: "hidden",
  display: "grid",
  gridTemplateColumns: "65fr 35fr",
  fontFamily: "var(--font-body)",
};

/* left */
const left: CSSProperties = {
  position: "relative", background: "#0A2240", color: "#C9D6EE",
  padding: "36px 48px", display: "flex", flexDirection: "column", overflow: "hidden",
};
const dotGrid: CSSProperties = {
  position: "absolute", inset: 0,
  backgroundImage: "radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px)",
  backgroundSize: "26px 26px", pointerEvents: "none",
};
const gTR: CSSProperties = {
  position: "absolute", top: -180, right: -120, width: 620, height: 520,
  background: "radial-gradient(circle, rgba(37,99,235,0.28), rgba(37,99,235,0) 66%)", pointerEvents: "none",
};
const gBL: CSSProperties = {
  position: "absolute", bottom: -220, left: -120, width: 560, height: 520,
  background: "radial-gradient(circle, rgba(14,165,233,0.14), rgba(14,165,233,0) 68%)", pointerEvents: "none",
};
const eyebrow: CSSProperties = { display:"inline-flex", alignItems:"center", gap:8, padding:"6px 13px", background:"rgba(37,99,235,0.14)", border:"1px solid rgba(37,99,235,0.34)", borderRadius:999 };
const eyebrowTxt: CSSProperties = { fontFamily:"var(--font-mono)", fontSize:10.5, fontWeight:600, letterSpacing:"0.14em", textTransform:"uppercase", color:"#7FB0FF" };
const h1: CSSProperties = { margin:"18px 0 0", fontFamily:"var(--font-display)", fontWeight:700, fontSize:40, lineHeight:1.08, letterSpacing:"-0.03em", color:"#FFFFFF", maxWidth:580 };
const sub: CSSProperties = { margin:"14px 0 0", fontSize:15.5, lineHeight:1.55, color:"#9FB2D6", maxWidth:500 };
const mLabel: CSSProperties = { display:"flex", alignItems:"center", gap:9, marginBottom:12 };
const mDot: CSSProperties = { width:6, height:6, borderRadius:"50%", background:"#0EA5E9", boxShadow:"0 0 0 3px rgba(14,165,233,0.20)", flexShrink:0 };
const mTxt: CSSProperties = { fontFamily:"var(--font-mono)", fontSize:10.5, fontWeight:600, letterSpacing:"0.14em", textTransform:"uppercase", color:"#8AA0C9" };
const mAge: CSSProperties = { fontFamily:"var(--font-mono)", fontSize:10, color:"#5F73A0" };
const mGrid: CSSProperties = { display:"grid", gridTemplateColumns:"repeat(5, 1fr)", gap:10 };
const sc: CSSProperties = { position:"relative", background:"rgba(255,255,255,0.045)", border:"1px solid rgba(255,255,255,0.09)", borderRadius:12, padding:"13px 12px", overflow:"hidden", backdropFilter:"blur(2px)", cursor:"default", transition:"all 200ms" };
const sl: CSSProperties = { fontFamily:"var(--font-mono)", fontSize:9, fontWeight:600, letterSpacing:"0.1em", textTransform:"uppercase", color:"#8AA0C9", lineHeight:1.5 };
const sv: CSSProperties = { marginTop:10, fontFamily:"var(--font-mono)", fontWeight:700, fontSize:20, letterSpacing:"-0.02em", color:"#FFFFFF" };

/* right */
const right: CSSProperties = { background:"#FFFFFF", display:"flex", flexDirection:"column", padding:"28px 36px", overflow:"hidden" };
const tabs: CSSProperties = { display:"inline-flex", padding:3, background:"#F1F5FB", border:"1px solid rgba(15,32,70,0.08)", borderRadius:999, gap:2 };
const tab: CSSProperties = { fontFamily:"var(--font-body)", fontSize:13, fontWeight:600, padding:"7px 16px", borderRadius:999, cursor:"pointer", transition:"all 150ms" };
const fH2: CSSProperties = { margin:0, fontFamily:"var(--font-display)", fontWeight:700, fontSize:22, letterSpacing:"-0.02em", color:"#0A2240" };
const pBtn: CSSProperties = { fontFamily:"var(--font-body)", fontSize:12.5, fontWeight:600, padding:"5px 16px", borderRadius:999, cursor:"pointer", border:"1.5px solid rgba(15,32,70,0.16)", transition:"all 150ms" };
const fl: CSSProperties = { display:"flex", flexDirection:"column", gap:5 };
const flt: CSSProperties = { fontFamily:"var(--font-mono)", fontSize:10, fontWeight:600, letterSpacing:"0.1em", textTransform:"uppercase", color:"#5F73A0" };
const subBtn: CSSProperties = { fontFamily:"var(--font-body)", fontWeight:600, fontSize:14.5, color:"#FFFFFF", background:"#2563EB", border:"none", borderRadius:10, padding:"11px", cursor:"pointer", boxShadow:"0 6px 18px rgba(37,99,235,0.28)", display:"inline-flex", alignItems:"center", justifyContent:"center", transition:"background 150ms" };
const div: CSSProperties = { margin:"14px 0 12px", display:"flex", alignItems:"center", gap:12 };
const divTxt: CSSProperties = { fontFamily:"var(--font-mono)", fontSize:10, letterSpacing:"0.1em", textTransform:"uppercase", color:"#5F73A0", whiteSpace:"nowrap" };
const socBtnDisabled: CSSProperties = { fontFamily:"var(--font-body)", fontWeight:600, fontSize:13, color:"#9FB2D6", background:"#F8FAFC", border:"1.5px solid rgba(15,32,70,0.10)", borderRadius:10, padding:"9px", cursor:"not-allowed", display:"inline-flex", alignItems:"center", justifyContent:"center", gap:7, opacity:0.7 };
const rFooter: CSSProperties = { display:"flex", alignItems:"center", justifyContent:"space-between", paddingTop:14, borderTop:"1px solid rgba(15,32,70,0.08)", marginTop:14 };
