/**
 * Flow data — adapts a real Intent + its Interactions into the structure the
 * FlowCanvas + step rail consume.
 *
 * Inputs:
 *   - intent: from /intent-info or /intent-list
 *   - interactions: from /intent-info.interactions (each interaction is one hop)
 *   - resolve: DID → { name, kind } lookup from DirectoryContext
 *
 * Output: a `Flow` with normalized 0..1 node coordinates, laid out left-to-right
 * by call depth (initiator → each hop in its own column).
 */

import type { Intent, Interaction } from "../../types";
import type { DiagramInteraction, IntentBlock, IntentDiagram } from "../../data/api";
import type { useResolveName } from "../../context/DirectoryContext";

export type FlowNodeKind = "human" | "agent" | "tool" | "provenance";
export type FlowDirection = "request" | "response";
export type FlowVerdict = "allowed" | "blocked";

export interface FlowNode {
  id: string;
  kind: FlowNodeKind;
  name: string;
  label: string;
  /** Raw DID this node was built from — `id` is a sanitized derivative. */
  did?: string;
  /** normalized 0..1 — set by depthLayout */
  x: number;
  y: number;
  /** true if this node was the source/target of a blocked hop */
  threat?: boolean;
}

export interface FlowStep {
  from: string;
  to: string;
  dir: FlowDirection;
  title: string;
  summary: string;
  verdict: FlowVerdict;
  checks: { identity: boolean; trust: boolean; scope: boolean };
  latency: number;
  /** ID of the TraceSpan this step corresponds to (for TraceInspector) */
  spanId: string;
  /**
   * Source interaction, when this step came from /intent-diagram. Steps are
   * keyed off this rather than `from>to` because a parallel flow can hit the
   * same node pair more than once.
   */
  interactionID?: string;
  /** Ordering stamp from /intent-diagram; equal values mean concurrent hops. */
  epoch?: number;
}

export interface TraceSpan {
  id: string;
  name: string;
  kind: "chain" | "human" | "agent" | "tool";
  label: string;
  status: "ok" | "blocked";
  input: string;
  output: string;
  model: string | null;
  epoch?: number;
  metadata: Record<string, unknown>;
  parentId: string | null;
  children: TraceSpan[];
  signature?: string;
}

export interface FlowTrace {
  trace: TraceSpan;
  spanById: Record<string, TraceSpan>;
  traceId: string;
  sessionId: string;
  userId: string;
  env: string;
  totalTokensIn: number;
  totalTokensOut: number;
  totalCost: number;
}

export interface SealEdge {
  /** Node whose envelope is being written to the ledger. */
  from: string;
  to: string;
  /** Empty for the closing seal — the drop itself carries the meaning. */
  label: string;
  /** True when this seal was triggered by a blocked hop rather than completion. */
  threat: boolean;
  /** Step that triggers this seal, so playback can light it at the right beat. */
  stepIndex: number;
}

export interface Flow {
  intentId: string;
  intent: Intent;
  nodes: FlowNode[];
  nodeById: Record<string, FlowNode>;
  /** unique directed edges (from > to). */
  edges: [string, string][];
  /** Terminal edges into the provenance layer. */
  sealEdges: SealEdge[];
  steps: FlowStep[];
  status: "halted" | "completed";
  trace: FlowTrace;
  /** Raw /intent-diagram response — shown as-is in the JSON tab. */
  rawDiagram?: unknown;
}

/* ------- depth layout (DAG layering) ------- */

/**
 * Layout rules this pass guarantees, in priority order:
 *  1. The intent's initiator owns the leftmost column, on its own.
 *  2. Columns follow call depth, so the diagram reads left → right in call order.
 *  3. Within a column, nodes are ordered to minimise edge crossings.
 *  4. Nodes keep a minimum gap so icons and captions never sit on top of each other.
 */
const X_BAND = { start: 0.11, end: 0.89 };
/** Stops above the provenance row (y 0.82) so the ledger never collides with a node. */
const Y_BAND = { start: 0.12, end: 0.72 };
/** Normalised minimums. Below these the band widens rather than letting nodes touch. */
const MIN_ROW_GAP = 0.16;
const MIN_COL_GAP = 0.12;

/**
 * Lay nodes out by longest-path depth from the initiator instead of by role.
 *
 * A role-based layout collapses every agent into a single "worker" column, so a chain
 * reads as one vertical stack and a parallel flow (A fans out to B and C, both returning
 * to A) draws every edge as an intra-column arc. Layering by depth gives each hop its own
 * column — a horizontal chain — and lets concurrent siblings share one.
 *
 * Response hops are excluded from the depth graph: they point back up the tree
 * and would otherwise form cycles that have no valid layering.
 */
