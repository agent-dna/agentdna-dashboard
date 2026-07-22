import { useState } from "react";
import { Pagination } from "../components/Pagination";
import { useNavigate } from "react-router-dom";
import { Icon } from "../components/Icon";
import { MetricTile } from "../components/MetricTile";
import { DataTable, type DataTableColumn } from "../components/DataTable";
import { EntityCell } from "../components/EntityCell";
import { ScoreBar } from "../components/ScoreBar";
import { AgentRequestModal } from "../components/forms/AgentRequestModal";
import { AccessRequestModal } from "../components/forms/AccessRequestModal";
import { useAgentsPaged, useToolsPaged, useAgentsAppsMetrics, useHomeMetrics } from "../data/hooks";
import { useAuth } from "../context/AuthContext";
import { useDrawer } from "../context/DrawerContext";
import { timeAgo } from "../lib/format";
import { exportAgentsListPdf, exportToolsListPdf } from "../lib/exportListPdf";
import type { Agent, Tool } from "../types";

type Tab = "agents" | "tools";

export function AgentsToolsPage() {
  const { user } = useAuth();
  const isAdmin = !!user?.is_admin;
  const [tab, setTab] = useState<Tab>("agents");
  const [agentsPage, setAgentsPage] = useState(1);
  const [toolsPage, setToolsPage] = useState(1);
  const agentsState = useAgentsPaged(agentsPage);
  const agents = agentsState.data.items;
  const agentsTotalPages = agentsState.data.totalPages || 1;
  const agentsTotal = agentsState.data.total || 0;
  const agentsPageSize = agentsState.data.pageSize || 10;
  const toolsState = useToolsPaged(toolsPage);
  const tools = toolsState.data.items;
  const toolsTotalPages = toolsState.data.totalPages || 1;
  const toolsTotal = toolsState.data.total || 0;
  const toolsPageSize = toolsState.data.pageSize || 10;
  const { data: agentsAppsMetrics } = useAgentsAppsMetrics();
  const { data: homeMetrics } = useHomeMetrics();
  const { openDrawer } = useDrawer();
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);
  const [accessOpen, setAccessOpen] = useState<{ open: boolean; agent?: Agent }>({ open: false });

  const isAgents = tab === "agents";
  const rows = isAgents ? agents : tools;

  const agentCols: DataTableColumn<Agent>[] = [
    {
      key: "name",
      label: "Agent",
      width: "18%",
      sortFn: (a, b) => a.name.localeCompare(b.name),
      render: (r) => <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--fg)" }}>{r.name}</span>,
    },
    {
      key: "interactions",
      label: "Interactions",
      align: "right",
      sortFn: (a, b) => a.interactions - b.interactions,
      render: (r) => (
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 12.5 }}>{r.interactions.toLocaleString()}</span>
      ),
    },
    {
      key: "score",
      label: "Reliability",
      align: "right",
      sortFn: (a, b) => a.score - b.score,
      render: (r) =>
        r.interactions > 0 ? (
          <ScoreBar value={computeReliability(r.interactions, r.threats)} />
        ) : (
          <span style={{ color: "var(--fg-faint)", fontFamily: "var(--font-mono)", fontSize: 12.5 }}>—</span>
        ),
    },
    {
      key: "created",
      label: "Created",
      align: "right",
      sortFn: (a, b) => a.created - b.created,
      render: (r) => (
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, color: "var(--fg-dim)" }}>{timeAgo(r.created)}</span>
      ),
    },
    {
      key: "threats",
      label: "Threats",
      align: "right",
      sortFn: (a, b) => a.threats - b.threats,
      render: (r) =>
        r.threats > 0 ? (
          <span className="chip threat" style={{ fontVariantNumeric: "tabular-nums" }}>
            {r.threats}
          </span>
        ) : (
          <span style={{ color: "var(--fg-faint)", fontFamily: "var(--font-mono)", fontSize: 12.5 }}>0</span>
        ),
    },
    {
      key: "connected",
      label: "Apps Interacted",
      align: "right",
      sortFn: (a, b) => a.connected - b.connected,
      render: (r) => <span style={{ fontFamily: "var(--font-mono)", fontSize: 12.5 }}>{r.connected}</span>,
    },
  ];

  const toolCols: DataTableColumn<Tool>[] = [
    {
      key: "name",
      label: "App",
      sortFn: (a, b) => a.name.localeCompare(b.name),
      render: (r) => (
        <EntityCell name={r.name} sub={r.provider} paletteIx={r.name.charCodeAt(0)} icon={r.provider.slice(0, 2).toUpperCase()} />
      ),
    },
    {
      key: "interactions",
      label: "Interactions",
      align: "right",
      sortFn: (a, b) => a.interactions - b.interactions,
      render: (r) => (
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 12.5 }}>{r.interactions.toLocaleString()}</span>
      ),
    },
    {
      key: "score",
      label: "Reliability",
      align: "right",
      sortFn: (a, b) => a.score - b.score,
      render: (r) =>
        r.interactions > 0 ? (
          <ScoreBar value={computeReliability(r.interactions, r.threats)} />
        ) : (
          <span style={{ color: "var(--fg-faint)", fontFamily: "var(--font-mono)", fontSize: 12.5 }}>—</span>
        ),
    },
    {
      key: "created",
      label: "Created",
      align: "right",
      sortFn: (a, b) => a.created - b.created,
      render: (r) => (
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, color: "var(--fg-dim)" }}>{timeAgo(r.created)}</span>
      ),
    },
    {
      key: "threats",
      label: "Threats",
      align: "right",
      sortFn: (a, b) => a.threats - b.threats,
      render: (r) =>
        r.threats > 0 ? (
          <span className="chip threat" style={{ fontVariantNumeric: "tabular-nums" }}>
            {r.threats}
          </span>
        ) : (
          <span style={{ color: "var(--fg-faint)", fontFamily: "var(--font-mono)", fontSize: 12.5 }}>0</span>
        ),
    },
    {
      key: "connected",
      label: "Agents using",
      align: "right",
      sortFn: (a, b) => a.connected - b.connected,
      render: (r) => <span style={{ fontFamily: "var(--font-mono)", fontSize: 12.5 }}>{r.connected}</span>,
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
              openDrawer("tool", r);
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
      <div className="page-head">
        <div>
          <h1>Agents &amp; Apps</h1>
          <div className="sub">Identity-verified actors and the capabilities they can invoke</div>
        </div>
        <div className="right">
          <button
            className="btn"
            onClick={() =>
              isAgents
                ? exportAgentsListPdf(agents, agentsTotal || agents.length)
                : exportToolsListPdf(tools, toolsTotal || tools.length)
            }
          >
            <Icon name="download" size={14} />
            Export
          </button>
        </div>
      </div>

      <div className="metrics">
        <MetricTile label="Total Agents" value={isAdmin ? agentsAppsMetrics.metrics.totalAgents : homeMetrics.agentCount} icon="agents" sparkColor="#2563EB" spark={[]} />
        <MetricTile label="Total Apps" value={agentsAppsMetrics.metrics.totalApps} icon="box" sparkColor="#0A2240" spark={[]} />
        <MetricTile
          label="Avg. Reliability"
          value={parseFloat(agentsAppsMetrics.metrics.avgReliability.toFixed(2))}
          unit="%"
          icon="target"
          sparkColor="#0EA5E9"
          spark={[]}
        />
        <MetricTile label="Total Threats" value={agentsAppsMetrics.metrics.totalThreats} icon="shield" sparkColor="#DC2626" spark={[]} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
        <TopAgentsList
          rows={agentsAppsMetrics.topAgents.map((a) => ({
            id: a.name,
            name: a.name,
            interactions: a.totalInteractions,
            threats: a.totalThreats,
          }))}
          totalAgents={agentsAppsMetrics.metrics.totalAgents}
          onRowClick={(r) => {
            const match = agents.find((a) => a.name === r.name);
            if (match) navigate(`/agents/${match.id}`);
          }}
          onViewAll={() => navigate("/agents")}
        />
        <TopAppsList
          rows={agentsAppsMetrics.topApps.map((a) => ({
            id: a.name,
            name: a.name,
            interactions: a.totalInteractions,
          }))}
          totalApps={agentsAppsMetrics.metrics.totalApps}
          onRowClick={(r) => {
            const match = tools.find((t) => t.name === r.name);
            if (match) openDrawer("tool", match);
          }}
          onViewAll={() => navigate("/agents")}
        />
      </div>

      <div className="card">
        <div className="tb-toolbar">
          <div className="filters">
            {([{ key: "agents", label: "Agents", count: agents.length }, { key: "tools", label: "Apps", count: tools.length }] as const).map((t) => (
              <div
                key={t.key}
                className={`tab ${tab === t.key ? "active" : ""}`}
                onClick={() => setTab(t.key as Tab)}
              >
                {t.label}
                <span className="pill">{t.count}</span>
              </div>
            ))}
          </div>
          <Pagination
            page={isAgents ? agentsPage : toolsPage}
            totalPages={isAgents ? agentsTotalPages : toolsTotalPages}
            total={isAgents ? agentsTotal : toolsTotal}
            pageSize={isAgents ? agentsPageSize : toolsPageSize}
            inline
            onChange={(p) => (isAgents ? setAgentsPage(p) : setToolsPage(p))}
          />
        </div>

        {isAgents ? (
          <DataTable
            columns={agentCols}
            rows={rows as Agent[]}
            onRowClick={(r) => navigate(`/agents/${r.id}`)}
            emptyText="No agents yet"
          />
        ) : (
          <DataTable
            columns={toolCols}
            rows={rows as Tool[]}
            onRowClick={(r) => openDrawer("tool", r)}
            emptyText="No tools yet"
          />
        )}
      </div>

      <AgentRequestModal
        open={createOpen}
        isAdmin={isAdmin}
        onClose={() => setCreateOpen(false)}
        onSuccess={() => {
          setCreateOpen(false);
          agentsState.refetch();
          toolsState.refetch();
        }}
      />
      <AccessRequestModal
        open={accessOpen.open}
        agentDID={accessOpen.agent?.id}
        agentName={accessOpen.agent?.name}
        onClose={() => setAccessOpen({ open: false })}
        onSuccess={() => setAccessOpen({ open: false })}
      />
    </div>
  );
}

