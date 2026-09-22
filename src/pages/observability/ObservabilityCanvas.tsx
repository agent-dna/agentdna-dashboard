import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Icon } from "../../components/Icon";

export type ObsColorKind =
  | "user"
  | "agent"
  | "app"
  | "intent-active"
  | "intent-completed"
  | "intent-elevated"
  | "intent-high-risk"
  | "intent-blocked"
  | "interaction-allowed"
  | "interaction-blocked";

export interface AvatarNodeVM {
  variant: "avatar";
  id: string;
  title: string;
  sub?: string;
  initials: string;
  colorKind: ObsColorKind;
  /** Neutral count pill, top-right (e.g. total intents). */
  badge?: number;
  /** Red pulsing threat pill, top-left — only rendered when > 0. */
  altBadge?: number;
  /** Corner status dot: green normally, red when altBadge > 0. */
  statusDot?: boolean;
}

export interface CardNodeVM {
  variant: "card";
  id: string;
  eyebrow?: string;
  statusLabel?: string;
  statusColor?: string;
  title: string;
  meta?: string;
  blocked?: boolean;
}

export type ObsNodeVM = AvatarNodeVM | CardNodeVM;

export interface ObsLegendItem {
  label: string;
  color: string;
  shape?: "circle" | "square";
}

const COLOR_MAP: Record<ObsColorKind, { bg: string; ring: string }> = {
  user: { bg: "linear-gradient(135deg, #2B4FA0, #0A2240)", ring: "rgba(96,165,250,0.35)" },
  agent: { bg: "linear-gradient(135deg, #3B82F6, #2563EB)", ring: "rgba(96,165,250,0.35)" },
  app: { bg: "linear-gradient(135deg, #0EA5E9, #0369A1)", ring: "rgba(56,189,248,0.35)" },
  "intent-active": { bg: "linear-gradient(135deg, #34D399, #059669)", ring: "rgba(52,211,153,0.35)" },
  "intent-completed": { bg: "linear-gradient(135deg, #64748B, #475569)", ring: "rgba(148,163,184,0.3)" },
  "intent-elevated": { bg: "linear-gradient(135deg, #FBBF24, #D97706)", ring: "rgba(251,191,36,0.35)" },
  "intent-high-risk": { bg: "linear-gradient(135deg, #F87171, #DC2626)", ring: "rgba(248,113,113,0.4)" },
  "intent-blocked": { bg: "linear-gradient(135deg, #64748B, #334155)", ring: "rgba(148,163,184,0.25)" },
  "interaction-allowed": { bg: "linear-gradient(135deg, #38BDF8, #0284C7)", ring: "rgba(56,189,248,0.35)" },
  "interaction-blocked": { bg: "linear-gradient(135deg, #F87171, #DC2626)", ring: "rgba(248,113,113,0.4)" },
};

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

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let a = seed;
  return function rand() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

type Pt = { x: number; y: number };

/** Deterministic loose-grid scatter with per-node jitter, in pixel space. */
function scatterLayoutPx(ids: string[], w: number, h: number): Record<string, Pt> {
  const n = ids.length;
  if (n === 0) return {};
  if (n === 1) return { [ids[0]]: { x: w * 0.5, y: h * 0.46 } };

  const ordered = [...ids].sort((a, b) => hashStr(a) - hashStr(b));
  const cols = Math.max(1, Math.ceil(Math.sqrt(n * 1.7)));
  const rows = Math.max(1, Math.ceil(n / cols));
  const marginX = Math.min(70, w * 0.08);
  const marginY = Math.min(64, h * 0.12);
  const innerW = Math.max(1, w - marginX * 2);
  const innerH = Math.max(1, h - marginY * 2);
  const pos: Record<string, Pt> = {};
  ordered.forEach((id, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const rand = mulberry32(hashStr(id));
    const jitterX = (rand() - 0.5) * 0.8;
    const jitterY = (rand() - 0.5) * 0.8;
    const cellW = innerW / cols;
    const cellH = innerH / rows;
    const x = marginX + (col + 0.5) * cellW + jitterX * cellW * 0.5;
    const y = marginY + (row + 0.5) * cellH + jitterY * cellH * 0.5;
    pos[id] = { x: clamp(x, marginX * 0.5, w - marginX * 0.5), y: clamp(y, marginY * 0.5, h - marginY * 0.5) };
  });
  return pos;
}

