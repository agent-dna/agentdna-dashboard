import { useNavigate } from "react-router-dom";
import { Icon } from "../../components/Icon";
import type { ObsInteraction, ObsPathIntent } from "../../api/observability";
import { ago } from "./planeModel";

/**
 * Detail of the intent picked on the interaction plane, shown under the canvas: what it
 * was, who ran it, and every interaction in its chain. Data: `loadIntentDetail`.
 */

interface Props {
  intentId: string;
  intent: ObsPathIntent | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onClose: () => void;
  /** Display name for a DID the payload left unnamed (apps usually are), from the plane's nodes. */
  nameOf: (did: string) => string | undefined;
}

const shortId = (id: string) => (id.length > 18 ? `${id.slice(0, 8)}…${id.slice(-6)}` : id);
const isHash = (s: string) => /^[0-9a-f]{40,}$/i.test(s.trim());
const titleCase = (s: string) => s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

function fmtRuntime(seconds?: number) {
  if (seconds == null) return "—";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const m = Math.floor(seconds / 60);
  return m < 60 ? `${m}m ${Math.round(seconds % 60)}s` : `${Math.floor(m / 60)}h ${m % 60}m`;
}

function fmtTime(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const rel = ago(iso);
  return `${d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "medium" })} · ${rel === "just now" ? rel : `${rel} ago`}`;
}

const TYPE_CHIP: Record<string, string> = { trigger: "info", delegate: "purple", response: "" };

export function IntentDetailPanel({ intentId, intent, loading, error, onRetry, onClose, nameOf }: Props) {
  const navigate = useNavigate();
  const name = (did: string, given?: string) => given || nameOf(did) || shortId(did);

  const head = (
    <div className="ip-idet-head">
      <div style={{ minWidth: 0 }}>
        <div className="ip-kicker">INTENT DETAIL</div>
        <div className="ip-idet-title">{intent ? intent.titleFull || intent.title || intent.id : loading ? "Loading intent…" : "Intent"}</div>
        {intent && (
          <div className="ip-idet-chips">
            {intent.threatDetected || intent.interactions?.some((ix) => ix.threat) ? <span className="chip threat">Incident detected</span> : <span className="chip safe">No incidents</span>}
            {intent.status && <span className="chip info">{titleCase(intent.status)}</span>}
            {intent.reviewStatus && (
              <span className={`chip ${intent.reviewStatus === "Flagged" ? "threat" : intent.reviewStatus === "Acknowledged" ? "safe" : "warn"}`}>
                Review · {intent.reviewStatus}
              </span>
            )}
          </div>
        )}
      </div>
      <div className="ip-idet-actions">
        <button type="button" className="btn" onClick={() => navigate(`/graph/${intentId}`)}>
          <Icon name="flow" size={14} />
          View flow
        </button>
        <button type="button" className="btn primary" onClick={() => navigate(`/intents/${intentId}`)}>
          Inspect
        </button>
        <button type="button" className="btn ghost" onClick={onClose} aria-label="Close intent detail" title="Close (Esc)">
          <Icon name="close" size={14} />
        </button>
      </div>
    </div>
  );

  if (!intent) {
    return (
      <section className="ip-idet">
        {head}
        <div className="ip-empty">
          {loading ? (
            "Loading intent…"
          ) : error ? (
            <>
              Couldn't load this intent: {error}{" "}
              <button type="button" className="btn ghost" onClick={onRetry}>Retry</button>
            </>
          ) : (
            "No detail for this intent."
          )}
        </div>
      </section>
    );
  }

  const interactions = intent.interactions ?? [];
  const facts: [string, string, string?][] = [
    ["Initiator", intent.initiatorDID ? name(intent.initiatorDID, intent.initiatorName) : intent.initiatorName || "—", intent.initiatorDID],
    ["Executor", intent.executor ? name(intent.executor) : "—", intent.executor],
    ["Flow type", intent.flowType ? titleCase(intent.flowType) : "—"],
    ["Chain depth", intent.chainDepth != null ? String(intent.chainDepth) : "—"],
    ["Agents", intent.agentsCount != null ? String(intent.agentsCount) : "—"],
    ["Apps", intent.toolsCount != null ? String(intent.toolsCount) : "—"],
    ["Interactions", String(intent.interactionsCount ?? interactions.length)],
    ["Runtime", fmtRuntime(intent.runtimeSeconds)],
    ["Started", fmtTime(intent.startedAt ?? intent.firstInteractionAt)],
    ["Last interaction", fmtTime(intent.lastInteractionAt)],
  ];

  return (
    <section className="ip-idet">
      {head}

      <div className="ip-idet-facts">
        {facts.map(([k, v, did]) => (
          <div key={k} className="ip-idet-fact">
            <div className="k">{k}</div>
            <div className="v" title={did}>{v}</div>
          </div>
        ))}
        <div className="ip-idet-fact wide">
          <div className="k">Intent ID</div>
          <div className="v mono">{intent.id}</div>
        </div>
        {intent.provenanceRecordID && (
          <div className="ip-idet-fact wide">
            <div className="k">Provenance record</div>
            <div className="v mono">{intent.provenanceRecordID}</div>
          </div>
        )}
      </div>

      <div className="ip-idet-sub">Interactions · {interactions.length}</div>
      {interactions.length === 0 ? (
        <div className="ip-empty">No interactions recorded for this intent.</div>
      ) : (
        <div className="timeline">
          {interactions.map((ix, k) => (
            <InteractionItem key={ix.interactionID || k} ix={ix} n={k + 1} name={name} />
          ))}
        </div>
      )}
    </section>
  );
}

function InteractionItem({ ix, n, name }: { ix: ObsInteraction; n: number; name: (did: string, given?: string) => string }) {
  const self = ix.from === ix.to;
  return (
    <div className={`tl-item${ix.threat ? " threat" : ""}`}>
      <div className="dot" />
      <div className="line" />
      <div className="body">
        <div className="nm ip-idet-hop">
          <span className="ip-mono ip-faint">#{n}</span>
          {ix.type && <span className={`chip ${TYPE_CHIP[ix.type] ?? ""}`}>{titleCase(ix.type)}</span>}
          <span title={ix.from}>{name(ix.from, ix.fromName)}</span>
          {!self && (
            <>
              <span style={{ color: "var(--fg-muted)" }}>→</span>
              <span title={ix.to}>{name(ix.to, ix.toName)}</span>
            </>
          )}
          {ix.threat && <span className="chip threat">Incident</span>}
        </div>
        {ix.message && (
          <div className={`ip-idet-msg${isHash(ix.message) ? " hash" : ""}`} title={ix.message}>
            {isHash(ix.message) ? `Payload hash · ${shortId(ix.message)}` : ix.message}
          </div>
        )}
        {ix.signature && (
          <div className="desc" title={ix.signature}>
            sig {shortId(ix.signature)}
          </div>
        )}
      </div>
      <div className="ts" title={ix.time}>{fmtTime(ix.time).split(" · ")[1]}</div>
    </div>
  );
}
