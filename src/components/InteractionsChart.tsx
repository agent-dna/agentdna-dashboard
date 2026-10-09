import { useLayoutEffect, useMemo, useRef, useState } from "react";

/**
 * Daily interactions as stacked columns: safe runs at the baseline, incidents
 * stacked on top, so each column's height is the day's total and the red cap
 * is its incident share. Blue/red rather than the green/red used on the metric
 * cards — green/red collapses under deuteranopia (validated ΔE 2.8 vs 29.9).
 */
const SAFE = "#2563EB"; // --accent
const INCIDENT = "#DC2626"; // --threat
const GRID = "#E8EEF7";

const PAD_L = 40;
const PAD_R = 8;
const PAD_T = 22;
const PAD_B = 28;
const MAX_BAR = 28;

interface Props {
  labels: string[];
  safe: number[];
  threats: number[];
  height?: number;
  loading?: boolean;
}

function niceMax(max: number, ticks: number): number {
  if (max <= 0) return ticks;
  const rough = max / ticks;
  const pow10 = Math.pow(10, Math.floor(Math.log10(rough)));
  const norm = rough / pow10;
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * pow10;
  return Math.ceil(max / step) * step;
}

const compact = (v: number) =>
  v >= 1_000_000 ? `${+(v / 1_000_000).toFixed(1)}M` : v >= 1000 ? `${+(v / 1000).toFixed(1)}k` : String(v);

const pct = (part: number, whole: number) => (whole > 0 ? `${((part / whole) * 100).toFixed(1)}%` : "—");

/** Column path with 4px rounded top corners and a square baseline end. */
function topRounded(x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h);
  return `M${x},${y + h} V${y + rr} Q${x},${y} ${x + rr},${y} H${x + w - rr} Q${x + w},${y} ${x + w},${y + rr} V${y + h} Z`;
}

