export type EntityKind = "agent" | "tool" | "user";

/**
 * Route for a DID, chosen by the kind the directory resolved it to.
 *
 * Returns null when the kind is unknown — an unresolved DID has no page to
 * land on, so callers should render plain text rather than a dead link.
 */
export function entityPath(kind: EntityKind | undefined, did: string): string | null {
  if (!did) return null;
  switch (kind) {
    case "agent":
      return `/agents/${encodeURIComponent(did)}`;
    case "tool":
      return `/tools/${encodeURIComponent(did)}`;
    case "user":
      return `/users/${encodeURIComponent(did)}`;
    default:
      return null;
  }
}