function depthLayout(nodes: FlowNode[], steps: FlowStep[]): FlowNode[] {
  const ids = new Set(nodes.map((n) => n.id));

  // First-appearance order, used to seed column ordering before crossing reduction.
  const order: Record<string, number> = {};
  let o = 0;
  for (const s of steps) {
    for (const id of [s.from, s.to]) {
      if (order[id] == null) order[id] = o++;
    }
  }

  // Forward (request) edges only, deduped.
  const outAdj = new Map<string, string[]>();
  const inAdj = new Map<string, string[]>();
  const indeg = new Map<string, number>();
  for (const id of ids) { outAdj.set(id, []); inAdj.set(id, []); indeg.set(id, 0); }

  const seenEdge = new Set<string>();
  const forward: Array<[string, string]> = [];
  for (const s of steps) {
    if (s.dir === "response") continue;
    if (s.from === s.to) continue;
    if (!ids.has(s.from) || !ids.has(s.to)) continue;
    const key = `${s.from}>${s.to}`;
    if (seenEdge.has(key)) continue;
    seenEdge.add(key);
    forward.push([s.from, s.to]);
    outAdj.get(s.from)!.push(s.to);
    inAdj.get(s.to)!.push(s.from);
    indeg.set(s.to, indeg.get(s.to)! + 1);
  }

  // Kahn's topological sort, propagating longest-path depth.
  const depth = new Map<string, number>();
  for (const id of ids) depth.set(id, 0);

  const queue = Array.from(ids).filter((id) => indeg.get(id) === 0);
  queue.sort((a, b) => (order[a] ?? 0) - (order[b] ?? 0));
  const settled = new Set<string>();

  while (queue.length) {
    const id = queue.shift()!;
    settled.add(id);
    for (const next of outAdj.get(id)!) {
      depth.set(next, Math.max(depth.get(next)!, depth.get(id)! + 1));
      indeg.set(next, indeg.get(next)! - 1);
      if (indeg.get(next) === 0) queue.push(next);
    }
  }

  // Anything left unsettled sits in a request-edge cycle (a re-entrant agent).
  // Best-effort: place it one column past its deepest parent so it still lands
  // somewhere sensible rather than collapsing to column 0.
  for (const [from, to] of forward) {
    if (!settled.has(to)) {
      depth.set(to, Math.max(depth.get(to)!, depth.get(from)! + 1));
    }
  }

  // Rule 1: the initiator is the flow's origin, so it alone holds column 0.
  // Anything else that happens to have no parent is pushed one column in rather
  // than sharing the left edge and muddying where the flow starts.
  const initiatorId = flowOriginId(nodes, steps);
  if (initiatorId && ids.has(initiatorId)) {
    depth.set(initiatorId, 0);
    for (const id of ids) {
      if (id !== initiatorId && (depth.get(id) ?? 0) === 0) depth.set(id, 1);
    }
  }

  // Group into columns.
  const byDepth = new Map<number, FlowNode[]>();
  for (const n of nodes) {
    const d = depth.get(n.id) ?? 0;
    if (!byDepth.has(d)) byDepth.set(d, []);
    byDepth.get(d)!.push(n);
  }

  const depths = Array.from(byDepth.keys()).sort((a, b) => a - b);
  const columns = depths.map((d) => {
    const col = byDepth.get(d)!;
    col.sort((a, b) => (order[a.id] ?? 0) - (order[b.id] ?? 0));
    return col;
  });

  reduceCrossings(columns, inAdj, outAdj, initiatorId);

  // Rule 4: spread each axis across its band, widening the gap floor before
  // letting two nodes land close enough for their icons or captions to touch.
  const colGap = columns.length > 1
    ? Math.max(MIN_COL_GAP, (X_BAND.end - X_BAND.start) / (columns.length - 1))
    : 0;
  const colSpan = colGap * (columns.length - 1);
  const xStart = columns.length > 1 ? Math.max(0.06, X_BAND.start - (colSpan - (X_BAND.end - X_BAND.start)) / 2) : 0.5;

  columns.forEach((col, i) => {
    const x = columns.length === 1 ? 0.5 : xStart + colGap * i;
    const k = col.length;
    const rowGap = k > 1
      ? Math.max(MIN_ROW_GAP, (Y_BAND.end - Y_BAND.start) / (k - 1))
      : 0;
    const span = rowGap * (k - 1);
    const mid = (Y_BAND.start + Y_BAND.end) / 2;
    col.forEach((n, j) => {
      n.x = x;
      n.y = k === 1 ? mid : mid - span / 2 + rowGap * j;
    });
  });

  return nodes;
}

/**
 * Whoever the flow starts from: the human who raised the intent, else the sender
 * of the very first hop. Shared with the provenance pass so the seal drops from
 * the same node the diagram starts at.
 */
function flowOriginId(nodes: FlowNode[], steps: FlowStep[]): string | undefined {
  return nodes.find((n) => n.kind === "human")?.id ?? steps[0]?.from;
}

/**
 * Rule 3: order each column by the median position of its neighbours in the
 * previous/next column — the standard barycenter sweep. Without it, columns keep
 * first-appearance order and edges cross each other for no structural reason.
 * The initiator is pinned to the top of column 0 so the origin never drifts.
 */
