import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Icon } from "../components/Icon";
import { MetricTile } from "../components/MetricTile";
import { Tabs } from "../components/Tabs";
import { DataTable, type DataTableColumn } from "../components/DataTable";
import { EntityCell } from "../components/EntityCell";
import { ScoreBar } from "../components/ScoreBar";
import { InfoStat } from "../components/InfoStat";
import { LogsTable } from "../components/LogsTable";
import { useIntent, useIntentInteractionsPaged, useIntentParticipants, useLogs } from "../data/hooks";
import { Pagination } from "../components/Pagination";
import { useDrawer } from "../context/DrawerContext";
import { fmtRuntime, timeAgo } from "../lib/format";
import { useInteractionColumns } from "./InteractionsPage";
import { exportIntentPdf } from "../lib/exportIntentPdf";
import { useIntentLabel } from "../context/IntentNumbersContext";
import type { IntentParticipant, Tool } from "../types";

type Tab = "interactions" | "participants" | "logs";

export function IntentDetailPage() {
  const { intentId = "" } = useParams<{ intentId: string }>();
  const navigate = useNavigate();
  const { openDrawer } = useDrawer();
  const [tab, setTab] = useState<Tab>("interactions");
  const [interactionsPage, setInteractionsPage] = useState(1);

  const { data: intent, loading } = useIntent(intentId);
  const { data: interactionsPaged, loading: interactionsLoading } = useIntentInteractionsPaged(intentId, interactionsPage);
  const interactions = interactionsPaged.interactions;
  const interactionsTotal = interactionsPaged.total;
  const interactionsTotalPages = interactionsPaged.totalPages;
  const { data: participants } = useIntentParticipants(intentId);
  const { data: logs } = useLogs("intent", intentId);
  const interactionCols = useInteractionColumns((k, e) => openDrawer(k, e));
  const intentLabel = useIntentLabel();

  if (loading) {
    return (
      <div className="page">
        <div className="stub">
          <h2>Loading…</h2>
        </div>
      </div>
    );
  }

  if (!intent) {
    return (
      <div className="page">
        <div className="stub">
          <h2>Intent not found</h2>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, marginTop: 6 }}>{intentLabel(intentId)}</div>
          <button className="btn" style={{ marginTop: 16 }} onClick={() => navigate("/intents")}>
            <Icon name="arrowRight" size={14} style={{ transform: "rotate(180deg)" }} /> Back to intents
          </button>
        </div>
      </div>
    );
  }

  const participantRows = participants.map((p) => ({ ...p, id: `${p.type}:${p.entity.id}` }));
  const threatCount = interactions.filter((i: { threat: boolean }) => i.threat).length;

  const participantCols: DataTableColumn<IntentParticipant & { id: string }>[] = [
    {
      key: "name",
      label: "Name",
      render: (r) => <EntityCell name={r.entity.name} sub={r.entity.id} paletteIx={r.entity.name.charCodeAt(0)} />,
    },
    {
      key: "count",
      label: "Interactions in this intent",
      align: "right",
      render: (r) => <span style={{ fontFamily: "var(--font-mono)", fontSize: 12.5 }}>{r.count}</span>,
    },
    {
      key: "threats",
      label: "Threats",
      align: "right",
      render: (r) =>
        r.threats > 0 ? (
          <span className="chip threat">{r.threats}</span>
        ) : (
          <span style={{ color: "var(--fg-faint)", fontFamily: "var(--font-mono)", fontSize: 12.5 }}>0</span>
        ),
    },
    {
      key: "score",
      label: "Reliability",
      align: "right",
      render: (r) => {
        if (r.count <= 0) {
          return <span style={{ color: "var(--fg-faint)", fontFamily: "var(--font-mono)", fontSize: 12.5 }}>—</span>;
        }
        const pct = Math.max(0, Math.round((((r.count - r.threats) / r.count) * 100) * 100) / 100);
        return <ScoreBar value={pct} />;
      },
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
              if (r.type === "agent") navigate(`/agents/${r.entity.id}`);
              else openDrawer("tool", r.entity as unknown as Tool);
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
      {/* Breadcrumb back */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 14, fontSize: 13 }}>
        <button
          className="btn ghost"
          style={{ padding: "4px 8px", fontSize: 12.5 }}
          onClick={() => navigate("/intents")}
        >
          <Icon name="arrowRight" size={12} style={{ transform: "rotate(180deg)" }} /> Intents
        </button>
        <span style={{ color: "var(--fg-faint)" }}>/</span>
        <span style={{ color: "var(--fg)", fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 600 }}>{intentLabel(intent.id)}</span>
      </div>

      {/* Hero info card */}
      <div className="card" style={{ padding: "24px 28px", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 20 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: 24,
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 10.5,
                    color: "var(--fg-muted)",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    marginBottom: 6,
                    fontWeight: 600,
                  }}
                >
                  Initiator
                </div>
                <div
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: 20,
                    fontWeight: 600,
                    color: "var(--fg)",
                    letterSpacing: "-0.01em",
                    wordBreak: "break-word",
                  }}
                >
                  {intent.initiator.name || "—"}
                </div>
              </div>
              <InfoStat label="Runtime" value={fmtRuntime(intent.runtime)} mono />
              <InfoStat label="Started" value={timeAgo(intent.started)} />
              <InfoStat
                label="Threat detected"
                value={
                  <span style={{ color: threatCount > 0 ? "var(--threat)" : "var(--fg)", fontWeight: 600 }}>
                    {threatCount}
                  </span>
                }
                mono
              />
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <button className="btn primary" onClick={() => navigate(`/graph/${intent.id}`)}>
              <Icon name="flow" size={14} />
              View Flow
            </button>
            <button
              className="btn"
              onClick={() => exportIntentPdf({ intent, interactions, participants })}
            >
              <Icon name="download" size={14} />
              Export
            </button>
          </div>
        </div>
      </div>

      {/* Activity metrics */}
      <div className="metrics">
        <MetricTile label="Interactions" value={interactions.length} icon="activity" sparkColor="#2563EB" spark={[]} />
        <MetricTile label="Agents touched" value={intent.agentsInteracted} icon="agents" sparkColor="#0EA5E9" spark={[]} />
        <MetricTile label="Apps touched" value={intent.toolsInteracted} icon="box" sparkColor="#0A2240" spark={[]} />
        <MetricTile label="Threats" value={threatCount} icon="shield" sparkColor="#DC2626" spark={[]} />
      </div>

      {/* Tabbed table */}
      <div className="card">
        <Tabs
          active={tab}
          onChange={(k) => setTab(k as Tab)}
          tabs={[
            { key: "interactions", label: "Interactions", count: interactionsTotal },
            { key: "participants", label: "Agents & Apps", count: participantRows.length },
            { key: "logs", label: "Logs", count: logs.length },
          ]}
        />

        {tab === "interactions" && (
          <>
            <DataTable
              rows={interactions}
              columns={interactionCols}
              onRowClick={(r) => openDrawer("interaction", r)}
              emptyText={interactionsLoading ? "Loading…" : "No interactions recorded for this intent yet."}
            />
            <Pagination page={interactionsPage} totalPages={interactionsTotalPages} total={interactionsTotal} pageSize={10} loading={interactionsLoading} onChange={setInteractionsPage} />
          </>
        )}

        {tab === "participants" && (
          <DataTable
            rows={participantRows}
            columns={participantCols}
            onRowClick={(r) =>
              r.type === "agent" ? navigate(`/agents/${r.entity.id}`) : openDrawer("tool", r.entity as unknown as Tool)
            }
            emptyText="No participants found."
          />
        )}

        {tab === "logs" && <LogsTable logs={logs} />}
      </div>
    </div>
  );
}
