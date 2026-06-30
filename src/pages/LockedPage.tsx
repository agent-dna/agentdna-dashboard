import { useEffect, useRef, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { TrendingUp, ShieldAlert, ArrowUpRight, Network, Rocket, Code } from "lucide-react";

/* ── Particle canvas ─────────────────────────────────────────────────────── */
interface Particle { x: number; y: number; vx: number; vy: number; r: number }

function NetworkCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current; if (!canvas) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    const COUNT = 45, DIST = 150;
    const particles: Particle[] = [];
    const resize = () => { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight; };
    resize();
    const ro = new ResizeObserver(resize); ro.observe(canvas);
    for (let i = 0; i < COUNT; i++)
      particles.push({ x: Math.random() * canvas.width, y: Math.random() * canvas.height, vx: (Math.random() - 0.5) * 0.4, vy: (Math.random() - 0.5) * 0.4, r: Math.random() * 2 + 1.5 });
    let raf: number;
    const draw = () => {
      const { width: w, height: h } = canvas; ctx.clearRect(0, 0, w, h);
      for (const p of particles) { p.x += p.vx; p.y += p.vy; if (p.x < 0) p.x = w; else if (p.x > w) p.x = 0; if (p.y < 0) p.y = h; else if (p.y > h) p.y = 0; }
      for (let i = 0; i < particles.length; i++) for (let j = i + 1; j < particles.length; j++) { const a = particles[i], b = particles[j], dx = a.x - b.x, dy = a.y - b.y, d = Math.sqrt(dx * dx + dy * dy); if (d < DIST) { ctx.beginPath(); ctx.strokeStyle = `rgba(0,81,213,${((1 - d / DIST) * 0.07).toFixed(3)})`; ctx.lineWidth = 1; ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); } }
      for (const p of particles) { ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fillStyle = "rgba(0,81,213,0.10)"; ctx.fill(); }
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, []);
  return <canvas ref={ref} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 0 }} />;
}

/* ── Data ─────────────────────────────────────────────────────────────────── */

const METRICS = [
  { id: "agents",       label: "AGENTS DEPLOYED",    value: 12,  change: "+8.2%",  isPositive: true,  barWidth: "65%", barColor: "#2563EB" },
  { id: "users",        label: "TOTAL USERS",         value: 2,   change: "+5.1%",  isPositive: true,  barWidth: "65%", barColor: "#2563EB" },
  { id: "interactions", label: "TOTAL INTERACTIONS",  value: 204, change: "+12.4%", isPositive: true,  barWidth: "65%", barColor: "#2563EB" },
  { id: "intents",      label: "INTENTS SECURED",     value: 24,  change: "+3.7%",  isPositive: true,  barWidth: "65%", barColor: "#2563EB" },
  { id: "threats",      label: "THREATS DETECTED",    value: 9,   change: "+1.9%",  isPositive: false, barWidth: "15%", barColor: "#BA1A1A" },
];

const FEATURES = [
  { Ic: Network, tag: "HUB",            title: "Agent Registry",          desc: "Browse and manage all agents registered in your organisation. View policies, scores, and deployment history.",                                         cta: "Explore Registry" },
  { Ic: Rocket,  tag: "TUTORIAL",       title: "Deploy your first agent", desc: "Step-by-step guide to generating an API key, deploying an agent, and monitoring its first interactions.",                                           cta: "Start Tutorial"   },
  { Ic: Code,    tag: "AGENT EXAMPLES", title: "Starter templates",       desc: "Production-ready agent blueprints with built-in intent tracking, threat hooks, and org-scoped policies.",                                            cta: "View Templates"   },
];

/* ── Component ───────────────────────────────────────────────────────────── */

