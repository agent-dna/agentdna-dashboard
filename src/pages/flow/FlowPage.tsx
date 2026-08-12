import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Icon } from "../../components/Icon";
import { TraceInspector } from "../../components/TraceInspector";
import { useIntent, useIntentBlockData, useIntentDiagram, useIntentInteractions } from "../../data/hooks";
import { useResolveName } from "../../context/DirectoryContext";
import { FlowCanvas } from "./FlowCanvas";
import { buildFlowFromIntent, buildFlowFromDiagram, buildTraceFromBlocks, groupParallelRounds, type Flow, type FlowNode } from "./flowData";
import { fetchIntents, flattenIntentBlocks } from "../../data/api";
import type { Intent } from "../../types";

const STEP_MS = 2000;
const STORAGE_KEY_STEP = "flow.step";

export function FlowPage() {
  const { intentId: paramId } = useParams<{ intentId: string }>();
  const navigate = useNavigate();
  const resolve = useResolveName();
  const activeId = paramId || "";

  // Landing on /graph with no intent in the URL: fall through to the caller's
  // most recent intent. /intent-list is scoped by the auth token, so a user and
  // an admin each land on their own latest flow.
  // Only ever set from an async callback — nothing is set synchronously here,
  // so this doesn't cascade renders on mount.
  const [noIntents, setNoIntents] = useState(false);

  useEffect(() => {
    if (paramId) return;
    let cancelled = false;
    fetchIntents(1)
      .then((list) => {
        if (cancelled) return;
        // `started` is minutes-ago, so the smallest value is the newest intent.
        const latest = list.reduce<Intent | null>(
          (best, i) => (best === null || i.started < best.started ? i : best),
          null,
        );
        if (latest) navigate(`/graph/${encodeURIComponent(latest.id)}`, { replace: true });
        else setNoIntents(true);
      })
      .catch(() => {
        if (!cancelled) setNoIntents(true);
      });
    return () => { cancelled = true; };
  }, [paramId, navigate]);

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

  // Concurrent hops play as one beat, so playback advances a round at a time.
  // A final beat is appended for the provenance seal — the envelope travelling
  // to the ledger is its own moment, after the last hop has landed. It uses the
  // sentinel index N, which no real step occupies.
  const SEAL_STEP = N;
  const rounds = useMemo(() => {
    const base = groupParallelRounds(flow?.steps ?? []);
    if (base.length > 0 && (flow?.sealEdges?.length ?? 0) > 0) base.push([SEAL_STEP]);
    return base;
  }, [flow, SEAL_STEP]);
  const roundOfStep = useMemo(() => {
    const m = new Map<number, number>();
    rounds.forEach((r, ri) => r.forEach((si) => m.set(si, ri)));
    return m;
  }, [rounds]);

  const [step, setStep] = useState<number>(() => {
    const raw = readStored(STORAGE_KEY_STEP);
    const n = raw ? parseInt(raw, 10) : NaN;
    return Number.isFinite(n) && n >= 0 ? n : 0;
  });
  const [inspectSpanId, setInspectSpanId] = useState<string | null>(null);

  // Clamp step when flow changes
  useEffect(() => {
    if (N === 0) return;
    setStep((s) => Math.min(s, N - 1));
  }, [activeId, N]);

  useEffect(() => {
    writeStored(STORAGE_KEY_STEP, String(step));
  }, [step]);

  const activeRound = roundOfStep.get(step) ?? 0;
  const roundSteps = rounds[activeRound] ?? (N > 0 ? [step] : []);
  const sealActive = roundSteps.includes(SEAL_STEP);
  const activeSteps = roundSteps.filter((i) => i < N);

  // Auto-advance a round at a time, looping back to the first.
  // Re-armed on every `step` change, so clicking a hop restarts the dwell
  // from there rather than cutting it short.
  useEffect(() => {
    if (rounds.length <= 1) return;
    const t = window.setTimeout(() => {
      const next = rounds[(activeRound + 1) % rounds.length];
      if (next) setStep(next[0]);
    }, STEP_MS);
    return () => clearTimeout(t);
  }, [step, activeRound, rounds]);

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
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                    <div style={{ fontSize: 13.6, fontWeight: 800, letterSpacing: "-0.02em", color: "#0f172a" }}>
                      Interaction Timeline
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
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
                  <div style={{ position: "relative", paddingLeft: 40 }}>
                    {flow.steps.map((s, i) => {
                      const from = flow.nodeById[s.from];
                      const to = flow.nodeById[s.to];
                      const blk = s.verdict === "blocked";
                      const isActive = activeSteps.includes(i);
                      const isLast = i === flow.steps.length - 1;
                      // The node ring and connector take the card's own border
                      // colour, so the rail reads as part of the block rather
                      // than a separate green track.
                      const railColor = blk ? "#fecaca" : isActive ? "#93c5fd" : "#e2e8f0";
                      // Ring colour is too light for the numeral, so the digits
                      // use a readable tone of the same hue.
                      const numColor = blk ? "#dc2626" : isActive ? "#2563eb" : "#94a3b8";
                      return (
                        <div
                          key={i}
                          data-step={i}
                          onClick={() => jump(i)}
                          style={{ position: "relative", marginBottom: isLast ? 3 : 10, cursor: "pointer" }}
                        >
                          {/* Numbered timeline node + connector down to the next hop */}
                          <div style={{
                            position: "absolute",
                            left: -40,
                            top: 9,
                            width: 28,
                            display: "flex",
                            justifyContent: "center",
                          }}>
                            <span style={{
                              width: 26,
                              height: 26,
                              borderRadius: "50%",
                              background: "#ffffff",
                              border: `1.5px solid ${railColor}`,
                              // Glow ring plus a small drop shadow, so the node
                              // sits above the rail like the cards do.
                              boxShadow: `0 0 0 3px ${blk ? "rgba(239,68,68,0.09)" : isActive ? "rgba(37,99,235,0.10)" : "rgba(15,32,70,0.05)"}, 0 2px 6px rgba(15,32,70,0.28)`,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontFamily: "var(--font-mono)",
                              fontSize: 11,
                              fontWeight: 800,
                              color: numColor,
                              boxSizing: "border-box",
                            }}>
                              {String(i + 1).padStart(2, "0")}
                            </span>
                          </div>
                          {!isLast && (
                            <div style={{
                              position: "absolute",
                              left: -27,
                              top: 35,
                              // Reaches past the 10px gap plus the next node's
                              // 9px top offset so the rail reads as continuous.
                              bottom: -19,
                              width: 2,
                              background: railColor,
                              borderRadius: 2,
                            }} />
                          )}

                          {/* Card */}
                          <div style={{
                            borderRadius: 9,
                            // Blue marks selection; red/green stay reserved for verdict.
                            border: `1.5px solid ${blk ? "#fecaca" : isActive ? "#93c5fd" : "#e2e8f0"}`,
                            background: blk ? "#fff8f8" : isActive ? "#f2f7ff" : "#fbfcfe",
                            padding: "9px 10px 3px",
                            // Layered shadow for depth: a tight contact shadow, a
                            // softer ambient one, and an inset top highlight so the
                            // card reads as lifted rather than just outlined. The
                            // active card lifts further and tints its shadow.
                            boxShadow: blk
                              ? "inset 0 1px 0 rgba(255,255,255,0.7), 0 1px 3px rgba(120,20,20,0.20), 0 5px 14px rgba(120,20,20,0.18)"
                              : isActive
                              ? "inset 0 1px 0 rgba(255,255,255,0.9), 0 2px 5px rgba(37,99,235,0.26), 0 9px 22px rgba(37,99,235,0.24)"
                              : "inset 0 1px 0 rgba(255,255,255,0.9), 0 1px 3px rgba(15,32,70,0.16), 0 5px 14px rgba(15,32,70,0.14)",
                            transform: isActive ? "translateY(-1px)" : "translateY(0)",
                            transition: "background 0.15s, border-color 0.15s, box-shadow 0.18s, transform 0.18s",
                          }}>
                            {/* No status pill — verdict reads from the node colour,
                                the card border, and the header threat count. */}
                            <HopParty label="From" node={from} fallback={s.from} />
                            <div style={{ height: 1, background: "#e9eef5" }} />
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
            <div style={{ color: "var(--fg-muted)", fontSize: 14.3, padding: "20px 4px" }}>
              {noIntents ? "No intents recorded yet." : "Loading intent…"}
            </div>
          )}
        </div>

        {/* Canvas */}
        {flow ? (
          <FlowCanvas
            flow={flow}
            step={Math.min(step, Math.max(0, N - 1))}
            activeSteps={activeSteps}
            sealActive={sealActive}
          />
        ) : (
          <div className="flow-canvas">
            <div className="flow-empty">
              {noIntents ? "No intents to visualize yet." : "Loading intent…"}
            </div>
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
    <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "7px 0" }}>
      <span style={{
        fontSize: 9.1,
        fontWeight: 800,
        letterSpacing: "0.07em",
        textTransform: "uppercase",
        color: "#94a3b8",
        width: 26,
        flexShrink: 0,
      }}>
        {label}
      </span>

      <span style={{
        width: 22,
        height: 22,
        borderRadius: "50%",
        background: "#e6ecfb",
        color: "#4b6bdd",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}>
        <Icon name="user" size={11} />
      </span>

      <span style={{ display: "flex", flexDirection: "column", minWidth: 0, flex: 1, gap: 1 }}>
        <span style={{
          fontSize: 11.3,
          fontWeight: 800,
          color: "#0f172a",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}>
          {truncateMiddle(name, 22)}
        </span>
        {did && (
          <span style={{ fontSize: 10, fontWeight: 600, fontFamily: "var(--font-mono)", color: "#8494ab", whiteSpace: "nowrap" }}>
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
        width: 22,
        height: 22,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#ffffff",
        border: "1px solid #e2e8f0",
        borderRadius: 6,
        cursor: "pointer",
        color: copied ? "#16a34a" : "#64748b",
        transition: "color 120ms, border-color 120ms",
      }}
    >
      <Icon name={copied ? "check" : "copy"} size={11} />
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
