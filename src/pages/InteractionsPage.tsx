import { useState } from "react";
import { Icon } from "../components/Icon";
import { FilterPill } from "../components/FilterPill";
import { DataTable, type DataTableColumn } from "../components/DataTable";
import { EntityCell, IdCell } from "../components/EntityCell";
import { useInteractions } from "../data/hooks";
import { useDrawer } from "../context/DrawerContext";
import { fmtRuntime, timeAgo } from "../lib/format";
import type { Interaction } from "../types";

export function interactionColumns(openDrawer: (kind: "interaction", e: Interaction) => void): DataTableColumn<Interaction>[] {
  return [
    {
      key: "id",
      label: "Interaction ID",
      sortFn: (a, b) => a.id.localeCompare(b.id),
      render: (r) => <IdCell id={r.id} />,
    },
    {
      key: "initiator",
      label: "Initiator",
      sortFn: (a, b) => a.initiator.name.localeCompare(b.initiator.name),
      render: (r) => (
        <EntityCell name={r.initiator.name} sub={r.initiator.id} paletteIx={r.initiator.name.charCodeAt(0)} />
      ),
    },
    {
      key: "target",
      label: "Interacted with",
      render: (r) => (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            className={`chip ${r.targetType === "agent" ? "info" : "purple"}`}
            style={{ fontSize: 10.5, padding: "2px 7px" }}
          >
            {r.targetType}
          </span>
          <span style={{ fontSize: 13 }}>{r.target.name}</span>
        </div>
      ),
    },
    { key: "intent", label: "Intent", render: (r) => <IdCell id={r.intent.id} /> },
    {
      key: "runtime",
      label: "Runtime",
      align: "right",
      sortFn: (a, b) => a.runtime - b.runtime,
      render: (r) => <span style={{ fontFamily: "var(--font-mono)", fontSize: 12.5 }}>{fmtRuntime(r.runtime)}</span>,
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
      label: "Created at",
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

  let rows = interactions;
  if (filter === "threats") rows = rows.filter((r) => r.threat);
  if (filter === "safe") rows = rows.filter((r) => !r.threat);
  if (search) {
    const q = search.toLowerCase();
    rows = rows.filter(
      (r) =>
        r.id.toLowerCase().includes(q) ||
        r.initiator.name.toLowerCase().includes(q) ||
        r.target.name.toLowerCase().includes(q),
    );
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
          columns={interactionColumns((k, e) => openDrawer(k, e))}
          onRowClick={(r) => openDrawer("interaction", r)}
          emptyText="No interactions yet"
        />
      </div>
    </div>
  );
}