function reduceCrossings(
  columns: FlowNode[][],
  inAdj: Map<string, string[]>,
  outAdj: Map<string, string[]>,
  initiatorId: string | undefined,
) {
  const indexIn = (col: FlowNode[]) => {
    const m = new Map<string, number>();
    col.forEach((n, i) => m.set(n.id, i));
    return m;
  };

  /** Median neighbour index, or -1 when a node has no neighbour in that column. */
  const median = (ids: string[], pos: Map<string, number>): number => {
    const xs = ids.map((id) => pos.get(id)).filter((v): v is number => v != null).sort((a, b) => a - b);
    if (xs.length === 0) return -1;
    const mid = Math.floor(xs.length / 2);
    return xs.length % 2 ? xs[mid] : (xs[mid - 1] + xs[mid]) / 2;
  };

  const sweep = (col: FlowNode[], ref: Map<string, number>, adj: Map<string, string[]>) => {
    const keyed = col.map((n, i) => ({ n, i, m: median(adj.get(n.id) ?? [], ref) }));
    keyed.sort((a, b) => {
      // Nodes with no neighbour keep their current slot rather than piling at the top.
      if (a.m === -1 || b.m === -1) return a.i - b.i;
      return a.m === b.m ? a.i - b.i : a.m - b.m;
    });
    return keyed.map((k) => k.n);
  };

  for (let pass = 0; pass < 4; pass++) {
    for (let i = 1; i < columns.length; i++) {
      columns[i] = sweep(columns[i], indexIn(columns[i - 1]), inAdj);
    }
    for (let i = columns.length - 2; i >= 0; i--) {
      columns[i] = sweep(columns[i], indexIn(columns[i + 1]), outAdj);
    }
  }

  if (initiatorId && columns[0]) {
    const at = columns[0].findIndex((n) => n.id === initiatorId);
    if (at > 0) columns[0].unshift(...columns[0].splice(at, 1));
  }
}


/* ------- parallel rounds ------- */

/**
 * Group step indices into rounds that play together.
 *
 * Each interaction now gets its own beat for individual playback.
 * Previously concurrent interactions (fan-outs) are now played sequentially,
 * one beat per interaction.
 */
export function groupParallelRounds(steps: FlowStep[]): number[][] {
  // Each step gets its own round - one beat per interaction
  return steps.map((_, i) => [i]);
}


/* ------- provenance layer ------- */

export const PROVENANCE_ID = "nd_provenance";

/**
 * Every flow terminates in the provenance layer — and the seal is always
 * drawn from the intent's initiator, never from whichever node happened to
 * be holding the envelope on the last (or a blocked) hop. The envelope is
 * the initiator's the whole time; the chain in between is just delegation.
 * That's true whether the flow completed cleanly or was halted by a threat —
 * the seal still runs from the initiator, just colored red instead of green.
 *
 * The node is positioned directly rather than by the layout pass — it isn't a
 * participant in the call chain, it's the ledger the chain drops into, so it
 * sits centred beneath the graph instead of taking a depth column.
 */
function attachProvenance(steps: FlowStep[], nodes: FlowNode[]): { node: FlowNode | null; sealEdges: SealEdge[] } {
  if (steps.length === 0) return { node: null, sealEdges: [] };

  const last = steps[steps.length - 1];
  // Prefer the explicit human node; a purely agent-to-agent chain (no human
  // in it) falls back to whoever sent the very first hop. Same helper the layout
  // uses, so the seal always drops from the node sitting in the first column.
  const initiatorId = flowOriginId(nodes, steps) ?? last?.to;
  const anyBlocked = steps.some((s) => s.verdict === "blocked");

  const sealEdges: SealEdge[] = initiatorId
    ? [{ from: initiatorId, to: PROVENANCE_ID, label: "", threat: anyBlocked, stepIndex: steps.length - 1 }]
    : [];

  // Sit directly beneath the initiator — the seal line runs from there, so the drop reads as a
  // short vertical hop rather than a long diagonal across the chain. Y is kept well inside the
  // frame: the node's caption renders below it and would otherwise clip off the canvas.
  // Rule: the ledger sits directly beneath whichever node writes to it, so the
  // seal reads as a short vertical drop rather than a diagonal across the chain.
  // Clamped inside the frame because the caption renders below the icon.
  const writerId = sealEdges[0]?.from ?? initiatorId;
  const anchor = nodes.find((n) => n.id === writerId) ?? (last ? nodes.find((n) => n.id === last.to) : undefined);
  const node: FlowNode = {
    id: PROVENANCE_ID,
    kind: "provenance",
    name: "Provenance Layer",
    label: "",
    x: anchor ? Math.min(0.92, Math.max(0.08, anchor.x)) : 0.5,
    y: 0.86,
  };

  return { node, sealEdges };
}

/* ------- helpers ------- */

function shortDid(did: string): string {
  if (!did) return "—";
  return did.length > 18 ? `${did.slice(0, 10)}…${did.slice(-4)}` : did;
}

/* ------- main builder ------- */

interface BuildArgs {
  intent: Intent;
  interactions: Interaction[];
  resolve: ReturnType<typeof useResolveName>;
}

