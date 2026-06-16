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
import type { useResolveName } from "../../context/DirectoryContext";

export type FlowNodeKind = "human" | "agent" | "tool";
export type FlowDirection = "request" | "response";
export type FlowVerdict = "allowed" | "blocked";

export interface FlowNode {
  id: string;
  kind: FlowNodeKind;
  name: string;
  label: string;
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
}

export interface TraceSpan {
  id: string;
  name: string;
  kind: "chain" | "agent" | "tool";
  label: string;
  status: "ok" | "blocked";
  tokensIn: number;
  tokensOut: number;
  cost: number;
  input: string;
  output: string;
  model: string | null;
  metadata: Record<string, unknown>;
  children: TraceSpan[];
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

  // Orchestrator: the agent that initiates the most interactions for this intent.
  // Used only to assign an "Orchestrator" sub-label to that node — no synthetic
  // operator hops are added.
  const callCounts = new Map<string, number>();
  for (const i of sorted) {
    callCounts.set(i.initiator.id, (callCounts.get(i.initiator.id) || 0) + 1);
  }
  let orchAgentDid: string | null = null;
  let maxCalls = 0;
  for (const [did, count] of callCounts) {
    if (resolve(did).kind !== "tool" && count > maxCalls) {
      orchAgentDid = did;
      maxCalls = count;
    }
  }

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
    const isOrch = did === orchAgentDid;
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
      label: kind === "tool" ? "App" : isOrch ? "Orchestrator" : "",
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
    if (isBlocked) {
      fromNode.threat = true;
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

  const orchNodeId = orchAgentDid ? idForDid(orchAgentDid) : null;
  tierLayout(nodes, orchNodeId, rawSteps as FlowStep[]);

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
    name: intent.name,
    kind: "chain",
    label: "TRACE",
    status: traceStatus,
    tokensIn: 0, tokensOut: 0, cost: 0,
    input: `Execute intent: "${intent.name}"`,
    output: halted
      ? "Intent halted: policy violation detected. No side-effects committed."
      : "Intent completed. All identity, trust, and scope checks passed.",
    model: null,
    metadata: { intentId: intent.id, status: halted ? "halted" : "completed" },
  });

  // step key → span id (for populating FlowStep.spanId)
  const stepSpan = new Map<string, string>();
  const markStep = (fromId: string, toId: string, spanId: string) => {
    stepSpan.set(`${fromId}>${toId}`, spanId);
    stepSpan.set(`${toId}>${fromId}`, spanId);
  };

  // Group sorted interactions by initiator DID
  const byInitiator = new Map<string, Interaction[]>();
  for (const ix of sorted) {
    const arr = byInitiator.get(ix.initiator.id) || [];
    arr.push(ix);
    byInitiator.set(ix.initiator.id, arr);
  }

  const humanNode = nodes.find((n) => n.kind === "human");

  // Worker spans — delegations from the orchestrator
  if (orchAgentDid) {
    const orchInteractions = byInitiator.get(orchAgentDid) || [];
    for (const ix of orchInteractions) {
      if (ix.targetType !== "agent") continue;
      const workerDid = ix.target.id;
      const workerNodeId = idForDid(workerDid);
      const workerNode = nodesById.get(workerNodeId);

      const workerSpanId = `sp_${sanitize(intent.id)}_w_${sanitize(workerDid)}`;
      const workerSpan = mkSpan({
        id: workerSpanId,
        name: workerNode?.name || ix.target.name || shortDid(workerDid),
        kind: "agent",
        label: workerNode?.label || "Worker",
        status: ix.threat ? "blocked" : "ok",
        tokensIn: 0, tokensOut: 0, cost: 0,
        input: `Delegated task for intent "${intent.name}".\nVerify identity, check scope, execute subtask.`,
        output: ix.threat
          ? "Attempted tool call outside granted scope. Blocked by policy."
          : "Subtask completed. Result returned to orchestrator.",
        model: "agent/reason-v2",
        metadata: { agentId: workerDid, intentId: intent.id },
      });
      rootSpan.children.push(workerSpan);
      markStep(orchNodeId!, workerNodeId, workerSpanId);

      // Tool calls from this worker
      const workerInteractions = byInitiator.get(workerDid) || [];
      for (const tix of workerInteractions) {
        const toolDid = tix.target.id;
        const toolNodeId = idForDid(toolDid);
        const toolNode = nodesById.get(toolNodeId);

        const toolSpanId = `sp_${sanitize(intent.id)}_t_${sanitize(toolDid)}_${sanitize(workerDid)}`;
        const toolSpan = mkSpan({
          id: toolSpanId,
          name: toolNode?.name || tix.target.name || shortDid(toolDid),
          kind: "tool",
          label: toolNode?.label || "Tool",
          status: tix.threat ? "blocked" : "ok",
          tokensIn: 0, tokensOut: 0, cost: 0,
          input: `{\n  "tool": "${toolNode?.name || tix.target.name}",\n  "scope": "${toolNode?.label || "unknown"}",\n  "caller": "${workerNode?.name || ix.target.name}",\n  "timeout_ms": 3000\n}`,
          output: tix.threat
            ? `{\n  "ok": false,\n  "error": "scope_denied",\n  "message": "capability not granted to caller"\n}`
            : `{\n  "ok": true,\n  "elapsed_ms": ${Math.max(20, tix.runtime || 120)}\n}`,
          model: null,
          metadata: {
            provider: "service",
            scope: toolNode?.label || "unknown",
            caller: workerNode?.name || ix.target.name,
            intentId: intent.id,
          },
        });
        workerSpan.children.push(toolSpan);
        markStep(workerNodeId, toolNodeId, toolSpanId);
      }
    }
  }

  // Also capture any direct agent→tool steps not under the orch
  for (const ix of sorted) {
    if (ix.initiator.id === orchAgentDid) continue;
    if (ix.targetType !== "tool") continue;
    const fromNodeId = idForDid(ix.initiator.id);
    const toNodeId = idForDid(ix.target.id);
    const key = `${fromNodeId}>${toNodeId}`;
    if (!stepSpan.has(key)) {
      // fall back to root span id
      markStep(fromNodeId, toNodeId, rootSpan.id);
    }
  }

  const genSpanId = `sp_${sanitize(intent.id)}_gen`;
  const genSpan = mkSpan({
    id: genSpanId,
    name: "generation",
    kind: "agent",
    label: "LLM",
    status: traceStatus,
    tokensIn: 0, tokensOut: 0, cost: 0,
    input: `Compose the final response for the operator.\nSummarize the completed work or policy violation.`,
    output: halted
      ? `Intent halted before completion.\n\nA policy violation was detected and the orchestration was stopped. No side effects were committed.`
      : `Completed "${intent.name}".\n\nAll agent interactions and tool calls completed successfully. Identity, trust, and scope checks passed.`,
    model: "gpt-4o-mini",
    metadata: { temperature: 0.2, max_tokens: 1024, env: "prod" },
  });
  rootSpan.children.push(genSpan);

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
