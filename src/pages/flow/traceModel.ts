import dagre from "@dagrejs/dagre";
import { worstAuthTone, type AuthEvidence, type AuthTone } from "../../api/observability";
import { parseDestination, type ParsedDestination } from "../../lib/destination";
import type { Interaction } from "../../types";
import type { Flow, FlowNode } from "./flowData";
import { buildTokenTrail, hopTokenActivity, type NO_AUTH, type TokenActivity } from "../observability/EvidenceTable";

/**
 * The trace investigation view's model: the flow's hops numbered in play order, the
 * nodes they touch (plus a node per outside resource an auth check went to), the
 * hops grouped per sender → receiver pair, a dagre layout and the orthogonal routes
 * the graph draws between node cards.
 */

/** Every node is a logo-and-name card of this size. */
export const NODE_W = 188;
export const NODE_H = 52;

export type Size = { w: number; h: number };
export const NODE_SIZE: Size = { w: NODE_W, h: NODE_H };

/**
 * A check made when the hop's receiver called its own backend. client_out and server_in checks
 * are the credential the sender passed to the receiver; server_out is the one the receiver then
 * used on a destination, so only those reach outside resources, and they leave from the receiver.
 */
export const isOnward = (c: AuthEvidence) => (c.source || "").toLowerCase() === "server_out";

/**
 * The check actually carried a credential. One with no auth method ("none" or empty) and no
 * fingerprint (credential ID) is a call made without one: it gets no key and no credential box.
 */
export const hasCredential = (c: AuthEvidence) => {
  const m = (c.authMethod || "").trim().toLowerCase();
  return !!c.credentialID || (m !== "" && m !== "none");
};

/**
 * The outside-resource node an auth check's `destination` points at, or null when it points at
 * nothing outside (empty, or another participant's DID). The graph and the Destinations tab share it.
 */
export function destinationNodeId(raw: string): { id: string; dest: ParsedDestination; hostPort: string } | null {
  const text = (raw || "").trim();
  if (!text || text.toLowerCase().startsWith("bafy")) return null;
  const dest = parseDestination(text);
  const hostPort = `${dest.host}${dest.port ? `:${dest.port}` : ""}`;
  return { id: `ext_${dest.entity}_${hostPort}`, dest, hostPort };
}

export type TraceNodeKind = "human" | "agent" | "app" | "external" | "local" | "prov";

export interface TraceNode {
  id: string;
  kind: TraceNodeKind;
  name: string;
  /** DID, or host and port for an outside resource. */
  ident: string;
  did?: string;
  /** Outside resources only. */
  dest?: ParsedDestination;
}

export interface TraceHop {
  /** 1-based, in play order. */
  n: number;
  /** Index into the flow's steps. */
  step: number;
  src: string;
  dst: string;
  blocked: boolean;
  /** ISO time of the hop; "" when the endpoint gave none. */
  time: string;
  /** "A2A" between agents, "MCP" into an app, "User" from a person. */
  protocol: string;
  /** The payload's method when it has one, else the hop's kind ("delegate", "response"). */
  op: string;
  checks: AuthEvidence[];
  cred: null | {
    /** "Forwarded" when a credential on this hop was already presented on an earlier one. */
    label: "Credential" | "Forwarded";
    tone: AuthTone;
    reusedFrom?: number;
  };
  /** What happened to the token on this hop, as the intent page's evidence shows it; "No Auth" when it carried none. */
  activity?: TokenActivity | typeof NO_AUTH;
  /** Outside-resource node ids the receiver called on this hop (its server_out checks). */
  outside: string[];
  /** The receiver's server_out checks: credentials it used on those outside resources. */
  onward: AuthEvidence[];
  ix?: Interaction;
  branch?: string;
}

export interface TracePair {
  key: string;
  src: string;
  dst: string;
  /** Hop numbers carried on this line, ascending. Empty for the provenance seal. */
  hops: number[];
  kind: "call" | "outside" | "seal";
}

