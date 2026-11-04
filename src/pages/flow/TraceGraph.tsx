import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Background,
  BackgroundVariant,
  ReactFlow,
  ReactFlowProvider,
  ViewportPortal,
  useReactFlow,
  type Node,
  type NodeChange,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/base.css";
import { Icon } from "../../components/Icon";
import { DestinationLogo } from "../../components/DestinationLogo";
import { authStatusLabel, authTone, worstAuthTone, type AuthEvidence } from "../../api/observability";
import { parseDestination } from "../../lib/destination";
import { authMethodLabel, sentence } from "../../lib/credFormat";
import { NODE_SIZE, hasCredential, isOnward, keyColor, layoutTrace, onwardTo, pad2, routePairs, trunc, type TraceHop, type TraceModel, type TraceNode, type TracePair, type XY } from "./traceModel";

/**
 * The trace graph: node cards laid out by dagre, one routed line per sender → receiver pair,
 * and a key on lines whose hops carried credentials. Cards
 * can be dragged; lines follow. The selected hop's line is blue (red when blocked), lines to
 * calls out to destinations are yellow dots, and the provenance seal is a green dash.
 */

const COL = { n: "#B4BFD1", b: "#2563EB", r: "#DC2626", g: "#059669", o: "#EAB308", y: "#CA8A04" } as const;
type ColKey = keyof typeof COL;

interface CardData extends Record<string, unknown> {
  node: TraceNode;
  /** Sender or receiver of the selected hop. */
  active: boolean;
  /** Receiver of the selected hop, and that hop was blocked. */
  red: boolean;
}
type CardNode = Node<CardData, "card">;

function KindGlyph({ node, size = 16 }: { node: TraceNode; size?: number }) {
  if (node.dest) return <DestinationLogo entity={node.dest.entity} size={size} />;
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (node.kind) {
    case "human":
      return <Icon name="user" size={size} />;
    case "agent":
      return (
        <svg {...common}>
          <rect x="5" y="8" width="14" height="11" rx="2.5" />
          <path d="M12 4.5V8M9.5 13v1.2M14.5 13v1.2M3 12.5v3M21 12.5v3" />
          <circle cx="12" cy="3.5" r="1" />
        </svg>
      );
    case "app":
      return (
        <svg {...common}>
          <rect x="3" y="4" width="18" height="16" rx="2.5" />
          <path d="M3 9h18M6.5 6.5h.01M9.5 6.5h.01" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />
          <path d="M9 12l2 2 4-4" />
        </svg>
      );
  }
}

/** Every node is its logo and name; the selected hop's ends are outlined. */
const NodeCard = memo(function NodeCard({ data }: NodeProps<CardNode>) {
  const { node, active, red } = data;
  return (
    <div className={`trd k-${node.kind}${active ? " on" : ""}${red ? " red" : ""}`} title={node.name}>
      <span className="trd-logo">
        <KindGlyph node={node} size={node.dest ? 22 : 18} />
      </span>
      <span className="trd-name">{node.name}</span>
    </div>
  );
});

const nodeTypes = { card: NodeCard };

/** True when the viewer asked for less motion: beats then sit still mid-line. */
function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false);
  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!mq) return;
    const on = () => setReduced(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduced;
}

/**
 * What travels along the selected hop's line: a pulse for the message, or the key itself when
 * the hop carried a credential (clicking it opens the credential). Loops from sender to receiver.
 */
function Beat({ d, mid, color, credential, keyTint, reduced, onOpen }: {
  d: string;
  mid: XY;
  color: string;
  credential: boolean;
  /** The credential's key colour (the same credential is the same colour everywhere). */
  keyTint: string;
  reduced: boolean;
  onOpen?: () => void;
}) {
  const motion = reduced ? null : <animateMotion dur={credential ? "2.2s" : "1.5s"} repeatCount="indefinite" path={d} />;
  const at = reduced ? `translate(${mid.x},${mid.y})` : undefined;
  if (credential) {
    return (
      <g className="tr-keybeat" transform={at} onClick={onOpen} role="button" aria-label="Inspect credential">
        <title>Credential sent on this hop · click to inspect</title>
        <circle className="tr-keybeat-ring" r={11} fill={keyTint} fillOpacity={0.22} />
        <circle r={10} fill="#fff" stroke={keyTint} strokeWidth={1.4} />
        <g transform="translate(-6,-6) scale(0.5)" fill="none" stroke={keyTint} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="8" cy="15" r="4" />
          <path d="M12 11l8-8M18 6l2 2M15 9l2 2" />
        </g>
        {motion}
      </g>
    );
  }
  return (
    <g className="tr-beat" transform={at}>
      <circle r={7} fill={color} opacity={0.16} />
      <circle r={3.6} fill={color} />
      {motion}
    </g>
  );
}

