import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Check, ChevronDown, ExternalLink, ShieldAlert, ShieldCheck, ShieldQuestion, X } from "lucide-react";
import type { AuthEvidence, IntentAuthEvidence, ObsPathIntent } from "../../api/observability";
import { useResolveName } from "../../context/DirectoryContext";
import { compareInteractionIds } from "../../lib/interactionBranch";
import { CopyId, fmtDate, fmtDuration, ms, plural, shortId } from "./IntentDetailPanel";

/**
 * Evidence Trail tab of the observability detail box: the auth checks behind each interaction
 * of the picked intent. The trail follows the intent's full chain (from `/intent-info`), so an
 * interaction with no evidence shows as a gap rather than silently missing. Each check is one
 * line (result, where it was observed, method, key version, delay after the interaction) and
 * opens to show every ID it carries.
 * Data: `/intent-auth-evidence`, merged with `loadIntentDetail`.
 */

interface Props {
  intentId: string;
  evidence: IntentAuthEvidence | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  /** The intent's full chain, when loaded, to place interactions that have no evidence. */
  intent: ObsPathIntent | null;
  /** Display name for a DID the payload left unnamed, from the plane's nodes. */
  nameOf: (did: string) => string | undefined;
}

/** One interaction in the trail, with whatever evidence it has. */
interface TrailStep {
  interactionID: string;
  from: string;
  fromName: string;
  to: string;
  toName: string;
  time: string;
  evidence: AuthEvidence[];
}

const passed = (e: AuthEvidence) => e.authStatus?.toLowerCase() === "ok";
/** "server_in" → "Server in". */
const sentence = (s: string) => {
  const t = (s || "").replace(/_/g, " ").trim();
  return t ? t[0].toUpperCase() + t.slice(1) : "—";
};

type View = "all" | "missing" | "failed";

