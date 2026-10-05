import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { FlowTrace, TraceSpan } from "../pages/flow/flowData";
import { interactionRawData } from "../lib/format";
import { parseInteractionId } from "../lib/interactionBranch";
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

function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = (key: string, text: string) => {
    try { navigator.clipboard.writeText(text); } catch { /* clipboard unavailable */ }
    setCopied(key);
    setTimeout(() => setCopied((c) => (c === key ? null : c)), 1500);
  };
  return { copied, copy };
}


// ─── Raw data views ───────────────────────────────────────────────────────────
//
// Both views show the value exactly as received: every key in its original order (null, "",
// [] and {} included), strings in full and JSON-escaped. The JSON view is the exact text the
// Copy button copies.

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

const C = {
  string: "#0F172A",
  number: "#047857",
  bool: "#C2410C",
  null: "#94A3B8",
  key: "#1E3A8A",
  punct: "#64748B",
};

function JsonChildren({ children, closing, color }: { children: React.ReactNode; closing: string; color: string }) {
  return (
    <div style={{ paddingLeft: INDENT, marginLeft: 5, borderLeft: `2px solid ${alpha(color, 0.45)}` }}>
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

function JsonNode({ label, value, depth = 0 }: { label?: string; value: unknown; depth?: number }) {
  // Three levels open: an envelope, its parent_envelope list, and the parent inside it.
  const [open, setOpen] = useState(depth < 3);
  const color = levelColor(depth);
  const isBranch = value !== null && typeof value === "object";

  // Branch keys are bold so parent blocks stand out from the leaf fields around them.
  const labelEl = label !== undefined ? (
    <span style={{ color, fontWeight: isBranch ? 700 : 500, marginRight: 6 }}>{label}:</span>
  ) : null;

  const leaf = (color: string, text: string) => (
    <div className="agd-json-row" style={{ ...ROW, paddingLeft: 16, wordBreak: "break-word" }}>
      {labelEl}<span style={{ color }}>{text}</span>
    </div>
  );

  if (value === null) return leaf(C.null, "null");
  if (typeof value === "boolean") return leaf(C.bool, String(value));
  if (typeof value === "number") return leaf(C.number, JSON.stringify(value));
  // Quoted and escaped exactly as in the JSON, so a payload that is itself JSON text reads as a string.
  if (typeof value === "string") return leaf(C.string, JSON.stringify(value));
  if (!isBranch) return leaf(C.null, String(value));

  const isArray = Array.isArray(value);
  const items: Array<[string, unknown]> = isArray
    ? (value as unknown[]).map((v, i) => [String(i), v])
    : Object.entries(value as Record<string, unknown>);
  const empty = items.length === 0;
  const openBrace = isArray ? "[" : "{";
  const closeBrace = isArray ? "]" : "}";
  const noun = isArray ? "item" : "field";
  const countLabel = `${items.length} ${noun}${items.length === 1 ? "" : "s"}`;

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
          {items.map(([k, v]) => (
            <JsonNode key={k} label={k} value={v} depth={depth + 1} />
          ))}
        </JsonChildren>
      )}
    </div>
  );
}

/** Tokens of a JSON text, for colouring: strings (keys when followed by a colon), booleans, null, numbers. */
const JSON_TOKEN = /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false)\b|\bnull\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g;

/** The exact JSON text, coloured. Tokens are only wrapped in spans; no character is changed. */
function JsonText({ text }: { text: string }) {
  const parts: React.ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(JSON_TOKEN)) {
    const i = m.index ?? 0;
    if (i > last) parts.push(<span key={`p${last}`} style={{ color: C.punct }}>{text.slice(last, i)}</span>);
    const color = m[1] ? (m[2] ? C.key : C.string) : m[3] ? C.bool : m[0] === "null" ? C.null : C.number;
    parts.push(<span key={i} style={{ color }}>{m[0]}</span>);
    last = i + m[0].length;
  }
  if (last < text.length) parts.push(<span key={`p${last}`} style={{ color: C.punct }}>{text.slice(last)}</span>);
  return <pre className="ti-pre json">{parts}</pre>;
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

