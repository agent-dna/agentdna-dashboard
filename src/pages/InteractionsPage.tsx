import { useState } from "react";
import { Icon } from "../components/Icon";
import { Pagination } from "../components/Pagination";
import { useInteractionsPaged } from "../data/hooks";
import { useDrawer } from "../context/DrawerContext";
import { LedgerTable } from "../components/LedgerTable";

export function InteractionsPage() {
  const [filter, setFilter] = useState<"all" | "threats" | "safe">("all");
  const [page, setPage] = useState(1);
  const { data: paged, loading } = useInteractionsPaged(page);
  const interactions = paged.interactions;
  const { total, totalPages, pageSize } = paged;
  const { openDrawer } = useDrawer();

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
            <Icon name="download" size={14} />
            Export
          </button>
        </div>
      </div>

      <div className="card">
        <div className="tb-toolbar">
          <div className="filters">
            <div className="seg">
              <button className={filter === "all" ? "active" : ""} onClick={() => { setFilter("all"); setPage(1); }}>All</button>
              <button className={filter === "threats" ? "active" : ""} onClick={() => { setFilter("threats"); setPage(1); }}>Threats</button>
              <button className={filter === "safe" ? "active" : ""} onClick={() => { setFilter("safe"); setPage(1); }}>Safe</button>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Pagination page={page} totalPages={totalPages} total={total} pageSize={pageSize || undefined} loading={loading} inline onChange={setPage} />
          </div>
        </div>
        <LedgerTable
          rows={rows}
          emptyText={loading ? "Loading…" : "No interactions yet"}
          onView={(r) => openDrawer("interaction", r)}
        />
      </div>
    </div>
  );
}
