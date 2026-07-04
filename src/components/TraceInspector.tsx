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

// ─── Collapsible JSON tree ────────────────────────────────────────────────────

const INDENT = 10;
const GUIDE_COLOR = "rgba(100,116,139,0.28)";

function JsonChildren({ children, closing }: { children: React.ReactNode; closing: string }) {
  return (
    <div style={{ paddingLeft: INDENT, borderLeft: `1.5px solid ${GUIDE_COLOR}`, marginLeft: 4 }}>
      {children}
      <div style={{ lineHeight: "22px", color: "#C9D6EE" }}>{closing}</div>
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
    <span style={{ color: "#7DD3FC", marginRight: 4 }}>&quot;{label}&quot;:</span>
  ) : null;

  if (value === null) {
    return (
      <div style={{ lineHeight: "22px" }}>
        {labelEl}<span style={{ color: "#94A3B8" }}>null</span>
      </div>
    );
  }

  if (typeof value === "boolean") {
    return (
      <div style={{ lineHeight: "22px" }}>
        {labelEl}<span style={{ color: "#FB923C" }}>{String(value)}</span>
      </div>
    );
  }

  if (typeof value === "number") {
    return (
      <div style={{ lineHeight: "22px" }}>
        {labelEl}<span style={{ color: "#86EFAC" }}>{value}</span>
      </div>
    );
  }

  if (typeof value === "string") {
    return (
      <div style={{ lineHeight: "22px", wordBreak: "break-word" }}>
        {labelEl}<span style={{ color: "#FCD34D" }}>&quot;{value}&quot;</span>
      </div>
    );
  }

  if (Array.isArray(value)) {
    const empty = value.length === 0;
    return (
      <div>
        <div
          style={{ lineHeight: "22px", cursor: empty ? "default" : "pointer", userSelect: "none", display: "flex", alignItems: "center", gap: 4 }}
          onClick={() => !empty && setOpen((o) => !o)}
        >
          <span style={{ fontSize: 8, color: "#64748B", display: "inline-block", width: 10, opacity: empty ? 0 : 1, transform: open ? "rotate(90deg)" : "rotate(0deg)", transition: "transform .12s" }}>▶</span>
          {labelEl}
          <span style={{ color: "#C9D6EE" }}>[</span>
          {(!open || empty) && <span style={{ color: "#64748B", fontSize: 11 }}>{empty ? "" : `${value.length} items`}</span>}
          {(!open || empty) && <span style={{ color: "#C9D6EE" }}>]</span>}
        </div>
        {open && !empty && (
          <JsonChildren closing="]">
            {value.map((item, i) => (
              <JsonNode key={i} value={item} depth={depth + 1} defaultOpen={depth < 1} />
            ))}
          </JsonChildren>
        )}
      </div>
    );
  }

  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    const empty = entries.length === 0;
    return (
      <div>
        <div
          style={{ lineHeight: "22px", cursor: empty ? "default" : "pointer", userSelect: "none", display: "flex", alignItems: "center", gap: 4 }}
          onClick={() => !empty && setOpen((o) => !o)}
        >
          <span style={{ fontSize: 8, color: "#64748B", display: "inline-block", width: 10, opacity: empty ? 0 : 1, transform: open ? "rotate(90deg)" : "rotate(0deg)", transition: "transform .12s" }}>▶</span>
          {labelEl}
          <span style={{ color: "#C9D6EE" }}>{"{"}</span>
          {(!open || empty) && <span style={{ color: "#64748B", fontSize: 11 }}>{empty ? "" : `${entries.length} keys`}</span>}
          {(!open || empty) && <span style={{ color: "#C9D6EE" }}>{"}"}</span>}
        </div>
        {open && !empty && (
          <JsonChildren closing="}">
            {entries.map(([k, v]) => (
              <JsonNode key={k} label={k} value={v} depth={depth + 1} defaultOpen={depth < 1} />
            ))}
          </JsonChildren>
        )}
      </div>
    );
  }

  return null;
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
  rawData?: unknown;
}

