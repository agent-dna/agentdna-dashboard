import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Icon } from "../components/Icon";
import { MetricTile } from "../components/MetricTile";
import { AppIcon } from "../components/AppIcon";
import { InfoStat } from "../components/InfoStat";
import { LedgerTable } from "../components/LedgerTable";
import { Pagination } from "../components/Pagination";
import { ViewToolPolicyModal } from "../components/forms/ViewToolPolicyModal";
import { useAgent, useAgentToolInfo } from "../data/hooks";
import { useDrawer } from "../context/DrawerContext";
import { timeAgo } from "../lib/format";

export function AgentToolDetailPage() {
  const { agentId = "", toolId = "" } = useParams<{ agentId: string; toolId: string }>();
  const navigate = useNavigate();
  const { openDrawer } = useDrawer();

  const [interactionsPage, setInteractionsPage] = useState(1);
  const [policyOpen, setPolicyOpen] = useState(false);

  const { data: agent } = useAgent(agentId);
  const { data: result, loading } = useAgentToolInfo(agentId, toolId, interactionsPage);

  const backCrumb = (
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 14, fontSize: 13 }}>
      <button className="btn ghost" style={{ padding: "4px 8px", fontSize: 12.5 }} onClick={() => navigate(`/agents/${agentId}`)}>
        <Icon name="arrowRight" size={12} style={{ transform: "rotate(180deg)" }} /> {agent?.name || "Agent"}
      </button>
      <span style={{ color: "var(--fg-faint)" }}>/</span>
      <span style={{ color: "var(--fg-muted)", fontFamily: "var(--font-mono)", fontSize: 12 }}>{toolId}</span>
    </div>
  );

  if (loading) {
    return (
      <div className="page">
        <div className="stub"><h2>Loading…</h2></div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="page">
        {backCrumb}
        <div className="stub">
          <h2>No details yet</h2>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, marginTop: 6, color: "var(--fg-muted)" }}>{toolId}</div>
          <button className="btn" style={{ marginTop: 16 }} onClick={() => navigate(`/agents/${agentId}`)}>
            <Icon name="arrowRight" size={14} style={{ transform: "rotate(180deg)" }} /> Back to agent
          </button>
        </div>

        <div className="card" style={{ marginTop: 20, padding: "28px 28px" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(37,99,235,0.08)", border: "1px solid rgba(37,99,235,0.16)", display: "grid", placeItems: "center", flexShrink: 0 }}>
              <Icon name="activity" size={18} style={{ color: "var(--accent)" }} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--fg)", marginBottom: 4 }}>API endpoint required</div>
              <div style={{ fontSize: 13, color: "var(--fg-muted)", lineHeight: 1.6, maxWidth: 520 }}>
                This page is scaffolded and ready. Once{" "}
                <code style={{ fontFamily: "var(--font-mono)", fontSize: 12, background: "var(--surface-raised)", padding: "1px 5px", borderRadius: 4 }}>
                  GET /dashboard/v1/agent-tool-info
                </code>{" "}
                is live, the trust score, policy file, and this agent's full interaction history with{" "}
                {toolId} will appear here.
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const { toolName, trustScore, policyFile, lastInteracted, interactions, interactionsTotal, interactionsTotalPages } = result;

  return (
    <div className="page">
      {backCrumb}

      <div className="card" style={{ padding: "24px 28px", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 20 }}>
          <AppIcon name={toolName} size={64} />

          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <h1 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 600, letterSpacing: "-0.02em", color: "var(--fg)" }}>
                {toolName}
              </h1>
              <span className="chip info" style={{ fontSize: 10.5, padding: "2px 7px" }}>app</span>
            </div>
            <div style={{ color: "var(--fg-muted)", fontSize: 13, marginBottom: 16 }}>
              As interacted with by <strong style={{ color: "var(--fg)" }}>{agent?.name || agentId}</strong>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24, borderTop: "1px solid var(--line)", paddingTop: 16 }}>
              <InfoStat label="Trust Score" value={trustScore} mono />
              <InfoStat label="Last interacted" value={timeAgo(lastInteracted)} />
              <InfoStat label="Interactions" value={interactionsTotal} mono />
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <button className="btn" onClick={() => setPolicyOpen(true)}>
              <Icon name="eye" size={14} />
              View policy
            </button>
          </div>
        </div>
      </div>

      <div className="metrics">
        <MetricTile label="Trust Score" value={trustScore} unit="/ 100" icon="target" sparkColor="#2563EB" spark={[]} />
        <MetricTile label="Interactions" value={interactionsTotal.toLocaleString()} icon="activity" sparkColor="#0EA5E9" spark={[]} />
      </div>

      <div className="card">
        <div className="tb-toolbar">
          <div className="filters">
            <div className="tab active">
              Interactions
              <span className="pill">{interactionsTotal}</span>
            </div>
          </div>
          <Pagination
            page={interactionsPage}
            totalPages={interactionsTotalPages}
            total={interactionsTotal}
            pageSize={10}
            inline
            onChange={setInteractionsPage}
          />
        </div>
        <LedgerTable
          rows={interactions}
          emptyText="No interactions yet."
          onView={(r) => openDrawer("interaction", r)}
        />
      </div>

      <ViewToolPolicyModal
        open={policyOpen}
        toolName={toolName}
        agentName={agent?.name || agentId}
        file={policyFile}
        onClose={() => setPolicyOpen(false)}
      />
    </div>
  );
}
