interface ScoreBarProps {
  value: number;
}

export function ScoreBar({ value }: ScoreBarProps) {
  const cls = value < 70 ? "low" : value < 85 ? "mid" : "";
  return (
    <div className={`score-bar ${cls}`}>
      <div className="track">
        <div className="fill" style={{ width: `${value}%` }} />
      </div>
      <span style={{ color: value < 70 ? "var(--threat)" : value < 85 ? "var(--warn)" : "var(--fg)" }}>{value}</span>
    </div>
  );
}
