import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "../components/Icon";
import { MetricTile } from "../components/MetricTile";
import { FilterPill } from "../components/FilterPill";
import { Tabs } from "../components/Tabs";
import { DataTable, type DataTableColumn } from "../components/DataTable";
import { EntityCell, IdCell } from "../components/EntityCell";
import { ScoreBar } from "../components/ScoreBar";
import { AgentRequestModal } from "../components/forms/AgentRequestModal";
import { AccessRequestModal } from "../components/forms/AccessRequestModal";
import { useAgents, useTools } from "../data/hooks";
import { useAuth } from "../context/AuthContext";
import { useDrawer } from "../context/DrawerContext";
import { timeAgo } from "../lib/format";
import type { Agent, Tool } from "../types";

type Tab = "agents" | "tools" | "my-access";

export function AgentsToolsPage() {
  const { user } = useAuth();
  const isAdmin = !!user?.is_admin;
  const [tab, setTab] = useState<Tab>(isAdmin ? "agents" : "my-access");
  const [search, setSearch] = useState("");
  const agentsState = useAgents();
  const { data: agents } = agentsState;
  const toolsState = useTools();
  const { data: tools } = toolsState;
  const { openDrawer } = useDrawer();
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);
  const [accessOpen, setAccessOpen] = useState<{ open: boolean; agent?: Agent }>({ open: false });

  const myAccessIds = new Set(user?.agent_access_list || []);
  const myAccessAgents = agents.filter((a) => myAccessIds.has(a.id));

  const isAgents = tab === "agents";
  const isMyAccess = tab === "my-access";
  const all = isMyAccess ? myAccessAgents : isAgents ? agents : tools;
  const rows = all.filter((r) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return r.name.toLowerCase().includes(q) || r.id.toLowerCase().includes(q);
  });

  const agentCols: DataTableColumn<Agent>[] = [
    {
      key: "name",
      label: "Agent",
      sortFn: (a, b) => a.name.localeCompare(b.name),
      render: (r) => <EntityCell name={r.name} paletteIx={r.name.charCodeAt(0)} />,
    },
    {
      key: "id",
      label: "ID",
      sortFn: (a, b) => a.id.localeCompare(b.id),
      render: (r) => <IdCell id={r.id} truncate truncateLength={10} />,
    },
    {
      key: "score",
      label: "Reliability",
      sortFn: (a, b) => a.score - b.score,
      render: (r) =>
        r.interactions > 0 ? (
          <ScoreBar value={r.score} />
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
      key: "interactions",
      label: "Interactions",
      align: "right",
      sortFn: (a, b) => a.interactions - b.interactions,
      render: (r) => (
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 12.5 }}>{r.interactions.toLocaleString()}</span>
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
      label: "Tools used",
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
              navigate(`/agents/${r.id}`);
            }}
          >
            View
          </button>
        </div>
      ),
    },
  ];

  const toolCols: DataTableColumn<Tool>[] = [
    {
      key: "name",
      label: "Tool",
      sortFn: (a, b) => a.name.localeCompare(b.name),
      render: (r) => (
        <EntityCell name={r.name} sub={r.provider} paletteIx={r.name.charCodeAt(0)} icon={r.provider.slice(0, 2).toUpperCase()} />
      ),
    },
    { key: "id", label: "ID", sortFn: (a, b) => a.id.localeCompare(b.id), render: (r) => <IdCell id={r.id} /> },
    {
      key: "score",
      label: "Reliability",
      sortFn: (a, b) => a.score - b.score,
      render: (r) =>
        r.interactions > 0 ? (
          <ScoreBar value={r.score} />
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
      key: "interactions",
      label: "Interactions",
      align: "right",
      sortFn: (a, b) => a.interactions - b.interactions,
      render: (r) => (
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 12.5 }}>{r.interactions.toLocaleString()}</span>
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
          <h1>Agents &amp; Tools</h1>
          <div className="sub">Identity-verified actors and the capabilities they can invoke</div>
        </div>
        <div className="right">
          {!isAdmin && (
            <button className="btn" onClick={() => setAccessOpen({ open: true })}>
              <Icon name="shield" size={14} />
              Request access
            </button>
          )}
          {tab === "agents" || isMyAccess ? (
            <button className="btn primary" onClick={() => setCreateOpen(true)}>
              <Icon name="plus" size={14} />
              {isAdmin ? "Create agent" : "Request agent"}
            </button>
          ) : (
            <button className="btn">
              <Icon name="download" size={14} />
              Export
            </button>
          )}
        </div>
      </div>

      <div className="metrics">
        {isMyAccess ? (
          <>
            <MetricTile label="My Agents" value={myAccessAgents.length} icon="agents" sparkColor="#2563EB" spark={[]} />
            <MetricTile
              label="Avg. Reliability"
              value={myAccessAgents.length ? Math.round(myAccessAgents.reduce((a, x) => a + x.score, 0) / myAccessAgents.length) : 0}
              unit="/ 100"
              icon="target"
              sparkColor="#0EA5E9"
              spark={[]}
            />
            <MetricTile
              label="Total Interactions"
              value={myAccessAgents.reduce((a, x) => a + x.interactions, 0)}
              icon="activity"
              sparkColor="#0A2240"
              spark={[]}
            />
            <MetricTile
              label="Threats"
              value={myAccessAgents.reduce((a, x) => a + x.threats, 0)}
              icon="shield"
              sparkColor="#DC2626"
              spark={[]}
            />
          </>
        ) : isAgents ? (
          <>
            <MetricTile label="Total Agents" value={agents.length} icon="agents" sparkColor="#2563EB" spark={[]} />
            <MetricTile
              label="Avg. Reliability"
              value={agents.length ? Math.round(agents.reduce((a, x) => a + x.score, 0) / agents.length) : 0}
              unit="/ 100"
              icon="target"
              sparkColor="#0EA5E9"
              spark={[]}
            />
            <MetricTile
              label="Threats (this week)"
              value={agents.reduce((a, x) => a + x.threats, 0)}
              icon="shield"
              sparkColor="#DC2626"
              spark={[]}
            />
            <MetricTile
              label="Tools Reached"
              value={agents.reduce((a, x) => a + x.connected, 0)}
              icon="box"
              sparkColor="#0A2240"
              spark={[]}
            />
          </>
        ) : (
          <>
            <MetricTile label="Total Tools" value={tools.length} icon="box" sparkColor="#2563EB" spark={[]} />
            <MetricTile
              label="Avg. Reliability"
              value={tools.length ? Math.round(tools.reduce((a, x) => a + x.score, 0) / tools.length) : 0}
              unit="/ 100"
              icon="target"
              sparkColor="#0EA5E9"
              spark={[]}
            />
            <MetricTile
              label="Threats (this week)"
              value={tools.reduce((a, x) => a + x.threats, 0)}
              icon="shield"
              sparkColor="#DC2626"
              spark={[]}
            />
            <MetricTile
              label="Agents Reached"
              value={tools.reduce((a, x) => a + x.connected, 0)}
              icon="agents"
              sparkColor="#0A2240"
              spark={[]}
            />
          </>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
        <TopList
          title="Top agents by volume"
          subtitle="Ranked by interactions · threats flagged in this period"
          rows={[...agents]
            .sort((a, b) => b.interactions - a.interactions)
            .slice(0, 5)
            .map((a) => ({ id: a.id, name: a.name, interactions: a.interactions, threats: a.threats }))}
          accent="var(--accent)"
          accent2="var(--accent-2)"
          onRowClick={(r) => navigate(`/agents/${r.id}`)}
          showBar={false}
          showStats={true}
        />
        <TopList
          title="Top tools by volume"
          subtitle="Ranked by interactions"
          rows={[...tools].sort((a, b) => b.interactions - a.interactions).slice(0, 5)}
          accent="var(--accent-3)"
          accent2="var(--accent)"
          onRowClick={(r) => openDrawer("tool", r)}
        />
      </div>

      <div className="card">
        <Tabs
          active={tab}
          onChange={(k) => setTab(k as Tab)}
          tabs={[
            ...(!isAdmin ? [{ key: "my-access", label: "My Access", count: myAccessAgents.length }] : []),
            { key: "agents", label: "Agents", count: agents.length },
            { key: "tools", label: "Tools", count: tools.length },
          ]}
        />

        <div className="tb-toolbar">
          <div className="filters">
            <div className="search" style={{ width: 280, marginLeft: 0 }}>
              <Icon name="search" className="icon" size={16} />
              <input
                placeholder={`Search ${tab}…`}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <FilterPill label="Status" value="all" />
            <FilterPill label={isAgents ? "Env" : "Scope"} value="any" />
            <FilterPill label="Score" value="≥ 0" />
          </div>
          <span className="count">
            {rows.length} of {all.length}
          </span>
        </div>

        {isAgents || isMyAccess ? (
          <DataTable
            columns={agentCols}
            rows={rows as Agent[]}
            onRowClick={(r) => navigate(`/agents/${r.id}`)}
            emptyText={
              isMyAccess
                ? "You don't have access to any agents yet — submit a request."
                : "No agents yet"
            }
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

interface TopListItem {
  id: string;
  name: string;
  interactions: number;
  threats?: number;
  sub?: string;
}

interface TopListProps<T extends TopListItem> {
  title: string;
  subtitle: string;
  rows: T[];
  accent: string;
  accent2: string;
  onRowClick: (row: T) => void;
  showBar?: boolean;
  showStats?: boolean;
}

function TopList<T extends TopListItem>({
  title,
  subtitle,
  rows,
  accent,
  accent2,
  onRowClick,
  showBar = true,
  showStats = false,
}: TopListProps<T>) {
  const max = rows.reduce((m, x) => Math.max(m, x.interactions), 0) || 1;
  return (
    <div className="card">
      <div className="card-head">
        <div>
          <h3>{title}</h3>
          <div className="sub">{subtitle}</div>
        </div>
      </div>
      <div style={{ padding: "4px 10px 14px", display: "flex", flexDirection: "column", gap: 2 }}>
        {rows.length === 0 && (
          <div style={{ padding: 28, color: "var(--fg-muted)", fontSize: 13, textAlign: "center" }}>
            No data
          </div>
        )}
        {rows.map((r, i) => {
          const pct = (r.interactions / max) * 100;
          const isTop = i === 0;
          return (
            <div
              key={r.id}
              onClick={() => onRowClick(r)}
              style={{
                display: "grid",
                gridTemplateColumns: showStats ? "auto 1fr auto auto" : "auto 1fr auto",
                gap: 14,
                alignItems: "center",
                padding: "12px 14px",
                borderRadius: 10,
                cursor: "pointer",
                transition: "background 120ms, transform 120ms",
                position: "relative",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLDivElement).style.background = "var(--bg-2)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLDivElement).style.background = "transparent";
              }}
            >
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  display: "grid",
                  placeItems: "center",
                  fontFamily: "var(--font-display)",
                  fontSize: 12,
                  fontWeight: 700,
                  background: isTop
                    ? `linear-gradient(135deg, ${accent}, ${accent2})`
                    : "var(--bg-3)",
                  color: isTop ? "#fff" : "var(--fg-muted)",
                  boxShadow: isTop ? `0 2px 6px ${accent}33` : "none",
                  flexShrink: 0,
                }}
              >
                {String(i + 1).padStart(2, "0")}
              </div>

              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 13.5,
                    fontWeight: 600,
                    color: "var(--fg)",
                    marginBottom: showBar ? 6 : 2,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {r.name}
                </div>
                {r.sub && !showBar && (
                  <div
                    style={{
                      fontSize: 11.5,
                      color: "var(--fg-muted)",
                      fontFamily: "var(--font-mono)",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {r.sub}
                  </div>
                )}
                {showBar && (
                  <div style={{ height: 4, borderRadius: 2, background: "var(--bg-3)", overflow: "hidden" }}>
                    <div
                      style={{
                        width: `${pct}%`,
                        height: "100%",
                        background: `linear-gradient(90deg, ${accent}, ${accent2})`,
                      }}
                    />
                  </div>
                )}
              </div>

              {showStats ? (
                <>
                  <Stat
                    icon="activity"
                    value={r.interactions.toLocaleString()}
                    label="ixns"
                    color="var(--accent)"
                  />
                  <Stat
                    icon="shield"
                    value={(r.threats ?? 0).toLocaleString()}
                    label="threats"
                    color={(r.threats ?? 0) > 0 ? "var(--threat)" : "var(--fg-faint)"}
                  />
                </>
              ) : (
                <div
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 13,
                    fontWeight: 600,
                    color: "var(--fg)",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {r.interactions.toLocaleString()}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface StatProps {
  icon: import("../components/Icon").IconName;
  value: string;
  label: string;
  color: string;
}

function Stat({ icon, value, label, color }: StatProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        gap: 2,
        minWidth: 72,
      }}
    >
      <div style={{ display: "inline-flex", alignItems: "center", gap: 5, color }}>
        <Icon name={icon} size={12} />
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 13,
            fontWeight: 700,
            color: "var(--fg)",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {value}
        </span>
      </div>
      <div
        style={{
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--fg-muted)",
        }}
      >
        {label}
      </div>
    </div>
  );
}
