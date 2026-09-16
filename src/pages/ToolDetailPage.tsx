import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Icon } from "../components/Icon";
import { DataTable, type DataTableColumn } from "../components/DataTable";
import { AppIcon } from "../components/AppIcon";
import { ThreatPill } from "../components/ThreatPill";
import { LedgerTable } from "../components/LedgerTable";
import { Pagination } from "../components/Pagination";
import { useToolInfo, useToolAgentScores } from "../data/hooks";
import { useDrawer } from "../context/DrawerContext";
import { useResolveName, resolveDisplayName } from "../context/DirectoryContext";
import { timeAgo } from "../lib/format";
import { IntentIdChip } from "../context/IntentNumbersContext";
import type { Intent, IntentReviewStatus } from "../types";
import type { ToolAgentScore } from "../data/api";

type Tab = "interactions" | "intents" | "agents";

// Matches the pill styling used on the main Intents page (IntentsPage.tsx) so
// review status looks identical everywhere it's shown.
const REVIEW_STATUS_STYLE: Record<IntentReviewStatus, { color: string; bg: string }> = {
  Ongoing: { color: "var(--accent)", bg: "rgba(37,99,235,0.10)" },
  Acknowledged: { color: "var(--safe)", bg: "rgba(5,150,105,0.10)" },
  Flagged: { color: "var(--threat)", bg: "rgba(220,38,38,0.10)" },
};