/** Max foreground blocks shown around a focused node; the ring caption reports how many were left off. */
const MAX_RING = 5;
// Footprint of the largest node (a card) — ring spacing is sized so neighbours never overlap.
const CARD_W = 168;
const CARD_H = 84;

/**
 * Places `ids` evenly on an ellipse around `anchor`, sized for card footprints.
 * Near the canvas edge the ring becomes a half-fan facing inward so nothing gets clamped on top of its neighbour.
 */
function radialLayoutPx(anchor: Pt, ids: string[], w: number, h: number): Record<string, Pt> {
  const n = ids.length;
  const out: Record<string, Pt> = {};
  if (n === 0) return out;
  const padX = CARD_W / 2 + 16;
  const padY = CARD_H / 2 + 14;
  const rx = clamp(w / 2 - padX, 200, 270);
  const ry = clamp(h / 2 - padY, 140, 180);

  const dx = w / 2 - anchor.x;
  const dy = h / 2 - anchor.y;
  const offCenter = Math.max(Math.abs(dx) / (w / 2), Math.abs(dy) / (h / 2));
  const angles: number[] = [];
  if (offCenter > 0.45 && n > 1) {
    const facing = Math.atan2(dy / ry, dx / rx);
    for (let i = 0; i < n; i++) angles.push(facing - Math.PI / 2 + (i / (n - 1)) * Math.PI);
  } else {
    for (let i = 0; i < n; i++) angles.push(-Math.PI / 2 + (i / n) * Math.PI * 2);
  }

  ids.forEach((id, i) => {
    out[id] = {
      x: clamp(anchor.x + Math.cos(angles[i]) * rx, padX, w - padX),
      y: clamp(anchor.y + Math.sin(angles[i]) * ry, padY, h - padY),
    };
  });
  return out;
}

/** A node's visible shape relative to its layout point: the tile for avatars (which sit above their label), the whole box for cards. */
interface Shape {
  dx: number;
  dy: number;
  hw: number;
  hh: number;
}

const NO_SHAPE: Shape = { dx: 0, dy: 0, hw: 0, hh: 0 };
const SPOKE_GAP = 4;
const SPOKE_BEND = 0.14;

function measureShape(el: HTMLElement): Shape {
  const tile = el.querySelector<HTMLElement>(".obs-nv");
  if (!tile) return { dx: 0, dy: 0, hw: el.offsetWidth / 2, hh: el.offsetHeight / 2 };
  // offset* ignore CSS transforms, so hover/dim scaling doesn't skew the geometry.
  return {
    dx: -el.offsetWidth / 2 + tile.offsetLeft + tile.offsetWidth / 2,
    dy: -el.offsetHeight / 2 + tile.offsetTop + tile.offsetHeight / 2,
    hw: tile.offsetWidth / 2,
    hh: tile.offsetHeight / 2,
  };
}

/** Where the ray from `c` toward `toward` leaves the box of half-size (hw, hh), plus a small gap. */
function exitPoint(c: Pt, toward: Pt, hw: number, hh: number): Pt {
  const vx = toward.x - c.x;
  const vy = toward.y - c.y;
  const len = Math.hypot(vx, vy) || 1;
  const ux = vx / len;
  const uy = vy / len;
  const t = Math.min(ux ? hw / Math.abs(ux) : Infinity, uy ? hh / Math.abs(uy) : Infinity) + SPOKE_GAP;
  return { x: c.x + ux * t, y: c.y + uy * t };
}

/** Gently bowed quadratic from shape `a` to shape `b`, trimmed to both borders along the curve's own end tangents. */
function spokePath(a: Pt, sa: Shape, b: Pt, sb: Shape): string {
  const A = { x: a.x + sa.dx, y: a.y + sa.dy };
  const B = { x: b.x + sb.dx, y: b.y + sb.dy };
  // Control point sits off the midpoint along the perpendicular, always to the same side,
  // so the ring reads as a deliberate pinwheel rather than random bends.
  const C = {
    x: (A.x + B.x) / 2 - (B.y - A.y) * SPOKE_BEND,
    y: (A.y + B.y) / 2 + (B.x - A.x) * SPOKE_BEND,
  };
  const S = exitPoint(A, C, sa.hw, sa.hh);
  const E = exitPoint(B, C, sb.hw, sb.hh);
  return `M${S.x.toFixed(1)},${S.y.toFixed(1)} Q${C.x.toFixed(1)},${C.y.toFixed(1)} ${E.x.toFixed(1)},${E.y.toFixed(1)}`;
}