export interface TraceGraphProps {
  model: TraceModel;
  /** Changes only when a different trace is shown: dragged cards reset and the view refits. */
  traceKey: string;
  /** Selected hop number; 0 when there are none. */
  sel: number;
  playing: boolean;
  onSelect: (n: number) => void;
  onOpenCred: (n: number) => void;
  onNodeClick: (id: string) => void;
  inspectorOpen: boolean;
  onToggleInspector: () => void;
  /** Pinned in the top-left corner. */
  topLeft?: ReactNode;
}

export function TraceGraph(props: TraceGraphProps) {
  return (
    <ReactFlowProvider>
      <GraphInner {...props} />
    </ReactFlowProvider>
  );
}

function GraphInner({
  model,
  traceKey,
  sel,
  playing,
  onSelect,
  onOpenCred,
  onNodeClick,
  inspectorOpen,
  onToggleInspector,
  topLeft,
}: TraceGraphProps) {
  const rf = useReactFlow();
  const wrapRef = useRef<HTMLDivElement>(null);
  const userMoved = useRef(false);
  const [width, setWidth] = useState(1000);
  const wide = width >= 860;
  const reduced = useReducedMotion();

  // Dragged cards override the layout until the model changes or the layout is reset.
  const base = useMemo(() => layoutTrace(model), [model]);
  const [moved, setMoved] = useState<{ key: string; pos: Record<string, XY> }>({ key: "", pos: {} });
  const pos = useMemo(() => (moved.key === traceKey ? { ...base, ...moved.pos } : base), [base, moved, traceKey]);
  // Every card is one size; routing takes a per-node size so that can change later.
  const sizeById = useCallback((): typeof NODE_SIZE => NODE_SIZE, []);
  const geo = useMemo(() => routePairs(model.pairs, pos, sizeById), [model, pos, sizeById]);

  const hopAt = (n: number): TraceHop | undefined => model.hops[n - 1];
  const cur = hopAt(sel);
  const selKey = cur ? `${cur.src}>${cur.dst}` : "";
  // The receiver calls the destinations, so the selected hop's outside lines leave from its `dst`.
  const selOutside = useMemo(() => new Set(cur ? cur.outside.map((o) => `${cur.dst}>${o}`) : []), [cur]);

  const nodes: CardNode[] = useMemo(
    () =>
      model.nodes.map((node) => {
        const isSrc = cur?.src === node.id;
        const isDst = cur?.dst === node.id || (!!cur && cur.outside.includes(node.id));
        const p = pos[node.id] ?? { x: 0, y: 0 };
        const { w, h } = NODE_SIZE;
        return {
          id: node.id,
          type: "card",
          position: { x: p.x - w / 2, y: p.y - h / 2 },
          width: w,
          height: h,
          measured: { width: w, height: h },
          draggable: true,
          selectable: false,
          data: { node, active: isSrc || isDst, red: !!cur?.blocked && isDst },
        };
      }),
    [model, pos, cur],
  );

  const onNodesChange = useCallback(
    (changes: NodeChange<CardNode>[]) => {
      const drags = changes.filter((c) => c.type === "position" && c.position);
      if (drags.length === 0) return;
      userMoved.current = true;
      setMoved((m) => {
        const next = { ...(m.key === traceKey ? m.pos : {}) };
        for (const c of drags) {
          if (c.type === "position" && c.position) {
            const { w, h } = NODE_SIZE;
            next[c.id] = { x: c.position.x + w / 2, y: c.position.y + h / 2 };
          }
        }
        return { key: traceKey, pos: next };
      });
    },
    [traceKey],
  );

  const fit = useCallback(() => {
    const el = wrapRef.current;
    if (!el) return;
    const boxes = Object.values(pos).map((p) => ({ p, ...NODE_SIZE }));
    if (boxes.length === 0) return;
    // Extra room on the right for self-loops.
    const minX = Math.min(...boxes.map((b) => b.p.x - b.w / 2)), maxX = Math.max(...boxes.map((b) => b.p.x + b.w / 2)) + 56;
    const minY = Math.min(...boxes.map((b) => b.p.y - b.h / 2)) - 10, maxY = Math.max(...boxes.map((b) => b.p.y + b.h / 2));
    // Keep the left column clear for the hop stack (330px) and the credential boxes under it.
    const left = el.clientWidth >= 860 ? 354 : 20;
    const aw = el.clientWidth - left - 20, ah = el.clientHeight - 56 - 64;
    const k = Math.min(1.25, aw / (maxX - minX), ah / (maxY - minY));
    if (k < 0.5 && cur) {
      // Too big to read whole: frame the selected hop instead.
      const a = pos[cur.src], b = pos[cur.dst];
      if (a && b) {
        const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
        void rf.setViewport({ zoom: 0.55, x: left + aw / 2 - cx * 0.55, y: 56 + ah / 2 - cy * 0.55 }, { duration: 250 });
        return;
      }
    }
    void rf.setViewport(
      { zoom: k, x: left + (aw - (maxX - minX) * k) / 2 - minX * k, y: 56 + (ah - (maxY - minY) * k) / 2 - minY * k },
      { duration: 250 },
    );
  }, [pos, cur, rf, model]);

  const centerOn = useCallback(
    (p: XY | undefined) => {
      const el = wrapRef.current;
      if (!p || !el) return;
      const k = rf.getZoom();
      void rf.setViewport({ zoom: k, x: el.clientWidth / 2 - p.x * k, y: (56 + el.clientHeight - 64) / 2 - p.y * k }, { duration: 250 });
    },
    [rf],
  );
  const centerSel = useCallback(() => {
    if (!cur) return;
    const a = pos[cur.src], b = pos[cur.dst];
    if (a && b) centerOn({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  }, [cur, pos, centerOn]);


  // Frame the graph when a new trace arrives, and on resize until the user pans or zooms.
  const fitRef = useRef(fit);
  useEffect(() => {
    fitRef.current = fit;
  });
  useEffect(() => {
    userMoved.current = false;
    const t = requestAnimationFrame(() => fitRef.current());
    return () => cancelAnimationFrame(t);
  }, [traceKey]);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setWidth(el.clientWidth);
      if (!userMoved.current) fitRef.current();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    const t = requestAnimationFrame(() => fitRef.current());
    return () => cancelAnimationFrame(t);
  }, [inspectorOpen]);

  // f fits the graph, c centres the selected hop.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      if (document.querySelector(".ti-overlay, .modal-backdrop")) return;
      if (e.key === "f") fitRef.current();
      else if (e.key === "c") centerSel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [centerSel]);

  const resetLayout = () => {
    setMoved({ key: traceKey, pos: {} });
    userMoved.current = false;
    requestAnimationFrame(() => fitRef.current());
  };

  /** Clicking a line steps through its hops, starting from the first. */
  const selectPair = (P: TracePair) => {
    if (P.hops.length === 0) return;
    const i = P.hops.indexOf(sel);
    onSelect(i >= 0 ? P.hops[(i + 1) % P.hops.length] : P.hops[0]);
  };

  // The selected line draws last so it sits on top.
  const order = [...model.pairs].sort((a, b) => Number(a.key === selKey) - Number(b.key === selKey));

  return (
    <section className="tr-canvas" ref={wrapRef} aria-label="Trace graph">
      <ReactFlow
        nodes={nodes}
        edges={[]}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onNodeClick={(_, n) => onNodeClick(n.id)}
        onMoveStart={(e) => {
          if (e) userMoved.current = true;
        }}
        minZoom={0.3}
        maxZoom={2.5}
        nodesConnectable={false}
        elementsSelectable={false}
        zoomOnDoubleClick={false}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={18} size={1.6} color="rgba(15,32,70,.24)" />
        <ViewportPortal>
          <svg className="tr-edges" width={1} height={1} aria-hidden>
            <defs>
              {(Object.keys(COL) as ColKey[]).map((k) => (
                <marker key={k} id={`tr-arr-${k}`} viewBox="0 0 10 10" refX={9} refY={5} markerWidth={9} markerHeight={9} markerUnits="userSpaceOnUse" orient="auto">
                  <path d="M1,1.5 L9,5 L1,8.5" fill="none" stroke={COL[k]} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
                </marker>
              ))}
            </defs>
            {order.map((P) => {
              const g = geo[P.key];
              if (!g) return null;
              const isSel = P.key === selKey || selOutside.has(P.key);
              const denied = P.hops.some((n) => hopAt(n)?.blocked);
              const future = playing && P.hops.length > 0 && P.hops[0] > sel;
              let c: ColKey = P.kind === "seal" ? "g" : P.kind === "outside" ? "o" : denied ? "r" : "n";
              if (isSel) c = c === "n" ? "b" : c === "o" ? "y" : c;
              const dash = P.kind === "outside" ? "1 5" : P.kind === "seal" ? "5 4" : undefined;
              // Call lines carry the sender's credential; outside lines the receiver's onward one.
              const carriesKey = !!cur && (P.key === selKey ? hasDirect(cur) : selOutside.has(P.key) && credOnwardTo(cur, P.dst).length > 0);
              const keyTint = !cur ? "" : keyColor(model, P.key === selKey ? cur.checks.filter((c) => !isOnward(c) && hasCredential(c)) : credOnwardTo(cur, P.dst));
              return (
                <g key={P.key} opacity={future ? 0.2 : 1}>
                  {isSel && <path d={g.d} fill="none" stroke={COL[c]} strokeOpacity={0.14} strokeWidth={7} strokeLinecap="round" />}
                  <path
                    d={g.d}
                    fill="none"
                    stroke={COL[c]}
                    strokeWidth={isSel ? 2 : 1.25}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeDasharray={dash}
                    markerEnd={`url(#tr-arr-${c})`}
                  />
                  <circle cx={g.sp.x} cy={g.sp.y} r={isSel ? 3 : 2.5} fill={COL[c]} />
                  {P.hops.length > 0 && (
                    <path d={g.d} className="tr-hit nopan" onClick={() => selectPair(P)}>
                      <title>{`${model.nodeById.get(P.src)?.name ?? ""} → ${model.nodeById.get(P.dst)?.name ?? ""} · ${P.hops.length} hop${P.hops.length > 1 ? "s" : ""}`}</title>
                    </path>
                  )}
                  {isSel && P.kind !== "seal" && (
                    <Beat key={g.d} d={g.d} mid={g.mid} color={COL[c]} credential={carriesKey} keyTint={keyTint} reduced={reduced} onOpen={() => onOpenCred(sel)} />
                  )}
                </g>
              );
            })}
          </svg>
          {model.pairs.map((P) => {
            const g = geo[P.key];
            // A call line's key is the credential the sender passed; an outside line's is the one
            // the receiver used on the destination (its server_out checks).
            const checksOn = (h: TraceHop | undefined) =>
              !h ? [] : P.kind === "call" ? h.checks.filter((c) => !isOnward(c) && hasCredential(c)) : P.kind === "outside" ? credOnwardTo(h, P.dst) : [];
            const credHops = P.hops.filter((n) => checksOn(hopAt(n)).length > 0);
            if (!g || credHops.length === 0) return null;
            if (P.key === selKey ? !!cur && hasDirect(cur) : selOutside.has(P.key) && !!cur && credOnwardTo(cur, P.dst).length > 0) return null;
            const future = playing && P.hops[0] > sel;
            const keyAlert = credHops.some((n) => worstAuthTone(checksOn(hopAt(n)).map((c) => c.authStatus)) === "bad");
            // The key the line shows: the selected hop's when it's on this line, else the first.
            const shownHop = credHops.includes(sel) ? sel : credHops[0];
            const tint = keyColor(model, checksOn(hopAt(shownHop)));
            const label = `Inspect credential (hop ${credHops.map(pad2).join(", ")})`;
            return (
              <button
                key={P.key}
                type="button"
                className="tr-key nopan nodrag"
                style={{ left: g.mid.x, top: g.mid.y, opacity: future ? 0.3 : 1, color: tint, borderColor: tint }}
                title={label}
                aria-label={label}
                onClick={() => onOpenCred(shownHop)}
              >
                <Icon name="key" size={11} />
                {keyAlert && <span className="tr-key-alert" />}
              </button>
            );
          })}
        </ViewportPortal>
      </ReactFlow>

      {cur?.cred && <CredentialBoxes model={model} hop={cur} onOpen={() => onOpenCred(sel)} />}

      {topLeft}


      {!wide && (
        <div className="tr-tools tr-tools-float nopan">
          <ToolButtons fit={fit} centerSel={centerSel} reset={resetLayout} inspectorOpen={inspectorOpen} onToggleInspector={onToggleInspector} />
        </div>
      )}

    </section>
  );
}

