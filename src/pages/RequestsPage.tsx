import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "../components/Icon";
import { Tabs } from "../components/Tabs";
import { AgentRequestModal } from "../components/forms/AgentRequestModal";
import { DeployAgentModal, type DeployPhase } from "../components/forms/DeployAgentModal";
import { UsersTab } from "./requests/UsersTab";
import { useAuth } from "../context/AuthContext";
import { useResolveName } from "../context/DirectoryContext";
import { ApiError } from "../api/client";
import {
  listAccessRequestsForOrg,
  listAccessRequestsForUser,
  listAgentCreationRequests,
  listAgentCreationRequestsForUser,
  submitAccessRequestResult,
  submitAgentCreationResult,
  type AgentRequest,
  type RequestStatus,
} from "../api/requests";

type TabKey = "creation" | "access-org" | "access-mine" | "users";

function StatusChip({ status }: { status: RequestStatus }) {
  if (status === "approved") return <span className="chip safe"><span className="dot-status safe" /> approved</span>;
  if (status === "rejected") return <span className="chip threat"><span className="dot-status threat" /> rejected</span>;
  return <span className="chip warn"><span className="dot-status warn" /> pending</span>;
}

function fmtDate(s: string) {
  try {
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return s;
    return d.toLocaleString();
  } catch {
    return s;
  }
}

function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (p: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <button className="btn primary" style={{ padding: "4px 10px", fontSize: 12 }} disabled={page <= 1} onClick={() => onChange(page - 1)}>Prev</button>
      <span style={{ padding: "4px 10px", fontSize: 12, fontFamily: "var(--font-mono)", fontWeight: 600, color: "var(--fg)", background: "var(--surface-raised)", border: "1px solid var(--line-strong)", borderRadius: 6, minWidth: 52, textAlign: "center" as const }}>
        {page} / {totalPages}
      </span>
      <button className="btn primary" style={{ padding: "4px 10px", fontSize: 12 }} disabled={page >= totalPages} onClick={() => onChange(page + 1)}>Next</button>
    </div>
  );
}

