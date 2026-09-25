/**
 * Layout and graph model for the Observability interaction plane, built from the
 * middleware's `/observability-*` responses (see src/api/observability.ts).
 *
 * The plane reads left to right: User → [COCA] → Agent → [COCA · CBAC · Whitelisting] → App → Intent.
 */

import type { ObsGateEdge, ObsGraph, ObsIntent, ObsOutcome, ObsUser, ObsUserFlow } from "../../api/observability";

export type PlaneColumn = "u" | "a" | "p" | "i";
export type PlaneStatus = ObsOutcome;

export interface PlaneNode {
  /** Column-prefixed id (`u:<did>`, `i:<intentID>`, …) so ids never collide across layers. */
  id: string;
  t: PlaneColumn;
  /** DID, or intentID for intents — what the API expects back. */
  ref: string;
  name: string;
  /**
   * Vertical centre. Users: relative to the top of the scrollable user list.
   * Everything else: relative to the canvas.
   */
  y: number;
  sub?: string;
  /** Users only. */
  ini?: string;
  av?: number;
  /** Service identity or unsigned (drawn in threat red). */
  svc?: boolean;
  /** Intents only. */
  st?: PlaneStatus;
  meta?: string;
}

export interface PlaneEdge {
  id: string;
  from: string;
  to: string;
  n: number;
  st: PlaneStatus;
  /** ISO timestamp of the latest hop. */
  lastAt: string;
  pol?: string;
  allowed: number;
  elevated: number;
  flagged: number;
}

/**
 * A path through the plane, one node per column (`""` where a column isn't known, e.g.
 * an org-wide agent → app edge has no user). `es[k]` joins `n[k]` to `n[k + 1]`.
 */
export interface PlaneFlow {
  n: string[];
  es: (PlaneEdge | null)[];
  st: PlaneStatus;
}

export interface PlaneModel {
  nodes: Record<string, PlaneNode>;
  edges: PlaneEdge[];
  flows: PlaneFlow[];
  height: number;
}

export const PLANE_W = 1452;
const MIN_PLANE_H = 760;

export const COLUMNS: Record<PlaneColumn, [number, number]> = {
  u: [0, 168],
  a: [352, 532],
  p: [964, 1108],
  i: [1192, 1452],
};
export const ROW_H: Record<PlaneColumn, number> = { u: 48, a: 60, p: 48, i: 60 };
/** The user layer is a scrollable list below the column title. */
export const USER_LIST_TOP = 56;
export const USER_PITCH = 60;
const PITCH: Record<"a" | "p" | "i", number> = { a: 76, p: 60, i: 72 };

export const COLUMN_TYPE: Record<PlaneColumn, string> = { u: "User", a: "Agent", p: "App", i: "Intent" };

/** Gate-2 walls, left to right, in the order they are evaluated. */
export const GATE2_WALLS = [
  { key: "coca", left: 568 },
  { key: "cbac", left: 692 },
  { key: "whitelist", left: 816 },
] as const;

const RANK: Record<PlaneStatus, number> = { allowed: 0, elevated: 1, flagged: 2 };
export const worst = (sts: PlaneStatus[]): PlaneStatus =>
  sts.reduce<PlaneStatus>((w, s) => (RANK[s] > RANK[w] ? s : w), "allowed");

export const nodeId = (t: PlaneColumn, ref: string) => `${t}:${ref}`;

const initials = (name: string) => {
  const parts = name.replace(/@.*/, "").split(/[\s._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "?") + (parts[1]?.[0] ?? "")).toUpperCase();
};

/** "3m", "2h", "4d" — or "just now". */
export function ago(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (!Number.isFinite(s) || s < 45) return "just now";
  if (s < 3600) return `${Math.round(s / 60)}m`;
  if (s < 86400) return `${Math.round(s / 3600)}h`;
  return `${Math.round(s / 86400)}d`;
}

const toEdge = (from: string, to: string, e: ObsGateEdge): PlaneEdge => ({
  id: `${from}>${to}`,
  from,
  to,
  n: e.count,
  st: e.outcome,
  lastAt: e.lastAt,
  pol: e.policies[0],
  allowed: e.allowed,
  elevated: e.elevated,
  flagged: e.flagged,
});

