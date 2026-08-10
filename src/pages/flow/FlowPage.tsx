import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Icon } from "../../components/Icon";
import { TraceInspector } from "../../components/TraceInspector";
import { useIntent, useIntentBlockData, useIntentDiagram, useIntentInteractions } from "../../data/hooks";
import { useResolveName } from "../../context/DirectoryContext";
import { FlowCanvas } from "./FlowCanvas";
import { buildFlowFromIntent, buildFlowFromDiagram, buildTraceFromBlocks, type Flow, type FlowNode } from "./flowData";
import { flattenIntentBlocks } from "../../data/api";

const STEP_MS = 2400;
const STORAGE_KEY_STEP = "flow.step";

export function FlowPage() {
  const { intentId: paramId } = useParams<{ intentId: string }>();
  const resolve = useResolveName();
  const activeId = paramId || "";

  const { data: intent } = useIntent(activeId);
  const { data: interactions } = useIntentInteractions(activeId);
  const { data: blocks } = useIntentBlockData(activeId);
  const { data: diagram } = useIntentDiagram(activeId);

  const flow: Flow | null = useMemo(() => {
    if (!intent) return null;

    // Diagram endpoint takes priority — it has real messages and correct tree structure.
    // Do NOT override its trace with blocks; blocks use fake placeholder messages.
    if (diagram) {
      return buildFlowFromDiagram(intent, diagram);
    }
    // Fallback: build from interactions list.
    const base = buildFlowFromIntent({ intent, interactions, resolve });
    if (blocks) {
      const flat = flattenIntentBlocks(blocks);
      if (flat.length > 0) base.trace = buildTraceFromBlocks(intent, flat);
    }
    return base;
  }, [intent, interactions, blocks, diagram, resolve]);

  const N = flow?.steps.length ?? 0;

  const [step, setStep] = useState<number>(() => {
    const raw = readStored(STORAGE_KEY_STEP);
    const n = raw ? parseInt(raw, 10) : NaN;
    return Number.isFinite(n) && n >= 0 ? n : 0;
  });
  const [playing, setPlaying] = useState(false);
  const [inspectSpanId, setInspectSpanId] = useState<string | null>(null);

  // Clamp step when flow changes
  useEffect(() => {
    if (N === 0) return;
    setStep((s) => Math.min(s, N - 1));
  }, [activeId, N]);

  useEffect(() => {
    writeStored(STORAGE_KEY_STEP, String(step));
  }, [step]);

  // Auto-play loop
  useEffect(() => {
    if (!playing || N === 0) return;
    const t = window.setTimeout(() => {
      setStep((s) => (s + 1) % N);
    }, STEP_MS);
    return () => clearTimeout(t);
  }, [playing, step, N]);

  const stepsRef = useRef<HTMLDivElement>(null);

  // Auto-scroll active step into view inside the rail
  useEffect(() => {
    const list = stepsRef.current;
    if (!list) return;
    const card = list.querySelector(`[data-step="${step}"]`) as HTMLElement | null;
    if (card) {
      const top = card.offsetTop - list.offsetTop - 60;
      list.scrollTo({ top, behavior: "smooth" });
    }
  }, [step]);

  const jump = (i: number) => {
    setPlaying(false);
    setStep(i);
  };

  return (
    <div className="page flow-page">
      <div className="flow-body">
        {/* Rail */}
        <div className="flow-rail">
          {flow && (
            <>
              {/* Trace section — sticky header + scrollable hops */}
              <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, background: "#ffffff", borderRadius: 10, overflow: "hidden", border: "1px solid #e2e8f0" }}>
                {/* Sticky header */}
                <div style={{ flexShrink: 0, borderBottom: "1px solid #e2e8f0", padding: "14px 16px 12px", background: "#ffffff" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                    <div>
                      <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: "-0.02em", color: "#0f172a", marginBottom: 3 }}>
                        Interaction Timeline
                      </div>
                      <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase", color: "#94a3b8" }}>
                        {N} Hop{N === 1 ? "" : "s"}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      {(() => { const threats = flow.steps.filter(s => s.verdict === "blocked").length; return threats > 0 ? (
                        <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "#dc2626", background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 20, padding: "3px 10px" }}>
                          {threats} Threat{threats > 1 ? "s" : ""}
                        </span>
                      ) : null; })()}
                      <button
                        className="sl-data-btn"
                        title="Inspect trace data"
                        onClick={() => setInspectSpanId(flow.steps[step]?.spanId || flow.trace.trace.id)}
                      >
                        <Icon name="flow" size={12} />
                        Envelope 
                      </button>
                    </div>
                  </div>
                </div>
                <div className="flow-steps" ref={stepsRef}>
                  <div style={{ position: "relative", paddingLeft: 54 }}>
                    {flow.steps.map((s, i) => {
                      const from = flow.nodeById[s.from];
                      const to = flow.nodeById[s.to];
                      const blk = s.verdict === "blocked";
                      const isActive = i === step;
                      const isLast = i === flow.steps.length - 1;
                      const accent = blk ? "#ef4444" : "#22c55e";
                      return (
                        <div
                          key={i}
                          data-step={i}
                          onClick={() => jump(i)}
                          style={{ position: "relative", marginBottom: isLast ? 4 : 14, cursor: "pointer" }}
                        >
                          {/* Numbered timeline node + connector down to the next hop */}
                          <div style={{
                            position: "absolute",
                            left: -54,
                            top: 12,
                            width: 38,
                            display: "flex",
                            justifyContent: "center",
                          }}>
                            <span style={{
                              width: 34,
                              height: 34,
                              borderRadius: "50%",
                              background: "#ffffff",
                              border: `2px solid ${accent}`,
                              boxShadow: `0 0 0 4px ${blk ? "rgba(239,68,68,0.10)" : "rgba(34,197,94,0.12)"}`,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontFamily: "var(--font-mono)",
                              fontSize: 12,
                              fontWeight: 700,
                              color: accent,
                              boxSizing: "border-box",
                            }}>
                              {String(i + 1).padStart(2, "0")}
                            </span>
                          </div>
                          {!isLast && (
                            <div style={{
                              position: "absolute",
                              left: -36,
                              top: 46,
                              // Reaches past the 14px gap plus the next node's
                              // 12px top offset so the rail reads as continuous.
                              bottom: -26,
                              width: 2,
                              background: accent,
                              opacity: 0.55,
                              borderRadius: 2,
                            }} />
                          )}

                          {/* Card */}
                          <div style={{
                            borderRadius: 12,
                            border: `1.5px solid ${blk ? "#fecaca" : isActive ? "#86efac" : "#e2e8f0"}`,
                            background: blk ? "#fff8f8" : isActive ? "#f6fefa" : "#fbfcfe",
                            padding: "12px 14px 4px",
                            transition: "background 0.15s, border-color 0.15s",
                          }}>
                            {/* Header row */}
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 10 }}>
                              <span style={{
                                fontSize: 11,
                                fontWeight: 800,
                                letterSpacing: "0.07em",
                                textTransform: "uppercase",
                                color: blk ? "#b91c1c" : isActive ? "#15803d" : "#1e40af",
                                background: blk ? "#fee2e2" : isActive ? "#dcfce7" : "#eef2ff",
                                borderRadius: 8,
                                padding: "6px 12px",
                              }}>
                                Hop {String(i + 1).padStart(2, "0")}
                              </span>
                              <span style={{
                                fontSize: 11,
                                fontWeight: 800,
                                letterSpacing: "0.06em",
                                textTransform: "uppercase",
                                color: blk ? "#dc2626" : "#16a34a",
                                background: blk ? "#fef2f2" : "#f0fdf4",
                                border: `1px solid ${blk ? "#fca5a5" : "#bbf7d0"}`,
                                borderRadius: 20,
                                padding: "5px 12px",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 6,
                                whiteSpace: "nowrap",
                              }}>
                                <span style={{ width: 7, height: 7, borderRadius: "50%", background: blk ? "#dc2626" : "#22c55e" }} />
                                {blk ? "Threat Detected" : "Allowed"}
                              </span>
                            </div>

                            <HopParty label="From" node={from} fallback={s.from} />
                            <div style={{ height: 1, background: "#e9eef5", margin: "0 0 0 0" }} />
                            <HopParty label="To" node={to} fallback={s.to} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Step JSON data card */}
              <StepDataCard flow={flow} step={step} />
            </>
          )}
          {!flow && (
            <div style={{ color: "var(--fg-muted)", fontSize: 13, padding: "20px 4px" }}>
              No intent selected.
            </div>
          )}
        </div>

        {/* Canvas */}
        {flow ? (
          <FlowCanvas flow={flow} step={Math.min(step, Math.max(0, N - 1))} />
        ) : (
          <div className="flow-canvas">
            <div className="flow-empty">Pick an intent to visualize.</div>
          </div>
        )}
      </div>

      {inspectSpanId !== null && flow && (
        <TraceInspector
          trace={flow.trace}
          openSpanId={inspectSpanId}
          onClose={() => setInspectSpanId(null)}
          rawData={blocks}
        />
      )}
    </div>
  );
}