export function TraceInspector({ trace, openSpanId, onClose, rawData }: TraceInspectorProps) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [selId, setSelId] = useState(openSpanId || trace.trace.id);
  const [tab, setTab] = useState<"simple" | "json">("simple");
  const [copiedMsg, setCopiedMsg] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);

  useEffect(() => { if (openSpanId) setSelId(openSpanId); }, [openSpanId]);
  useEffect(() => {
    setSelId(openSpanId || trace.trace.id);
    setCollapsed({});
  }, [trace]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const rows = useMemo(() => flattenSpans(trace.trace, collapsed), [trace, collapsed]);
  const sel = trace.spanById[selId] || trace.trace;
  const parentSpan = sel.parentId ? trace.spanById[sel.parentId] : null;
  const sKind = spanKind(sel);
  const sColor = KIND_COLOR[sKind] || "#5F73A0";
  const isBlocked = sel.status === "blocked";

  // Epoch: prefer span.epoch, fall back to metadata.epoch, format as readable date
  const epochRaw: number | null = sel.epoch != null
    ? sel.epoch
    : typeof sel.metadata?.epoch === "number"
      ? sel.metadata.epoch as number
      : typeof sel.metadata?.epoch === "string" && !isNaN(Number(sel.metadata.epoch))
        ? Number(sel.metadata.epoch)
        : null;
  const epoch: string = epochRaw != null
    ? new Date(epochRaw * 1000).toLocaleString()
    : "—";

  const toggle = useCallback((id: string) => {
    setCollapsed((c) => ({ ...c, [id]: !c[id] }));
  }, []);

  const copyMsg = () => {
    try { navigator.clipboard.writeText(sel.input); } catch {}
    setCopiedMsg(true);
    setTimeout(() => setCopiedMsg(false), 1500);
  };

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

          {/* LEFT TREE — hidden when JSON tab is active */}
          <div style={{
            width: tab === "json" ? 0 : 360, flexShrink: 0, flexGrow: 0,
            borderRight: tab === "json" ? "none" : "1px solid rgba(15,32,70,0.08)",
            display: tab === "json" ? "none" : "flex", flexDirection: "column",
            background: "#FCFDFF", overflow: "hidden",
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
          <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, background: "#F7F9FD" }}>

            {/* Tab bar + span name */}
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
              <div style={{ display: "flex", gap: 2 }}>
                {(["simple", "json"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    style={{
                      padding: "6px 16px", fontSize: 12.5, fontWeight: 600,
                      fontFamily: "'Inter',sans-serif", cursor: "pointer",
                      border: "none", background: "none",
                      color: tab === t ? "#2563EB" : "#8595B5",
                      borderBottom: tab === t ? "2px solid #2563EB" : "2px solid transparent",
                      textTransform: "capitalize", letterSpacing: "0.01em",
                    }}
                  >{t}</button>
                ))}
              </div>
            </div>

            {/* Panel body */}
            <div style={{ flex: 1, overflowY: "auto", padding: "20px 22px 24px" }}>

              {tab === "simple" && (<>
                {/* fields grid */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px 24px", marginBottom: 16 }}>

                  {(() => {
                    const fromName = typeof sel.metadata?.from === "string" && sel.metadata.from
                      ? sel.metadata.from : parentSpan?.name ?? null;
                    const fromColor = parentSpan ? (KIND_COLOR[spanKind(parentSpan)] || "#5F73A0") : "#0A2240";
                    const fromLabel = parentSpan?.label ?? "";
                    return (
                      <Field label="From">
                        {fromName ? (
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ width: 8, height: 8, borderRadius: "50%", flex: "none", background: fromColor, display: "inline-block" }} />
                            <span style={{ fontFamily: "'Inter',sans-serif", fontSize: 14, fontWeight: 600, color: "#0A2240" }}>{fromName}</span>
                            {fromLabel && (
                              <span style={{
                                fontFamily: "'JetBrains Mono',monospace", fontSize: 9.5, color: "#8595B5",
                                background: "#F1F5FB", padding: "2px 6px", borderRadius: 5,
                                textTransform: "uppercase", letterSpacing: "0.06em",
                              }}>{fromLabel}</span>
                            )}
                          </div>
                        ) : (
                          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13, color: "#8595B5" }}>—</span>
                        )}
                      </Field>
                    );
                  })()}

                  {(() => {
                    const toName = typeof sel.metadata?.to === "string" && sel.metadata.to ? sel.metadata.to : sel.name;
                    return (
                      <Field label="To">
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ width: 8, height: 8, borderRadius: "50%", flex: "none", background: sColor, display: "inline-block" }} />
                          <span style={{ fontFamily: "'Inter',sans-serif", fontSize: 14, fontWeight: 600, color: "#0A2240" }}>{toName}</span>
                          <span style={{
                            fontFamily: "'JetBrains Mono',monospace", fontSize: 9.5, color: "#8595B5",
                            background: "#F1F5FB", padding: "2px 6px", borderRadius: 5,
                            textTransform: "uppercase", letterSpacing: "0.06em",
                          }}>{sel.label}</span>
                        </div>
                      </Field>
                    );
                  })()}

                  <Field label="Epoch">
                    <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 14, color: epoch === "—" ? "#8595B5" : "#0A2240" }}>
                      {epoch}
                    </span>
                  </Field>

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
                    <button onClick={copyMsg} style={{
                      display: "inline-flex", alignItems: "center", gap: 6,
                      fontFamily: "'Inter',sans-serif", fontSize: 12, fontWeight: 600,
                      color: copiedMsg ? "#059669" : "#2563EB",
                      cursor: "pointer", padding: "4px 10px", borderRadius: 7,
                      background: "none", border: "none",
                    }}>{copiedMsg ? "✓ Copied" : "Copy"}</button>
                  </div>
                  <pre style={{
                    margin: 0, background: "#0B1B36", color: "#C9D6EE",
                    padding: "16px 18px", borderRadius: 12,
                    fontFamily: "'JetBrains Mono',monospace", fontSize: 13, lineHeight: 1.65,
                    whiteSpace: "pre-wrap", wordBreak: "break-word",
                    border: "1px solid rgba(255,255,255,0.07)",
                    maxHeight: 340, overflowY: "auto",
                  }}>{sel.input || "—"}</pre>
                </div>
              </>)}

              {tab === "json" && (
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
              )}

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
