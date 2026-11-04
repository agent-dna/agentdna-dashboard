import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Check, ChevronDown, Copy, ExternalLink, KeyRound, PanelRightOpen, GitBranch, ShieldAlert, ShieldCheck, ShieldQuestion, X } from "lucide-react";
import { worstAuthTone, type AuthEvidence, type IntentAuthEvidence, type ObsInteraction, type ObsPathIntent } from "../../api/observability";
import { StepEvidence, buildTokenTrail, type TokenTrail } from "./EvidenceTable";
import { DestinationLogo } from "../../components/DestinationLogo";
import { parseDestination, type ParsedDestination } from "../../lib/destination";
import { fmtDate, fmtDuration, ms, plural, shortId } from "./format";
import { useResolveName } from "../../context/DirectoryContext";
import { useDrawer } from "../../context/DrawerContext";
import type { Interaction } from "../../types";

/**
 * Intent Info tab of the observability detail box, laid out for a security review:
 * the verdict first, then who is accountable, what the intent reached and what proves it,
 * then the chain of custody (every interaction in order, with its time from the start and
 * its signature). Clicking a step opens that interaction in the drawer; "Credential info" at a
 * step's right opens its auth checks under it, as the Evidence Trail tab shows them.
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
  /** `/intent-auth-evidence`, when loaded: each step with evidence gets "Credential info". */
  evidence?: IntentAuthEvidence | null;
  /** Shows "View flow"; off on the flow page itself. Defaults to true. */
  showFlowLink?: boolean;
}

const isHash = (s: string) => /^[0-9a-f]{40,}$/i.test(s.trim());
const titleCase = (s: string) => s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

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

export function IntentDetailPanel({ intentId, intent, loading, error, onRetry, onClose, nameOf, evidence, showFlowLink = true }: Props) {
  const navigate = useNavigate();
  const resolve = useResolveName();
  const name = (did: string, given?: string) => (given && !given.includes("…") ? given : nameOf(did) || resolve(did).name || shortId(did));

  const actions = (
    <div className="ix-actions">
      {showFlowLink && (
        <button type="button" className="btn" onClick={() => navigate(`/graph/${intentId}`)}>
          <GitBranch size={14} />
          View flow
        </button>
      )}
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
  const totalIx = intent.interactionsCount ?? steps.length;
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
        </div>

        <CustodyChain intent={intent} name={name} evidence={evidence} />
      </div>
    </section>
  );
}

/* ---------------- Pieces ---------------- */

/**
 * The chain of custody: every interaction in order, with its time from the start, and
 * "Credential info" for its auth checks when there are any. Clicking a step opens that
 * interaction in the drawer. Shared by this panel and the intent page's Evidence trail tab.
 */
export function CustodyChain({
  intent,
  name,
  evidence,
  viewMore = false,
}: {
  intent: ObsPathIntent;
  name: (did: string, given?: string) => string;
  evidence?: IntentAuthEvidence | null;
  /** Adds "View more" to every step, opening it in the drawer (the intent page). */
  viewMore?: boolean;
}) {
  const { openDrawer } = useDrawer();
  const resolve = useResolveName();
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const steps = intent.interactions ?? [];
  const flagged = steps.filter((s) => s.threat).length;
  const start = ms(intent.firstInteractionAt ?? intent.startedAt) ?? ms(steps[0]?.time);

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
      ...(s.message ? { payload: s.message } : {}),
      ...(s.backendCalls ? { backendCalls: s.backendCalls } : {}),
    };
    openDrawer("interaction", ix);
  };

  const evidenceOf = new Map((evidence?.interactions ?? []).map((x) => [x.interactionID, x.evidence ?? []]));
  // Followed across the whole chain, so each check knows if its token was issued, forwarded or switched.
  const tokens = buildTokenTrail(steps, evidenceOf);
  const shown = flaggedOnly ? steps.map((s, k) => [s, k] as const).filter(([s]) => s.threat) : steps.map((s, k) => [s, k] as const);

  return (
    <>
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
            <Step key={s.interactionID || k} s={s} n={k + 1} start={start} name={name} onOpen={() => openStep(s)} evidence={evidenceOf.get(s.interactionID)} tokens={tokens} viewMore={viewMore} />
          ))}
        </ol>
      )}
    </>
  );
}

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

