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
import { BRANCH_TONES, TRUNK_TONE, withAlpha } from "./branchPalette";
import { Icon } from "../../components/Icon";


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
 * The normal is chosen so a left → right call bows upward and the reply
 * (right → left) bows downward — a request and its response between the same
 * pair read as two separate lanes rather than one line with two arrowheads.
 * `bow` scales how far the curve bulges out.
 */
function ctrlFor(a: Point, b: Point, bow = 1): Point {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const off = Math.min(40, len * 0.12) * bow;
  return { x: mx + (dy / len) * off, y: my + (-dx / len) * off };
}

/** Space a node occupies around its centre: the icon plus its caption. */
interface NodeBox {
  x: number;
  y: number;
  top: number;
  bottom: number;
  half: number;
}

const ICON_CLEAR = 32;
const CAPTION_CLEAR = 36;
const CAPTION_HALF = 50;

function hitsBox(p: Point, box: NodeBox): boolean {
  const dx = Math.abs(p.x - box.x);
  const dy = p.y - box.y;
  if (dx <= ICON_CLEAR && Math.abs(dy) <= ICON_CLEAR) return true;
  return dx <= box.half && dy >= -box.top && dy <= box.bottom;
}

/**
 * Control point that routes an edge around every node between its endpoints.
 *
 * Starts from the default bow and grows it until the curve clears the icon and
 * caption of each node in the way — so a hop that skips a column arcs over the
 * node it passes rather than drawing through it. Falls back to the opposite
 * side when that clears with a shallower arc.
 */
function routeCtrl(a: Point, b: Point, boxes: NodeBox[]): Point {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = dy / len;
  const ny = -dx / len;
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const base = Math.min(40, len * 0.12);

  const clears = (c: Point) => {
    for (let t = 0.1; t <= 0.9; t += 0.04) {
      const p = qbez(a, c, b, t);
      if (boxes.some((box) => hitsBox(p, box))) return false;
    }
    return true;
  };
  const at = (off: number) => ({ x: mx + nx * off, y: my + ny * off });

  if (clears(at(base))) return at(base);
  for (let off = base + 12; off <= 320; off += 12) {
    if (clears(at(off))) return at(off);
    if (off > base + 60 && clears(at(-off))) return at(-off);
  }
  return at(base);
}

/**
 * Control point bowing to one side of the straight A→B line: `side` 1 is the left of travel
 * (up for a left → right hop), -1 the right. Starts at `min` and grows until the curve clears
 * every node box in the way, so a mirrored lane routes around nodes on its own side.
 */
