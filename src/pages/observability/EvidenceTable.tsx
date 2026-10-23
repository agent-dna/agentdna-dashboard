import { ArrowRight } from "lucide-react";
import { authTone, type AuthEvidence } from "../../api/observability";
import { DestinationLogo } from "../../components/DestinationLogo";
import { parseDestination } from "../../lib/destination";
import { ms, shortId } from "./format";

/**
 * A step's auth checks, split the way the calls happened:
 *  - the interaction itself (from → to): the checks seen as the caller sent it (client_out) and as
 *    the receiver took it in (server_in), in one table;
 *  - onward calls (to → destination): the receiver calling its own backend (server_out), one block
 *    per destination with the credentials the receiver presented there.
 * Each table has a row per check in the order they were seen; the request IDs sit underneath.
 */

/** "server_in" → "Server in". */
const sentence = (s: string) => {
  const t = (s || "").replace(/_/g, " ").trim();
  return t ? t[0].toUpperCase() + t.slice(1) : "";
};

/** "bearer_opaque" → "Bearer", "none" → "None", "api_key" → "API key". */
function loginLabel(m: string): string {
  const s = (m || "").toLowerCase();
  if (!s) return "";
  if (s.startsWith("bearer")) return "Bearer";
  if (s === "api_key" || s === "apikey") return "API key";
  return sentence(s);
}

/** "09:11:42.07": local time to the hundredth of a second; the full date and time go in the tooltip. */
function clockAt(iso: string): { short: string; full: string } | null {
  const t = ms(iso);
  if (t == null) return null;
  const d = new Date(t);
  const p = (n: number) => String(n).padStart(2, "0");
  const short = `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}.${p(Math.floor(d.getMilliseconds() / 10))}`;
  return { short, full: `${d.toLocaleDateString(undefined, { dateStyle: "medium" })}, ${short}` };
}

/** "accepted" → "OK"; anything else as the server sent it. */
const statusLabel = (status: string) => (authTone(status) === "ok" ? "OK" : (status || "unknown").toLowerCase());

const Empty = () => <span className="evt-none" aria-label="None">—</span>;

/* ---------------- Token trail ---------------- */

/** What happened to the credential on a check, across the whole intent. */
export type TokenActivity = "Issued" | "Forwarded" | "Switched";
export interface TokenInfo {
  activity: TokenActivity;
  /** DID of the party holding the token: whoever presented it first. */
  holder: string;
}
/** Every check of an intent that carried a credential ID, with its activity and holder. */
export type TokenTrail = Map<AuthEvidence, TokenInfo>;

/** Within one interaction, checks seen at the same moment go caller-side first. */
const SOURCE_ORDER: Record<string, number> = { client_out: 0, gateway: 1, server_in: 2, server_out: 3 };

/**
 * Follows credentials through an intent, step by step in chain order (and within a step in the
 * order its checks were seen):
 *  - the first credential in the intent is Issued;
 *  - a credential seen earlier in the intent is Forwarded;
 *  - a credential never seen before (after the first) is Switched. That includes a server_in that
 *    differs from its own step's client_out.
 * A token's holder is whoever first presented it: the step's `from` for client_out / gateway /
 * server_in, and its `to` for server_out (the receiver's own call to its destination).
 * Checks without a credential ID can't be followed and are left out.
 */
export function buildTokenTrail(
  steps: { interactionID: string; from: string; to: string }[],
  evidenceOf: Map<string, AuthEvidence[]>,
): TokenTrail {
  const trail: TokenTrail = new Map();
  const holderOf = new Map<string, string>();
  for (const s of steps) {
    const checks = [...(evidenceOf.get(s.interactionID) ?? [])].sort(
      (a, b) =>
        (ms(a.observedAt) ?? 0) - (ms(b.observedAt) ?? 0) ||
        (SOURCE_ORDER[(a.source || "").toLowerCase()] ?? 9) - (SOURCE_ORDER[(b.source || "").toLowerCase()] ?? 9),
    );
    for (const e of checks) {
      const id = e.credentialID;
      if (!id) continue;
      const seen = holderOf.get(id);
      if (seen != null) {
        trail.set(e, { activity: "Forwarded", holder: seen });
        continue;
      }
      const holder = (e.source || "").toLowerCase() === "server_out" ? s.to : s.from;
      trail.set(e, { activity: holderOf.size === 0 ? "Issued" : "Switched", holder });
      holderOf.set(id, holder);
    }
  }
  return trail;
}

