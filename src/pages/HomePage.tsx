import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "../components/Icon";
import { MetricTile } from "../components/MetricTile";

import { Chart } from "../components/Chart";
import { Modal } from "../components/Modal";
import { useHomeMetrics, useIntentsPaged, useThreatsListPaged, useTopThreats, useSeries, useAgentsAppsMetrics } from "../data/hooks";
import { Pagination } from "../components/Pagination";
import { AppIcon } from "../components/AppIcon";
import { DataTable, type DataTableColumn } from "../components/DataTable";
import { IntentIdChip } from "../context/IntentNumbersContext";
import { useResolveName, resolveDisplayName, useDirectoryLoading } from "../context/DirectoryContext";
import { useDrawer } from "../context/DrawerContext";
import { ThreatPill } from "../components/ThreatPill";
import { SeverityPill } from "../components/SeverityPill";
import { getThreatSeverity, type ThreatSeverity } from "../lib/threatSeverity";
import { timeAgo, capitalizeFirst, titleOrUnknown } from "../lib/format";
import type { Intent, Interaction, IntentReviewStatus } from "../types";
import type { ThreatListItem, TopThreat } from "../data/api";
import type { CSSProperties } from "react";

/** Reddish tint + left accent for any row that represents/carries a threat. */
const THREAT_ROW_STYLE: CSSProperties = {
  background: "rgba(220,38,38,0.045)",
  boxShadow: "inset 3px 0 0 var(--threat)",
};

// Matches the pill styling used on the main Intents page (IntentsPage.tsx) so
// review status looks identical everywhere it's shown.
const REVIEW_STATUS_STYLE: Record<IntentReviewStatus, { color: string; bg: string }> = {
  Ongoing: { color: "var(--accent)", bg: "rgba(37,99,235,0.10)" },
  Acknowledged: { color: "var(--safe)", bg: "rgba(5,150,105,0.10)" },
  Flagged: { color: "var(--threat)", bg: "rgba(220,38,38,0.10)" },
};

const REVIEW_STATUS_OPTIONS: IntentReviewStatus[] = ["Flagged", "Ongoing", "Acknowledged"];
const SEVERITY_OPTIONS: ThreatSeverity[] = ["Critical", "High", "Medium", "Low"];
const SEVERITY_RANK: Record<ThreatSeverity, number> = { Critical: 4, High: 3, Medium: 2, Low: 1, Warning: 0 };
const severityRank = (s: ThreatSeverity | null) => (s ? SEVERITY_RANK[s] : -1);

const REVIEW_STATUS_ICON: Record<IntentReviewStatus, "flag" | "refresh" | "check"> = {
  Flagged: "flag",
  Ongoing: "refresh",
  Acknowledged: "check",
};

/** Colored pill + icon for an intent/threat's review status — shared by the Intents and Threats tables below. */
function ReviewStatusPill({ status }: { status: IntentReviewStatus }) {
  const s = REVIEW_STATUS_STYLE[status];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        fontSize: 11.5,
        fontWeight: 700,
        padding: "3px 10px",
        borderRadius: 999,
        color: s.color,
        background: s.bg,
      }}
    >
      {status === "Flagged" ? (
        // Filled flag (not just an outline) so a flagged threat reads as more
        // alarming than a plain stroked icon would.
        <svg width={11} height={11} viewBox="0 0 24 24" fill={s.color} stroke={s.color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 3v18" fill="none" />
          <path d="M5 4h13l-3 4 3 4H5" />
        </svg>
      ) : (
        <Icon name={REVIEW_STATUS_ICON[status]} size={11} />
      )}
      {status}
    </span>
  );
}

/** Plain `<select>` styled to sit in a `.tb-toolbar`, used for the Status/Severity table filters below. */
function FilterSelect<T extends string>({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: T | "all";
  onChange: (v: T | "all") => void;
  options: T[];
  placeholder: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T | "all")}
      style={{
        fontSize: 12.5,
        fontWeight: 600,
        padding: "6px 10px",
        borderRadius: 8,
        border: "1px solid var(--line)",
        background: "var(--surface)",
        color: "var(--fg)",
        cursor: "pointer",
      }}
    >
      <option value="all">{placeholder}</option>
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

const SEVERITY_DONUT_COLORS: Record<"Critical" | "High" | "Medium" | "Low", string> = {
  Critical: "#7F1D1D",
  High: "#DC2626",
  Medium: "#B45309",
  Low: "#2563EB",
};

