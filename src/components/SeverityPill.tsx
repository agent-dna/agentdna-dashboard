import type { ThreatSeverity } from "../lib/threatSeverity";

const SEVERITY_STYLE: Record<ThreatSeverity, { color: string; bg: string }> = {
  Critical: { color: "#7F1D1D", bg: "rgba(127,29,29,0.14)" },
  High: { color: "var(--threat)", bg: "rgba(220,38,38,0.10)" },
  Medium: { color: "#B45309", bg: "rgba(217,119,6,0.12)" },
  Low: { color: "var(--accent)", bg: "rgba(37,99,235,0.10)" },
  Warning: { color: "#92700C", bg: "rgba(217,180,6,0.16)" },
};

/** Colored badge for a threat's severity — "—" when it isn't in threatSeverity.json yet (or its value isn't one of the 5 known severities). */
export function SeverityPill({ severity }: { severity: ThreatSeverity | null }) {
  const s = severity ? SEVERITY_STYLE[severity] : undefined;
  if (!s) {
    return <span style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, color: "var(--fg-faint)" }}>—</span>;
  }
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        fontSize: 11.5,
        fontWeight: 700,
        padding: "3px 9px",
        borderRadius: 999,
        color: s.color,
        background: s.bg,
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.color, flexShrink: 0 }} />
      {severity}
    </span>
  );
}
