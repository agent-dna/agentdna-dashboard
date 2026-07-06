import { useState } from "react";
import { Icon } from "../components/Icon";
import { Pagination } from "../components/Pagination";
import { DataTable, type DataTableColumn } from "../components/DataTable";
import { IdCell } from "../components/EntityCell";
import { useInteractionsPaged } from "../data/hooks";
import { useDrawer } from "../context/DrawerContext";
import { useResolveName } from "../context/DirectoryContext";
import { IntentIdChip } from "../context/IntentNumbersContext";
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
        <IntentIdChip id={r.intent.id} style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, color: "var(--accent)", fontWeight: 600 }} />
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
  const [filter, setFilter] = useState<"all" | "threats" | "safe">("all");
  const [page, setPage] = useState(1);
  const { data: paged, loading } = useInteractionsPaged(page);
  const interactions = paged.interactions;
  const { total, totalPages, pageSize } = paged;
  const { openDrawer } = useDrawer();
  const cols = useInteractionColumns((k, e) => openDrawer(k, e));
  const resolve = useResolveName();

  let rows = interactions;
  if (filter === "threats") rows = rows.filter((r) => r.threat);
  if (filter === "safe") rows = rows.filter((r) => !r.threat);

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
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span className="count">
              {total > 0 ? `${rows.length} on this page · ${total} total` : `${rows.length}`}
            </span>
            <Pagination page={page} totalPages={totalPages} total={total} pageSize={pageSize || undefined} loading={loading} inline onChange={setPage} />
          </div>
        </div>
        <DataTable
          rows={rows}
          columns={cols}
          onRowClick={(r) => openDrawer("interaction", r)}
          emptyText={loading ? "Loading…" : "No interactions yet"}
        />
      </div>
    </div>
  );
}
