import { useState } from "react";
import { Icon } from "../components/Icon";
import { FilterPill } from "../components/FilterPill";
import { DataTable, type DataTableColumn } from "../components/DataTable";
import { IdCell } from "../components/EntityCell";
import { useInteractions } from "../data/hooks";
import { useDrawer } from "../context/DrawerContext";
import { useResolveName } from "../context/DirectoryContext";
import { timeAgo } from "../lib/format";
import type { Interaction } from "../types";

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
      sortFn: (a, b) => resolve(a.initiator.id).name.localeCompare(resolve(b.initiator.id).name),
      render: (r) => (
        <span style={{ fontSize: 13.5, color: "var(--fg)", fontWeight: 600 }}>
          {resolve(r.initiator.id).name}
        </span>
      ),
    },
    {
      key: "target",
      label: "Interacted with",
      render: (r) => (
        <span style={{ fontSize: 13.5, color: "var(--fg)", fontWeight: 600 }}>
          {resolve(r.target.id).name}
        </span>
      ),
    },
    { key: "intent", label: "Intent", render: (r) => <IdCell id={r.intent.id} truncate /> },
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
  const { data: interactions } = useInteractions();
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
              <button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>
                All
              </button>
              <button className={filter === "threats" ? "active" : ""} onClick={() => setFilter("threats")}>
                Threats
              </button>
              <button className={filter === "safe" ? "active" : ""} onClick={() => setFilter("safe")}>
                Safe
              </button>
            </div>
            <FilterPill label="Type" value="any" />
            <FilterPill label="Time" value="last 7d" />
          </div>
          <span className="count">
            {rows.length} of {interactions.length}
          </span>
        </div>
        <DataTable
          rows={rows.slice(0, 40)}
          columns={cols}
          onRowClick={(r) => openDrawer("interaction", r)}
          emptyText="No interactions yet"
        />
      </div>
    </div>
  );
}
