import { useCallback, useEffect, useState } from "react";
import { Icon } from "../components/Icon";
import { Tabs } from "../components/Tabs";
import { DataTable, type DataTableColumn } from "../components/DataTable";
import { AgentRequestModal } from "../components/forms/AgentRequestModal";
import { UsersTab } from "./requests/UsersTab";
import { useAuth } from "../context/AuthContext";
import { ApiError } from "../api/client";
import {
  listAccessRequestsForOrg,
  listAccessRequestsForUser,
  listAgentCreationRequests,
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
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <button className="btn ghost" disabled={page <= 1} onClick={() => onChange(page - 1)} style={{ padding: "4px 10px" }}>
        Prev
      </button>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--fg-muted)" }}>
        {page} / {totalPages}
      </span>
      <button className="btn ghost" disabled={page >= totalPages} onClick={() => onChange(page + 1)} style={{ padding: "4px 10px" }}>
        Next
      </button>
    </div>
  );
}

export function RequestsPage() {
  const { user } = useAuth();
  const isAdmin = !!user?.is_admin;

  const [tab, setTab] = useState<TabKey>("creation");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<AgentRequest[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<AgentRequest | null>(null);

  const load = useCallback(async () => {
    if (tab === "users") return; // Users tab handles its own fetch
    setLoading(true);
    setError(null);
    try {
      const fetcher =
        tab === "creation"
          ? listAgentCreationRequests
          : tab === "access-org"
          ? listAccessRequestsForOrg
          : listAccessRequestsForUser;
      const res = await fetcher(page);
      setRows(res.requestsList || []);
      setTotal(res.total || 0);
      setTotalPages(res.totalPages || 1);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load requests");
      setRows([]);
      setTotal(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }, [tab, page]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [tab]);

  const handleApprove = async (r: AgentRequest, status: "approved" | "rejected") => {
    try {
      if (r.requestType === "deploy_agent") {
        await submitAgentCreationResult(r.requestID, status);
      } else {
        await submitAccessRequestResult(r.requestID, status);
      }
      load();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Action failed");
    }
  };

  const baseColumns: DataTableColumn<AgentRequest>[] = [
    {
      key: "requestID",
      label: "Request",
      render: (r) => (
        <span className="cell-id">
          <span className="pre">req_</span>
          {r.requestID.slice(0, 12)}
        </span>
      ),
    },
    {
      key: "agentName",
      label: "Agent",
      render: (r) => (
        <div>
          <div style={{ fontSize: 13.5, color: "var(--fg)" }}>{r.agentName || "—"}</div>
          {r.agentDID && (
            <div style={{ fontSize: 11.5, fontFamily: "var(--font-mono)", color: "var(--fg-muted)", marginTop: 2 }}>
              {r.agentDID.slice(0, 24)}…
            </div>
          )}
        </div>
      ),
    },
    {
      key: "creatorDID",
      label: "Creator",
      render: (r) => (
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, color: "var(--fg-dim)" }}>
          {r.creatorDID ? `${r.creatorDID.slice(0, 18)}…` : "—"}
        </span>
      ),
    },
    { key: "status", label: "Status", render: (r) => <StatusChip status={r.status} /> },
    {
      key: "createdAt",
      label: "Created",
      align: "right",
      render: (r) => (
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--fg-muted)" }}>
          {fmtDate(r.createdAt)}
        </span>
      ),
    },
    {
      key: "actions",
      label: "",
      align: "right",
      width: 220,
      render: (r) => {
        const isCreator = r.creatorDID === user?.did;
        const canEdit = tab === "creation" && isCreator && r.status === "pending";
        const canApprove =
          isAdmin && r.status === "pending" && (tab === "creation" || tab === "access-org");
        return (
          <div className="row-actions">
            {canEdit && (
              <button
                className="btn-mini"
                onClick={(e) => {
                  e.stopPropagation();
                  setEditTarget(r);
                }}
              >
                Edit
              </button>
            )}
            {canApprove && (
              <>
                <button
                  className="btn-mini"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleApprove(r, "approved");
                  }}
                >
                  Approve
                </button>
                <button
                  className="btn-mini"
                  style={{ color: "var(--threat)", borderColor: "rgba(220,38,38,0.3)" }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleApprove(r, "rejected");
                  }}
                >
                  Reject
                </button>
              </>
            )}
          </div>
        );
      },
    },
  ];

  const tabs: { key: TabKey; label: string }[] = [
    { key: "creation", label: "Agent Creation" },
    ...(isAdmin ? ([{ key: "access-org", label: "Access (org)" }] as const) : []),
    { key: "access-mine", label: "My Access" },
    ...(isAdmin ? ([{ key: "users", label: "Users" }] as const) : []),
  ];

  const subtitle =
    tab === "creation"
      ? "Agent deployment workflow"
      : tab === "access-org"
      ? "Access requests submitted to your organization"
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
          {tab === "creation" && (
            <button className="btn primary" onClick={() => setCreateOpen(true)}>
              <Icon name="plus" size={14} />
              {isAdmin ? "Create agent" : "Request agent"}
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

            <DataTable
              rows={rows.map((r) => ({ ...r, id: r.requestID }))}
              columns={baseColumns}
              emptyText={loading ? "Loading…" : "No requests"}
            />
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
    </div>
  );
}
