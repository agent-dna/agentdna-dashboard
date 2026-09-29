import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "../../components/Icon";
import { useAgent, useUserInfo } from "../../data/hooks";
import { timeAgo } from "../../lib/format";

/**
 * Detail of the user or agent picked on the interaction plane, shown under the canvas in
 * place of the trace. Data comes from the same endpoints as the User and Agent pages
 * (`/user-info`, `/agent-info`).
 */

type Fact = [label: string, value: string, hover?: string];

interface Common {
  did: string;
  /** Name from the plane, shown while the detail loads. */
  name: string;
  /** Column title for the kicker: "USER", "AGENT", "PEER AGENT". */
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

export function UserDetailPanel({ did, name, kind, hint, onClose }: Common) {
  const { data, loading, error, refetch } = useUserInfo(did);
  const u = data?.user;
  const facts: Fact[] = u
    ? [
        ["Status", u.isActive ? "Active" : "Inactive"],
        ["Last active", u.lastActiveMinsAgo ? timeAgo(u.lastActiveMinsAgo) : "—"],
        ["Joined", timeAgo(u.createdMinsAgo)],
        ["Intents", count(u.totalIntents)],
        ["Interactions", count(u.totalInteractions)],
        ["Threats", count(u.totalThreats)],
        ["Agents accessed", count(u.accessAgentCount)],
        ["Agents deployed", count(u.totalAgentsDeployed)],
      ]
    : [];
  return (
    <DetailShell
      kind={kind}
      hint={hint}
      title={u?.displayName || u?.userName || name}
      did={did}
      chips={
        u && (
          <>
            {u.isActive ? <span className="chip safe">Active</span> : <span className="chip">Inactive</span>}
            {u.totalThreats > 0 && <span className="chip warn">{count(u.totalThreats)} threats</span>}
          </>
        )
      }
      facts={facts}
      state={loading ? "loading" : error || !u ? "error" : "ready"}
      onRetry={refetch}
      openLabel="Open user"
      openPath={`/users/${encodeURIComponent(did)}`}
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
  state: "loading" | "error" | "ready";
  onRetry: () => void;
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