function StepDataCard({ flow, step }: { flow: Flow; step: number }) {
  const s = flow.steps[step];
  if (!s) return null;
  const span = flow.trace.spanById[s.spanId];
  const from = flow.nodeById[s.from];
  const to = flow.nodeById[s.to];

  const data: Record<string, unknown> = {
    from: from?.name || s.from,
    to: to?.name || s.to,
    direction: s.dir,
    verdict: s.verdict,
    checks: s.checks,
    ...(span?.input ? { input: tryParse(span.input) } : {}),
    ...(span?.output ? { output: tryParse(span.output) } : {}),
    ...(span?.model ? { model: span.model } : {}),
    ...(span?.metadata && Object.keys(span.metadata).length > 0 ? { metadata: span.metadata } : {}),
  };

  return (
    <div style={{
      margin: "12px 0 4px",
      borderRadius: 10,
      border: "1px solid var(--border)",
      background: "var(--bg-card)",
      overflow: "hidden",
    }}>
      {/* <div style={{
        padding: "8px 12px",
        fontSize: 11,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.07em",
        color: "var(--fg-muted)",
        borderBottom: "1px solid var(--border)",
        background: "var(--bg)",
        borderRadius: "10px 10px 0 0",
      }}>
        Hop #{String(step + 1).padStart(2, "0")} · Data
      </div> */}
      <pre style={{
        margin: 0,
        padding: "12px",
        fontSize: 11.5,
        fontFamily: "var(--font-mono)",
        background: "#0f172a",
        whiteSpace: "pre-wrap",
        wordBreak: "break-all",
        maxHeight: 320,
        overflowY: "auto",
        lineHeight: 1.6,
      }}
        dangerouslySetInnerHTML={{ __html: colorizeJson(JSON.stringify(data, null, 2)) }}
      />
    </div>
  );
}

