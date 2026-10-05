import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Check, Copy, ExternalLink, GitBranch, ShieldAlert, ShieldCheck, ShieldQuestion, X } from "lucide-react";
import type { ObsInteraction, ObsPathIntent } from "../../api/observability";
import { useResolveName } from "../../context/DirectoryContext";
import { useDrawer } from "../../context/DrawerContext";
import type { Interaction } from "../../types";

/**
 * Intent Info tab of the observability detail box, laid out for a security review:
 * the verdict first, then who is accountable, what the intent reached and what proves it,
 * then the chain of custody (every interaction in order, with its time from the start and
 * its signature). Clicking a step opens that interaction in the drawer.
 * Data: `loadIntentDetail` (`/intent-info`).
 */

interface Props {
  intentId: string;
  intent: ObsPathIntent | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  /** Shows a close button when given. */
  onClose?: () => void;
  /** Display name for a DID the payload left unnamed (apps usually are), from the plane's nodes. */
  nameOf: (did: string) => string | undefined;
}

const shortId = (id: string) => (id.length > 18 ? `${id.slice(0, 8)}…${id.slice(-6)}` : id);
const isHash = (s: string) => /^[0-9a-f]{40,}$/i.test(s.trim());
const titleCase = (s: string) => s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString()} ${n === 1 ? one : many}`;
const ms = (iso?: string) => {
  const t = iso ? new Date(iso).getTime() : NaN;
  return Number.isNaN(t) ? null : t;
};

function fmtDuration(seconds?: number | null) {
  if (seconds == null || seconds < 0) return "—";
  if (seconds < 1) return `${Math.round(seconds * 1000)}ms`;
  if (seconds < 60) return `${seconds < 10 ? seconds.toFixed(1).replace(/\.0$/, "") : Math.round(seconds)}s`;
  const m = Math.floor(seconds / 60);
  return m < 60 ? `${m}m ${String(Math.round(seconds % 60)).padStart(2, "0")}s` : `${Math.floor(m / 60)}h ${m % 60}m`;
}

function fmtDate(iso?: string) {
  const t = ms(iso);
  return t == null ? "—" : new Date(t).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "medium" });
}

/** Minutes since `t`, the unit the interaction drawer takes. */
const minutesAgo = (t: number | null) => (t == null ? 0 : Math.max(0, Math.round((Date.now() - t) / 60000)));

function fmtAgo(iso?: string) {
  const t = ms(iso);
  if (t == null) return "";
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

const REVIEW_TONE: Record<string, string> = { Flagged: "threat", Acknowledged: "safe" };

export function IntentDetailPanel({ intentId, intent, loading, error, onRetry, onClose, nameOf }: Props) {
  const navigate = useNavigate();
  const { openDrawer } = useDrawer();
  const resolve = useResolveName();
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const name = (did: string, given?: string) => (given && !given.includes("…") ? given : nameOf(did) || resolve(did).name || shortId(did));

  const actions = (
    <div className="ix-actions">
      <button type="button" className="btn" onClick={() => navigate(`/graph/${intentId}`)}>
        <GitBranch size={14} />
        View flow
      </button>
      <button type="button" className="btn primary" onClick={() => navigate(`/intents/${intentId}`)}>
        Open intent <ExternalLink size={13} />
      </button>
      {onClose && (
        <button type="button" className="btn ghost" onClick={onClose} aria-label="Close intent detail" title="Close (Esc)">
          <X size={14} />
        </button>
      )}
    </div>
  );

  if (!intent) {
    return (
      <section className="ix">
        <div className="ix-verdict pending">
          <div className="ix-verdict-text">
            <ShieldQuestion size={18} strokeWidth={2} />
            <span>{loading ? "Loading intent…" : error ? "Couldn't load this intent" : "No detail recorded for this intent"}</span>
          </div>
          {actions}
        </div>
        {error && !loading && (
          <div className="ix-empty">
            {error}.{" "}
            <button type="button" className="btn ghost" onClick={onRetry}>Try again</button>
          </div>
        )}
      </section>
    );
  }

  const steps = intent.interactions ?? [];
  const flagged = steps.filter((s) => s.threat).length;
  const breached = !!intent.threatDetected || flagged > 0;
  const signed = steps.filter((s) => !!s.signature).length;
  const totalIx = intent.interactionsCount ?? steps.length;
  const start = ms(intent.firstInteractionAt ?? intent.startedAt) ?? ms(steps[0]?.time);
  const initiator = intent.initiatorDID ? name(intent.initiatorDID, intent.initiatorName) : intent.initiatorName || "Unknown initiator";

  const verdict = breached
    ? flagged > 0
      ? `Incident detected in ${flagged} of ${plural(totalIx, "interaction")}`
      : "Incident detected"
    : `No incidents across ${plural(totalIx, "interaction")}`;

  // One sentence a reviewer can repeat: who, when, how long, how far it reached.
  const reach = [
    intent.agentsCount != null && plural(intent.agentsCount, "agent"),
    intent.toolsCount != null && plural(intent.toolsCount, "app"),
  ].filter(Boolean);
  const brief = (
    <>
      Started by <strong>{initiator}</strong>
      {intent.firstInteractionAt || intent.startedAt ? ` ${fmtAgo(intent.firstInteractionAt ?? intent.startedAt)}` : ""}
      {intent.runtimeSeconds != null && <>, ran for {fmtDuration(intent.runtimeSeconds)}</>}
      {reach.length > 0 && <> and reached {reach.join(" and ")}</>}.
    </>
  );

  const openStep = (s: ObsInteraction) => {
    const t = ms(s.time);
    const ix: Interaction = {
      id: s.interactionID,
      initiator: { id: s.from, name: name(s.from, s.fromName) },
      target: { id: s.to, name: name(s.to, s.toName) },
      targetType: resolve(s.to).kind === "tool" ? "tool" : "agent",
      intent: { id: intent.id, name: intent.title },
      runtime: 0,
      threat: s.threat,
      created: minutesAgo(t),
      threatID: s.threatID || undefined,
      raw: s.raw,
    };
    openDrawer("interaction", ix);
  };

  const shown = flaggedOnly ? steps.map((s, k) => [s, k] as const).filter(([s]) => s.threat) : steps.map((s, k) => [s, k] as const);

  return (
    <section className="ix">
      <div className={`ix-verdict ${breached ? "breach" : "clear"}`}>
        <div className="ix-verdict-text">
          {breached ? <ShieldAlert size={18} strokeWidth={2} /> : <ShieldCheck size={18} strokeWidth={2} />}
          <span>{verdict}</span>
          {intent.reviewStatus && (
            <span className={`chip ${REVIEW_TONE[intent.reviewStatus] ?? "warn"}`}>Review: {intent.reviewStatus}</span>
          )}
          {intent.status && <span className="chip">{titleCase(intent.status)}</span>}
        </div>
        {actions}
      </div>

      <div className="ix-body">
        <h3 className="ix-title" title={intent.titleFull || intent.title}>
          {intent.titleFull || intent.title || intent.id}
        </h3>
        <p className="ix-brief">{brief}</p>

        <div className="ix-facts">
          <FactGroup heading="Accountability">
            <Fact k="Started by">
              <span title={intent.initiatorDID}>{initiator}</span>
              {intent.initiatorDID && <CopyId value={intent.initiatorDID} label="initiator DID" />}
            </Fact>
            <Fact k="First interaction">{fmtDate(intent.firstInteractionAt ?? intent.startedAt)}</Fact>
            <Fact k="Last interaction">{fmtDate(intent.lastInteractionAt)}</Fact>
          </FactGroup>

          <FactGroup heading="Reach">
            <div className="ix-reach">
              <Figure n={intent.agentsCount} label="Agents" />
              <Figure n={intent.toolsCount} label="Apps" />
              <Figure n={totalIx} label="Interactions" />
              <Figure n={flagged} label="Flagged" tone={flagged > 0 ? "threat" : undefined} />
            </div>
            <Fact k="Runtime">{fmtDuration(intent.runtimeSeconds)}</Fact>
          </FactGroup>

          <FactGroup heading="Evidence">
            <Fact k="Signed interactions">
              <span className={signed === steps.length && steps.length > 0 ? "ix-ok" : "ix-warn"}>
                {steps.length ? `${signed} of ${steps.length}` : "—"}
              </span>
              {steps.length > 0 && (
                <span className="ix-meter" aria-hidden>
                  <span style={{ width: `${(signed / steps.length) * 100}%` }} />
                </span>
              )}
            </Fact>
            <Fact k="Intent ID">
              <span className="ix-mono" title={intent.id}>{shortId(intent.id)}</span>
              <CopyId value={intent.id} label="intent ID" />
            </Fact>
          </FactGroup>
        </div>

        <div className="ix-chain-head">
          <h4>
            Chain of custody <span className="ix-count">{steps.length}</span>
          </h4>
          {flagged > 0 && (
            <div className="seg" role="group" aria-label="Interactions shown">
              <button type="button" className={!flaggedOnly ? "active" : ""} onClick={() => setFlaggedOnly(false)}>All</button>
              <button type="button" className={flaggedOnly ? "active" : ""} onClick={() => setFlaggedOnly(true)}>Flagged ({flagged})</button>
            </div>
          )}
        </div>

        {steps.length === 0 ? (
          <div className="ix-empty">No interactions were recorded for this intent.</div>
        ) : (
          <ol className="ix-chain">
            {shown.map(([s, k]) => (
              <Step key={s.interactionID || k} s={s} n={k + 1} start={start} name={name} onOpen={() => openStep(s)} hideMessage={intent.titleFull || intent.title} />
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}

/* ---------------- Pieces ---------------- */

function FactGroup({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <div className="ix-group">
      <div className="ix-group-h">{heading}</div>
      <dl>{children}</dl>
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

function Figure({ n, label, tone }: { n?: number; label: string; tone?: "threat" }) {
  return (
    <div className={`ix-figure${tone ? ` ${tone}` : ""}`}>
      <span className="v">{n != null ? n.toLocaleString() : "—"}</span>
      <span className="k">{label}</span>
    </div>
  );
}

function CopyId({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () =>
    navigator.clipboard?.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    });
  return (
    <button type="button" className="ix-copy" onClick={copy} title={copied ? "Copied" : `Copy ${label}`} aria-label={`Copy ${label}`}>
      {copied ? <Check size={13} /> : <Copy size={13} />}
    </button>
  );
}

function Step({
  s,
  n,
  start,
  name,
  onOpen,
  hideMessage,
}: {
  s: ObsInteraction;
  n: number;
  start: number | null;
  name: (did: string, given?: string) => string;
  onOpen: () => void;
  /** Hidden when it repeats the intent's title (the trigger's message usually does). */
  hideMessage?: string;
}) {
  const t = ms(s.time);
  const offset = t != null && start != null ? (t - start) / 1000 : null;
  const self = s.from === s.to;
  return (
    <li className={`ix-step${s.threat ? " threat" : ""}`}>
      <button type="button" className="ix-step-btn" onClick={onOpen} title="Open interaction">
        <span className="ix-step-n">{n}</span>
        <span className="ix-step-t" title={fmtDate(s.time)}>
          {offset == null ? "—" : n === 1 || offset <= 0 ? "Start" : `+${fmtDuration(offset)}`}
        </span>
        <span className="ix-step-main">
          <span className="ix-step-flow">
            {/* Delegate / Response labels hidden for now; only the trigger is marked. */}
            {s.type === "trigger" && <span className={`ix-type ${s.type}`}>{titleCase(s.type)}</span>}
            <span className="ix-party" title={s.from}>{name(s.from, s.fromName)}</span>
            {!self && (
              <>
                <ArrowRight size={13} className="ix-arrow" aria-label="to" />
                <span className="ix-party" title={s.to}>{name(s.to, s.toName)}</span>
              </>
            )}
            {s.threat && (
              <span className="chip threat ix-incident" title={s.threatID || undefined}>
                <ShieldAlert size={12} /> Incident{s.threatID ? ` ${shortId(s.threatID)}` : ""}
              </span>
            )}
          </span>
          {s.message && s.message !== hideMessage && (
            <span className={`ix-msg${isHash(s.message) ? " hash" : ""}`} title={s.message}>
              {isHash(s.message) ? `Payload hash ${shortId(s.message)}` : s.message}
            </span>
          )}
        </span>
        <span className={`ix-seal${s.signature ? "" : " missing"}`} title={s.signature || "No signature recorded"}>
          {s.signature ? <ShieldCheck size={14} /> : <ShieldQuestion size={14} />}
          {s.signature ? "Signed" : "Unsigned"}
        </span>
      </button>
    </li>
  );
}
