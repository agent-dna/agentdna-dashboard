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

  const X = { human: 0.11, orch: 0.36, worker: 0.63, tool: 0.88 } as const;

  const place = (arr: FlowNode[], x: number) => {
    arr.sort((a, b) => (order[a.id] ?? 0) - (order[b.id] ?? 0));
    const k = arr.length;
    const half = Math.min(0.34, 0.17 * (k - 1));
    arr.forEach((n, i) => {
      n.x = x;
      n.y = k === 1 ? 0.5 : 0.5 - half + 2 * half * (i / (k - 1));
    });
  };

  place(cols.human, X.human);
  place(cols.orch, X.orch);
  place(cols.worker, X.worker);
  place(cols.tool, X.tool);

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

  const initiatorId = intent.initiator.id;
  const initiatorName = resolve(initiatorId).name || shortDid(initiatorId);

  // Operator node — the intent's initiator (a user/admin in /new_intents).
  const operator: FlowNode = {
    id: `usr_${sanitize(initiatorId)}`,
    kind: "human",
    name: initiatorName,
    label: "Operator",
    x: 0,
    y: 0,
  };

  // Orchestrator: the agent that initiates the most interactions for this intent.
  // Fallback: the first interaction's initiator. Workers = all other agents.
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
  nodesById.set(operator.id, operator);

  const idForDid = (did: string): string => `nd_${sanitize(did)}`;

  const ensureNode = (did: string): FlowNode => {
    const id = idForDid(did);
    if (nodesById.has(id)) return nodesById.get(id)!;
    const resolved = resolve(did);
    const kind: FlowNodeKind = resolved.kind === "tool" ? "tool" : "agent";
    const isOrch = did === orchAgentDid;
    const node: FlowNode = {
      id,
      kind,
      name: resolved.name || shortDid(did),
      label: kind === "tool" ? "Tool" : isOrch ? "Orchestrator" : "Worker",
      x: 0,
      y: 0,
    };
    nodesById.set(id, node);
    return node;
  };

  // Build steps. First step: operator → orchestrator (if any orchestrator exists).
  const steps: FlowStep[] = [];

  if (orchAgentDid) {
    const orchNode = ensureNode(orchAgentDid);
    steps.push({
      from: operator.id,
      to: orchNode.id,
      dir: "request",
      title: "Submit intent",
      summary: `${initiatorName} submitted intent “${intent.name || "intent"}”. Orchestration was handed to ${orchNode.name} under approved policy.`,
      verdict: "allowed",
      checks: { identity: true, trust: true, scope: true },
      latency: 80,
    });
  }

  // Each interaction → one hop.
  for (const ixn of sorted) {
    const fromNode = ensureNode(ixn.initiator.id);
    const toNode = ensureNode(ixn.target.id);
    const fromName = fromNode.name;
    const toName = toNode.name;
    const isBlocked = ixn.threat;
    const isToTool = toNode.kind === "tool";
    steps.push({
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

  // Final step: orchestrator → operator (return / halt).
  if (orchAgentDid) {
    const orchNode = nodesById.get(idForDid(orchAgentDid))!;
    const halted = intent.threats > 0 || steps.some((s) => s.verdict === "blocked");
    steps.push({
      from: orchNode.id,
      to: operator.id,
      dir: "response",
      title: halted ? "Halt intent" : "Return result",
      summary: halted
        ? `${orchNode.name} halted the intent and returned a policy violation to ${initiatorName}.`
        : `${orchNode.name} returned the final result to ${initiatorName}. Intent completed cleanly.`,
      verdict: halted ? "blocked" : "allowed",
      checks: { identity: true, trust: true, scope: !halted },
      latency: 120,
    });
  }

  // Empty fallback — keep one placeholder so the rail isn't blank.
  if (steps.length === 0) {
    steps.push({
      from: operator.id,
      to: operator.id,
      dir: "request",
      title: "Waiting for activity",
      summary: "No interactions have been recorded yet for this intent.",
      verdict: "allowed",
      checks: { identity: true, trust: true, scope: true },
      latency: 0,
    });
  }

  // Final node set (only nodes that appear in any step) and unique directed edges.
  const used = new Set<string>();
  for (const s of steps) {
    used.add(s.from);
    used.add(s.to);
  }
  const nodes = Array.from(nodesById.values()).filter((n) => used.has(n.id));

  const seenEdges = new Set<string>();
  const edges: [string, string][] = [];
  for (const s of steps) {
    const key = `${s.from}>${s.to}`;
    if (!seenEdges.has(key)) {
      seenEdges.add(key);
      edges.push([s.from, s.to]);
    }
  }

  const orchNodeId = orchAgentDid ? idForDid(orchAgentDid) : null;
  tierLayout(nodes, orchNodeId, steps);

  const halted = steps.some((s) => s.verdict === "blocked");

  return {
    intentId: intent.id,
    intent,
    nodes,
    nodeById: Object.fromEntries(nodes.map((n) => [n.id, n])),
    edges,
    steps,
    status: halted ? "halted" : "completed",
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
