import severityData from "../data/threatSeverity.json";

export type ThreatSeverity = "Critical" | "High" | "Medium" | "Low" | "Warning";

const VALID_SEVERITIES: ThreatSeverity[] = ["Critical", "High", "Medium", "Low", "Warning"];

interface ThreatSeverityEntry {
  /** Omit for a title-only entry (e.g. "Unknown Error", which has no real threat code). */
  code?: number;
  title: string;
  /** Not validated at parse time — threatSeverity.json is hand-edited, so a
   * typo/casing slip is expected here. Only `normalizeSeverity` below decides
   * whether a value is actually usable. */
  severity: string | null;
  /** One-line human-readable explanation, shown as a subtitle under the threat title. Optional — not every entry has one yet. */
  description?: string;
}

/**
 * threatSeverity.json is hand-maintained, so its `severity` strings can't be
 * trusted as-is — a typo (e.g. "Critcical") or wrong casing (e.g. "high")
 * must not crash the page. Case-normalize and validate against the 5 known
 * values; anything else (including a genuine typo) becomes null, which
 * renders as "—" instead of throwing.
 */
function normalizeSeverity(raw: string | null | undefined): ThreatSeverity | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  const match = VALID_SEVERITIES.find((s) => s.toLowerCase() === trimmed.toLowerCase());
  if (!match) {
    console.warn(`[threatSeverity.json] unrecognized severity "${raw}" — expected one of ${VALID_SEVERITIES.join(", ")}`);
  }
  return match ?? null;
}

const entries = severityData as ThreatSeverityEntry[];
const byCode = new Map(entries.filter((e) => e.code != null).map((e) => [e.code as number, e]));

/**
 * Looks up a threat's severity from src/data/threatSeverity.json — a static,
 * hand-maintained table of { code, title, severity }. Update that file to add
 * or correct entries; nothing here needs to change.
 *
 * Matches on `code` only — titles are free text and can be reworded, typo'd,
 * or capitalized differently between backend responses, which made
 * title-matching unreliable. A numeric code is the one stable, exact key.
 * Returns null (renders as "—") if there's no code, no matching entry, or
 * the entry's severity isn't set yet / isn't one of the 5 known values.
 *
 * Endpoints that don't return a code at all (e.g. /threats-list only gives
 * threatTitle) can't be matched here — that's a real gap, not a bug: ask the
 * backend to add threat_code to that response if you need severity there.
 */
export function getThreatSeverity(code: number | string | undefined): ThreatSeverity | null {
  if (code == null || code === "") return null;
  // Coerce defensively — `code` is typed as `number` at every call site, but
  // if the backend ever actually sends threat_code as a numeric *string*
  // (e.g. "3303"), a strict Map lookup against numeric keys would silently
  // miss it despite the TS type saying it can't happen.
  const numeric = typeof code === "number" ? code : Number(code);
  if (Number.isNaN(numeric)) {
    console.warn(`[threatSeverity] threat_code "${code}" isn't a valid number`);
    return null;
  }
  const hit = byCode.get(numeric);
  if (!hit) {
    console.warn(`[threatSeverity] no entry for threat_code ${numeric} in threatSeverity.json`);
  }
  return normalizeSeverity(hit?.severity);
}

/**
 * One-line description for a threat code, from the same hand-maintained
 * threatSeverity.json used by getThreatSeverity. Returns undefined (render
 * nothing) if there's no code or no entry yet — same code-only matching
 * rationale as getThreatSeverity.
 */
export function getThreatDescription(code: number | string | undefined): string | undefined {
  if (code == null || code === "") return undefined;
  const numeric = typeof code === "number" ? code : Number(code);
  if (Number.isNaN(numeric)) return undefined;
  return byCode.get(numeric)?.description;
}
