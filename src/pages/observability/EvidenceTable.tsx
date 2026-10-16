import { authTone, type AuthEvidence } from "../../api/observability";
import { parseDestination } from "../../lib/destination";
import { CopyId } from "./IntentDetailPanel";
import { ms, shortId } from "./format";

/**
 * A step's auth checks as one table, a row per check in the order they were seen: when, where
 * it was observed, how the caller authenticated, the key it presented, the person behind it, where
 * the call went and its auth status. The request IDs the checks share sit underneath.
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

/** "14 Oct 2026, 09:11:42.07": local date and time, to the hundredth of a second. */
function seenAt(iso: string): string {
  const t = ms(iso);
  if (t == null) return iso || "";
  const d = new Date(t);
  const p = (n: number) => String(n).padStart(2, "0");
  const date = d.toLocaleDateString(undefined, { dateStyle: "medium" });
  return `${date}, ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}.${p(Math.floor(d.getMilliseconds() / 10))}`;
}

/** "accepted" → "OK"; anything else as the server sent it. */
const statusLabel = (status: string) => (authTone(status) === "ok" ? "OK" : (status || "unknown").toLowerCase());

const Empty = () => <span className="evt-none" aria-label="None">—</span>;

export function EvidenceTable({ checks, name }: {
  checks: AuthEvidence[];
  /** DID → display name, for checks whose destination is another agent or app. */
  name: (did: string) => string;
}) {
  const rows = [...checks].sort((a, b) => (ms(a.observedAt) ?? 0) - (ms(b.observedAt) ?? 0));
  const requests = [...new Set(rows.map((e) => e.requestID).filter(Boolean))];
  return (
    <div className="evt">
      <div className="evt-scroll">
        <table className="evt-table">
          <thead>
            <tr>
              <th scope="col">Seen at</th>
              <th scope="col">Seen by</th>
              <th scope="col">Auth method</th>
              <th scope="col">Key fingerprint</th>
              <th scope="col">Person</th>
              <th scope="col">Sent to</th>
              <th scope="col">Auth status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((e, k) => {
              const dest = (e.destination || "").trim();
              const isDid = dest.toLowerCase().startsWith("bafy");
              const sentTo = !dest ? "" : isDid ? name(dest) : parseDestination(dest).host || dest;
              const tone = authTone(e.authStatus);
              return (
                <tr key={`${e.requestID}:${e.source}:${k}`}>
                  <td className="evt-mono" title={e.observedAt}>{seenAt(e.observedAt) || <Empty />}</td>
                  <td>{sentence(e.source) || <Empty />}</td>
                  <td>{loginLabel(e.authMethod) || <Empty />}</td>
                  <td className="evt-mono evt-key" title={e.keyVersion ? `Key version ${e.keyVersion}` : undefined}>
                    {e.credentialID || <Empty />}
                  </td>
                  <td className="evt-mono" title={e.identityID || undefined}>{e.identityID ? shortId(e.identityID) : <Empty />}</td>
                  <td className="evt-dest" title={dest || undefined}>{sentTo || <Empty />}</td>
                  <td className={`evt-status ${tone}`}>{statusLabel(e.authStatus)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {requests.length > 0 && (
        <div className="evt-foot">
          {requests.map((r) => (
            <span key={r} className="evt-req" title={r}>
              request {shortId(r)}
              <CopyId value={r} label="request ID" />
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
