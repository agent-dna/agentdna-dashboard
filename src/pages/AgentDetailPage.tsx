import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Icon } from "../components/Icon";
import { MetricTile } from "../components/MetricTile";
import { Tabs } from "../components/Tabs";
import { DataTable, type DataTableColumn } from "../components/DataTable";
import { Pagination } from "../components/Pagination";
import { IdCell } from "../components/EntityCell";
import { InfoStat } from "../components/InfoStat";
import { EditAgentPolicyModal } from "../components/forms/EditAgentPolicyModal";
import { ViewPolicyModal } from "../components/forms/ViewPolicyModal";
import { ViewToolPolicyModal } from "../components/forms/ViewToolPolicyModal";
import { RevokeAgentModal } from "../components/forms/RevokeAgentModal";
import { useAgent, useAgentInteractions, useAgentIntents, useAgentTools, useAgentPolicyHistory } from "../data/hooks";
import type { AgentToolLink } from "../data/api";
import { useAuth } from "../context/AuthContext";
import { useDrawer } from "../context/DrawerContext";
import { useResolveName, resolveDisplayName } from "../context/DirectoryContext";
import { IntentIdChip } from "../context/IntentNumbersContext";
import { isDummyMode } from "../data/dummyRouter";
import { initials, timeAgo } from "../lib/format";
import { LedgerTable } from "../components/LedgerTable";
import { AppIcon } from "../components/AppIcon";
import { ThreatPill } from "../components/ThreatPill";
import type { Intent } from "../types";
import { fetchAgentPolicyUpdate, type PolicyHistoryEntry, type PolicyUpdate } from "../api/policy";
import { exportAgentPdf } from "../lib/exportAgentPdf";

type Tab = "interactions" | "intents" | "tools" | "history";