export interface TraceModel {
  nodes: TraceNode[];
  nodeById: Map<string, TraceNode>;
  hops: TraceHop[];
  pairs: TracePair[];
  credHops: number[];
  blockedHops: number[];
  /** Credential ID → its key colour. The same credential is the same colour wherever it's used. */
  credColor: Map<string, string>;
}

/**
 * Key colours, one per distinct credential in a trace, in order of first use. None of them is the
 * selection blue, the blocked red or the allowed green. Cycles past six credentials.
 */
export const KEY_COLORS = ["#B45309", "#7C3AED", "#0F766E", "#BE185D", "#4338CA", "#0E7490"];

/** The key colour for a set of checks: their first credential's, or the first colour when none has an ID. */
export function keyColor(model: TraceModel, checks: AuthEvidence[]): string {
  for (const c of checks) {
    const col = c.credentialID ? model.credColor.get(c.credentialID) : undefined;
    if (col) return col;
  }
  return KEY_COLORS[0];
}

/** The receiver's onward checks that went to one outside node. */
export const onwardTo = (hop: TraceHop, nodeId: string) => hop.onward.filter((c) => destinationNodeId(c.destination)?.id === nodeId);

const NODE_KIND: Record<FlowNode["kind"], TraceNodeKind> = {
  human: "human",
  agent: "agent",
  tool: "app",
  provenance: "prov",
};

/** The payload's JSON-RPC method (plus the tool name on a tools/call), or the hop's kind. */
function opOf(ix: Interaction | undefined): string {
  const raw = ix?.raw as { payload?: unknown } | undefined;
  const payload = raw?.payload ?? ix?.payload;
  let obj: unknown = payload;
  if (typeof payload === "string") {
    try {
      obj = JSON.parse(payload);
    } catch {
      obj = null;
    }
  }
  if (obj && typeof obj === "object" && !Array.isArray(obj)) {
    const o = obj as { method?: unknown; params?: { name?: unknown } };
    if (typeof o.method === "string" && o.method) {
      return typeof o.params?.name === "string" && o.params.name ? `${o.method} · ${o.params.name}` : o.method;
    }
  }
  return ix?.kind || "message";
}