export function buildFlowFromIntent({ intent, interactions, resolve }: BuildArgs): Flow {
  // Chronological order (oldest first).
  const sorted = [...interactions].sort((a, b) => b.created - a.created);


  const nodesById = new Map<string, FlowNode>();
  const idForDid = (did: string): string => `nd_${sanitize(did)}`;

  /**
   * Resolve a node's display name.
   *   1. Directory (full /agents-list / /tools-list / /users-list match)
   *   2. Backend-supplied fromName/toName on the interaction (passed in here)
   *   3. Shortened DID as last resort
   */
  const ensureNode = (did: string, apiName?: string): FlowNode => {
    const id = idForDid(did);
    if (nodesById.has(id)) {
      const existing = nodesById.get(id)!;
      // Upgrade name if we now have a better one (directory wins, then apiName)
      if ((!existing.name || existing.name.includes("…")) && apiName && !apiName.includes("…")) {
        existing.name = apiName;
      }
      return existing;
    }
    const resolved = resolve(did);
    const kind: FlowNodeKind =
      resolved.kind === "tool" ? "tool" : resolved.kind === "user" ? "human" : "agent";
    // Directory hit (kind set) → use directory name; else prefer backend apiName; else shortDid.
    const name = resolved.kind
      ? resolved.name
      : apiName && apiName.trim() && !apiName.includes("…")
      ? apiName.trim()
      : resolved.name || shortDid(did);
    const node: FlowNode = {
      id,
      kind,
      name,
      did,
      label: kind === "tool" ? "App" : "",
      x: 0,
      y: 0,
    };
    nodesById.set(id, node);
    return node;
  };

  // One step per real interaction — no synthetic operator hops.
  // spanId is populated after the trace tree is built below.
  const rawSteps: Omit<FlowStep, "spanId">[] = [];

  for (const ixn of sorted) {
    const fromNode = ensureNode(ixn.initiator.id, ixn.initiator.name);
    const toNode = ensureNode(ixn.target.id, ixn.target.name);
    const fromName = fromNode.name;
    const toName = toNode.name;
    const isBlocked = ixn.threat;
    const isToTool = toNode.kind === "tool";
    rawSteps.push({
      from: fromNode.id,
      to: toNode.id,
      dir: "request",
      title: isToTool ? `Invoke ${toName}` : `Delegate · ${toName}`,
      summary: isBlocked
        ? `Scope check FAILED — ${fromName} requested ${toName}, beyond its granted policy. The call was blocked.`
        : isToTool
        ? `${fromName} invoked ${toName}. Capability token verified, rate-limit within budget.`
        : `${fromName} delegated work to ${toName}. Identity, trust, and scope checks passed.`,
      verdict: isBlocked ? "blocked" : "allowed",
      checks: { identity: true, trust: true, scope: !isBlocked },
      latency: Math.max(40, Math.floor(ixn.runtime || Math.floor(60 + Math.random() * 400))),
      // Links this step back to the real Interaction record, so the trace
      // inspector can show the exact same raw data as the interaction drawer.
      interactionID: ixn.id,
    });
    // Only the target — the entity where the threat was detected — gets the
    // red box. The initiator (`fromNode`) is the culprit, not the victim, so
    // it keeps its normal styling.
    if (isBlocked) {
      toNode.threat = true;
    }
  }

  // Final node set (only nodes that appear in any step) and unique directed edges.
  const used = new Set<string>();
  for (const s of rawSteps) {
    used.add(s.from);
    used.add(s.to);
  }
  const nodes = Array.from(nodesById.values()).filter((n) => used.has(n.id));

  const seenEdges = new Set<string>();
  const edges: [string, string][] = [];
  for (const s of rawSteps) {
    const key = `${s.from}>${s.to}`;
    if (!seenEdges.has(key)) {
      seenEdges.add(key);
      edges.push([s.from, s.to]);
    }
  }

  depthLayout(nodes, rawSteps as FlowStep[]);

  const halted = rawSteps.some((s) => s.verdict === "blocked");

  // ---- Build the nested trace/span tree ----
  const allSpans: TraceSpan[] = [];
  const mkSpan = (s: Omit<TraceSpan, "children">): TraceSpan => {
    const span: TraceSpan = { ...s, children: [] };
    allSpans.push(span);
    return span;
  };

  const traceStatus: TraceSpan["status"] = halted ? "blocked" : "ok";

  const rootSpan = mkSpan({
    id: `sp_${sanitize(intent.id)}_root`,
    name: `Intent · ${intent.id.slice(-8)}`,
    kind: "chain",
    label: "TRACE",
    status: traceStatus,
    input: `Execute intent: ${intent.id}`,
    output: halted
      ? "Intent halted: policy violation detected. No side-effects committed."
      : "Intent finished. All identity, trust, and scope checks passed.",
    model: null,
    parentId: null,
    metadata: { intentId: intent.id, status: halted ? "halted" : "finished" },
  });

  // step key → span id (for populating FlowStep.spanId)
  const stepSpan = new Map<string, string>();
  const markStep = (fromId: string, toId: string, spanId: string) => {
    stepSpan.set(`${fromId}>${toId}`, spanId);
    stepSpan.set(`${toId}>${fromId}`, spanId);
  };

  const humanNode = nodes.find((n) => n.kind === "human");

  // Build properly nested spans using a call-stack.
  // Each interaction (from→to) is nested under the span whose entity last
  // pushed `from`. Popping handles response returns and parallel branches.
  const entityStack: Array<{ did: string; span: TraceSpan }> = [
    { did: "__root__", span: rootSpan },
  ];

  // If a human initiated the intent, add them as the first span under root
  // and seed the stack with their DID so agent calls from the human nest under them.
  const humanDid = sorted.find((ix) => resolve(ix.initiator.id).kind === "user")?.initiator.id ?? null;
  if (humanDid && humanNode) {
    const humanSpanId = `sp_${sanitize(intent.id)}_human`;
    const humanSpan = mkSpan({
      id: humanSpanId,
      name: humanNode.name,
      kind: "human",
      label: "User",
      status: "ok",
      input: intent.name || `Intent ${intent.id.slice(-8)}`,
      output: halted ? "Intent completed with policy violation." : "Intent completed successfully.",
      model: null,
      parentId: rootSpan.id,
      metadata: { intentId: intent.id, role: "initiator" },
    });
    rootSpan.children.push(humanSpan);
    entityStack.push({ did: humanDid, span: humanSpan });
  }

  // Counter per target DID so repeated calls to the same target get unique IDs.
  const spanSeq = new Map<string, number>();

  for (const ix of sorted) {
    const fromDid = ix.initiator.id;
    const toDid = ix.target.id;
    const fromNodeId = idForDid(fromDid);
    const toNodeId = idForDid(toDid);
    const toNode = nodesById.get(toNodeId);
    const fromNode = nodesById.get(fromNodeId);
    const isBlocked = ix.threat;
    const isTool = ix.targetType === "tool";

    // Pop back to the frame that matches the current initiator.
    while (entityStack.length > 1 && entityStack[entityStack.length - 1].did !== fromDid) {
      entityStack.pop();
    }

    const parent = entityStack[entityStack.length - 1].span;
    const seq = (spanSeq.get(toDid) || 0) + 1;
    spanSeq.set(toDid, seq);
    const spanId = `sp_${sanitize(intent.id)}_${sanitize(toDid)}_${seq}`;

    const newSpan = mkSpan({
      id: spanId,
      name: toNode?.name || ix.target.name || shortDid(toDid),
      kind: isTool ? "tool" : "agent",
      label: toNode?.label || (isTool ? "App" : "Agent"),
      status: isBlocked ? "blocked" : "ok",
      input: "",
      output: "",
      model: null,
      parentId: parent.id,
      metadata: isTool
        ? { provider: "service", scope: toNode?.label || "unknown", caller: fromNode?.name || fromDid, intentId: intent.id }
        : { agentId: toDid, intentId: intent.id },
    });

    parent.children.push(newSpan);
    markStep(fromNodeId, toNodeId, spanId);

    // Only agents can make further calls — push them so their children nest under them.
    if (!isTool) {
      entityStack.push({ did: toDid, span: newSpan });
    }
  }

  const spanById: Record<string, TraceSpan> = {};
  for (const s of allSpans) spanById[s.id] = s;

  const traceId = `tr_${sanitize(intent.id).slice(-8)}`;
  const sessionId = `sess_${sanitize(intent.id).slice(-6)}`;

  const flowTrace: FlowTrace = {
    trace: rootSpan,
    spanById,
    traceId,
    sessionId,
    userId: humanNode?.name || intent.initiator?.name || "operator",
    env: "prod",
    totalTokensIn: 0,
    totalTokensOut: 0,
    totalCost: 0,
  };

  // Attach spanId to each step
  const steps: FlowStep[] = rawSteps.map((s) => ({
    ...s,
    spanId: stepSpan.get(`${s.from}>${s.to}`) || rootSpan.id,
  }));

  // Appended after layout so the ledger keeps its fixed position.
  const { node: provNode, sealEdges } = attachProvenance(steps, nodes);
  if (provNode) nodes.push(provNode);

  return {
    intentId: intent.id,
    intent,
    nodes,
    nodeById: Object.fromEntries(nodes.map((n) => [n.id, n])),
    edges,
    sealEdges,
    steps,
    status: halted ? "halted" : "completed",
    trace: flowTrace,
  };
}