export function AgentDetailPage() {
  const { agentId = "" } = useParams<{ agentId: string }>();
  const navigate = useNavigate();
  const { openDrawer } = useDrawer();
  const { user } = useAuth();
  const resolve = useResolveName();
  const isAdmin = !!user?.is_admin;
  const [tab, setTab] = useState<Tab>("tools");
  const [toolsPage, setToolsPage] = useState(1);
  const [policyOpen, setPolicyOpen] = useState(false);
  const [viewPolicyOpen, setViewPolicyOpen] = useState(false);
  const [revokeOpen, setRevokeOpen] = useState(false);
  const [toolPolicyOpen, setToolPolicyOpen] = useState<AgentToolLink | null>(null);
  // Picked history row (lightweight); full policy gets loaded lazily into `historyPolicy`.
  const [historyOpen, setHistoryOpen] = useState<PolicyHistoryEntry | null>(null);
  const [historyPolicy, setHistoryPolicy] = useState<PolicyUpdate | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const agentState = useAgent(agentId);
  const { data: agent, loading } = agentState;
  const { data: interactions } = useAgentInteractions(agentId);
  const { data: intents } = useAgentIntents(agentId);
  const { data: toolsResult } = useAgentTools(agentId, toolsPage);
  const { data: history } = useAgentPolicyHistory(agentId);
  const openHistoryRevision = (entry: PolicyHistoryEntry) => {
    setHistoryOpen(entry);
    setHistoryPolicy(null);
    setHistoryError(null);
    setHistoryLoading(true);
    fetchAgentPolicyUpdate(agentId, entry.updateID)
      .then((res) => {
        setHistoryPolicy(res);
      })
      .catch((e) => {
        setHistoryError(e instanceof Error ? e.message : "Failed to load policy");
      })
      .finally(() => setHistoryLoading(false));
  };

  const closeHistoryRevision = () => {
    setHistoryOpen(null);
    setHistoryPolicy(null);
    setHistoryError(null);
    setHistoryLoading(false);
  };

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

  // Matches the columns used on the main Intents page (IntentsPage.tsx) so the
  // same intent looks the same everywhere it's listed.
  const intentCols: DataTableColumn<Intent>[] = [
    {
      key: "id",
      label: "Intent",
      render: (r) => (
        <IntentIdChip id={r.id} style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 600, color: "var(--fg)" }} />
      ),
    },
    {
      key: "initiator",
      label: "Initiator",
      render: (r) => (
        <span style={{ fontSize: 13, color: "var(--fg)", fontWeight: 600 }}>{resolveDisplayName(resolve, r.initiator)}</span>
      ),
    },
    {
      key: "interactions",
      label: "Interactions",
      render: (r) => <span style={{ fontFamily: "var(--font-mono)", fontSize: 12.5 }}>{r.interactionsCount}</span>,
    },
    {
      key: "apps",
      label: "App interacted",
      render: (r) => {
        const apps = r.appsInteracted || [];
        if (apps.length === 0) {
          return <span style={{ color: "var(--fg-faint)", fontFamily: "var(--font-mono)", fontSize: 12.5 }}>—</span>;
        }
        return (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {apps.slice(0, 3).map((app) => (
              <AppIcon key={app.id} name={resolveDisplayName(resolve, app)} size={20} />
            ))}
            {apps.length > 3 && (
              <span style={{ fontSize: 11, color: "var(--fg-muted)", fontFamily: "var(--font-mono)" }}>+{apps.length - 3}</span>
            )}
          </div>
        );
      },
    },
    {
      key: "threats",
      label: "Threats",
      render: (r) => <ThreatPill threat={r.threats > 0} />,
    },
    {
      key: "time",
      label: "Time",
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

  const toolCols: DataTableColumn<AgentToolLink>[] = [
    {
      key: "tool",
      label: "Tool Name",
      render: (r) => (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <AppIcon name={r.toolName} size={22} />
          <span style={{ fontSize: 13, color: "var(--fg)", fontWeight: 600 }}>{r.toolName}</span>
        </div>
      ),
    },
    {
      key: "trust",
      label: "Trust Score",
      render: (r) => <span style={{ fontFamily: "var(--font-mono)", fontSize: 12.5 }}>{r.trustScore}</span>,
    },
    {
      key: "policy",
      label: "Policy file",
      render: (r) => (
        <button
          className="btn-mini"
          onClick={(e) => {
            e.stopPropagation();
            setToolPolicyOpen(r);
          }}
        >
          <Icon name="eye" size={12} /> View
        </button>
      ),
    },
    {
      key: "lastInteracted",
      label: "Last Interacted",
      render: (r) => (
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, color: "var(--fg-muted)" }}>
          {timeAgo(r.lastInteracted)}
        </span>
      ),
    },
    {
      key: "actions",
      label: "",
      align: "right",
      width: 120,
      render: (r) => (
        <div className="row-actions">
          <button
            className="btn-mini"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/agents/${agentId}/tools/${encodeURIComponent(r.toolID)}`);
            }}
          >
            More details
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
        <span style={{ color: "var(--fg)", fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 600 }}>
          {isDummyMode() ? agent.name : agent.id}
        </span>
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
              <span className="chip info" style={{ fontSize: 10.5, padding: "2px 7px" }}>
                agent
              </span>
            </div>
            {!isDummyMode() && (
              <div style={{ color: "var(--fg-muted)", fontSize: 13, fontFamily: "var(--font-mono)", marginBottom: 16 }}>
                {agent.id}
              </div>
            )}

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: 24,
                borderTop: "1px solid var(--line)",
                paddingTop: 16,
              }}
            >
              <InfoStat label="Owner" value={resolve(agent.owner).name} />
              <InfoStat label="Environment" value={agent.env} />
              <InfoStat label="Created" value={timeAgo(agent.created)} />
              <InfoStat label="Interacted apps" value={agent.connected} mono />
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
            <button
              className="btn"
              onClick={() =>
                exportAgentPdf({
                  agent,
                  interactions,
                  intents,
                  history: history?.history || [],
                })
              }
            >
              <Icon name="download" size={14} />
              Export
            </button>
            {isAdmin && (
              <button className="btn danger" onClick={() => setRevokeOpen(true)}>
                <Icon name="shield" size={14} />
                Revoke agent
              </button>
            )}
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
            { key: "tools", label: "Tools", count: toolsResult.total },
            { key: "history", label: "Policy History", count: history?.history?.length ?? 0 },
          ]}
        />

        {tab === "interactions" && (
          <LedgerTable
            rows={interactions}
            emptyText="No interactions yet."
            onView={(r) => openDrawer("interaction", r)}
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

        {tab === "tools" && (
          <>
            {toolsResult.totalPages > 1 && (
              <div className="tb-toolbar" style={{ justifyContent: "flex-end" }}>
                <Pagination
                  page={toolsPage}
                  totalPages={toolsResult.totalPages}
                  total={toolsResult.total}
                  pageSize={toolsResult.pageSize}
                  inline
                  onChange={setToolsPage}
                />
              </div>
            )}
            <DataTable
              rows={toolsResult.items}
              columns={toolCols}
              onRowClick={(r) => navigate(`/agents/${agentId}/tools/${encodeURIComponent(r.toolID)}`)}
              emptyText="No apps interacted with yet."
            />
          </>
        )}

        {tab === "history" && (
          <DataTable
            rows={(() => {
              const sortedAsc = (history?.history || []).slice().sort((a, b) => a.time - b.time);
              return sortedAsc
                .map((h, i) => ({ ...h, id: h.updateID, changeNum: i + 1 }))
                // Display newest first
                .sort((a, b) => b.time - a.time);
            })()}
            columns={[
              {
                key: "changeNum",
                label: "#",
                width: 60,
                sortFn: (a, b) => a.changeNum - b.changeNum,
                render: (r) => (
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 12.5,
                      fontWeight: 600,
                      color: "var(--fg)",
                    }}
                  >
                    {r.changeNum}
                  </span>
                ),
              },
              {
                key: "updateID",
                label: "Update ID",
                render: (r) => <IdCell id={r.updateID} truncate truncateLength={12} />,
              },
              {
                key: "time",
                label: "Time",
                align: "right",
                sortFn: (a, b) => a.time - b.time,
                render: (r) => (
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, color: "var(--fg-dim)" }}>
                    {new Date(r.time * 1000).toLocaleString()}
                  </span>
                ),
              },
              {
                key: "actions",
                label: "",
                align: "right",
                width: 110,
                render: (r) => (
                  <button
                    className="btn primary"
                    style={{ padding: "6px 14px", fontSize: 12.5 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      openHistoryRevision(r);
                    }}
                  >
                    <Icon name="eye" size={13} />
                    View
                  </button>
                ),
              },
            ]}
            onRowClick={(r) => openHistoryRevision(r)}
            emptyText="No policy revisions yet."
          />
        )}
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
      <ViewPolicyModal
        open={!!historyOpen}
        name={
          historyOpen
            ? `${agent.name} · ${new Date(historyOpen.time * 1000).toLocaleString()}`
            : agent.name
        }
        content={historyPolicy?.policy}
        filename={historyOpen ? `${historyOpen.updateID}.md` : undefined}
        uploadedAt={historyOpen ? new Date(historyOpen.time * 1000).toISOString() : undefined}
        emptyMessage={
          historyLoading
            ? "Loading policy revision…"
            : historyError
            ? `Failed to load: ${historyError}`
            : "No policy content for this revision."
        }
        onClose={closeHistoryRevision}
      />
      {isAdmin && (
        <RevokeAgentModal
          open={revokeOpen}
          agentDID={agent.id}
          agentName={agent.name}
          onClose={() => setRevokeOpen(false)}
          onSuccess={() => {
            setRevokeOpen(false);
            agentState.refetch();
          }}
        />
      )}
      <ViewToolPolicyModal
        open={!!toolPolicyOpen}
        toolName={toolPolicyOpen?.toolName || ""}
        agentName={agent.name}
        file={toolPolicyOpen?.policyFile}
        onClose={() => setToolPolicyOpen(null)}
      />
    </div>
  );
}