/**
 * Segmented bar (+ legend row) showing the Critical/High/Medium/Low share of
 * the top-5 threats by volume, weighted by each threat's count. Sits at the
 * top of the "Top 5 threats" card, above the table. Threats with no matching
 * severity (or "Warning") are excluded from both the bar and the percentage
 * base.
 */
function SeverityBar({ topThreats }: { topThreats: TopThreat[] }) {
  const buckets: Record<"Critical" | "High" | "Medium" | "Low", number> = { Critical: 0, High: 0, Medium: 0, Low: 0 };
  let total = 0;
  for (const t of topThreats) {
    const sev = getThreatSeverity(t.threatCode);
    if (sev === "Critical" || sev === "High" || sev === "Medium" || sev === "Low") {
      buckets[sev] += t.count;
      total += t.count;
    }
  }

  if (total === 0) return null;

  const keys = (Object.keys(SEVERITY_DONUT_COLORS) as (keyof typeof SEVERITY_DONUT_COLORS)[]).filter((k) => buckets[k] > 0);

  return (
    <div style={{ padding: "14px 20px 16px" }}>
      <div style={{ display: "flex", width: "100%", height: 8, borderRadius: 999, overflow: "hidden" }}>
        {keys.map((key) => (
          <div key={key} style={{ width: `${(buckets[key] / total) * 100}%`, background: SEVERITY_DONUT_COLORS[key] }} />
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10, flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
          {keys.map((key) => (
            <div key={key} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: SEVERITY_DONUT_COLORS[key], flexShrink: 0 }} />
              <span style={{ color: "var(--fg-muted)" }}>{key}</span>
              <span style={{ color: "var(--fg)", fontWeight: 700 }}>{Math.round((buckets[key] / total) * 100)}%</span>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 13, color: "var(--fg-muted)" }}>
          Total <span style={{ color: "var(--fg)", fontWeight: 700 }}>{total}</span>
        </div>
      </div>
    </div>
  );
}

/**
 * A threats-list row is already interaction-shaped — convert it so the
 * drawer can show it directly, with `message` inline (no GET /threat-by-id
 * round trip, and no risk of it showing something different from this table).
 */
function threatToInteraction(t: ThreatListItem): Interaction {
  return {
    id: t.interactionID,
    initiator: t.initiator,
    target: t.target,
    targetType: "agent",
    intent: { id: t.intentID, name: "" },
    runtime: 0,
    threat: true,
    created: t.time,
    threatID: t.threatID,
    message: t.message,
  };
}

export function HomePage() {
  // Fixed at 7d — the 30-day range is parked until /interactions/series
  // stops 400ing on range=30d.
  const series = "7d";

  const navigate = useNavigate();
  const { openDrawer } = useDrawer();
  const resolve = useResolveName();

  const [bottomTab, setBottomTab] = useState<"intents" | "threats">("intents");
  const [intentsPage, setIntentsPage] = useState(1);
  const [threatsPage, setThreatsPage] = useState(1);
  const [volumeTab, setVolumeTab] = useState<"agents" | "apps">("agents");
  const [chartTab, setChartTab] = useState<"graph" | "threats">("graph");
  const [threatMessage, setThreatMessage] = useState<ThreatListItem | null>(null);
  const [intentStatusFilter, setIntentStatusFilter] = useState<IntentReviewStatus | "all">("all");
  const [threatStatusFilter, setThreatStatusFilter] = useState<IntentReviewStatus | "all">("all");
  const [threatSeverityFilter, setThreatSeverityFilter] = useState<ThreatSeverity | "all">("all");

  const homeState = useHomeMetrics();
  const intentsState = useIntentsPaged(intentsPage);
  const threatsListState = useThreatsListPaged(threatsPage);
  const { data: topThreats, error: topThreatsError } = useTopThreats();
  const seriesState = useSeries(series);
  const { data: agentsAppsMetrics } = useAgentsAppsMetrics();

  // Belt-and-suspenders for the "Apps interacted" icons bug: enrichIntentApps
  // (in api.ts) already awaits waitForDirectoryReady() before classifying
  // tools vs agents, but if that ever loses the race anyway (e.g. a pathological
  // slow load past its own backstop timeout), self-heal by refetching intents
  // once the directory *actually* finishes loading, instead of requiring a
  // manual page refresh. Only fires on the loading→loaded transition, not on
  // every render, and not if the directory was already loaded when this page
  // mounted (the common case when navigating here from elsewhere).
  const directoryLoading = useDirectoryLoading();
  const prevDirectoryLoading = useRef(directoryLoading);
  useEffect(() => {
    if (prevDirectoryLoading.current && !directoryLoading) {
      intentsState.refetch();
    }
    prevDirectoryLoading.current = directoryLoading;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [directoryLoading]);

  const metrics = homeState.data;
  const intents = intentsState.data.items;
  const intentsTotal = intentsState.data.total;
  const intentsTotalPages = intentsState.data.totalPages;
  const threatsList = threatsListState.data.items;
  const threatsListTotal = threatsListState.data.total;
  const threatsListTotalPages = threatsListState.data.totalPages;

  // Client-side filters over the currently loaded page — the backend has no
  // filter query params for these endpoints yet, so this filters what's on
  // screen rather than re-querying the server.
  const filteredIntents = useMemo(
    () => (intentStatusFilter === "all" ? intents : intents.filter((i) => i.reviewStatus === intentStatusFilter)),
    [intents, intentStatusFilter],
  );
  const filteredThreatsList = useMemo(
    () =>
      threatsList.filter(
        (t) =>
          (threatStatusFilter === "all" || t.reviewStatus === threatStatusFilter) &&
          (threatSeverityFilter === "all" || getThreatSeverity(t.threatCode) === threatSeverityFilter),
      ),
    [threatsList, threatStatusFilter, threatSeverityFilter],
  );
  const data = seriesState.data;

  // Actual calendar dates for the trailing window, oldest → newest, matching the
  // bucket order the series comes back in. Weekday names were ambiguous — they
  // don't say which week, and they never moved with the data.
  const dayCount = 7;
  const labels = useMemo(() => {
    const today = new Date();
    return Array.from({ length: dayCount }, (_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() - (dayCount - 1 - i));
      return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    });
  }, [dayCount]);

  const isEmpty = !homeState.loading && metrics.agentCount === 0;

  const intentCols: DataTableColumn<Intent>[] = [
    {
      key: "id",
      label: "Intent",
      render: (r) => (
        <IntentIdChip id={r.id} style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 600, color: "var(--fg)" }} />
      ),
    },
    {
      key: "initiator",
      label: "Initiator",
      render: (r) => (
        <span style={{ fontSize: 13, color: "var(--fg)", fontWeight: 600 }}>{capitalizeFirst(resolveDisplayName(resolve, r.initiator))}</span>
      ),
    },
    {
      key: "interactions",
      label: "Interactions",
      render: (r) => <span style={{ fontFamily: "var(--font-mono)", fontSize: 12.5 }}>{r.interactionsCount}</span>,
    },
    {
      key: "apps",
      label: "Apps interacted",
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
      label: "Incidents",
      render: (r) => <ThreatPill threat={r.threats > 0} />,
    },
    {
      key: "reviewStatus",
      label: "Status",
      render: (r) => <ReviewStatusPill status={r.reviewStatus} />,
    },
    {
      key: "time",
      label: "Time",
      align: "right",
      render: (r) => (
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, color: "var(--fg-muted)" }}>{timeAgo(r.started)}</span>
      ),
    },
    {
      key: "actions",
      label: "",
      align: "right",
      width: 90,
      render: (r) => (
        <div className="row-actions">
          <button
            className="btn-mini info"
            style={{ whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: 5 }}
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/intents/${r.id}`);
            }}
          >
            <Icon name="arrowUpRight" size={12} />
            Inspect
          </button>
        </div>
      ),
    },
  ];

  const threatsListCols: DataTableColumn<ThreatListItem>[] = [
    {
      key: "intent",
      label: "Intent",
      width: "13%",
      sortFn: (a, b) => a.intentID.localeCompare(b.intentID),
      render: (r) => (
        <IntentIdChip id={r.intentID} style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, fontWeight: 600, color: "var(--fg)" }} />
      ),
    },
    {
      key: "title",
      label: "Title",
      width: "20%",
      sortFn: (a, b) => titleOrUnknown(a.threatTitle).localeCompare(titleOrUnknown(b.threatTitle)),
      render: (r) => (
        <span style={{ fontSize: 13, color: "var(--fg)", fontWeight: 600 }}>
          {capitalizeFirst(titleOrUnknown(r.threatTitle))}
        </span>
      ),
    },
    {
      key: "severity",
      label: "Severity",
      width: "14%",
      sortFn: (a, b) => severityRank(getThreatSeverity(a.threatCode)) - severityRank(getThreatSeverity(b.threatCode)),
      render: (r) => <SeverityPill severity={getThreatSeverity(r.threatCode)} />,
    },
    {
      key: "reviewStatus",
      label: "Status",
      width: "14%",
      sortFn: (a, b) => a.reviewStatus.localeCompare(b.reviewStatus),
      render: (r) => <ReviewStatusPill status={r.reviewStatus} />,
    },
    {
      key: "time",
      label: "Time",
      align: "right",
      width: "13%",
      sortFn: (a, b) => a.time - b.time,
      render: (r) => (
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, color: "var(--fg-muted)", paddingRight: 8 }}>{capitalizeFirst(timeAgo(r.time))}</span>
      ),
    },
    {
      key: "actions",
      label: "Action",
      align: "right",
      width: "26%",
      render: (r) => (
        <div className="row-actions" style={{ flexWrap: "nowrap" }}>
          <button
            className="btn-mini danger"
            style={{ whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: 5 }}
            onClick={(e) => {
              e.stopPropagation();
              setThreatMessage(r);
            }}
          >
            <Icon name="eye" size={12} />
            View Message
          </button>
          <button
            className="btn-mini info"
            style={{ whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: 5 }}
            onClick={(e) => {
              e.stopPropagation();
              openDrawer("interaction", threatToInteraction(r));
            }}
          >
            <Icon name="arrowUpRight" size={12} />
            Inspect Incident
          </button>
        </div>
      ),
    },
  ];

  function handleExport() {
    const rows: string[][] = [
      ["AgentDNA Dashboard Export", new Date().toISOString()],
      [],
      ["SUMMARY"],
      ["Metric", "Value"],
      ["Active Agents", String(metrics.agentCount)],
      ["Total Intents", String(metrics.intentCount)],
      ["Total Interactions", String(metrics.interactionsCount)],
      ["Incidents Detected", String(metrics.threatCount)],
      [],
      ["AGENT LIST"],
      ["Agent ID", "Agent Name", "Total Interactions", "Total Incidents"],
      ...(metrics.agentList || []).map((a) => [a.agentID, a.agentName, String(a.totalInteractions), String(a.totalThreats)]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `agentdna-dashboard-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (isEmpty) {
    return (
      <div className="page" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "70vh", gap: 0 }}>
        <div
          style={{
            maxWidth: 460,
            width: "100%",
            textAlign: "center",
            padding: "48px 40px",
            background: "var(--surface)",
            border: "1.5px dashed var(--line-strong)",
            borderRadius: 16,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 16,
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 14,
              background: "linear-gradient(135deg, rgba(37,99,235,0.12), rgba(10,34,64,0.10))",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 4,
            }}
          >
            <Icon name="agents" size={26} style={{ color: "var(--accent)" }} />
          </div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "var(--fg)", marginBottom: 8 }}>
              No agents deployed yet
            </div>
            <div style={{ fontSize: 14, color: "var(--fg-muted)", lineHeight: 1.6 }}>
              Deploy your first agent to start monitoring interactions, detecting incidents, and tracking intents in real time.
            </div>
          </div>
          <button
            className="btn primary"
            style={{ marginTop: 8, padding: "10px 24px", fontSize: 14, fontWeight: 600 }}
            onClick={() => navigate("/profile")}
          >
            <Icon name="key" size={15} />
            Deploy your first agent
          </button>
          <div style={{ fontSize: 12, color: "var(--fg-faint)", marginTop: 4 }}>
            You can also browse existing{" "}
            <span
              style={{ color: "var(--accent)", cursor: "pointer", textDecoration: "underline" }}
              onClick={() => navigate("/agents")}
            >
              Agents & Apps
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Dashboard</h1>
          <div className="sub">
            Real-time observability across {metrics.agentCount} agents and {metrics.intentCount} intents
          </div>
        </div>
        <div className="right">
