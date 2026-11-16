import { worstAuthTone, type AuthEvidence, type AuthEvidenceInteraction, type AuthTone } from "../api/observability";
import { ms } from "../pages/observability/format";
import { isOnPath, parseInteractionId } from "./interactionBranch";
import { parseDestination, type ParsedDestination } from "./destination";
import type { Interaction } from "../types";

/**
 * The intent page's Credentials tab: one row per outside service an app reached, followed back
 * through the credentials that got the request there.
 *
 * A row starts at a destination: an interaction's server_out checks (the receiver calling its own
 * backend). Its trail then walks backwards: the interaction that delivered the request to that
 * receiver (its client_out / server_in checks), then the one that delivered it to that sender, and
 * so on, until it reaches whoever started the request.
 */

/** One hand-off on the way back: `from` presented a credential to `to`. */
export interface TrailLink {
  interactionId: string;
  from: string;
  fromName: string;
  to: string;
  toName: string;
  /** The hand-off's own checks (client_out, gateway, server_in), oldest first. */
  checks: AuthEvidence[];
  /**
   * Whether the key the sender sent (client_out) is the one the receiver got (server_in):
   * "same", "changed", or undefined when only one side was seen.
   */
  match?: "same" | "changed";
  /** Worst result among the receiver-side checks (server_in, gateway; else all). */
  tone: AuthTone;
}

export interface DestinationRow {
  key: string;
  /** The service reached, as recorded. */
  raw: string;
  dest: ParsedDestination;
  /** What the row calls it: the host for a website or local service, else the service name. */
  label: string;
  /** The app that made the call (the receiver of `trail[0]`). */
  caller: string;
  callerName: string;
  /** The checks of the call itself (server_out to this destination), oldest first. */
  onward: AuthEvidence[];
  /** Hand-offs back from the caller to whoever started, nearest first. */
  trail: TrailLink[];
  tone: AuthTone;
  /** When the call was first seen. */
  at: string;
}

const src = (e: AuthEvidence) => (e.source || "").toLowerCase();
const isOnward = (e: AuthEvidence) => src(e) === "server_out";
const byTime = (a: AuthEvidence, b: AuthEvidence) => (ms(a.observedAt) ?? 0) - (ms(b.observedAt) ?? 0);

/** A destination that isn't another participant (participants are DIDs, which start "bafy"). */
const isOutside = (raw: string) => !!raw.trim() && !raw.trim().toLowerCase().startsWith("bafy");

/** Same credential, same way: what decides whether two checks are "the same key". */
const credKey = (e: AuthEvidence) => `${e.credentialID || ""}\u0000${(e.authMethod || "").toLowerCase()}`;

function linkOf(step: AuthEvidenceInteraction | undefined, ix: Interaction | undefined, checks: AuthEvidence[], name: (did: string, given?: string) => string): TrailLink {
  const from = step?.from || ix?.initiator.id || "";
  const to = step?.to || ix?.target.id || "";
  const own = checks.filter((e) => !isOnward(e)).sort(byTime);
  const out = own.find((e) => src(e) === "client_out");
  const got = own.find((e) => src(e) === "server_in");
  const receiverSide = own.filter((e) => src(e) !== "client_out");
  return {
    interactionId: step?.interactionID || ix?.id || "",
    from,
    fromName: name(from, step?.fromName || ix?.initiator.name),
    to,
    toName: name(to, step?.toName || ix?.target.name),
    checks: own,
    match: out && got ? (credKey(out) === credKey(got) ? "same" : "changed") : undefined,
    tone: worstAuthTone((receiverSide.length ? receiverSide : own).map((e) => e.authStatus)),
  };
}

/**
 * Builds the rows. `steps` is /intent-auth-evidence's list (the checks); `interactions` is the
 * intent's full hop list from /intent-info (payloads, and hops that recorded no checks), so a
 * trail can pass through a hop with no evidence. `name` resolves a DID to a display name.
 */
export function buildDestinationRows(
  steps: AuthEvidenceInteraction[],
  interactions: Interaction[],
  name: (did: string, given?: string) => string,
): DestinationRow[] {
  const stepById = new Map(steps.map((s) => [s.interactionID, s]));
  const ixById = new Map(interactions.map((ix) => [ix.id, ix]));
  const checksOf = (id: string) => stepById.get(id)?.evidence ?? ixById.get(id)?.authEvidence ?? [];

  // Every hop once, in run order: /intent-info's list, plus any only the evidence knows about.
  const ids = [...new Set([...interactions.map((ix) => ix.id), ...steps.map((s) => s.interactionID)])];
  const order = new Map(ids.map((id, k) => [id, k]));
  const fromOf = (id: string) => stepById.get(id)?.from || ixById.get(id)?.initiator.id || "";
  const toOf = (id: string) => stepById.get(id)?.to || ixById.get(id)?.target.id || "";
  const isReply = (id: string) => /response|reply/i.test(ixById.get(id)?.kind || stepById.get(id)?.type || "");

  /** The latest earlier hop on the same branch path that delivered the request to `id`'s sender. */
  const previous = (id: string): string | undefined => {
    const k = order.get(id) ?? 0;
    const branch = parseInteractionId(id)?.branch ?? "";
    const sender = fromOf(id);
    for (let j = k - 1; j >= 0; j--) {
      const cand = ids[j];
      const cb = parseInteractionId(cand)?.branch ?? "";
      if (!isOnPath(cb, branch) || isReply(cand)) continue;
      if (toOf(cand) === sender) return cand;
    }
    return undefined;
  };

  const rows: DestinationRow[] = [];
  for (const id of ids) {
    // The checks of calls this hop's receiver made, grouped by where they went.
    const byDest = new Map<string, AuthEvidence[]>();
    for (const e of checksOf(id)) {
      if (!isOnward(e) || !isOutside(e.destination || "")) continue;
      const d = parseDestination(e.destination);
      const k = d.entity === "web" || d.entity === "local" ? `${d.host}${d.port ? `:${d.port}` : ""}` : d.name;
      byDest.set(k, [...(byDest.get(k) ?? []), e]);
    }
    if (!byDest.size) continue;

    // Back from this hop to the start of the request. Guards against a hop list that loops.
    const trail: TrailLink[] = [];
    const seen = new Set<string>();
    for (let cur: string | undefined = id; cur && !seen.has(cur); cur = previous(cur)) {
      seen.add(cur);
      trail.push(linkOf(stepById.get(cur), ixById.get(cur), checksOf(cur), name));
    }

    const caller = toOf(id);
    for (const [k, list] of byDest) {
      const onward = [...list].sort(byTime);
      const dest = parseDestination(onward[0].destination);
      rows.push({
        key: `${id}|${k}`,
        raw: onward[0].destination,
        dest,
        label: dest.entity === "web" || dest.entity === "local" ? dest.host || dest.raw : dest.name,
        caller,
        callerName: trail[0]?.toName || name(caller),
        onward,
        trail,
        tone: worstAuthTone(onward.map((e) => e.authStatus)),
        at: onward[0].observedAt,
      });
    }
  }
  return rows;
}