function ToolButtons({ fit, centerSel, reset, inspectorOpen, onToggleInspector }: {
  fit: () => void;
  centerSel: () => void;
  reset: () => void;
  inspectorOpen: boolean;
  onToggleInspector: () => void;
}) {
  return (
    <>
      <button type="button" onClick={fit} title="Fit graph to view (F)" aria-label="Fit graph to view">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
        </svg>
      </button>
      <button type="button" onClick={centerSel} title="Center selected hop (C)" aria-label="Center selected hop">
        <Icon name="target" size={15} />
      </button>
      <button type="button" onClick={reset} title="Reset layout" aria-label="Reset layout">
        <Icon name="refresh" size={14} />
      </button>
      <button
        type="button"
        className={inspectorOpen ? "on" : ""}
        onClick={onToggleInspector}
        title="Toggle inspector"
        aria-label="Toggle inspector"
        aria-pressed={inspectorOpen}
      >
        <Icon name="sidebar" size={14} />
      </button>
    </>
  );
}

/** The hop carried a credential from its sender to its receiver (client_out / server_in). */
const hasDirect = (h: TraceHop) => h.checks.some((c) => !isOnward(c) && hasCredential(c));
/** The receiver's onward checks to one destination that carried a credential. */
const credOnwardTo = (h: TraceHop, nodeId: string) => onwardTo(h, nodeId).filter(hasCredential);