/** Flattens the visible tree into rows, each carrying the guide cells that draw its connector lines. */
function visibleRows(root: TraceSpan, collapsed: Set<string>): TreeRow[] {
  const rows: TreeRow[] = [];
  const walk = (s: TraceSpan, trail: boolean[], isLast: boolean, depth: number) => {
    const guides: GuideCell[] = depth === 0 ? [] : [
      ...trail.slice(1).map<GuideCell>((hasNext) => (hasNext ? "v" : "blank")),
      isLast ? "elbow" : "tee",
    ];
    rows.push({ span: s, guides });
    if (collapsed.has(s.id)) return;
    s.children.forEach((c, i) => walk(c, [...trail, !isLast], i === s.children.length - 1, depth + 1));
  };
  walk(root, [], true, 0);
  return rows;
}

/** The hop's label from its interaction ID ("1", "2a.1"), when the ID carries one. */
const hopOf = (s: TraceSpan) => parseInteractionId(s.id)?.label;

/** The span's name without the " · Branch X" suffix — the branch is shown on its own. */
const pairOf = (s: TraceSpan) => s.name.replace(/ · Branch .+$/, "");

const sentence = (s: string) => (s ? s[0].toUpperCase() + s.slice(1).toLowerCase() : s);


// ─── Main component ───────────────────────────────────────────────────────────

interface TraceInspectorProps {
  trace: FlowTrace;
  openSpanId?: string;
  onClose: () => void;
  /** Shown when the intent itself (the root) is selected. */
  rawData?: unknown;
  /** Span id → the real Interaction it came from, when one exists — its raw data is shown as is. */
  interactionBySpanId?: Record<string, Interaction>;
  /** What each row is called in the UI ("span", "interaction", …). */
  noun?: { one: string; many: string };
}