export function LockedPage() {
  const navigate = useNavigate();

  return (
    <div style={pageStyle}>
      <style>{`
        @keyframes lp-ping {
          75%, 100% { transform: scale(2); opacity: 0; }
        }
        .lp-ping { animation: lp-ping 1.4s cubic-bezier(0,0,0.2,1) infinite; }
        .lp-metric:hover { transform: translateY(-2px); box-shadow: 0 12px 32px rgba(0,81,213,0.18), 0 2px 8px rgba(0,0,0,0.18) !important; }
        .lp-feature:hover { transform: translateY(-4px); box-shadow: 0 16px 40px rgba(0,81,213,0.14), 0 4px 12px rgba(0,0,0,0.06) !important; border-color: #DEE8FF !important; }
        .lp-feature:hover .lp-feat-icon { transform: scale(1.08); }
        .lp-feature:hover .lp-feat-title { color: #0051d5 !important; }
        .lp-metric, .lp-feature { transition: transform 200ms, box-shadow 200ms, border-color 200ms; }
        .lp-feat-icon { transition: transform 200ms; }
        .lp-feat-title { transition: color 200ms; }
      `}</style>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section style={heroSection}>
        <NetworkCanvas />
        <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column" as const, alignItems: "center", gap: 24, textAlign: "center" as const }}>

          {/* Animated ping pill */}
          <div style={pingPill}>
            <span style={{ position: "relative", display: "inline-flex", width: 8, height: 8 }}>
              <span className="lp-ping" style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "#0051d5", opacity: 0.75 }} />
              <span style={{ position: "relative", display: "inline-flex", width: 8, height: 8, borderRadius: "50%", background: "#0051d5" }} />
            </span>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#0051d5" }}>Live Network Metrics</span>
          </div>

          {/* Heading */}
          <h1 style={h1Style}>
            The{" "}
            <span style={{ color: "#0051d5", textDecoration: "underline wavy #DEE8FF", textDecorationThickness: "4px", textUnderlineOffset: "6px" }}>
              control center
            </span>
            <br />for your AI agents.
          </h1>

          <p style={subtitleStyle}>
            Real-time observability, intent tracking, and threat detection across every
            <br />agent interaction in your organisation.
          </p>

          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" as const, justifyContent: "center" }}>
            <button style={primaryCta}>
              Get started free <ArrowUpRight size={16} />
            </button>
            <button style={secondaryCta} onClick={() => navigate("/profile")}>
              Get your API key
            </button>
          </div>
        </div>
      </section>

      {/* ── Metrics ──────────────────────────────────────────────────────── */}
      <section style={section}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 16 }}>
          {METRICS.map((m) => (
            <div key={m.id} className="lp-metric" style={metricCard}>
              {/* Top row: label + badge */}
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", color: "#9ca3af" }}>
                  {m.label}
                </span>
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: 2, flexShrink: 0,
                  background: m.isPositive ? "rgba(34,197,94,0.10)" : "rgba(239,68,68,0.10)",
                  color: m.isPositive ? "#4ade80" : "#f87171",
                  borderRadius: 4, padding: "2px 6px", fontSize: 10, fontWeight: 700,
                }}>
                  {m.isPositive ? <TrendingUp size={11} /> : <ShieldAlert size={11} />}
                  {m.change}
                </span>
              </div>

              {/* Large value */}
              <div style={{ margin: "14px 0 10px" }}>
                <span style={{ fontFamily: "var(--font-display)", fontSize: 34, fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1, color: "#ffffff" }}>
                  {m.value}
                </span>
              </div>

              {/* Progress bar */}
              <div style={{ height: 3, width: "100%", background: "rgba(255,255,255,0.10)", borderRadius: 99, overflow: "hidden" }}>
                <div style={{ height: "100%", width: m.barWidth, background: m.barColor, borderRadius: 99, transition: "width 1s" }} />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Explore ──────────────────────────────────────────────────────── */}
      <section style={{ ...section, paddingBottom: 64 }}>
        <div style={{ marginBottom: 32 }}>
          <h2 style={sectionH2}>Explore AgentDNA</h2>
          <p style={{ fontSize: 14, color: "#44474d", margin: 0 }}>
            Everything you need to deploy and govern AI agents at scale.
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24 }}>
          {FEATURES.map(({ Ic, tag, title, desc, cta }) => (
            <div key={tag} className="lp-feature" style={featureCard}>
              <div className="lp-feat-icon" style={featureIconBox}>
                <Ic size={24} color="#ffffff" />
              </div>

              <span style={featureTagStyle}>{tag}</span>

              <h3 className="lp-feat-title" style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 700, color: "#111c2d", margin: "4px 0 0", letterSpacing: "-0.02em" }}>
                {title}
              </h3>

              <p style={{ fontSize: 13, color: "#44474d", lineHeight: 1.65, margin: 0, flex: 1 }}>
                {desc}
              </p>

              <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 700, color: "#0051d5", marginTop: 4 }}>
                {cta} <span style={{ transition: "transform 200ms" }}>→</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer style={footerStyle}>
        <span style={{ fontSize: 12, color: "#6e6e73" }}>Secured by AgentDNA</span>
        <span style={{ fontSize: 12, color: "#6e6e73" }}>© {new Date().getFullYear()} AgentDNA</span>
      </footer>
    </div>
  );
}

