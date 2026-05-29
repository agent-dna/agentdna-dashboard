interface SparklineProps {
  data: number[];
  color?: string;
  filled?: boolean;
}

export function Sparkline({ data, color = "var(--accent)", filled = true }: SparklineProps) {
  if (!data || data.length < 2) return null;
  const w = 130;
  const h = 56;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const r = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - 4 - ((v - min) / r) * (h - 8);
    return [x, y] as const;
  });
  const pathD = "M " + pts.map((p) => p.join(",")).join(" L ");
  const areaD = pathD + ` L ${w},${h} L 0,${h} Z`;
  const gradId = `sg-${color.replace(/\W/g, "")}`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ width: "100%", height: "100%" }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.32" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {filled && <path d={areaD} fill={`url(#${gradId})`} />}
      <path d={pathD} fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
