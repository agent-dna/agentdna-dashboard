import { useState } from "react";
import { useNavigate } from "react-router-dom";
// import { Icon } from "../components/Icon";
import { MetricTile } from "../components/MetricTile";
import { DataTable, type DataTableColumn } from "../components/DataTable";
import { Pagination } from "../components/Pagination";
import { useAgentsAppsMetrics, useIntentsPaged } from "../data/hooks";

import { timeAgo } from "../lib/format";
import { IntentIdChip } from "../context/IntentNumbersContext";
import { useResolveName, resolveDisplayName } from "../context/DirectoryContext";
import { ThreatPill } from "../components/ThreatPill";
import type { Intent } from "../types";

export function IntentsPage() {
  const [filter, setFilter] = useState<"all" | "threats" | "safe">("all");
  const [page, setPage] = useState(1);
  const resolve = useResolveName();
  const { data: paged } = useIntentsPaged(page);
  const { data: agentsApps } = useAgentsAppsMetrics();
  const intents = paged.items;
  const totalPages = paged.totalPages || 1;
  const total = paged.total || intents.length;
  const pageSize = paged.pageSize || 10;
  const navigate = useNavigate();


  let rows = intents;
  if (filter === "threats") rows = rows.filter((r) => r.threats > 0);
  if (filter === "safe") rows = rows.filter((r) => r.threats === 0);

  // Distinct participants org-wide, from /agents-apps-metrics.
  //
  // Summing `agentsInteracted` across intents counted the same agent once per
  // intent it appeared in, and only over the current page — /intent-list carries
  // per-intent counts, not identities, so a distinct total can't be derived
  // from it.
  //
  // /agents-apps-metrics is org-wide and isn't scoped to which intents this
  // user can actually see, so it kept showing non-zero engagement figures
  // for users with zero intents. There's nothing to have "engaged" anything
  // when the user has no intents at all, so floor both to 0 in that case.
  const totalAgents = total === 0 ? 0 : agentsApps.metrics.totalAgents;
  const totalTools = total === 0 ? 0 : agentsApps.metrics.totalApps;
  const totalThreats = intents.reduce((a, x) => a + x.threats, 0);

  const cols: DataTableColumn<Intent>[] = [
    {
      key: "id",
      label: "Intent",
      sortFn: (a, b) => a.id.localeCompare(b.id),
      render: (r) => (
        <IntentIdChip id={r.id} style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 600, color: "var(--fg)" }} />
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
          {resolveDisplayName(resolve, r.initiator)}
        </span>
      ),
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
      sortFn: (a, b) => a.threats - b.threats,
      render: (r) => <ThreatPill threat={r.threats > 0} />,
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
        </div>
      </div>

      <div className="metrics">
        <MetricTile label="Total Intent" value={total} icon="intents" sparkColor="#2563EB" spark={[]} />
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
            <Pagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} inline onChange={setPage} />
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
