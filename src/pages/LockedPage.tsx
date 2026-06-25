import { useEffect, useRef, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";

/* ── Inline canvas (same as LandingPage) ─────────────────────────────────── */

interface Particle { x: number; y: number; vx: number; vy: number; r: number }

function NetworkCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current; if (!canvas) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    const COUNT = 45; const DIST = 150; const particles: Particle[] = [];
    const resize = () => { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight; };
    resize();
    const ro = new ResizeObserver(resize); ro.observe(canvas);
    for (let i = 0; i < COUNT; i++) particles.push({ x: Math.random() * canvas.width, y: Math.random() * canvas.height, vx: (Math.random() - 0.5) * 0.4, vy: (Math.random() - 0.5) * 0.4, r: Math.random() * 2 + 1.5 });
    let raf: number;
    const draw = () => {
      const { width: w, height: h } = canvas; ctx.clearRect(0, 0, w, h);
      for (const p of particles) { p.x += p.vx; p.y += p.vy; if (p.x < 0) p.x = w; else if (p.x > w) p.x = 0; if (p.y < 0) p.y = h; else if (p.y > h) p.y = 0; }
      for (let i = 0; i < particles.length; i++) for (let j = i + 1; j < particles.length; j++) { const a = particles[i]; const b = particles[j]; const dx = a.x - b.x; const dy = a.y - b.y; const d = Math.sqrt(dx * dx + dy * dy); if (d < DIST) { ctx.beginPath(); ctx.strokeStyle = `rgba(37,99,235,${((1 - d / DIST) * 0.07).toFixed(3)})`; ctx.lineWidth = 1; ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); } }
      for (const p of particles) { ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fillStyle = "rgba(37,99,235,0.12)"; ctx.fill(); }
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, []);
  return <canvas ref={ref} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 0 }} />;
}

/* ── Inline SVGs ─────────────────────────────────────────────────────────── */

const IcTrendUp = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" />
  </svg>
);
const IcArrow = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
  </svg>
);
const IcChevR = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6" />
  </svg>
);
const IcLock = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);
const IcGlobe = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" />
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
  </svg>
);
const IcActivity = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
  </svg>
);
const IcCode = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" />
  </svg>
);

/* ── Data ─────────────────────────────────────────────────────────────────── */

const METRICS = [
  { label: "Agents deployed",    value: "12",  trend: "+8.2%"  },
  { label: "Total users",         value: "2",   trend: "+5.1%"  },
  { label: "Total interactions",  value: "204", trend: "+12.4%" },
  { label: "Intents secured",     value: "24",  trend: "+3.7%"  },
  { label: "Threats detected",    value: "9",   trend: "+1.9%"  },
];

const FEATURES = [
  { Ic: IcGlobe,    tag: "Monitoring",  title: "Real-time observability",    desc: "Track every agent interaction as it happens with live telemetry, execution traces, and instant alerting on anomalous behaviour." },
  { Ic: IcActivity, tag: "Analytics",   title: "Intent chain analytics",     desc: "Deep visibility into intent chains, execution paths, and multi-step agent decision trees across your entire fleet." },
  { Ic: IcCode,     tag: "Integration", title: "Drop-in SDK & API",          desc: "Production-ready middleware that wraps your existing agents in under five minutes — no model changes required." },
];

/* ── Component ───────────────────────────────────────────────────────────── */

export function LockedPage() {
  const navigate = useNavigate();
  const BLUE = "#2563EB";
  const BLUE_BG = "rgba(37,99,235,0.09)";

  return (
    <div style={pageStyle}>
      <style>{`
        .lp-metric-card { transition: border-color 180ms, box-shadow 180ms, transform 180ms; }
        .lp-metric-card:hover { border-color: #2563EB !important; box-shadow: 0 8px 24px rgba(37,99,235,0.18), 0 2px 6px rgba(37,99,235,0.10) !important; transform: translateY(-3px); }
        .lp-feature-card { transition: border-color 180ms, box-shadow 180ms, transform 180ms; }
        .lp-feature-card:hover { border-color: #2563EB !important; box-shadow: 0 12px 32px rgba(37,99,235,0.14), 0 4px 10px rgba(37,99,235,0.10) !important; transform: translateY(-4px); }
      `}</style>

      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <section style={heroSection}>
        <NetworkCanvas />
        <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 22 }}>
          {/* lock badge */}
          <div style={lockBadge}>
            <IcLock />
            <span>Feature locked</span>
          </div>

          <h1 style={h1Style}>
            The{" "}
            <span style={{ color: BLUE, textDecoration: "underline", textDecorationColor: BLUE, textDecorationThickness: 3, textUnderlineOffset: 6 }}>
              control center
            </span>
            <br />for your AI agents.
          </h1>

          <p style={subtitleStyle}>
            Real-time observability, intent tracking, and threat detection
            <br />across every agent interaction in your organisation.
          </p>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" as const, justifyContent: "center" }}>
            <button style={primaryCta}>
              Get started free <IcArrow />
            </button>
            <button style={secondaryCta} onClick={() => navigate("/profile")}>
              Get your API key
            </button>
          </div>
        </div>
      </section>

      {/* ── Live metrics ───────────────────────────────────────────────────── */}
      <section style={metricsSection}>
        <div style={sectionLabel}>
          <span style={liveDot} />
          Live network metrics
        </div>

        <div style={metricsGrid}>
          {METRICS.map(({ label, value, trend }) => (
            <div key={label} className="lp-metric-card" style={metricCard}>
              <div style={metricAccentBar} />
              <div style={metricCardBody}>
                <div style={trendBadge}>
                  <IcTrendUp />
                  <span>{trend}</span>
                </div>
                <div style={metricValue}>{value}</div>
                <div style={metricLabel}>{label}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ───────────────────────────────────────────────────────── */}
      <section style={exploreSection}>
        <div style={{ marginBottom: 32 }}>
          <h2 style={sectionH2}>Explore AgentDNA</h2>
          <p style={sectionSub}>Everything you need to deploy and govern AI agents at scale.</p>
        </div>

        <div style={featureGrid}>
          {FEATURES.map(({ Ic, tag, title, desc }) => (
            <div key={tag} className="lp-feature-card" style={featureCard}>
              <div style={{ width: 41, height: 41, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", background: BLUE_BG, color: BLUE }}>
                <Ic />
              </div>
              <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" as const, borderRadius: 99, padding: "2px 8px", color: BLUE, background: BLUE_BG }}>
                {tag}
              </span>
              <h3 style={featureTitle}>{title}</h3>
              <p style={featureDesc}>{desc}</p>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600, color: BLUE }}>
                Explore <IcChevR />
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Upgrade banner ─────────────────────────────────────────────────── */}
      <section style={bannerSection}>
        <div style={upgradeBanner}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#1d1d1f", marginBottom: 4 }}>
              Ready to unlock the full platform?
            </div>
            <div style={{ fontSize: 13, color: "#6e6e73" }}>
              Deploy your first agent and start monitoring in under 5 minutes.
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, flexShrink: 0 }}>
            <button style={primaryCta}>
              Upgrade plan <IcArrow />
            </button>
            <button style={secondaryCta} onClick={() => navigate("/profile")}>
              Get API key
            </button>
          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer style={footerStyle}>
        <span style={{ fontSize: 12, color: "#6e6e73" }}>Secured by AgentDNA · org-scoped JWT</span>
        <span style={{ fontSize: 12, color: "#6e6e73" }}>© {new Date().getFullYear()} AgentDNA</span>
      </footer>
    </div>
  );
}

