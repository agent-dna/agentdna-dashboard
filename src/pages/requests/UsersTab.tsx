import { useCallback, useEffect, useState } from "react";
import { Icon } from "../../components/Icon";
import { DataTable, type DataTableColumn } from "../../components/DataTable";
import { AddUserModal } from "../../components/forms/AddUserModal";
import { UserAccessDrawer } from "../../components/forms/UserAccessDrawer";
import { listUsers, type OrgUser } from "../../api/users";
import { ApiError } from "../../api/client";

function fmtDate(s: string) {
  try {
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return s;
    return d.toLocaleString();
  } catch {
    return s;
  }
}

export function UsersTab() {
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<OrgUser[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [drawerUser, setDrawerUser] = useState<OrgUser | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await listUsers(page);
      setRows(res.usersList || []);
      setTotal(res.total || 0);
      setTotalPages(res.totalPages || 1);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Failed to load users");
      setRows([]);
      setTotal(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { load(); }, [load]);

  const cols: DataTableColumn<OrgUser & { id: string }>[] = [
    { key: "userName", label: "Email", render: (r) => <span style={{ color: "var(--fg)", fontWeight: 600 }}>{r.userName}</span> },
    {
      key: "userID",
      label: "User ID",
      render: (r) => (
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, color: "var(--fg-dim)" }}>
          {r.userID.length > 26 ? `${r.userID.slice(0, 16)}…${r.userID.slice(-6)}` : r.userID}
        </span>
      ),
    },
    { key: "accessAgentCount", label: "Agents", align: "right",
      render: (r) => <span style={{ fontFamily: "var(--font-mono)" }}>{r.accessAgentCount}</span> },
    { key: "totalIntents", label: "Intents", align: "right",
      render: (r) => <span style={{ fontFamily: "var(--font-mono)" }}>{r.totalIntents}</span> },
    { key: "totalThreats", label: "Threats", align: "right",
      render: (r) => r.totalThreats > 0
        ? <span className="chip threat">{r.totalThreats}</span>
        : <span style={{ color: "var(--fg-faint)", fontFamily: "var(--font-mono)" }}>0</span> },
    { key: "createdAt", label: "Created", align: "right",
      render: (r) => <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--fg-muted)" }}>{fmtDate(r.createdAt)}</span> },
    {
      key: "actions",
      label: "",
      align: "right",
      width: 100,
      render: (r) => (
        <div className="row-actions">
          <button
            className="btn-mini"
            onClick={(e) => {
              e.stopPropagation();
              setDrawerUser(r);
            }}
          >
            Manage
          </button>
        </div>
      ),
    },
  ];

  return (
    <>
      <div className="tb-toolbar">
        <div className="filters">
          <span className="count">{loading ? "Loading…" : `${rows.length} of ${total}`}</span>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {totalPages > 1 && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button className="btn ghost" disabled={page <= 1} onClick={() => setPage(page - 1)} style={{ padding: "4px 10px" }}>Prev</button>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--fg-muted)" }}>{page} / {totalPages}</span>
              <button className="btn ghost" disabled={page >= totalPages} onClick={() => setPage(page + 1)} style={{ padding: "4px 10px" }}>Next</button>
            </div>
          )}
          <button className="btn" onClick={load}>
            <Icon name="refresh" size={14} /> Refresh
          </button>
          <button className="btn primary" onClick={() => setAddOpen(true)}>
            <Icon name="plus" size={14} /> Add user
          </button>
        </div>
      </div>

      {err && (
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
          {err}
        </div>
      )}

      <DataTable
        rows={rows.map((r) => ({ ...r, id: r.userID }))}
        columns={cols}
        onRowClick={(r) => setDrawerUser(r)}
        emptyText={loading ? "Loading…" : "No users in this org yet"}
      />

      <AddUserModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSuccess={() => {
          setAddOpen(false);
          load();
        }}
      />
      <UserAccessDrawer
        user={drawerUser}
        onClose={() => setDrawerUser(null)}
        onChanged={load}
      />
    </>
  );
}
