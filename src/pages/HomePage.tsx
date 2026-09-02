import { useMemo, useState } from "react";
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
import { useResolveName, resolveDisplayName } from "../context/DirectoryContext";
import { useDrawer } from "../context/DrawerContext";
import { ThreatPill } from "../components/ThreatPill";
import { SeverityPill } from "../components/SeverityPill";
import { getThreatSeverity } from "../lib/threatSeverity";
import { timeAgo, capitalizeFirst } from "../lib/format";
import type { Intent, Interaction } from "../types";
import type { ThreatListItem } from "../data/api";
import type { CSSProperties } from "react";

/** Reddish tint + left accent for any row that represents/carries a threat. */
const THREAT_ROW_STYLE: CSSProperties = {
  background: "rgba(220,38,38,0.045)",
  boxShadow: "inset 3px 0 0 var(--threat)",
};

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

  const homeState = useHomeMetrics();
  const intentsState = useIntentsPaged(intentsPage);
  const threatsListState = useThreatsListPaged(threatsPage);
  const { data: topThreats, error: topThreatsError } = useTopThreats();
  const seriesState = useSeries(series);
  const { data: agentsAppsMetrics } = useAgentsAppsMetrics();

  const metrics = homeState.data;
  const intents = intentsState.data.items;
  const intentsTotal = intentsState.data.total;
  const intentsTotalPages = intentsState.data.totalPages;
  const threatsList = threatsListState.data.items;
  const threatsListTotal = threatsListState.data.total;
  const threatsListTotalPages = threatsListState.data.totalPages;
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
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, color: "var(--fg-muted)" }}>{timeAgo(r.started)}</span>
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

  const threatsListCols: DataTableColumn<ThreatListItem>[] = [
    {
      key: "title",
      label: "Title",
      render: (r) => (
        <span style={{ fontSize: 13, color: r.threatTitle ? "var(--fg)" : "var(--fg-faint)", fontWeight: r.threatTitle ? 600 : 400 }}>
          {r.threatTitle ? capitalizeFirst(r.threatTitle) : "—"}
        </span>
      ),
    },
    {
      key: "severity",
      label: "Severity",
      // /threats-list carries no threat_code, only the title — fall back to matching on that.
      render: (r) => <SeverityPill severity={getThreatSeverity(undefined, r.threatTitle)} />,
    },
    {
      key: "message",
      label: "Message",
      width: 260,
      render: (r) => (
        <span
          onClick={(e) => {
            e.stopPropagation();
            setThreatMessage(r);
          }}
          title="View full message"
          style={{
            fontSize: 13,
            color: "var(--fg)",
            cursor: "pointer",
            display: "block",
            maxWidth: 260,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {capitalizeFirst(r.message)}
        </span>
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
      key: "target",
      label: "Interacted with",
      render: (r) =>
        r.initiator.id === r.target.id ? (
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, color: "var(--fg-faint)" }}>—</span>
        ) : (
          <span style={{ fontSize: 13, color: "var(--fg-dim)" }}>{capitalizeFirst(resolveDisplayName(resolve, r.target))}</span>
        ),
    },
    {
      key: "intent",
      label: "Intent",
      render: (r) => (
        <IntentIdChip id={r.intentID} style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, fontWeight: 600, color: "var(--fg)" }} />
      ),
    },
    {
      key: "time",
      label: "Time",
      align: "right",
      render: (r) => (
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, color: "var(--fg-muted)" }}>{capitalizeFirst(timeAgo(r.time))}</span>
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
              openDrawer("interaction", threatToInteraction(r));
            }}
          >
            View
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
      ["Threats Detected", String(metrics.threatCount)],
      [],
      ["AGENT LIST"],
      ["Agent ID", "Agent Name", "Total Interactions", "Total Threats"],
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
              Deploy your first agent to start monitoring interactions, detecting threats, and tracking intents in real time.
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
        <MetricTile label="Threats Detected" value={metrics.threatCount} icon="shield" sparkColor="#DC2626" spark={data.threats} />
        <MetricTile label="Total Intents" value={metrics.intentCount} icon="intents" sparkColor="#0A2240" spark={[]} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1.4fr", gap: 16, marginBottom: 20 }}>
        <div className="card">
          <div className="card-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <h3>{chartTab === "graph" ? "Interactions over time" : "Top 5 threats"}</h3>
              <div className="sub">
                {chartTab === "graph" ? "Safe vs threat-classified runs · Last 7 days" : "By volume, most frequent codes"}
              </div>
            </div>
            <div style={{ display: "flex", background: "var(--bg-3)", borderRadius: 6, padding: 2 }}>
              {([{ key: "graph", label: "Graph" }, { key: "threats", label: "Threats" }] as const).map((t) => (
                <button
                  key={t.key}
                  onClick={() => setChartTab(t.key)}
                  style={{
                    background: chartTab === t.key ? "var(--surface)" : "transparent",
                    border: "none",
                    borderRadius: 5,
                    padding: "4px 10px",
                    fontSize: 11,
                    fontWeight: 600,
                    color: chartTab === t.key ? "var(--fg)" : "var(--fg-muted)",
                    cursor: "pointer",
                    boxShadow: chartTab === t.key ? "0 1px 3px rgba(0,0,0,0.15)" : "none",
                    transition: "all 120ms",
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {chartTab === "graph" ? (
            <>
              <div className="chart-legend">
                <span className="it">
                  <span className="sw" style={{ background: "#2563EB" }} /> Interactions
                </span>
                <span className="it">
                  <span className="sw" style={{ background: "#DC2626" }} /> Threats
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
                    { key: "threats", label: "Threats", color: "#DC2626", data: data.threats },
                  ]}
                />
              </div>
            </>
          ) : (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "32px 1fr 90px 70px 70px", padding: "12px 20px 6px", borderBottom: "1px solid var(--line)", marginTop: 8 }}>
                {["#", "THREAT", "SEVERITY", "CODE", "COUNT"].map((h, i) => (
                  <div key={h} style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.07em", color: "var(--fg-muted)", textTransform: "uppercase" as const, textAlign: (i > 1 ? "right" : "left") as "right" | "left" }}>{h}</div>
                ))}
              </div>
              {topThreatsError ? (
                <div style={{ padding: 28, color: "var(--threat)", fontSize: 13, textAlign: "center" }}>
                  Failed to load top threats — {topThreatsError.message}
                </div>
              ) : topThreats.length === 0 && (
                <div style={{ padding: 28, color: "var(--fg-muted)", fontSize: 13, textAlign: "center" }}>No threats detected</div>
              )}
              {!topThreatsError && topThreats.map((t, i) => (
                <div key={t.threatCode} style={{ display: "grid", gridTemplateColumns: "32px 1fr 90px 70px 70px", alignItems: "center", padding: "10px 20px", borderBottom: "1px solid var(--line)" }}>
                  <div style={{ width: 24, height: 24, borderRadius: 7, display: "grid", placeItems: "center", fontFamily: "var(--font-mono)", fontSize: 10.5, fontWeight: 700, background: i === 0 ? "#0a2240" : "var(--bg-3)", color: i === 0 ? "#fff" : "var(--fg-muted)" }}>
                    {String(i + 1).padStart(2, "0")}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--fg)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.title}</div>
                  <div style={{ textAlign: "right" }}>
                    <SeverityPill severity={getThreatSeverity(t.threatCode, t.title)} />
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, color: "var(--fg-muted)", background: "var(--bg-2)", padding: "2px 8px", borderRadius: 4 }}>
                      {t.threatCode}
                    </span>
                  </div>
                  <div style={{ textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 600, color: "var(--fg)", fontVariantNumeric: "tabular-nums" }}>
                    {t.count.toLocaleString()}
                  </div>
                </div>
              ))}
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
                {volumeTab === "agents" ? "Ranked by interactions · threats flagged" : "Ranked by interactions · share of total"}
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
            {([{ key: "intents", label: "Intents", count: intentsTotal }, { key: "threats", label: "Threats", count: threatsListTotal }] as const).map((t) => (
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
            <Pagination page={intentsPage} totalPages={intentsTotalPages} total={intentsTotal} pageSize={10} inline onChange={setIntentsPage} />
          )}
          {bottomTab === "threats" && (
            <Pagination page={threatsPage} totalPages={threatsListTotalPages} total={threatsListTotal} pageSize={10} inline onChange={setThreatsPage} />
          )}
        </div>
        {bottomTab === "intents" ? (
          <DataTable
            rows={intents}
            columns={intentCols}
            onRowClick={(r) => navigate(`/intents/${r.id}`)}
            emptyText="No intents yet"
            rowStyle={(r) => (r.threats > 0 ? THREAT_ROW_STYLE : undefined)}
          />
        ) : (
          <DataTable
            rows={threatsList}
            columns={threatsListCols}
            onRowClick={(r) => openDrawer("interaction", threatToInteraction(r))}
            emptyText={threatsListState.error ? `Failed to load threats — ${threatsListState.error.message}` : "No threats detected"}
            // Every row here is a threat by definition.
            rowStyle={() => THREAT_ROW_STYLE}
          />
        )}
      </div>

      <Modal
        open={!!threatMessage}
        title="Threat message"
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