// ---- Diagram-based full flow builder (uses /intent-diagram flat interactions) ----

export function buildFlowFromDiagram(intent: Intent, diagram: IntentDiagram): Flow {
  const { basicInfo, interactions } = diagram;

  // Sort by epoch ascending so the call chain nests correctly.
  const sorted = [...interactions].sort((a, b) => a.epoch - b.epoch);

  // ── Nodes ──────────────────────────────────────────────────────────────────
  const nodesById = new Map<string, FlowNode>();
  const idForDid = (did: string): string => `nd_${sanitize(did)}`;

  const ensureNode = (did: string, name: string, kind: FlowNodeKind, label: string): FlowNode => {
    const id = idForDid(did);
    if (!nodesById.has(id)) {
      nodesById.set(id, { id, kind, name: name || shortDid(did), did, label, x: 0, y: 0 });
    }
    return nodesById.get(id)!;
  };

  // The initiator is always human.
  const humanNode = ensureNode(basicInfo.initiatorDID, basicInfo.initiatorName, "human", "User");

  // ── Trace spans ────────────────────────────────────────────────────────────
  const allSpans: TraceSpan[] = [];
  const mkSpan = (s: Omit<TraceSpan, "children">): TraceSpan => {
    const sp: TraceSpan = { ...s, children: [] };
    allSpans.push(sp);
    return sp;
  };

  const halted = basicInfo.threatDetected || sorted.some((ix) => ix.threat);

  // Nesting is tracked per-DID rather than on a single stack. A stack can only
  // hold one open branch, so in a parallel flow the second fan-out hop would
  // pop the first sibling's frame and reparent everything under it. Each agent
  // instead owns its own frames, so concurrent siblings stay open at once.
  //
  // A DID can be activated more than once (a re-entrant agent), so frames are
  // stored as a list and looked up by epoch.
  let rootSpan: TraceSpan | null = null;
  const frames = new Map<string, Array<{ epoch: number; span: TraceSpan }>>();

  const openFrame = (did: string, epoch: number, span: TraceSpan) => {
    if (!frames.has(did)) frames.set(did, []);
    frames.get(did)!.push({ epoch, span });
  };

  /** Most recent frame for `did` at or before `epoch`. */
  const frameFor = (did: string, epoch: number): TraceSpan | null => {
    const list = frames.get(did);
    if (!list || list.length === 0) return null;
    let best: TraceSpan | null = null;
    for (const f of list) {
      if (f.epoch <= epoch) best = f.span;
    }
    return best ?? list[list.length - 1].span;
  };

  // ── Steps + span bookkeeping ────────────────────────────────────────────────
  // rawSteps includes ALL interactions so the hop count equals interactionsCount.
  const rawSteps: Omit<FlowStep, "spanId">[] = [];
  // Keyed by interactionID, not "fromId>toId" — a parallel flow can hit the
  // same node pair twice and the second write would clobber the first.
  const stepSpan = new Map<string, string>();

  let spanSeq = 0;
  const spanIdFor = (ix: DiagramInteraction, prefix = ""): string =>
    `sp_${sanitize(intent.id)}_${prefix}${sanitize(ix.interactionID) || `ix${spanSeq++}`}`;

  // Responses are collected and processed after all outbound spans are built so
  // every frame exists before we look up the sender's.
  const pendingResponses: typeof sorted = [];

  for (const ix of sorted) {
    const fromDid = ix.initiator;
    const toDid = ix.to;
    const isResponse = ix.type === "response";
    const isBlocked = ix.threat;

    const toKind: FlowNodeKind = toDid === basicInfo.initiatorDID ? "human" : "agent";
    const toLabel = toDid === basicInfo.initiatorDID ? "User" : "Agent";

    const fromNode = ensureNode(
      fromDid,
      ix.initiatorName,
      fromDid === basicInfo.initiatorDID ? "human" : "agent",
      fromDid === basicInfo.initiatorDID ? "User" : "Agent",
    );
    const toNode = ensureNode(toDid, ix.toName, toKind, toLabel);
    if (isBlocked) toNode.threat = true;

    const fromNodeId = idForDid(fromDid);
    const toNodeId = idForDid(toDid);

    // All interactions contribute to the step rail (hop count = interactionsCount).
    rawSteps.push({
      from: fromNodeId,
      to: toNodeId,
      interactionID: ix.interactionID,
      epoch: ix.epoch,
      dir: isResponse ? "response" : "request",
      title: isResponse ? `Response · ${fromNode.name}` : `Delegate · ${toNode.name}`,
      summary: isBlocked
        ? `Scope check FAILED — ${fromNode.name} → ${toNode.name} was blocked.`
        : isResponse
        ? `${fromNode.name} returned result to ${toNode.name}.`
        : `${fromNode.name} delegated work to ${toNode.name}. Checks passed.`,
      verdict: isBlocked ? "blocked" : "allowed",
      checks: { identity: true, trust: true, scope: !isBlocked },
      latency: 0,
    });

    if (isResponse) {
      pendingResponses.push(ix);
      continue;
    }

    // Outbound: parent is the frame the sender was already running in. Looking
    // it up per-DID (rather than popping a shared stack) is what lets two
    // fan-out hops from the same agent both nest under it.
    const parent = frameFor(fromDid, ix.epoch);

    const spanId = spanIdFor(ix);

    const span = mkSpan({
      id: spanId,
      name: ix.initiatorName || fromNode.name,
      kind: "agent",
      label: "Agent",
      status: isBlocked ? "blocked" : "ok",
      input: ix.message || "",
      output: "",
      model: null,
      epoch: ix.epoch || undefined,
      parentId: parent ? parent.id : null,
      metadata: {
        interactionID: ix.interactionID,
        from: ix.initiatorName,
        to: ix.toName,
        fromDid,
        toDid,
      },
    });

    if (parent) {
      parent.children.push(span);
    } else {
      rootSpan = span; // first outbound span is the tree root
    }
    stepSpan.set(ix.interactionID, spanId);
    openFrame(toDid, ix.epoch, span);
  }

  // Response interactions: nest each response span under the outbound span of
  // the sender. This gives chainDepth total spans across the whole tree.
  for (const ix of pendingResponses) {
    const fromDid = ix.initiator;
    const toDid = ix.to;
    const isBlocked = ix.threat;

    const toKind: FlowNodeKind = toDid === basicInfo.initiatorDID ? "human" : "agent";
    const toLabel = toDid === basicInfo.initiatorDID ? "User" : "Agent";

    ensureNode(toDid, ix.toName, toKind, toLabel);

    // Nest under the frame the responder was running in at the time it replied.
    // Matching on epoch matters for a re-entrant agent, which has more than one
    // frame and would otherwise always resolve to the last.
    const senderSpan = frameFor(fromDid, ix.epoch) ?? rootSpan!;

    const spanId = spanIdFor(ix, "resp_");

    const responseSpan = mkSpan({
      id: spanId,
      name: ix.initiatorName,
      kind: toKind,
      label: toLabel,
      status: isBlocked ? "blocked" : "ok",
      input: ix.message || "",
      output: "",
      model: null,
      epoch: ix.epoch || undefined,
      parentId: senderSpan.id,
      metadata: {
        interactionID: ix.interactionID,
        from: ix.initiatorName,
        to: ix.toName,
        fromDid,
        toDid,
      },
    });

    senderSpan.children.push(responseSpan);
    stepSpan.set(ix.interactionID, spanId);
  }

  // ── Assemble nodes / edges ─────────────────────────────────────────────────
  const used = new Set<string>();
  for (const s of rawSteps) { used.add(s.from); used.add(s.to); }
  used.add(humanNode.id);

  const nodes = Array.from(nodesById.values()).filter((n) => used.has(n.id));

  const seenEdges = new Set<string>();
  const edges: [string, string][] = [];
  for (const s of rawSteps) {
    const key = `${s.from}>${s.to}`;
    if (!seenEdges.has(key)) { seenEdges.add(key); edges.push([s.from, s.to]); }
  }

  // Depth layering, not role tiers — a parallel flow needs each hop in its own
  // column with concurrent siblings sharing one.
  depthLayout(nodes, rawSteps as FlowStep[]);

  const spanById: Record<string, TraceSpan> = {};
  for (const s of allSpans) spanById[s.id] = s;

  const steps: FlowStep[] = rawSteps.map((s) => ({
    ...s,
    spanId: (s.interactionID ? stepSpan.get(s.interactionID) : undefined) || rootSpan!.id,
  }));

  // Appended after layout so the ledger keeps its fixed position.
  const { node: provNode, sealEdges } = attachProvenance(steps, nodes);
  if (provNode) nodes.push(provNode);

  const flowTrace: FlowTrace = {
    trace: rootSpan!,
    spanById,
    traceId: `tr_${sanitize(intent.id).slice(-8)}`,
    sessionId: `sess_${sanitize(intent.id).slice(-6)}`,
    userId: basicInfo.initiatorName || intent.initiator?.name || "operator",
    env: "prod",
    totalTokensIn: 0,
    totalTokensOut: 0,
    totalCost: 0,
  };

  return {
    intentId: intent.id,
    intent,
    nodes,
    nodeById: Object.fromEntries(nodes.map((n) => [n.id, n])),
    edges,
    sealEdges,
    steps,
    status: halted ? "halted" : "completed",
    trace: flowTrace,
    rawDiagram: diagram,
  };
}

