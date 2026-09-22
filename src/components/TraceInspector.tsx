import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { FlowTrace, TraceSpan } from "../pages/flow/flowData";
import { interactionRawData } from "../lib/format";
import type { Interaction } from "../types";
import { Icon, type IconName } from "./Icon";

const KIND_COLOR: Record<string, string> = {
  chain: "#7C3AED",
  human: "#0A2240",
  agent: "#2563EB",
  tool:  "#0284C7",
  llm:   "#EC4899",
};

const KIND_ICON: Record<string, IconName> = {
  chain: "flow",
  human: "user",
  agent: "agents",
  tool:  "apps",
  llm:   "zap",
};

function spanKind(s: TraceSpan): string {
  if (s.kind === "agent" && s.label === "LLM") return "llm";
  return s.kind;
}

function tryParse(s: string): unknown {
  try { return JSON.parse(s); } catch { return s; }
}

/** `0x1a2b3c4d5e6f7c9d` → `0x1a2b…7c9d` */
function truncateMiddle(value: string, max: number): string {
  if (!value || value.length <= max) return value;
  const head = Math.ceil((max - 1) * 0.6);
  const tail = max - 1 - head;
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}

function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = (key: string, text: string) => {
    try { navigator.clipboard.writeText(text); } catch { /* clipboard unavailable */ }
    setCopied(key);
    setTimeout(() => setCopied((c) => (c === key ? null : c)), 1500);
  };
  return { copied, copy };
}


// ─── Collapsible JSON tree (light theme) ──────────────────────────────────────

const INDENT = 16;
const ROW = { lineHeight: "22px" } as const;

/**
 * One colour per nesting level, cycling. A parent's key, braces, count pill and guide line all share
 * its level colour, so each block reads as a unit when several are open.
 */
const LEVELS = ["#2563EB", "#7C3AED", "#0D9488", "#C2410C", "#DB2777"];
const levelColor = (depth: number) => LEVELS[depth % LEVELS.length];
/** `#RRGGBB` + alpha 0..1 → `#RRGGBBAA` */
const alpha = (hex: string, a: number) => hex + Math.round(a * 255).toString(16).padStart(2, "0");
/** Payloads run to several KB; show a head and let the reader opt into the rest. */
const STRING_PREVIEW = 220;

const C = {
  string: "#0F172A",
  number: "#047857",
  bool: "#C2410C",
  null: "#94A3B8",
};

function JsonChildren({ children, closing, color }: { children: React.ReactNode; closing: string; color: string }) {
  return (
    <div style={{
      paddingLeft: INDENT,
      marginLeft: 5,
      borderLeft: `2px solid ${alpha(color, 0.45)}`,
    }}>
      {children}
      <div style={{ ...ROW, color, fontWeight: 700, marginLeft: -INDENT + 4 }}>{closing}</div>
    </div>
  );
}

function Twisty({ open, hidden, color }: { open: boolean; hidden: boolean; color: string }) {
  return (
    <span style={{
      display: "inline-grid",
      placeItems: "center",
      width: 12,
      flexShrink: 0,
      color,
      opacity: hidden ? 0 : 1,
      transform: open ? "rotate(0deg)" : "rotate(-90deg)",
      transition: "transform .12s",
    }}>
      <Icon name="chevronDown" size={11} />
    </span>
  );
}

/** String leaf with an expand affordance for long values. */
function JsonString({ labelEl, value }: { labelEl: React.ReactNode; value: string }) {
  const [expanded, setExpanded] = useState(false);
  const long = value.length > STRING_PREVIEW;
  const shown = long && !expanded ? value.slice(0, STRING_PREVIEW) : value;
  return (
    <div className="agd-json-row" style={{ ...ROW, wordBreak: "break-word", paddingLeft: 16 }}>
      {labelEl}
      <span style={{ color: C.string }}>&quot;{shown}{long && !expanded ? "…" : ""}&quot;</span>
      {long && (
        <button type="button" className="ti-more" onClick={() => setExpanded((e) => !e)}>
          {expanded ? "collapse" : `expand (${(value.length - STRING_PREVIEW).toLocaleString()} more characters)`}
        </button>
      )}
    </div>
  );
}

