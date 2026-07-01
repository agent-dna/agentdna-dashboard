import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { MetricTile } from "../components/MetricTile";
import { DataTable } from "../components/DataTable";
import { Icon } from "../components/Icon";
import { useAlerts, useAgentsPaged } from "../data/hooks";
import { useDrawer } from "../context/DrawerContext";
import { useInteractionColumns } from "./InteractionsPage";
import type { Agent } from "../types";

const PAGE_SIZE = 5;

function TopAgentsByThreats() {
  const navigate = useNavigate();
  const { data: paged } = useAgentsPaged(1);
  const [localPage, setLocalPage] = useState(0);

  const sorted: Agent[] = [...paged.items].sort((a, b) => b.threats - a.threats).filter((a) => a.threats > 0);
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const slice = sorted.slice(localPage * PAGE_SIZE, localPage * PAGE_SIZE + PAGE_SIZE);

  return (
    <div className="card" style={{ display: "flex", flexDirection: "column" }}>
      <div style={{
        padding: "14px 16px 10px",
        borderBottom: "1px solid var(--line)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}>
        <span style={{ fontWeight: 600, fontSize: 13, color: "var(--fg)" }}>Top agents by threats</span>
        {totalPages > 1 && (
          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
            <button
              className="btn ghost"
              style={{ padding: "2px 8px", fontSize: 11.5 }}
              disabled={localPage === 0}
              onClick={() => setLocalPage((p) => p - 1)}
            >
              <Icon name="chevronLeft" size={12} />
            </button>
            <span style={{ fontSize: 11.5, color: "var(--fg-muted)", fontFamily: "var(--font-mono)", minWidth: 36, textAlign: "center" }}>
              {localPage + 1}/{totalPages}
            </span>
            <button
              className="btn ghost"
              style={{ padding: "2px 8px", fontSize: 11.5 }}
              disabled={localPage >= totalPages - 1}
              onClick={() => setLocalPage((p) => p + 1)}
            >
              <Icon name="chevron" size={12} />
            </button>
          </div>
        )}
      </div>

      {slice.length === 0 ? (
        <div style={{ padding: "24px 16px", textAlign: "center", color: "var(--fg-muted)", fontSize: 13 }}>
          No agents with threats
        </div>
      ) : (
        <div style={{ flex: 1 }}>
          {slice.map((agent, i) => {
            const globalRank = localPage * PAGE_SIZE + i + 1;
            const pct = agent.threats / (slice[0]?.threats || 1);
            return (
              <div
                key={agent.id}
                onClick={() => navigate(`/agents/${agent.id}`)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "9px 16px",
                  borderBottom: i < slice.length - 1 ? "1px solid var(--line)" : "none",
                  cursor: "pointer",
                  transition: "background 0.12s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-raised)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "")}
              >
                <span style={{
                  width: 20, textAlign: "right", fontFamily: "var(--font-mono)",
                  fontSize: 11, color: "var(--fg-faint)", flexShrink: 0,
                }}>
                  {globalRank}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--fg)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {agent.name}
                  </div>
                  <div style={{ marginTop: 4, height: 3, borderRadius: 99, background: "var(--line)", overflow: "hidden" }}>
                    <div style={{ width: `${Math.round(pct * 100)}%`, height: "100%", background: "#DC2626", borderRadius: 99, transition: "width 0.3s" }} />
                  </div>
                </div>
                <span className="chip threat" style={{ fontSize: 11, padding: "2px 7px", flexShrink: 0 }}>
                  {agent.threats}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function AlertsPage() {
  const { data: threats } = useAlerts();
  const { openDrawer } = useDrawer();
  const cols = useInteractionColumns((k, e) => openDrawer(k, e));

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Threats</h1>
          <div className="sub">{threats.length} threat-flagged interactions in the last 7 days</div>
        </div>
      </div>

      <div className="metrics">
        <MetricTile label="Threats" value={threats.length} icon="alerts" sparkColor="#DC2626" spark={[]} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 16, alignItems: "start" }}>
        <div className="card">
          <div className="tb-toolbar">
            <div className="filters">
              </div>
            <span className="count">{threats.length} flagged</span>
          </div>
          <DataTable
            rows={threats}
            columns={cols}
            onRowClick={(r) => openDrawer("interaction", r)}
            emptyText="No threats"
          />
        </div>

        <TopAgentsByThreats />
      </div>
    </div>
  );
}