type View = "tree" | "json";

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
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [view, setView] = useState<View>("tree");
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
  const rows = useMemo(() => visibleRows(trace.trace, collapsed), [trace, collapsed]);
  const descendants = useMemo(() => descendantCounts(trace.trace), [trace]);
  const blockedCount = useMemo(() => all.filter((s) => s.status === "blocked").length, [all]);

  const sel = trace.spanById[selId] || trace.trace;
  const isRootSel = sel === trace.trace;

  // Ancestors of the selection, so the route from the root down to it can be traced in the tree.
  const pathIds = new Set<string>();
  for (let p = sel.parentId; p; p = trace.spanById[p]?.parentId ?? null) pathIds.add(p);
  const selIndex = all.findIndex((s) => s.id === sel.id);
  const sKind = spanKind(sel);
  const sColor = KIND_COLOR[sKind] || "#5F73A0";

  // Step through what's on screen, so J/K never lands on a collapsed span.
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

  // The selected interaction's raw data exactly as received. The root shows what the caller
  // passed for the intent as a whole.
  const matchedInteraction = interactionBySpanId?.[selId];
  const rawValue = matchedInteraction ? interactionRawData(matchedInteraction) : rawData;
  const hasRaw = rawValue !== undefined;
  const rawText = useMemo(() => (hasRaw ? JSON.stringify(rawValue, null, 2) : ""), [rawValue, hasRaw]);

  return createPortal(
    <div className="ti-overlay" onMouseDown={onClose}>
      <div className="ti-modal" role="dialog" aria-label="Envelope inspector" onMouseDown={(e) => e.stopPropagation()}>

        {/* ── TOP BAR ── */}
        <div className="ti-top">
          <span className="ti-top-chip"><Icon name="flow" size={14} />Envelope</span>
          <div className="ti-top-title">
            {/* The root is the container, not an item, so it's left out of the count. */}
            <span className="nm">{isRootSel ? "Whole intent" : `${One} ${selIndex} of ${all.length - 1}`}</span>
          </div>
          <div className="ti-top-actions">
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
              <span className="ti-tree-count">{all.length - 1} {noun.many}</span>
              <button type="button" className="ti-icon-btn sm" title="Expand all" onClick={expandAll}>
                <Icon name="chevronDown" size={14} />
              </button>
              <button type="button" className="ti-icon-btn sm" title="Collapse all" onClick={collapseAll}>
                <Icon name="chevron" size={14} />
              </button>
            </div>

            <div className="ti-tree-list" ref={listRef}>
              {rows.map(({ span, guides }) => {
                const k = spanKind(span);
                const color = KIND_COLOR[k] || "#5F73A0";
                const depth = guides.length;
                const isRoot = depth === 0;
                const hasKids = span.children.length > 0;
                const isClosed = collapsed.has(span.id);
                const blocked = span.status === "blocked";
                const isSel = span.id === sel.id;
                const onPath = pathIds.has(span.id);
                const hop = hopOf(span);
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
                      <span className="ti-name">{isRoot ? span.name : pairOf(span)}</span>
                      <span className="ti-span-info">
                        {isRoot ? (
                          <span className="si-label">Intent, {all.length - 1} {noun.many}</span>
                        ) : (
                          <>
                            {hop && <span className="si-hop">{hop}</span>}
                            <span className={`si-label ${blocked ? "blk" : ""}`}>{blocked ? "Blocked" : sentence(span.label)}</span>
                            {hasKids && !isClosed && <span className="si-count">{span.children.length} nested</span>}
                          </>
                        )}
                      </span>
                    </span>
                    {isRoot && (
                      <span className={`ti-root-status ${span.status}`}>{span.status === "blocked" ? "Threat found" : "Clean"}</span>
                    )}
                    {isClosed && <span className="ti-hidden-pill">+{descendants.get(span.id)}</span>}
                    {hasKids && !isRoot && (
                      <button
                        type="button"
                        className={`ti-caret ${isClosed ? "closed" : ""}`}
                        onClick={(e) => { e.stopPropagation(); toggle(span.id); }}
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

          {/* ── RIGHT: the selected envelope, as received ── */}
          <section className="ti-detail">
            <header className="ti-detail-head">
              <span className="ti-d-kind" style={{ color: sColor, background: `${sColor}14` }}>
                <Icon name={KIND_ICON[sKind] ?? "flow"} size={16} />
              </span>
              <div className="ti-d-title">
                <div className="nm">{isRootSel ? sel.name : pairOf(sel)}</div>
              </div>
              <span className={`ti-d-status ${sel.status}`}>
                <span className="d" />
                {isRootSel ? (sel.status === "blocked" ? "Threat found" : "Clean") : sel.status === "blocked" ? "Blocked" : "Allowed"}
              </span>
            </header>

            {!isRootSel && (
              <button
                type="button"
                className="ti-id"
                onClick={() => copy("id", sel.id)}
                title={copied === "id" ? "Copied" : `Copy ${noun.one} ID`}
              >
                <span className="k">{One} ID</span>
                <span className="v">{sel.id}</span>
                <Icon name={copied === "id" ? "check" : "copy"} size={12} />
              </button>
            )}

            <div className="ti-raw-bar">
              {hasRaw && (
                <>
                  <div className="ti-seg" role="group" aria-label="Raw data view">
                    <button type="button" className={view === "tree" ? "active" : ""} aria-pressed={view === "tree"} onClick={() => setView("tree")}>Tree</button>
                    <button type="button" className={view === "json" ? "active" : ""} aria-pressed={view === "json"} onClick={() => setView("json")}>JSON</button>
                  </div>
                  <button type="button" className="ti-copy" onClick={() => copy("raw", rawText)}>
                    <Icon name={copied === "raw" ? "check" : "copy"} size={12} />{copied === "raw" ? "Copied" : "Copy"}
                  </button>
                </>
              )}
            </div>

            <div className="ti-d-scroll">
              {!hasRaw ? (
                <div className="ti-none">No raw data was received for this {isRootSel ? "intent" : noun.one}.</div>
              ) : view === "json" ? (
                <JsonText text={rawText} />
              ) : (
                // Keyed by selection so each envelope opens with the default levels expanded.
                <div className="ti-json" key={sel.id}><JsonNode value={rawValue} /></div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>,
    document.body
  );
}
