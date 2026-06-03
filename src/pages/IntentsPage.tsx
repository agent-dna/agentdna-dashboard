import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "../components/Icon";
import { MetricTile } from "../components/MetricTile";
import { FilterPill } from "../components/FilterPill";
import { DataTable, type DataTableColumn } from "../components/DataTable";
import { IdCell } from "../components/EntityCell";
import { ScoreBar } from "../components/ScoreBar";
import { useIntents } from "../data/hooks";
import { fmtRuntime, timeAgo } from "../lib/format";
import type { Intent } from "../types";

export function IntentsPage() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "threats" | "safe">("all");
  const { data: intents } = useIntents();
  const navigate = useNavigate();

  let rows = intents;
  if (filter === "threats") rows = rows.filter((r) => r.threats > 0);
  if (filter === "safe") rows = rows.filter((r) => r.threats === 0);
  if (search) {
    const q = search.toLowerCase();
    rows = rows.filter((r) => r.name.toLowerCase().includes(q) || r.id.toLowerCase().includes(q));
  }

  const totalAgents = intents.reduce((a, x) => a + x.agentsInteracted, 0);
  const totalTools = intents.reduce((a, x) => a + x.toolsInteracted, 0);
  const totalThreats = intents.reduce((a, x) => a + x.threats, 0);

  const cols: DataTableColumn<Intent>[] = [
    {
      key: "id",
      label: "Intent ID",
      sortFn: (a, b) => a.id.localeCompare(b.id),
      render: (r) => <IdCell id={r.id} truncate />,
    },
    {
      key: "name",
      label: "Status",
      sortFn: (a, b) => a.name.localeCompare(b.name),
      render: (r) => {
        const s = (r.name || "").toLowerCase();
        const chipClass =
          s === "completed" ? "safe" : s === "running" ? "info" : s === "failed" ? "threat" : s === "pending" ? "warn" : "";
        return (
          <span className={`chip ${chipClass}`} style={{ textTransform: "capitalize" }}>
            {r.name || "—"}
          </span>
        );
      },
    },
    {
      key: "initiator",
      label: "Initiator",
      sortFn: (a, b) => a.initiator.id.localeCompare(b.initiator.id),
      render: (r) => <IdCell id={r.initiator.id} truncate />,
    },
    {
      key: "runtime",
      label: "Runtime",
      align: "right",
      sortFn: (a, b) => a.runtime - b.runtime,
      render: (r) => <span style={{ fontFamily: "var(--font-mono)", fontSize: 12.5 }}>{fmtRuntime(r.runtime)}</span>,
    },
    {
      key: "interactions",
      label: "Interactions",
      align: "right",
      sortFn: (a, b) => a.agentsInteracted + a.toolsInteracted - (b.agentsInteracted + b.toolsInteracted),
      render: (r) => (
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 12.5 }}>
          {r.agentsInteracted + r.toolsInteracted}
        </span>
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
      key: "score",
      label: "Reliability",
      align: "right",
      sortFn: (a, b) => a.score - b.score,
      render: (r) => {
        const ix = r.agentsInteracted + r.toolsInteracted;
        if (ix <= 0) {
          return <span style={{ color: "var(--fg-faint)", fontFamily: "var(--font-mono)", fontSize: 12.5 }}>—</span>;
        }
        const pct = Math.max(0, Math.round((((ix - r.threats) / ix) * 100) * 100) / 100);
        return <ScoreBar value={pct} />;
      },
    },
    {
      key: "time",
      label: "Time",
      align: "right",
      sortFn: (a, b) => a.started - b.started,
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
      <div className="page-head">
        <div>
          <h1>Intents</h1>
          <div className="sub">High-level goals being executed across the agent network</div>
        </div>
        <div className="right">
          <button className="btn">
            <Icon name="filter" size={14} />
            Filter
          </button>
        </div>
      </div>

      <div className="metrics">
        <MetricTile label="Active Intents" value={intents.length} icon="intents" sparkColor="#2563EB" spark={[]} />
        <MetricTile label="Agents Engaged" value={totalAgents} icon="agents" sparkColor="#0EA5E9" spark={[]} />
        <MetricTile label="Tools Engaged" value={totalTools} icon="box" sparkColor="#0A2240" spark={[]} />
        <MetricTile label="Threats Flagged" value={totalThreats} icon="shield" sparkColor="#DC2626" spark={[]} />
      </div>

      <div className="card">
        <div className="tb-toolbar">
          <div className="filters">
            <div className="search" style={{ width: 280, marginLeft: 0 }}>
              <Icon name="search" className="icon" size={16} />
              <input
                placeholder="Search intents…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="seg">
              <button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>
                All
              </button>
              <button className={filter === "threats" ? "active" : ""} onClick={() => setFilter("threats")}>
                With threats
              </button>
              <button className={filter === "safe" ? "active" : ""} onClick={() => setFilter("safe")}>
                Safe
              </button>
            </div>
            <FilterPill label="Initiator" value="any" />
            <FilterPill label="Score" value="≥ 0" />
          </div>
          <span className="count">
            {rows.length} of {intents.length}
          </span>
        </div>

        <DataTable
          onRowClick={(r) => navigate(`/intents/${r.id}`)}
          columns={cols}
          rows={rows}
          emptyText="No intents yet"
        />
      </div>
    </div>
  );
}