/** Reliability = (interactions - threats) / interactions * 100, rounded to 2 dp. */
function computeReliability(interactions: number, threats: number): number {
  if (!interactions || interactions <= 0) return 0;
  const pct = ((interactions - threats) / interactions) * 100;
  return Math.max(0, Math.round(pct * 100) / 100);
}

interface VolumeRow {
  id: string;
  name: string;
  interactions: number;
  threats?: number;
}

function TopAgentsList({
  rows,
  totalAgents,
  onRowClick,
  onViewAll,
}: {
  rows: VolumeRow[];
  totalAgents: number;
  onRowClick: (r: VolumeRow) => void;
  onViewAll: () => void;
}) {
  const totalIxns = rows.reduce((s, r) => s + r.interactions, 0) || 1;
  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", padding: 0, overflow: "hidden" }}>
      <div style={{ padding: "18px 20px 0", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--fg)", marginBottom: 2 }}>Top agents by volume</div>
          <div style={{ fontSize: 12, color: "var(--fg-muted)" }}>Ranked by interactions · threats flagged</div>
        </div>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", background: "var(--bg-3)", color: "var(--fg-muted)", padding: "3px 8px", borderRadius: 4, whiteSpace: "nowrap" }}>LAST 30 DAYS</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "44px 1fr 92px 78px", padding: "12px 20px 6px", borderBottom: "1px solid var(--line)" }}>
        {["#", "AGENT", "IXNS", "THREATS"].map((h, i) => (
          <div key={h} style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.07em", color: "var(--fg-muted)", textTransform: "uppercase", textAlign: i > 1 ? "right" : "left" }}>{h}</div>
        ))}
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignContent: "flex-start" }}>
        {rows.length === 0 && (
          <div style={{ padding: 28, color: "var(--fg-muted)", fontSize: 13, textAlign: "center" }}>No data</div>
        )}
        {rows.map((r, i) => {
          const share = Math.round((r.interactions / totalIxns) * 100);
          const threats = r.threats ?? 0;
          return (
            <div
              key={r.id}
              onClick={() => onRowClick(r)}
              style={{ display: "grid", gridTemplateColumns: "44px 1fr 92px 78px", alignItems: "center", padding: "10px 20px", cursor: "pointer", borderBottom: "1px solid var(--line)" }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLDivElement).style.background = "var(--bg-2)")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLDivElement).style.background = "transparent")}
            >
              <div style={{ width: 28, height: 28, borderRadius: 8, display: "grid", placeItems: "center", fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, background: i === 0 ? "#0a2240" : "var(--bg-3)", color: i === 0 ? "#fff" : "var(--fg-muted)" }}>
                {String(i + 1).padStart(2, "0")}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--fg)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.name}</div>
                <div style={{ fontSize: 11, color: "var(--fg-muted)", fontFamily: "var(--font-mono)" }}>{share}% of agent volume</div>
              </div>
              <div style={{ textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 600, color: "var(--fg)", fontVariantNumeric: "tabular-nums" }}>
                {r.interactions.toLocaleString()}
              </div>
              <div style={{ textAlign: "right" }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, background: threats > 0 ? "rgba(220,38,38,0.1)" : "var(--bg-3)", color: threats > 0 ? "#dc2626" : "var(--fg-muted)", padding: "2px 8px", borderRadius: 4 }}>
                  {threats.toLocaleString()}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ padding: "12px 20px", borderTop: "1px solid var(--line)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 12, color: "var(--fg-muted)" }}>Showing top {rows.length} of {totalAgents} agents</span>
        <button onClick={onViewAll} style={{ background: "none", border: "none", fontSize: 12, fontWeight: 600, color: "var(--accent)", cursor: "pointer", padding: 0 }}>View all agents →</button>
      </div>
    </div>
  );
}

