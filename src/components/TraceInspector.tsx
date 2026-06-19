import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./Icon";
import type { FlowTrace, TraceSpan } from "../pages/flow/flowData";

const KIND_COLOR: Record<string, string> = {
  chain: "#7C3AED",
  human: "#0A2240",
  agent: "#2563EB",
  tool: "#0284C7",
  llm: "#DB2777",
};

function spanKind(s: TraceSpan): string {
  if (s.kind === "agent" && s.label === "LLM") return "llm";
  return s.kind;
}


interface FlatRow {
  span: TraceSpan;
  depth: number;
  lastChain: boolean[];
}

function flattenSpans(root: TraceSpan, collapsed: Record<string, boolean>): FlatRow[] {
  const rows: FlatRow[] = [];
  const walk = (span: TraceSpan, depth: number, lastChain: boolean[]) => {
    rows.push({ span, depth, lastChain });
    if (collapsed[span.id]) return;
    span.children.forEach((c, i) => {
      walk(c, depth + 1, [...lastChain, i === span.children.length - 1]);
    });
  };
  walk(root, 0, []);
  return rows;
}

function Guides({ lastChain }: { lastChain: boolean[] }) {
  const depth = lastChain.length;
  if (depth === 0) return null;
  return (
    <span className="ti-guides">
      {lastChain.map((isLast, i) => {
        if (i < depth - 1) return <span key={i} className={`g ${isLast ? "" : "v"}`} />;
        return <span key={i} className={`g ${isLast ? "elbow" : "tee"}`} />;
      })}
    </span>
  );
}

function TreeNode({
  row,
  selected,
  onSelect,
  collapsed,
  onToggle,
}: {
  row: FlatRow;
  selected: boolean;
  onSelect: (id: string) => void;
  collapsed: boolean;
  onToggle: (id: string) => void;
}) {
  const { span, lastChain } = row;
  const hasKids = span.children.length > 0;
  const bk = spanKind(span);
  const c = KIND_COLOR[bk];
  const infoLabel = span.kind === "chain" ? "trace" : span.label;
  const hasTokens = span.tokensIn > 0 || span.tokensOut > 0;
  return (
    <div
      className={`ti-node ${selected ? "sel" : ""} ${span.status === "blocked" ? "blk" : ""}`}
      onClick={() => onSelect(span.id)}
    >
      <Guides lastChain={lastChain} />
      <div className="ti-node-main">
        <div className="ti-node-row">
          {hasKids ? (
            <button
              className={`ti-caret ${collapsed ? "closed" : ""}`}
              onClick={(e) => {
                e.stopPropagation();
                onToggle(span.id);
              }}
            >
              <Icon name="chevron" size={13} />
            </button>
          ) : (
            <span className="ti-caret ghost" />
          )}
          <span className="ti-dot" style={{ background: c }} />
          <span className="ti-name">{span.name}</span>
          {span.status === "blocked" && <span className="ti-blk-tag">blocked</span>}
        </div>
        <div className="ti-span-info" style={{ paddingLeft: hasKids ? 26 : 26 }}>
          <span className="si-label">{infoLabel}</span>
          {hasTokens && (
            <span className="si-tok">{span.tokensIn}↑ {span.tokensOut}↓ tok</span>
          )}
          {span.model && <span className="si-model">{span.model}</span>}
        </div>
      </div>
    </div>
  );
}

function PayloadBlock({ label, value, json }: { label: string; value: string; json?: boolean }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    try {
      navigator.clipboard.writeText(value);
    } catch {}
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };
  return (
    <div className="ti-payload">
      <div className="ti-payload-head">
        <span className="lbl">{label}</span>
        <button className="ti-copy" onClick={copy}>
          <Icon name={copied ? "shield" : "copy"} size={12} />
          {copied ? "copied" : "copy"}
        </button>
      </div>
      <pre className={`ti-pre ${json ? "json" : ""}`}>{value}</pre>
    </div>
  );
}

interface TraceInspectorProps {
  trace: FlowTrace;
  openSpanId?: string;
  onClose: () => void;
}

