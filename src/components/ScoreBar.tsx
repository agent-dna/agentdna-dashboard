interface ScoreBarProps {
  value: number;
}

/**
 * Score badge — formerly rendered a progress bar with a number; now just the
 * number, color-coded by threshold so it still reads at a glance.
 *
 *   < 70  → red    (threat)
 *   < 85  → amber  (warn)
 *   ≥ 85  → navy   (default fg)
 *
 * Kept the component name `ScoreBar` so existing call sites keep working
 * without churn.
 */
export function ScoreBar({ value }: ScoreBarProps) {
  const color = value < 70 ? "var(--threat)" : value < 85 ? "var(--warn)" : "var(--fg)";
  return (
    <span
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: 13,
        fontWeight: 600,
        color,
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {value}
    </span>
  );
}
