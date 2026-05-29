import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "../components/Icon";
import { MetricTile } from "../components/MetricTile";
import { FilterPill } from "../components/FilterPill";
import { Chart } from "../components/Chart";
import { DataTable, type DataTableColumn } from "../components/DataTable";
import { EntityCell, IdCell } from "../components/EntityCell";
import { useHomeMetrics, useInteractions, useSeries } from "../data/hooks";
import { useDrawer } from "../context/DrawerContext";
import { useTweaks } from "../context/TweaksContext";
import { fmtRuntime, timeAgo } from "../lib/format";
import type { Interaction } from "../types";

export function HomePage() {
  const [series, setSeries] = useState<"24h" | "7d">("24h");
  const { tweaks } = useTweaks();
  const { openDrawer } = useDrawer();
  const navigate = useNavigate();

  const homeState = useHomeMetrics();
  const interactionsState = useInteractions();
  const seriesState = useSeries(series);

  const metrics = homeState.data;
  const interactions = interactionsState.data;
  const data = seriesState.data;

  const labels =
    series === "24h"
      ? Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, "0")}:00`)
      : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const recent = interactions.slice(0, 6);

  const cols: DataTableColumn<Interaction>[] = [
    { key: "id", label: "Interaction", render: (r) => <IdCell id={r.id} /> },
    {
      key: "initiator",
      label: "Initiator",
      render: (r) => (
        <EntityCell name={r.initiator.name} sub={r.initiator.id} paletteIx={r.initiator.name.charCodeAt(0)} />
      ),
    },
    {
      key: "target",
      label: "Interacted with",
      render: (r) => (
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Icon name="arrowRight" size={12} />
          <span className="chip" style={{ color: r.targetType === "agent" ? "var(--accent-2)" : "var(--accent-3)" }}>
            {r.targetType}
          </span>
          <span>{r.target.name}</span>
        </div>
      ),
    },
    { key: "intent", label: "Intent", render: (r) => <IdCell id={r.intent.id} /> },
    {
      key: "runtime",
      label: "Runtime",
      render: (r) => <span style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>{fmtRuntime(r.runtime)}</span>,
    },
    {
      key: "threat",
      label: "Status",
      render: (r) =>
        r.threat ? (
          <span className="chip threat">
            <span className="dot-status threat" /> threat
          </span>
        ) : (
          <span className="chip safe">
            <span className="dot-status safe" /> safe
          </span>
        ),
    },
    {
      key: "created",
      label: "When",
      render: (r) => (
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--fg-muted)" }}>
          {timeAgo(r.created)}
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
              openDrawer("interaction", r);
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
          <h1>Dashboard</h1>
          <div className="sub">
            Real-time observability across {metrics.agentCount} agents and {metrics.intentCount} intents
          </div>
        </div>
        <div className="right">
          <FilterPill label="Env" value="production" />
          <FilterPill
            label="Range"
            value={series === "24h" ? "Last 24h" : "Last 7d"}
            onClick={() => setSeries((s) => (s === "24h" ? "7d" : "24h"))}
          />
          <button className="btn">
            <Icon name="refresh" size={14} />
            Refresh
          </button>
          <button className="btn primary">
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
        <MetricTile label="Active Intents" value={metrics.intentCount} icon="intents" sparkColor="#0A2240" spark={[]} />
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
              height={260}
              formatY={(v) => (typeof v === "number" && v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v)}
              series={[
                { key: "safe", label: "Safe", color: "#2563EB", data: data.safe },
                { key: "threat", label: "Threat", color: "#DC2626", data: data.threats },
              ]}
            />
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <h3>Top agents by volume</h3>
            <div className="actions">
              <button className="icon-btn" style={{ width: 28, height: 28 }}>
                <Icon name="more" size={14} />
              </button>
            </div>
          </div>
          <div style={{ padding: "0 8px 8px" }}>
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
                      padding: "10px 14px",
                      borderRadius: 8,
                      cursor: "pointer",
                    }}
                    onMouseEnter={(e) => ((e.currentTarget as HTMLDivElement).style.background = "var(--bg-2)")}
                    onMouseLeave={(e) => ((e.currentTarget as HTMLDivElement).style.background = "transparent")}
                  >
                    <div
                      style={{
                        width: 22,
                        height: 22,
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
                      <div style={{ fontSize: 13, marginBottom: 4 }}>{a.agentName}</div>
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
        <div className="card-head">
          <div>
            <h3>Recent interactions</h3>
            <div className="sub">Last few moments of agent activity</div>
          </div>
          <div className="actions">
            <button className="btn ghost" style={{ padding: "6px 10px", fontSize: 12 }}>
              View all <Icon name="arrowRight" size={12} />
            </button>
          </div>
        </div>
        <DataTable
          onRowClick={(r) => openDrawer("interaction", r)}
          columns={cols}
          rows={recent}
          emptyText="No interactions yet"
        />
      </div>
    </div>
  );
}