export function RequestsPage() {
  const { user } = useAuth();
  const isAdmin = !!user?.is_admin;
  const resolve = useResolveName();
  const navigate = useNavigate();

  const [tab, setTab] = useState<TabKey>("creation");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<AgentRequest[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noDid, setNoDid] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<AgentRequest | null>(null);
  const [deploy, setDeploy] = useState<{
    open: boolean;
    phase: DeployPhase;
    agentName?: string;
    errorMessage?: string;
  }>({ open: false, phase: "loading" });

  const load = useCallback(async () => {
    if (tab === "users") return; // Users tab handles its own fetch
    setLoading(true);
    setError(null);
    setNoDid(false);
    try {
      const fetcher =
        tab === "creation"
          ? isAdmin
            ? listAgentCreationRequests
            : listAgentCreationRequestsForUser
          : tab === "access-org"
          ? listAccessRequestsForOrg
          : listAccessRequestsForUser;
      const res = await fetcher(page);
      setRows(res.requestsList || []);
      setTotal(res.total || 0);
      setTotalPages(res.totalPages || 1);
    } catch (err) {
      if (err instanceof ApiError && err.message === "no_did") {
        setNoDid(true);
        setRows([]);
        setTotal(0);
        setTotalPages(1);
      } else {
        setError(err instanceof ApiError ? err.message : "Failed to load requests");
        setRows([]);
        setTotal(0);
        setTotalPages(1);
      }
    } finally {
      setLoading(false);
    }
  }, [tab, page, isAdmin]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [tab]);

  const handleApprove = async (r: AgentRequest, status: "approved" | "rejected") => {
    // Approving a deploy_agent request → open the deploy modal so the admin sees
    // a "Deploying your agent securely" → "Deployed" affordance instead of a
    // silent button. Rejections + access requests stay snappy/silent.
    const showDeployModal = r.requestType === "deploy_agent" && status === "approved";
    if (showDeployModal) {
      setDeploy({ open: true, phase: "loading", agentName: r.agentName });
    }
    console.log(`[approve] clicked → requestID=${r.requestID} requestType=${r.requestType} status=${status}`);

    const startedAt = performance.now();
    try {
      let response: unknown;
      if (r.requestType === "deploy_agent") {
        response = await submitAgentCreationResult(r.requestID, status);
      } else {
        response = await submitAccessRequestResult(r.requestID, status);
      }
      const apiElapsed = performance.now() - startedAt;
      console.log(`[approve] response received in ${apiElapsed.toFixed(0)}ms →`, response);
      if (showDeployModal) {
        setDeploy((d) => ({ ...d, phase: "done" }));
      }
      load();
    } catch (err) {
      const apiElapsed = performance.now() - startedAt;
      const message = err instanceof ApiError ? err.message : "Action failed";
      console.error(
        `[approve] error after ${apiElapsed.toFixed(0)}ms → status=${err instanceof ApiError ? err.status : "n/a"} message="${message}"`,
        err,
      );
      if (showDeployModal) {
        setDeploy((d) => ({ ...d, phase: "error", errorMessage: message }));
      } else {
        alert(message);
      }
    }
  };

  function RequestsLedger() {
    if (rows.length === 0) {
      return (
        <div style={{ padding: "40px 0", textAlign: "center", color: "var(--fg-faint)", fontSize: 13, fontFamily: "var(--font-mono)" }}>
          {loading ? "Loading…" : "No requests"}
        </div>
      );
    }

    const TH = ({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) => (
      <th style={{ padding: "10px 22px", textAlign: align, fontSize: 11.5, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.07em", color: "var(--fg-muted)", borderBottom: "1px solid var(--line)", whiteSpace: "nowrap" as const, background: "transparent" }}>
        {children}
      </th>
    );

    return (
      <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
        <colgroup>
          <col style={{ width: "15%" }} />
          <col style={{ width: "20%" }} />
          <col style={{ width: "20%" }} />
          <col style={{ width: "11%" }} />
          <col style={{ width: "18%" }} />
          <col style={{ width: "16%" }} />
        </colgroup>
        <thead>
          <tr>
            <TH>Request ID</TH>
            <TH>Agent</TH>
            <TH>Creator</TH>
            <TH>Status</TH>
            <TH>Created</TH>
            <TH align="right">Actions</TH>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            let agentLabel = r.agentName?.trim();
            if (!agentLabel && r.agentDID) {
              const hit = resolve(r.agentDID);
              if (hit.kind && hit.name) agentLabel = hit.name;
            }
            if (!agentLabel && r.agentDID) agentLabel = `${r.agentDID.slice(0, 18)}…`;

            let creatorLabel = "—";
            let creatorMono = false;
            if (r.creatorDID) {
              const hit = resolve(r.creatorDID);
              creatorLabel = hit.kind && hit.name ? hit.name : `${r.creatorDID.slice(0, 18)}…`;
              creatorMono = !hit.kind;
            }

            const isCreator = r.creatorDID === user?.did;
            const canEdit = tab === "creation" && r.status === "pending" && (isCreator || isAdmin);
            const canApprove = isAdmin && r.status === "pending" && (tab === "creation" || tab === "access-org");

            const td: React.CSSProperties = { padding: "14px 22px", borderBottom: "1px solid var(--line)", verticalAlign: "middle" };

            return (
              <tr key={r.requestID} style={{ transition: "background 0.1s" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-hover)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "")}>
                <td style={td}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--fg)" }}>
                    <span style={{ opacity: 0.4 }}>req_</span>{r.requestID.slice(0, 12)}
                  </span>
                </td>
                <td style={td}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--fg)" }}>{agentLabel || "—"}</span>
                </td>
                <td style={td}>
                  <span style={{ fontFamily: creatorMono ? "var(--font-mono)" : "var(--font-body)", fontSize: 13, fontWeight: creatorMono ? 500 : 600, color: creatorMono ? "var(--fg-muted)" : "var(--fg)" }}>
                    {creatorLabel}
                  </span>
                </td>
                <td style={td}><StatusChip status={r.status} /></td>
                <td style={td}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, color: "var(--fg-muted)" }}>{fmtDate(r.createdAt)}</span>
                </td>
                <td style={{ ...td, textAlign: "right" }}>
                  <div className="row-actions" style={{ justifyContent: "flex-end" }}>
                    {canEdit && (
                      <button className="btn-mini" onClick={(e) => { e.stopPropagation(); setEditTarget(r); }}>Edit</button>
                    )}
                    {canApprove && (
                      <>
                        <button className="btn-mini" onClick={(e) => { e.stopPropagation(); handleApprove(r, "approved"); }}>Approve</button>
                        <button className="btn-mini" style={{ color: "var(--threat)", borderColor: "rgba(220,38,38,0.3)" }} onClick={(e) => { e.stopPropagation(); handleApprove(r, "rejected"); }}>Reject</button>
                      </>
                    )}
                    {!canEdit && !canApprove && r.status !== "pending" && (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, color: "var(--fg-muted)", fontFamily: "var(--font-mono)" }}>
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--fg-faint)", flexShrink: 0, display: "inline-block" }} />
                        Acknowledged
                      </span>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  }

  const tabs: { key: TabKey; label: string }[] = [
    { key: "creation", label: "Agent Creation" },
    ...(isAdmin ? [] : [{ key: "access-mine" as const, label: "My Access" }]),
    ...(isAdmin ? ([{ key: "users", label: "Users" }] as const) : []),
  ];

  const subtitle =
    tab === "creation"
      ? "Agent deployment workflow"
      : tab === "users"
      ? "Organization members and their agent access"
      : "Your submitted access requests";

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Requests</h1>
          <div className="sub">{subtitle}</div>
        </div>
        <div className="right">
          {tab !== "users" && (
            <button className="btn" onClick={load}>
              <Icon name="refresh" size={14} /> Refresh
            </button>
          )}
        </div>
      </div>

      <div className="card">
        <Tabs active={tab} onChange={(k) => setTab(k as TabKey)} tabs={tabs} />

        {tab === "users" ? (
          <UsersTab />
        ) : (
          <>
            <div className="tb-toolbar">
              <div className="filters">
                <span className="count">{loading ? "Loading…" : `${rows.length} of ${total}`}</span>
              </div>
              <Pagination page={page} totalPages={totalPages} onChange={setPage} />
            </div>

            {error && (
              <div
                style={{
                  margin: "12px 20px",
                  padding: "10px 14px",
                  background: "rgba(220, 38, 38, 0.06)",
                  border: "1px solid rgba(220, 38, 38, 0.18)",
                  borderRadius: 8,
                  color: "var(--threat)",
                  fontSize: 13,
                }}
              >
                {error}
              </div>
            )}

            {noDid ? (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "56px 24px",
                  gap: 20,
                  textAlign: "center",
                }}
              >
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 14,
                    background: "rgba(37,99,235,0.08)",
                    border: "1px solid rgba(37,99,235,0.16)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Icon name="box" size={22} style={{ color: "var(--accent)" }} />
                </div>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "var(--fg)", marginBottom: 6 }}>
                    Deploy your first agent
                  </div>
                  <div style={{ fontSize: 13, color: "var(--fg-muted)", lineHeight: 1.6, maxWidth: 340 }}>
                    Your account is ready. Copy your API key from the Profile page and follow the setup guide to register and deploy your first agent.
                  </div>
                </div>
                <button
                  className="btn primary"
                  onClick={() => navigate("/profile")}
                  style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                >
                  <Icon name="key" size={14} />
                  Get your API key
                </button>
              </div>
            ) : (
              <RequestsLedger />
            )}
          </>
        )}
      </div>

      <AgentRequestModal
        open={createOpen}
        isAdmin={isAdmin}
        onClose={() => setCreateOpen(false)}
        onSuccess={() => {
          setCreateOpen(false);
          load();
        }}
      />
      <AgentRequestModal
        open={!!editTarget}
        editTarget={editTarget}
        isAdmin={isAdmin}
        onClose={() => setEditTarget(null)}
        onSuccess={() => {
          setEditTarget(null);
          load();
        }}
      />
      <DeployAgentModal
        open={deploy.open}
        phase={deploy.phase}
        agentName={deploy.agentName}
        errorMessage={deploy.errorMessage}
        onClose={() => {
          setDeploy({ open: false, phase: "loading" });
          if (deploy.phase === "done") load();
        }}
      />
    </div>
  );
}