export function ToolDetailPage() {
  const { toolId = "" } = useParams<{ toolId: string }>();
  const navigate = useNavigate();
  const { openDrawer } = useDrawer();
  const resolve = useResolveName();

  const [tab, setTab] = useState<Tab>("interactions");
  const [interactionsPage, setInteractionsPage] = useState(1);
  const [intentsPage, setIntentsPage] = useState(1);

  const { data: result, loading } = useToolInfo(toolId, interactionsPage, intentsPage);
  const { data: agentScores } = useToolAgentScores(result?.tool.id || toolId);

  if (loading) {
    return (
      <div className="page">
        <div className="stub"><h2>Loading…</h2></div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="page">
        <div className="stub">
          <h2>App not found</h2>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, marginTop: 6 }}>{toolId}</div>
          <button className="btn" style={{ marginTop: 16 }} onClick={() => navigate("/agents")}>
            <Icon name="arrowRight" size={14} style={{ transform: "rotate(180deg)" }} /> Back to apps
          </button>
        </div>
      </div>
    );
  }

  const { tool, interactions, interactionsTotal, interactionsTotalPages, intents, intentsTotal, intentsTotalPages } = result;

  // Matches the columns used on the main Intents page (IntentsPage.tsx) so an
  // intent looks the same everywhere it's listed. No "Apps interacted" column
  // here — /tool-info's intents list doesn't return per-intent participant
  // lists, only this tool's own totals, so there's nothing real to show there.
  const intentCols: DataTableColumn<Intent>[] = [
    {
      key: "id",
      label: "Intent",
      sortFn: (a, b) => a.id.localeCompare(b.id),
      render: (r) => (
        <IntentIdChip id={r.id} style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 600, color: "var(--fg)" }} />
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
      sortFn: (a, b) => a.interactionsCount - b.interactionsCount,
      render: (r) => <span style={{ fontFamily: "var(--font-mono)", fontSize: 12.5 }}>{r.interactionsCount}</span>,
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
          {r.started ? timeAgo(r.started) : "—"}
        </span>
      ),
    },
    {
      key: "actions",
      label: "",
      align: "right",
      width: 100,
      render: (r) => (
        <div className="row-actions">
          <button
            className="btn-mini"
            style={{ fontSize: 13, padding: "7px 16px" }}
            onClick={(e) => { e.stopPropagation(); navigate(`/intents/${r.id}`); }}
          >
            View
          </button>
        </div>
      ),
    },
  ];

  const agentCols: DataTableColumn<ToolAgentScore>[] = [
    {
      key: "agent",
      label: "Agent Name",
      render: (r) => <span style={{ fontSize: 13, color: "var(--fg)", fontWeight: 600 }}>{r.agentName}</span>,
    },
    {
      key: "trust",
      label: "Trust Score",
      render: (r) => <span style={{ fontFamily: "var(--font-mono)", fontSize: 12.5 }}>{r.trustScore}</span>,
    },
    {
      key: "intentScore",
      label: "Intent Score",
      render: (r) => <span style={{ fontFamily: "var(--font-mono)", fontSize: 12.5 }}>{r.intentScore}</span>,
    },
    {
      key: "hallucinationScore",
      label: "Hallucination Score",
      render: (r) => <span style={{ fontFamily: "var(--font-mono)", fontSize: 12.5 }}>{r.hallucinationScore}</span>,
    },
    {
      key: "policyScore",
      label: "Policy Score",
      render: (r) => <span style={{ fontFamily: "var(--font-mono)", fontSize: 12.5 }}>{r.policyScore}</span>,
    },
  ];

  return (
    <div className="page">
      {/* Breadcrumb */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 14, fontSize: 13 }}>
        <button className="btn ghost" style={{ padding: "4px 8px", fontSize: 12.5 }} onClick={() => navigate("/agents", { state: { tab: "tools" } })}>
          <Icon name="arrowRight" size={12} style={{ transform: "rotate(180deg)" }} /> Apps
        </button>
        <span style={{ color: "var(--fg-faint)" }}>/</span>
        <span style={{ color: "var(--fg)", fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 600 }}>
          {tool.name}
        </span>
      </div>

      {/* Hero card */}
      <div className="card" style={{ padding: "24px 28px", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 20 }}>
          <AppIcon name={tool.name} size={64} />

          <div style={{ flex: 1, position: "relative" }}>
            {interactions[0]?.created && (
              <div style={{ position: "absolute", top: 0, right: 0, display: "flex", alignItems: "center", gap: 5, fontSize: 12.5, fontWeight: 700, color: "var(--fg)", fontFamily: "var(--font-mono)" }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--safe)", display: "inline-block", flexShrink: 0 }} />
                active · {timeAgo(interactions[0].created)}
              </div>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <h1 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 600, letterSpacing: "-0.02em", color: "var(--fg)" }}>
                {tool.name}
              </h1>
              <span className={`chip ${tool.score >= 70 ? "safe" : "warn"}`}>
                <span className={`dot-status ${tool.score >= 70 ? "safe" : "warn"}`} />
                {tool.score >= 70 ? "healthy" : "needs review"}
              </span>
              <span className="chip info" style={{ fontSize: 10.5, padding: "2px 7px" }}>app</span>
            </div>
            <div style={{ color: "var(--fg-muted)", fontSize: 12.5, fontFamily: "var(--font-mono)", marginBottom: 16 }}>
              {tool.id !== tool.name ? tool.id : ""}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 24, borderTop: "1px solid var(--line)", paddingTop: 16 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--fg-muted)", marginBottom: 4 }}>Interactions</div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 18, fontWeight: 700, color: "var(--fg)" }}>{tool.totalInteractions.toLocaleString()}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--fg-muted)", marginBottom: 4 }}>Threats</div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 18, fontWeight: 700, color: tool.totalThreats > 0 ? "var(--threat)" : "var(--fg)" }}>{tool.totalThreats.toLocaleString()}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--fg-muted)", marginBottom: 4 }}>Intents</div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 18, fontWeight: 700, color: "var(--fg)" }}>{tool.totalIntents.toLocaleString()}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--fg-muted)", marginBottom: 4 }}>Agents Interacted</div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 18, fontWeight: 700, color: "var(--fg)" }}>{tool.totalAgents.toLocaleString()}</div>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Tabbed table */}
      <div className="card">
        <div className="tb-toolbar">
          <div className="filters">
            {([{ key: "interactions", label: "Interactions", count: interactionsTotal }, { key: "intents", label: "Intents", count: intentsTotal }, { key: "agents", label: "Agents", count: agentScores.length }] as const).map((t) => (
              <div
                key={t.key}
                className={`tab ${tab === t.key ? "active" : ""}`}
                onClick={() => setTab(t.key)}
              >
                {t.label}
                <span className="pill">{t.count}</span>
              </div>
            ))}
          </div>
          {tab === "interactions" && (
            <Pagination page={interactionsPage} totalPages={interactionsTotalPages} total={interactionsTotal} pageSize={10} inline onChange={setInteractionsPage} />
          )}
          {tab === "intents" && (
            <Pagination page={intentsPage} totalPages={intentsTotalPages} total={intentsTotal} pageSize={10} inline onChange={setIntentsPage} />
          )}
        </div>

        {tab === "interactions" && (
          <LedgerTable
            rows={interactions}
            emptyText="No interactions yet."
            onView={(r) => openDrawer("interaction", r)}
          />
        )}

        {tab === "intents" && (
          <DataTable
            rows={intents}
            columns={intentCols}
            onRowClick={(r) => navigate(`/intents/${r.id}`)}
            emptyText="No intents yet."
          />
        )}

        {tab === "agents" && (
          <DataTable
            rows={agentScores}
            columns={agentCols}
            emptyText="No agents have this app in their toolset yet."
          />
        )}
      </div>
    </div>
  );
}
