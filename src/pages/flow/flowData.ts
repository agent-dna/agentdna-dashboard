/**
 * Flow data — adapts a real Intent + its Interactions into the structure the
 * FlowCanvas + step rail consume.
 *
 * Inputs:
 *   - intent: from /intent-info or /intent-list
 *   - interactions: from /intent-info.interactions (each interaction is one hop)
 *   - resolve: DID → { name, kind } lookup from DirectoryContext
 *
 * Output: a `Flow` with normalized 0..1 node coordinates in a clean tiered
 * layout (operator → orchestrator → workers → tools).
 */

import type { Intent, Interaction } from "../../types";
import type { DiagramInteraction, IntentBlock, IntentDiagram } from "../../data/api";
import type { useResolveName } from "../../context/DirectoryContext";

export type FlowNodeKind = "human" | "agent" | "tool";
export type FlowDirection = "request" | "response";
export type FlowVerdict = "allowed" | "blocked";

export interface FlowNode {
  id: string;
  kind: FlowNodeKind;
  name: string;
  label: string;
  /** Raw DID this node was built from — `id` is a sanitized derivative. */
  did?: string;
  /** normalized 0..1 — set by tierLayout */
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

export interface Flow {
  intentId: string;
  intent: Intent;
  nodes: FlowNode[];
  nodeById: Record<string, FlowNode>;
  /** unique directed edges (from > to). */
  edges: [string, string][];
  steps: FlowStep[];
  status: "halted" | "completed";
  trace: FlowTrace;
  /** Raw /intent-diagram response — shown as-is in the JSON tab. */
  rawDiagram?: unknown;
}

/* ------- tier layout ------- */

function tierLayout(nodes: FlowNode[], orchId: string | null, steps: FlowStep[]): FlowNode[] {
  const order: Record<string, number> = {};
  let o = 0;
  for (const s of steps) {
    for (const id of [s.from, s.to]) {
      if (order[id] == null) order[id] = o++;
    }
  }

  const cols: Record<"human" | "orch" | "worker" | "tool", FlowNode[]> = {
    human: [],
    orch: [],
    worker: [],
    tool: [],
  };
  for (const n of nodes) {
    const tier = n.kind === "human" ? "human" : n.id === orchId ? "orch" : n.kind === "tool" ? "tool" : "worker";
    cols[tier].push(n);
  }

  // Only the tiers that actually have nodes get an X slot — and we space those
  // evenly across the canvas (with margins) so the graph is always centred
  // regardless of which tiers are missing.
  const tierOrder = ["human", "orch", "worker", "tool"] as const;
  const activeTiers = tierOrder.filter((t) => cols[t].length > 0);

  const place = (arr: FlowNode[], x: number) => {
    arr.sort((a, b) => (order[a.id] ?? 0) - (order[b.id] ?? 0));
    const k = arr.length;
    const half = Math.min(0.34, 0.17 * (k - 1));
    arr.forEach((n, i) => {
      n.x = x;
      n.y = k === 1 ? 0.5 : 0.5 - half + 2 * half * (i / (k - 1));
    });
  };

  if (activeTiers.length === 0) return nodes;
  if (activeTiers.length === 1) {
    place(cols[activeTiers[0]], 0.5);
  } else {
    const xStart = 0.14;
    const xEnd = 0.86;
    const step = (xEnd - xStart) / (activeTiers.length - 1);
    activeTiers.forEach((tier, i) => {
      place(cols[tier], xStart + step * i);
    });
  }

  return nodes;
}

/* ------- depth layout (DAG layering) ------- */

/**
 * Lay nodes out by longest-path depth from the initiator instead of by role.
 *
 * The role-based `tierLayout` collapses every agent into a single "worker"
 * column, so a parallel flow (A fans out to B and C, both returning to A) ends
 * up with A sitting alongside its own children and every edge drawn as an
 * intra-column arc. Layering by depth puts each hop in its own column and lets
 * concurrent siblings share one.
 *
 * Response hops are excluded from the depth graph: they point back up the tree
 * and would otherwise form cycles that have no valid layering.
 */
function depthLayout(nodes: FlowNode[], steps: FlowStep[]): FlowNode[] {
  const ids = new Set(nodes.map((n) => n.id));

  // First-appearance order, used to keep column ordering stable.
  const order: Record<string, number> = {};
  let o = 0;
  for (const s of steps) {
    for (const id of [s.from, s.to]) {
      if (order[id] == null) order[id] = o++;
    }
  }

  // Forward (request) edges only, deduped.
  const outAdj = new Map<string, string[]>();
  const indeg = new Map<string, number>();
  for (const id of ids) { outAdj.set(id, []); indeg.set(id, 0); }

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

  // Group into columns and spread each one vertically.
  const byDepth = new Map<number, FlowNode[]>();
  for (const n of nodes) {
    const d = depth.get(n.id) ?? 0;
    if (!byDepth.has(d)) byDepth.set(d, []);
    byDepth.get(d)!.push(n);
  }

  const depths = Array.from(byDepth.keys()).sort((a, b) => a - b);
  const xStart = 0.14;
  const xEnd = 0.86;

  depths.forEach((d, i) => {
    const col = byDepth.get(d)!;
    col.sort((a, b) => (order[a.id] ?? 0) - (order[b.id] ?? 0));
    const x = depths.length === 1 ? 0.5 : xStart + ((xEnd - xStart) / (depths.length - 1)) * i;
    const k = col.length;
    const half = Math.min(0.34, 0.17 * (k - 1));
    col.forEach((n, j) => {
      n.x = x;
      n.y = k === 1 ? 0.5 : 0.5 - half + 2 * half * (j / (k - 1));
    });
  });

  return nodes;
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

  tierLayout(nodes, null, rawSteps as FlowStep[]);

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

  return {
    intentId: intent.id,
    intent,
    nodes,
    nodeById: Object.fromEntries(nodes.map((n) => [n.id, n])),
    edges,
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
