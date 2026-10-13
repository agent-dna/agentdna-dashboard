import { useState } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import type { AuthEvidence } from "../../api/observability";
import { CopyId } from "./IntentDetailPanel";
import { fmtDuration, ms } from "./format";

/**
 * One auth check from `/intent-auth-evidence`, as shown under a step's "Credential info" in
 * the chain of custody (observability Intent Info and the intent page's Evidence trail).
 */

const passed = (e: AuthEvidence) => e.authStatus?.toLowerCase() === "ok";
/** "server_in" → "Server in". */
const sentence = (s: string) => {
  const t = (s || "").replace(/_/g, " ").trim();
  return t ? t[0].toUpperCase() + t.slice(1) : "—";
};

/** One auth check: its credential, opening to everything else it carries (or open from the start when `flat`). */
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