function tryParse(s: string): unknown {
  try { return JSON.parse(s); } catch { return s; }
}

function colorizeJson(json: string): string {
  return json
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(
      /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
      (match) => {
        if (/^"/.test(match)) {
          if (/:$/.test(match)) {
            // key
            return `<span style="color:#7dd3fc">${match}</span>`;
          }
          // string value
          return `<span style="color:#86efac">${match}</span>`;
        }
        if (/true|false/.test(match)) {
          return `<span style="color:#fbbf24">${match}</span>`;
        }
        if (/null/.test(match)) {
          return `<span style="color:#f87171">${match}</span>`;
        }
        // number
        return `<span style="color:#c084fc">${match}</span>`;
      },
    );
}

/** One FROM/TO row: label, avatar, name over DID, copy action. */
function HopParty({ label, node, fallback }: { label: string; node?: FlowNode; fallback: string }) {
  const name = node?.name || fallback;
  const did = node?.did || "";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0" }}>
      <span style={{
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.07em",
        textTransform: "uppercase",
        color: "#94a3b8",
        width: 34,
        flexShrink: 0,
      }}>
        {label}
      </span>

      <span style={{
        width: 30,
        height: 30,
        borderRadius: "50%",
        background: "#e6ecfb",
        color: "#4b6bdd",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}>
        <Icon name="user" size={15} />
      </span>

      <span style={{ display: "flex", flexDirection: "column", minWidth: 0, flex: 1, gap: 1 }}>
        <span style={{
          fontSize: 12.5,
          fontWeight: 700,
          color: "#0f172a",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}>
          {truncateMiddle(name, 22)}
        </span>
        {did && (
          <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "#94a3b8", whiteSpace: "nowrap" }}>
            {truncateMiddle(did, 18)}
          </span>
        )}
      </span>

      {did && <CopyButton text={did} />}
    </div>
  );
}

/** `0x1a2b3c4d5e6f7c9d` → `0x1a2b…7c9d` */
function truncateMiddle(value: string, max: number): string {
  if (!value || value.length <= max) return value;
  const head = Math.ceil((max - 1) * 0.6);
  const tail = max - 1 - head;
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = (e: React.MouseEvent) => {
    // The whole hop card is a jump target — don't change step just to copy.
    e.stopPropagation();
    try {
      navigator.clipboard.writeText(text).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      });
    } catch {
      // clipboard unavailable — ignore
    }
  };
  return (
    <button
      onClick={copy}
      title={copied ? "Copied!" : "Copy DID"}
      style={{
        flexShrink: 0,
        width: 30,
        height: 30,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#ffffff",
        border: "1px solid #e2e8f0",
        borderRadius: 8,
        cursor: "pointer",
        color: copied ? "#16a34a" : "#64748b",
        transition: "color 120ms, border-color 120ms",
      }}
    >
      <Icon name={copied ? "check" : "copy"} size={14} />
    </button>
  );
}

function readStored(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStored(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore
  }
}
