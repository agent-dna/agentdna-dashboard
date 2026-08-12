import { useEffect, useMemo, useRef, useState } from "react";
import {
  User,
  Bot,
  LayoutGrid,
  GitBranch,
  Database,
  Mail,
  Terminal,
  Globe,
  Cloud,
  Server,
  MessageSquare,
  Webhook,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import type { Flow, FlowNode } from "./flowData";

const NODE_DOT = { human: "#1E3A8A", agent: "#2563EB", tool: "#0EA5E9" } as const;

/** Keyword → icon for known app/tool integrations (matched against the node name). */
const APP_ICON_RULES: [RegExp, LucideIcon][] = [
  [/git(hub|lab)?/i, GitBranch],
  [/slack|discord|teams|chat/i, MessageSquare],
  [/mail|gmail|outlook|smtp/i, Mail],
  [/sql|postgres|mysql|mongo|database|db\b/i, Database],
  [/terminal|shell|bash|cli/i, Terminal],
  [/aws|gcp|azure|s3|cloud/i, Cloud],
  [/server|api|backend/i, Server],
  [/webhook/i, Webhook],
  [/web|browser|http|site/i, Globe],
];

function appIconFor(name: string): LucideIcon {
  for (const [re, Ic] of APP_ICON_RULES) {
    if (re.test(name)) return Ic;
  }
  return LayoutGrid;
}

function NodeIcon({ node }: { node: FlowNode }) {
  if (node.kind === "human") return <User size={20} strokeWidth={2.2} />;
  if (node.kind === "agent") return <Bot size={20} strokeWidth={2.2} />;
  if (node.kind === "provenance") return <ShieldCheck size={20} strokeWidth={2.2} />;
  const Ic = appIconFor(node.name);
  return <Ic size={19} strokeWidth={2.2} />;
}

interface Point {
  x: number;
  y: number;
}

function useElementSize<T extends HTMLElement>(ref: React.RefObject<T | null>) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const apply = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return size;
}

function qbez(p0: Point, c: Point, p1: Point, t: number): Point {
  const mt = 1 - t;
  return {
    x: mt * mt * p0.x + 2 * mt * t * c.x + t * t * p1.x,
    y: mt * mt * p0.y + 2 * mt * t * c.y + t * t * p1.y,
  };
}

/**
 * Control point for the arc between two nodes.
 *
 * `bow` scales how far the curve bulges out. Repeated interactions between the
 * same pair pass different values so each hop gets its own visible arc instead
 * of stacking on one path.
 */
function ctrlFor(a: Point, b: Point, bow = 1): Point {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const off = Math.min(40, len * 0.12) * bow;
  return { x: mx + (-dy / len) * off, y: my + (dx / len) * off };
}

function trimEnds(a: Point, c: Point, b: Point, dStart: number, dEnd: number) {
  const s0x = c.x - a.x;
  const s0y = c.y - a.y;
  const l0 = Math.hypot(s0x, s0y) || 1;
  const s1x = b.x - c.x;
  const s1y = b.y - c.y;
  const l1 = Math.hypot(s1x, s1y) || 1;
  return {
    a: { x: a.x + (s0x / l0) * dStart, y: a.y + (s0y / l0) * dStart },
    b: { x: b.x - (s1x / l1) * dEnd, y: b.y - (s1y / l1) * dEnd },
  };
}