/** A step's checks: the interaction's own table, then its onward calls. */
export function StepEvidence({ checks, from, to, name, tokens }: {
  checks: AuthEvidence[];
  /** Display names of the interaction's sender and receiver. */
  from: string;
  to: string;
  name: (did: string) => string;
  /** The intent's token trail, for each check's activity and holder. */
  tokens?: TokenTrail;
}) {
  const direct = checks.filter((e) => e.source !== "server_out");
  // Onward calls grouped by where they went, in the order first seen.
  const onward = new Map<string, AuthEvidence[]>();
  for (const e of checks) {
    if (e.source !== "server_out") continue;
    const key = (e.destination || "").trim();
    onward.set(key, [...(onward.get(key) ?? []), e]);
  }
  return (
    <div className="evs">
      {direct.length > 0 && (
        <section className="evs-block">
          <div className="evs-head">
            <span className="evs-party">{from}</span>
            <ArrowRight size={13} className="evs-arrow" aria-label="to" />
            <span className="evs-party">{to}</span>
            <span className="evs-note">this interaction, as sent and as received</span>
          </div>
          <EvidenceTable checks={direct} tokens={tokens} name={name} to={to} />
        </section>
      )}
      {[...onward.entries()].map(([dest, list]) => {
        const d = dest && !dest.toLowerCase().startsWith("bafy") ? parseDestination(dest) : null;
        return (
          <section key={dest || "unknown"} className="evs-block">
            <div className="evs-head">
              <span className="evs-party">{to}</span>
              <ArrowRight size={13} className="evs-arrow" aria-label="calls" />
              {d ? (
                <span className="evs-dest" title={dest}>
                  <span className="evs-logo"><DestinationLogo entity={d.entity} size={13} /></span>
                  <span className="evs-party">{d.entity === "web" ? d.host : d.name}</span>
                  {(d.method || d.path) && <span className="evs-path">{[d.method, d.path].filter(Boolean).join(" ")}</span>}
                </span>
              ) : (
                <span className="evs-party">{dest ? name(dest) : "Destination not recorded"}</span>
              )}
              <span className="evs-note">onward call, with the credential {to} presented</span>
            </div>
            <EvidenceTable checks={list} tokens={tokens} name={name} to={to} />
          </section>
        );
      })}
    </div>
  );
}

/**
 * One block's checks: who holds the token and whom it acts as, what happened to it in the intent,
 * how the caller authenticated, the key, where it was presented and the result. Where it was
 * seen and where it went are left out: the block's header says who sent it to whom.
 */
export function EvidenceTable({ checks, tokens, name, to }: {
  checks: AuthEvidence[];
  tokens?: TokenTrail;
  /** DID → display name, for the token holder and DID destinations. */
  name: (did: string) => string;
  /** Display name of the interaction's receiver: the destination of its client_out / server_in checks. */
  to: string;
}) {
  // Where the credential was presented: the receiver for client_out / server_in, and the check's
  // own destination for server_out (the receiver's call to its backend).
  const destinationOf = (e: AuthEvidence): { label: string; raw?: string } => {
    if ((e.source || "").toLowerCase() !== "server_out") return { label: to };
    const raw = (e.destination || "").trim();
    if (!raw) return { label: "" };
    if (raw.toLowerCase().startsWith("bafy")) return { label: name(raw), raw };
    const d = parseDestination(raw);
    return { label: d.entity === "web" ? d.host || raw : d.name, raw };
  };
  const rows = [...checks].sort((a, b) => (ms(a.observedAt) ?? 0) - (ms(b.observedAt) ?? 0));
  // When each request was seen: its first check's time (rows are already in that order). Checks
  // without a request ID count on their own, so their time still shows.
  const times: { key: string; iso: string; label: string }[] = [];
  const seenReq = new Set<string>();
  rows.forEach((e, k) => {
    const key = e.requestID || `row${k}`;
    if (seenReq.has(key)) return;
    seenReq.add(key);
    const at = clockAt(e.observedAt);
    if (at && !times.some((x) => x.label === at.full)) times.push({ key, iso: e.observedAt, label: at.full });
  });
  return (
    <div className="evt">
      <div className="evt-scroll">
        <table className="evt-table">
          <thead>
            <tr>
              <th scope="col">Token holder</th>
              <th scope="col">Acting as</th>
              <th scope="col">Token activity</th>
              <th scope="col">Auth method</th>
              <th scope="col">Key</th>
              <th scope="col">Destination</th>
              <th scope="col">Auth status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((e, k) => {
              const tone = authTone(e.authStatus);
              const tok = tokens?.get(e);
              return (
                <tr key={`${e.requestID}:${e.source}:${k}`}>
                  <td title={tok?.holder || undefined}>{tok ? name(tok.holder) : <Empty />}</td>
                  {/* Acting as: the identity the credential carries, i.e. on whose behalf it was used. */}
                  <td className="evt-mono" title={e.identityID || undefined}>{e.identityID ? shortId(e.identityID) : <Empty />}</td>
                  <td>{tok ? <span className={`evt-tok ${tok.activity.toLowerCase()}`}>{tok.activity}</span> : <Empty />}</td>
                  <td>{loginLabel(e.authMethod) || <Empty />}</td>
                  <td
                    className="evt-mono evt-key"
                    title={e.credentialID ? `${e.credentialID}${e.keyVersion ? `\nKey version ${e.keyVersion}` : ""}` : undefined}
                  >
                    {e.credentialID ? shortId(e.credentialID) : <Empty />}
                  </td>
                  {(() => {
                    const d = destinationOf(e);
                    return <td title={d.raw || undefined}>{d.label || <Empty />}</td>;
                  })()}
                  <td className={`evt-status ${tone}`}>{statusLabel(e.authStatus)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {times.length > 0 && (
        <div className="evt-foot">
          {times.map((t) => (
            <time key={t.key} className="evt-req" dateTime={t.iso}>
              {t.label}
            </time>
          ))}
        </div>
      )}
    </div>
  );
}
