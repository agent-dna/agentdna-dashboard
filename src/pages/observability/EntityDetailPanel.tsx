import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "../../components/Icon";
import { useDirectoryUsers } from "../../context/DirectoryContext";
import { useAgent, useToolInfo } from "../../data/hooks";
import { timeAgo } from "../../lib/format";

/**
 * Detail of the user, agent or app picked on the interaction plane, shown in the detail box
 * under the canvas. Users come from the org's `/users-list` (already loaded by the
 * directory); agents and apps from the Agent and Tool pages' `/agent-info` and `/tool-info`.
 */

type Fact = [label: string, value: string, hover?: string];

interface Common {
  did: string;
  /** Name from the plane, shown while the detail loads. */
  name: string;
  /** Column title for the kicker: "USER", "AGENT", "PEER AGENT", "APP". */
  kind: string;
  /** What to pick next on the plane. */
  hint?: string;
  onClose: () => void;
  /** Display name for a DID (e.g. an agent's deployer), from the plane's nodes. */
  nameOf: (did: string) => string | undefined;
}

const shortId = (id: string) => (id.length > 18 ? `${id.slice(0, 8)}…${id.slice(-6)}` : id);
const count = (n: number) => n.toLocaleString();

export function AgentDetailPanel({ did, name, kind, hint, onClose, nameOf }: Common) {
  const { data: agent, loading, error, refetch } = useAgent(did);
  const facts: Fact[] = agent
    ? [
        ["Score", String(agent.score)],
        ["Interactions", count(agent.interactions)],
        ["Threats", count(agent.threats)],
        ["Apps", count(agent.connected), agent.appsList?.join(", ")],
        ["Created", timeAgo(agent.created)],
        ["Deployer", agent.owner ? nameOf(agent.owner) || shortId(agent.owner) : "—", agent.owner],
        ["Policy", agent.policy ? "Uploaded" : "None"],
      ]
    : [];
  return (
    <DetailShell
      kind={kind}
      hint={hint}
      title={agent?.name || name}
      did={did}
      chips={
        agent && (
          <>
            {agent.revoked ? <span className="chip threat">Revoked</span> : <span className="chip safe">Approved</span>}
            {agent.threats > 0 && <span className="chip warn">{count(agent.threats)} threats</span>}
          </>
        )
      }
      facts={facts}
      extra={
        agent?.appsList?.length ? (
          <div className="ip-idet-fact wide">
            <div className="k">Apps used</div>
            <div className="v">{agent.appsList.join(" · ")}</div>
          </div>
        ) : null
      }
      state={loading ? "loading" : error || !agent ? "error" : "ready"}
      onRetry={refetch}
      openLabel="Open agent"
      openPath={`/agents/${encodeURIComponent(did)}`}
      onClose={onClose}
    />
  );
}

const joinedDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

/** The user's /users-list row: name, DID, join date, intents and threats. */
export function UserDetailPanel({ did, name, kind, hint, onClose }: Common) {
  const { users, loading } = useDirectoryUsers();
  const u = users.find((x) => x.userID === did);
  const facts: Fact[] = u
    ? [
        ["Joined", joinedDate(u.createdAt), u.createdAt],
        ["Total intents", count(u.totalIntents)],
        ["Total threats", count(u.totalThreats)],
      ]
    : [];
  return (
    <DetailShell
      kind={kind}
      hint={hint}
      title={u?.userName || name}
      did={did}
      chips={null}
      facts={facts}
      state={u ? "ready" : loading ? "loading" : "missing"}
      openLabel="Open user"
      openPath={`/users/${encodeURIComponent(did)}`}
      onClose={onClose}
    />
  );
}

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
  onClose: () => void;
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
          <button type="button" className="btn ghost" onClick={onClose} aria-label="Clear selection" title="Clear selection (Esc)">
            <Icon name="close" size={14} />
          </button>
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