function TopAppsList({
  rows,
  totalApps,
  onRowClick,
  onViewAll,
}: {
  rows: VolumeRow[];
  totalApps: number;
  onRowClick: (r: VolumeRow) => void;
  onViewAll: () => void;
}) {
  const totalIxns = rows.reduce((s, r) => s + r.interactions, 0) || 1;
  const maxIxns = rows.reduce((m, r) => Math.max(m, r.interactions), 0) || 1;
  return (
    <div style={{ borderRadius: 14, background: "#0b1633", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ padding: "18px 20px 0", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 16.5, fontWeight: 700, color: "#fff", marginBottom: 2 }}>Top apps by volume</div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.45)" }}>Ranked by interactions</div>
        </div>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.4)", padding: "3px 8px", borderRadius: 4, whiteSpace: "nowrap" }}>LAST 30 DAYS</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "36px 1fr 76px 72px", padding: "12px 20px 6px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
        {["#", "APP", "IXNS", "SHARE"].map((h, i) => (
          <div key={h} style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.07em", color: "rgba(255,255,255,0.35)", textTransform: "uppercase", textAlign: i > 1 ? "right" : "left" }}>{h}</div>
        ))}
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        {rows.length === 0 && (
          <div style={{ padding: 28, color: "rgba(255,255,255,0.35)", fontSize: 14, textAlign: "center" }}>No data</div>
        )}
        {rows.map((r, i) => {
          const share = Math.round((r.interactions / totalIxns) * 100);
          const barPct = (r.interactions / maxIxns) * 100;
          return (
            <div
              key={r.id}
              onClick={() => onRowClick(r)}
              style={{ cursor: "pointer", borderBottom: "1px solid rgba(255,255,255,0.05)", padding: "0 20px" }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.04)")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLDivElement).style.background = "transparent")}
            >
              <div style={{ display: "grid", gridTemplateColumns: "36px 1fr 76px 72px", alignItems: "center", padding: "10px 0 4px" }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700, color: i === 0 ? "#fff" : "rgba(255,255,255,0.4)" }}>
                  {String(i + 1).padStart(2, "0")}
                </div>
                <div style={{ fontSize: 14, fontWeight: 500, color: "#fff", fontFamily: "var(--font-mono)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {r.name}
                </div>
                <div style={{ textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 600, color: "#fff", fontVariantNumeric: "tabular-nums" }}>
                  {r.interactions.toLocaleString()}
                </div>
                <div style={{ textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.6)", fontVariantNumeric: "tabular-nums" }}>
                  {share}%
                </div>
              </div>
              <div style={{ height: 3, borderRadius: 2, background: "rgba(255,255,255,0.08)", overflow: "hidden", marginBottom: 8 }}>
                <div style={{ width: `${barPct}%`, height: "100%", background: "linear-gradient(90deg, #5f83e8, #a8bdf5)", borderRadius: 2 }} />
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ padding: "12px 20px", borderTop: "1px solid rgba(255,255,255,0.07)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 13, color: "rgba(255,255,255,0.35)" }}>Showing top {rows.length} of {totalApps} apps</span>
        <button onClick={onViewAll} style={{ background: "none", border: "none", fontSize: 13, fontWeight: 600, color: "#5f83e8", cursor: "pointer", padding: 0 }}>View all apps →</button>
      </div>
    </div>
  );
}
