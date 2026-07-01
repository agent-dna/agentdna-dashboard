import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "../components/Icon";
import { MetricTile } from "../components/MetricTile";
import { DataTable, type DataTableColumn } from "../components/DataTable";
import { ScoreBar } from "../components/ScoreBar";
import { useIntentsPaged } from "../data/hooks";
import { useIntentLabel } from "../context/IntentNumbersContext";
import { fmtRuntime, timeAgo } from "../lib/format";
import type { Intent } from "../types";

function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (p: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <button className="btn primary" style={{ padding: "4px 10px", fontSize: 12 }} disabled={page <= 1} onClick={() => onChange(page - 1)}>Prev</button>
      <span style={{ padding: "4px 10px", fontSize: 12, fontFamily: "var(--font-mono)", fontWeight: 600, color: "var(--fg)", background: "var(--surface-raised)", border: "1px solid var(--line-strong)", borderRadius: 6, minWidth: 52, textAlign: "center" as const }}>
        {page} / {totalPages}
      </span>
      <button className="btn primary" style={{ padding: "4px 10px", fontSize: 12 }} disabled={page >= totalPages} onClick={() => onChange(page + 1)}>Next</button>
    </div>
  );
}

export function IntentsPage() {
  const [filter, setFilter] = useState<"all" | "threats" | "safe">("all");
  const [page, setPage] = useState(1);
  const { data: paged } = useIntentsPaged(page);
  const intents = paged.items;
  const totalPages = paged.totalPages || 1;
  const total = paged.total || intents.length;
  const navigate = useNavigate();
  const intentLabel = useIntentLabel();

  let rows = intents;
  if (filter === "threats") rows = rows.filter((r) => r.threats > 0);
  if (filter === "safe") rows = rows.filter((r) => r.threats === 0);

  const totalAgents = intents.reduce((a, x) => a + x.agentsInteracted, 0);
  const totalTools = intents.reduce((a, x) => a + x.toolsInteracted, 0);
  const totalThreats = intents.reduce((a, x) => a + x.threats, 0);

  const cols: DataTableColumn<Intent>[] = [
    {
      key: "id",
      label: "Intent",
      sortFn: (a, b) => a.id.localeCompare(b.id),
      render: (r) => (
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 600, color: "var(--fg)" }}>
          {intentLabel(r.id)}
        </span>
      ),
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
      sortFn: (a, b) => a.initiator.name.localeCompare(b.initiator.name),
      render: (r) => (
        <span style={{ fontSize: 13, color: "var(--fg)", fontWeight: 600 }}>
          {r.initiator.name || "—"}
        </span>
      ),
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
      sortFn: (a, b) => a.interactionsCount - b.interactionsCount,
      render: (r) => (
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 12.5 }}>{r.interactionsCount}</span>
      ),
    },
    {
      key: "threats",
      label: "Threats",
      align: "right",
      sortFn: (a, b) => a.threats - b.threats,
      render: (r) => (
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, color: r.threats > 0 ? "var(--threat)" : "var(--fg-faint)" }}>
          {r.threats}
        </span>
      ),
    },
    {
      key: "score",
      label: "Reliability",
      align: "right",
      sortFn: (a, b) => a.score - b.score,
      render: (r) => {
        const ix = r.interactionsCount;
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
        <MetricTile label="Total Intent" value={intents.length} icon="intents" sparkColor="#2563EB" spark={[]} />
        <MetricTile label="Agents Engaged" value={totalAgents} icon="agents" sparkColor="#0EA5E9" spark={[]} />
        <MetricTile label="Apps Engaged" value={totalTools} icon="box" sparkColor="#0A2240" spark={[]} />
        <MetricTile label="Threats Flagged" value={totalThreats} icon="shield" sparkColor="#DC2626" spark={[]} />
      </div>

      <div className="card">
        <div className="tb-toolbar">
          <div className="filters">
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
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span className="count">{rows.length} of {total}</span>
            <Pagination page={page} totalPages={totalPages} onChange={(p) => { setPage(p); }} />
          </div>
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