// ---- Block-data-based trace builder (uses /intent-block-data) ----
//
// Outbound blocks push a new span onto the call stack.
// Inbound blocks pop back to the matching agent, set its output, and — if
// cbac_app is present — insert a tool child span first.

export function buildTraceFromBlocks(intent: Intent, blocks: IntentBlock[]): FlowTrace {
  const sorted = [...blocks].sort((a, b) => a.block_index - b.block_index);

  const allSpans: TraceSpan[] = [];
  const mkSpan = (s: Omit<TraceSpan, "children">): TraceSpan => {
    const sp: TraceSpan = { ...s, children: [] };
    allSpans.push(sp);
    return sp;
  };

  const halted = sorted.some((b) => b.threat_detected);
  const traceStatus: TraceSpan["status"] = halted ? "blocked" : "ok";

  const rootSpan = mkSpan({
    id: `sp_${sanitize(intent.id)}_root`,
    name: `Intent · ${intent.id.slice(-8)}`,
    kind: "chain",
    label: "TRACE",
    status: traceStatus,
        input: `Execute intent: ${intent.id}`,
    output: halted ? "Intent halted: policy violation detected." : "Intent finished successfully.",
    model: null,
    parentId: null,
    metadata: { intentId: intent.id, status: halted ? "halted" : "finished" },
  });

  // Stack of active frames: { did, span }
  // The root frame is a sentinel so we never pop below the intent root.
  const stack: Array<{ did: string; span: TraceSpan }> = [
    { did: "__root__", span: rootSpan },
  ];

  let humanName = intent.initiator?.name || "User";

  for (const block of sorted) {
    if (block.direction === "outbound") {
      const isHuman = block.block_type === "intent";
      if (isHuman) humanName = block.agent_name || humanName;

      const parent = stack[stack.length - 1].span;
      const spanId = `sp_${sanitize(intent.id)}_${sanitize(block.id)}`;

      const span = mkSpan({
        id: spanId,
        name: block.agent_name || block.agent_did.slice(-8),
        kind: isHuman ? "human" : "agent",
        label: isHuman ? "User" : "Agent",
        status: block.threat_detected ? "blocked" : "ok",
                input: block.message || "",
        output: "",  // filled in when the matching inbound block arrives
        model: isHuman ? null : "agent/reason-v2",
        parentId: parent.id,
        metadata: {
          agentDid: block.agent_did,
          blockType: block.block_type,
          blockIndex: block.block_index,
          ...(block.delegate_to ? { delegateTo: block.delegate_to } : {}),
          ...(block.received_from ? { receivedFrom: block.received_from } : {}),
        },
        signature: block.signature || undefined,
      });

      parent.children.push(span);
      stack.push({ did: block.agent_did, span });
    } else {
      // inbound — find the matching agent frame and fill its output
      let frameIdx = stack.length - 1;
      while (frameIdx > 0 && stack[frameIdx].did !== block.agent_did) {
        frameIdx--;
      }

      if (frameIdx > 0) {
        const frame = stack[frameIdx];

        // If a tool was involved, add it as a child before closing this span
        if (block.cbac_app) {
          const toolSpanId = `sp_${sanitize(intent.id)}_tool_${sanitize(block.id)}`;
          const toolSpan = mkSpan({
            id: toolSpanId,
            name: block.cbac_app,
            kind: "tool",
            label: "Tool",
            status: block.threat_detected ? "blocked" : "ok",
                        input: block.message || "",
            output: block.response || "",
            model: null,
            parentId: frame.span.id,
            metadata: {
              cbacApp: block.cbac_app,
              cbacDecision: block.cbac_decision,
              trustIssues: block.trust_issues,
              blockIndex: block.block_index,
            },
          });
          frame.span.children.push(toolSpan);
        }

        // Fill the agent span's output and propagate threat upward if needed
        frame.span.output = block.response || block.message || "";
        if (block.threat_detected) frame.span.status = "blocked";

        // Pop this frame and everything above it
        stack.splice(frameIdx);
      }
    }
  }

  const spanById: Record<string, TraceSpan> = {};
  for (const s of allSpans) spanById[s.id] = s;

  return {
    trace: rootSpan,
    spanById,
    traceId: `tr_${sanitize(intent.id).slice(-8)}`,
    sessionId: `sess_${sanitize(intent.id).slice(-6)}`,
    userId: humanName,
    env: "prod",
    totalTokensIn: 0,
    totalTokensOut: 0,
    totalCost: 0,
  };
}

