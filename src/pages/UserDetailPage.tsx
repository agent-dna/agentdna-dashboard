import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Icon } from "../components/Icon";
import { MetricTile } from "../components/MetricTile";
import { Tabs } from "../components/Tabs";
import { DataTable, type DataTableColumn } from "../components/DataTable";
import { InfoStat } from "../components/InfoStat";
import { LedgerTable } from "../components/LedgerTable";
import { Pagination } from "../components/Pagination";
import { useDrawer } from "../context/DrawerContext";
import { IntentIdChip } from "../context/IntentNumbersContext";
import { fmtRuntime, initials, timeAgo } from "../lib/format";
import { ScoreBar } from "../components/ScoreBar";
import { useUserInfo } from "../data/hooks";
import type { DeployedAgent } from "../data/api";
import type { Interaction, Intent } from "../types";

type Tab = "interactions" | "intents" | "threats" | "agents";

export function UserDetailPage() {
  const { userId = "" } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { openDrawer } = useDrawer();

  const [tab, setTab] = useState<Tab>("interactions");
  const [interactionsPage, setInteractionsPage] = useState(1);
  const [intentsPage, setIntentsPage] = useState(1);
  const [threatsPage, setThreatsPage] = useState(1);
  const [agentsPage, setAgentsPage] = useState(1);

  const [revoking, setRevoking] = useState(false);
  const [granting, setGranting] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState(false);

  const { data: result, loading } = useUserInfo(
    userId, interactionsPage, intentsPage, threatsPage, agentsPage,
  );

  // ─── Loading ─────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="page">
        <div className="stub"><h2>Loading…</h2></div>
      </div>
    );
  }

  // ─── Not found / no data ─────────────────────────────────────────────────
  if (!result) {
    return (
      <div className="page">
        {/* Breadcrumb */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 14, fontSize: 13 }}>
          <button className="btn ghost" style={{ padding: "4px 8px", fontSize: 12.5 }} onClick={() => navigate("/requests", { state: { tab: "users" } })}>
            <Icon name="arrowRight" size={12} style={{ transform: "rotate(180deg)" }} /> Users
          </button>
          <span style={{ color: "var(--fg-faint)" }}>/</span>
          <span style={{ color: "var(--fg-muted)", fontFamily: "var(--font-mono)", fontSize: 12 }}>{userId}</span>
        </div>

        <div className="stub">
          <h2>User not found</h2>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, marginTop: 6, color: "var(--fg-muted)" }}>{userId}</div>
          <button className="btn" style={{ marginTop: 16 }} onClick={() => navigate("/requests", { state: { tab: "users" } })}>
            <Icon name="arrowRight" size={14} style={{ transform: "rotate(180deg)" }} /> Back to users
          </button>
        </div>

        {/* Coming soon notice */}
        <div className="card" style={{ marginTop: 20, padding: "28px 28px" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(37,99,235,0.08)", border: "1px solid rgba(37,99,235,0.16)", display: "grid", placeItems: "center", flexShrink: 0 }}>
              <Icon name="activity" size={18} style={{ color: "var(--accent)" }} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--fg)", marginBottom: 4 }}>API endpoint required</div>
              <div style={{ fontSize: 13, color: "var(--fg-muted)", lineHeight: 1.6, maxWidth: 500 }}>
                This page is scaffolded and ready. Once the <code style={{ fontFamily: "var(--font-mono)", fontSize: 12, background: "var(--surface-raised)", padding: "1px 5px", borderRadius: 4 }}>GET /dashboard/v1/user-info</code> endpoint is live, the full user profile, activity metrics and interaction history will appear here.
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const {
    user,
    interactions, interactionsTotal, interactionsTotalPages,
    intents, intentsTotal, intentsTotalPages,
    threats, threatsTotal, threatsTotalPages,
    agents, agentsTotal, agentsTotalPages,
  } = result;

  const displayName = user.displayName || user.userName || user.userID?.slice(0, 8) || "?";
  const currentPageFor = (t: Tab) =>
    t === "interactions" ? interactionsPage
    : t === "intents" ? intentsPage
    : t === "threats" ? threatsPage
    : agentsPage;
  const setPageFor = (t: Tab, p: number) => {
    if (t === "interactions") setInteractionsPage(p);
    else if (t === "intents") setIntentsPage(p);
    else if (t === "threats") setThreatsPage(p);
    else setAgentsPage(p);
  };
  const totalPagesFor = (t: Tab) =>
    t === "interactions" ? interactionsTotalPages
    : t === "intents" ? intentsTotalPages
    : t === "threats" ? threatsTotalPages
    : agentsTotalPages;
  const totalCountFor = (t: Tab) =>
    t === "interactions" ? interactionsTotal
    : t === "intents" ? intentsTotal
    : t === "threats" ? threatsTotal
    : agentsTotal;

  const intentCols: DataTableColumn<Intent>[] = [
    {
      key: "id",
      label: "Intent",
      render: (r) => (
        <IntentIdChip id={r.id} style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 600, color: "var(--fg)" }} />
      ),
    },
    {
      key: "runtime",
      label: "Runtime",
      align: "right",
      render: (r) => <span style={{ fontFamily: "var(--font-mono)", fontSize: 12.5 }}>{fmtRuntime(r.runtime)}</span>,
    },
    {
      key: "agents",
      label: "Agents",
      align: "right",
      render: (r) => <span style={{ fontFamily: "var(--font-mono)", fontSize: 12.5 }}>{r.agentsInteracted}</span>,
    },
    {
      key: "tools",
      label: "Apps",
      align: "right",
      render: (r) => <span style={{ fontFamily: "var(--font-mono)", fontSize: 12.5 }}>{r.toolsInteracted}</span>,
    },
    {
      key: "threats",
      label: "Threats",
      align: "right",
      render: (r) =>
        r.threats > 0
          ? <span className="chip threat">{r.threats}</span>
          : <span style={{ color: "var(--fg-faint)", fontFamily: "var(--font-mono)", fontSize: 12.5 }}>0</span>,
    },
    {
      key: "score",
      label: "Score",
      align: "right",
      render: (r) => {
        const ix = r.agentsInteracted + r.toolsInteracted;
        if (ix <= 0) return <span style={{ color: "var(--fg-faint)", fontFamily: "var(--font-mono)", fontSize: 12.5 }}>—</span>;
        const pct = Math.max(0, Math.round((((ix - r.threats) / ix) * 100) * 100) / 100);
        return <ScoreBar value={pct} />;
      },
    },
    {
      key: "started",
      label: "Started",
      align: "right",
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
          <button className="btn-mini" onClick={(e) => { e.stopPropagation(); navigate(`/intents/${r.id}`); }}>
            View
          </button>
        </div>
      ),
    },
  ];

  const agentCols: DataTableColumn<DeployedAgent>[] = [
    {
      key: "name",
      label: "Agent",
      render: (r) => (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: "linear-gradient(135deg, rgba(37,99,235,0.18), rgba(14,165,233,0.05))", display: "grid", placeItems: "center", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 11, color: "var(--accent)", border: "1px solid var(--line-strong)", flexShrink: 0 }}>
            {initials(r.name || "A")}
          </div>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--fg)" }}>{r.name}</span>
        </div>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (r) => (
        <span className={`chip ${r.status === "warn" ? "warn" : r.status === "inactive" ? "" : "safe"}`}>
          <span className={`dot-status ${r.status === "warn" ? "warn" : r.status === "inactive" ? "" : "safe"}`} />
          {r.status === "warn" ? "needs review" : r.status === "inactive" ? "inactive" : "healthy"}
        </span>
      ),
    },
    {
      key: "interactions",
      label: "Interactions",
      align: "right",
      render: (r) => <span style={{ fontFamily: "var(--font-mono)", fontSize: 12.5 }}>{r.interactions.toLocaleString()}</span>,
    },
    {
      key: "threats",
      label: "Threats",
      align: "right",
      render: (r) =>
        r.threats > 0
          ? <span className="chip threat">{r.threats}</span>
          : <span style={{ color: "var(--fg-faint)", fontFamily: "var(--font-mono)", fontSize: 12.5 }}>0</span>,
    },
    {
      key: "created",
      label: "Created",
      align: "right",
      render: (r) => <span style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, color: "var(--fg-muted)" }}>{timeAgo(r.created)}</span>,
    },
    {
      key: "actions",
      label: "",
      align: "right",
      width: 60,
      render: (r) => (
        <div className="row-actions">
          <button className="btn-mini" onClick={(e) => { e.stopPropagation(); navigate(`/agents/${encodeURIComponent(r.id)}`); }}>
            View
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="page">
      {/* Breadcrumb */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 14, fontSize: 13 }}>
        <button className="btn ghost" style={{ padding: "4px 8px", fontSize: 12.5 }} onClick={() => navigate("/requests", { state: { tab: "users" } })}>
          <Icon name="arrowRight" size={12} style={{ transform: "rotate(180deg)" }} /> Users
        </button>
        <span style={{ color: "var(--fg-faint)" }}>/</span>
        <span style={{ color: "var(--fg)", fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 600 }}>{user.userName}</span>
      </div>

      {/* Hero card */}
      <div className="card" style={{ padding: "24px 28px", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 20 }}>
          {/* Avatar */}
          <div style={{ width: 64, height: 64, borderRadius: 14, background: "linear-gradient(135deg, rgba(37,99,235,0.18), rgba(14,165,233,0.05))", display: "grid", placeItems: "center", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 22, color: "var(--accent)", border: "1px solid var(--line-strong)", flexShrink: 0 }}>
            {initials(displayName)}
          </div>

          {/* Info */}
          <div style={{ flex: 1, position: "relative" }}>
            {/* Last active badge */}
            {user.lastActiveMinsAgo > 0 && (
              <div style={{ position: "absolute", top: 0, right: 0, display: "flex", alignItems: "center", gap: 5, fontSize: 12.5, fontWeight: 700, color: "var(--fg)", fontFamily: "var(--font-mono)" }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--safe)", display: "inline-block", flexShrink: 0 }} />
                active · {timeAgo(user.lastActiveMinsAgo)}
              </div>
            )}

            {/* Name + chips */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <h1 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 600, letterSpacing: "-0.02em", color: "var(--fg)" }}>
                {displayName}
              </h1>
              <span className={`chip ${user.isActive ? "safe" : "warn"}`}>
                <span className={`dot-status ${user.isActive ? "safe" : "warn"}`} />
                {user.isActive ? "active" : "suspended"}
              </span>
              <span className="chip info" style={{ fontSize: 10.5, padding: "2px 7px" }}>user</span>
            </div>

            {/* User ID */}
            <div style={{ color: "var(--fg-muted)", fontSize: 13, fontFamily: "var(--font-mono)", marginBottom: 16 }}>
              {user.userID}
            </div>

            {/* Info grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 24, borderTop: "1px solid var(--line)", paddingTop: 16 }}>
              <InfoStat label="Email" value={user.userName} />
              <InfoStat label="Joined" value={timeAgo(user.createdMinsAgo)} />
              <InfoStat label="Agents Access" value={user.accessAgentCount} mono />
              <InfoStat label="Agents Deployed" value={user.totalAgentsDeployed} mono />
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <button
              className="btn primary"
              disabled={granting}
              onClick={async () => {
                setGranting(true);
                // TODO: call grantAgentAccess or a user-level grant API
                setGranting(false);
              }}
            >
              <Icon name="plus" size={14} />
              {granting ? "Granting…" : "Grant access"}
            </button>
            <button
              className="btn"
              disabled={revoking}
              style={{ color: "var(--threat)", borderColor: "rgba(220,38,38,0.3)" }}
              onClick={() => setConfirmRevoke(true)}
            >
              <Icon name="shield" size={14} />
              {revoking ? "Revoking…" : "Revoke access"}
            </button>
          </div>
        </div>
      </div>

      {/* Metric tiles */}
      <div className="metrics">
        <MetricTile label="Interactions" value={user.totalInteractions.toLocaleString()} icon="activity" sparkColor="#0EA5E9" spark={[]} />
        <MetricTile label="Threats" value={user.totalThreats} icon="shield" sparkColor="#DC2626" spark={[]} />
        <MetricTile label="Intents" value={user.totalIntents.toLocaleString()} icon="intents" sparkColor="#0A2240" spark={[]} />
        <MetricTile label="Agents Deployed" value={user.totalAgentsDeployed} icon="box" sparkColor="#2563EB" spark={[]} />
      </div>

      {/* Tabbed table */}
      <div className="card">
        <div style={{ display: "flex", alignItems: "center", borderBottom: "1px solid var(--line)" }}>
          {/* marginBottom: -1 collapses .tabs own border into the wrapper border */}
          <div style={{ flex: 1, marginBottom: -1 }}>
            <Tabs
              active={tab}
              onChange={(k) => setTab(k as Tab)}
              tabs={[
                { key: "interactions", label: "Interactions", count: interactionsTotal },
                { key: "intents", label: "Intents", count: intentsTotal },
                { key: "threats", label: "Threats", count: threatsTotal },
                { key: "agents", label: "Agents Deployed", count: agentsTotal },
              ]}
            />
          </div>
          <div style={{ paddingRight: 16, flexShrink: 0 }}>
            <Pagination
              page={currentPageFor(tab)}
              totalPages={totalPagesFor(tab)}
              total={totalCountFor(tab)}
              pageSize={10}
              inline
              onChange={(p) => setPageFor(tab, p)}
            />
          </div>
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

        {tab === "threats" && (
          <LedgerTable
            rows={threats}
            emptyText="No threats detected."
            onView={(r) => openDrawer("interaction", r)}
          />
        )}

        {tab === "agents" && (
          <DataTable
            rows={agents}
            columns={agentCols}
            onRowClick={(r) => navigate(`/agents/${encodeURIComponent(r.id)}`)}
            emptyText="No agents deployed yet."
          />
        )}
      </div>

      {/* Revoke access confirmation modal */}
      {confirmRevoke && (
        <div style={{ position: "fixed", inset: 0, zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={() => setConfirmRevoke(false)}>
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(2px)" }} />
          <div style={{ position: "relative", background: "var(--surface)", border: "1px solid var(--line-strong)", borderRadius: 14, padding: "28px 28px 24px", width: 400, boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}
            onClick={(e) => e.stopPropagation()}>
            {/* Icon */}
            <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.18)", display: "grid", placeItems: "center", marginBottom: 16 }}>
              <Icon name="shield" size={20} style={{ color: "var(--threat)" }} />
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--fg)", marginBottom: 8 }}>Revoke access</div>
            <div style={{ fontSize: 13.5, color: "var(--fg-muted)", lineHeight: 1.6, marginBottom: 24 }}>
              Are you sure you want to revoke all access for{" "}
              <span style={{ fontWeight: 600, color: "var(--fg)" }}>{user.displayName || user.userName}</span>?
              This will remove their access to all agents immediately.
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button className="btn" onClick={() => setConfirmRevoke(false)}>Cancel</button>
              <button
                className="btn"
                disabled={revoking}
                style={{ background: "var(--threat)", color: "#fff", border: "none" }}
                onClick={async () => {
                  setRevoking(true);
                  // TODO: call revokeAgentAccess or user-level revoke API
                  setRevoking(false);
                  setConfirmRevoke(false);
                }}
              >
                {revoking ? "Revoking…" : "Yes, revoke access"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