export function CopyId({ value, label }: { value: string; label: string }) {
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

/**
 * Where a step's receiver went next: the destinations of its server_out checks (the credential the
 * receiver used on its own backend), in the order first seen. Other sources never count: their
 * `destination` is just the receiver itself.
 */
function onwardDestinations(evidence: AuthEvidence[] | undefined): string[] {
  const out: string[] = [];
  for (const e of evidence ?? []) {
    if ((e.source || "").toLowerCase() !== "server_out") continue;
    const d = (e.destination || "").trim();
    if (d && !out.includes(d)) out.push(d);
  }
  return out;
}

/** A destination as the chain names it: a known service's name, else its host; a DID, its owner's name. */
function destinationLabel(raw: string, name: (did: string) => string): { label: string; dest: ParsedDestination | null } {
  if (raw.toLowerCase().startsWith("bafy")) return { label: name(raw), dest: null };
  const dest = parseDestination(raw);
  return { label: dest.entity === "web" ? dest.host || raw : dest.name, dest };
}

function Step({
  s,
  n,
  start,
  name,
  onOpen,
  evidence,
  tokens,
  viewMore = false,
}: {
  s: ObsInteraction;
  n: number;
  start: number | null;
  name: (did: string, given?: string) => string;
  onOpen: () => void;
  /** This step's auth checks; none or not loaded hides "Credential info". */
  evidence?: AuthEvidence[];
  /** The intent's token trail (issued / forwarded / switched, and who holds each token). */
  tokens?: TokenTrail;
  /** Shows "View more" (opens the interaction in the drawer, as clicking the step does). */
  viewMore?: boolean;
}) {
  const [credOpen, setCredOpen] = useState(false);
  const hasCred = !!evidence && evidence.length > 0;
  /** The worst of this step's checks: red if any was rejected, yellow if any wasn't seen. */
  const credTone = hasCred ? worstAuthTone(evidence.map((e) => e.authStatus)) : "ok";
  const t = ms(s.time);
  const offset = t != null && start != null ? (t - start) / 1000 : null;
  const self = s.from === s.to;
  // from → to → destination when the receiver made an onward (server_out) call; from → destination
  // when from and to are the same party.
  const onward = onwardDestinations(evidence);
  const firstDest = onward.length ? destinationLabel(onward[0], (did) => name(did)) : null;
  return (
    <li className={`ix-step${s.threat ? " threat" : ""}`}>
      {/* The step and its actions side by side, the actions centred on the step. */}
      <div className="ix-step-row">
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
              {firstDest && (
                <>
                  <ArrowRight size={13} className="ix-arrow" aria-label="then to" />
                  <span className="ix-party ix-dest" title={onward[0]}>
                    {firstDest.dest && (
                      <span className="ix-dest-logo"><DestinationLogo entity={firstDest.dest.entity} size={12} /></span>
                    )}
                    {firstDest.label}
                  </span>
                  {onward.length > 1 && (
                    <span className="ix-dest-more" title={onward.slice(1).map((d) => destinationLabel(d, (did) => name(did)).label).join(", ")}>
                      +{onward.length - 1}
                    </span>
                  )}
                </>
              )}
            </span>
            {/* Every hop shows its payload, the trigger included. */}
            {s.message && (
              <span className={`ix-msg${isHash(s.message) ? " hash" : ""}`} title={s.message}>
                {isHash(s.message) ? `Payload hash ${shortId(s.message)}` : s.message}
              </span>
            )}
          </span>
        </button>
        {(hasCred || viewMore) && (
          <div className="ix-step-actions" role="group" aria-label={`Interaction ${n}`}>
            {hasCred && (
              <button
                type="button"
                className={`ix-act ix-act-cred${credOpen ? " open" : ""}${credTone === "bad" ? " fail" : credTone === "warn" ? " warn" : ""}`}
                aria-expanded={credOpen}
                onClick={() => setCredOpen((o) => !o)}
                title={credTone === "bad" ? "An auth check was rejected" : credTone === "warn" ? "An auth check wasn't seen" : undefined}
              >
                <KeyRound size={13} />
                <span className="ix-act-label">Credential info</span>
                <ChevronDown size={13} className="ix-act-chev" />
              </button>
            )}
            {viewMore && (
              <button type="button" className="ix-act ix-act-more" onClick={onOpen}>
                <PanelRightOpen size={13} />
                View more
              </button>
            )}
          </div>
        )}
      </div>
      {hasCred && credOpen && (
        <div className="ix-cred">
          <StepEvidence checks={evidence} from={name(s.from, s.fromName)} to={name(s.to, s.toName)} name={(did) => name(did)} tokens={tokens} />
        </div>
      )}
    </li>
  );
}