export function buildTrace(flow: Flow, ixById: Map<string, Interaction>): TraceModel {
  const nodes: TraceNode[] = flow.nodes.map((n) => ({
    id: n.id,
    kind: NODE_KIND[n.kind],
    name: n.name,
    ident: n.did || (n.kind === "provenance" ? "Signed envelope chain" : n.id),
    did: n.did,
  }));
  const nodeById = new Map(nodes.map((n) => [n.id, n]));

  const pairs = new Map<string, TracePair>();
  const addPair = (src: string, dst: string, kind: TracePair["kind"], hop?: number) => {
    const key = `${src}>${dst}`;
    const p = pairs.get(key) ?? { key, src, dst, hops: [], kind };
    if (hop != null && !p.hops.includes(hop)) p.hops.push(hop);
    pairs.set(key, p);
  };

  const credSeen = new Map<string, number>();
  const hops: TraceHop[] = flow.steps.map((s, i) => {
    const n = i + 1;
    const ix = s.interactionID ? ixById.get(s.interactionID) : undefined;
    const srcKind = nodeById.get(s.from)?.kind;
    const dstKind = nodeById.get(s.to)?.kind;
    const protocol = dstKind === "app" ? "MCP" : srcKind === "human" ? "User" : "A2A";
    const checks = ix?.authEvidence ?? [];

    let reusedFrom: number | undefined;
    for (const c of checks) {
      const prev = c.credentialID ? credSeen.get(c.credentialID) : undefined;
      if (prev != null && prev !== n && reusedFrom == null) reusedFrom = prev;
    }
    for (const c of checks) if (c.credentialID && !credSeen.has(c.credentialID)) credSeen.set(c.credentialID, n);

    const outside: string[] = [];
    const onward = checks.filter(isOnward);
    for (const c of onward) {
      const raw = (c.destination || "").trim();
      const at = destinationNodeId(raw);
      if (!at) continue;
      const { id, dest, hostPort } = at;
      if (!nodeById.has(id)) {
        const node: TraceNode = {
          id,
          kind: dest.entity === "local" ? "local" : "external",
          name: dest.entity === "web" ? dest.host || raw : dest.name,
          ident: hostPort || raw,
          dest,
        };
        nodes.push(node);
        nodeById.set(id, node);
      }
      if (!outside.includes(id)) outside.push(id);
      // The receiver reaches the destination, not the sender.
      addPair(s.to, id, "outside", n);
    }

    addPair(s.from, s.to, "call", n);
    return {
      n,
      step: i,
      src: s.from,
      dst: s.to,
      blocked: s.verdict === "blocked",
      time: ix?.time ?? "",
      protocol,
      op: opOf(ix),
      checks,
      cred: checks.some(hasCredential)
        ? { label: reusedFrom != null ? "Forwarded" : "Credential", tone: worstAuthTone(checks.filter(hasCredential).map((c) => c.authStatus)), reusedFrom }
        : null,
      outside,
      onward,
      ix,
      branch: s.branch || undefined,
    };
  });

  // Token activity, followed through the hops the same way the intent page follows its steps.
  const tokens = buildTokenTrail(
    hops.map((h) => ({ interactionID: `h${h.n}`, from: h.src, to: h.dst })),
    new Map(hops.map((h) => [`h${h.n}`, h.checks])),
  );
  for (const h of hops) h.activity = hopTokenActivity(h.checks, tokens);

  for (const e of flow.sealEdges) addPair(e.from, e.to, "seal");

  return {
    nodes,
    nodeById,
    hops,
    pairs: [...pairs.values()],
    credHops: hops.filter((h) => h.cred).map((h) => h.n),
    credColor: (() => {
      // In trace order: each hop's own credential first, then the one its receiver used onward.
      const m = new Map<string, string>();
      for (const h of hops)
        for (const c of [...h.checks.filter((x) => !isOnward(x)), ...h.onward])
          if (c.credentialID && !m.has(c.credentialID)) m.set(c.credentialID, KEY_COLORS[m.size % KEY_COLORS.length]);
      return m;
    })(),
    blockedHops: hops.filter((h) => h.blocked).map((h) => h.n),
  };
}

export type XY = { x: number; y: number };

/**
 * Node centres. The call graph is laid out left to right by dagre; outside resources
 * sit in a row above their first caller and the provenance ledger below the initiator,
 * so neither stretches the call chain.
 */
export function layoutTrace(model: TraceModel): Record<string, XY> {
  const core = model.nodes.filter((n) => n.kind !== "external" && n.kind !== "local" && n.kind !== "prov");
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: "LR", nodesep: 70, ranksep: 140, marginx: 0, marginy: 0 });
  g.setDefaultEdgeLabel(() => ({}));
  for (const n of core) g.setNode(n.id, { width: NODE_W, height: NODE_H });
  for (const p of model.pairs) if (p.kind === "call" && p.src !== p.dst) g.setEdge(p.src, p.dst);
  dagre.layout(g);

  const pos: Record<string, XY> = {};
  for (const n of core) {
    const d = g.node(n.id);
    pos[n.id] = { x: d?.x ?? 0, y: d?.y ?? 0 };
  }
  const ys = Object.values(pos).map((p) => p.y);
  const top = ys.length ? Math.min(...ys) : 0;
  const bottom = ys.length ? Math.max(...ys) : 0;

  // Outside resources: a row above the graph, each as near its first caller as the row allows.
  const firstCaller = new Map<string, string>();
  for (const p of model.pairs) if (p.kind === "outside" && !firstCaller.has(p.dst)) firstCaller.set(p.dst, p.src);
  const row = model.nodes
    .filter((n) => n.kind === "external" || n.kind === "local")
    .map((n) => ({ id: n.id, want: pos[firstCaller.get(n.id) ?? ""]?.x ?? 0 }))
    .sort((a, b) => a.want - b.want);
  const rowY = top - NODE_H - 110;
  let nextX = -Infinity;
  for (const r of row) {
    const x = Math.max(r.want, nextX);
    pos[r.id] = { x, y: rowY };
    nextX = x + NODE_W + 40;
  }

  // The ledger sits beneath the node that seals into it.
  for (const p of model.pairs) {
    if (p.kind !== "seal") continue;
    pos[p.dst] = { x: pos[p.src]?.x ?? 0, y: bottom + NODE_H + 100 };
  }
  for (const n of model.nodes) pos[n.id] ??= { x: 0, y: bottom + NODE_H + 100 };
  return pos;
}