export function InteractionsChart({ labels, safe, threats, height = 240, loading }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState<number | null>(null);

  // Render at true pixel width so bar widths, 2px gaps and 4px corners are
  // real pixels instead of stretching with a viewBox.
  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.floor(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const count = Math.min(labels.length, Math.max(safe.length, threats.length));
  const rows = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const s = safe[i] ?? 0;
        const t = threats[i] ?? 0;
        return { label: labels[i], safe: s, threats: t, total: s + t };
      }),
    [count, labels, safe, threats],
  );

  const sumTotal = rows.reduce((a, r) => a + r.total, 0);
  const sumThreats = rows.reduce((a, r) => a + r.threats, 0);
  const peakIx = rows.reduce((best, r, i) => (r.total > rows[best].total ? i : best), 0);

  const stats = (
    <div style={{ display: "flex", gap: 28, padding: "6px 20px 12px", flexWrap: "wrap" }}>
      {[
        { label: "Interactions", value: sumTotal.toLocaleString() },
        { label: "Incidents", value: sumThreats.toLocaleString() },
        { label: "Incident rate", value: pct(sumThreats, sumTotal) },
      ].map((s) => (
        <div key={s.label}>
          <div style={{ fontSize: 11, color: "var(--fg-muted)", marginBottom: 2 }}>{s.label}</div>
          <div style={{ fontSize: 20, fontWeight: 600, color: "var(--fg)", fontFamily: "var(--font-display)", lineHeight: 1.1 }}>
            {s.value}
          </div>
        </div>
      ))}
    </div>
  );

  const legend = (
    <div className="chart-legend" style={{ paddingBottom: 8 }}>
      <span className="it">
        <span className="sw" style={{ background: SAFE }} /> Safe
      </span>
      <span className="it">
        <span className="sw" style={{ background: INCIDENT }} /> Incidents
      </span>
    </div>
  );

  if (loading && count === 0) {
    return <div style={{ height: height + 80, display: "grid", placeItems: "center", color: "var(--fg-muted)", fontSize: 13 }}>Loading…</div>;
  }
  if (count === 0 || sumTotal === 0) {
    return (
      <div style={{ height: height + 80, display: "grid", placeItems: "center", color: "var(--fg-muted)", fontSize: 13 }}>
        No interactions in the last 7 days
      </div>
    );
  }

  const iw = Math.max(0, width - PAD_L - PAD_R);
  const ih = height - PAD_T - PAD_B;
  const ticks = 4;
  const yMax = niceMax(Math.max(...rows.map((r) => r.total)), ticks);
  const yTicks = Array.from({ length: ticks + 1 }, (_, i) => (yMax / ticks) * i);
  const slot = iw / count;
  const bw = Math.min(MAX_BAR, slot * 0.5);
  const cx = (i: number) => PAD_L + slot * i + slot / 2;
  const y = (v: number) => PAD_T + ih - (v / yMax) * ih;
  const base = y(0);

  const hovered = hover != null ? rows[hover] : null;

  return (
    <div>
      {stats}
      {legend}
      <div ref={wrapRef} style={{ position: "relative", padding: "0 20px 16px" }}>
        {width > 0 && (
          <svg
            width={width}
            height={height}
            style={{ display: "block", overflow: "visible" }}
            role="img"
            aria-label={`Interactions per day, last ${count} days: ${sumTotal} total, ${sumThreats} incidents`}
            onMouseLeave={() => setHover(null)}
          >
            {yTicks.map((t, i) => (
              <g key={i}>
                <line x1={PAD_L} x2={PAD_L + iw} y1={y(t)} y2={y(t)} stroke={i === 0 ? "var(--line-strong)" : GRID} strokeWidth={1} shapeRendering="crispEdges" />
                <text x={PAD_L - 8} y={y(t) + 3.5} textAnchor="end" fill="var(--fg-faint)" fontSize="10.5" fontFamily="var(--font-mono)" style={{ fontVariantNumeric: "tabular-nums" }}>
                  {compact(t)}
                </text>
              </g>
            ))}

            {rows.map((r, i) => {
              const x = cx(i) - bw / 2;
              const dim = hover != null && hover !== i;
              // Safe sits on the baseline; incidents stack above with a 2px
              // gap (left unpainted, so the card surface shows through). Whichever segment is on top gets the rounded end.
              const safeTop = y(r.safe);
              const safeH = base - safeTop;
              const gap = r.safe > 0 && r.threats > 0 ? 2 : 0;
              const thrBottom = safeTop - gap;
              const thrTop = y(r.total) - gap;
              const thrH = Math.max(0, thrBottom - thrTop);
              const isToday = i === count - 1;
              return (
                <g key={i} style={{ opacity: dim ? 0.35 : 1, transition: "opacity 120ms" }}>
                  {safeH > 0 &&
                    (r.threats > 0 ? (
                      <rect x={x} y={safeTop} width={bw} height={safeH} fill={SAFE} />
                    ) : (
                      <path d={topRounded(x, safeTop, bw, safeH, 4)} fill={SAFE} />
                    ))}
                  {r.threats > 0 && <path d={topRounded(x, thrTop, bw, Math.max(thrH, 2), 4)} fill={INCIDENT} />}
                  {i === peakIx && hover == null && (
                    <text x={cx(i)} y={thrTop - 6} textAnchor="middle" fill="var(--fg-dim)" fontSize="11" fontWeight={600} fontFamily="var(--font-mono)">
                      {compact(r.total)}
                    </text>
                  )}
                  <text
                    x={cx(i)}
                    y={height - 8}
                    textAnchor="middle"
                    fill={isToday ? "var(--fg-dim)" : "var(--fg-faint)"}
                    fontWeight={isToday ? 600 : 400}
                    fontSize="10.5"
                    fontFamily="var(--font-mono)"
                  >
                    {isToday ? "Today" : r.label}
                  </text>
                </g>
              );
            })}

            {/* Full-slot hit targets — much bigger than the bars themselves. */}
            {rows.map((_, i) => (
              <rect key={i} x={PAD_L + slot * i} y={PAD_T - 16} width={slot} height={ih + 16} fill="transparent" onMouseEnter={() => setHover(i)} />
            ))}
          </svg>
        )}

        {hovered && hover != null && (
          <div
            style={{
              position: "absolute",
              left: 20 + cx(hover),
              top: Math.max(0, y(hovered.total) - 12),
              transform: `translate(${hover > count / 2 ? "calc(-100% - 20px)" : "20px"}, 0)`,
              background: "var(--bg-1)",
              border: "1px solid var(--line-strong)",
              borderRadius: 8,
              boxShadow: "0 6px 20px rgba(10,34,64,0.12)",
              padding: "10px 12px",
              fontSize: 12,
              pointerEvents: "none",
              minWidth: 168,
              zIndex: 2,
            }}
          >
            <div style={{ color: "var(--fg-muted)", fontSize: 11, marginBottom: 8 }}>{hovered.label}</div>
            {[
              { color: SAFE, label: "Safe", v: hovered.safe },
              { color: INCIDENT, label: "Incidents", v: hovered.threats },
            ].map((s) => (
              <div key={s.label} style={{ display: "flex", justifyContent: "space-between", gap: 16, marginBottom: 4 }}>
                <span style={{ color: "var(--fg-dim)", display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: s.color }} />
                  {s.label}
                </span>
                <span style={{ color: "var(--fg)", fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums" }}>{s.v.toLocaleString()}</span>
              </div>
            ))}
            <div style={{ borderTop: "1px solid var(--line)", marginTop: 6, paddingTop: 6, display: "flex", justifyContent: "space-between", color: "var(--fg-muted)" }}>
              <span>Total · {pct(hovered.threats, hovered.total)} flagged</span>
              <span style={{ color: "var(--fg)", fontWeight: 600, fontFamily: "var(--font-mono)" }}>{hovered.total.toLocaleString()}</span>
            </div>
          </div>
        )}

        {/* Table view for screen readers — the same numbers the columns encode. */}
        <table style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)", whiteSpace: "nowrap" }}>
          <caption>Interactions per day</caption>
          <thead>
            <tr><th>Day</th><th>Safe</th><th>Incidents</th><th>Total</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label}><td>{r.label}</td><td>{r.safe}</td><td>{r.threats}</td><td>{r.total}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
