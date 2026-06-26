import { useCallback, useEffect, useState } from "react";
import { Icon } from "../../components/Icon";
import { DataTable, type DataTableColumn } from "../../components/DataTable";
import { AddUserModal } from "../../components/forms/AddUserModal";
import { listUsers, type OrgUser } from "../../api/users";
import { ApiError } from "../../api/client";
import { useAuth } from "../../context/AuthContext";

function UsersPager({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (p: number) => void }) {
  const [input, setInput] = useState(String(page));
  useEffect(() => { setInput(String(page)); }, [page]);
  const commit = () => {
    const n = parseInt(input, 10);
    if (!Number.isNaN(n) && n >= 1 && n <= totalPages) onChange(n);
    else setInput(String(page));
  };
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <button className="btn primary" style={{ padding: "4px 10px", fontSize: 12 }} disabled={page <= 1} onClick={() => onChange(page - 1)}>Prev</button>
      <input type="number" min={1} max={totalPages} value={input} onChange={(e) => setInput(e.target.value)} onBlur={commit} onKeyDown={(e) => { if (e.key === "Enter") commit(); }} style={{ width: 56, padding: "3px 6px", fontSize: 12, fontWeight: 600, fontFamily: "var(--font-mono)", color: "var(--fg)", background: "var(--bg)", border: "2px solid var(--accent)", borderRadius: 6, boxShadow: "0 0 0 3px rgba(37,99,235,0.12)", textAlign: "center", outline: "none" }} />
      <button className="btn primary" style={{ padding: "4px 10px", fontSize: 12 }} disabled={page >= totalPages} onClick={() => onChange(page + 1)}>Next</button>
    </div>
  );
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

export function UsersTab() {
  const { user } = useAuth();
  const isAdmin = !!user?.is_admin;
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<OrgUser[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

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
    { key: "totalIntents", label: "Intents", align: "right",
      render: (r) => <span style={{ fontFamily: "var(--font-mono)" }}>{r.totalIntents}</span> },
    { key: "totalThreats", label: "Threats", align: "right",
      render: (r) => r.totalThreats > 0
        ? <span className="chip threat">{r.totalThreats}</span>
        : <span style={{ color: "var(--fg-faint)", fontFamily: "var(--font-mono)" }}>0</span> },
    { key: "createdAt", label: "Created", align: "right",
      render: (r) => <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--fg-muted)" }}>{fmtDate(r.createdAt)}</span> },
  ];

  return (
    <>
      <div className="tb-toolbar">
        <div className="filters">
          <span className="count">{loading ? "Loading…" : `${rows.length} of ${total}`}</span>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {totalPages > 1 && (
            <UsersPager page={page} totalPages={totalPages} onChange={setPage} />
          )}
          <button className="btn" onClick={load}>
            <Icon name="refresh" size={14} /> Refresh
          </button>
          {isAdmin && (
            <button className="btn primary" onClick={() => setAddOpen(true)}>
              <Icon name="plus" size={14} /> Add user
            </button>
          )}
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
    </>
  );
}