export interface EdgeGeom {
  d: string;
  mid: XY;
  sp: XY;
  tp: XY;
}

/** A polyline with rounded corners. */
function rpath(pts: XY[], r: number): string {
  let d = `M${pts[0].x},${pts[0].y}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const p = pts[i - 1], c = pts[i], n = pts[i + 1];
    const d1 = Math.hypot(c.x - p.x, c.y - p.y) || 1;
    const d2 = Math.hypot(n.x - c.x, n.y - c.y) || 1;
    const rr = Math.min(r, d1 / 2, d2 / 2);
    d += ` L${c.x + ((p.x - c.x) / d1) * rr},${c.y + ((p.y - c.y) / d1) * rr} Q${c.x},${c.y} ${c.x + ((n.x - c.x) / d2) * rr},${c.y + ((n.y - c.y) / d2) * rr}`;
  }
  const l = pts[pts.length - 1];
  return `${d} L${l.x},${l.y}`;
}

type Side = "t" | "b" | "l" | "r";
const OPPOSITE: Record<Side, Side> = { b: "t", t: "b", r: "l", l: "r" };

/**
 * Orthogonal routes for every pair. A line leaves the side of its source that faces the
 * target and enters the facing side of the target; lines sharing a side are spread along
 * it, and lines leaving the same side turn at staggered distances so they don't overlap.
 */
export function routePairs(pairs: TracePair[], pos: Record<string, XY>, size: (id: string) => Size): Record<string, EdgeGeom> {
  type Info = { P: TracePair; vert: boolean; ss: Side; ts: Side; sp?: XY; tp?: XY; rank: number };
  const info: Record<string, Info> = {};
  const ends: Record<string, { key: string; other: string; end: "s" | "t" }[]> = {};
  const add = (k: string, v: { key: string; other: string; end: "s" | "t" }) => (ends[k] ??= []).push(v);
  const out: Record<string, EdgeGeom> = {};

  for (const P of pairs) {
    const a = pos[P.src], b = pos[P.dst];
    if (!a || !b) continue;
    if (P.src === P.dst) {
      // A hop a node sent itself: a small loop off its right side.
      const hw = size(P.src).w / 2;
      const s = { x: a.x + hw, y: a.y - 18 }, t = { x: a.x + hw, y: a.y + 18 };
      const pts = [s, { x: s.x + 34, y: s.y }, { x: s.x + 34, y: t.y }, { x: t.x + 6, y: t.y }];
      out[P.key] = { d: rpath(pts, 10), mid: { x: s.x + 34, y: a.y }, sp: s, tp: t };
      continue;
    }
    const dx = b.x - a.x, dy = b.y - a.y;
    const vert = Math.abs(dy) > (size(P.src).h + size(P.dst).h) / 2 + 24;
    const ss: Side = vert ? (dy > 0 ? "b" : "t") : dx > 0 ? "r" : "l";
    const ts = OPPOSITE[ss];
    info[P.key] = { P, vert, ss, ts, rank: 0 };
    add(`${P.src}|${ss}`, { key: P.key, other: P.dst, end: "s" });
    add(`${P.dst}|${ts}`, { key: P.key, other: P.src, end: "t" });
  }

  for (const [k, list] of Object.entries(ends)) {
    const bar = k.lastIndexOf("|");
    const id = k.slice(0, bar), side = k.slice(bar + 1) as Side;
    const hs = side === "t" || side === "b";
    const c = pos[id];
    const { w, h } = size(id);
    list.sort((p, q) => (hs ? pos[p.other].x - pos[q.other].x : pos[p.other].y - pos[q.other].y) || (p.key < q.key ? -1 : 1));
    const gap = hs ? 24 : 28;
    list.forEach((e, i) => {
      const o = (i - (list.length - 1) / 2) * gap;
      const pt =
        side === "t" ? { x: c.x + o, y: c.y - h / 2 }
        : side === "b" ? { x: c.x + o, y: c.y + h / 2 }
        : side === "l" ? { x: c.x - w / 2, y: c.y + o }
        : { x: c.x + w / 2, y: c.y + o };
      if (e.end === "s") info[e.key].sp = pt;
      else info[e.key].tp = pt;
    });
  }

  const groups: Record<string, Info[]> = {};
  for (const I of Object.values(info)) (groups[`${I.P.src}|${I.ss}`] ??= []).push(I);
  for (const g of Object.values(groups)) {
    const disp = (I: Info) => (I.vert ? Math.abs(I.tp!.x - I.sp!.x) : Math.abs(I.tp!.y - I.sp!.y));
    g.sort((p, q) => disp(q) - disp(p)).forEach((I, r) => (I.rank = r));
  }

  for (const I of Object.values(info)) {
    const s = I.sp!, t = I.tp!;
    let pts: XY[];
    if (I.vert) {
      const dir = I.ss === "b" ? 1 : -1;
      let m = s.y + dir * (28 + I.rank * 16);
      if (dir > 0 ? m > t.y - 14 : m < t.y + 14) m = (s.y + t.y) / 2;
      pts = Math.abs(s.x - t.x) < 1 ? [s, t] : [s, { x: s.x, y: m }, { x: t.x, y: m }, t];
    } else {
      const dir = I.ss === "r" ? 1 : -1;
      let m = s.x + dir * (28 + I.rank * 16);
      if (dir > 0 ? m > t.x - 14 : m < t.x + 14) m = (s.x + t.x) / 2;
      pts = Math.abs(s.y - t.y) < 1 ? [s, t] : [s, { x: m, y: s.y }, { x: m, y: t.y }, t];
    }
    let best = 0, mid = s;
    for (let i = 1; i < pts.length; i++) {
      const L = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
      if (L > best) {
        best = L;
        mid = { x: (pts[i].x + pts[i - 1].x) / 2, y: (pts[i].y + pts[i - 1].y) / 2 };
      }
    }
    // Stop short of the target so the arrowhead lands on the port.
    const a = pts[pts.length - 2];
    const L = Math.hypot(t.x - a.x, t.y - a.y) || 1;
    const tip = { x: t.x - ((t.x - a.x) / L) * 6, y: t.y - ((t.y - a.y) / L) * 6 };
    out[I.P.key] = { d: rpath([...pts.slice(0, -1), tip], 10), mid, sp: s, tp: t };
  }
  return out;
}

/** "bafybmibb4t…tkp6u4". */
export function trunc(s: string, a = 10, b = 6): string {
  return s && s.length > a + b + 2 ? `${s.slice(0, a)}…${s.slice(-b)}` : s;
}

export const pad2 = (n: number) => String(n).padStart(2, "0");

/** "09:11:42" in local time, from an ISO stamp. */
export function clock(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const d = new Date(t);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}
