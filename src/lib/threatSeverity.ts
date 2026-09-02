import severityData from "../data/threatSeverity.json";

export type ThreatSeverity = "Critical" | "High" | "Medium" | "Low" | "Warning";

interface ThreatSeverityEntry {
  code: number;
  title: string;
  severity: ThreatSeverity | null;
}

const entries = severityData as ThreatSeverityEntry[];
const byCode = new Map(entries.map((e) => [e.code, e]));
const byTitle = new Map(entries.map((e) => [e.title.trim().toLowerCase(), e]));

/**
 * Looks up a threat's severity from src/data/threatSeverity.json — a static,
 * hand-maintained table of { code, title, severity }. Update that file to add
 * or correct entries; nothing here needs to change.
 *
 * Tries `code` first (the reliable key); falls back to matching `title` for
 * endpoints that don't return a numeric code (e.g. /threats-list only gives
 * threatTitle). Returns null if neither matches or the entry has no severity
 * set yet — render that as "—", not a guess.
 */
export function getThreatSeverity(code: number | undefined, title?: string): ThreatSeverity | null {
  if (code != null) {
    const hit = byCode.get(code);
    if (hit?.severity) return hit.severity;
  }
  if (title && title.trim()) {
    const hit = byTitle.get(title.trim().toLowerCase());
    if (hit?.severity) return hit.severity;
  }
  return null;
}
