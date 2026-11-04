import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "../../components/Icon";
import { DataTable, type DataTableColumn } from "../../components/DataTable";
import { Pagination } from "../../components/Pagination";
import { listUsers, type OrgUser, type PagedUsers } from "../../api/users";
import { ApiError } from "../../api/client";
import { useAuth } from "../../context/AuthContext";

/** Rows per page when the server hands back the whole list and we page it here. */
const PAGE_SIZE = 10;

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
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [res, setRes] = useState<PagedUsers | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  // /users-list pages on the server when it can; when it sends the whole list at once we page it
  // here instead, and then page changes don't need another fetch.
  const list = res?.usersList ?? [];
  const total = res?.total || list.length;
  const clientPaged = list.length > PAGE_SIZE && list.length >= total;
  const fetchPage = clientPaged ? 1 : page;
  const pageSize = clientPaged ? PAGE_SIZE : res?.pageSize || list.length || PAGE_SIZE;
  const totalPages = clientPaged
    ? Math.ceil(list.length / PAGE_SIZE)
    : res?.totalPages || Math.max(1, Math.ceil(total / pageSize));
  const rows = clientPaged ? list.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE) : list;

  useEffect(() => {
    let live = true;
    setLoading(true);
    setErr(null);
    listUsers(fetchPage)
      .then((r) => live && setRes(r))
      .catch((e) => {
        if (!live) return;
        setErr(e instanceof ApiError ? e.message : "Failed to load users");
        setRes(null);
      })
      .finally(() => live && setLoading(false));
    return () => { live = false; };
  }, [fetchPage, reload]);

  // A shrinking list (or a refresh) can leave us past the last page.
  useEffect(() => {
    if (res && page > totalPages) setPage(totalPages);
  }, [res, page, totalPages]);

  const cols: DataTableColumn<OrgUser & { id: string }>[] = [
    { key: "userName", label: "Name", render: (r) => <span style={{ color: "var(--fg)", fontWeight: 600 }}>{r.userName}</span> },
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
    { key: "totalThreats", label: "Incidents", align: "right",
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
          <span className="count">{loading && !res ? "Loading…" : `${total.toLocaleString()} user${total === 1 ? "" : "s"}`}</span>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <Pagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} loading={loading} inline onChange={setPage} />
          {/* Admins get neither Refresh nor Add user here. */}
          {!isAdmin && (
            <button className="btn" onClick={() => setReload((n) => n + 1)}>
              <Icon name="refresh" size={14} /> Refresh
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
        onRowClick={(r) => navigate(`/users/${encodeURIComponent(r.userID)}`)}
        emptyText={loading ? "Loading…" : "No users in this org yet"}
      />
    </>
  );
}