interface ChainLevel {
  ids: string[];
  pos: Record<string, Pt>;
  /** All children at this level, including those beyond MAX_RING that aren't drawn. */
  total: number;
  /** Children flagged as blocked / high-risk, counted across `total`. */
  flagged: number;
}

interface ObservabilityCanvasProps {
  liveLabel: string;
  legend: ObsLegendItem[];
  emptyText?: string;
  footerHint?: string;
  /** Depth-0 ids — always laid out via the base scatter. */
  rootIds: string[];
  /** Dotted connector pairs among root ids — only drawn while nothing is focused. */
  rootEdges?: [string, string][];
  /** Sequence of chosen ids drilling from the root into deeper rings; empty = nothing focused. */
  path: string[];
  /** Children of `anchorId`, which lives at chain depth `depthIndex` (0 = root). */
  childrenOf: (depthIndex: number, anchorId: string) => string[];
  /** Render VM for the node at chain depth `depthIndex` with the given id (depth 0 included). */
  nodeAt: (depthIndex: number, id: string) => ObsNodeVM | undefined;
  /** Once the foreground ring sits at this depth, its nodes stop being clickable (a leaf ring). */
  maxDepth: number;
  onDrill: (nextPath: string[]) => void;
  /** Plural name of each level, one per depth (index 0 = roots), e.g. ["Users", "Intents", "Interactions", "Agents"]. */
  levels: string[];
  /** Extra controls rendered in the canvas top bar (e.g. "View as trace"). */
  actions?: ReactNode;
  /** Panel drawn over the graph (e.g. the intent trace). */
  overlay?: ReactNode;
  /**
   * Shown instead of the ring once something is focused — for levels better read as a list than as blocks.
   * Docks on the side away from the focused node so it never covers it.
   */
  focusPanel?: ReactNode;
}

