import { useEffect, useMemo, useState, useCallback } from "react";
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

function hex2rgba(hex: string, a: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

// ─── Tree flattening ──────────────────────────────────────────────────────────

interface FlatRow {
  span: TraceSpan;
  guides: ("line" | "blank")[];
  connector: "tee" | "elbow" | null;
  hasChildren: boolean;
}

function flattenSpans(root: TraceSpan, collapsed: Record<string, boolean>): FlatRow[] {
  const rows: FlatRow[] = [];
  const walk = (node: TraceSpan, guides: ("line" | "blank")[], connector: "tee" | "elbow" | null) => {
    const hasChildren = node.children.length > 0;
    rows.push({ span: node, guides: [...guides], connector, hasChildren });
    if (hasChildren && !collapsed[node.id]) {
      const next: ("line" | "blank")[] = [
        ...guides,
        ...(connector === null ? [] : connector === "tee" ? ["line" as const] : ["blank" as const]),
      ];
      node.children.forEach((c, i) => {
        walk(c, next, i === node.children.length - 1 ? "elbow" : "tee");
      });
    }
  };
  walk(root, [], null);
  return rows;
}

// ─── Guide cell ───────────────────────────────────────────────────────────────

const GC = "rgba(15,32,70,0.18)";

function GuideCell({ kind }: { kind: "line" | "blank" | "tee" | "elbow" }) {
  return (
    <div style={{ position: "relative", width: 12, flex: "none", alignSelf: "stretch" }}>
      {(kind === "line" || kind === "tee") && (
        <div style={{ position: "absolute", left: 5, top: 0, bottom: 0, borderLeft: `1.5px solid ${GC}` }} />
      )}
      {kind === "elbow" && (
        <div style={{ position: "absolute", left: 5, top: 0, height: "50%", borderLeft: `1.5px solid ${GC}` }} />
      )}
      {(kind === "tee" || kind === "elbow") && (
        <div style={{ position: "absolute", left: 5, top: "50%", width: 7, borderTop: `1.5px solid ${GC}` }} />
      )}
    </div>
  );
}

// ─── Detail field row ─────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{
        fontFamily: "'JetBrains Mono',monospace", fontSize: 10, fontWeight: 600,
        letterSpacing: "0.14em", textTransform: "uppercase", color: "#8595B5",
      }}>{label}</span>
      <div>{children}</div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface TraceInspectorProps {
  trace: FlowTrace;
  openSpanId?: string;
  onClose: () => void;
}

