import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "../../components/Icon";
import { useToolInfo } from "../../data/hooks";

/**
 * Detail of the app picked on the interaction plane (Application Info tab of the detail
 * box). Data: the Tool page's `/tool-info`.
 */

type Fact = [label: string, value: string, hover?: string];

interface Common {
  did: string;
  /** Name from the plane, shown while the detail loads. */
  name: string;
  /** Column title for the kicker, e.g. "APP". */
  kind: string;
  /** What to pick next on the plane. */
  hint?: string;
  /** Shows a close button when given. */
  onClose?: () => void;
}

const count = (n: number) => n.toLocaleString();

export function AppDetailPanel({ did, name, kind, hint, onClose }: Common) {
  const { data, loading, error, refetch } = useToolInfo(did);
  const t = data?.tool;
  const facts: Fact[] = t
    ? [
        ["Score", String(t.score)],
        ["Interactions", count(t.totalInteractions)],
        ["Intents", count(t.totalIntents)],
        ["Agents", count(t.totalAgents)],
        ["Threats", count(t.totalThreats)],
      ]
    : [];
  return (
    <DetailShell
      kind={kind}
      hint={hint}
      title={t?.name || name}
      did={did}
      chips={t && t.totalThreats > 0 && <span className="chip warn">{count(t.totalThreats)} threats</span>}
      facts={facts}
      state={loading ? "loading" : error || !t ? "error" : "ready"}
      onRetry={refetch}
      openLabel="Open app"
      openPath={`/tools/${encodeURIComponent(did)}`}
      onClose={onClose}
    />
  );
}

function DetailShell({
  kind,
  hint,
  title,
  did,
  chips,
  facts,
  extra,
  state,
  onRetry,
  openLabel,
  openPath,
  onClose,
}: {
  kind: string;
  hint?: string;
  title: string;
  did: string;
  chips: ReactNode;
  facts: Fact[];
  extra?: ReactNode;
  /** "missing": loaded, but the record isn't there (nothing to retry). */
  state: "loading" | "error" | "missing" | "ready";
  onRetry?: () => void;
  openLabel: string;
  openPath: string;
  onClose?: () => void;
}) {
  const navigate = useNavigate();
  return (
    <section className="ip-idet">
      <div className="ip-idet-head">
        <div style={{ minWidth: 0 }}>
          <div className="ip-kicker">
            {kind} DETAIL
            {hint && <span className="ip-trace-next ip-idet-hint">{hint}</span>}
          </div>
          <div className="ip-idet-title">{title}</div>
          {chips && <div className="ip-idet-chips">{chips}</div>}
        </div>
        <div className="ip-idet-actions">
          <button type="button" className="btn primary" onClick={() => navigate(openPath)}>
            {openLabel}
          </button>
          {onClose && (
            <button type="button" className="btn ghost" onClick={onClose} aria-label="Clear selection" title="Clear selection (Esc)">
              <Icon name="close" size={14} />
            </button>
          )}
        </div>
      </div>
      {state === "ready" ? (
        <div className="ip-idet-facts">
          {facts.map(([k, v, hover]) => (
            <div key={k} className="ip-idet-fact">
              <div className="k">{k}</div>
              <div className="v" title={hover}>{v}</div>
            </div>
          ))}
          <div className="ip-idet-fact wide">
            <div className="k">DID</div>
            <div className="v mono">{did}</div>
          </div>
          {extra}
        </div>
      ) : (
        <div className="ip-empty">
          {state === "loading" ? (
            "Loading details…"
          ) : state === "missing" ? (
            "No details found for this DID."
          ) : (
            <>
              Couldn't load details.{" "}
              <button type="button" className="btn ghost" onClick={onRetry}>Retry</button>
            </>
          )}
        </div>
      )}
    </section>
  );
}