export function ObservabilityCanvas({
  liveLabel,
  legend,
  emptyText = "Nothing to show here.",
  footerHint,
  rootIds,
  rootEdges = [],
  path,
  childrenOf,
  nodeAt,
  maxDepth,
  onDrill,
  levels,
  actions,
  overlay,
  focusPanel,
}: ObservabilityCanvasProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { w, h } = useElementSize(ref);
  const ready = w > 0 && h > 0;
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [hoverVM, setHoverVM] = useState<ObsNodeVM | null>(null);

  const chain = useMemo<ChainLevel[]>(() => {
    if (!ready) return [];
    const out: ChainLevel[] = [{ ids: rootIds, pos: scatterLayoutPx(rootIds, w, h), total: rootIds.length, flagged: 0 }];
    for (let i = 0; i < path.length; i++) {
      const anchorId = path[i];
      const anchorPos = out[i].pos[anchorId] ?? { x: w / 2, y: h / 2 };
      const allIds = childrenOf(i, anchorId);
      // Blocked blocks first so a threat is never the one left off the ring; keep the chosen next hop visible.
      const isBlocked = (id: string) => {
        const vm = nodeAt(i + 1, id);
        return vm?.variant === "card" && vm.blocked ? 1 : 0;
      };
      const next = path[i + 1];
      const ranked = [...allIds].sort((a, b) => (b === next ? 1 : 0) - (a === next ? 1 : 0) || isBlocked(b) - isBlocked(a));
      const childIds = ranked.slice(0, MAX_RING);
      out.push({
        ids: childIds,
        pos: radialLayoutPx(anchorPos, childIds, w, h),
        total: allIds.length,
        flagged: allIds.reduce((n, id) => n + isBlocked(id), 0),
      });
    }
    return out;
  }, [ready, rootIds, path, childrenOf, nodeAt, w, h]);

  const depth = path.length;
  const focused = depth >= 1;
  const anchorId = focused ? path[depth - 1] : null;
  const bgDepthIndex = depth - 1;
  const fgDepthIndex = depth;
  const bgLevel = focused ? chain[bgDepthIndex] : null;
  const fgLevel = chain[fgDepthIndex];
  const fgInteractive = fgDepthIndex < maxDepth;
  const panelMode = focused && !!focusPanel;

  const setHover = (id: string | null, vm?: ObsNodeVM) => {
    setHoverId(id);
    setHoverVM(vm ?? null);
  };

  const [helpOpen, setHelpOpen] = useState(false);

  // Measure the anchor + foreground shapes after layout so spokes can end at their borders.
  // Keyed on a layout signature (not the chain object, which is rebuilt every render) to avoid a measure→render loop.
  const nodesRef = useRef<HTMLDivElement>(null);
  const [shapes, setShapes] = useState<Record<string, Shape>>({});
  const layoutKey = `${w}x${h}|${path.join("/")}|${fgLevel?.ids.join(",") ?? ""}`;
  useLayoutEffect(() => {
    const root = nodesRef.current;
    if (!root) return;
    const next: Record<string, Shape> = {};
    root.querySelectorAll<HTMLElement>("[data-node-id]").forEach((el) => {
      next[el.dataset.nodeId!] = measureShape(el);
    });
    setShapes(next);
  }, [layoutKey]);

  const ringCaption = (() => {
    if (!focused || !fgLevel) return null;
    const name = (levels[fgDepthIndex] ?? "").toUpperCase();
    const shown = fgLevel.ids.length;
    const parts = [name, fgLevel.total > shown ? `${shown} of ${fgLevel.total}` : `${fgLevel.total}`];
    if (fgLevel.flagged > 0) parts.push(`${fgLevel.flagged} flagged`);
    return parts.join(" · ");
  })();

  // Esc steps back one level, so repeated presses unselect back to the root view.
  useEffect(() => {
    if (depth === 0) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName))) return;
      onDrill(path.slice(0, -1));
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [depth, path, onDrill]);

  return (
    <>
    <LevelStepper
      levels={levels}
      path={path}
      titleAt={(d, id) => nodeAt(d, id)?.title ?? id}
      current={fgLevel}
      capped={!focusPanel}
      onJump={(d) => onDrill(path.slice(0, d))}
    />
    <div className="obs-canvas">
      <div className="obs-canvas-graph" ref={ref}>
        <div className="obs-grid-dots" />

        <div className="obs-canvas-top">
          <div className="obs-canvas-badge">
            <span className="obs-lv" />
            {liveLabel}
          </div>
          <div className="obs-canvas-actions">
            {actions}
            <div className="obs-canvas-legend">
              {legend.map((l) => (
                <span className="obs-lg" key={l.label}>
                  <span className={`obs-sw ${l.shape === "circle" ? "circle" : ""}`} style={{ background: l.color }} />
                  {l.label}
                </span>
              ))}
            </div>
            <button
              type="button"
              className={`obs-help-btn ${helpOpen ? "active" : ""}`}
              onClick={() => setHelpOpen((o) => !o)}
              aria-expanded={helpOpen}
            >
              How to read
              <Icon name="chevronDown" size={12} />
            </button>
          </div>
        </div>
        {helpOpen && <HowToRead onClose={() => setHelpOpen(false)} />}
        {overlay}

        {ready && !focused && rootEdges.length > 0 && (
          <svg className="obs-edges" width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
            {rootEdges.map(([a, b]) => {
              const pa = chain[0]?.pos[a];
              const pb = chain[0]?.pos[b];
              if (!pa || !pb) return null;
              return (
                <line
                  key={`${a}>${b}`}
                  x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y}
                  stroke="rgba(150,180,255,0.22)"
                  strokeWidth={1.2}
                  strokeDasharray="2 5"
                />
              );
            })}
          </svg>
        )}

        {ready && focused && bgLevel && !panelMode && (
          <svg className="obs-edges" width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
            {fgLevel.ids.map((id) => {
              const a = bgLevel.pos[anchorId!];
              const b = fgLevel.pos[id];
              if (!a || !b) return null;
              const vm = nodeAt(fgDepthIndex, id);
              const blocked = vm?.variant === "card" && vm.blocked;
              return (
                <path
                  key={`spoke-${id}`}
                  d={spokePath(a, shapes[anchorId!] ?? NO_SHAPE, b, shapes[id] ?? NO_SHAPE)}
                  fill="none"
                  stroke={blocked ? "rgba(248,113,113,0.6)" : "rgba(148,163,184,0.45)"}
                  strokeWidth={1.3}
                  strokeLinecap="round"
                />
              );
            })}
          </svg>
        )}

        {ready && !focused && rootIds.length === 0 && (
          <div className="obs-empty">{emptyText}</div>
        )}
        {ready && focused && !panelMode && fgLevel.ids.length === 0 && (
          <div className="obs-empty" style={{ background: "transparent" }}>{emptyText}</div>
        )}

        {ready && !focused && (
          <div className="obs-nodes">
            {rootIds.map((id) => {
              const vm = nodeAt(0, id);
              const p = chain[0]?.pos[id];
              if (!vm || !p) return null;
              return (
                <NodeVisual
                  key={id}
                  vm={vm}
                  pos={p}
                  state="normal"
                  hovered={hoverId === id}
                  onClick={() => onDrill([id])}
                  onHover={(on) => setHover(on ? id : null, on ? vm : undefined)}
                />
              );
            })}
          </div>
        )}

        {ready && focused && bgLevel && (
          <div className="obs-nodes" ref={nodesRef}>
            {bgLevel.ids.map((id) => {
              const vm = nodeAt(bgDepthIndex, id);
              const p = bgLevel.pos[id];
              if (!vm || !p) return null;
              const isAnchor = id === anchorId;
              return (
                <NodeVisual
                  key={`bg-${id}`}
                  vm={vm}
                  pos={p}
                  state={isAnchor ? "anchor" : "dim"}
                  hovered={hoverId === id}
                  onClick={() => onDrill([...path.slice(0, bgDepthIndex), id])}
                  onHover={(on) => setHover(on ? id : null, on ? vm : undefined)}
                />
              );
            })}
            {!panelMode && ringCaption && bgLevel.pos[anchorId!] && (
              <span
                className={`obs-ring-caption ${fgLevel.flagged > 0 ? "flagged" : ""}`}
                style={{ left: bgLevel.pos[anchorId!].x, top: bgLevel.pos[anchorId!].y + 62 }}
              >
                {ringCaption}
              </span>
            )}
            {!panelMode && fgLevel.ids.map((id) => {
              const vm = nodeAt(fgDepthIndex, id);
              const p = fgLevel.pos[id];
              if (!vm || !p) return null;
              return (
                <NodeVisual
                  key={`fg-${id}`}
                  vm={vm}
                  pos={p}
                  state="bright"
                  hovered={hoverId === id}
                  onClick={fgInteractive ? () => onDrill([...path, id]) : undefined}
                  onHover={(on) => setHover(on ? id : null, on ? vm : undefined)}
                />
              );
            })}
          </div>
        )}

        {ready && panelMode && (() => {
          // Dock opposite the focused node and only as wide as the room beside it (within 420–600px),
          // so the node stays visible next to its panel.
          const ax = bgLevel?.pos[anchorId!]?.x ?? 0;
          const side = ax > w / 2 ? "left" : "right";
          const room = (side === "right" ? w - ax : ax) - 70;
          return (
            <div className={`obs-focus-panel ${side}`} style={{ width: `min(${clamp(room, 420, 600)}px, calc(100% - 32px))` }}>
              {focusPanel}
            </div>
          );
        })()}
      </div>

      <div className="obs-canvas-bar">
        {hoverVM ? (
          <>
            <span className="obs-cb-node">{hoverVM.title}</span>
            {hoverVM.variant === "avatar" && hoverVM.sub && <span className="obs-cb-meta">{hoverVM.sub}</span>}
            {hoverVM.variant === "card" && hoverVM.meta && <span className="obs-cb-meta">{hoverVM.meta}</span>}
          </>
        ) : (
          <span className="obs-cb-hint">{footerHint || "Hover or click a node to inspect it."}</span>
        )}
      </div>
    </div>
    </>
  );
}

