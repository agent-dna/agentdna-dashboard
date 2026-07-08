import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Icon } from "../../components/Icon";
import { TraceInspector } from "../../components/TraceInspector";
import { useIntent, useIntentBlockData, useIntentDiagram, useIntentInteractions } from "../../data/hooks";
import { useResolveName } from "../../context/DirectoryContext";
import { FlowCanvas } from "./FlowCanvas";
import { buildFlowFromIntent, buildFlowFromDiagram, buildTraceFromBlocks, type Flow } from "./flowData";
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
              <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, background: "#0a2240", borderRadius: 10, overflow: "hidden" }}>
                {/* Sticky header */}
                <div style={{ flexShrink: 0, borderBottom: "1px solid rgba(255,255,255,0.1)", padding: "10px 14px", background: "#0a2240" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#f1f5f9", marginBottom: 2 }}>Interaction Timeline</div>
                      <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", color: "#94a3b8" }}>
                        {N} Hops · Sequential
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
                        Data
                      </button>
                    </div>
                  </div>
                </div>
                <div className="flow-steps" ref={stepsRef}>
                  <div style={{ position: "relative", paddingLeft: 32 }}>
                    {/* Vertical timeline line */}
                    <div style={{
                      position: "absolute",
                      left: 9,
                      top: 16,
                      bottom: 16,
                      width: 2,
                      background: "rgba(255,255,255,0.15)",
                      borderRadius: 2,
                    }} />

                    {flow.steps.map((s, i) => {
                      const from = flow.nodeById[s.from];
                      const to = flow.nodeById[s.to];
                      const blk = s.verdict === "blocked";
                      const isActive = i === step;
                      return (
                        <div
                          key={i}
                          data-step={i}
                          onClick={() => jump(i)}
                          style={{ position: "relative", marginBottom: 7, cursor: "pointer" }}
                        >
                          {/* Timeline dot — outlined circle */}
                          <div style={{
                            position: "absolute",
                            left: -26,
                            top: 14,
                            width: 16,
                            height: 16,
                            borderRadius: "50%",
                            background: "#0a2240",
                            border: `2.5px solid ${blk ? "#ef4444" : "#22c55e"}`,
                            boxSizing: "border-box",
                          }} />

                          {/* Card */}
                          <div style={{
                            borderRadius: 10,
                            border: `1.5px solid ${blk ? "#fca5a5" : isActive ? "#93c5fd" : "#e2e8f0"}`,
                            background: blk ? "#fff5f5" : isActive ? "#eff6ff" : "#ffffff",
                            padding: "6px 9px",
                            transition: "background 0.15s, border-color 0.15s",
                          }}>
                            {/* Header row */}
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                              <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#64748b" }}>
                                Hop {String(i + 1).padStart(2, "0")}
                              </span>
                              {blk ? (
                                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "#dc2626", background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 20, padding: "2px 8px", display: "flex", alignItems: "center", gap: 4 }}>
                                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#dc2626", display: "inline-block" }} />
                                  Threat Detected
                                </span>
                              ) : (
                                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "#16a34a", background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 20, padding: "2px 8px", display: "flex", alignItems: "center", gap: 4 }}>
                                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", display: "inline-block" }} />
                                  Allowed
                                </span>
                              )}
                            </div>

                            {/* FROM row */}
                            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 3 }}>
                              <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "#94a3b8", width: 24, flexShrink: 0 }}>From</span>
                              <HopNode name={from?.name || s.from} />
                            </div>

                            {/* TO row */}
                            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                              <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "#94a3b8", width: 24, flexShrink: 0 }}>To</span>
                              <HopNode name={to?.name || s.to} />
                            </div>
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

function HopNode({ name, dark }: { name: string; dark?: boolean }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#2563eb", flexShrink: 0 }} />
      <span style={{ fontSize: 11, fontWeight: 700, color: dark ? "#e2e8f0" : "var(--fg)" }}>{name}</span>
    </span>
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
