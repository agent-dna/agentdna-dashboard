import { parseDestination, type ParsedDestination } from "./destination";

/**
 * How a resource (an outside service, identified by its URL) is named in the UI: a known
 * service's name ("OneDrive", "Microsoft Learn"), otherwise its host, with the full URL beside it.
 */
export function resourceLabel(url: string, name?: string): { title: string; dest: ParsedDestination } {
  const dest = parseDestination(url || name || "");
  const title = dest.entity !== "web" ? dest.name : dest.host || name || url;
  return { title, dest };
}

/** Path of a resource's own page. */
export const resourcePath = (resourceID: string) => `/resources/${encodeURIComponent(resourceID)}`;

/** Path of a credential's own page (under Resources, where credentials are listed). */
export const credentialPath = (credentialID: string) => `/resources/credentials/${encodeURIComponent(credentialID)}`;

/** "Oct 14, 2026, 09:11"; "—" when unknown. */
export function whenShort(iso: string): string {
  const t = Date.parse(iso);
  if (!iso || !Number.isFinite(t)) return "—";
  return new Date(t).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