/* ── Styles ──────────────────────────────────────────────────────────────── */

const pageStyle: CSSProperties = {
  minHeight: "100%",
  background: "#ffffff",
  display: "flex",
  flexDirection: "column",
  fontFamily: "var(--font-body)",
  overflowY: "auto",
};

const heroSection: CSSProperties = {
  position: "relative",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  textAlign: "center",
  padding: "72px 24px 64px",
  overflow: "hidden",
};

const lockBadge: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 7,
  fontSize: 12.5,
  fontWeight: 600,
  color: "#2563EB",
  background: "rgba(37,99,235,0.07)",
  border: "1px solid rgba(37,99,235,0.18)",
  borderRadius: 99,
  padding: "6px 16px",
};

const h1Style: CSSProperties = {
  fontFamily: "var(--font-display)",
  fontSize: "clamp(28px, 4.5vw, 52px)",
  fontWeight: 800,
  letterSpacing: "-0.04em",
  color: "#1d1d1f",
  lineHeight: 1.08,
  margin: 0,
};

const subtitleStyle: CSSProperties = {
  fontSize: 15,
  color: "#6e6e73",
  lineHeight: 1.65,
  maxWidth: 480,
  margin: 0,
};

const primaryCta: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  background: "#2563EB",
  border: "none",
  borderRadius: 11,
  padding: "12px 26px",
  fontSize: 14,
  fontWeight: 700,
  color: "#fff",
  cursor: "pointer",
  fontFamily: "var(--font-body)",
  boxShadow: "0 4px 16px rgba(37,99,235,0.28)",
};

const secondaryCta: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  background: "#fff",
  border: "1.5px solid rgba(0,0,0,0.14)",
  borderRadius: 11,
  padding: "12px 26px",
  fontSize: 14,
  fontWeight: 600,
  color: "#1d1d1f",
  cursor: "pointer",
  fontFamily: "var(--font-body)",
};

const metricsSection: CSSProperties = {
  width: "100%",
  maxWidth: 1120,
  margin: "0 auto",
  padding: "0 32px 56px",
  boxSizing: "border-box",
};

const sectionLabel: CSSProperties = {
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

const exploreSection: CSSProperties = {
  width: "100%",
  maxWidth: 1120,
  margin: "0 auto 64px",
  padding: "0 32px",
  boxSizing: "border-box",
};

const sectionH2: CSSProperties = {
  fontFamily: "var(--font-display)",
  fontSize: 28,
  fontWeight: 800,
  letterSpacing: "-0.03em",
  color: "#1d1d1f",
  margin: "0 0 8px",
};

const sectionSub: CSSProperties = {
  fontSize: 14,
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
  boxShadow: "0 6px 24px rgba(37,99,235,0.10), 0 2px 6px rgba(0,0,0,0.04)",
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
  fontSize: 12,
  color: "#6e6e73",
  lineHeight: 1.6,
  margin: 0,
  flex: 1,
};

const bannerSection: CSSProperties = {
  width: "100%",
  maxWidth: 1120,
  margin: "0 auto 64px",
  padding: "0 32px",
  boxSizing: "border-box",
};

const upgradeBanner: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 20,
  background: "rgba(37,99,235,0.04)",
  border: "1.5px solid rgba(37,99,235,0.18)",
  borderRadius: 14,
  padding: "24px 28px",
  flexWrap: "wrap" as const,
};

const footerStyle: CSSProperties = {
  width: "100%",
  maxWidth: 1120,
  margin: "0 auto",
  padding: "16px 32px",
  boxSizing: "border-box",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  borderTop: "1px solid rgba(0,0,0,0.08)",
  marginTop: "auto",
};