/** Shows every level of the drill-down: chosen levels (clickable to go back), the current ring with its count, and faded levels still ahead. */
function LevelStepper({
  levels,
  path,
  titleAt,
  current,
  capped,
  onJump,
}: {
  levels: string[];
  path: string[];
  titleAt: (depthIndex: number, id: string) => string;
  current: ChainLevel | undefined;
  /** False when the current level is shown in full (a list panel), so "5 of 23" would be wrong. */
  capped: boolean;
  onJump: (depthIndex: number) => void;
}) {
  const depth = path.length;
  return (
    <nav className="obs-stepper" aria-label="Drill-down levels">
      {levels.map((name, i) => {
        const state = i < depth ? "done" : i === depth ? "current" : "next";
        let value: string | null = null;
        if (state === "done") value = titleAt(i, path[i]);
        else if (state === "current" && current) {
          value = capped && current.total > current.ids.length ? `${current.ids.length} of ${current.total}` : `${current.total}`;
        }
        return (
          <Fragment key={name}>
            {i > 0 && <span className="obs-step-sep">›</span>}
            <button
              type="button"
              className={`obs-step ${state}`}
              onClick={state === "done" ? () => onJump(i) : undefined}
              disabled={state !== "done"}
              title={state === "done" ? `Back to all ${name.toLowerCase()}` : undefined}
              aria-current={state === "current" ? "step" : undefined}
            >
              <span className="obs-step-idx">{state === "done" ? <Icon name="check" size={10} /> : i + 1}</span>
              <span className="obs-step-name">{name}</span>
              {value && <span className="obs-step-val">{value}</span>}
            </button>
          </Fragment>
        );
      })}
    </nav>
  );
}

