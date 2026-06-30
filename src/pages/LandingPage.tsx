import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { fetchPublicMetrics } from "../data/api";
import logo from "../assets/agentdna-logo.png";
import type { PublicMetrics } from "../types";

/* ── Network canvas animation ───────────────────────────────────────────── */

interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  r: number;
}

function NetworkCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const COUNT = 55;
    const CONNECT_DIST = 160;
    const particles: Particle[] = [];

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    for (let i = 0; i < COUNT; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        r: Math.random() * 2 + 1.5,
      });
    }

    let raf: number;
    const draw = () => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = w;
        else if (p.x > w) p.x = 0;
        if (p.y < 0) p.y = h;
        else if (p.y > h) p.y = 0;
      }

      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const a = particles[i];
          const b = particles[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < CONNECT_DIST) {
            const alpha = (1 - dist / CONNECT_DIST) * 0.07;
            ctx.beginPath();
            ctx.strokeStyle = `rgba(37,99,235,${alpha.toFixed(3)})`;
            ctx.lineWidth = 1;
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }

      for (const p of particles) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(37,99,235,0.12)";
        ctx.fill();
      }

      raf = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={ref}
      style={{
        position: "fixed",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 0,
      }}
    />
  );
}

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

/* ── Inline SVG icons ───────────────────────────────────────────────────── */

function IcAgents() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /><circle cx="12" cy="16" r="1" />
    </svg>
  );
}
function IcUsers() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
function IcActivity() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}
function IcTarget() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" />
    </svg>
  );
}
function IcZap() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}
function IcTrendUp() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" />
    </svg>
  );
}
function IcArrowRight() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
    </svg>
  );
}
function IcLock() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}
function IcBook() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  );
}
function IcGlobe() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}
function IcCode() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" />
    </svg>
  );
}
function IcShield() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}
function IcChevronRight() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

/* ── Main component ──────────────────────────────────────────────────────── */