/** Order items by the weighted mean position of their neighbours, to cut down line crossings. */
function byBarycenter<T>(items: T[], key: (x: T) => string, links: { from: string; to: string; w: number }[], pos: Map<string, number>) {
  const score = new Map<string, number>();
  for (const x of items) {
    let sum = 0;
    let w = 0;
    for (const l of links) {
      if (l.to !== key(x)) continue;
      const p = pos.get(l.from);
      if (p == null) continue;
      sum += p * l.w;
      w += l.w;
    }
    score.set(key(x), w ? sum / w : Number.MAX_SAFE_INTEGER);
  }
  return [...items].sort((a, b) => score.get(key(a))! - score.get(key(b))!);
}

/** Spread `count` rows evenly down the canvas, at least `pitch` apart. */
const spread = (count: number, pitch: number, height: number) => {
  const top = USER_LIST_TOP + 8;
  const slot = Math.max(pitch, (height - top - 16) / Math.max(1, count));
  return (k: number) => top + slot * (k + 0.5);
};

interface BuildInput {
  graph: ObsGraph;
  users: ObsUser[];
  /** User-scoped agent → app edges for the picked user, once loaded. */
  userFlow: ObsUserFlow | null;
  /** Intents for the picked user + agent, once loaded. */
  intents: { userDID: string; agentDID: string; list: ObsIntent[] } | null;
}