/* ── Styles ──────────────────────────────────────────────────────────────── */

const pageStyle: CSSProperties = {
  minHeight: "100%",
  background: "#F9F9FF",
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
  padding: "72px 24px 64px",
  overflow: "hidden",
};

const pingPill: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 7,
  background: "#E7EEFF",
  border: "1px solid #DEE8FF",
  borderRadius: 99,
  padding: "6px 16px",
  boxShadow: "0 1px 4px rgba(0,81,213,0.08)",
};

const h1Style: CSSProperties = {
  fontFamily: "var(--font-display)",
  fontSize: "clamp(28px, 4vw, 52px)",
  fontWeight: 800,
  letterSpacing: "-0.04em",
  color: "#111c2d",
  lineHeight: 1.06,
  margin: 0,
};

const subtitleStyle: CSSProperties = {
  fontSize: 15,
  color: "#44474d",
  lineHeight: 1.7,
  maxWidth: 520,
  margin: 0,
};

const primaryCta: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  background: "#0051d5",
  border: "none",
  borderRadius: 9,
  padding: "12px 24px",
  fontSize: 14,
  fontWeight: 700,
  color: "#fff",
  cursor: "pointer",
  fontFamily: "var(--font-body)",
  boxShadow: "0 4px 16px rgba(0,81,213,0.22)",
};

const secondaryCta: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  background: "#ffffff",
  border: "1.5px solid #E2E8F0",
  borderRadius: 9,
  padding: "12px 24px",
  fontSize: 14,
  fontWeight: 600,
  color: "#111c2d",
  cursor: "pointer",
  fontFamily: "var(--font-body)",
};

const section: CSSProperties = {
  width: "100%",
  maxWidth: 1280,
  margin: "0 auto",
  padding: "0 32px 56px",
  boxSizing: "border-box",
};

const metricCard: CSSProperties = {
  position: "relative",
  overflow: "hidden",
  background: "#0A192F",
  border: "1px solid rgba(255,255,255,0.05)",
  borderRadius: 12,
  padding: "20px",
  display: "flex",
  flexDirection: "column",
  boxShadow: "0 4px 20px rgba(10,25,47,0.36), 0 1px 4px rgba(0,0,0,0.12)",
};

const sectionH2: CSSProperties = {
  fontFamily: "var(--font-display)",
  fontSize: 28,
  fontWeight: 800,
  letterSpacing: "-0.03em",
  color: "#111c2d",
  margin: "0 0 8px",
};

const featureCard: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: 14,
  background: "#ffffff",
  border: "1px solid #E2E8F0",
  borderRadius: 16,
  padding: "32px 28px",
  height: 360,
  boxSizing: "border-box",
  boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
  cursor: "pointer",
};

const featureIconBox: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: 48,
  height: 48,
  borderRadius: 12,
  background: "#0051d5",
  boxShadow: "0 4px 12px rgba(0,81,213,0.28)",
  flexShrink: 0,
};

const featureTagStyle: CSSProperties = {
  display: "inline-block",
  background: "#E7EEFF",
  color: "#0051d5",
  borderRadius: 99,
  padding: "3px 10px",
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: "0.08em",
};

const footerStyle: CSSProperties = {
  width: "100%",
  maxWidth: 1280,
  margin: "0 auto",
  padding: "16px 32px",
  boxSizing: "border-box",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  borderTop: "1px solid rgba(0,0,0,0.08)",
  marginTop: "auto",
};