// ---- Interaction tree (Envelope inspector) ----
//
// One span per interaction, keyed by the interaction's own id, nested by call
// stack: a call sits under the most recent open call whose target is its
// initiator. Tools can't call onward, so they're never pushed as a frame.

export function buildInteractionTrace(
  intent: Intent,
  interactions: Interaction[],
  /** DID → display name; falls back to the name on the interaction, then a short DID. */
  nameOf: (did: string) => string | undefined,
): FlowTrace {
  // Same ordering as buildFlowFromIntent, so the tree and the step rail agree on sequence.
  const sorted = [...interactions].sort((a, b) => b.created - a.created);
  const name = (ref: Interaction["initiator"]) => nameOf(ref.id) || ref.name || shortDid(ref.id);
  const halted = sorted.some((ix) => ix.threat);

  const allSpans: TraceSpan[] = [];
  const root: TraceSpan = {
    id: `sp_${sanitize(intent.id)}_ixroot`,
    name: intent.name || `Intent · ${intent.id.slice(-8)}`,
    kind: "chain",
    label: "INTENT",
    status: halted ? "blocked" : "ok",
    input: "",
    output: "",
    model: null,
    parentId: null,
    metadata: { intentId: intent.id, interactions: sorted.length, status: halted ? "halted" : "finished" },
    children: [],
  };
  allSpans.push(root);

  const stack: Array<{ did: string; span: TraceSpan }> = [{ did: "__root__", span: root }];

  for (const ix of sorted) {
    while (stack.length > 1 && stack[stack.length - 1].did !== ix.initiator.id) stack.pop();
    const parent = stack[stack.length - 1].span;
    const isTool = ix.targetType === "tool";
    const from = name(ix.initiator);
    const to = name(ix.target);

    // Interactions carry no payload of their own, so Preview splits the record into
    // what was asked (who → whom) and what came back (verdict, runtime, threat).
    const span: TraceSpan = {
      id: ix.id,
      name: `${from} → ${to}`,
      kind: isTool ? "tool" : "agent",
      label: ix.blockType || (isTool ? "Tool call" : "Agent call"),
      status: ix.threat ? "blocked" : "ok",
      input: JSON.stringify({
        from: { name: from, id: ix.initiator.id },
        to: { name: to, id: ix.target.id, type: ix.targetType },
        intent: { id: ix.intent?.id, name: ix.intent?.name },
      }),
      output: JSON.stringify({
        verdict: ix.threat ? "blocked" : "allowed",
        runtime: ix.runtime,
        ...(ix.threatID ? { threatID: ix.threatID } : {}),
        ...(ix.message ? { message: ix.message } : {}),
      }),
      model: null,
      parentId: parent.id,
      metadata: {
        interactionId: ix.id,
        ...(ix.blockType ? { blockType: ix.blockType } : {}),
        created: ix.created,
        runtime: ix.runtime,
      },
      children: [],
    };
    allSpans.push(span);
    parent.children.push(span);
    if (!isTool) stack.push({ did: ix.target.id, span });
  }

  const spanById: Record<string, TraceSpan> = {};
  for (const s of allSpans) spanById[s.id] = s;

  return {
    trace: root,
    spanById,
    traceId: `tr_${sanitize(intent.id).slice(-8)}`,
    sessionId: `sess_${sanitize(intent.id).slice(-6)}`,
    userId: intent.initiator?.name || "operator",
    env: "prod",
    totalTokensIn: 0,
    totalTokensOut: 0,
    totalCost: 0,
  };
}

function sanitize(s: string): string {
  return s.replace(/[^a-zA-Z0-9]/g, "_");
}

/** Initials helper (matches design's avatar text). */
export function avInitials(node: FlowNode): string {
  if (node.kind === "tool") return (node.name[0] || "?").toUpperCase();
  if (node.kind === "human") return "@";
  return node.name
    .split(/[\s_.-]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0].toUpperCase())
    .join("");
}
