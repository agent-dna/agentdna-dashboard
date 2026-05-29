import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Icon } from "../components/Icon";
import { MetricTile } from "../components/MetricTile";
import { Tabs } from "../components/Tabs";
import { DataTable, type DataTableColumn } from "../components/DataTable";
import { EntityCell, IdCell } from "../components/EntityCell";
import { ScoreBar } from "../components/ScoreBar";
import { InfoStat } from "../components/InfoStat";
import { LogsTable } from "../components/LogsTable";
import { EditAgentPolicyModal } from "../components/forms/EditAgentPolicyModal";
import { ViewPolicyModal } from "../components/forms/ViewPolicyModal";
import { useAgent, useAgentInteractions, useAgentIntents, useLogs } from "../data/hooks";
import { useAuth } from "../context/AuthContext";
import { useDrawer } from "../context/DrawerContext";
import { fmtRuntime, initials, timeAgo } from "../lib/format";
import type { Intent, Interaction } from "../types";

type Tab = "interactions" | "intents" | "logs";

export function AgentDetailPage() {
  const { agentId = "" } = useParams<{ agentId: string }>();
  const navigate = useNavigate();
  const { openDrawer } = useDrawer();
  const { user } = useAuth();
  const isAdmin = !!user?.is_admin;
  const [tab, setTab] = useState<Tab>("interactions");
  const [policyOpen, setPolicyOpen] = useState(false);
  const [viewPolicyOpen, setViewPolicyOpen] = useState(false);

  const agentState = useAgent(agentId);
  const { data: agent, loading } = agentState;
  const { data: interactions } = useAgentInteractions(agentId);
  const { data: intents } = useAgentIntents(agentId);
  const { data: logs } = useLogs("agent", agentId);

  if (loading) {
    return (
      <div className="page">
        <div className="stub">
          <h2>Loading…</h2>
        </div>
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="page">
        <div className="stub">
          <h2>Agent not found</h2>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, marginTop: 6 }}>{agentId}</div>
          <button className="btn" style={{ marginTop: 16 }} onClick={() => navigate("/agents")}>
            <Icon name="arrowRight" size={14} style={{ transform: "rotate(180deg)" }} /> Back to agents
          </button>
        </div>
      </div>
    );
  }

  const interactionCols: DataTableColumn<Interaction>[] = [
    { key: "id", label: "Interaction ID", render: (r) => <IdCell id={r.id} /> },
    {
      key: "dir",
      label: "Direction",
      render: (r) => (
        <span
          className="chip"
          style={{
            fontSize: 10.5,
            padding: "2px 7px",
            color: r.initiator.id === agent.id ? "var(--accent)" : "var(--accent-3)",
            background: r.initiator.id === agent.id ? "rgba(37,99,235,0.08)" : "rgba(14,165,233,0.08)",
            borderColor: r.initiator.id === agent.id ? "rgba(37,99,235,0.20)" : "rgba(14,165,233,0.20)",
          }}
        >
          {r.initiator.id === agent.id ? "outgoing →" : "← incoming"}
        </span>
      ),
    },
    {
      key: "counter",
      label: "Counterparty",
      render: (r) => {
        const other = r.initiator.id === agent.id ? r.target : r.initiator;
        return <EntityCell name={other.name} sub={other.id} paletteIx={other.name.charCodeAt(0)} />;
      },
    },
    { key: "intent", label: "Intent", render: (r) => <IdCell id={r.intent.id} /> },
    {
      key: "runtime",
      label: "Runtime",
      align: "right",
      render: (r) => <span style={{ fontFamily: "var(--font-mono)", fontSize: 12.5 }}>{fmtRuntime(r.runtime)}</span>,
    },
    {
      key: "threat",
      label: "Status",
      render: (r) =>
        r.threat ? (
          <span className="chip threat">
            <span className="dot-status threat" /> threat
          </span>
        ) : (
          <span className="chip safe">
            <span className="dot-status safe" /> safe
          </span>
        ),
    },
    {
      key: "created",
      label: "When",
      align: "right",
      render: (r) => (
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, color: "var(--fg-muted)" }}>
          {timeAgo(r.created)}
        </span>
      ),
    },
    {
      key: "actions",
      label: "",
      align: "right",
      width: 60,
      render: (r) => (
        <div className="row-actions">
          <button
            className="btn-mini"
            onClick={(e) => {
              e.stopPropagation();
              openDrawer("interaction", r);
            }}
          >
            View
          </button>
        </div>
      ),
    },
  ];

  const intentCols: DataTableColumn<Intent>[] = [
    { key: "id", label: "Intent ID", render: (r) => <IdCell id={r.id} /> },
    {
      key: "name",
      label: "Description",
      render: (r) => <div style={{ color: "var(--fg)" }}>{r.name}</div>,
    },
    {
      key: "runtime",
      label: "Runtime",
      align: "right",
      render: (r) => <span style={{ fontFamily: "var(--font-mono)", fontSize: 12.5 }}>{fmtRuntime(r.runtime)}</span>,
    },
    {
      key: "agents",
      label: "Agents",
      align: "right",
      render: (r) => <span style={{ fontFamily: "var(--font-mono)", fontSize: 12.5 }}>{r.agentsInteracted}</span>,
    },
    {
      key: "tools",
      label: "Tools",
      align: "right",
      render: (r) => <span style={{ fontFamily: "var(--font-mono)", fontSize: 12.5 }}>{r.toolsInteracted}</span>,
    },
    {
      key: "threats",
      label: "Threats",
      align: "right",
      render: (r) =>
        r.threats > 0 ? (
          <span className="chip threat">{r.threats}</span>
        ) : (
          <span style={{ color: "var(--fg-faint)", fontFamily: "var(--font-mono)", fontSize: 12.5 }}>0</span>
        ),
    },
    { key: "score", label: "Score", render: (r) => <ScoreBar value={r.score} /> },
    {
      key: "started",
      label: "Started",
      align: "right",
      render: (r) => (
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, color: "var(--fg-muted)" }}>
          {timeAgo(r.started)}
        </span>
      ),
    },
    {
      key: "actions",
      label: "",
      align: "right",
      width: 60,
      render: (r) => (
        <div className="row-actions">
          <button
            className="btn-mini"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/intents/${r.id}`);
            }}
          >
            View
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="page">
      {/* Breadcrumb back */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 14, fontSize: 13 }}>
        <button
          className="btn ghost"
          style={{ padding: "4px 8px", fontSize: 12.5 }}
          onClick={() => navigate("/agents")}
        >
          <Icon name="arrowRight" size={12} style={{ transform: "rotate(180deg)" }} /> Agents
        </button>
        <span style={{ color: "var(--fg-faint)" }}>/</span>
        <span style={{ color: "var(--fg)", fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 600 }}>{agent.id}</span>
      </div>

      {/* Hero info card */}
      <div className="card" style={{ padding: "24px 28px", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 20 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 14,
              background: "linear-gradient(135deg, rgba(37,99,235,0.18), rgba(14,165,233,0.05))",
              display: "grid",
              placeItems: "center",
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              fontSize: 22,
              color: "var(--accent)",
              border: "1px solid var(--line-strong)",
              flexShrink: 0,
            }}
          >
            {initials(agent.name)}
          </div>

          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <h1
                style={{
                  margin: 0,
                  fontFamily: "var(--font-display)",
                  fontSize: 24,
                  fontWeight: 600,
                  letterSpacing: "-0.02em",
                  color: "var(--fg)",
                }}
              >
                {agent.name}
              </h1>
              <span className={`chip ${agent.status === "warn" ? "warn" : "safe"}`}>
                <span className={`dot-status ${agent.status === "warn" ? "warn" : "safe"}`} />
                {agent.status === "warn" ? "needs review" : "healthy"}
              </span>
              <span className="chip info" style={{ fontSize: 10.5, padding: "2px 7px" }}>
                agent
              </span>
            </div>
            <div style={{ color: "var(--fg-muted)", fontSize: 13, fontFamily: "var(--font-mono)", marginBottom: 16 }}>
              {agent.id}
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: 24,
                borderTop: "1px solid var(--line)",
                paddingTop: 16,
              }}
            >
              <InfoStat label="Owner" value={agent.owner} />
              <InfoStat label="Environment" value={agent.env} />
              <InfoStat label="Created" value={timeAgo(agent.created)} />
              <InfoStat label="Connected tools" value={agent.connected} mono />
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <button className="btn" onClick={() => setViewPolicyOpen(true)}>
              <Icon name="eye" size={14} />
              View policy
            </button>
            {isAdmin && (
              <button className="btn" onClick={() => setPolicyOpen(true)}>
                <Icon name="settings" size={14} />
                Edit policy
              </button>
            )}
            <button className="btn">
              <Icon name="download" size={14} />
              Export
            </button>
            <button className="btn primary">
              <Icon name="shield" size={14} />
              Run audit
            </button>
          </div>
        </div>
      </div>

      {/* Activity metrics */}
      <div className="metrics">
        <MetricTile label="Reliability" value={agent.score} unit="/ 100" icon="target" sparkColor="#2563EB" spark={[]} />
        <MetricTile
          label="Interactions"
          value={agent.interactions.toLocaleString()}
          icon="activity"
          sparkColor="#0EA5E9"
          spark={[]}
        />
        <MetricTile label="Threats" value={agent.threats} icon="shield" sparkColor="#DC2626" spark={[]} />
        <MetricTile label="Intents handled" value={intents.length} icon="intents" sparkColor="#0A2240" spark={[]} />
      </div>

      {/* Tabbed table */}
      <div className="card">
        <Tabs
          active={tab}
          onChange={(k) => setTab(k as Tab)}
          tabs={[
            { key: "interactions", label: "Interactions", count: interactions.length },
            { key: "intents", label: "Intents", count: intents.length },
            { key: "logs", label: "Logs", count: logs.length },
          ]}
        />

        {tab === "interactions" && (
          <DataTable
            rows={interactions}
            columns={interactionCols}
            onRowClick={(r) => openDrawer("interaction", r)}
            emptyText="No interactions yet."
          />
        )}

        {tab === "intents" && (
          <DataTable
            rows={intents}
            columns={intentCols}
            onRowClick={(r) => navigate(`/intents/${r.id}`)}
            emptyText="No intents initiated by this agent."
          />
        )}

        {tab === "logs" && <LogsTable logs={logs} />}
      </div>

      <EditAgentPolicyModal
        open={policyOpen}
        agentDID={agent.id}
        agentName={agent.name}
        onClose={() => setPolicyOpen(false)}
        onSuccess={() => {
          setPolicyOpen(false);
          agentState.refetch();
        }}
      />
      <ViewPolicyModal
        open={viewPolicyOpen}
        name={agent.name}
        content={agent.policy}
        emptyMessage={
          isAdmin
            ? "No policy uploaded for this agent yet. Use “Edit policy” to upload one."
            : "No policy uploaded for this agent yet."
        }
        onClose={() => setViewPolicyOpen(false)}
      />
    </div>
  );
}