/**
 * The selected hop's credentials, bottom-left of the graph, one box per leg: the one the sender
 * passed to the receiver (client_out / server_in) and the one the receiver then used on a
 * destination (server_out). Each shows only when the hop had that leg.
 */
function CredentialBoxes({ model, hop, onOpen }: { model: TraceModel; hop: TraceHop; onOpen: () => void }) {
  // Only checks that carried a credential get a box.
  const direct = hop.checks.filter((c) => !isOnward(c) && hasCredential(c));
  const onward = hop.onward.filter(hasCredential);
  const name = (id: string) => model.nodeById.get(id)?.name ?? "";
  const onwardDest = onward.map((c) => (c.destination || "").trim()).find(Boolean) ?? "";
  const destName = !onwardDest
    ? "a destination"
    : onwardDest.toLowerCase().startsWith("bafy")
      ? model.nodes.find((n) => n.did === onwardDest)?.name ?? trunc(onwardDest, 10, 6)
      : parseDestination(onwardDest).host || onwardDest;
  if (direct.length === 0 && onward.length === 0) return null;
  return (
    <div className="tr-credboxes nopan">
      {direct.length > 0 && (
        <CredentialBox
          checks={direct}
          tint={keyColor(model, direct)}
          from={name(hop.src)}
          to={name(hop.dst)}
          onOpen={onOpen}
        />
      )}
      {onward.length > 0 && <CredentialBox checks={onward} tint={keyColor(model, onward)} from={name(hop.dst)} to={destName} onward onOpen={onOpen} />}
    </div>
  );
}

