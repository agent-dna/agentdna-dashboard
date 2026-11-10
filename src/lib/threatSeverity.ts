import severityData from "../data/threatSeverity.json";
import type { ThreatCode } from "../data/api";

/*
 * /top-threats, /threat-detail and /threat-by-id return each threat's severity themselves (from
 * the backend's handler/error_code.json); read it from there. This table is only for responses
 * that still don't carry one: /threats-list (the Home page's Incidents table). It must mirror
 * handler/error_code.json, which is the source of truth. Once /threats-list returns severity,
 * this file and threatSeverity.json can go.
 */

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
export function parseSeverity(raw: string | null | undefined): ThreatSeverity | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  const match = VALID_SEVERITIES.find((s) => s.toLowerCase() === trimmed.toLowerCase());
  if (!match) {
    console.warn(`[threatSeverity] unrecognized severity "${raw}" — expected one of ${VALID_SEVERITIES.join(", ")}`);
  }
  return match ?? null;
}

const entries = severityData as ThreatSeverityEntry[];
const byCode = new Map(entries.filter((e) => e.code != null).map((e) => [e.code as number, e]));
/** The title-only "Unknown Error" entry: what the backend reports for codes it doesn't track. */
const unknownEntry = entries.find((e) => e.code == null);

/**
 * Looks up a threat's severity from src/data/threatSeverity.json, a copy of the
 * backend's handler/error_code.json. Only for responses without their own
 * `severity` (see the note at the top of this file).
 *
 * Matches on `code` only — titles are free text and can be reworded, typo'd,
 * or capitalized differently between backend responses, which made
 * title-matching unreliable. A numeric code is the one stable, exact key.
 * Returns null (renders as "—") if there's no code, or the entry's severity
 * isn't one of the 5 known values.
 * "unknown", and any code not in the table, gets the "Unknown Error" entry's
 * severity, as the backend reports it.
 */
export function getThreatSeverity(code: ThreatCode | string | undefined): ThreatSeverity | null {
  if (code == null || code === "") return null;
  if (code === "unknown") return parseSeverity(unknownEntry?.severity);
  // Coerce defensively: if the backend ever sends threat_code as a numeric
  // *string* (e.g. "3303"), a strict Map lookup against numeric keys would
  // silently miss it.
  const numeric = typeof code === "number" ? code : Number(code);
  if (Number.isNaN(numeric)) {
    console.warn(`[threatSeverity] threat_code "${code}" isn't a valid number`);
    return null;
  }
  // A code the table doesn't list is in the backend's "Unknown Error" bucket, as /threat-by-id reports it.
  return parseSeverity((byCode.get(numeric) ?? unknownEntry)?.severity);
}

/**
 * One-line description for a threat code, from the same threatSeverity.json
 * used by getThreatSeverity. Returns undefined (render
 * nothing) if there's no code or no entry yet — same code-only matching
 * rationale as getThreatSeverity.
 */
export function getThreatDescription(code: ThreatCode | string | undefined): string | undefined {
  if (code == null || code === "" || code === "unknown") return undefined;
  const numeric = typeof code === "number" ? code : Number(code);
  if (Number.isNaN(numeric)) return undefined;
  return byCode.get(numeric)?.description;
}