/** Key for the canvas's visual language. */
function HowToRead({ onClose }: { onClose: () => void }) {
  return (
    <div className="obs-help" role="dialog" aria-label="How to read this view">
      <div className="obs-help-head">
        <span>How to read this view</span>
        <button type="button" className="obs-help-close" onClick={onClose} aria-label="Close">
          <Icon name="close" size={12} />
        </button>
      </div>
      <ul className="obs-help-list">
        <li><span className="obs-key tile" />Actor — a user or an agent. Click to drill in.</li>
        <li><span className="obs-key card" />Event — an intent, or a hop between two agents.</li>
        <li><span className="obs-key pill">4</span>Intents this actor took part in.</li>
        <li><span className="obs-key pill red">1</span>Of those, how many are high-risk or blocked.</li>
        <li><span className="obs-key dot" /><span className="obs-key dot red" />Agent health: clear / has threats.</li>
        <li><span className="obs-key line" />Allowed link.</li>
        <li><span className="obs-key line red" />Blocked hop or flagged intent.</li>
        <li><span className="obs-key line dotted" />Agents that interacted directly (agent overview).</li>
      </ul>
      <div className="obs-help-foot">
        Faded nodes are the level you came from. <kbd>Esc</kbd> steps back one level.
      </div>
    </div>
  );
}

function NodeVisual({
  vm,
  pos,
  state,
  hovered,
  onClick,
  onHover,
}: {
  vm: ObsNodeVM;
  pos: Pt;
  state: "normal" | "dim" | "anchor" | "bright";
  hovered: boolean;
  onClick?: () => void;
  onHover: (on: boolean) => void;
}) {
  if (vm.variant === "avatar") {
    const colors = COLOR_MAP[vm.colorKind];
    return (
      <button
        type="button"
        // Kind is namespaced: a bare "app" class would pick up the global `.app` shell layout (grid, 100vh, relative).
        className={`obs-avatar kind-${vm.colorKind} ${state} ${hovered ? "hover" : ""} ${onClick ? "clickable" : ""}`}
        data-node-id={vm.id}
        style={{ left: pos.x, top: pos.y }}
        onMouseEnter={() => onHover(true)}
        onMouseLeave={() => onHover(false)}
        onClick={onClick}
        disabled={!onClick}
      >
        <span className="obs-ring" style={{ boxShadow: `0 0 0 3px ${colors.ring}` }} />
        <span className="obs-nv" style={{ background: colors.bg }}>
          {vm.initials}
          {vm.badge != null && <span className="obs-node-badge">{vm.badge}</span>}
          {vm.altBadge != null && vm.altBadge > 0 && <span className="obs-node-altbadge">{vm.altBadge}</span>}
          {vm.statusDot && <span className={`obs-node-dot ${vm.altBadge ? "threat" : ""}`} />}
        </span>
        <span className="obs-nt">
          <span className="obs-nm">{vm.title}</span>
          {vm.sub && <span className="obs-lb">{vm.sub}</span>}
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      className={`obs-card ${state} ${vm.blocked ? "blocked" : ""} ${hovered ? "hover" : ""} ${onClick ? "clickable" : ""}`}
      data-node-id={vm.id}
      style={{ left: pos.x, top: pos.y }}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      onClick={onClick}
      disabled={!onClick}
    >
      {(vm.eyebrow || vm.statusLabel) && (
        <span className="obs-card-top">
          {vm.eyebrow && <span className="obs-card-eyebrow">{vm.eyebrow}</span>}
          {vm.statusLabel && (
            <span className="obs-card-status" style={{ color: vm.statusColor }}>
              <span className="dot" style={{ background: vm.statusColor }} />
              {vm.statusLabel}
            </span>
          )}
        </span>
      )}
      <span className="obs-card-title">{vm.title}</span>
      {vm.meta && <span className="obs-card-meta">{vm.meta}</span>}
    </button>
  );
}
