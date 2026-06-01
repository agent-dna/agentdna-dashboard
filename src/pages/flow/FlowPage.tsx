import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Icon } from "../../components/Icon";
import { useIntent, useIntentInteractions, useIntents } from "../../data/hooks";
import { useResolveName } from "../../context/DirectoryContext";
import { FlowCanvas } from "./FlowCanvas";
import { buildFlowFromIntent, type Flow } from "./flowData";

const STEP_MS = 2400;
const STORAGE_KEY_INTENT = "flow.intent";
const STORAGE_KEY_STEP = "flow.step";

export function FlowPage() {
  const { intentId: paramId } = useParams<{ intentId: string }>();
  const navigate = useNavigate();
  const resolve = useResolveName();

  const intentsState = useIntents();
  const intents = intentsState.data;

  const fallbackId = !paramId && intents.length > 0 ? intents[0].id : undefined;
  const activeId = paramId || readStored(STORAGE_KEY_INTENT) || fallbackId || "";

  useEffect(() => {
    if (!paramId && activeId) {
      navigate(`/graph/${activeId}`, { replace: true });
    }
  }, [paramId, activeId, navigate]);

  useEffect(() => {
    if (activeId) writeStored(STORAGE_KEY_INTENT, activeId);
  }, [activeId]);

  const { data: intent } = useIntent(activeId);
  const { data: interactions } = useIntentInteractions(activeId);

  const flow: Flow | null = useMemo(() => {
    if (!intent) return null;
    return buildFlowFromIntent({ intent, interactions, resolve });
  }, [intent, interactions, resolve]);

  const N = flow?.steps.length ?? 0;

  const [step, setStep] = useState<number>(() => {
    const raw = readStored(STORAGE_KEY_STEP);
    const n = raw ? parseInt(raw, 10) : NaN;
    return Number.isFinite(n) && n >= 0 ? n : 0;
  });
  const [playing, setPlaying] = useState(true);
  const [copied, setCopied] = useState(false);

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

  const copyHash = () => {
    if (!flow) return;
    try {
      navigator.clipboard.writeText(flow.intentId);
    } catch {
      // ignore
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  };

  return (
    <div className="page flow-page">
      <div className="flow-body">
        {/* Rail */}
        <div className="flow-rail">
          {flow && (
            <>
              <div className="flow-intent-card">
                <div className="ic-cap">Intent</div>
                <div className="ic-name">{flow.intent.name || "Intent"}</div>
                <div className="ic-row">
                  <span className="ic-hash" onClick={copyHash}>
                    {copied ? (
                      <span className="ck">
                        <Icon name="check" size={12} />
                      </span>
                    ) : (
                      <Icon name="copy" size={12} />
                    )}
                    {copied ? "copied" : shortHashTail(flow.intentId)}
                  </span>
                  {flow.status === "halted" ? (
                    <span className="chip threat">
                      <span className="dot-status threat" /> halted
                    </span>
                  ) : (
                    <span className="chip safe">
                      <span className="dot-status safe" /> completed
                    </span>
                  )}
                </div>
                <div className="ic-stats">
                  <div className="ic-stat">
                    <div className="v">{flow.nodes.filter((n) => n.kind === "agent").length}</div>
                    <div className="k">Agents</div>
                  </div>
                  <div className="ic-stat">
                    <div className="v">{flow.nodes.filter((n) => n.kind === "tool").length}</div>
                    <div className="k">Tools</div>
                  </div>
                  <div className="ic-stat">
                    <div className="v">{N}</div>
                    <div className="k">Hops</div>
                  </div>
                </div>
              </div>

              <div className="flow-steps" ref={stepsRef}>
                <div className="sl-cap">Trace · {N} hops</div>
                {flow.steps.map((s, i) => {
                  const from = flow.nodeById[s.from];
                  const to = flow.nodeById[s.to];
                  const blk = s.verdict === "blocked";
                  const verified = s.checks.identity && s.checks.trust;
                  return (
                    <div
                      key={i}
                      data-step={i}
                      className={`step-card ${i === step ? "active" : ""} ${i < step ? "done" : ""} ${blk ? "blk" : ""}`}
                      onClick={() => jump(i)}
                    >
                      <div className="sc-body">
                        <div className="sc-pair">
                          <span className="sc-ix">#{String(i + 1).padStart(2, "0")}</span>
                          <NodeChip kind={from?.kind || "agent"} name={from?.name || s.from} />
                          <span className={`arr ${s.dir === "response" ? "ret" : ""}`}>
                            {s.dir === "response" ? "←" : "→"}
                          </span>
                          <NodeChip kind={to?.kind || "agent"} name={to?.name || s.to} />
                        </div>
                        <div className="sc-meta">
                          {verified && (
                            <span className="sc-tag verified" title="Identity & trust verified">
                              <Icon name="shield" size={10} />
                              Verified
                            </span>
                          )}
                          {blk ? (
                            <span className="sc-tag threat">
                              <span className="sc-dot" />
                              Threat
                            </span>
                          ) : (
                            <span className="sc-tag allowed">
                              <span className="sc-dot" />
                              Allowed
                            </span>
                          )}
                          <span className="sc-lat">{s.latency}ms</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
          {!flow && (
            <div style={{ color: "var(--fg-muted)", fontSize: 13, padding: "20px 4px" }}>
              {intentsState.loading ? "Loading intents…" : "No intent selected."}
            </div>
          )}
        </div>

        {/* Canvas */}
        {flow ? (
          <FlowCanvas flow={flow} step={Math.min(step, Math.max(0, N - 1))} />
        ) : (
          <div className="flow-canvas">
            <div className="flow-empty">{intentsState.loading ? "Loading flow…" : "Pick an intent to visualize."}</div>
          </div>
        )}
      </div>
    </div>
  );
}

function NodeChip({ kind, name }: { kind: "human" | "agent" | "tool"; name: string }) {
  const bg = kind === "human" ? "#0A2240" : kind === "tool" ? "#0EA5E9" : "#2563EB";
  return (
    <span className={`node ${kind}`} title={name}>
      <span className="nd" style={{ background: bg }} />
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
    </span>
  );
}

function shortHashTail(id: string): string {
  const parts = id.split("_");
  const tail = parts.length > 1 ? parts.slice(1).join("_") : id;
  return tail.slice(0, 10);
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
