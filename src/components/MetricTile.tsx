import { Icon, type IconName } from "./Icon";
import { Sparkline } from "./Sparkline";

interface MetricTileProps {
  label: string;
  value: string | number;
  unit?: string;
  delta?: string;
  direction?: "up" | "down";
  spark?: number[];
  sparkColor?: string;
  icon?: IconName;
}

export function MetricTile({ label, value, unit, delta, direction, spark, sparkColor, icon }: MetricTileProps) {
  return (
    <div className="metric">
      <div className="label">
        {icon && <Icon name={icon} size={13} />}
        <span>{label}</span>
      </div>
      <div className="value">
        {value}
        {unit && <span className="unit">{unit}</span>}
      </div>
      {delta != null && (
        <div className="delta">
          <span className={direction === "up" ? "up" : direction === "down" ? "down" : ""}>
            {direction === "up" ? "↑" : direction === "down" ? "↓" : "→"} {delta}
          </span>
          <span style={{ color: "var(--fg-faint)" }}>vs last 7 days</span>
        </div>
      )}
      {spark && spark.length > 1 && (
        <div className="spark">
          <Sparkline data={spark} color={sparkColor || "var(--accent)"} />
        </div>
      )}
    </div>
  );
}
