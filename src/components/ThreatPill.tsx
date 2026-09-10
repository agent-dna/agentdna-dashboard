/** Matches the "Detected"/"Clear" pill used in LedgerTable's threat column. */
export function ThreatPill({ threat }: { threat: boolean }) {
  return threat ? (
    <span
      style={{
        font: "600 11.5px var(--font-mono)",
        letterSpacing: "0.06em",
        padding: "3px 9px",
        borderRadius: 5,
        color: "var(--threat)",
        background: "rgba(220,38,38,0.10)",
      }}
    >
      Detected
    </span>
  ) : (
    <span
      style={{
        font: "600 11.5px var(--font-mono)",
        letterSpacing: "0.06em",
        padding: "3px 9px",
        borderRadius: 5,
        color: "var(--fg-muted)",
        background: "var(--bg-2)",
      }}
    >
      Clear
    </span>
  );
}