export function EvidencePanel({ intentId, evidence, loading, error, onRetry, intent, nameOf }: Props) {
  const navigate = useNavigate();
  const resolve = useResolveName();
  const [view, setView] = useState<View>("all");
  const name = (did: string, given?: string) => (given && !given.includes("…") ? given : nameOf(did) || resolve(did).name || shortId(did));

  const actions = (
    <div className="ix-actions">
      <button type="button" className="btn primary" onClick={() => navigate(`/intents/${intentId}`)}>
        Open intent <ExternalLink size={13} />
      </button>
    </div>
  );

  if (!evidence) {
    return (
      <section className="ix">
        <div className="ix-verdict pending">
          <div className="ix-verdict-text">
            <ShieldQuestion size={18} strokeWidth={2} />
            <span>{loading ? "Loading evidence…" : error ? "Couldn't load the evidence trail" : "No evidence recorded for this intent"}</span>
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

  // The intent's chain in order, each with its evidence; evidence for an interaction the chain
  // doesn't list (or before the chain loads) is kept, placed by its own ID.
  const byId = new Map(evidence.interactions.map((x) => [x.interactionID, x]));
  const chain = intent?.interactions ?? [];
  const steps: TrailStep[] = chain.map((c) => {
    const ev = byId.get(c.interactionID);
    return {
      interactionID: c.interactionID,
      from: ev?.from || c.from,
      fromName: ev?.fromName || c.fromName,
      to: ev?.to || c.to,
      toName: ev?.toName || c.toName,
      time: ev?.time || c.time,
      evidence: ev?.evidence ?? [],
    };
  });
  const inChain = new Set(chain.map((c) => c.interactionID));
  for (const x of evidence.interactions) if (!inChain.has(x.interactionID)) steps.push({ ...x, evidence: x.evidence ?? [] });
  steps.sort((a, b) => compareInteractionIds(a.interactionID, b.interactionID));

  const total = Math.max(evidence.totalInteractions || 0, steps.length);
  const covered = steps.filter((s) => s.evidence.length > 0).length;
  const missing = total - covered;
  const records = steps.flatMap((s) => s.evidence);
  const failed = records.filter((e) => !passed(e)).length;
  const failedSteps = steps.filter((s) => s.evidence.some((e) => !passed(e))).length;

  const tone = failed > 0 ? "breach" : missing > 0 ? "gap" : "clear";
  const verdict =
    failed > 0
      ? `Auth check failed on ${failedSteps} of ${plural(total, "interaction")}`
      : missing > 0
        ? `Auth evidence for ${covered} of ${plural(total, "interaction")}`
        : `Every interaction passed its auth checks`;


  const numbered = steps.map((s, k) => [s, k + 1] as const);
  const shown =
    view === "missing"
      ? numbered.filter(([s]) => s.evidence.length === 0)
      : view === "failed"
        ? numbered.filter(([s]) => s.evidence.some((e) => !passed(e)))
        : numbered;

  return (
    <section className="ix">
      <div className={`ix-verdict ${tone}`}>
        <div className="ix-verdict-text">
          {tone === "clear" ? <ShieldCheck size={18} strokeWidth={2} /> : tone === "breach" ? <ShieldAlert size={18} strokeWidth={2} /> : <ShieldQuestion size={18} strokeWidth={2} />}
          <span>{verdict}</span>
        </div>
        {actions}
      </div>

      <div className="ix-body">
        <div className="ix-chain-head">
          <h4>
            Evidence trail <span className="ix-count">{steps.length}</span>
          </h4>
          {(missing > 0 || failed > 0) && (
            <div className="seg" role="group" aria-label="Interactions shown">
              <button type="button" className={view === "all" ? "active" : ""} onClick={() => setView("all")}>All</button>
              {failed > 0 && (
                <button type="button" className={view === "failed" ? "active" : ""} onClick={() => setView("failed")}>Failed ({failedSteps})</button>
              )}
              {missing > 0 && (
                <button type="button" className={view === "missing" ? "active" : ""} onClick={() => setView("missing")}>No evidence ({missing})</button>
              )}
            </div>
          )}
        </div>

        {steps.length === 0 ? (
          <div className="ix-empty">No interactions were recorded for this intent.</div>
        ) : (
          <ol className="ix-chain ev-trail">
            {shown.map(([s, n]) => (
              <EvidenceStep key={s.interactionID || n} s={s} n={n} name={name} />
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}

/* ---------------- Pieces ---------------- */

function EvidenceStep({ s, n, name }: { s: TrailStep; n: number; name: (did: string, given?: string) => string }) {
  const none = s.evidence.length === 0;
  const fail = s.evidence.some((e) => !passed(e));
  const self = s.from === s.to;
  return (
    <li className={`ix-step ev-step${none ? " none" : fail ? " fail" : ""}`}>
      <div className="ev-step-row">
        <span className="ix-step-n">{n}</span>
        <div className="ev-step-main">
          <div className="ev-step-head">
            <span className="ix-step-flow">
              <span className="ix-party" title={s.from}>{name(s.from, s.fromName)}</span>
              {!self && (
                <>
                  <ArrowRight size={13} className="ix-arrow" aria-label="to" />
                  <span className="ix-party" title={s.to}>{name(s.to, s.toName)}</span>
                </>
              )}
            </span>
            <span className="ev-step-time" title={s.interactionID}>{fmtDate(s.time)}</span>
          </div>
          {none ? (
            <div className="ev-none">No auth evidence recorded for this interaction</div>
          ) : (
            <ul className="ev-checks">
              {s.evidence.map((e, k) => (
                <EvidenceCheck key={e.requestID || k} e={e} at={s.time} />
              ))}
            </ul>
          )}
        </div>
      </div>
    </li>
  );
}

/** One auth check: its credential, opening to everything else it carries. Also used on the intent page. */
export function EvidenceCheck({ e, at, flat = false }: {
  e: AuthEvidence;
  at: string;
  /** Show the details straight away, without the collapsed credential line (Intent Info, which has its own toggle). */
  flat?: boolean;
}) {
  const [opened, setOpened] = useState(false);
  const open = flat || opened;
  const ok = passed(e);
  const t0 = ms(at);
  const t1 = ms(e.observedAt);
  const delay = t0 != null && t1 != null ? (t1 - t0) / 1000 : null;
  const ids: [string, string][] = (
    [
      ["Credential", e.credentialID],
      ["Identity", e.identityID],
      ["Request", e.requestID],
      ["Run", e.runID],
      ["Destination", e.destination],
    ] as [string, string][]
  ).filter(([, v]) => !!v);
  return (
    <li className={`ev-check${ok ? "" : " fail"}${open ? " open" : ""}${flat ? " flat" : ""}`}>
      {!flat && (
        <button type="button" className="ev-check-line" aria-expanded={open} onClick={() => setOpened((o) => !o)}>
          {/* Collapsed, a check is its credential; a failure still says so. Everything else opens below. */}
          <span className="ev-cred-k">Credential</span>
          <span className="ev-cred-v ix-mono" title={e.credentialID || undefined}>{e.credentialID || "None recorded"}</span>
          {!ok && (
            <span className="ev-result">
              <X size={12} strokeWidth={2.5} />
              {sentence(e.authStatus || "failed")}
            </span>
          )}
          <ChevronDown size={14} className="ev-chev" />
        </button>
      )}
      {open && (
        <dl className="ev-ids">
          <div>
            <dt>Auth status</dt>
            <dd>
              <span className="ev-result">
                {ok ? <Check size={12} strokeWidth={2.5} /> : <X size={12} strokeWidth={2.5} />}
                {ok ? "Passed" : sentence(e.authStatus || "failed")}
              </span>
            </dd>
          </div>
          {e.source && <div><dt>Source</dt><dd><span>{sentence(e.source)}</span></dd></div>}
          {e.authMethod && <div><dt>Auth method</dt><dd><span>{sentence(e.authMethod)}</span></dd></div>}
          {e.keyVersion && <div><dt>Key version</dt><dd><span className="ix-mono">{e.keyVersion}</span></dd></div>}
          {ids.map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>
                <span className="ix-mono" title={v}>{v}</span>
                <CopyId value={v} label={k === "Destination" ? "destination" : `${k.toLowerCase()} ID`} />
              </dd>
            </div>
          ))}
          <div>
            <dt>Observed</dt>
            <dd>
              <span className="ix-mono">{e.observedAt || "—"}</span>
              {delay != null && (
                <span className="ix-muted ix-mono">{delay < 0 ? `${fmtDuration(-delay)} before the interaction` : `+${fmtDuration(delay)} after the interaction`}</span>
              )}
            </dd>
          </div>
        </dl>
      )}
    </li>
  );
}
