import { useState } from "react";
import type { HeatmapRow } from "../types";

function cellBg(v: number): string {
  if (v < 0.15) return `rgba(37, 99, 235, ${0.08 + v * 0.6})`;
  if (v < 0.45) return `rgba(37, 99, 235, ${0.2 + v * 0.7})`;
  if (v < 0.7) return `rgba(217, 119, 6, ${0.3 + v * 0.5})`;
  return `rgba(220, 38, 38, ${0.4 + v * 0.55})`;
}

interface HeatmapProps {
  rows: HeatmapRow[];
  hours?: number;
}

export function Heatmap({ rows, hours = 24 }: HeatmapProps) {
  const [hover, setHover] = useState<{ ri: number; ci: number; v: number } | null>(null);

  if (!rows.length) {
    return (
      <div style={{ padding: "40px 20px", textAlign: "center", color: "var(--fg-muted)", fontSize: 13 }}>
        No heatmap data
      </div>
    );
  }

  return (
    <div>
      <div className="hm">
        {rows.map((row, ri) => (
          <div className="hm-row" key={row.id}>
            <div className="lbl">{row.label}</div>
            <div className="hm-cells">
              {row.cells.map((v, ci) => {
                const isHover = hover && hover.ri === ri && hover.ci === ci;
                return (
                  <div
                    key={ci}
                    className="hm-cell"
                    style={{ background: cellBg(v), outline: isHover ? "1px solid var(--accent)" : "none" }}
                    onMouseEnter={() => setHover({ ri, ci, v })}
                    onMouseLeave={() => setHover(null)}
                    title={`${row.label} · ${String(ci).padStart(2, "0")}:00 · ${Math.round(v * 100)}`}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="hm-axis">
        <div />
        <div className="ticks">
          {Array.from({ length: hours }, (_, i) => (
            <div key={i}>{i % 4 === 0 ? String(i).padStart(2, "0") : ""}</div>
          ))}
        </div>
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "14px 20px 4px",
          fontSize: 11,
          color: "var(--fg-muted)",
          fontFamily: "var(--font-mono)",
        }}
      >
        <span>Less</span>
        {[0.05, 0.2, 0.45, 0.7, 0.95].map((v, i) => (
          <span
            key={i}
            style={{ width: 14, height: 14, borderRadius: 3, background: cellBg(v), display: "inline-block" }}
          />
        ))}
        <span>More</span>
      </div>
    </div>
  );
}