export function TraceInspector({ trace, openSpanId, onClose }: TraceInspectorProps) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [selId, setSelId] = useState(openSpanId || trace.trace.id);
  const [copiedMsg, setCopiedMsg] = useState(false);

  useEffect(() => { if (openSpanId) setSelId(openSpanId); }, [openSpanId]);
  useEffect(() => {
    setSelId(openSpanId || trace.trace.id);
    setCollapsed({});
    console.log("[TraceInspector] opened", {
      traceId: trace.traceId,
      sessionId: trace.sessionId,
      userId: trace.userId,
      env: trace.env,
      totalTokensIn: trace.totalTokensIn,
      totalTokensOut: trace.totalTokensOut,
      totalCost: trace.totalCost,
      spanCount: Object.keys(trace.spanById).length,
      rootSpan: trace.trace,
      allSpans: trace.spanById,
      openSpanId,
    });
  }, [trace]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const rows = useMemo(() => flattenSpans(trace.trace, collapsed), [trace, collapsed]);
  const sel = trace.spanById[selId] || trace.trace;
  const parentSpan = sel.parentId ? trace.spanById[sel.parentId] : null;
  const spanCount = Object.keys(trace.spanById).length;
  const anyBlocked = Object.values(trace.spanById).some((s) => s.status === "blocked");
  const sKind = spanKind(sel);
  const sColor = KIND_COLOR[sKind] || "#5F73A0";
  const isBlocked = sel.status === "blocked";

  // Epoch: prefer span.epoch, fall back to metadata.epoch, then "—"
  const epoch: string = sel.epoch != null
    ? String(sel.epoch)
    : typeof sel.metadata?.epoch === "number" || typeof sel.metadata?.epoch === "string"
      ? String(sel.metadata.epoch)
      : "—";

  const toggle = useCallback((id: string) => {
    setCollapsed((c) => ({ ...c, [id]: !c[id] }));
  }, []);

  const copyMsg = () => {
    try { navigator.clipboard.writeText(sel.input); } catch {}
    setCopiedMsg(true);
    setTimeout(() => setCopiedMsg(false), 1500);
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
          width: "min(96vw, 1200px)",
          maxHeight: "90vh",
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
          flex: "none", display: "flex", alignItems: "center", gap: 16,
          padding: "15px 22px", borderBottom: "1px solid rgba(15,32,70,0.08)",
          background: "#FFFFFF",
        }}>
          <div style={{
            width: 32, height: 32, flex: "none",
            background: "#0A2240",
            clipPath: "polygon(25% 4%,75% 4%,100% 50%,75% 96%,25% 96%,0% 50%)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <div style={{ width: 11, height: 11, borderRadius: "50%", border: "2.5px solid #2563EB" }} />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
            <span style={{
              fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 17,
              letterSpacing: "-0.01em", color: "#0A2240",
            }}>{trace.trace.name}</span>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11.5, color: "#5F73A0" }}>
                trace_id: {trace.traceId}
              </span>
              <span style={{ width: 3, height: 3, borderRadius: "50%", background: "#8595B5" }} />
              <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11.5, color: "#5F73A0" }}>
                {spanCount} spans
              </span>
            </div>
          </div>

          <span style={{ flex: 1 }} />

          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "7px 14px", borderRadius: 999,
            fontFamily: "'JetBrains Mono',monospace", fontSize: 11.5, fontWeight: 700, letterSpacing: "0.08em",
            color: anyBlocked ? "#DC2626" : "#059669",
            background: anyBlocked ? "rgba(220,38,38,0.08)" : "rgba(5,150,105,0.08)",
            border: `1px solid ${anyBlocked ? "rgba(220,38,38,0.28)" : "rgba(5,150,105,0.28)"}`,
          }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: anyBlocked ? "#DC2626" : "#059669" }} />
            {anyBlocked ? "HALTED" : "OK"}
          </div>

          <button
            onClick={onClose}
            style={{
              flex: "none", width: 34, height: 34, borderRadius: 9,
              border: "1px solid rgba(15,32,70,0.12)", background: "none",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", color: "#5F73A0", fontSize: 16,
            }}
          >✕</button>
        </div>

        {/* ── BODY ── */}
        <div style={{ flex: 1, display: "flex", minHeight: 0, overflow: "hidden" }}>

          {/* LEFT TREE */}
          <div style={{
            width: 360, flexShrink: 0, flexGrow: 0, borderRight: "1px solid rgba(15,32,70,0.08)",
            display: "flex", flexDirection: "column", background: "#FCFDFF",
            overflow: "hidden",
          }}>
            <div style={{
              flex: "none", display: "flex", alignItems: "center",
              padding: "11px 16px", borderBottom: "1px solid rgba(15,32,70,0.06)",
            }}>
              <span style={{
                fontFamily: "'JetBrains Mono',monospace", fontSize: 10.5, fontWeight: 600,
                letterSpacing: "0.14em", textTransform: "uppercase", color: "#5F73A0",
              }}>Span Tree</span>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: "8px 6px 16px" }}>
              {rows.map((r) => {
                const n = r.span;
                const sk = spanKind(n);
                const color = KIND_COLOR[sk] || "#5F73A0";
                const selected = n.id === selId;
                const isColl = !!collapsed[n.id];
                const allGuides = [...r.guides, ...(r.connector ? [r.connector] : [])];
                const rowBlocked = n.status === "blocked";
                return (
                  <div
                    key={n.id}
                    onClick={() => setSelId(n.id)}
                    style={{
                      display: "flex", alignItems: "stretch", minHeight: 36, cursor: "pointer",
                      borderLeft: `2px solid ${selected ? color : rowBlocked ? "#DC2626" : "transparent"}`,
                      background: selected
                        ? (rowBlocked ? "rgba(220,38,38,0.11)" : hex2rgba(color, 0.07))
                        : rowBlocked ? "rgba(220,38,38,0.04)" : "transparent",
                      borderRadius: "0 8px 8px 0",
                    }}
                  >
                    <div style={{ display: "flex", flex: "none" }}>
                      {allGuides.map((k, ci) => <GuideCell key={ci} kind={k as "line" | "blank" | "tee" | "elbow"} />)}
                    </div>

                    <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 7, padding: "4px 10px 4px 2px" }}>
                      {r.hasChildren ? (
                        <button
                          onClick={(e) => { e.stopPropagation(); toggle(n.id); }}
                          style={{
                            flex: "none", width: 16, height: 16, display: "flex", alignItems: "center",
                            justifyContent: "center", background: "none", border: "none", cursor: "pointer",
                            color: "#8595B5", fontSize: 8,
                            transform: isColl ? "rotate(0deg)" : "rotate(90deg)", transition: "transform .12s",
                          }}
                        >▶</button>
                      ) : (
                        <div style={{ flex: "none", width: 16 }} />
                      )}

                      <span style={{
                        flex: "none", fontFamily: "'Inter',sans-serif", fontSize: 13, fontWeight: 600,
                        color: "#0A2240", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                        maxWidth: 130,
                      }}>{n.name}</span>

                      <span style={{
                        flex: "none", fontFamily: "'JetBrains Mono',monospace", fontSize: 9,
                        letterSpacing: "0.06em", textTransform: "uppercase", color: "#8595B5",
                        background: "#F1F5FB", padding: "2px 6px", borderRadius: 5,
                      }}>{n.label}</span>

                      <span style={{ flex: 1 }} />

                      {rowBlocked && (
                        <span style={{
                          flex: "none", fontFamily: "'JetBrains Mono',monospace", fontSize: 8.5,
                          fontWeight: 700, letterSpacing: "0.06em", color: "#DC2626",
                          background: "rgba(220,38,38,0.10)", border: "1px solid rgba(220,38,38,0.28)",
                          padding: "2px 6px", borderRadius: 5,
                        }}>BLOCKED</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* RIGHT DETAIL */}
          <div style={{ flex: 1, overflowY: "auto", padding: "20px 22px 24px", background: "#F7F9FD" }}>

            {/* span name + type bar */}
            <div style={{
              display: "flex", alignItems: "center", gap: 12, marginBottom: 14,
              paddingBottom: 14, borderBottom: "1px solid rgba(15,32,70,0.08)",
            }}>
              <span style={{
                fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 20,
                letterSpacing: "-0.01em", color: "#0A2240",
              }}>{sel.name}</span>
              <span style={{
                fontFamily: "'JetBrains Mono',monospace", fontSize: 10, letterSpacing: "0.08em",
                textTransform: "uppercase", color: "#FFFFFF",
                background: sColor, padding: "3px 9px", borderRadius: 6,
              }}>{sel.label}</span>
            </div>

            {/* fields grid */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px 24px", marginBottom: 16 }}>

              {/* FROM */}
              <Field label="From">
                {parentSpan ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{
                      width: 8, height: 8, borderRadius: "50%", flex: "none",
                      background: KIND_COLOR[spanKind(parentSpan)] || "#5F73A0",
                      display: "inline-block",
                    }} />
                    <span style={{ fontFamily: "'Inter',sans-serif", fontSize: 14, fontWeight: 600, color: "#0A2240" }}>
                      {parentSpan.name}
                    </span>
                    <span style={{
                      fontFamily: "'JetBrains Mono',monospace", fontSize: 9.5, color: "#8595B5",
                      background: "#F1F5FB", padding: "2px 6px", borderRadius: 5,
                      textTransform: "uppercase", letterSpacing: "0.06em",
                    }}>{parentSpan.label}</span>
                  </div>
                ) : (
                  <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13, color: "#8595B5" }}>— root —</span>
                )}
              </Field>

              {/* TO */}
              <Field label="To">
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{
                    width: 8, height: 8, borderRadius: "50%", flex: "none",
                    background: sColor, display: "inline-block",
                  }} />
                  <span style={{ fontFamily: "'Inter',sans-serif", fontSize: 14, fontWeight: 600, color: "#0A2240" }}>
                    {sel.name}
                  </span>
                  <span style={{
                    fontFamily: "'JetBrains Mono',monospace", fontSize: 9.5, color: "#8595B5",
                    background: "#F1F5FB", padding: "2px 6px", borderRadius: 5,
                    textTransform: "uppercase", letterSpacing: "0.06em",
                  }}>{sel.label}</span>
                </div>
              </Field>

              {/* EPOCH */}
              <Field label="Epoch">
                <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 14, color: epoch === "—" ? "#8595B5" : "#0A2240" }}>
                  {epoch}
                </span>
              </Field>

              {/* THREAT */}
              <Field label="Threat">
                <div style={{
                  display: "inline-flex", alignItems: "center", gap: 8,
                  padding: "6px 14px", borderRadius: 999,
                  fontFamily: "'JetBrains Mono',monospace", fontSize: 12, fontWeight: 700, letterSpacing: "0.06em",
                  color: isBlocked ? "#DC2626" : "#059669",
                  background: isBlocked ? "rgba(220,38,38,0.09)" : "rgba(5,150,105,0.09)",
                  border: `1px solid ${isBlocked ? "rgba(220,38,38,0.28)" : "rgba(5,150,105,0.28)"}`,
                }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: isBlocked ? "#DC2626" : "#059669", display: "inline-block" }} />
                  {isBlocked ? "YES" : "NO"}
                </div>
              </Field>
            </div>

            {/* MESSAGE */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{
                  fontFamily: "'JetBrains Mono',monospace", fontSize: 10, fontWeight: 600,
                  letterSpacing: "0.14em", textTransform: "uppercase", color: "#8595B5",
                }}>Message</span>
                <button
                  onClick={copyMsg}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    fontFamily: "'Inter',sans-serif", fontSize: 12, fontWeight: 600,
                    color: copiedMsg ? "#059669" : "#2563EB",
                    cursor: "pointer", padding: "4px 10px", borderRadius: 7,
                    background: "none", border: "none",
                  }}
                >
                  {copiedMsg ? "✓ Copied" : "Copy"}
                </button>
              </div>
              <pre style={{
                margin: 0,
                background: "#0B1B36",
                color: "#C9D6EE",
                padding: "16px 18px",
                borderRadius: 12,
                fontFamily: "'JetBrains Mono',monospace",
                fontSize: 13,
                lineHeight: 1.65,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                border: "1px solid rgba(255,255,255,0.07)",
                maxHeight: 340,
                overflowY: "auto",
              }}>
                {sel.input || "—"}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