function JsonNode({ label, value, depth = 0, defaultOpen = true }: {
  label?: string;
  value: unknown;
  depth?: number;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const color = levelColor(depth);
  const isBranch = value !== null && typeof value === "object";

  // Branch keys are bold so parent blocks stand out from the leaf fields around them.
  const labelEl = label !== undefined ? (
    <span style={{ color, fontWeight: isBranch ? 700 : 500, marginRight: 6 }}>{label}:</span>
  ) : null;

  const leaf = (color: string, text: React.ReactNode) => (
    <div className="agd-json-row" style={{ ...ROW, paddingLeft: 16 }}>
      {labelEl}<span style={{ color }}>{text}</span>
    </div>
  );

  if (value === null) return leaf(C.null, "null");
  if (typeof value === "boolean") return leaf(C.bool, String(value));
  if (typeof value === "number") return leaf(C.number, value);
  if (typeof value === "string") return <JsonString labelEl={labelEl} value={value} />;

  const isArray = Array.isArray(value);

  if (isArray || typeof value === "object") {
    const items: Array<[string | undefined, unknown]> = isArray
      ? (value as unknown[]).map((v, i) => [String(i), v])
      : Object.entries(value as Record<string, unknown>)
          .filter(([, v]) => {
            if (v === null || v === undefined) return false;
            if (typeof v === "string" && v.trim() === "") return false;
            if (Array.isArray(v) && v.length === 0) return false;
            if (typeof v === "object" && !Array.isArray(v) && Object.keys(v as object).length === 0) return false;
            return true;
          })
          .map(([k, v]) => [k, v]);

    const empty = items.length === 0;
    const openBrace = isArray ? "[" : "{";
    const closeBrace = isArray ? "]" : "}";
    const countLabel = `${items.length} item${items.length === 1 ? "" : "s"}`;

    return (
      <div>
        <div
          className="agd-json-row"
          style={{ ...ROW, cursor: empty ? "default" : "pointer", userSelect: "none", display: "flex", alignItems: "center", gap: 4 }}
          onClick={() => !empty && setOpen((o) => !o)}
        >
          <Twisty open={open} hidden={empty} color={color} />
          {labelEl}
          <span style={{ color, fontWeight: 700 }}>{openBrace}</span>
          {/* Item count stays visible in both states so the document's shape reads without expanding. */}
          {!empty && (
            <span style={{
              color,
              background: alpha(color, 0.1),
              border: `1px solid ${alpha(color, 0.22)}`,
              borderRadius: 999,
              padding: "0 7px",
              fontSize: "0.82em",
              fontWeight: 600,
              lineHeight: "16px",
              margin: "0 4px",
            }}>
              {countLabel}
            </span>
          )}
          {(!open || empty) && <span style={{ color, fontWeight: 700 }}>{closeBrace}</span>}
        </div>
        {open && !empty && (
          <JsonChildren closing={closeBrace} color={color}>
            {items.map(([k, v], i) => (
              <JsonNode
                key={k ?? i}
                label={k}
                value={v}
                depth={depth + 1}
                // Two levels open by default: enough to see the payload's shape, not so much it floods the panel.
                defaultOpen={depth < 1}
              />
            ))}
          </JsonChildren>
        )}
      </div>
    );
  }

  return null;
}

/** Input/Output body: a tree for structured payloads, prose for plain text, or raw JSON on request. */
function Payload({ raw, mode }: { raw: string; mode: "formatted" | "json" }) {
  const value = tryParse(raw);
  if (mode === "json") return <pre className="ti-pre json">{JSON.stringify(value, null, 2)}</pre>;
  if (typeof value === "string") return <pre className="ti-pre">{value}</pre>;
  return <div className="ti-json"><JsonNode value={value} /></div>;
}


// ─── Span tree ────────────────────────────────────────────────────────────────

type GuideCell = "v" | "blank" | "tee" | "elbow";

interface TreeRow {
  span: TraceSpan;
  guides: GuideCell[];
}

/** Every span in pre-order — the order J/K and "Interaction n of N" use. */
function preorder(root: TraceSpan): TraceSpan[] {
  const out: TraceSpan[] = [];
  const walk = (s: TraceSpan) => { out.push(s); s.children.forEach(walk); };
  walk(root);
  return out;
}

type Filter = "all" | "human" | "agent" | "tool" | "blocked";

const FILTERS: { id: Filter; label: string; test: (s: TraceSpan) => boolean }[] = [
  { id: "all", label: "All", test: () => true },
  { id: "human", label: "Users", test: (s) => s.kind === "human" },
  { id: "agent", label: "Agents", test: (s) => s.kind === "agent" },
  { id: "tool", label: "Tools", test: (s) => s.kind === "tool" },
  { id: "blocked", label: "Blocked", test: (s) => s.status === "blocked" },
];

/** Descendant count per span — shown on collapsed rows so hidden depth isn't invisible. */
function descendantCounts(root: TraceSpan): Map<string, number> {
  const out = new Map<string, number>();
  const walk = (s: TraceSpan): number => {
    const n = s.children.reduce((sum, c) => sum + 1 + walk(c), 0);
    out.set(s.id, n);
    return n;
  };
  walk(root);
  return out;
}

/** Ids matching the search text and filter, plus every ancestor of a match so the hierarchy around it stays visible. */
function searchVisible(root: TraceSpan, q: string, filter: Filter): Set<string> | null {
  const needle = q.trim().toLowerCase();
  if (!needle && filter === "all") return null;
  const test = FILTERS.find((f) => f.id === filter)!.test;
  const keep = new Set<string>();
  const walk = (s: TraceSpan): boolean => {
    const self = test(s) && (!needle || `${s.name} ${s.label} ${s.id}`.toLowerCase().includes(needle));
    let child = false;
    for (const c of s.children) if (walk(c)) child = true;
    if (self || child) keep.add(s.id);
    return self || child;
  };
  walk(root);
  return keep;
}

/** Flattens the visible tree into rows, each carrying the guide cells that draw its connector lines. */
function visibleRows(root: TraceSpan, collapsed: Set<string>, keep: Set<string> | null): TreeRow[] {
  const rows: TreeRow[] = [];
  const walk = (s: TraceSpan, trail: boolean[], isLast: boolean, depth: number) => {
    const guides: GuideCell[] = depth === 0 ? [] : [
      ...trail.slice(1).map<GuideCell>((hasNext) => (hasNext ? "v" : "blank")),
      isLast ? "elbow" : "tee",
    ];
    rows.push({ span: s, guides });
    // While searching, everything on a matching path is shown regardless of collapse state.
    if (!keep && collapsed.has(s.id)) return;
    const kids = keep ? s.children.filter((c) => keep.has(c.id)) : s.children;
    kids.forEach((c, i) => walk(c, [...trail, !isLast], i === kids.length - 1, depth + 1));
  };
  if (!keep || keep.has(root.id)) walk(root, [], true, 0);
  return rows;
}


// ─── Main component ───────────────────────────────────────────────────────────

interface TraceInspectorProps {
  trace: FlowTrace;
  openSpanId?: string;
  onClose: () => void;
  rawData?: unknown;
  /** Span id → the real Interaction it came from, when one exists — lets the
   * "Raw data" tab show exactly what the interaction drawer shows instead
   * of a generic trace/block blob. */
  interactionBySpanId?: Record<string, Interaction>;
  /** What each row is called in the UI ("span", "interaction", …). */
  noun?: { one: string; many: string };
}

type Tab = "preview" | "metadata" | "raw";

export function TraceInspector({
  trace,
  openSpanId,
  onClose,
  rawData,
  interactionBySpanId,
  noun = { one: "span", many: "spans" },
}: TraceInspectorProps) {
  const One = noun.one[0].toUpperCase() + noun.one.slice(1);
  const [selId, setSelId] = useState(openSpanId || trace.trace.id);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [tab, setTab] = useState<Tab>("preview");
  const [mode, setMode] = useState<"formatted" | "json">("formatted");
  const { copied, copy } = useCopy();
  const listRef = useRef<HTMLDivElement>(null);

  // Follow the caller when it points at a different span. A selection that no longer exists
  // after a data refresh falls back to the root via `sel` below, so the trace itself needn't reset it.
  const [prevOpenId, setPrevOpenId] = useState(openSpanId);
  if (openSpanId !== prevOpenId) {
    setPrevOpenId(openSpanId);
    if (openSpanId) setSelId(openSpanId);
  }

  const all = useMemo(() => preorder(trace.trace), [trace]);
  const keep = useMemo(() => searchVisible(trace.trace, query, filter), [trace, query, filter]);
  const rows = useMemo(() => visibleRows(trace.trace, collapsed, keep), [trace, collapsed, keep]);
  const descendants = useMemo(() => descendantCounts(trace.trace), [trace]);
  const filterCounts = useMemo(
    () => Object.fromEntries(FILTERS.map((f) => [f.id, all.filter(f.test).length])) as Record<Filter, number>,
    [all],
  );
  const blockedCount = filterCounts.blocked;

  const sel = trace.spanById[selId] || trace.trace;

  // Ancestors of the selection, so the route from the root down to it can be traced in the tree.
  const pathIds = new Set<string>();
  for (let p = sel.parentId; p; p = trace.spanById[p]?.parentId ?? null) pathIds.add(p);
  const selIndex = all.findIndex((s) => s.id === sel.id);
  const sKind = spanKind(sel);
  const sColor = KIND_COLOR[sKind] || "#5F73A0";

  // Step through what's on screen, so J/K never lands on a collapsed or filtered-out span.
  const move = (delta: number) => {
    const i = rows.findIndex((r) => r.span.id === sel.id);
    const next = rows[Math.max(0, Math.min(rows.length - 1, (i < 0 ? 0 : i) + delta))];
    if (next) setSelId(next.span.id);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { onClose(); return; }
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName))) return;
      if (e.key === "j" || e.key === "ArrowDown") { e.preventDefault(); move(1); }
      if (e.key === "k" || e.key === "ArrowUp") { e.preventDefault(); move(-1); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-span="${CSS.escape(sel.id)}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [sel.id]);

  const toggle = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  const expandAll = () => setCollapsed(new Set());
  const collapseAll = () => setCollapsed(new Set(all.filter((s) => s !== trace.trace && s.children.length > 0).map((s) => s.id)));

  // The selected span's own interaction, when it has one — same JSON shape
  // as the interaction drawer's Raw data panel. Falls back to the generic
  // trace/block payload for synthetic spans (root, provenance seal, …).
  const matchedInteraction = interactionBySpanId?.[selId];
  const rawValue = matchedInteraction ? interactionRawData(matchedInteraction) : (rawData ?? trace.trace);

  const chips: { label: string; value: string; dark?: boolean; copyable?: boolean }[] = [
    { label: "Type", value: sel.label },
    { label: One, value: sel.id, copyable: true },
    { label: "Session", value: trace.sessionId, dark: true, copyable: true },
    { label: "User", value: trace.userId, dark: true },
    { label: "Env", value: trace.env },
  ];
  if (sel.model) chips.push({ label: "Model", value: sel.model });
  if (typeof sel.metadata.blockIndex === "number") chips.push({ label: "Block", value: `#${sel.metadata.blockIndex}` });
  if (sel.signature) chips.push({ label: "Signature", value: sel.signature, dark: true, copyable: true });

  return createPortal(
    <div className="ti-overlay" onMouseDown={onClose}>
      <div className="ti-modal" role="dialog" aria-label="Envelope inspector" onMouseDown={(e) => e.stopPropagation()}>

        {/* ── TOP BAR ── */}
        <div className="ti-top">
          <span className="ti-top-chip"><Icon name="flow" size={14} />Envelope</span>
          <div className="ti-top-title">
            {/* The root is the container, not an item, so it's left out of the count. */}
            <span className="nm">{sel === trace.trace ? "Overview" : `${One} ${selIndex} of ${all.length - 1}`}</span>
            <span className="id">{trace.traceId}</span>
          </div>
          <div className="ti-top-actions">
            <button
              type="button"
              className="ti-icon-btn"
              title={copied === "raw" ? "Copied" : "Copy raw data"}
              onClick={() => copy("raw", JSON.stringify(rawValue, null, 2))}
            >
              <Icon name={copied === "raw" ? "check" : "copy"} size={15} />
            </button>
            <button type="button" className="ti-nav-btn" title={`Previous ${noun.one} (K)`} onClick={() => move(-1)}>
              <span className="arrow">↑</span><kbd>K</kbd>
            </button>
            <button type="button" className="ti-nav-btn" title={`Next ${noun.one} (J)`} onClick={() => move(1)}>
              <span className="arrow">↓</span><kbd>J</kbd>
            </button>
            <button type="button" className="ti-icon-btn" title="Close (Esc)" onClick={onClose}>
              <Icon name="close" size={15} />
            </button>
          </div>
        </div>

        <div className="ti-body">

          {/* ── LEFT: hierarchy ── */}
          <aside className="ti-tree">
            <div className="ti-tree-tools">
              <label className="ti-search">
                <Icon name="search" size={14} />
                <input
                  placeholder={`Search ${noun.many}`}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                {query && (
                  <button type="button" className="ti-search-clear" onClick={() => setQuery("")} aria-label="Clear search">
                    <Icon name="close" size={11} />
                  </button>
                )}
              </label>
              <button type="button" className="ti-icon-btn sm" title="Expand all" onClick={expandAll} disabled={!!keep}>
                <Icon name="chevronDown" size={14} />
              </button>
              <button type="button" className="ti-icon-btn sm" title="Collapse all" onClick={collapseAll} disabled={!!keep}>
                <Icon name="chevron" size={14} />
              </button>
            </div>

            <div className="ti-filters" role="group" aria-label={`Filter ${noun.many}`}>
              {FILTERS.filter((f) => f.id === "all" || filterCounts[f.id] > 0).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  className={`ti-filter ${filter === f.id ? "active" : ""} ${f.id === "blocked" ? "blk" : ""}`}
                  onClick={() => setFilter(f.id)}
                  aria-pressed={filter === f.id}
                >
                  {f.label}
                  <span className="n">{filterCounts[f.id]}</span>
                </button>
              ))}
            </div>

            <div className="ti-tree-list" ref={listRef}>
              {rows.length === 0 && (
                <div className="ti-tree-empty">
                  No {noun.many} match{query ? ` “${query}”` : ""}{filter !== "all" ? ` in ${FILTERS.find((f) => f.id === filter)!.label.toLowerCase()}` : ""}.
                </div>
              )}
              {rows.map(({ span, guides }) => {
                const k = spanKind(span);
                const color = KIND_COLOR[k] || "#5F73A0";
                const depth = guides.length;
                const isRoot = depth === 0;
                const hasKids = span.children.length > 0;
                const isClosed = !keep && collapsed.has(span.id);
                const blocked = span.status === "blocked";
                const isSel = span.id === sel.id;
                const onPath = pathIds.has(span.id);
                return (
                  <div
                    key={span.id}
                    data-span={span.id}
                    className={`ti-node ${isRoot ? "root" : ""} ${isSel ? "sel" : ""} ${onPath ? "path" : ""} ${blocked ? "blk" : ""}`}
                    onClick={() => setSelId(span.id)}
                  >
                    <span className="ti-guides">
                      {/* Each guide belongs to the ancestor at that level, so it takes that level's colour (same palette as the JSON view). */}
                      {guides.map((g, i) => (
                        <span
                          key={i}
                          className={`g ${g} ${isSel && i === depth - 1 ? "hot" : ""}`}
                          style={{ "--gc": alpha(levelColor(i), 0.5) } as React.CSSProperties}
                        />
                      ))}
                    </span>
                    <span className="ti-kind" style={{ color, background: alpha(color, 0.09), borderColor: alpha(color, 0.25) }}>
                      <Icon name={KIND_ICON[k] ?? "flow"} size={isRoot ? 14 : 12} />
                    </span>
                    <span className="ti-node-main">
                      <span className="ti-name">{span.name}</span>
                      <span className="ti-span-info">
                        {isRoot ? (
                          <span className="si-label">{span.label} · {all.length - 1} {noun.many}</span>
                        ) : (
                          <>
                            <span className="si-level" style={{ color: levelColor(depth - 1), background: alpha(levelColor(depth - 1), 0.1) }}>
                              L{depth}
                            </span>
                            <span className={`si-label ${blocked ? "blk" : ""}`}>{blocked ? "Blocked" : span.label}</span>
                            {hasKids && !isClosed && <span className="si-count">{span.children.length} nested</span>}
                          </>
                        )}
                      </span>
                    </span>
                    {isRoot && (
                      <span className={`ti-root-status ${span.status}`}>{span.status === "blocked" ? "HALTED" : "OK"}</span>
                    )}
                    {isClosed && <span className="ti-hidden-pill">+{descendants.get(span.id)}</span>}
                    {hasKids && !isRoot && (
                      <button
                        type="button"
                        className={`ti-caret ${isClosed ? "closed" : ""}`}
                        onClick={(e) => { e.stopPropagation(); toggle(span.id); }}
                        disabled={!!keep}
                        aria-label={isClosed ? "Expand" : "Collapse"}
                      >
                        <Icon name="chevronDown" size={14} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="ti-tree-foot">
              <span>{all.length - 1} {noun.many}</span>
              {blockedCount > 0 && <span className="blk">{blockedCount} blocked</span>}
              <span className="hint"><kbd>J</kbd><kbd>K</kbd> to step</span>
            </div>
          </aside>

          {/* ── RIGHT: raw data for the selected span ── */}
          <section className="ti-detail">
            <div className="ti-detail-head">
              <span className="ti-d-kind" style={{ color: sColor, background: `${sColor}14` }}>
                <Icon name={KIND_ICON[sKind] ?? "flow"} size={16} />
              </span>
              <div className="ti-d-title">
                <div className="nm">{sel.name}</div>
                <div className="sub">{sel.label}{sel.children.length > 0 ? ` · ${sel.children.length} nested` : ""}</div>
              </div>
              <span className={`ti-d-status ${sel.status}`}>
                <span className="d" />{sel.status === "blocked" ? "BLOCKED" : "OK"}
              </span>
            </div>

            <div className="ti-chips">
              {chips.map((c) => (
                <button
                  type="button"
                  key={c.label}
                  className={`ti-chip ${c.dark ? "dark" : ""} ${c.copyable ? "copyable" : ""}`}
                  onClick={c.copyable ? () => copy(c.label, c.value) : undefined}
                  title={c.copyable ? (copied === c.label ? "Copied" : `Copy ${c.label.toLowerCase()}`) : c.value}
                  tabIndex={c.copyable ? 0 : -1}
                >
                  <b>{c.label}:</b>
                  <span>{truncateMiddle(c.value, 34)}</span>
                  {c.copyable && <Icon name={copied === c.label ? "check" : "copy"} size={11} />}
                </button>
              ))}
            </div>

            <div className="ti-tabs">
              {(["preview", "metadata", "raw"] as Tab[]).map((t) => (
                <button key={t} type="button" className={tab === t ? "active" : ""} onClick={() => setTab(t)}>
                  {t === "preview" ? "Preview" : t === "metadata" ? "Metadata" : "Raw data"}
                </button>
              ))}
              {tab === "preview" && (
                <div className="ti-seg" role="group" aria-label="Payload format">
                  <button type="button" className={mode === "formatted" ? "active" : ""} onClick={() => setMode("formatted")}>Formatted</button>
                  <button type="button" className={mode === "json" ? "active" : ""} onClick={() => setMode("json")}>JSON</button>
                </div>
              )}
            </div>

            <div className="ti-d-scroll">
              {tab === "preview" && (
                <>
                  <div className="ti-payload">
                    <div className="ti-payload-head">
                      <span className="lbl">Input</span>
                      {sel.input && (
                        <button type="button" className="ti-copy" onClick={() => copy("input", sel.input)}>
                          <Icon name={copied === "input" ? "check" : "copy"} size={12} />{copied === "input" ? "Copied" : "Copy"}
                        </button>
                      )}
                    </div>
                    {sel.input ? <Payload raw={sel.input} mode={mode} /> : <div className="ti-none">No input recorded for this span.</div>}
                  </div>
                  <div className={`ti-payload out ${sel.status === "blocked" ? "blk" : ""}`}>
                    <div className="ti-payload-head">
                      <span className="lbl">Output</span>
                      {sel.output && (
                        <button type="button" className="ti-copy" onClick={() => copy("output", sel.output)}>
                          <Icon name={copied === "output" ? "check" : "copy"} size={12} />{copied === "output" ? "Copied" : "Copy"}
                        </button>
                      )}
                    </div>
                    {sel.output ? <Payload raw={sel.output} mode={mode} /> : <div className="ti-none">No output recorded for this span.</div>}
                  </div>
                </>
              )}

              {tab === "metadata" && (
                <div className="ti-payload">
                  <div className="ti-payload-head">
                    <span className="lbl">Metadata</span>
                    <button type="button" className="ti-copy" onClick={() => copy("meta", JSON.stringify(sel.metadata, null, 2))}>
                      <Icon name={copied === "meta" ? "check" : "copy"} size={12} />{copied === "meta" ? "Copied" : "Copy"}
                    </button>
                  </div>
                  <div className="ti-json">
                    <JsonNode value={{ ...sel.metadata, parentId: sel.parentId, signature: sel.signature }} />
                  </div>
                </div>
              )}

              {tab === "raw" && (
                <div className="ti-payload">
                  <div className="ti-payload-head">
                    <span className="lbl">{matchedInteraction ? "Interaction data" : "Envelope data"}</span>
                    <button type="button" className="ti-copy" onClick={() => copy("raw", JSON.stringify(rawValue, null, 2))}>
                      <Icon name={copied === "raw" ? "check" : "copy"} size={12} />{copied === "raw" ? "Copied" : "Copy"}
                    </button>
                  </div>
                  <div className="ti-json"><JsonNode value={rawValue} /></div>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>,
    document.body
  );
}
