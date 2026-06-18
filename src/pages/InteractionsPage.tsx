import { useState } from "react";
import { Icon } from "../components/Icon";
import { FilterPill } from "../components/FilterPill";
import { DataTable, type DataTableColumn } from "../components/DataTable";
import { IdCell } from "../components/EntityCell";
import { useInteractionsPaged } from "../data/hooks";
import { useDrawer } from "../context/DrawerContext";
import { useResolveName } from "../context/DirectoryContext";
import { useIntentLabel } from "../context/IntentNumbersContext";
import { timeAgo } from "../lib/format";
import type { Interaction } from "../types";

/** Best display name: directory match → backend-supplied fromName/toName → shortened DID. */
function displayName(
  resolve: ReturnType<typeof useResolveName>,
  did: string,
  apiName: string | undefined,
): string {
  const hit = resolve(did);
  if (hit.kind && hit.name) return hit.name;
  if (apiName && apiName.trim()) return apiName.trim();
  return hit.name || did || "—";
}

export function useInteractionColumns(
  openDrawer: (kind: "interaction", e: Interaction) => void,
): DataTableColumn<Interaction>[] {
  const resolve = useResolveName();
  const intentLabel = useIntentLabel();
  return [
    {
      key: "id",
      label: "Interaction ID",
      sortFn: (a, b) => a.id.localeCompare(b.id),
      render: (r) => <IdCell id={r.id} truncate />,
    },
    {
      key: "initiator",
      label: "Initiator",
      sortFn: (a, b) =>
        displayName(resolve, a.initiator.id, a.initiator.name).localeCompare(
          displayName(resolve, b.initiator.id, b.initiator.name),
        ),
      render: (r) => (
        <span style={{ fontSize: 13.5, color: "var(--fg)", fontWeight: 600 }}>
          {displayName(resolve, r.initiator.id, r.initiator.name)}
        </span>
      ),
    },
    {
      key: "target",
      label: "Interacted with",
      render: (r) => (
        <span style={{ fontSize: 13.5, color: "var(--fg)", fontWeight: 600 }}>
          {displayName(resolve, r.target.id, r.target.name)}
        </span>
      ),
    },
    {
      key: "intent",
      label: "Intent",
      render: (r) => (
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, color: "var(--accent)", fontWeight: 600 }}>
          {intentLabel(r.intent.id)}
        </span>
      ),
    },
    {
      key: "threat",
      label: "Threat",
      sortFn: (a, b) => Number(b.threat) - Number(a.threat),
      render: (r) =>
        r.threat ? (
          <span className="chip threat">
            <span className="dot-status threat" /> true
          </span>
        ) : (
          <span className="chip safe">
            <span className="dot-status safe" /> false
          </span>
        ),
    },
    {
      key: "created",
      label: "Time",
      align: "right",
      sortFn: (a, b) => a.created - b.created,
      render: (r) => (
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, color: "var(--fg-muted)" }}>
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
}

export function InteractionsPage() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "threats" | "safe">("all");
  const [page, setPage] = useState(1);
  const [pageInput, setPageInput] = useState("");
  const { data: paged, loading } = useInteractionsPaged(page);
  const interactions = paged.interactions;
  const { total, totalPages, pageSize } = paged;
  const goToPage = () => {
    const n = parseInt(pageInput, 10);
    if (!Number.isNaN(n) && n >= 1 && n <= totalPages) setPage(n);
    setPageInput("");
  };
  const { openDrawer } = useDrawer();
  const cols = useInteractionColumns((k, e) => openDrawer(k, e));
  const resolve = useResolveName();

  let rows = interactions;
  if (filter === "threats") rows = rows.filter((r) => r.threat);
  if (filter === "safe") rows = rows.filter((r) => !r.threat);
  if (search) {
    const q = search.toLowerCase();
    rows = rows.filter((r) => {
      const initName = resolve(r.initiator.id).name.toLowerCase();
      const tgtName = resolve(r.target.id).name.toLowerCase();
      return (
        r.id.toLowerCase().includes(q) ||
        r.initiator.id.toLowerCase().includes(q) ||
        r.target.id.toLowerCase().includes(q) ||
        initName.includes(q) ||
        tgtName.includes(q)
      );
    });
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Interactions</h1>
          <div className="sub">Every cross-actor exchange, signed and recorded</div>
        </div>
        <div className="right">
          <button className="btn">
            <Icon name="filter" size={14} />
            Filter
          </button>
          <button className="btn">
            <Icon name="download" size={14} />
            Export
          </button>
        </div>
      </div>

      <div className="card">
        <div className="tb-toolbar">
          <div className="filters">
            <div className="search" style={{ width: 280, marginLeft: 0 }}>
              <Icon name="search" className="icon" size={16} />
              <input
                placeholder="Search by ID, initiator, target…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="seg">
              <button className={filter === "all" ? "active" : ""} onClick={() => { setFilter("all"); setPage(1); }}>
                All
              </button>
              <button className={filter === "threats" ? "active" : ""} onClick={() => { setFilter("threats"); setPage(1); }}>
                Threats
              </button>
              <button className={filter === "safe" ? "active" : ""} onClick={() => { setFilter("safe"); setPage(1); }}>
                Safe
              </button>
            </div>
            <FilterPill label="Type" value="any" />
            <FilterPill label="Time" value="last 7d" />
          </div>
          <span className="count">
            {total > 0 ? `${rows.length} on this page · ${total} total` : `${rows.length}`}
          </span>
        </div>
        <DataTable
          rows={rows}
          columns={cols}
          onRowClick={(r) => openDrawer("interaction", r)}
          emptyText={loading ? "Loading…" : "No interactions yet"}
        />
        {totalPages > 1 && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              gap: 8,
              padding: "10px 16px",
              borderTop: "1px solid var(--line)",
            }}
          >
            {pageSize > 0 && (
              <span style={{ fontSize: 12, color: "var(--fg-muted)", fontFamily: "var(--font-mono)" }}>
                {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}
              </span>
            )}
            <span style={{ fontSize: 12, color: "var(--fg-muted)", fontFamily: "var(--font-mono)", marginRight: 4 }}>
              Page {page} of {totalPages}
            </span>
            <button
              className="btn primary"
              style={{ padding: "4px 10px" }}
              disabled={page <= 1 || loading}
              onClick={() => setPage(page - 1)}
            >
              Prev
            </button>
            <input
              type="number"
              min={1}
              max={totalPages}
              value={pageInput}
              disabled={loading}
              placeholder={String(page)}
              title="Type a page number and press Enter"
              onChange={(e) => setPageInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") goToPage();
              }}
              style={{
                width: 56,
                padding: "5px 8px",
                fontSize: 12,
                fontWeight: 600,
                fontFamily: "var(--font-mono)",
                color: "var(--fg)",
                background: "var(--bg)",
                border: "2px solid var(--accent)",
                borderRadius: 6,
                boxShadow: "0 0 0 3px rgba(37, 99, 235, 0.12)",
                textAlign: "center",
                outline: "none",
              }}
            />
            <button
              className="btn primary"
              style={{ padding: "4px 10px" }}
              disabled={page >= totalPages || loading}
              onClick={() => setPage(page + 1)}
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
