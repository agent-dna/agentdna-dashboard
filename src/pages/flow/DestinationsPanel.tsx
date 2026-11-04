import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { KeyRound } from "lucide-react";
import { authStatusLabel, authTone, worstAuthTone, type AuthTone } from "../../api/observability";
import { DestinationLogo } from "../../components/DestinationLogo";
import { authMethodLabel } from "../../lib/credFormat";
import { credentialPath } from "../../lib/resource";
import { CopyId } from "../observability/IntentDetailPanel";
import { fmtDate } from "../observability/format";
import { destinationNodeId, pad2, type TraceHop, type TraceModel, type TraceNode } from "./traceModel";

/**
 * The Destinations tab of the box under the flow graph: every outside service this intent's auth
 * checks went to, one card each in the Intent Info key–value style: where it is, who called it
 * (with the hops) and when, beside the credentials presented to it. Rows the selected hop reached are marked. Built from the
 * trace on screen; nothing is fetched.
 */

interface DestCredential {
  /** "" when the check carried no credential. */
  credentialID: string;
  authMethod: string;
  tone: AuthTone;
  /** The worst status seen, as a label. */
  status: string;
}

interface Destination {
  node: TraceNode;
  hops: number[];
  callers: { id: string; name: string; kind: TraceNode["kind"] | undefined; hops: number[] }[];
  credentials: DestCredential[];
  firstSeen: string;
  lastSeen: string;
}

const STATUS_RANK: Record<AuthTone, number> = { ok: 0, warn: 1, bad: 2 };
/** Auth tones in the profile panels' pill colors. */
const PILL: Record<AuthTone, "safe" | "warn" | "threat"> = { ok: "safe", warn: "warn", bad: "threat" };

const sortNums = (s: Set<number>) => [...s].sort((a, b) => a - b);

function buildDestinations(model: TraceModel): Destination[] {
  type Acc = {
    hops: Set<number>;
    callers: Map<string, Set<number>>;
    creds: Map<string, { authMethod: string; statuses: string[] }>;
    times: string[];
  };
  const byId = new Map<string, Acc>();
  const order: string[] = [];

  for (const h of model.hops) {
    // Only the receiver's server_out checks reach a destination, and the receiver is the caller.
    for (const c of h.onward) {
      const at = destinationNodeId(c.destination);
      if (!at) continue;
      let d = byId.get(at.id);
      if (!d) {
        d = { hops: new Set(), callers: new Map(), creds: new Map(), times: [] };
        byId.set(at.id, d);
        order.push(at.id);
      }
      d.hops.add(h.n);
      const callerHops = d.callers.get(h.dst) ?? new Set<number>();
      callerHops.add(h.n);
      d.callers.set(h.dst, callerHops);
      const t = c.observedAt || h.time;
      if (t) d.times.push(t);
      const cr = d.creds.get(c.credentialID || "") ?? { authMethod: "", statuses: [] };
      cr.authMethod = cr.authMethod || c.authMethod;
      cr.statuses.push(c.authStatus);
      d.creds.set(c.credentialID || "", cr);
    }
  }

  return order.flatMap((id) => {
    const node = model.nodeById.get(id);
    const d = byId.get(id)!;
    if (!node) return [];
    const times = [...d.times].sort((a, b) => Date.parse(a) - Date.parse(b));
    const credentials = [...d.creds.entries()]
      .map(([credentialID, c]) => {
        // The worst status seen, so a rejection is never hidden behind an acceptance.
        const worst = c.statuses.reduce((w, s) => (STATUS_RANK[authTone(s)] > STATUS_RANK[authTone(w)] ? s : w), c.statuses[0]);
        return { credentialID, authMethod: c.authMethod, tone: worstAuthTone(c.statuses), status: authStatusLabel(worst) };
      })
      // Real credentials first, worst first; "no credential" last.
      .sort((a, b) => Number(!a.credentialID) - Number(!b.credentialID) || STATUS_RANK[b.tone] - STATUS_RANK[a.tone]);
    return [
      {
        node,
        hops: sortNums(d.hops),
        callers: [...d.callers.entries()].map(([cid, hs]) => {
          const n = model.nodeById.get(cid);
          return { id: cid, name: n?.name ?? cid, kind: n?.kind, hops: sortNums(hs) };
        }),
        credentials,
        firstSeen: times[0] ?? "",
        lastSeen: times[times.length - 1] ?? "",
      },
    ];
  });
}