<button className="btn">
            <Icon name="refresh" size={14} />
            Refresh
          </button>
          <button className="btn primary" onClick={handleExport}>
            <Icon name="download" size={14} />
            Export
          </button>
        </div>
      </div>

      <div className="metrics">
        <MetricTile label="Active Agents" value={metrics.agentCount} icon="agents" sparkColor="#2563EB" spark={[]} />
        <MetricTile
          label="Total Interactions"
          value={metrics.interactionsCount >= 1000 ? (metrics.interactionsCount / 1000).toFixed(1) : metrics.interactionsCount}
          unit={metrics.interactionsCount >= 1000 ? "k" : undefined}
          icon="activity"
          sparkColor="#0EA5E9"
          spark={data.total}
        />
        <MetricTile label="Incidents Detected" value={metrics.threatCount} icon="shield" sparkColor="#DC2626" spark={data.threats} />
        <MetricTile label="Total Intents" value={metrics.intentCount} icon="intents" sparkColor="#0A2240" spark={[]} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1.4fr", gap: 16, marginBottom: 20 }}>
        <div className={`card${chartTab === "threats" ? " card-threat" : ""}`}>
          <div className="card-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
              {chartTab === "threats" && (
                <div style={{ width: 30, height: 30, borderRadius: 8, background: "rgba(220,38,38,0.14)", display: "grid", placeItems: "center", flexShrink: 0, marginTop: 1 }}>
                  <Icon name="shield" size={15} style={{ color: "var(--threat)" }} />
                </div>
              )}
              <div>
                <h3>{chartTab === "graph" ? "Interactions over time" : "Top 5 incidents by volume"}</h3>
                <div className="sub">
                  {chartTab === "graph" ? "Safe vs incident-classified runs · Last 7 days" : "By volume, most frequent codes"}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", background: chartTab === "threats" ? "rgba(220,38,38,0.08)" : "var(--bg-3)", borderRadius: 6, padding: 2 }}>
              {([{ key: "graph", label: "Graph" }, { key: "threats", label: "Incidents" }] as const).map((t) => {
                const active = chartTab === t.key;
                const redActive = active && t.key === "threats";
                return (
                  <button
                    key={t.key}
                    onClick={() => setChartTab(t.key)}
                    style={{
                      background: redActive ? "var(--threat)" : active ? "var(--surface)" : "transparent",
                      border: "none",
                      borderRadius: 5,
                      padding: "4px 10px",
                      fontSize: 11,
                      fontWeight: 600,
                      color: redActive ? "#fff" : active ? "var(--fg)" : "var(--fg-muted)",
                      cursor: "pointer",
                      boxShadow: active && !redActive ? "0 1px 3px rgba(0,0,0,0.15)" : "none",
                      transition: "all 120ms",
                    }}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>

          {chartTab === "graph" ? (
            <>
              <div className="chart-legend">
                <span className="it">
                  <span className="sw" style={{ background: "#2563EB" }} /> Interactions
                </span>
                <span className="it">
                  <span className="sw" style={{ background: "#DC2626" }} /> Incidents
                </span>
              </div>
              <div className="chart-wrap">
                <Chart
                  labels={labels}
                  style="bar"
                  height={272}
                  formatY={(v) => (typeof v === "number" && v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v)}
                  series={[
                    { key: "interactions", label: "Interactions", color: "#2563EB", data: data.total },
                    { key: "threats", label: "Incidents", color: "#DC2626", data: data.threats },
                  ]}
                />
              </div>
            </>
          ) : (
            <>
              {!topThreatsError && topThreats.length > 0 && <SeverityBar topThreats={topThreats} />}
              <div style={{ display: "grid", gridTemplateColumns: "26px 1fr 80px 60px", padding: "10px 16px 5px", borderBottom: "1px solid rgba(220,38,38,0.18)", marginTop: 8 }}>
                {["#", "INCIDENT", "SEVERITY", "COUNT"].map((h, i) => (
                  <div key={h} style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "0.07em", color: "var(--fg-muted)", textTransform: "uppercase" as const, textAlign: (i > 1 ? "right" : "left") as "right" | "left" }}>{h}</div>
                ))}
              </div>
              {topThreatsError ? (
                <div style={{ padding: 28, color: "var(--threat)", fontSize: 12.5, textAlign: "center" }}>
                  Failed to load top incidents — {topThreatsError.message}
                </div>
              ) : topThreats.length === 0 && (
                <div style={{ padding: 28, color: "var(--fg-muted)", fontSize: 12.5, textAlign: "center" }}>No incidents detected</div>
              )}
              {!topThreatsError && topThreats.map((t, i) => (
                <div
                  key={t.threatCode}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "26px 1fr 80px 60px",
                    alignItems: "center",
                    padding: "8px 16px",
                    borderBottom: "1px solid rgba(220,38,38,0.14)",
                    background: i === 0 ? "rgba(220,38,38,0.09)" : "transparent",
                    boxShadow: i === 0 ? "inset 3px 0 0 var(--threat)" : "inset 3px 0 0 transparent",
                  }}
                >
                  <div
                    style={{
                      width: 21,
                      height: 21,
                      borderRadius: 6,
                      display: "grid",
                      placeItems: "center",
                      fontFamily: "var(--font-mono)",
                      fontSize: 9.5,
                      fontWeight: 700,
                      background: i === 0 ? "var(--threat)" : "rgba(220,38,38,0.12)",
                      color: i === 0 ? "#fff" : "var(--threat)",
                    }}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </div>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--fg)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{titleOrUnknown(t.title)}</div>
                  <div style={{ textAlign: "right" }}>
                    <SeverityPill severity={getThreatSeverity(t.threatCode)} />
                  </div>
                  <div style={{ textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 12.5, fontWeight: 700, color: "var(--fg)", fontVariantNumeric: "tabular-nums" }}>
                    {t.count.toLocaleString()}
                  </div>
                </div>
              ))}
              {!topThreatsError && topThreats.length > 0 && (
                <div style={{ padding: "12px 16px" }}>
                  <button
                    onClick={() => setBottomTab("threats")}
                    style={{ background: "none", border: "none", fontSize: 12.5, fontWeight: 600, color: "var(--threat)", cursor: "pointer", padding: 0 }}
                  >
                    View all incidents →
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        <div
          className="card"
          style={{
            display: "flex", flexDirection: "column", padding: 0, overflow: "hidden",
            background: volumeTab === "apps" ? "#0b1633" : undefined,
            transition: "background 200ms",
          }}
        >
          {/* Header */}
          <div style={{ padding: "18px 20px 0", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: volumeTab === "apps" ? "#fff" : "var(--fg)", marginBottom: 2 }}>
                Top {volumeTab === "agents" ? "agents" : "apps"} by volume
              </div>
              <div style={{ fontSize: 12, color: volumeTab === "apps" ? "rgba(255,255,255,0.45)" : "var(--fg-muted)" }}>
                {volumeTab === "agents" ? "Ranked by interactions · incidents flagged" : "Ranked by interactions · share of total"}
              </div>
            </div>
            <div style={{ display: "flex", background: volumeTab === "apps" ? "rgba(255,255,255,0.07)" : "var(--bg-3)", borderRadius: 6, padding: 2 }}>
              {(["agents", "apps"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setVolumeTab(t)}
                  style={{
                    background: volumeTab === t ? (t === "apps" ? "rgba(255,255,255,0.12)" : "var(--surface)") : "transparent",
                    border: "none",
                    borderRadius: 5,
                    padding: "4px 10px",
                    fontSize: 11,
                    fontWeight: 600,
                    color: volumeTab === t
                      ? (volumeTab === "apps" ? "#fff" : "var(--fg)")
                      : (volumeTab === "apps" ? "rgba(255,255,255,0.45)" : "var(--fg-muted)"),
                    cursor: "pointer",
                    boxShadow: volumeTab === t ? "0 1px 3px rgba(0,0,0,0.15)" : "none",
                    transition: "all 120ms",
                    textTransform: "capitalize",
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Agents view */}
          {volumeTab === "agents" && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "44px 1fr 92px", padding: "12px 20px 6px", borderBottom: "1px solid var(--line)" }}>
                {["#", "AGENT", "IXNS"].map((h, i) => (
                  <div key={h} style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.07em", color: "var(--fg-muted)", textTransform: "uppercase" as const, textAlign: (i > 1 ? "right" : "left") as "right" | "left" }}>{h}</div>
                ))}
              </div>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignContent: "flex-start" }}>
                {metrics.agentList.length === 0 && (
                  <div style={{ padding: 24, color: "var(--fg-muted)", fontSize: 13, textAlign: "center" }}>
                    {homeState.loading ? "Loading…" : "No agents yet."}
                  </div>
                )}
                {(() => {
                  return metrics.agentList.map((a, i) => {
                    return (
                      <div
                        key={a.agentID}
                        onClick={() => navigate(`/agents/${a.agentID}`)}
                        style={{ display: "grid", gridTemplateColumns: "44px 1fr 92px", alignItems: "center", padding: "10px 20px", cursor: "pointer", borderBottom: "1px solid var(--line)" }}
                        onMouseEnter={(e) => ((e.currentTarget as HTMLDivElement).style.background = "var(--bg-2)")}
                        onMouseLeave={(e) => ((e.currentTarget as HTMLDivElement).style.background = "transparent")}
                      >
                        <div style={{ width: 28, height: 28, borderRadius: 8, display: "grid", placeItems: "center", fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, background: i === 0 ? "#0a2240" : "var(--bg-3)", color: i === 0 ? "#fff" : "var(--fg-muted)" }}>
                          {String(i + 1).padStart(2, "0")}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--fg)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.agentName}</div>
                        </div>
                        <div style={{ textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 600, color: "var(--fg)", fontVariantNumeric: "tabular-nums" }}>
                          {a.totalInteractions.toLocaleString()}
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
              <div style={{ padding: "12px 20px", borderTop: "1px solid var(--line)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 12, color: "var(--fg-muted)" }}>Showing top {metrics.agentList.length} of {metrics.agentCount} agents</span>
                <button onClick={() => navigate("/agents", { state: { tab: "agents" } })} style={{ background: "none", border: "none", fontSize: 12, fontWeight: 600, color: "var(--accent)", cursor: "pointer", padding: 0 }}>View all agents →</button>
              </div>
            </>
          )}

          {/* Apps view — matches TopAppsList dark design */}
          {volumeTab === "apps" && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "36px 22px 1fr 76px 72px", padding: "12px 20px 6px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                {["#", "", "APP", "IXNS", "SHARE"].map((h, i) => (
                  <div key={i} style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.07em", color: "rgba(255,255,255,0.35)", textTransform: "uppercase" as const, textAlign: (i > 2 ? "right" : "left") as "right" | "left" }}>{h}</div>
                ))}
              </div>
              <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                {agentsAppsMetrics.topApps.length === 0 && (
                  <div style={{ padding: 24, color: "rgba(255,255,255,0.35)", fontSize: 14, textAlign: "center" }}>No apps yet.</div>
                )}
                {(() => {
                  const totalIxns = agentsAppsMetrics.topApps.reduce((s, a) => s + a.totalInteractions, 0) || 1;
                  const maxIxns = agentsAppsMetrics.topApps.reduce((m, a) => Math.max(m, a.totalInteractions), 0) || 1;
                  return agentsAppsMetrics.topApps.map((a, i) => {
                    const share = Math.round((a.totalInteractions / totalIxns) * 100);
                    const barPct = (a.totalInteractions / maxIxns) * 100;
                    return (
                      <div
                        key={a.name}
                        onClick={() => navigate(`/tools/${encodeURIComponent(a.name)}`)}
                        style={{ cursor: "pointer", borderBottom: "1px solid rgba(255,255,255,0.05)", padding: "0 20px" }}
                        onMouseEnter={(e) => ((e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.04)")}
                        onMouseLeave={(e) => ((e.currentTarget as HTMLDivElement).style.background = "transparent")}
                      >
                        <div style={{ display: "grid", gridTemplateColumns: "36px 22px 1fr 76px 72px", alignItems: "center", padding: "10px 0 4px" }}>
                          <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700, color: i === 0 ? "#fff" : "rgba(255,255,255,0.4)" }}>
                            {String(i + 1).padStart(2, "0")}
                          </div>
                          <AppIcon name={a.name} size={22} />
                          <div style={{ fontSize: 14, fontWeight: 500, color: "#fff", fontFamily: "var(--font-mono)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", paddingLeft: 6 }}>{a.name}</div>
                          <div style={{ textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 600, color: "#fff", fontVariantNumeric: "tabular-nums" }}>
                            {a.totalInteractions.toLocaleString()}
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
                  });
                })()}
              </div>
              <div style={{ padding: "12px 20px", borderTop: "1px solid rgba(255,255,255,0.07)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 13, color: "rgba(255,255,255,0.35)" }}>Showing top {agentsAppsMetrics.topApps.length} of {agentsAppsMetrics.metrics.totalApps} apps</span>
                <button onClick={() => navigate("/agents", { state: { tab: "tools" } })} style={{ background: "none", border: "none", fontSize: 13, fontWeight: 600, color: "#5f83e8", cursor: "pointer", padding: 0 }}>View all apps →</button>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="card">
        <div className="tb-toolbar">
          <div className="filters">
            {([{ key: "intents", label: "Intents", count: intentsTotal }, { key: "threats", label: "Incidents", count: threatsListTotal }] as const).map((t) => (
              <div
                key={t.key}
                className={`tab ${bottomTab === t.key ? "active" : ""}`}
                onClick={() => setBottomTab(t.key)}
              >
                {t.label}
                <span className="pill">{t.count}</span>
              </div>
            ))}
          </div>
          {bottomTab === "intents" && (
            <FilterSelect value={intentStatusFilter} onChange={setIntentStatusFilter} options={REVIEW_STATUS_OPTIONS} placeholder="All statuses" />
          )}
          {bottomTab === "threats" && (
            <>
              <FilterSelect value={threatStatusFilter} onChange={setThreatStatusFilter} options={REVIEW_STATUS_OPTIONS} placeholder="All statuses" />
              <FilterSelect value={threatSeverityFilter} onChange={setThreatSeverityFilter} options={SEVERITY_OPTIONS} placeholder="All severities" />
            </>
          )}
          {bottomTab === "intents" && (
            <Pagination page={intentsPage} totalPages={intentsTotalPages} total={intentsTotal} pageSize={10} inline onChange={setIntentsPage} />
          )}
          {bottomTab === "threats" && (
            <Pagination page={threatsPage} totalPages={threatsListTotalPages} total={threatsListTotal} pageSize={10} inline onChange={setThreatsPage} />
          )}
        </div>
        {bottomTab === "intents" ? (
          <DataTable
            rows={filteredIntents}
            columns={intentCols}
            onRowClick={(r) => navigate(`/intents/${r.id}`)}
            emptyText={intentStatusFilter === "all" ? "No intents yet" : `No ${intentStatusFilter.toLowerCase()} intents on this page`}
            rowStyle={(r) => (r.threats > 0 ? THREAT_ROW_STYLE : undefined)}
          />
        ) : (
          <DataTable
            rows={filteredThreatsList}
            columns={threatsListCols}
            onRowClick={(r) => openDrawer("interaction", threatToInteraction(r))}
            emptyText={
              threatsListState.error
                ? `Failed to load incidents — ${threatsListState.error.message}`
                : threatStatusFilter === "all" && threatSeverityFilter === "all"
                  ? "No incidents detected"
                  : "No incidents match this filter on this page"
            }
            // Every row here is a threat by definition.
            rowStyle={() => THREAT_ROW_STYLE}
          />
        )}
      </div>

      <Modal
        open={!!threatMessage}
        title="Incident message"
        onClose={() => setThreatMessage(null)}
        width={560}
        footer={
          <button type="button" className="btn primary" onClick={() => setThreatMessage(null)}>
            Close
          </button>
        }
      >
        {threatMessage && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div
              style={{
                background: "var(--bg-2)",
                border: "1px solid var(--line)",
                borderRadius: 10,
                padding: "14px 16px",
                fontSize: 13.5,
                color: "var(--fg)",
                lineHeight: 1.6,
                wordBreak: "break-word",
              }}
            >
              {capitalizeFirst(threatMessage.message)}
            </div>
            <div className="kv" style={{ fontSize: 12.5 }}>
              <div className="k">Initiator</div>
              <div className="v">{capitalizeFirst(resolveDisplayName(resolve, threatMessage.initiator))}</div>
              {threatMessage.initiator.id !== threatMessage.target.id && (
                <>
                  <div className="k">Interacted with</div>
                  <div className="v">{capitalizeFirst(resolveDisplayName(resolve, threatMessage.target))}</div>
                </>
              )}
              <div className="k">Intent</div>
              <div className="v">
                <IntentIdChip id={threatMessage.intentID} style={{ fontFamily: "var(--font-mono)", fontSize: 12.5 }} />
              </div>
              <div className="k">Time</div>
              <div className="v">{capitalizeFirst(timeAgo(threatMessage.time))}</div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