export function LandingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState<PublicMetrics | null>(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    fetchPublicMetrics()
      .then(setMetrics)
      .catch(() => setMetrics(null));
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (user) return <Navigate to="/dashboard" replace />;

  const BLUE = "#2563EB";
  const BLUE_BG = "rgba(37,99,235,0.09)";

  const stats = [
    { Ic: IcAgents,   label: "Agents deployed",   value: metrics?.totalAgents,       trend: "+8.2%",  desc: "Active agents registered and monitored across all organisations." },
    { Ic: IcUsers,    label: "Total users",        value: metrics?.totalUsers,         trend: "+5.1%",  desc: "Users onboarded with access to agent workspaces and policies." },
    { Ic: IcActivity, label: "Total interactions", value: metrics?.totalInteractions,  trend: "+12.4%", desc: "Agent-to-agent and agent-to-tool calls tracked in real time." },
    { Ic: IcTarget,   label: "Intents secured",    value: metrics?.totalIntents,       trend: "+3.7%",  desc: "User intents validated and governed through the intent pipeline." },
    { Ic: IcZap,      label: "Threats detected",   value: metrics?.totalThreats,       trend: "+1.9%",  desc: "Malicious or anomalous interactions flagged and blocked." },
  ];

  const featureCards = [
    { Ic: IcGlobe, tag: "Hub",            title: "Agent Registry",          desc: "Browse and manage all agents registered in your organisation. View policies, scores, and deployment history." },
    { Ic: IcBook,  tag: "Tutorial",       title: "Deploy your first agent", desc: "Step-by-step guide to generating an API key, deploying an agent, and monitoring its first interactions." },
    { Ic: IcCode,  tag: "Agent examples", title: "Starter templates",       desc: "Production-ready agent blueprints with built-in intent tracking, threat hooks, and org-scoped policies." },
  ];

  return (
    <div style={pageStyle}>
      <NetworkCanvas />
      <style>{`
        .metric-card {
          transition: border-color 180ms, box-shadow 180ms, transform 180ms;
        }
        .metric-card:hover {
          border-color: #2563EB !important;
          box-shadow: 0 8px 24px rgba(37,99,235,0.14), 0 2px 6px rgba(37,99,235,0.10), 0 1px 2px rgba(0,0,0,0.06) !important;
          transform: translateY(-3px);
        }
        .feature-card {
          transition: border-color 180ms, box-shadow 180ms, transform 180ms;
        }
        .feature-card:hover {
          border-color: #2563EB !important;
          box-shadow: 0 12px 32px rgba(37,99,235,0.14), 0 4px 10px rgba(37,99,235,0.10), 0 1px 3px rgba(0,0,0,0.06) !important;
          transform: translateY(-4px);
        }
      `}</style>

      {/* ── Sticky Nav ── */}
      <header style={headerStyle(scrolled)}>
        <div style={headerInner}>
          <button style={logoBtnStyle} onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
            <img src={logo} alt="AgentDNA" style={{ height: 50, width: "auto" }} />
          </button>

          <nav style={navLinksStyle}>
            {["Hub", "Tutorial", "Agent examples"].map((label) => (
              <button key={label} style={navLinkStyle} onClick={() => navigate("/login")}>
                {label}
              </button>
            ))}
          </nav>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button style={signInBtnStyle} onClick={() => navigate("/login")}>
              Sign in
            </button>
            <button style={getStartedBtnStyle} onClick={() => navigate("/login")}>
              Get started <IcArrowRight />
            </button>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section style={heroSection}>
        {/* <div style={badgeStyle}>
          <IcShield />
          <span>Public preview</span>
          <span style={{ color: "#aaa", fontWeight: 400, margin: "0 3px" }}>·</span>
          <span style={{ color: "#6e6e73", fontWeight: 500 }}>Not signed in</span>
        </div> */}

        <h1 style={h1Style}>
          The{" "}
          <span style={{
            color: "#2563EB",
            textDecoration: "underline",
            textDecorationColor: "#2563EB",
            textDecorationThickness: 3,
            textUnderlineOffset: 6,
          }}>
            control center
          </span>
          <br />for your AI agents.
        </h1>

        <p style={subtitleStyle}>
          Real-time observability, intent tracking, and threat detection
          <br />across every agent interaction in your organisation.
        </p>

        <div style={ctaRowStyle}>
          <button style={primaryCtaStyle} onClick={() => navigate("/login")}>
            Get started free <IcArrowRight />
          </button>
          <button style={secondaryCtaStyle} onClick={() => navigate("/login")}>
            Sign in
          </button>
        </div>
      </section>

      {/* ── Live metrics ── */}
      <section style={metricsSection}>
        <div style={sectionLabelStyle}>
          <span style={liveDot} />
          Live network metrics
        </div>

        <div style={metricsGrid}>
          {stats.map(({ label, value, trend }) => (
            <div key={label} className="metric-card" style={metricCard}>
              {/* Blue top accent bar */}
              <div style={metricAccentBar} />
              <div style={metricCardBody}>
                <div style={trendBadge}>
                  <IcTrendUp />
                  <span>{trend}</span>
                </div>
                <div style={metricValue}>
                  {value != null ? fmt(value) : <span style={{ color: "#ccc" }}>—</span>}
                </div>
                <div style={metricLabel}>{label}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Locked banner ── */}
      {/* <div style={lockedBanner}>
        <span style={{ color: "#6e6e73", display: "flex", alignItems: "center", gap: 7, fontSize: 13 }}>
          <IcLock />
          Sign in to access full analytics, export data, and manage your agents.
        </span>
        <button style={lockedCtaBtn} onClick={() => navigate("/login")}>
          Get started <IcChevronRight />
        </button>
      </div> */}

      {/* ── Explore section ── */}
      <section style={exploreSection}>
        <div style={{ marginBottom: 32 }}>
          <h2 style={sectionH2}>Explore AgentDNA</h2>
          <p style={sectionSubtitle}>Everything you need to deploy and govern AI agents at scale.</p>
        </div>

        <div style={featureGrid}>
          {featureCards.map(({ Ic, tag, title, desc }) => (
            <button key={tag} className="feature-card" style={featureCard} onClick={() => navigate("/login")}>
              <div style={{ ...featureIconWrap, background: BLUE_BG, color: BLUE }}>
                <Ic />
              </div>
              <span style={{ ...featureTag, color: BLUE, background: BLUE_BG }}>
                {tag}
              </span>
              <h3 style={featureTitle}>{title}</h3>
              <p style={featureDesc}>{desc}</p>
              <span style={{ ...featureArrow, color: BLUE }}>
                Explore <IcChevronRight />
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={footerOuter}>
        <div style={footerInner}>
          <img src={logo} alt="AgentDNA" style={{ height: 30, width: "auto" }} />
          <span style={footerMid}>Secured by AgentDNA</span>
          <span style={footerRight}>© {new Date().getFullYear()} AgentDNA</span>
        </div>
      </footer>
    </div>
  );
}

/* ── Styles ──────────────────────────────────────────────────────────────── */

const pageStyle: CSSProperties = {
  minHeight: "100vh",
  background: "#ffffff",
  display: "flex",
  flexDirection: "column",
  fontFamily: "var(--font-body)",
  position: "relative",
  zIndex: 0,
};

const headerStyle = (scrolled: boolean): CSSProperties => ({
  position: "sticky",
  top: 0,
  zIndex: 100,
  width: "100%",
  background: scrolled ? "rgba(255,255,255,0.88)" : "rgba(255,255,255,0.98)",
  backdropFilter: "saturate(180%) blur(14px)",
  WebkitBackdropFilter: "saturate(180%) blur(14px)",
  borderBottom: "1px solid rgba(0,0,0,0.07)",
  transition: "background 200ms",
});

const headerInner: CSSProperties = {
  maxWidth: 1120,
  margin: "0 auto",
  padding: "0 32px",
  height: 64,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 24,
};

const logoBtnStyle: CSSProperties = {
  background: "none",
  border: "none",
  padding: 0,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  flexShrink: 0,
};

const navLinksStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 2,
  flex: 1,
  justifyContent: "center",
};

const navLinkStyle: CSSProperties = {
  background: "none",
  border: "none",
  padding: "6px 14px",
  borderRadius: 8,
  fontSize: 13.5,
  fontWeight: 500,
  color: "#3c3c43",
  cursor: "pointer",
  fontFamily: "var(--font-body)",
  transition: "background 120ms",
};

const signInBtnStyle: CSSProperties = {
  background: "none",
  border: "1.5px solid #1d1d1f",
  borderRadius: 9,
  padding: "8px 18px",
  fontSize: 13.5,
  fontWeight: 600,
  color: "#1d1d1f",
  cursor: "pointer",
  fontFamily: "var(--font-body)",
};

const getStartedBtnStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  background: "#1d1d1f",
  border: "none",
  borderRadius: 9,
  padding: "8px 18px",
  fontSize: 13.5,
  fontWeight: 600,
  color: "#fff",
  cursor: "pointer",
  fontFamily: "var(--font-body)",
};

const heroSection: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  textAlign: "center",
  padding: "88px 24px 72px",
  gap: 24,
};

const badgeStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  fontSize: 12.5,
  fontWeight: 600,
  color: "#2563EB",
  background: "rgba(37,99,235,0.07)",
  border: "1px solid rgba(37,99,235,0.18)",
  borderRadius: 99,
  padding: "5px 14px",
};

const h1Style: CSSProperties = {
  fontFamily: "var(--font-display)",
  fontSize: "clamp(36px, 5.5vw, 60px)",
  fontWeight: 800,
  letterSpacing: "-0.04em",
  color: "#1d1d1f",
  lineHeight: 1.08,
  margin: 0,
};

const subtitleStyle: CSSProperties = {
  fontSize: 17,
  color: "#6e6e73",
  lineHeight: 1.65,
  maxWidth: 520,
  margin: 0,
};

const ctaRowStyle: CSSProperties = {
  display: "flex",
  gap: 12,
  flexWrap: "wrap",
  justifyContent: "center",
  marginTop: 4,
};

const primaryCtaStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  background: "#2563EB",
  border: "none",
  borderRadius: 11,
  padding: "13px 28px",
  fontSize: 15,
  fontWeight: 700,
  color: "#fff",
  cursor: "pointer",
  fontFamily: "var(--font-body)",
  boxShadow: "0 4px 16px rgba(37,99,235,0.28)",
};

const secondaryCtaStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  background: "#fff",
  border: "1.5px solid rgba(0,0,0,0.14)",
  borderRadius: 11,
  padding: "13px 28px",
  fontSize: 15,
  fontWeight: 600,
  color: "#1d1d1f",
  cursor: "pointer",
  fontFamily: "var(--font-body)",
};

const metricsSection: CSSProperties = {
  width: "100%",
  maxWidth: 1120,
  margin: "0 auto",
  padding: "0 32px 64px",
  boxSizing: "border-box",
};

const sectionLabelStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  fontSize: 11.5,
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase" as const,
  color: "#6e6e73",
  marginBottom: 20,
};

const liveDot: CSSProperties = {
  display: "inline-block",
  width: 7,
  height: 7,
  borderRadius: "50%",
  background: "#2563EB",
  boxShadow: "0 0 0 3px rgba(37,99,235,0.18)",
};

const metricsGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(5, 1fr)",
  gap: 16,
};

const metricCard: CSSProperties = {
  background: "#0f2d5c",
  border: "none",
  borderRadius: 16,
  overflow: "hidden",
  display: "flex",
  flexDirection: "column",
  boxShadow: "0 4px 24px rgba(15,45,92,0.28), 0 1px 6px rgba(0,0,0,0.12)",
  position: "relative",
  zIndex: 999,
};