function Packet({ a, c, b, blocked, duration }: { a: Point; c: Point; b: Point; blocked: boolean; duration: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let raf = 0;
    let start: number | null = null;
    const el = ref.current;
    if (!el) return;
    const tick = (now: number) => {
      if (start == null) start = now;
      const t = ((now - start) % duration) / duration;
      const p = qbez(a, c, b, blocked ? Math.min(t, 0.62) : t);
      el.style.transform = `translate(${p.x}px, ${p.y}px)`;
      const fade = t < 0.08 ? t / 0.08 : t > 0.88 ? Math.max(0, (1 - t) / 0.12) : 1;
      el.style.opacity = String(blocked && t > 0.6 ? 0 : fade);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [a.x, a.y, b.x, b.y, c.x, c.y, duration, blocked]);
  return <div ref={ref} className={`flow-packet ${blocked ? "blk" : ""}`} />;
}

interface FlowCanvasProps {
  flow: Flow;
  step: number;
  /**
   * Every step in the current beat. A fan-out lights up as one round, so this
   * can hold several indices; defaults to just `step`.
   */
  activeSteps?: number[];
  /** The closing beat: the envelope travelling into the provenance layer. */
  sealActive?: boolean;
}

export function FlowCanvas({ flow, step, activeSteps, sealActive = false }: FlowCanvasProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { w, h } = useElementSize(ref);
  const steps = flow.steps;

  // On the seal beat no hop is active — the highlight belongs to the drop into
  // the ledger, and every hop behind it reads as completed.
  const active = useMemo(
    () => (sealActive ? [] : activeSteps && activeSteps.length > 0 ? activeSteps : [step]),
    [sealActive, activeSteps, step],
  );
  const doneBefore = sealActive ? steps.length : active[0] ?? 0;
  const activeSet = useMemo(() => new Set(active), [active]);
  // Caption/summary follow the first hop of the round.
  const cur = sealActive ? undefined : steps[active[0]];

  const pts = useMemo(() => {
    const m: Record<string, Point> = {};
    flow.nodes.forEach((n) => {
      m[n.id] = { x: n.x * w, y: n.y * h };
    });
    return m;
  }, [flow, w, h]);

  const ready = w > 0 && h > 0;
  const compact = ready && w < 560;

  const nb = (id: string) => flow.nodeById[id]?.name || id;

  // Seal edges leave straight down, so their source node moves its caption
  // above to keep the dashed line clear of the name.
  const sealSources = useMemo(
    () => new Set((flow.sealEdges ?? []).map((e) => e.from)),
    [flow.sealEdges],
  );

  const visited = useMemo(() => {
    const s = new Set<string>();
    for (let i = 0; i <= step; i++) {
      const st = steps[i];
      if (!st) continue;
      s.add(st.from);
      s.add(st.to);
    }
    return s;
  }, [steps, step]);

  /**
   * How far each step's arc should bow, signed: negative bows one way, positive
   * the other. Repeated hops between the same two nodes are spread symmetrically
   * around the straight line — with two interactions, one arcs above and one
   * below by the same amount, so the pair stays visually balanced.
   *
   * A lone hop keeps bow 1, i.e. exactly the curvature it had before.
   */
  const bowForStep = useMemo(() => {
    const groups = new Map<string, number[]>();
    steps.forEach((s, i) => {
      const key = `${s.from}>${s.to}`;
      const g = groups.get(key);
      if (g) g.push(i);
      else groups.set(key, [i]);
    });
    const out = new Map<number, number>();
    for (const indices of groups.values()) {
      const n = indices.length;
      // Spacing keeps the outermost lanes at ±1 whatever the count, so a busy
      // pair fans tighter rather than sprawling across the canvas.
      const spacing = n > 1 ? 2 / (n - 1) : 0;
      indices.forEach((stepIx, lane) => {
        out.set(stepIx, n === 1 ? 1 : (lane - (n - 1) / 2) * spacing);
      });
    }
    return out;
  }, [steps]);

  /**
   * Edges into the provenance layer. These aren't timed hops — they're always
   * drawn, so the ledger destination is visible from the start.
   */
  const sealEdges = useMemo(() => {
    if (!ready) return [];
    return (flow.sealEdges ?? []).flatMap((se) => {
      const a0 = pts[se.from];
      const b0 = pts[se.to];
      if (!a0 || !b0) return [];
      const c = ctrlFor(a0, b0, 0.35);
      const { a, b } = trimEnds(a0, c, b0, 20, 30);
      const mid = qbez(a, c, b, 0.5);
      // The drop is near-vertical, so the label goes beside the line rather
      // than across it — on whichever side has more room, clamped to the frame.
      const side = mid.x < w / 2 ? 1 : -1;
      return [{
        ...se,
        a, b, c,
        labelX: Math.min(Math.max(mid.x + side * 12, 8), Math.max(8, w - 8)),
        labelY: mid.y,
        anchor: side === 1 ? ("start" as const) : ("end" as const),
      }];
    });
  }, [ready, flow.sealEdges, pts, w]);

  const activeEdges = useMemo(() => {
    if (!ready) return [];
    return active.flatMap((si) => {
      const st = steps[si];
      if (!st) return [];
      const a0 = pts[st.from];
      const b0 = pts[st.to];
      if (!a0 || !b0) return [];
      const c = ctrlFor(a0, b0, bowForStep.get(si) ?? 1);
      const { a, b } = trimEnds(a0, c, b0, 20, 36);
      return [{ key: si, a, b, c, blocked: st.verdict === "blocked" }];
    });
  }, [ready, active, steps, pts, bowForStep]);

  // Gradients are defined once against the first active edge.
  const activeEdge = activeEdges[0] ?? null;

  return (
    <div className={`flow-canvas ${compact ? "compact" : ""}`}>
      <div className="canvas-graph" ref={ref}>
        <div className="grid-dots" />

        <div className="canvas-top">
          <div className={`canvas-badge ${flow.status === "halted" ? "halted" : ""}`}>
            <span className="lv" />
            {flow.status === "halted" ? "POLICY HALT" : "LIVE TRACE"} · {flow.nodes.filter((n) => n.kind !== "provenance").length} nodes · {steps.length} hops
          </div>
          <div className="canvas-legend">
            <span className="lg">
              <span className="sw human" style={{ background: NODE_DOT.human }} />
              Operator
            </span>
            <span className="lg">
              <span className="sw" style={{ background: NODE_DOT.agent }} />
              Agent
            </span>
            <span className="lg">
              <span className="sw" style={{ background: NODE_DOT.tool }} />
              App
            </span>
          </div>
        </div>

        {ready && (
          <svg className="edges" width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
            <defs>
              <linearGradient
                id="edgeActive"
                gradientUnits="userSpaceOnUse"
                x1={activeEdge ? activeEdge.a.x : 0}
                y1={activeEdge ? activeEdge.a.y : 0}
                x2={activeEdge ? activeEdge.b.x : 0}
                y2={activeEdge ? activeEdge.b.y : 0}
              >
                <stop offset="0%" stopColor="#60A5FA" />
                <stop offset="100%" stopColor="#38BDF8" />
              </linearGradient>
              <linearGradient
                id="edgeBlocked"
                gradientUnits="userSpaceOnUse"
                x1={activeEdge ? activeEdge.a.x : 0}
                y1={activeEdge ? activeEdge.a.y : 0}
                x2={activeEdge ? activeEdge.b.x : 0}
                y2={activeEdge ? activeEdge.b.y : 0}
              >
                <stop offset="0%" stopColor="#F87171" />
                <stop offset="100%" stopColor="#FB923C" />
              </linearGradient>
              <marker id="arrowActive" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M0 0L10 5L0 10z" fill="#38BDF8" />
              </marker>
              <marker id="arrowBlocked" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M0 0L10 5L0 10z" fill="#FB923C" />
              </marker>
              <marker id="arrowDone" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5.5" markerHeight="5.5" orient="auto-start-reverse">
                <path d="M0 0L10 5L0 10z" fill="rgba(96,165,250,0.65)" />
              </marker>
              <marker id="arrowSeal" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5.5" markerHeight="5.5" orient="auto-start-reverse">
                <path d="M0 0L10 5L0 10z" fill="#34D399" />
              </marker>
              <marker id="arrowBase" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                <path d="M0 0L10 5L0 10z" fill="rgba(150,180,255,0.22)" />
              </marker>
            </defs>

            {/* One path per interaction, not per unique node pair — two hops
                between the same two nodes must draw as two arrows. */}
            {steps.map((s, i) => {
              const a0 = pts[s.from];
              const b0 = pts[s.to];
              if (!a0 || !b0) return null;
              const c = ctrlFor(a0, b0, bowForStep.get(i) ?? 1);
              const { a, b } = trimEnds(a0, c, b0, 20, 34);
              // Active hops are drawn separately, highlighted.
              if (activeSet.has(i)) return null;
              const done = i < doneBefore;
              return (
                <path
                  key={i}
                  d={`M${a.x},${a.y} Q${c.x},${c.y} ${b.x},${b.y}`}
                  fill="none"
                  stroke={done ? "rgba(96,165,250,0.5)" : "rgba(150,180,255,0.13)"}
                  strokeWidth={done ? 1.7 : 1.1}
                  strokeDasharray={done ? "none" : "2 5"}
                  markerEnd={done ? "url(#arrowDone)" : "url(#arrowBase)"}
                />
              );
            })}

            {/* Provenance seals — always visible, labelled, and dashed so they
                read as ledger writes rather than agent-to-agent calls. */}
            {sealEdges.map((e, i) => {
              // Lights up on the beat that triggers it — the closing seal fires
              // as the final hop plays, a threat seal as its blocked hop plays.
              const closing = e.stepIndex === steps.length - 1;
              const lit = sealActive ? closing : activeSet.has(e.stepIndex);
              const stroke = e.threat
                ? lit ? "#F87171" : "rgba(248,113,113,0.75)"
                : lit ? "#34D399" : "rgba(52,211,153,0.65)";
              return (
                <g key={`seal-${i}`}>
                  <path
                    d={`M${e.a.x},${e.a.y} Q${e.c.x},${e.c.y} ${e.b.x},${e.b.y}`}
                    fill="none"
                    stroke={stroke}
                    strokeWidth={lit ? 2.6 : 1.6}
                    strokeDasharray="5 4"
                    markerEnd={e.threat ? "url(#arrowBlocked)" : "url(#arrowSeal)"}
                    style={lit ? {
                      filter: `drop-shadow(0 0 6px ${e.threat ? "rgba(248,113,113,0.65)" : "rgba(52,211,153,0.7)"})`,
                    } : undefined}
                  />
                  {e.label && (
                    <text
                      x={e.labelX}
                      y={e.labelY}
                      textAnchor={e.anchor}
                      fontFamily="var(--font-mono)"
                      fontSize="9.5"
                      fill={e.threat ? "#FCA5A5" : "#A7F3D0"}
                      stroke="#08132A"
                      strokeWidth="3"
                      paintOrder="stroke"
                      style={{ pointerEvents: "none" }}
                    >
                      {e.label}
                    </text>
                  )}
                </g>
              );
            })}

            {/* Every hop in the round lights at once, so a fan-out reads as
                simultaneous branches rather than a sequence. */}
            {activeEdges.map((e) => (
              <g key={e.key}>
                <path
                  d={`M${e.a.x},${e.a.y} Q${e.c.x},${e.c.y} ${e.b.x},${e.b.y}`}
                  fill="none"
                  stroke={e.blocked ? "url(#edgeBlocked)" : "url(#edgeActive)"}
                  strokeWidth="2.6"
                  strokeLinecap="round"
                  markerEnd={e.blocked ? "url(#arrowBlocked)" : "url(#arrowActive)"}
                  style={{
                    filter: `drop-shadow(0 0 6px ${e.blocked ? "rgba(248,113,113,0.6)" : "rgba(56,189,248,0.6)"})`,
                  }}
                />
              </g>
            ))}
          </svg>
        )}

        {ready && (
          <div className="nodes">
            {flow.nodes.map((n) => {
              const p = pts[n.id];
              const isEndpoint = active.some((si) => {
                const st = steps[si];
                return st && (n.id === st.from || n.id === st.to);
              });
              const isActive = !!isEndpoint;
              // The ledger is always present, never "upcoming".
              const isLedger = n.kind === "provenance";
              const isVisited = isLedger || visited.has(n.id);
              const cls = [
                "flow-node",
                n.kind,
                sealSources.has(n.id) ? "label-above" : "",
                n.threat ? "threat" : "",
                isActive ? "active endpoint" : isVisited ? "visited" : "future",
              ]
                .filter(Boolean)
                .join(" ");
              return (
                <div key={n.id} className={cls} style={{ left: p.x, top: p.y }}>
                  <span className="ring" />
                  <div className="nv"><NodeIcon node={n} /></div>
                  <div className="nt">
                    <span className="nm">{n.name}</span>
                    {n.label ? <span className="lb">{n.label}</span> : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {ready && sealActive && sealEdges
          .filter((e) => e.stepIndex === steps.length - 1)
          .map((e) => (
            <Packet
              key={`seal-packet-${e.from}-${w}-${h}`}
              a={e.a}
              c={e.c}
              b={e.b}
              blocked={e.threat}
              duration={1150}
            />
          ))}

        {ready && activeEdges.map((e) => (
          <Packet
            key={`${e.key}-${w}-${h}`}
            a={e.a}
            c={e.c}
            b={e.b}
            blocked={e.blocked}
            duration={1150}
          />
        ))}
      </div>

      {sealActive && (
        <div className="canvas-bar">
          <span className="cb-num">{String(steps.length + 1).padStart(2, "0")}</span>
          <span className="cb-pair">
            <span className="cb-node">{nb(flow.sealEdges[0]?.from ?? "")}</span>
            <span className="cb-arr">→</span>
            <span className="cb-node">Provenance Layer</span>
          </span>
        </div>
      )}

      {cur && (
        <div className={`canvas-bar ${cur.verdict === "blocked" ? "blk" : ""}`}>
          <span className="cb-num">{String(step + 1).padStart(2, "0")}</span>
          <span className="cb-pair">
            <span className="cb-node">{nb(cur.from)}</span>
            <span className={`cb-arr ${cur.dir === "response" ? "ret" : ""}`}>
              {cur.dir === "response" ? "←" : "→"}
            </span>
            <span className="cb-node">{nb(cur.to)}</span>
          </span>
          <span className="cb-checks">
            {(
              [
                ["I", "identity"],
                ["T", "trust"],
                ["S", "scope"],
              ] as const
            ).map(([ltr, k]) => (
              <span key={k} className={`cb-chk ${cur.checks[k] ? "" : "fail"}`} title={k}>
                {ltr}
              </span>
            ))}
          </span>
          <span className="cb-lat">{cur.latency}ms</span>
          <span className={`cb-verdict ${cur.verdict}`}>{cur.verdict.toUpperCase()}</span>
        </div>
      )}
    </div>
  );
}