const shortId = (s: string) => (s.length > 22 ? `${s.slice(0, 10)}…${s.slice(-6)}` : s);

export function DestinationsPanel({
  model,
  hop,
  onSelectHop,
}: {
  model: TraceModel;
  /** The selected hop: the destinations it reached are marked. */
  hop: TraceHop | undefined;
  onSelectHop: (n: number) => void;
}) {
  const navigate = useNavigate();
  const list = buildDestinations(model);

  if (list.length === 0) {
    return <div className="ip-empty">This intent didn’t call any outside service.</div>;
  }

  const reached = new Set(hop?.outside ?? []);
  const hopChip = (n: number) => (
    <button
      key={n}
      type="button"
      className={`fd-hop${hop?.n === n ? " on" : ""}`}
      onClick={() => onSelectHop(n)}
      title={`Select hop ${pad2(n)}`}
    >
      {pad2(n)}
    </button>
  );

  return (
    <div className="ip-pf fd-pf">
      <div className="ip-pf-section fd-section">
        Destinations<span className="ip-pf-count">{list.length}</span>
      </div>
      <div className="fd-cards">
        {list.map((d) => {
          const on = reached.has(d.node.id);
          return (
            <div key={d.node.id} className={`ix-facts fd-card${on ? " on" : ""}`} aria-current={on ? "true" : undefined}>
              <div className="ix-group">
                <div className="ix-group-h fd-card-h">
                  <span className="fd-logo">{d.node.dest && <DestinationLogo entity={d.node.dest.entity} size={14} />}</span>
                  <span className="fd-name" title={d.node.name}>{d.node.name}</span>
                </div>
                <dl>
                  <Fact k="Host">
                    <span className="fd-mono" title={d.node.ident}>{d.node.ident}</span>
                    <CopyId value={d.node.ident} label="host" />
                  </Fact>
                  <Fact k="Called by">
                    <span className="fd-callers">
                      {d.callers.map((c) => (
                        <span key={c.id} className="fd-caller">
                          <span className="fd-caller-name" title={c.name}>{c.name}</span>
                          {c.hops.map(hopChip)}
                        </span>
                      ))}
                    </span>
                  </Fact>
                  {d.firstSeen && <Fact k={d.lastSeen && d.lastSeen !== d.firstSeen ? "First call" : "Called"}>{fmtDate(d.firstSeen)}</Fact>}
                  {d.lastSeen && d.lastSeen !== d.firstSeen && <Fact k="Last call">{fmtDate(d.lastSeen)}</Fact>}
                </dl>
              </div>

              <div className="ix-group">
                <div className="ix-group-h">
                  Credentials used<span className="ip-pf-count">{d.credentials.filter((c) => c.credentialID).length}</span>
                </div>
                <dl>
                  {d.credentials.map((c) => (
                    <div key={c.credentialID || "none"} className="ix-fact">
                      <dt>
                        {c.credentialID ? (
                          <button type="button" className="fd-cred-id" title={`Open credential ${c.credentialID}`} onClick={() => navigate(credentialPath(c.credentialID))}>
                            <KeyRound size={12} strokeWidth={1.9} aria-hidden />
                            {shortId(c.credentialID)}
                          </button>
                        ) : (
                          "No credential"
                        )}
                      </dt>
                      <dd>
                        <span>{c.credentialID ? authMethodLabel(c.authMethod) || "Method not reported" : "None presented"}</span>
                        <span className={`fd-status ${PILL[c.tone]}`}>{c.status}</span>
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Fact({ k, children }: { k: string; children: ReactNode }) {
  return (
    <div className="ix-fact">
      <dt>{k}</dt>
      <dd>{children}</dd>
    </div>
  );
}