const metricAccentBar: CSSProperties = {
  height: 3,
  background: "rgba(255,255,255,0.18)",
  flexShrink: 0,
};

const metricCardBody: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 7,
  padding: "13px 20px 14px",
};

const trendBadge: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 3,
  fontSize: 10.5,
  fontWeight: 700,
  color: "#ffffff",
  background: "rgba(255,255,255,0.15)",
  borderRadius: 99,
  padding: "3px 7px",
};

const metricValue: CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 32,
  fontWeight: 800,
  letterSpacing: "-0.04em",
  lineHeight: 1,
  color: "#ffffff",
};

const metricLabel: CSSProperties = {
  fontSize: 12,
  color: "#ffffff",
  fontWeight: 700,
};


const lockedBanner: CSSProperties = {
  width: "100%",
  maxWidth: 1120,
  margin: "0 auto 56px",
  padding: "14px 20px",
  boxSizing: "border-box",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  background: "rgba(0,0,0,0.02)",
  border: "1.5px dashed rgba(0,0,0,0.12)",
  borderRadius: 12,
};

const lockedCtaBtn: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  background: "#fff",
  border: "1px solid rgba(0,0,0,0.16)",
  borderRadius: 8,
  padding: "7px 15px",
  fontSize: 12.5,
  fontWeight: 600,
  color: "#1d1d1f",
  cursor: "pointer",
  fontFamily: "var(--font-body)",
  flexShrink: 0,
};

const exploreSection: CSSProperties = {
  width: "100%",
  maxWidth: 1120,
  margin: "0 auto 80px",
  padding: "0 32px",
  boxSizing: "border-box",
};

const sectionH2: CSSProperties = {
  fontFamily: "var(--font-display)",
  fontSize: 30,
  fontWeight: 800,
  letterSpacing: "-0.03em",
  color: "#1d1d1f",
  margin: "0 0 8px",
};

const sectionSubtitle: CSSProperties = {
  fontSize: 15,
  color: "#6e6e73",
  margin: 0,
};

const featureGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, 1fr)",
  gap: 20,
};

const featureCard: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: 12,
  background: "rgba(255,255,255,0.55)",
  backdropFilter: "blur(16px) saturate(160%)",
  WebkitBackdropFilter: "blur(16px) saturate(160%)",
  border: "1.5px solid rgba(37,99,235,0.22)",
  borderRadius: 15,
  padding: "24px 22px",
  cursor: "pointer",
  fontFamily: "var(--font-body)",
  textAlign: "left",
  boxShadow: "0 6px 24px rgba(37,99,235,0.10), 0 2px 6px rgba(0,0,0,0.04)",
  position: "relative",
  zIndex: 999,
};

const featureIconWrap: CSSProperties = {
  width: 41,
  height: 41,
  borderRadius: 12,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const featureTag: CSSProperties = {
  fontSize: 9,
  fontWeight: 700,
  letterSpacing: "0.06em",
  textTransform: "uppercase" as const,
  borderRadius: 99,
  padding: "2px 8px",
};

const featureTitle: CSSProperties = {
  fontFamily: "var(--font-display)",
  fontSize: 15,
  fontWeight: 700,
  letterSpacing: "-0.02em",
  color: "#1d1d1f",
  margin: 0,
};

const featureDesc: CSSProperties = {
  fontSize: 11.5,
  color: "#6e6e73",
  lineHeight: 1.6,
  margin: 0,
  flex: 1,
};

const featureArrow: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  fontSize: 11,
  fontWeight: 600,
};

const footerOuter: CSSProperties = {
  width: "100%",
  borderTop: "1px solid rgba(0,0,0,0.08)",
  background: "#fafafa",
  marginTop: "auto",
};

const footerInner: CSSProperties = {
  maxWidth: 1120,
  margin: "0 auto",
  padding: "16px 32px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 16,
  boxSizing: "border-box",
};

const footerMid: CSSProperties = {
  fontSize: 12,
  color: "#6e6e73",
  letterSpacing: "0.03em",
};

const footerRight: CSSProperties = {
  fontSize: 12,
  color: "#6e6e73",
};
