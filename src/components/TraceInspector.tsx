import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { FlowTrace, TraceSpan } from "../pages/flow/flowData";

const KIND_COLOR: Record<string, string> = {
  chain: "#7C3AED",
  human: "#0A2240",
  agent: "#2563EB",
  tool:  "#0284C7",
  llm:   "#EC4899",
};

function spanKind(s: TraceSpan): string {
  if (s.kind === "agent" && s.label === "LLM") return "llm";
  return s.kind;
}


// ─── Collapsible JSON tree ────────────────────────────────────────────────────

const INDENT = 20;
const GUIDE_COLOR = "rgba(100,116,139,0.30)";
const ROW = { lineHeight: "24px" } as const;
/** Payloads run to several KB; show a head and let the reader opt into the rest. */
const STRING_PREVIEW = 220;

const C = {
  key: "#7DD3FC",
  string: "#FCD34D",
  number: "#86EFAC",
  bool: "#FB923C",
  null: "#94A3B8",
  punct: "#C9D6EE",
  meta: "#64748B",
};

function JsonChildren({ children, closing }: { children: React.ReactNode; closing: string }) {
  return (
    <div style={{ paddingLeft: INDENT, borderLeft: `1.5px solid ${GUIDE_COLOR}`, marginLeft: 6 }}>
      {children}
      <div style={{ ...ROW, color: C.punct }}>{closing}</div>
    </div>
  );
}

function Twisty({ open, hidden }: { open: boolean; hidden: boolean }) {
  return (
    <span style={{
      fontSize: 8,
      color: C.meta,
      display: "inline-block",
      width: 10,
      flexShrink: 0,
      opacity: hidden ? 0 : 1,
      transform: open ? "rotate(90deg)" : "rotate(0deg)",
      transition: "transform .12s",
    }}>▶</span>
  );
}

