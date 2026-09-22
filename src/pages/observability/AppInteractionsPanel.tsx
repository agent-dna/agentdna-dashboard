import { useEffect, useRef, useState } from "react";
import { Icon } from "../../components/Icon";
import { initials } from "../../lib/format";
import type { ObsGraph, ObsIntentStatus } from "./mockData";

function ago(minutes: number): string {
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const h = Math.floor(minutes / 60);
  return h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`;
}

/**
 * Focus panel for one app: a scrollable vertical timeline of its interactions (newest first,
 * numbered oldest = #1). Nothing is selected at first; clicking an interaction opens its details
 * beside the timeline.
 */
export function AppInteractionsPanel({
  g,
  appId,
  statusColors,
  onOpenTrace,
}: {
  g: ObsGraph;
  appId: string;
  statusColors: Record<ObsIntentStatus, string>;
  onOpenTrace: (intentId: string) => void;
}) {
  const app = g.appById.get(appId);
  const all = g.appInteractionsByApp.get(appId) ?? [];
  const [onlyBlocked, setOnlyBlocked] = useState(false);
  const [selId, setSelId] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const blockedCount = all.filter((ax) => ax.status === "blocked").length;
  const agentCount = new Set(all.map((ax) => ax.agentId)).size;
  const list = onlyBlocked ? all.filter((ax) => ax.status === "blocked") : all;
  const sel = list.find((ax) => ax.id === selId) ?? null;

  useEffect(() => {
    if (!sel) return;
    listRef.current
      ?.querySelector<HTMLElement>(`[data-ax="${sel.id}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [sel]);

  // Esc peels back one layer at a time: trace overlay (window capture) → these details (document capture)
  // → the canvas's back-to-all-apps (window bubble). Each checks/sets defaultPrevented so only one fires.
  useEffect(() => {
    if (!sel) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      e.preventDefault();
      setSelId(null);
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [sel]);

  if (!app) return null;

  const onListKey = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const i = list.findIndex((ax) => ax.id === sel?.id);
    const next = i < 0 ? list[0] : list[Math.max(0, Math.min(list.length - 1, i + (e.key === "ArrowDown" ? 1 : -1)))];
    if (next) setSelId(next.id);
  };

  const intent = sel ? g.intentById.get(sel.intentId) : undefined;
  const agent = sel ? g.agentById.get(sel.agentId) : undefined;
  const user = intent ? g.userById.get(intent.userId) : undefined;
  const seq = sel ? all.length - all.indexOf(sel) : 0;

  return (
    <div className={`obs-app-panel ${sel ? "has-detail" : ""}`}>
      <div className="obs-ap-listcol">
        <header className="obs-ap-head">
          <span className="obs-ap-tile">{initials(app.name)}</span>
          <div className="obs-ap-title">
            <div className="nm">{app.name}</div>
            <div className="sub">
              {all.length} interactions · {agentCount} agents
              {blockedCount > 0 && <span className="blk"> · {blockedCount} blocked</span>}
            </div>
          </div>
        </header>

        <div className="obs-ap-seg" role="group" aria-label="Filter interactions">
          <button type="button" className={!onlyBlocked ? "active" : ""} onClick={() => setOnlyBlocked(false)}>
            All <span className="n">{all.length}</span>
          </button>
          <button
            type="button"
            className={`blk ${onlyBlocked ? "active" : ""}`}
            onClick={() => setOnlyBlocked(true)}
            disabled={blockedCount === 0}
          >
            Blocked <span className="n">{blockedCount}</span>
          </button>
        </div>

        <div className="obs-ap-list" ref={listRef} role="listbox" tabIndex={0} onKeyDown={onListKey} aria-label={`${app.name} interactions`}>
          {list.length === 0 && <div className="obs-ap-empty">No interactions.</div>}
          {list.map((ax) => {
            const n = all.length - all.indexOf(ax);
            const blocked = ax.status === "blocked";
            const isSel = ax.id === sel?.id;
            return (
              <button
                key={ax.id}
                type="button"
                role="option"
                aria-selected={isSel}
                data-ax={ax.id}
                className={`obs-ax-tab ${isSel ? "sel" : ""} ${blocked ? "blk" : ""}`}
                onClick={() => setSelId(isSel ? null : ax.id)}
              >
                <span className="node" />
                <span className="num">#{n}</span>
                <span className="main">
                  <span className="act">{ax.action}</span>
                  <span className="who">{g.agentById.get(ax.agentId)?.name} · {ago(ax.minutesAgo)}</span>
                </span>
              </button>
            );
          })}
        </div>
        {!sel && list.length > 0 && <div className="obs-ap-hint">Click an interaction to see its details</div>}
      </div>

      {sel && (
        <div className="obs-ap-detail">
          <div className="obs-ap-d-top">
            <span className={`obs-ap-status ${sel.status}`}>
              <span className="d" />{sel.status === "blocked" ? "BLOCKED" : "ALLOWED"}
            </span>
            <span className="obs-ap-seq">#{seq} · {ago(sel.minutesAgo)}</span>
            <button type="button" className="obs-help-close" onClick={() => setSelId(null)} aria-label="Close details">
              <Icon name="close" size={12} />
            </button>
          </div>
          <div className="obs-ap-action">{sel.action}</div>
          <p className="obs-ap-detail-text">{sel.detail}</p>

          <dl className="obs-ap-fields">
            <dt>Agent</dt>
            <dd>{agent?.name ?? sel.agentId}</dd>
            <dt>App</dt>
            <dd>{app.name} <span className="dim">· {app.category}</span></dd>
            <dt>Intent</dt>
            <dd>
              {intent?.name ?? sel.intentId}
              {intent && (
                <span className="obs-ap-intent-status" style={{ color: statusColors[intent.status] }}>
                  {intent.status.replace("-", " ")}
                </span>
              )}
            </dd>
            {user && (
              <>
                <dt>Initiated by</dt>
                <dd>{user.name}</dd>
              </>
            )}
            <dt>Latency</dt>
            <dd className="mono">{sel.latencyMs}ms</dd>
            <dt>ID</dt>
            <dd className="mono dim">{sel.id} · {sel.intentId}</dd>
          </dl>

          <button type="button" className="obs-trace-btn obs-ap-trace" onClick={() => onOpenTrace(sel.intentId)}>
            <Icon name="flow" size={12} />
            View intent trace
          </button>
        </div>
      )}
    </div>
  );
}
