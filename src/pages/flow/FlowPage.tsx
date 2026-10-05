import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Icon } from "../../components/Icon";
import { TraceInspector } from "../../components/TraceInspector";
import { useIntent, useIntentInteractions } from "../../data/hooks";
import { useResolveName } from "../../context/DirectoryContext";
import { FlowCanvas } from "./FlowCanvas";
import { buildFlowFromIntent, buildInteractionTrace, flowForPath, intentEnvelope, groupParallelRounds, type Flow, type FlowBranch, type FlowNode } from "./flowData";
import { fetchIntents } from "../../data/api";
import { branchTone } from "./branchPalette";
import type { Intent, Interaction } from "../../types";

const STEP_MS = 2000;
/** One colour per branch (shared with the canvas's lanes); the trunk stays neutral. */
const branchColor = (b?: FlowBranch) => branchTone(b).ui;
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
  // The agents' own envelope chain, from /intent-info's rawData (the same response as above).
  const envelope = useMemo(() => intentEnvelope(interactions), [interactions]);

  const flow: Flow | null = useMemo(() => {
    if (!intent) return null;

    // Always build from the interactions list — it's the only path that
    // classifies participants against the org directory (agent/user/tool)
    // instead of just assuming "intent initiator = human, everyone else =
    // agent" the way the /intent-diagram-based builder used to.
    return buildFlowFromIntent({ intent, interactions, resolve });
  }, [intent, interactions, resolve]);

  // Which path through the branch tree plays: null = every branch, else a leaf branch key
  // (the trunk plus the branches down to it). Resets when the intent changes.
  const [path, setPath] = useState<{ intent: string; leaf: string | null }>({ intent: "", leaf: null });
  const pathLeaf = path.intent === activeId && flow?.branches.some((b) => b.key === path.leaf) ? path.leaf : null;
  const view: Flow | null = useMemo(() => (flow ? flowForPath(flow, pathLeaf) : null), [flow, pathLeaf]);
  const branchByKey = useMemo(() => new Map((flow?.branches ?? []).map((b) => [b.key, b])), [flow]);
  const leaves = useMemo(() => (flow?.branches ?? []).filter((b) => b.leaf), [flow]);
  const pickPath = (leaf: string | null) => {
    setPath({ intent: activeId, leaf });
    setStep(0);
  };

  // The Envelope inspector lists interactions, nested by who called whom. Names come
  // from the flow's resolved nodes so rows match what the canvas and rail show.
  const interactionTrace = useMemo(() => {
    if (!flow) return null;
    const nameByDid = new Map(flow.nodes.filter((n) => n.did).map((n) => [n.did!, n.name]));
    return buildInteractionTrace(flow.intent, interactions, (did) => nameByDid.get(did));
  }, [flow, interactions]);

  // Each interaction row's span id is the interaction id, so the raw-data panel shows
  // the exact same JSON the interaction drawer shows for it.
  const interactionBySpanId = useMemo(
    () => Object.fromEntries(interactions.map((ix) => [ix.id, ix])) as Record<string, Interaction>,
    [interactions],
  );

  const N = view?.steps.length ?? 0;

  // Concurrent hops play as one beat, so playback advances a round at a time.
  // A final beat is appended for the provenance seal — the envelope travelling
  // to the ledger is its own moment, after the last hop has landed. It uses the
  // sentinel index N, which no real step occupies.
  const SEAL_STEP = N;
  const rounds = useMemo(() => {
    const base = groupParallelRounds(view?.steps ?? []);
    if (base.length > 0 && (view?.sealEdges?.length ?? 0) > 0) base.push([SEAL_STEP]);
    return base;
  }, [view, SEAL_STEP]);
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
  /** Playback is held on the current hop: clicking a hop, stepping with the arrow keys, or the bar's toggle. */
  const [held, setHeld] = useState(false);

  // A newly opened intent plays from the start.
  useEffect(() => setHeld(false), [activeId]);

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

  // Auto-advance a round at a time, looping back to the first, unless held.
  // Re-armed on every `step` change, so resuming plays the full dwell on the
  // current hop before moving on.
  useEffect(() => {
    if (held || rounds.length <= 1) return;
    const t = window.setTimeout(() => {
      const next = rounds[(activeRound + 1) % rounds.length];
      if (next) setStep(next[0]);
    }, STEP_MS);
    return () => clearTimeout(t);
  }, [step, activeRound, rounds, held]);

  /** Move a round back or forward (wrapping) and hold there. */
  const stepBy = (delta: 1 | -1) => {
    if (rounds.length === 0) return;
    const next = rounds[(activeRound + delta + rounds.length) % rounds.length];
    if (next) setStep(next[0]);
    setHeld(true);
  };

  // Space holds/resumes; ← → step a hop and hold. Not while typing or while the inspector is open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (inspectSpanId !== null || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(t.tagName))) return;
      if (e.key === " ") {
        e.preventDefault();
        setHeld((h) => !h);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        stepBy(1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        stepBy(-1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

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

  // Clicking a hop holds playback on it; the bar's toggle (or Space) resumes from there.
  const jump = (i: number) => {
    setStep(i);
    setHeld(true);
  };

  return (
    <div className="page flow-page">
      <div className="flow-body">
        {/* Rail */}
        <div className="flow-rail">
          {flow && view && (
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
                        onClick={() => setInspectSpanId(view.steps[step]?.interactionID || interactionTrace?.trace.id || "")}
                      >
                        <Icon name="flow" size={12} />
                        Envelope 
                      </button>
                    </div>
                  </div>
                  {leaves.length > 0 && (
                    <div className="fl-paths" role="group" aria-label="Branch shown">
                      <button type="button" className={pathLeaf == null ? "on" : ""} onClick={() => pickPath(null)}>
                        All branches
                      </button>
                      {leaves.map((b) => (
                        <button
                          key={b.key}
                          type="button"
                          className={pathLeaf === b.key ? "on" : ""}
                          onClick={() => pickPath(b.key)}
                          title={`Play the main path and ${b.name}`}
                        >
                          <span className="fl-swatch" style={{ background: branchColor(b) }} />
                          {b.name.replace(/^Branch /, "")}
                          {b.blocked && <span className="fl-blk" title="Has a blocked hop" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flow-steps" ref={stepsRef}>
                  <div style={{ position: "relative", paddingLeft: 40 }}>
                    {view.steps.map((s, i) => {
                      const from = view.nodeById[s.from];
                      const to = view.nodeById[s.to];
                      const blk = s.verdict === "blocked";
                      const isActive = activeSteps.includes(i);
                      const isLast = i === view.steps.length - 1;
                      const branch = s.branch ? branchByKey.get(s.branch) : undefined;
                      // A branch's first hop gets a fork header; the rail breaks there, since the
                      // next hop in the list isn't a continuation of the previous one.
                      const startsBranch = !!branch && view.steps[i - 1]?.branch !== s.branch;
                      const continues = !isLast && view.steps[i + 1]?.branch === s.branch;
                      // The node ring and connector take the card's own border
                      // colour, so the rail reads as part of the block rather
                      // than a separate green track.
                      const railColor = blk ? "#fecaca" : isActive ? "#93c5fd" : "#e2e8f0";
                      // Ring colour is too light for the numeral, so the digits
                      // use a readable tone of the same hue.
                      const numColor = blk ? "#dc2626" : isActive ? "#2563eb" : "#94a3b8";
                      return (
                        <div key={i}>
                        {startsBranch && branch && (
                          <div className="fl-fork" style={{ ["--br" as string]: branchColor(branch) }}>
                            <Icon name="flow" size={12} />
                            <span className="fl-fork-name">{branch.name}</span>
                            <span className="fl-fork-at">
                              from {branch.parent ? `${branchByKey.get(branch.parent)?.name ?? "branch"} ` : ""}hop {branch.forkAt}
                            </span>
                            {branch.blocked && <span className="fl-fork-blk">Blocked</span>}
                          </div>
                        )}
                        <div
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
                          {continues && (
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
                            {branch && (
                              <div className="fl-hop-tag" style={{ ["--br" as string]: branchColor(branch) }}>
                                <span className="fl-swatch" />
                                {branch.name} · hop {s.label}
                              </div>
                            )}
                            <HopParty label="From" node={from} fallback={s.from} />
                            <div style={{ height: 1, background: "#e9eef5" }} />
                            <HopParty label="To" node={to} fallback={s.to} />
                          </div>
                        </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Step JSON data card */}
              <StepDataCard flow={view} step={step} interactionById={interactionBySpanId} />
            </>
          )}
          {!flow && (
            <div style={{ color: "var(--fg-muted)", fontSize: 14.3, padding: "20px 4px" }}>
              {noIntents ? "No intents recorded yet." : "Loading intent…"}
            </div>
          )}
        </div>

        {/* Canvas */}
        {view ? (
          <FlowCanvas
            flow={view}
            step={Math.min(step, Math.max(0, N - 1))}
            activeSteps={activeSteps}
            sealActive={sealActive}
            playback={{ held, onToggle: () => setHeld((h) => !h), beatMs: STEP_MS, canPlay: rounds.length > 1 }}
          />
        ) : (
          <div className="flow-canvas">
            <div className="flow-empty">
              {noIntents ? "No intents to visualize yet." : "Loading intent…"}
            </div>
          </div>
        )}
      </div>

      {inspectSpanId !== null && interactionTrace && (
        <TraceInspector
          trace={interactionTrace}
          openSpanId={inspectSpanId}
          onClose={() => setInspectSpanId(null)}
          rawData={envelope ?? undefined}
          interactionBySpanId={interactionBySpanId}
          noun={{ one: "interaction", many: "interactions" }}
        />
      )}
    </div>
  );
}

function StepDataCard({ flow, step, interactionById }: { flow: Flow; step: number; interactionById: Record<string, Interaction> }) {
  const s = flow.steps[step];
  if (!s) return null;
  const span = flow.trace.spanById[s.spanId];
  const from = flow.nodeById[s.from];
  const to = flow.nodeById[s.to];
  // This hop's rawData from /intent-info, exactly as the agent sent it — nested parent
  // envelopes included, nothing added or folded. Only a hop without rawData falls back to a
  // summary built from the flow.
  const raw = s.interactionID ? interactionById[s.interactionID]?.raw : undefined;
  const data: unknown =
    raw !== undefined
      ? raw
      : {
          ...(s.label ? { hop: s.label } : {}),
          ...(s.branch ? { branch: flow.branches.find((b) => b.key === s.branch)?.name ?? s.branch } : {}),
          from: from?.name || s.from,
          to: to?.name || s.to,
          verdict: s.verdict,
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