/** String leaf with an expand affordance for long values. */
function JsonString({ labelEl, value }: { labelEl: React.ReactNode; value: string }) {
  const [expanded, setExpanded] = useState(false);
  const long = value.length > STRING_PREVIEW;
  const shown = long && !expanded ? value.slice(0, STRING_PREVIEW) : value;
  return (
    <div className="agd-json-row" style={{ ...ROW, wordBreak: "break-word", paddingLeft: 14 }}>
      {labelEl}
      <span style={{ color: C.string }}>&quot;{shown}{long && !expanded ? "…" : ""}&quot;</span>
      {long && (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          style={{
            marginLeft: 8,
            padding: "1px 7px",
            borderRadius: 6,
            border: `1px solid ${GUIDE_COLOR}`,
            background: "transparent",
            color: C.meta,
            font: "600 10px var(--font-mono)",
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          {expanded ? "collapse" : `+${(value.length - STRING_PREVIEW).toLocaleString()} chars`}
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

  const labelEl = label !== undefined ? (
    <span style={{ color: C.key, marginRight: 6 }}>&quot;{label}&quot;:</span>
  ) : null;

  const leaf = (color: string, text: React.ReactNode) => (
    <div className="agd-json-row" style={{ ...ROW, paddingLeft: 14 }}>
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
      ? (value as unknown[]).map((v) => [undefined, v])
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
    const countLabel = isArray
      ? `${items.length} item${items.length === 1 ? "" : "s"}`
      : `${items.length} key${items.length === 1 ? "" : "s"}`;

    return (
      <div>
        <div
          className="agd-json-row"
          style={{ ...ROW, cursor: empty ? "default" : "pointer", userSelect: "none", display: "flex", alignItems: "center", gap: 4 }}
          onClick={() => !empty && setOpen((o) => !o)}
        >
          <Twisty open={open} hidden={empty} />
          {labelEl}
          <span style={{ color: C.punct }}>{openBrace}</span>
          {/* Collapsed rows keep their size visible so the shape of the
              document is readable without expanding everything. */}
          {(!open || empty) && !empty && (
            <span style={{ color: C.meta, fontSize: 11, margin: "0 4px" }}>{countLabel}</span>
          )}
          {(!open || empty) && <span style={{ color: C.punct }}>{closeBrace}</span>}
          {open && !empty && (
            <span style={{ color: C.meta, fontSize: 10.5, marginLeft: 6, opacity: 0.65 }}>{countLabel}</span>
          )}
        </div>
        {open && !empty && (
          <JsonChildren closing={closeBrace}>
            {items.map(([k, v], i) => (
              <JsonNode
                key={k ?? i}
                label={k}
                value={v}
                depth={depth + 1}
                // Nested nodes start closed: the reader sees the outer fields
                // first and opens only the branch they care about.
                defaultOpen={false}
              />
            ))}
          </JsonChildren>
        )}
      </div>
    );
  }

  return null;
}


// ─── Main component ───────────────────────────────────────────────────────────

interface TraceInspectorProps {
  trace: FlowTrace;
  openSpanId?: string;
  onClose: () => void;
  rawData?: unknown;
}

export function TraceInspector({ trace, openSpanId, onClose, rawData }: TraceInspectorProps) {
  const [selId, setSelId] = useState(openSpanId || trace.trace.id);
  const [copiedJson, setCopiedJson] = useState(false);

  useEffect(() => { if (openSpanId) setSelId(openSpanId); }, [openSpanId]);
  useEffect(() => {
    setSelId(openSpanId || trace.trace.id);
  }, [trace]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const sel = trace.spanById[selId] || trace.trace;
  const sKind = spanKind(sel);
  const sColor = KIND_COLOR[sKind] || "#5F73A0";

  const copyJson = () => {
    try { navigator.clipboard.writeText(JSON.stringify(rawData ?? trace.trace, null, 2)); } catch {}
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 1500);
  };

  return createPortal(
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(6,18,40,0.60)", backdropFilter: "blur(6px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "'Inter',system-ui,sans-serif",
      }}
      onMouseDown={onClose}
    >
      <div
        style={{
          width: "min(96vw, 1440px)",
          maxHeight: "92vh",
          background: "#FFFFFF",
          border: "1px solid rgba(15,32,70,0.14)",
          borderRadius: 18,
          boxShadow: "0 24px 64px rgba(6,18,40,0.36)",
          display: "flex", flexDirection: "column", overflow: "hidden",
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >

        {/* ── HEADER ── */}
        <div style={{
          flex: "none", display: "flex", alignItems: "center", justifyContent: "flex-end",
          padding: "6px 10px", borderBottom: "1px solid rgba(15,32,70,0.07)",
          background: "#FFFFFF",
        }}>
          <button
            onClick={onClose}
            style={{
              width: 18, height: 18, borderRadius: 5,
              border: "1px solid rgba(15,32,70,0.12)", background: "none",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", color: "#0A2240", fontSize: 9, lineHeight: 1,
            }}
          >✕</button>
        </div>

        {/* ── BODY ── */}
        <div style={{ flex: 1, display: "flex", minHeight: 0, overflow: "hidden" }}>

          {/* RIGHT DETAIL */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, background: "#F7F9FD" }}>

            {/* Span name */}
            <div style={{
              flex: "none", padding: "14px 22px 0",
              borderBottom: "1px solid rgba(15,32,70,0.08)", background: "#FFFFFF",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                <span style={{
                  fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 18,
                  letterSpacing: "-0.01em", color: "#0A2240",
                }}>{sel.name}</span>
                <span style={{
                  fontFamily: "'JetBrains Mono',monospace", fontSize: 10, letterSpacing: "0.08em",
                  textTransform: "uppercase", color: "#FFFFFF",
                  background: sColor, padding: "3px 9px", borderRadius: 6,
                }}>{sel.label}</span>
              </div>
            </div>

            {/* Panel body */}
            <div style={{ flex: 1, overflowY: "auto", padding: "20px 22px 24px" }}>

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{
                    fontFamily: "'JetBrains Mono',monospace", fontSize: 10, fontWeight: 600,
                    letterSpacing: "0.14em", textTransform: "uppercase", color: "#8595B5",
                  }}>Span data</span>
                  <button onClick={copyJson} style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    fontFamily: "'Inter',sans-serif", fontSize: 12, fontWeight: 600,
                    color: copiedJson ? "#059669" : "#2563EB",
                    cursor: "pointer", padding: "4px 10px", borderRadius: 7,
                    background: "none", border: "none",
                  }}>{copiedJson ? "✓ Copied" : "Copy"}</button>
                </div>
                <div style={{
                  background: "#0B1B36", borderRadius: 12, padding: "16px 18px",
                  border: "1px solid rgba(255,255,255,0.07)", overflowY: "auto",
                  fontFamily: "'JetBrains Mono',monospace", fontSize: 13, lineHeight: 1.65,
                }}>
                  <JsonNode value={rawData ?? trace.trace} defaultOpen={true} />
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* ── FOOTER ── */}
        <div style={{
          flex: "none",
          padding: "7px 10px",
          borderTop: "1px solid rgba(15,32,70,0.07)",
          background: "#FFFFFF",
        }} />
      </div>
    </div>,
    document.body
  );
}