export function buildPlaneModel({ graph, users, userFlow, intents }: BuildInput): PlaneModel {
  const nodes: Record<string, PlaneNode> = {};
  const edges = new Map<string, PlaneEdge>();
  const flows: PlaneFlow[] = [];

  /* ---------- Users (list order = most recently active first) ---------- */
  const userPos = new Map<string, number>();
  users.forEach((u, i) => {
    const id = nodeId("u", u.userDID);
    userPos.set(id, i);
    nodes[id] = {
      id,
      t: "u",
      ref: u.userDID,
      name: u.userName || u.email || u.userDID,
      sub: u.subtitle || u.email,
      ini: initials(u.userName || u.email || "?"),
      av: i % 5,
      svc: u.kind === "service" || !u.signed,
      y: 8 + ROW_H.u / 2 + i * USER_PITCH,
    };
  });

  /* ---------- Agents and apps ---------- */
  const userAgentLinks = users.flatMap((u) =>
    u.agentEdges.map((e) => ({ from: nodeId("u", e.from), to: e.to, w: e.count })),
  );
  const agents = byBarycenter(graph.agents, (a) => a.agentDID, userAgentLinks, userPos);
  const agentPos = new Map(agents.map((a, k) => [nodeId("a", a.agentDID), k]));
  const agentAppLinks = graph.agentAppEdges.map((e) => ({ from: nodeId("a", e.from), to: e.to, w: e.count }));
  const apps = byBarycenter(graph.apps, (p) => p.appDID, agentAppLinks, agentPos);
  const appPos = new Map(apps.map((p, k) => [p.appDID, k]));

  // Intents sit next to the first app they reached; ones that reached no app go last.
  const firstApp = (ds: string[]) => (ds.length ? Math.min(...ds.map((d) => appPos.get(d)!)) : apps.length);
  const intentList =
    intents?.list
      .map((it) => ({ it, apps: it.appDIDs.filter((d) => appPos.has(d)) }))
      .sort((x, y) => firstApp(x.apps) - firstApp(y.apps)) ?? [];

  const height = Math.max(
    MIN_PLANE_H,
    USER_LIST_TOP + 24 + Math.max(agents.length * PITCH.a, apps.length * PITCH.p, intentList.length * PITCH.i),
  );

  const agentY = spread(agents.length, PITCH.a, height);
  agents.forEach((a, k) => {
    const id = nodeId("a", a.agentDID);
    nodes[id] = {
      id,
      t: "a",
      ref: a.agentDID,
      name: a.agentName || a.agentDID,
      sub: `${a.usersCount} user${a.usersCount === 1 ? "" : "s"}${a.revoked ? " · revoked" : ""}`,
      y: agentY(k),
    };
  });

  const appCalls = new Map<string, number>();
  for (const e of graph.agentAppEdges) appCalls.set(e.to, (appCalls.get(e.to) ?? 0) + e.count);
  const appY = spread(apps.length, PITCH.p, height);
  apps.forEach((p, k) => {
    const id = nodeId("p", p.appDID);
    const calls = appCalls.get(p.appDID) ?? 0;
    nodes[id] = {
      id,
      t: "p",
      ref: p.appDID,
      name: p.appName || p.appDID,
      sub: `${calls.toLocaleString()} call${calls === 1 ? "" : "s"}`,
      y: appY(k),
    };
  });

  /* ---------- Resting edges and flows ---------- */
  for (const u of users) {
    for (const e of u.agentEdges) {
      const from = nodeId("u", e.from);
      const to = nodeId("a", e.to);
      if (!nodes[to]) continue;
      const edge = toEdge(from, to, e);
      edges.set(edge.id, edge);
      flows.push({ n: [from, to], es: [edge], st: edge.st });
    }
  }
  for (const e of graph.agentAppEdges) {
    const from = nodeId("a", e.from);
    const to = nodeId("p", e.to);
    if (!nodes[from] || !nodes[to]) continue;
    const edge = toEdge(from, to, e);
    edges.set(edge.id, edge);
    flows.push({ n: ["", from, to], es: [null, edge], st: edge.st });
  }

  /* ---------- Picked user: their own agent → app traffic ---------- */
  if (userFlow) {
    const u = nodeId("u", userFlow.userDID);
    const userEdges = new Map<string, PlaneEdge>();
    for (const e of userFlow.agentEdges) {
      const to = nodeId("a", e.to);
      if (!nodes[u] || !nodes[to]) continue;
      const edge = toEdge(u, to, e);
      edges.set(edge.id, edge);
      userEdges.set(to, edge);
    }
    for (const e of userFlow.agentAppEdges) {
      const a = nodeId("a", e.from);
      const p = nodeId("p", e.to);
      const ua = userEdges.get(a);
      if (!ua || !nodes[p]) continue;
      // User-scoped counts replace the org-wide ones on this edge while the user is picked.
      const ap = toEdge(a, p, e);
      edges.set(ap.id, ap);
      flows.push({ n: [u, a, p], es: [ua, ap], st: worst([ua.st, ap.st]) });
    }
  }

  /* ---------- Picked user + agent: intents ---------- */
  if (intents) {
    const u = nodeId("u", intents.userDID);
    const a = nodeId("a", intents.agentDID);
    const ua = edges.get(`${u}>${a}`) ?? null;
    const intentY = (k: number) => USER_LIST_TOP + 8 + PITCH.i / 2 + k * PITCH.i;
    intentList.forEach(({ it, apps: appDIDs }, k) => {
      const id = nodeId("i", it.intentID);
      nodes[id] = {
        id,
        t: "i",
        ref: it.intentID,
        name: it.intentTitle || it.intentID,
        st: it.outcome,
        meta:
          it.outcome === "allowed"
            ? `${it.interactionsCount.toLocaleString()} ixns · ${ago(it.lastAt)}${ago(it.lastAt) === "just now" ? "" : " ago"}`
            : `${it.policy ?? "Needs review"} · ${it.flags} flag${it.flags === 1 ? "" : "s"}`,
        y: intentY(k),
      };
      if (!appDIDs.length) {
        // Ran through the agent without reaching an app (e.g. flagged before the call).
        flows.push({ n: [u, a, "", id], es: [ua, null, null], st: it.outcome });
      }
      for (const d of appDIDs) {
        const p = nodeId("p", d);
        const ap = edges.get(`${a}>${p}`) ?? null;
        const pi: PlaneEdge = {
          id: `${p}>${id}`,
          from: p,
          to: id,
          n: it.interactionsCount,
          st: it.outcome,
          lastAt: it.lastAt,
          pol: it.policy ?? undefined,
          allowed: Math.max(0, it.interactionsCount - it.flags),
          elevated: 0,
          flagged: it.flags,
        };
        edges.set(pi.id, pi);
        flows.push({
          n: [u, a, p, id],
          es: [ua, ap, pi],
          // The intent's own outcome (worst of its hops): the agent → app edge also counts
          // other intents' hops, so its outcome would over-flag this one.
          st: it.outcome,
        });
      }
    });
  }

  return { nodes, edges: [...edges.values()], flows, height };
}