function sideCtrl(a: Point, b: Point, boxes: NodeBox[], side: 1 | -1, min: number): Point {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = dy / len;
  const ny = -dx / len;
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const at = (off: number) => ({ x: mx + nx * off * side, y: my + ny * off * side });
  for (let off = min; off <= 320; off += 12) {
    const c = at(off);
    let clear = true;
    for (let t = 0.1; t <= 0.9 && clear; t += 0.04) {
      const p = qbez(a, c, b, t);
      if (boxes.some((box) => hitsBox(p, box))) clear = false;
    }
    if (clear) return c;
  }
  return at(min);
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

/**
 * Smallest bow for a pair shared by several branches, as a control-point offset (the arc's
 * middle sits about half this far off the straight line). The first lane bows up, the second
 * down, mirrored; any further lanes alternate again with a wider bow.
 */
const LANE_BOW = 44;

/**
 * One drawn line: an A→B pair on one branch. Hops on different branches between the same two
 * nodes get a lane each, fanned out side by side; repeats on the same branch share their lane.
 */
interface Lane {
  key: string;
  from: string;
  to: string;
  /** `""` for the trunk. */
  branch: string;
  /** Index into BRANCH_TONES, or null for the trunk (which keeps the canvas's usual blue). */
  tone: number | null;
  /** First step on this lane, or -1 for an edge no step plays. */
  firstStep: number;
  /** This lane's place among the pair's lanes (in the order they first play), and how many the pair has. */
  index: number;
  count: number;
}

function Packet({
  a,
  c,
  b,
  blocked,
  duration,
  color,
}: {
  a: Point;
  c: Point;
  b: Point;
  blocked: boolean;
  duration: number;
  /** Branch colour; the trunk's packet keeps its stylesheet blue. */
  color?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let raf = 0;
    let start: number | null = null;
    const el = ref.current;
    if (!el) return;
    // One run per beat: the packet crosses the edge once and stays gone, so
    // each interaction reads as a single send rather than a repeating loop.
    const tick = (now: number) => {
      if (start == null) start = now;
      const t = Math.min(1, (now - start) / duration);
      const p = qbez(a, c, b, blocked ? Math.min(t, 0.62) : t);
      el.style.transform = `translate(${p.x}px, ${p.y}px)`;
      const fade = t < 0.08 ? t / 0.08 : t > 0.88 ? Math.max(0, (1 - t) / 0.12) : 1;
      el.style.opacity = String(blocked && t > 0.6 ? 0 : fade);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [a.x, a.y, b.x, b.y, c.x, c.y, duration, blocked]);
  const tint =
    color && !blocked
      ? { background: color, boxShadow: `0 0 10px 3px ${withAlpha(color, 0.8)}, 0 0 22px 6px ${withAlpha(color, 0.45)}` }
      : undefined;
  return <div ref={ref} className={`flow-packet ${blocked ? "blk" : ""}`} style={tint} />;
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
  /** Hold/resume control shown in the bottom bar. */
  playback?: {
    held: boolean;
    onToggle: () => void;
    /** How long each beat dwells, for the countdown line. */
    beatMs: number;
    /** False when there is a single beat, so there is nothing to play through. */
    canPlay: boolean;
  };
}

/** Hold/resume toggle, plus a line along the bar's top that runs down to the next beat. */
function PlaybackToggle({ playback, beatKey }: { playback: NonNullable<FlowCanvasProps["playback"]>; beatKey: string }) {
  if (!playback.canPlay) return null;
  const { held, onToggle, beatMs } = playback;
  return (
    <>
      {!held && <span key={beatKey} className="cb-countdown" style={{ animationDuration: `${beatMs}ms` }} aria-hidden />}
      <button
        type="button"
        className={`cb-play ${held ? "held" : ""}`}
        onClick={onToggle}
        aria-pressed={held}
        title={held ? "Resume playback (Space)" : "Hold on this hop (Space)"}
      >
        <Icon name={held ? "play" : "pause"} size={12} />
        {held ? "Resume" : <span className="sr-only">Hold</span>}
      </button>
    </>
  );
}

export function FlowCanvas({ flow, step, activeSteps, sealActive = false, playback }: FlowCanvasProps) {
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
   * One routed control point per A→B pair. Repeated hops between the same two
   * nodes trace the same line rather than each drawing their own arc, and the
   * route bends around any node sitting between the two endpoints.
   */
  const boxes = useMemo(() => {
    const boxes = new Map<string, NodeBox>();
    if (!ready) return boxes;
    for (const n of flow.nodes) {
      const p = pts[n.id];
      if (!p) continue;
      const above = sealSources.has(n.id);
      boxes.set(n.id, {
        x: p.x,
        y: p.y,
        top: above ? ICON_CLEAR + CAPTION_CLEAR : ICON_CLEAR,
        bottom: above ? ICON_CLEAR : ICON_CLEAR + CAPTION_CLEAR,
        half: CAPTION_HALF,
      });
    }
    return boxes;
  }, [ready, flow.nodes, pts, sealSources]);
  /** Every node's box except the two ends of an edge. */
  const boxesBesides = (from: string, to: string) =>
    Array.from(boxes.entries())
      .filter(([id]) => id !== from && id !== to)
      .map(([, box]) => box);

  const ctrlByPair = useMemo(() => {
    const m = new Map<string, Point>();
    if (!ready) return m;
    for (const [from, to] of flow.edges) {
      const a = pts[from];
      const b = pts[to];
      if (!a || !b) continue;
      m.set(`${from}>${to}`, routeCtrl(a, b, boxesBesides(from, to)));
    }
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, flow.edges, pts, boxes]);

  const toneByBranch = useMemo(
    () => new Map(flow.branches.map((br) => [br.key, br.color % BRANCH_TONES.length])),
    [flow.branches],
  );

  const lanes = useMemo(() => {
    const byKey = new Map<string, Lane>();
    const byPair = new Map<string, Lane[]>();
    const add = (from: string, to: string, branch: string, firstStep: number) => {
      const key = `${from}>${to}>${branch}`;
      if (byKey.has(key)) return;
      const lane: Lane = { key, from, to, branch, tone: branch ? toneByBranch.get(branch) ?? 0 : null, firstStep, index: 0, count: 0 };
      byKey.set(key, lane);
      const pair = `${from}>${to}`;
      byPair.set(pair, [...(byPair.get(pair) ?? []), lane]);
    };
    steps.forEach((s, i) => add(s.from, s.to, s.branch ?? "", i));
    for (const [from, to] of flow.edges) {
      if (!byPair.has(`${from}>${to}`)) add(from, to, "", -1);
    }
    for (const pairLanes of byPair.values()) {
      pairLanes.forEach((l, i) => {
        l.index = i;
        l.count = pairLanes.length;
      });
    }
    return [...byKey.values()];
  }, [steps, flow.edges, toneByBranch]);
  const laneOf = (from: string, to: string, branch = "") => `${from}>${to}>${branch}`;

  /**
   * Each lane's control point. A pair with one lane uses its routed arc. A pair shared by
   * several branches splits them to both sides of the straight line — first up, second down,
   * then alternating with a wider bow — each routed around the nodes on its own side.
   */
  const ctrlByLane = useMemo(() => {
    const m = new Map<string, Point>();
    if (!ready) return m;
    for (const lane of lanes) {
      const a = pts[lane.from];
      const b = pts[lane.to];
      if (!a || !b) continue;
      if (lane.count <= 1) {
        m.set(lane.key, ctrlByPair.get(`${lane.from}>${lane.to}`) ?? ctrlFor(a, b));
        continue;
      }
      const side = lane.index % 2 === 0 ? 1 : -1;
      const min = LANE_BOW * (1 + Math.floor(lane.index / 2) * 0.8);
      m.set(lane.key, sideCtrl(a, b, boxesBesides(lane.from, lane.to), side, min));
    }
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, lanes, pts, ctrlByPair, boxes]);
  const laneCtrl = (lane: Lane, a: Point, b: Point): Point => ctrlByLane.get(lane.key) ?? ctrlFor(a, b);

  // The legend lists the branches this view actually draws.
  const laneBranches = useMemo(
    () => flow.branches.filter((br) => lanes.some((l) => l.branch === br.key)),
    [flow.branches, lanes],
  );

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
    // A fan-out beat can hold several active steps, but two of them on the same lane (same
    // pair, same branch) still share one line — dedupe so it doesn't double-draw.
    const laneByKey = new Map(lanes.map((l) => [l.key, l]));
    const seen = new Set<string>();
    return active.flatMap((si) => {
      const st = steps[si];
      if (!st) return [];
      const lane = laneByKey.get(laneOf(st.from, st.to, st.branch ?? ""));
      if (!lane || seen.has(lane.key)) return [];
      seen.add(lane.key);
      const a0 = pts[st.from];
      const b0 = pts[st.to];
      if (!a0 || !b0) return [];
      const c = laneCtrl(lane, a0, b0);
      const { a, b } = trimEnds(a0, c, b0, 20, 36);
      return [{ key: si, a, b, c, blocked: st.verdict === "blocked", tone: lane.tone }];
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, active, steps, pts, ctrlByLane, lanes]);

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
            {flow.branches.length > 0 && ` · ${flow.branches.length} branches`}
          </div>
          <div className="canvas-legends">
            {laneBranches.length > 0 && (
              <div className="canvas-legend lanes">
                {lanes.some((l) => l.tone == null && l.firstStep !== -1) && (
                  <span className="lg">
                    <span className="ln" style={{ background: TRUNK_TONE.line }} />
                    Main
                  </span>
                )}
                {laneBranches.map((br) => (
                  <span key={br.key} className="lg">
                    <span className="ln" style={{ background: BRANCH_TONES[br.color % BRANCH_TONES.length].line }} />
                    {br.name}
                  </span>
                ))}
              </div>
            )}
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
              {/* Per-branch arrowheads: active, played, and not yet played. */}
              {BRANCH_TONES.map((t, i) => (
                <g key={i}>
                  <marker id={`arrowBr${i}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M0 0L10 5L0 10z" fill={t.line} />
                  </marker>
                  <marker id={`arrowBr${i}Done`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5.5" markerHeight="5.5" orient="auto-start-reverse">
                    <path d="M0 0L10 5L0 10z" fill={withAlpha(t.line, 0.8)} />
                  </marker>
                  <marker id={`arrowBr${i}Base`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                    <path d="M0 0L10 5L0 10z" fill={withAlpha(t.line, 0.4)} />
                  </marker>
                </g>
              ))}
            </defs>

            {/* One path per lane: an A→B pair on one branch. Repeats on the same branch
                trace over the same line; another branch between the same two nodes gets
                its own line beside it, in that branch's colour. */}
            {lanes.map((lane) => {
              const a0 = pts[lane.from];
              const b0 = pts[lane.to];
              if (!a0 || !b0) return null;
              const c = laneCtrl(lane, a0, b0);
              const { a, b } = trimEnds(a0, c, b0, 20, 34);
              // Active this beat → drawn separately, highlighted.
              const isActive = active.some((si) => {
                const st = steps[si];
                return st && laneOf(st.from, st.to, st.branch ?? "") === lane.key;
              });
              if (isActive) return null;
              // Lit as soon as this lane's first interaction has played — it
              // stays "done" from then on, however many more reuse the line.
              const done = lane.firstStep !== -1 && lane.firstStep < doneBefore;
              const d = `M${a.x},${a.y} Q${c.x},${c.y} ${b.x},${b.y}`;
              if (lane.tone == null) {
                return (
                  <path
                    key={lane.key}
                    d={d}
                    fill="none"
                    stroke={done ? "rgba(96,165,250,0.5)" : "rgba(150,180,255,0.13)"}
                    strokeWidth={done ? 1.7 : 1.1}
                    strokeDasharray={done ? "none" : "2 5"}
                    markerEnd={done ? "url(#arrowDone)" : "url(#arrowBase)"}
                  />
                );
              }
              // Branch lanes show their colour before they play, so a fork is visible up front.
              const line = BRANCH_TONES[lane.tone].line;
              return (
                <path
                  key={lane.key}
                  d={d}
                  fill="none"
                  stroke={withAlpha(line, done ? 0.75 : 0.32)}
                  strokeWidth={done ? 1.9 : 1.3}
                  strokeDasharray={done ? "none" : "2 5"}
                  markerEnd={`url(#arrowBr${lane.tone}${done ? "Done" : "Base"})`}
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
            {/* A blocked hop stays red whatever its branch: the threat matters more. */}
            {activeEdges.map((e) => {
              const line = e.tone != null && !e.blocked ? BRANCH_TONES[e.tone].line : null;
              return (
                <g key={e.key}>
                  <path
                    d={`M${e.a.x},${e.a.y} Q${e.c.x},${e.c.y} ${e.b.x},${e.b.y}`}
                    fill="none"
                    stroke={e.blocked ? "url(#edgeBlocked)" : line ?? "url(#edgeActive)"}
                    strokeWidth="2.6"
                    strokeLinecap="round"
                    markerEnd={e.blocked ? "url(#arrowBlocked)" : line ? `url(#arrowBr${e.tone})` : "url(#arrowActive)"}
                    style={{
                      filter: `drop-shadow(0 0 6px ${
                        e.blocked ? "rgba(248,113,113,0.6)" : line ? withAlpha(line, 0.6) : "rgba(56,189,248,0.6)"
                      })`,
                    }}
                  />
                </g>
              );
            })}
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
              duration={1400}
            />
          ))}

        {ready && activeEdges.map((e) => (
          <Packet
            key={`${e.key}-${w}-${h}`}
            a={e.a}
            c={e.c}
            b={e.b}
            blocked={e.blocked}
            duration={1400}
            color={e.tone != null ? BRANCH_TONES[e.tone].line : undefined}
          />
        ))}
      </div>

      {sealActive && (
        <div className="canvas-bar">
          {playback && <PlaybackToggle playback={playback} beatKey="seal" />}
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
          {playback && <PlaybackToggle playback={playback} beatKey={`step-${step}`} />}
          <span className="cb-num" title={cur.branch ? `Hop ${cur.label} on ${flow.branches.find((b) => b.key === cur.branch)?.name ?? cur.branch}` : undefined}>
            {cur.label ?? String(step + 1).padStart(2, "0")}
          </span>
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
