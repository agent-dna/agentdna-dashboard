import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "../components/Icon";
import { MetricTile } from "../components/MetricTile";
import { DataTable, type DataTableColumn } from "../components/DataTable";
import { Pagination } from "../components/Pagination";
import { useAgentsAppsMetrics, useIntentsPaged } from "../data/hooks";
import { fetchAllIntents, updateIntentStatus } from "../data/api";
import { ApiError } from "../api/client";

import { timeAgo } from "../lib/format";
import { IntentIdChip } from "../context/IntentNumbersContext";
import { useResolveName, resolveDisplayName } from "../context/DirectoryContext";
import { useIntentReview } from "../context/IntentReviewContext";
import { ThreatPill } from "../components/ThreatPill";
import { AppIcon } from "../components/AppIcon";
import type { Intent, IntentReviewStatus } from "../types";

const REVIEW_STATUS_STYLE: Record<IntentReviewStatus, { color: string; bg: string }> = {
  Ongoing: { color: "var(--accent)", bg: "rgba(37,99,235,0.10)" },
  Acknowledged: { color: "var(--safe)", bg: "rgba(5,150,105,0.10)" },
  Flagged: { color: "var(--threat)", bg: "rgba(220,38,38,0.10)" },
};

export function IntentsPage() {
  const [filter, setFilter] = useState<"all" | "threats" | "safe">("all");
  const [page, setPage] = useState(1);
  const resolve = useResolveName();
  const { refetch: refetchIntentReview } = useIntentReview();
  const [acking, setAcking] = useState(false);
  const [ackError, setAckError] = useState<string | null>(null);
  const intentsState = useIntentsPaged(page);
  const { data: paged } = intentsState;
  const { data: agentsApps } = useAgentsAppsMetrics();
  const intents = paged.items;
  const totalPages = paged.totalPages || 1;
  const total = paged.total || intents.length;
  const pageSize = paged.pageSize || 10;
  const navigate = useNavigate();

  const acknowledgeAll = async () => {
    setAcking(true);
    setAckError(null);
    try {
      const all = await fetchAllIntents();
      const toAck = all.filter((i) => i.reviewStatus !== "Acknowledged");
      await Promise.all(toAck.map((i) => updateIntentStatus(i.id, "Acknowledged")));
      intentsState.refetch();
      refetchIntentReview();
    } catch (e) {
      setAckError(e instanceof ApiError ? e.message : "Failed to acknowledge all intents");
    } finally {
      setAcking(false);
    }
  };


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
      sortFn: (a, b) => a.threats - b.threats,
      render: (r) => <ThreatPill threat={r.threats > 0} />,
    },
    {
      key: "reviewStatus",
      label: "Review",
      sortFn: (a, b) => a.reviewStatus.localeCompare(b.reviewStatus),
      render: (r) => (
        <span
          style={{
            fontSize: 11.5,
            fontWeight: 700,
            padding: "3px 9px",
            borderRadius: 999,
            color: REVIEW_STATUS_STYLE[r.reviewStatus].color,
            background: REVIEW_STATUS_STYLE[r.reviewStatus].bg,
          }}
        >
          {r.reviewStatus}
        </span>
      ),
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
        <div className="right" style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {ackError && <span style={{ fontSize: 12.5, color: "var(--threat)" }}>{ackError}</span>}
          <button className="btn primary" onClick={acknowledgeAll} disabled={acking}>
            <Icon name="check" size={14} />
            {acking ? "Acknowledging…" : "Acknowledge all"}
          </button>
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
