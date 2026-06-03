import { useEffect, useMemo, useRef, useState } from "react";
import { avInitials, type Flow } from "./flowData";

const NODE_DOT = { human: "#1E3A8A", agent: "#2563EB", tool: "#0EA5E9" } as const;

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

function ctrlFor(a: Point, b: Point): Point {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const off = Math.min(40, len * 0.12);
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
}

export function FlowCanvas({ flow, step }: FlowCanvasProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { w, h } = useElementSize(ref);
  const steps = flow.steps;
  const cur = steps[step];

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

  const traversed = useMemo(() => {
    const s = new Set<string>();
    for (let i = 0; i <= step; i++) {
      const st = steps[i];
      if (!st) continue;
      s.add(`${st.from}>${st.to}`);
    }
    return s;
  }, [steps, step]);

  const activeEdge = useMemo(() => {
    if (!ready || !cur) return null;
    const a0 = pts[cur.from];
    const b0 = pts[cur.to];
    if (!a0 || !b0) return null;
    const c = ctrlFor(a0, b0);
    const { a, b } = trimEnds(a0, c, b0, 20, 36);
    return { a, b, c, blocked: cur.verdict === "blocked" };
  }, [ready, cur, pts]);

  return (
    <div className={`flow-canvas ${compact ? "compact" : ""}`}>
      <div className="canvas-graph" ref={ref}>
        <div className="grid-dots" />

        <div className="canvas-top">
          <div className={`canvas-badge ${flow.status === "halted" ? "halted" : ""}`}>
            <span className="lv" />
            {flow.status === "halted" ? "POLICY HALT" : "LIVE TRACE"} · {flow.nodes.length} nodes · {steps.length} hops
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
              Tool
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
              <marker id="arrowBase" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                <path d="M0 0L10 5L0 10z" fill="rgba(150,180,255,0.22)" />
              </marker>
            </defs>

            {flow.edges.map(([from, to], i) => {
              const a0 = pts[from];
              const b0 = pts[to];
              if (!a0 || !b0) return null;
              const c = ctrlFor(a0, b0);
              const { a, b } = trimEnds(a0, c, b0, 20, 34);
              const key = `${from}>${to}`;
              const isActive = cur && `${cur.from}>${cur.to}` === key;
              if (isActive) return null;
              const done = traversed.has(key);
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

            {activeEdge && (
              <g>
                <path
                  d={`M${activeEdge.a.x},${activeEdge.a.y} Q${activeEdge.c.x},${activeEdge.c.y} ${activeEdge.b.x},${activeEdge.b.y}`}
                  fill="none"
                  stroke={activeEdge.blocked ? "url(#edgeBlocked)" : "url(#edgeActive)"}
                  strokeWidth="2.6"
                  strokeLinecap="round"
                  markerEnd={activeEdge.blocked ? "url(#arrowBlocked)" : "url(#arrowActive)"}
                  style={{
                    filter: `drop-shadow(0 0 6px ${activeEdge.blocked ? "rgba(248,113,113,0.6)" : "rgba(56,189,248,0.6)"})`,
                  }}
                />
              </g>
            )}
          </svg>
        )}

        {ready && (
          <div className="nodes">
            {flow.nodes.map((n) => {
              const p = pts[n.id];
              const isEndpoint = cur && (n.id === cur.from || n.id === cur.to);
              const isActive = !!isEndpoint;
              const isVisited = visited.has(n.id);
              const cls = [
                "flow-node",
                n.kind,
                n.threat ? "threat" : "",
                isActive ? "active endpoint" : isVisited ? "visited" : "future",
              ]
                .filter(Boolean)
                .join(" ");
              return (
                <div key={n.id} className={cls} style={{ left: p.x, top: p.y }}>
                  <span className="ring" />
                  <div className="nv">{avInitials(n)}</div>
                  <div className="nt">
                    <span className="nm">{n.name}</span>
                    {n.label ? <span className="lb">{n.label}</span> : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {ready && activeEdge && (
          <Packet
            key={`${step}-${w}-${h}`}
            a={activeEdge.a}
            c={activeEdge.c}
            b={activeEdge.b}
            blocked={activeEdge.blocked}
            duration={1150}
          />
        )}
      </div>

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
          <span className="cb-title">{cur.title}</span>
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