function CredentialBox({ checks, tint, from, to, onward = false, onOpen }: {
  checks: AuthEvidence[];
  /** The credential's key colour, matching its key on the graph. */
  tint: string;
  from: string;
  to: string;
  onward?: boolean;
  onOpen: () => void;
}) {
  const tone = worstAuthTone(checks.map((c) => c.authStatus));
  // The result shown is the worst check's, so a rejected or unseen check isn't hidden by an accepted one.
  const worst = checks.find((c) => authTone(c.authStatus) === tone) ?? checks[0];
  const uniq = (xs: string[]) => [...new Set(xs.filter(Boolean))];
  const seenBy = uniq(checks.map((c) => sentence(c.source))).join(", ");
  const ids = uniq(checks.map((c) => c.credentialID));
  const methods = uniq(checks.map((c) => authMethodLabel(c.authMethod)));
  const rows: { k: string; v: string; full?: string; mono?: boolean; tone?: string }[] = [
    { k: "Seen by", v: seenBy },
    { k: ids.length > 1 ? "Credential IDs" : "Credential ID", v: ids.map((id) => trunc(id, 10, 6)).join(", "), full: ids.join(", "), mono: true },
    { k: "Auth method", v: methods.join(", ") },
    { k: "Result", v: authStatusLabel(worst.authStatus), tone },
  ];
  return (
    <div className={`tr-credbox${onward ? " onward" : ""}`} role="region" aria-label={onward ? "Credential used on the destination" : "Credential passed on this hop"}>
      {/* Who the credential went between. */}
      <div className="tr-credbox-head">
        <span className="tr-credbox-ic" style={{ color: tint, background: `${tint}1F` }}>
          <Icon name="key" size={14} />
        </span>
        <div className="tr-credbox-title">
          <span className="t" title={`${from} → ${to}`}>
            {from} <span className="arrow">→</span> {to}
          </span>
        </div>
      </div>
      <dl className="tr-credbox-rows">
        {rows.map((r) => (
          <div key={r.k}>
            <dt>{r.k}</dt>
            <dd className={[r.v ? "" : "empty", r.mono ? "" : "plain", r.tone ? `res ${r.tone}` : ""].filter(Boolean).join(" ")} title={r.full || undefined}>
              {r.v || "Not reported"}
            </dd>
          </div>
        ))}
      </dl>
      <button type="button" className="tr-credbox-more" onClick={onOpen}>
        View credential details
      </button>
    </div>
  );
}
