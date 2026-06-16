import { useState } from "react";

export interface ChartSeries {
  key: string;
  label: string;
  color: string;
  data: number[];
}

interface ChartProps {
  series: ChartSeries[];
  labels: string[];
  style?: "area" | "line" | "bar";
  height?: number;
  formatY?: (v: number) => string | number;
}

function computeNiceMax(max: number, ticks: number): number {
  if (max <= 0) return ticks;
  // Round the per-tick step to a "nice" 1/2/5×10^n number so the axis breathes
  // with the data instead of jumping in 100s.
  const roughStep = max / ticks;
  const pow10 = Math.pow(10, Math.floor(Math.log10(roughStep)));
  const norm = roughStep / pow10;
  let niceStep: number;
  if (norm <= 1) niceStep = 1;
  else if (norm <= 2) niceStep = 2;
  else if (norm <= 5) niceStep = 5;
  else niceStep = 10;
  niceStep *= pow10;
  return Math.ceil(max / niceStep) * niceStep;
}

export function Chart({ series, labels, style = "area", height = 280, formatY = (v) => v }: ChartProps) {
  const [hover, setHover] = useState<number | null>(null);

  if (!labels.length || !series.length) {
    return (
      <div style={{ height, display: "grid", placeItems: "center", color: "var(--fg-muted)", fontSize: 13 }}>
        No data
      </div>
    );
  }

  const w = 800;
  const h = height;
  const padL = 44;
  const padR = 16;
  const padT = 18;
  const padB = 36;
  const iw = w - padL - padR;
  const ih = h - padT - padB;

  const all = series.flatMap((s) => s.data);
  const max = Math.max(...all, 1);
  const ticks = 4;
  // Pick a Y-axis step that matches the data magnitude so bars use the full
  // chart height instead of getting flattened to ~20% by a hard-coded /100.
  const niceMax = computeNiceMax(max, ticks);
  const yTicks = Array.from({ length: ticks + 1 }, (_, i) => Math.round((niceMax / ticks) * i));

  const xFor = (i: number) => padL + (labels.length === 1 ? iw / 2 : (i / (labels.length - 1)) * iw);
  const yFor = (v: number) => padT + ih - (v / niceMax) * ih;
  const xTickIxs = labels.map((_, i) => i).filter((i) => i % 4 === 0 || i === labels.length - 1);

  return (
    <div style={{ position: "relative" }}>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        style={{ width: "100%", height: h, display: "block" }}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          {series.map((s) => (
            <linearGradient key={s.key} id={`g-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity="0.34" />
              <stop offset="100%" stopColor={s.color} stopOpacity="0" />
            </linearGradient>
          ))}
        </defs>

        {yTicks.map((t, i) => (
          <g key={i}>
            <line
              x1={padL}
              y1={yFor(t)}
              x2={w - padR}
              y2={yFor(t)}
              stroke="rgba(148,163,200,0.07)"
              strokeDasharray={i === 0 ? "" : "2 4"}
            />
            <text x={padL - 8} y={yFor(t) + 4} textAnchor="end" fill="var(--fg-faint)" fontSize="10.5" fontFamily="var(--font-mono)">
              {formatY(t)}
            </text>
          </g>
        ))}

        {xTickIxs.map((i) => (
          <text key={i} x={xFor(i)} y={h - 12} textAnchor="middle" fill="var(--fg-faint)" fontSize="10.5" fontFamily="var(--font-mono)">
            {labels[i]}
          </text>
        ))}

        {series.map((s, sx) => {
          if (style === "bar") {
            // Use 85% of the slot for the bar group so bars are visibly wide.
            const bw = Math.max(3, ((iw / labels.length) * 0.85) / series.length);
            return (
              <g key={s.key}>
                {s.data.map((v, i) => (
                  <rect
                    key={i}
                    x={xFor(i) - (series.length * bw) / 2 + sx * bw}
                    y={yFor(v)}
                    width={bw - 1}
                    height={ih + padT - yFor(v)}
                    fill={s.color}
                    opacity="0.75"
                    rx="1.5"
                  />
                ))}
              </g>
            );
          }
          const pts = s.data.map((v, i) => [xFor(i), yFor(v)] as const);
          const pathD = "M " + pts.map((p) => p.join(",")).join(" L ");
          const areaD = pathD + ` L ${xFor(labels.length - 1)},${yFor(0)} L ${xFor(0)},${yFor(0)} Z`;
          return (
            <g key={s.key}>
              {style === "area" && <path d={areaD} fill={`url(#g-${s.key})`} />}
              <path d={pathD} fill="none" stroke={s.color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              {pts.map((p, i) => (
                <circle key={i} cx={p[0]} cy={p[1]} r="2.5" fill={s.color} opacity={hover === i ? 1 : 0} />
              ))}
            </g>
          );
        })}

        {labels.map((_, i) => (
          <rect
            key={i}
            x={xFor(i) - iw / labels.length / 2}
            y={padT}
            width={iw / labels.length}
            height={ih}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
          />
        ))}

        {hover != null && (
          <line x1={xFor(hover)} y1={padT} x2={xFor(hover)} y2={h - padB} stroke="var(--line-strong)" strokeDasharray="3 3" />
        )}
      </svg>

      {hover != null && (
        <div
          style={{
            position: "absolute",
            left: `${(xFor(hover) / w) * 100}%`,
            top: 8,
            transform: "translateX(-50%)",
            background: "var(--bg-3)",
            border: "1px solid var(--line-strong)",
            borderRadius: 8,
            padding: "8px 12px",
            fontSize: 12,
            pointerEvents: "none",
            minWidth: 140,
            zIndex: 2,
            fontFamily: "var(--font-mono)",
          }}
        >
          <div style={{ color: "var(--fg-muted)", fontSize: 11, marginBottom: 6 }}>{labels[hover]}</div>
          {series.map((s) => (
            <div key={s.key} style={{ display: "flex", justifyContent: "space-between", gap: 14 }}>
              <span style={{ color: "var(--fg-dim)", display: "inline-flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: s.color, display: "inline-block" }} />
                {s.label}
              </span>
              <span style={{ color: "var(--fg)" }}>{formatY(s.data[hover])}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