export function TraceInspector({ trace, openSpanId, onClose }: TraceInspectorProps) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [selId, setSelId] = useState(openSpanId || trace.trace.id);

  useEffect(() => {
    if (openSpanId) setSelId(openSpanId);
  }, [openSpanId]);

  useEffect(() => {
    setSelId(openSpanId || trace.trace.id);
    setCollapsed({});
  }, [trace]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const rows = useMemo(
    () => flattenSpans(trace.trace, collapsed),
    [trace, collapsed]
  );
  const sel = trace.spanById[selId] || trace.trace;
  const parentSpan = sel.parentId ? trace.spanById[sel.parentId] : null;
  const toggle = (id: string) => setCollapsed((c) => ({ ...c, [id]: !c[id] }));
  const isTool = sel.kind === "tool";
  const selBk = spanKind(sel);
  const spanCount = Object.keys(trace.spanById).length;

  return createPortal(
    <div className="ti-overlay" onMouseDown={onClose}>
      <div className="ti-modal" onMouseDown={(e) => e.stopPropagation()}>
        {/* header */}
        <div className="ti-top">
          <div className="ti-top-l">
            <span className="ti-top-glyph">
              <Icon name="flow" size={16} />
            </span>
            <div>
              <div className="ti-top-title">
                {trace.trace.name}
                <span className="ti-top-kind">trace</span>
              </div>
              <div className="ti-top-id">{trace.traceId}</div>
            </div>
          </div>
          <div className="ti-badges">
            <span className="ti-stat-top">
              <b>Spans</b>
              {spanCount}
            </span>
            <span className="ti-stat-top">
              <b>Tokens</b>
              {trace.totalTokensIn} → {trace.totalTokensOut}
            </span>
          </div>
          <button className="ti-close" onClick={onClose}>
            <Icon name="close" size={16} />
          </button>
        </div>

        <div className="ti-body">
          {/* transaction tree */}
          <div className="ti-tree">
            <div className="ti-tree-head">Transactions · {spanCount}</div>
            <div className="ti-tree-list">
              {rows.map((row) => (
                <TreeNode
                  key={row.span.id}
                  row={row}
                  selected={row.span.id === selId}
                  onSelect={setSelId}
                  collapsed={!!collapsed[row.span.id]}
                  onToggle={toggle}
                />
              ))}
            </div>
          </div>

          {/* detail pane */}
          <div className="ti-detail">
            <div className="ti-detail-head" style={{ borderBottom: `2px solid ${KIND_COLOR[selBk]}44` }}>
              <span
                className="ti-d-dot"
                style={{ background: KIND_COLOR[selBk] }}
              />
              <div className="ti-d-title">
                <div className="nm">{sel.name}</div>
                <div className="sub">{sel.kind === "chain" ? "trace root" : sel.label}</div>
              </div>
              <span className={`ti-d-status ${sel.status}`}>
                <span className="d" />
                {sel.status === "blocked" ? "BLOCKED" : "OK"}
              </span>
            </div>

            {parentSpan && (
              <div className="ti-ix-chain">
                <span className="ti-ix-node parent">
                  <span className="ti-ix-dot" style={{ background: KIND_COLOR[spanKind(parentSpan)] }} />
                  <span className="ti-ix-name">{parentSpan.name}</span>
                </span>
                <span className="ti-ix-arrow">→</span>
                <span className="ti-ix-node active" style={{ background: KIND_COLOR[selBk] + "18", borderColor: KIND_COLOR[selBk] + "55" }}>
                  <span className="ti-ix-dot" style={{ background: KIND_COLOR[selBk] }} />
                  <span className="ti-ix-name" style={{ color: KIND_COLOR[selBk] }}>{sel.name}</span>
                </span>
              </div>
            )}

            <div className="ti-chips">
              <span className="ti-chip">
                <b>Session</b>
                {trace.sessionId}
              </span>
              <span className="ti-chip">
                <b>User</b>
                {trace.userId}
              </span>
              <span className="ti-chip">
                <b>Env</b>
                {trace.env}
              </span>
              {sel.model && (
                <span className="ti-chip">
                  <b>Model</b>
                  {sel.model}
                </span>
              )}
              {(sel.tokensIn > 0 || sel.tokensOut > 0) && (
                <span className="ti-chip">
                  <b>Tokens</b>
                  {sel.tokensIn} in + {sel.tokensOut} out
                </span>
              )}
            </div>

            <div className="ti-d-scroll">
              <PayloadBlock
                label={isTool ? "Request" : "Input"}
                value={sel.input}
                json={isTool}
              />
              <PayloadBlock
                label={isTool ? "Response" : "Output"}
                value={sel.output}
                json={isTool}
              />
              <div className="ti-payload">
                <div className="ti-payload-head">
                  <span className="lbl">Metadata</span>
                </div>
                <pre className="ti-pre json">{JSON.stringify(sel.metadata, null, 2)}</pre>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
