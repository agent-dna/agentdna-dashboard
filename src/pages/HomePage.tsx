import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "../components/Icon";
import { MetricTile } from "../components/MetricTile";

import { Chart } from "../components/Chart";
import { DataTable } from "../components/DataTable";
import { useHomeMetrics, useInteractionsPaged, useAlerts, useSeries } from "../data/hooks";
import { Pagination } from "../components/Pagination";
import { useDrawer } from "../context/DrawerContext";
import { useTweaks } from "../context/TweaksContext";
import { useInteractionColumns } from "./InteractionsPage";

export function HomePage() {
  const series = "7d";
  const { tweaks } = useTweaks();
  const { openDrawer } = useDrawer();
  const navigate = useNavigate();

  const [bottomTab, setBottomTab] = useState<"interactions" | "threats">("interactions");
  const [interactionsPage, setInteractionsPage] = useState(1);

  const homeState = useHomeMetrics();
  const interactionsState = useInteractionsPaged(interactionsPage);
  const alertsState = useAlerts();
  const seriesState = useSeries(series);

  const metrics = homeState.data;
  const interactions = interactionsState.data.interactions;
  const interactionsTotal = interactionsState.data.total;
  const interactionsTotalPages = interactionsState.data.totalPages;
  const threats = alertsState.data;
  const data = seriesState.data;

  const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const cols = useInteractionColumns((k, e) => openDrawer(k, e));

  const isEmpty = !homeState.loading && metrics.agentCount === 0;

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

      <div className="grid-2">
        <div className="card">
          <div className="card-head">
            <div>
              <h3>Interactions over time</h3>
              <div className="sub">Safe vs threat-classified runs · {series === "24h" ? "Hourly" : "Daily"}</div>
            </div>
            <div className="actions">
              <div className="seg">
                <button className={series === "24h" ? "active" : ""} onClick={() => setSeries("24h")}>
                  24h
                </button>
                <button className={series === "7d" ? "active" : ""} onClick={() => setSeries("7d")}>
                  7d
                </button>
              </div>
            </div>
          </div>
          <div className="chart-legend">
            <span className="it">
              <span className="sw" style={{ background: "#2563EB" }} /> Safe
            </span>
            <span className="it">
              <span className="sw" style={{ background: "#DC2626" }} /> Threat-flagged
            </span>
          </div>
          <div className="chart-wrap">
            <Chart
              labels={labels}
              style={tweaks.chartStyle}
              height={272}
              formatY={(v) => (typeof v === "number" && v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v)}
              series={[
                { key: "safe", label: "Safe", color: "#2563EB", data: data.safe },
                { key: "threat", label: "Threat", color: "#DC2626", data: data.threats },
              ]}
            />
          </div>
        </div>

        <div className="card" style={{ display: "flex", flexDirection: "column" }}>
          <div className="card-head">
            <h3>Top agents by volume</h3>
            <div className="actions">
              <button className="icon-btn" style={{ width: 28, height: 28 }}>
                <Icon name="more" size={14} />
              </button>
            </div>
          </div>
          <div
            style={{
              padding: "4px 8px 12px",
              flex: 1,
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              gap: 4,
            }}
          >
            {metrics.agentList.length === 0 && (
              <div style={{ padding: 24, color: "var(--fg-muted)", fontSize: 13, textAlign: "center" }}>
                {homeState.loading ? "Loading…" : "No agents yet."}
              </div>
            )}
            {metrics.agentList.map((a, i) => {
              const max = metrics.agentList.reduce((m, x) => Math.max(m, x.totalInteractions), 0) || 1;
              const pct = (a.totalInteractions / max) * 100;
              return (
                  <div
                    key={a.agentID}
                    onClick={() => navigate(`/agents/${a.agentID}`)}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "auto 1fr auto",
                      gap: 12,
                      alignItems: "center",
                      padding: "14px 14px",
                      borderRadius: 8,
                      cursor: "pointer",
                      flex: 1,
                    }}
                    onMouseEnter={(e) => ((e.currentTarget as HTMLDivElement).style.background = "var(--bg-2)")}
                    onMouseLeave={(e) => ((e.currentTarget as HTMLDivElement).style.background = "transparent")}
                  >
                    <div
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 6,
                        background: "var(--bg-3)",
                        display: "grid",
                        placeItems: "center",
                        fontFamily: "var(--font-mono)",
                        fontSize: 10.5,
                        color: "var(--fg-muted)",
                      }}
                    >
                      {String(i + 1).padStart(2, "0")}
                    </div>
                    <div>
                      <div style={{ fontSize: 13, marginBottom: 6 }}>{a.agentName}</div>
                      <div style={{ height: 4, borderRadius: 2, background: "var(--bg-3)", overflow: "hidden" }}>
                        <div
                          style={{
                            width: `${pct}%`,
                            height: "100%",
                            background: "linear-gradient(90deg, var(--accent), var(--accent-2))",
                          }}
                        />
                      </div>
                    </div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--fg-dim)" }}>
                      {a.totalInteractions.toLocaleString()}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="tb-toolbar">
          <div className="filters">
            {(["interactions", "threats"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setBottomTab(t)}
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  padding: "6px 14px", fontSize: 13, fontWeight: 600,
                  color: bottomTab === t ? "var(--accent)" : "var(--fg-muted)",
                  borderBottom: bottomTab === t ? "2px solid var(--accent)" : "2px solid transparent",
                  textTransform: "capitalize",
                }}
              >
                {t === "interactions" ? "Interactions" : "Threats"}
                <span style={{
                  marginLeft: 6, fontSize: 11, fontFamily: "var(--font-mono)",
                  background: bottomTab === t ? "rgba(37,99,235,0.12)" : "var(--surface-raised)",
                  color: bottomTab === t ? "var(--accent)" : "var(--fg-muted)",
                  padding: "1px 6px", borderRadius: 99,
                }}>
                  {t === "interactions" ? interactionsTotal : threats.length}
                </span>
              </button>
            ))}
          </div>
          {bottomTab === "interactions" && (
            <Pagination page={interactionsPage} totalPages={interactionsTotalPages} total={interactionsTotal} pageSize={10} inline onChange={setInteractionsPage} />
          )}
        </div>
        <DataTable
          onRowClick={(r) => openDrawer("interaction", r)}
          columns={cols}
          rows={bottomTab === "interactions" ? interactions : threats}
          emptyText={bottomTab === "interactions" ? "No interactions yet" : "No threats detected"}
        />
      </div>
    </div>
  );
}
