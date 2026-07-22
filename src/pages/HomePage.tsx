import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "../components/Icon";
import { MetricTile } from "../components/MetricTile";

import { Chart } from "../components/Chart";
import { useHomeMetrics, useInteractionsPaged, useAlerts, useSeries, useAgentsAppsMetrics } from "../data/hooks";
import { Pagination } from "../components/Pagination";
import { useDrawer } from "../context/DrawerContext";
import { LedgerTable } from "../components/LedgerTable";
import { AppIcon } from "../components/AppIcon";

export function HomePage() {
  const series = "7d";

  const { openDrawer } = useDrawer();
  const navigate = useNavigate();

  const [bottomTab, setBottomTab] = useState<"interactions" | "threats">("interactions");
  const [interactionsPage, setInteractionsPage] = useState(1);
  const [volumeTab, setVolumeTab] = useState<"agents" | "apps">("agents");

  const homeState = useHomeMetrics();
  const interactionsState = useInteractionsPaged(interactionsPage);
  const alertsState = useAlerts();
  const seriesState = useSeries(series);
  const { data: agentsAppsMetrics } = useAgentsAppsMetrics();

  const metrics = homeState.data;
  const interactions = interactionsState.data.interactions;
  const interactionsTotal = interactionsState.data.total;
  const interactionsTotalPages = interactionsState.data.totalPages;
  const threats = alertsState.data;
  const data = seriesState.data;

  const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

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

      <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1.4fr", gap: 16, marginBottom: 20 }}>
        <div className="card">
          <div className="card-head">
            <div>
              <h3>Interactions over time</h3>
              <div className="sub">Safe vs threat-classified runs · Last 7 days</div>
            </div>
          </div>
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
              <div style={{ display: "grid", gridTemplateColumns: "44px 1fr 92px 78px", padding: "12px 20px 6px", borderBottom: "1px solid var(--line)" }}>
                {["#", "AGENT", "IXNS", "THREATS"].map((h, i) => (
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
                    const threats = a.totalThreats ?? 0;
                    return (
                      <div
                        key={a.agentID}
                        onClick={() => navigate(`/agents/${a.agentID}`)}
                        style={{ display: "grid", gridTemplateColumns: "44px 1fr 92px 78px", alignItems: "center", padding: "10px 20px", cursor: "pointer", borderBottom: "1px solid var(--line)" }}
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
                        <div style={{ textAlign: "right" }}>
                          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, background: threats > 0 ? "rgba(220,38,38,0.1)" : "var(--bg-3)", color: threats > 0 ? "#dc2626" : "var(--fg-muted)", padding: "2px 8px", borderRadius: 4 }}>
                            {threats.toLocaleString()}
                          </span>
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
                        onClick={() => navigate("/agents")}
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
        <LedgerTable
          rows={bottomTab === "interactions" ? interactions : threats}
          emptyText={bottomTab === "interactions" ? "No interactions yet" : "No threats detected"}
          onView={(r) => openDrawer("interaction", r)}
        />
      </div>
    </div>
  );
}

