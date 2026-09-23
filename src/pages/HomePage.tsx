import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "../components/Icon";
import { Modal } from "../components/Modal";

import { Chart } from "../components/Chart";
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
import type { ThreatListItem } from "../data/api";
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
/** Incidents card legend + severity bar (and the matching swatches in its info popup). */
const INCIDENT_SEVERITY_COLORS = {
  Critical: "#7F1D1D",
  High: "#E57373",
  Medium: "#FFB74D",
  Low: "#10B981",
} as const;
/** "Safe" share in the Interactions/Intents bars and the Agents "Active" bar — same green as Low severity. */
const SAFE_COLOR = "#10B981";
/** Incident / blocked share in the Interactions & Intents bars and the incidents chart series — the High severity red. */
const INCIDENT_COLOR = INCIDENT_SEVERITY_COLORS.High;
/** Top Threats card lists at most this many error codes, however many /top-threats returns. */
const TOP_THREATS_LIMIT = 5;

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

/** Info modal shared by the Interactions / Agents / Intents metric cards. */
function MetricInfoModal({
  open, onClose, title, intro, rows, tip,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  intro: React.ReactNode;
  rows: { color: string; label: string; text: string }[];
  tip: React.ReactNode;
}) {
  return (
    <Modal
      open={open}
      title={title}
      onClose={onClose}
      width={560}
      footer={<button type="button" className="btn primary" onClick={onClose}>Got it</button>}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ fontSize: 14, color: "var(--fg-dim)", lineHeight: 1.6 }}>{intro}</div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--fg)", letterSpacing: "0.02em", textTransform: "uppercase" }}>
            What the bar shows
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {rows.map((r) => (
              <div key={r.label} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <div style={{ width: 16, height: 16, borderRadius: 4, background: r.color, flexShrink: 0, marginTop: 2 }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--fg)", marginBottom: 2 }}>{r.label}</div>
                  <div style={{ fontSize: 12, color: "var(--fg-muted)", lineHeight: 1.5 }}>{r.text}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ padding: "12px 14px", background: "rgba(37, 99, 235, 0.06)", border: "1px solid rgba(37, 99, 235, 0.15)", borderRadius: 8, fontSize: 12, color: "var(--fg-dim)", lineHeight: 1.5 }}>
          <strong style={{ color: "var(--accent)" }}>Tip:</strong> {tip}
        </div>
      </div>
    </Modal>
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
  const [showThreatsInfo, setShowThreatsInfo] = useState(false);
  /** Which metric card's info modal is open (Incidents has its own flag above). */
  const [infoCard, setInfoCard] = useState<"interactions" | "agents" | "intents" | null>(null);

  const homeState = useHomeMetrics();
  const intentsState = useIntentsPaged(intentsPage);
  const threatsListState = useThreatsListPaged(threatsPage);
  const { data: topThreats, error: topThreatsError } = useTopThreats();
  // Only the card's list is capped — the severity totals below still sum every code.
  const topThreatsShown = useMemo(
    () => [...(topThreats || [])].sort((a, b) => b.count - a.count).slice(0, TOP_THREATS_LIMIT),
    [topThreats],
  );
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
        <IntentIdChip id={r.id} style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 600, color: "var(--fg)" }} />
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
      render: (r) => <span style={{ fontFamily: "var(--font-mono)", fontSize: 13 }}>{r.interactionsCount}</span>,
    },
    {
      key: "apps",
      label: "Apps interacted",
      render: (r) => {
        const apps = r.appsInteracted || [];
        if (apps.length === 0) {
          return <span style={{ color: "var(--fg-faint)", fontFamily: "var(--font-mono)", fontSize: 13 }}>—</span>;
        }
        return (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {apps.slice(0, 3).map((app) => (
              <AppIcon key={app.id} name={resolveDisplayName(resolve, app)} size={20} />
            ))}
            {apps.length > 3 && (
              <span style={{ fontSize: 13, color: "var(--fg-muted)", fontFamily: "var(--font-mono)" }}>+{apps.length - 3}</span>
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
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--fg-muted)" }}>{timeAgo(r.started)}</span>
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
            style={{
              whiteSpace: "nowrap",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 12px",
              fontSize: 11.5,
              fontWeight: 600,
              borderRadius: 7,
              border: "1px solid rgba(37,99,235,0.25)",
              background: "rgba(37,99,235,0.06)",
              color: "var(--accent)",
              cursor: "pointer",
              transition: "all 120ms ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--accent)";
              e.currentTarget.style.borderColor = "var(--accent)";
              e.currentTarget.style.color = "#fff";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(37,99,235,0.06)";
              e.currentTarget.style.borderColor = "rgba(37,99,235,0.25)";
              e.currentTarget.style.color = "var(--accent)";
            }}
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/intents/${r.id}`);
            }}
          >
            <Icon name="arrowUpRight" size={11} />
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
        <IntentIdChip id={r.intentID} style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 600, color: "var(--fg)" }} />
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
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--fg-muted)", paddingRight: 8 }}>{capitalizeFirst(timeAgo(r.time))}</span>
      ),
    },
    {
      key: "actions",
      label: "Action",
      align: "right",
      width: "26%",
      render: (r) => (
        <div className="row-actions" style={{ flexWrap: "nowrap", gap: 6 }}>
          <button
            style={{
              whiteSpace: "nowrap",
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              padding: "6px 11px",
              fontSize: 11.5,
              fontWeight: 600,
              borderRadius: 7,
              border: "1px solid rgba(220,38,38,0.28)",
              background: "rgba(220,38,38,0.06)",
              color: "var(--threat)",
              cursor: "pointer",
              transition: "all 120ms ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--threat)";
              e.currentTarget.style.borderColor = "var(--threat)";
              e.currentTarget.style.color = "#fff";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(220,38,38,0.06)";
              e.currentTarget.style.borderColor = "rgba(220,38,38,0.28)";
              e.currentTarget.style.color = "var(--threat)";
            }}
            onClick={(e) => {
              e.stopPropagation();
              setThreatMessage(r);
            }}
          >
            <Icon name="eye" size={11} />
            Message
          </button>
          <button
            style={{
              whiteSpace: "nowrap",
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              padding: "6px 11px",
              fontSize: 11.5,
              fontWeight: 600,
              borderRadius: 7,
              border: "1px solid rgba(37,99,235,0.25)",
              background: "rgba(37,99,235,0.06)",
              color: "var(--accent)",
              cursor: "pointer",
              transition: "all 120ms ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--accent)";
              e.currentTarget.style.borderColor = "var(--accent)";
              e.currentTarget.style.color = "#fff";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(37,99,235,0.06)";
              e.currentTarget.style.borderColor = "rgba(37,99,235,0.25)";
              e.currentTarget.style.color = "var(--accent)";
            }}
            onClick={(e) => {
              e.stopPropagation();
              openDrawer("interaction", threatToInteraction(r));
            }}
          >
            <Icon name="arrowUpRight" size={11} />
            Inspect
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

  // Calculate critical/high severity threat counts
  const criticalThreats = (topThreats || []).filter(t => getThreatSeverity(t.threatCode) === "Critical").reduce((sum, t) => sum + t.count, 0);
  const highThreats = (topThreats || []).filter(t => getThreatSeverity(t.threatCode) === "High").reduce((sum, t) => sum + t.count, 0);
  const mediumThreats = (topThreats || []).filter(t => getThreatSeverity(t.threatCode) === "Medium").reduce((sum, t) => sum + t.count, 0);
  const lowThreats = (topThreats || []).filter(t => getThreatSeverity(t.threatCode) === "Low").reduce((sum, t) => sum + t.count, 0);
  // Shared by the Incidents card's legend row and its severity bar, so the two always match.
  const severitySegments = [
    { label: "Critical", count: criticalThreats, color: INCIDENT_SEVERITY_COLORS.Critical },
    { label: "High", count: highThreats, color: INCIDENT_SEVERITY_COLORS.High },
    { label: "Medium", count: mediumThreats, color: INCIDENT_SEVERITY_COLORS.Medium },
    { label: "Low", count: lowThreats, color: INCIDENT_SEVERITY_COLORS.Low },
  ];
  const totalThreatsBySeverity = criticalThreats + highThreats + mediumThreats + lowThreats || 1;

  return (
    <div className="page">
      {/* Critical Alerts Banner */}
      {/* {urgentCount > 0 && (
        <div
          style={{
            background: "#FFFFFF",
            border: "1px solid #E2E8F0",
            borderLeft: "4px solid #D92D20",
            borderRadius: 10,
            padding: "16px 20px",
            marginBottom: 20,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            boxShadow: "0 1px 3px rgba(0, 0, 0, 0.06)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                background: "#FEF3F2",
                display: "grid",
                placeItems: "center",
                flexShrink: 0,
              }}
            >
              <Icon name="shield" size={18} style={{ color: "#D92D20" }} />
            </div>
            <div>
              <div style={{ fontSize: 15.5, fontWeight: 670, color: "#0F2747", marginBottom: 4, letterSpacing: "-0.01em" }}>
                {criticalThreats > 0 ? `${criticalThreats} critical incident${criticalThreats !== 1 ? 's' : ''} require attention` : `${highThreats} high-priority incident${highThreats !== 1 ? 's' : ''} require attention`}
              </div>
              <div style={{ fontSize: 13, color: "#64748B", fontWeight: 400 }}>
                {(highThreats + mediumThreats + lowThreats) > 0 && `${highThreats + mediumThreats + lowThreats} contained`}
                {mostRecentThreat && ` · Last detected ${timeAgo(mostRecentThreat.time)}`}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              style={{
                background: "#FFFFFF",
                border: "1px solid #D92D20",
                color: "#D92D20",
                fontWeight: 500,
                padding: "7px 14px",
                borderRadius: 8,
                fontSize: 13.5,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                transition: "all 120ms ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#FEF3F2";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "#FFFFFF";
              }}
              onClick={() => setBottomTab("threats")}
            >
              Review incidents →
            </button>
          </div>
        </div>
      )} */}

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
        {/* Active Threats Card - Professional security platform design */}
        <div
          style={{
            background: "var(--bg-1)",
            border: "1px solid var(--line)",
            borderRadius: 12,
            padding: "18px 20px",
            position: "relative" as const,
            overflow: "hidden",
            boxShadow: "0 1px 2px rgba(15, 32, 70, 0.04)",
          }}
        >
          {/* Title with Info Icon */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--fg-muted)", letterSpacing: "0.02em", textTransform: "uppercase" }}>
                Incidents
              </div>
              <button
                onClick={() => setShowThreatsInfo(true)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: 2,
                  display: "grid",
                  placeItems: "center",
                  color: "var(--fg-muted)",
                  transition: "color 120ms",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "var(--accent)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "var(--fg-muted)")}
                title="More information"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="16" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
              </button>
            </div>
          </div>

          {/* Main Count with Change Indicator */}
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 16 }}>
            <div style={{ fontSize: 36, fontWeight: 700, color: "var(--threat)", fontVariantNumeric: "tabular-nums", lineHeight: 1, fontFamily: "var(--font-display)" }}>
              {metrics.threatCount}
            </div>
            {metrics.threatCount24hChange != null && metrics.threatCount24hChange > 0 && (
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "var(--threat)",
                  display: "flex",
                  alignItems: "center",
                  gap: 3,
                }}
              >
                +{metrics.threatCount24hChange} · 24hr
              </div>
            )}
          </div>

          {/* Severity Breakdown Labels */}
          {metrics.threatCount > 0 && (
            <div>
              {/* Single line: tighter gaps and no wrapping so all four severities sit on one row. */}
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8, flexWrap: "nowrap", whiteSpace: "nowrap", minWidth: 0 }}>
                {severitySegments.map(({ label, count, color }) => {
                  if (count === 0) return null;
                  return (
                    <div key={label} style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0, fontSize: 9.8, fontWeight: 500, color: "var(--fg-dim)", fontFamily: "var(--font-body)" }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: color, flexShrink: 0 }} />
                      {label} <span style={{ fontFamily: "var(--font-mono)", fontWeight: 600 }}>{count}</span>
                    </div>
                  );
                })}
              </div>

              {/* Severity Bar */}
              <div style={{ display: "flex", width: "100%", height: 6, borderRadius: 999, overflow: "hidden", background: "var(--bg-3)" }}>
                {severitySegments.map(({ label, count, color }) => {
                  const percentage = totalThreatsBySeverity > 0 ? (count / totalThreatsBySeverity) * 100 : 0;
                  if (percentage === 0) return null;
                  return (
                    <div
                      key={label}
                      style={{
                        width: `${percentage}%`,
                        background: color,
                        transition: "width 300ms ease",
                      }}
                      title={`${label}: ${count} (${Math.round(percentage)}%)`}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Interactions Card with Safe/Incident Bar */}
        <div
          style={{
            background: "var(--bg-1)",
            border: "1px solid var(--line)",
            borderRadius: 12,
            padding: "18px 20px",
            position: "relative" as const,
            overflow: "hidden",
            boxShadow: "0 1px 2px rgba(15, 32, 70, 0.04)",
          }}
        >
          {/* Title with Info Icon */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--fg-muted)", letterSpacing: "0.02em", textTransform: "uppercase" }}>
                Interactions
              </div>
              <button
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: 2,
                  display: "grid",
                  placeItems: "center",
                  color: "var(--fg-muted)",
                  transition: "color 120ms",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "var(--accent)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "var(--fg-muted)")}
                onClick={() => setInfoCard("interactions")}
                title="Information about interactions"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="16" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
              </button>
            </div>
          </div>

          {/* Main Count with Change Indicator */}
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 16 }}>
            <div style={{ fontSize: 36, fontWeight: 700, color: "var(--fg)", fontVariantNumeric: "tabular-nums", lineHeight: 1, fontFamily: "var(--font-display)" }}>
              {metrics.interactionsCount >= 1000 ? (metrics.interactionsCount / 1000).toFixed(1) : metrics.interactionsCount}
              {metrics.interactionsCount >= 1000 && <span style={{ fontSize: 16, color: "var(--fg-muted)", marginLeft: 4, fontWeight: 400 }}>k</span>}
            </div>
            {metrics.interactionsCount24hChange != null && metrics.interactionsCount24hChange > 0 && (
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "var(--fg-muted)",
                  display: "flex",
                  alignItems: "center",
                  gap: 3,
                }}
              >
                +{metrics.interactionsCount24hChange} · 24hr
              </div>
            )}
          </div>

          {/* Safe vs Incident Bar */}
          {metrics.interactionsCount > 0 && (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8, flexWrap: "nowrap", whiteSpace: "nowrap", minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0, fontSize: 9.8, fontWeight: 500, color: "var(--fg-dim)", fontFamily: "var(--font-body)" }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: SAFE_COLOR, flexShrink: 0 }} />
                  Safe <span style={{ fontFamily: "var(--font-mono)", fontWeight: 600 }}>{metrics.interactionsCount - metrics.threatCount}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0, fontSize: 9.8, fontWeight: 500, color: "var(--fg-dim)", fontFamily: "var(--font-body)" }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: INCIDENT_COLOR, flexShrink: 0 }} />
                  Incidents <span style={{ fontFamily: "var(--font-mono)", fontWeight: 600 }}>{metrics.threatCount}</span>
                </div>
              </div>

              {/* Horizontal Bar */}
              <div style={{ display: "flex", width: "100%", height: 6, borderRadius: 999, overflow: "hidden", background: "var(--bg-3)" }}>
                <div
                  style={{
                    width: `${((metrics.interactionsCount - metrics.threatCount) / metrics.interactionsCount) * 100}%`,
                    background: SAFE_COLOR,
                    transition: "width 300ms ease",
                  }}
                  title={`Safe interactions: ${metrics.interactionsCount - metrics.threatCount}`}
                />
                <div
                  style={{
                    width: `${(metrics.threatCount / metrics.interactionsCount) * 100}%`,
                    background: INCIDENT_COLOR,
                    transition: "width 300ms ease",
                  }}
                  title={`Incident interactions: ${metrics.threatCount}`}
                />
              </div>
            </div>
          )}
        </div>

        {/* Agents Card */}
        <div
          style={{
            background: "var(--bg-1)",
            border: "1px solid var(--line)",
            borderRadius: 12,
            padding: "18px 20px",
            position: "relative" as const,
            overflow: "hidden",
            boxShadow: "0 1px 2px rgba(15, 32, 70, 0.04)",
          }}
        >
          {/* Title with Info Icon */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--fg-muted)", letterSpacing: "0.02em", textTransform: "uppercase" }}>
                Agents
              </div>
              <button
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: 2,
                  display: "grid",
                  placeItems: "center",
                  color: "var(--fg-muted)",
                  transition: "color 120ms",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "var(--accent)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "var(--fg-muted)")}
                onClick={() => setInfoCard("agents")}
                title="Information about agents"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="16" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
              </button>
            </div>
          </div>

          {/* Main Count with Change Indicator */}
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 16 }}>
            <div style={{ fontSize: 36, fontWeight: 700, color: "var(--fg)", fontVariantNumeric: "tabular-nums", lineHeight: 1, fontFamily: "var(--font-display)" }}>
              {metrics.agentCount}
            </div>
            {metrics.agentCount24hChange != null && metrics.agentCount24hChange > 0 && (
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "var(--fg-muted)",
                  display: "flex",
                  alignItems: "center",
                  gap: 3,
                }}
              >
                +{metrics.agentCount24hChange} · 24hr
              </div>
            )}
          </div>

          {/* Active/Total Bar */}
          {metrics.agentCount > 0 && (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8, flexWrap: "nowrap", whiteSpace: "nowrap", minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0, fontSize: 9.8, fontWeight: 500, color: "var(--fg-dim)", fontFamily: "var(--font-body)" }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: SAFE_COLOR, flexShrink: 0 }} />
                  Active <span style={{ fontFamily: "var(--font-mono)", fontWeight: 600 }}>{metrics.agentCount}</span>
                </div>
              </div>

              {/* Horizontal Bar */}
              <div style={{ display: "flex", width: "100%", height: 6, borderRadius: 999, overflow: "hidden", background: "var(--bg-3)" }}>
                <div
                  style={{
                    width: "100%",
                    background: SAFE_COLOR,
                    transition: "width 300ms ease",
                  }}
                  title={`Active agents: ${metrics.agentCount}`}
                />
              </div>
            </div>
          )}
        </div>

        {/* Intents Card with Safe/Blocked Bar */}
        <div
          style={{
            background: "var(--bg-1)",
            border: "1px solid var(--line)",
            borderRadius: 12,
            padding: "18px 20px",
            position: "relative" as const,
            overflow: "hidden",
            boxShadow: "0 1px 2px rgba(15, 32, 70, 0.04)",
          }}
        >
          {/* Title with Info Icon */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--fg-muted)", letterSpacing: "0.02em", textTransform: "uppercase" }}>
                Intents
              </div>
              <button
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: 2,
                  display: "grid",
                  placeItems: "center",
                  color: "var(--fg-muted)",
                  transition: "color 120ms",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "var(--accent)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "var(--fg-muted)")}
                onClick={() => setInfoCard("intents")}
                title="Information about intents"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="16" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
              </button>
            </div>
          </div>

          {/* Main Count with Change Indicator */}
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 16 }}>
            <div style={{ fontSize: 36, fontWeight: 700, color: "var(--fg)", fontVariantNumeric: "tabular-nums", lineHeight: 1, fontFamily: "var(--font-display)" }}>
              {metrics.intentCount}
            </div>
            {metrics.intentCount24hChange != null && metrics.intentCount24hChange > 0 && (
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "var(--fg-muted)",
                  display: "flex",
                  alignItems: "center",
                  gap: 3,
                }}
              >
                +{metrics.intentCount24hChange} · 24hr
              </div>
            )}
          </div>

          {/* Safe vs Blocked Bar */}
          {metrics.intentCount > 0 && (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8, flexWrap: "nowrap", whiteSpace: "nowrap", minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0, fontSize: 9.8, fontWeight: 500, color: "var(--fg-dim)", fontFamily: "var(--font-body)" }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: SAFE_COLOR, flexShrink: 0 }} />
                  Safe <span style={{ fontFamily: "var(--font-mono)", fontWeight: 600 }}>{metrics.intentCount - metrics.threatCount}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0, fontSize: 9.8, fontWeight: 500, color: "var(--fg-dim)", fontFamily: "var(--font-body)" }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: INCIDENT_COLOR, flexShrink: 0 }} />
                  Blocked <span style={{ fontFamily: "var(--font-mono)", fontWeight: 600 }}>{metrics.threatCount}</span>
                </div>
              </div>

              {/* Horizontal Bar */}
              <div style={{ display: "flex", width: "100%", height: 6, borderRadius: 999, overflow: "hidden", background: "var(--bg-3)" }}>
                <div
                  style={{
                    width: `${((metrics.intentCount - metrics.threatCount) / metrics.intentCount) * 100}%`,
                    background: SAFE_COLOR,
                    transition: "width 300ms ease",
                  }}
                  title={`Safe intents: ${metrics.intentCount - metrics.threatCount}`}
                />
                <div
                  style={{
                    width: `${(metrics.threatCount / metrics.intentCount) * 100}%`,
                    background: INCIDENT_COLOR,
                    transition: "width 300ms ease",
                  }}
                  title={`Blocked intents: ${metrics.threatCount}`}
                />
              </div>
            </div>
          )}
        </div>
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
                <h3>{chartTab === "graph" ? "Interactions over time" : "Security events"}</h3>
                <div className="sub">
                  {chartTab === "graph" ? "Safe vs incident-classified runs · Last 7 days" : "Top incidents requiring attention"}
                </div>
              </div>
            </div>
            {chartTab === "graph" ? (
              <div style={{ display: "flex", background: "var(--bg-3)", borderRadius: 6, padding: 2 }}>
                {([{ key: "graph", label: "Graph" }, { key: "threats", label: "Incidents" }] as const).map((t) => {
                  const active = chartTab === t.key;
                  return (
                    <button
                      key={t.key}
                      onClick={() => setChartTab(t.key)}
                      style={{
                        background: active ? "var(--surface)" : "transparent",
                        border: "none",
                        borderRadius: 5,
                        padding: "4px 10px",
                        fontSize: 11,
                        fontWeight: 600,
                        color: active ? "var(--fg)" : "var(--fg-muted)",
                        cursor: "pointer",
                        boxShadow: active ? "0 1px 3px rgba(0,0,0,0.15)" : "none",
                        transition: "all 120ms",
                      }}
                    >
                      {t.label}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button
                  style={{
                    background: "transparent",
                    border: "1px solid var(--line)",
                    borderRadius: 6,
                    padding: "4px 10px",
                    fontSize: 11,
                    fontWeight: 600,
                    color: "var(--fg-muted)",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  Last 24h
                  <Icon name="chevronDown" size={12} style={{ color: "var(--fg-muted)" }} />
                </button>
              </div>
            )}
          </div>

          {chartTab === "graph" ? (
            <>
              <div className="chart-legend">
                <span className="it">
                  <span className="sw" style={{ background: "#2563EB" }} /> Interactions
                </span>
                <span className="it">
                  <span className="sw" style={{ background: INCIDENT_COLOR }} /> Incidents
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
                    { key: "threats", label: "Incidents", color: INCIDENT_COLOR, data: data.threats },
                  ]}
                />
              </div>
            </>
          ) : (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "26px 1fr 80px 90px 24px", padding: "10px 20px 5px", borderBottom: "1px solid rgba(220,38,38,0.18)", marginTop: 8 }}>
                {["#", "INCIDENT", "SEVERITY", "OCCURRENCES", ""].map((h, i) => (
                  <div key={h} style={{ fontSize: 9.5, fontWeight: 840, letterSpacing: "0.07em", color: "var(--fg-muted)", textTransform: "uppercase" as const, textAlign: (i > 1 ? "right" : "left") as "right" | "left" }}>{h}</div>
                ))}
              </div>
              {topThreatsError ? (
                <div style={{ padding: 28, color: "var(--threat)", fontSize: 12.5, textAlign: "center" }}>
                  Failed to load top incidents — {topThreatsError.message}
                </div>
              ) : topThreats.length === 0 && (
                <div style={{ padding: 28, color: "var(--fg-muted)", fontSize: 12.5, textAlign: "center" }}>No incidents detected</div>
              )}
              {!topThreatsError && topThreatsShown.map((t, i) => {
                return (
                  <div
                    key={t.threatCode}
                    onClick={() => {
                      setBottomTab("threats");
                      setThreatStatusFilter("Flagged");
                    }}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "26px 1fr 80px 90px 24px",
                      alignItems: "center",
                      padding: "10px 20px",
                      borderBottom: "1px solid rgba(220,38,38,0.14)",
                      background: i === 0 ? "rgba(220,38,38,0.09)" : "transparent",
                      boxShadow: i === 0 ? "inset 3px 0 0 var(--threat)" : "none",
                      cursor: "pointer",
                      transition: "background 120ms",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLDivElement).style.background = "rgba(220,38,38,0.12)";
                      const arrow = e.currentTarget.querySelector(".arrow-icon") as HTMLElement;
                      if (arrow) arrow.style.transform = "rotate(-45deg)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLDivElement).style.background = i === 0 ? "rgba(220,38,38,0.09)" : "transparent";
                      const arrow = e.currentTarget.querySelector(".arrow-icon") as HTMLElement;
                      if (arrow) arrow.style.transform = "rotate(0deg)";
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
                        fontWeight: 840,
                        background: i === 0 ? "var(--threat)" : "rgba(220,38,38,0.12)",
                        color: i === 0 ? "#fff" : "var(--threat)",
                      }}
                    >
                      {String(i + 1).padStart(2, "0")}
                    </div>
                    <div style={{ fontSize: 12.5, fontWeight: 720, color: "var(--fg)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{titleOrUnknown(t.title)}</div>
                    <div style={{ textAlign: "right" }}>
                      <SeverityPill severity={getThreatSeverity(t.threatCode)} />
                    </div>
                    <div style={{ textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 12.5, fontWeight: 840, color: "var(--fg)", fontVariantNumeric: "tabular-nums" }}>
                      {t.count.toLocaleString()}
                    </div>
                    <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center" }}>
                      <div className="arrow-icon" style={{ transition: "transform 200ms ease", display: "flex" }}>
                        <Icon name="arrowRight" size={14} style={{ color: "var(--fg-muted)" }} />
                      </div>
                    </div>
                  </div>
                );
              })}
              {!topThreatsError && topThreats.length > 0 && (
                <div style={{ padding: "12px 20px", borderTop: "1px solid rgba(220,38,38,0.14)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 12, color: "var(--fg-muted)" }}>
                    Showing top {topThreatsShown.length} of {topThreats.length} incident type{topThreats.length === 1 ? "" : "s"}
                  </span>
                  <button onClick={() => setBottomTab("threats")} style={{ background: "none", border: "none", fontSize: 12, fontWeight: 600, color: "var(--threat)", cursor: "pointer", padding: 0 }}>View all incidents →</button>
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
                Ranked by interactions · incidents flagged
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
              <div style={{ display: "grid", gridTemplateColumns: "44px 1fr 92px 24px", padding: "12px 20px 6px", borderBottom: "1px solid var(--line)" }}>
                {["#", "AGENT", "IXNS", ""].map((h, i) => (
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
                        style={{ display: "grid", gridTemplateColumns: "44px 1fr 92px 24px", alignItems: "center", padding: "10px 20px", cursor: "pointer", borderBottom: "1px solid var(--line)" }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLDivElement).style.background = "var(--bg-2)";
                          const arrow = e.currentTarget.querySelector(".arrow-icon") as HTMLElement;
                          if (arrow) arrow.style.transform = "rotate(-45deg)";
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLDivElement).style.background = "transparent";
                          const arrow = e.currentTarget.querySelector(".arrow-icon") as HTMLElement;
                          if (arrow) arrow.style.transform = "rotate(0deg)";
                        }}
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
                        <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center" }}>
                          <div className="arrow-icon" style={{ transition: "transform 200ms ease", display: "flex" }}>
                            <Icon name="arrowRight" size={14} style={{ color: "var(--fg-muted)" }} />
                          </div>
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
              <div style={{ display: "grid", gridTemplateColumns: "36px 22px 1fr 76px 72px 24px", padding: "12px 20px 6px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                {["#", "", "APP", "IXNS", "INCIDENTS", ""].map((h, i) => (
                  <div key={i} style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.07em", color: "rgba(255,255,255,0.35)", textTransform: "uppercase" as const, textAlign: (i > 2 ? "right" : "left") as "right" | "left" }}>{h}</div>
                ))}
              </div>
              <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                {agentsAppsMetrics.topApps.length === 0 && (
                  <div style={{ padding: 24, color: "rgba(255,255,255,0.35)", fontSize: 14, textAlign: "center" }}>No apps yet.</div>
                )}
                {(() => {
                  const maxIxns = agentsAppsMetrics.topApps.reduce((m, a) => Math.max(m, a.totalInteractions), 0) || 1;
                  return agentsAppsMetrics.topApps.map((a, i) => {
                    const threats = a.totalThreats ?? 0;
                    const barPct = (a.totalInteractions / maxIxns) * 100;
                    return (
                      <div
                        key={a.name}
                        onClick={() => navigate(`/tools/${encodeURIComponent(a.name)}`)}
                        style={{ cursor: "pointer", borderBottom: "1px solid rgba(255,255,255,0.05)", padding: "0 20px" }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.04)";
                          const arrow = e.currentTarget.querySelector(".arrow-icon") as HTMLElement;
                          if (arrow) arrow.style.transform = "rotate(-45deg)";
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLDivElement).style.background = "transparent";
                          const arrow = e.currentTarget.querySelector(".arrow-icon") as HTMLElement;
                          if (arrow) arrow.style.transform = "rotate(0deg)";
                        }}
                      >
                        <div style={{ display: "grid", gridTemplateColumns: "36px 22px 1fr 76px 72px 24px", alignItems: "center", padding: "10px 0 4px" }}>
                          <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700, color: i === 0 ? "#fff" : "rgba(255,255,255,0.4)" }}>
                            {String(i + 1).padStart(2, "0")}
                          </div>
                          <AppIcon name={a.name} size={22} />
                          <div style={{ fontSize: 14, fontWeight: 500, color: "#fff", fontFamily: "var(--font-mono)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", paddingLeft: 6 }}>{a.name}</div>
                          <div style={{ textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 600, color: "#fff", fontVariantNumeric: "tabular-nums" }}>
                            {a.totalInteractions.toLocaleString()}
                          </div>
                          <div style={{ textAlign: "right" }}>
                            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, fontWeight: 700, background: threats > 0 ? "rgba(248,113,113,0.16)" : "rgba(255,255,255,0.07)", color: threats > 0 ? "#f87171" : "rgba(255,255,255,0.4)", padding: "2px 8px", borderRadius: 4 }}>
                              {threats.toLocaleString()}
                            </span>
                          </div>
                          <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center" }}>
                            <div className="arrow-icon" style={{ transition: "transform 200ms ease", display: "flex" }}>
                              <Icon name="arrowRight" size={14} style={{ color: "rgba(255,255,255,0.4)" }} />
                            </div>
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

      <Modal
        open={showThreatsInfo}
        title="Incidents Metric"
        onClose={() => setShowThreatsInfo(false)}
        width={560}
        footer={
          <button type="button" className="btn primary" onClick={() => setShowThreatsInfo(false)}>
            Got it
          </button>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ fontSize: 14, color: "var(--fg-dim)", lineHeight: 1.6 }}>
            The <strong>Incidents</strong> metric displays security incidents detected by AgentDNA across all monitored agents and applications in real-time.
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--fg)", letterSpacing: "0.02em", textTransform: "uppercase" }}>
              Severity Levels
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <div style={{ width: 16, height: 16, borderRadius: 4, background: INCIDENT_SEVERITY_COLORS.Critical, flexShrink: 0, marginTop: 2 }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--fg)", marginBottom: 2 }}>Critical</div>
                  <div style={{ fontSize: 12, color: "var(--fg-muted)", lineHeight: 1.5 }}>
                    Immediate action required. Threats that pose severe security risks such as data exfiltration, privilege escalation, or system compromise.
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <div style={{ width: 16, height: 16, borderRadius: 4, background: INCIDENT_SEVERITY_COLORS.High, flexShrink: 0, marginTop: 2 }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--fg)", marginBottom: 2 }}>High</div>
                  <div style={{ fontSize: 12, color: "var(--fg-muted)", lineHeight: 1.5 }}>
                    Significant security concerns requiring prompt investigation, including unauthorized access attempts and policy violations.
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <div style={{ width: 16, height: 16, borderRadius: 4, background: INCIDENT_SEVERITY_COLORS.Medium, flexShrink: 0, marginTop: 2 }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--fg)", marginBottom: 2 }}>Medium</div>
                  <div style={{ fontSize: 12, color: "var(--fg-muted)", lineHeight: 1.5 }}>
                    Moderate risk activities that should be reviewed and monitored for escalation patterns.
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <div style={{ width: 16, height: 16, borderRadius: 4, background: INCIDENT_SEVERITY_COLORS.Low, flexShrink: 0, marginTop: 2 }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--fg)", marginBottom: 2 }}>Low</div>
                  <div style={{ fontSize: 12, color: "var(--fg-muted)", lineHeight: 1.5 }}>
                    Minor anomalies or informational alerts that may indicate potential issues requiring awareness.
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div style={{ padding: "12px 14px", background: "rgba(37, 99, 235, 0.06)", border: "1px solid rgba(37, 99, 235, 0.15)", borderRadius: 8, fontSize: 12, color: "var(--fg-dim)", lineHeight: 1.5 }}>
            <strong style={{ color: "var(--accent)" }}>Tip:</strong> Click on the "View Flagged" button in the alert banner above to quickly review all incidents that require immediate attention.
          </div>
        </div>
      </Modal>

      <MetricInfoModal
        open={infoCard === "interactions"}
        onClose={() => setInfoCard(null)}
        title="Interactions Metric"
        intro={<>Every recorded call between two participants in your org — agent to agent, or agent to app. Each hop of an intent counts as one interaction.</>}
        rows={[
          { color: SAFE_COLOR, label: "Safe", text: "Interactions that passed identity, trust and scope checks — the total minus flagged ones." },
          { color: INCIDENT_COLOR, label: "Incidents", text: "Interactions where a threat was detected or policy blocked the call." },
        ]}
        tip={<>Open <strong>Interactions</strong> in the sidebar for the full log, or click any incident in the Security events table to jump to the flagged ones.</>}
      />

      <MetricInfoModal
        open={infoCard === "agents"}
        onClose={() => setInfoCard(null)}
        title="Agents Metric"
        intro={<>AI agents registered to your organization. The 24-hour figure counts agents added since yesterday.</>}
        rows={[
          { color: SAFE_COLOR, label: "Active", text: "Registered agents currently able to act. Revoked agents drop out of this count." },
        ]}
        tip={<>Open <strong>Agents &amp; Apps</strong> to see each agent's trust score, the apps it can reach, and its policy.</>}
      />

      <MetricInfoModal
        open={infoCard === "intents"}
        onClose={() => setInfoCard(null)}
        title="Intents Metric"
        intro={<>Tasks a user handed to your agents. One intent covers the whole chain of work it sets off, however many agents and apps it touches.</>}
        rows={[
          { color: SAFE_COLOR, label: "Safe", text: "Intents that ran with no threat detected along the way." },
          { color: INCIDENT_COLOR, label: "Blocked", text: "Intents halted by a policy violation or a detected threat before they finished." },
        ]}
        tip={<>Open <strong>Intents</strong> to review each one, or click an intent to replay its flow hop by hop.</>}
      />
    </div>
  );
}

