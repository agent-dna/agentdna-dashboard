/**
 * Layout and graph model for the Observability interaction plane, built from the
 * middleware's `/observability-*` responses (see src/api/observability.ts).
 *
 * The plane reads left to right in one of two modes:
 * - user-first: User → Agent → Peer agents → App → Intent. The peer column lists every
 *   agent at rest; once a user and an agent are picked it is repopulated with the agents
 *   that took part in the same intents as that agent.
 * - app-first: App → Agent → Peer agents → User → Intent. Picking an app and an agent
 *   repopulates the peers; picking a peer repopulates the users.
 */

import type {
  ObsAgentFlow,
  ObsAppFlow,
  ObsAppFlowUser,
  ObsAgentFlowApp,
  ObsGateEdge,
  ObsGraph,
  ObsHopRollup,
  ObsIntent,
  ObsOutcome,
  ObsUser,
  ObsUserFlow,
} from "../../api/observability";

/** `r` is the peer-agent column. */
export type PlaneColumn = "u" | "a" | "r" | "p" | "i";
export type PlaneMode = "user" | "app";
export type PlaneStatus = ObsOutcome;

export interface PlaneNode {
  /** Column-prefixed id (`u:<did>`, `i:<intentID>`, …) so ids never collide across layers. */
  id: string;
  t: PlaneColumn;
  /** DID, or intentID for intents — what the API expects back. */
  ref: string;
  name: string;
  /**
   * Vertical centre, relative to the top of the node's scrollable list.
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
  /** Interactions. */
  n: number;
  st: PlaneStatus;
  /** ISO timestamp of the latest hop, when known. */
  lastAt?: string;
  pol?: string;
  /** Interactions by outcome, when the API splits them. */
  split?: { allowed: number; elevated: number; flagged: number };
  /** Extra tooltip lines. */
  tips?: string[];
}

/**
 * A path through the plane: `n` has one node per column in the layout's order (`""` where
 * a column isn't part of it), `also` any further nodes it lights, and `es` the edges it lights.
 */
export interface PlaneFlow {
  n: string[];
  also?: string[];
  es: PlaneEdge[];
  st: PlaneStatus;
}

export interface PlaneModel {
  nodes: Record<string, PlaneNode>;
  edges: PlaneEdge[];
  flows: PlaneFlow[];
  height: number;
}

export const PLANE_W = 1547;

export interface PlaneLayout {
  /** Columns left to right. */
  order: PlaneColumn[];
  /** [left, right] of each column on the canvas. */
  columns: Record<PlaneColumn, [number, number]>;
}
const WIDTH: Record<PlaneColumn, number> = { u: 176, a: 180, r: 180, p: 160, i: 303 };
const layout = (order: PlaneColumn[], left: number[]): PlaneLayout => ({
  order,
  columns: Object.fromEntries(order.map((c, k) => [c, [left[k], left[k] + WIDTH[c]]])) as PlaneLayout["columns"],
});
export const LAYOUTS: Record<PlaneMode, PlaneLayout> = {
  // User-first gaps hold 60px gates, centred: 115px for one COCA, 270px for
  // COCA + CBAC + Whitelisting. The last gap, into the intents, is a tight 48px.
  user: layout(["u", "a", "r", "p", "i"], [0, 291, 586, 1036, 1244]),
  // App-first has no gates: three ~167px gaps, then a tight 48px into the intents.
  app: layout(["p", "a", "r", "u", "i"], [0, 327, 674, 1020, 1244]),
};
/** Every card is the same height, so the lists line up row for row and show the same number of cards. */
export const ROW_H: Record<PlaneColumn, number> = { u: 56, a: 56, r: 56, p: 56, i: 56 };
/** The scroll lists start below the column titles. */
export const USER_LIST_TOP = 56;
/**
 * Every column is a matching scroll list: same top, same height, same
 * top padding and the same gap between cards, rows stacked from the top.
 */
const LIST_PAD = 8;
const LIST_GAP = 12;
export type ListColumn = PlaneColumn;
export const LIST_PITCH: Record<ListColumn, number> = {
  u: ROW_H.u + LIST_GAP,
  a: ROW_H.a + LIST_GAP,
  r: ROW_H.r + LIST_GAP,
  p: ROW_H.p + LIST_GAP,
  i: ROW_H.i + LIST_GAP,
};
/** Centre of row `k` in a list, relative to the list's top. */
export const listY = (col: ListColumn, k: number) => LIST_PAD + k * LIST_PITCH[col] + ROW_H[col] / 2;
/** Scroll height of a list holding `count` rows. */
export const listHeight = (col: ListColumn, count: number) => (count ? LIST_PAD * 2 + count * LIST_PITCH[col] - LIST_GAP : 0);
export const USER_PITCH = LIST_PITCH.u;
/** Cards a list shows before it scrolls. */
const LIST_VISIBLE = 9;
/** Viewport height of every scroll list. */
export const LIST_VIEW_H = listHeight("a", LIST_VISIBLE);
const PLANE_H = USER_LIST_TOP + LIST_VIEW_H + 8;
const COLUMN_COUNT = 5;

export const COLUMN_TYPE: Record<PlaneColumn, string> = { u: "User", a: "Agent", r: "Peer agent", p: "App", i: "Intent" };

/** Column of a plane node id, from its prefix. */
export const columnOf = (id: string) => id[0] as PlaneColumn;

const RANK: Record<PlaneStatus, number> = { allowed: 0, elevated: 1, flagged: 2 };
export const worst = (sts: PlaneStatus[]): PlaneStatus =>
  sts.reduce<PlaneStatus>((w, s) => (RANK[s] > RANK[w] ? s : w), "allowed");

export const nodeId = (t: PlaneColumn, ref: string) => `${t}:${ref}`;
/** DID / intentID behind a plane node id (`u:<did>` → `<did>`). */
export const refOf = (id: string) => id.slice(2);

const initials = (name: string) => {
  const parts = name.replace(/@.*/, "").split(/[\s._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "?") + (parts[1]?.[0] ?? "")).toUpperCase();
};

const plural = (n: number, w: string) => `${n.toLocaleString()} ${w}${n === 1 ? "" : "s"}`;

/** "3m", "2h", "4d" — or "just now". */
export function ago(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (!Number.isFinite(s) || s < 45) return "just now";
  if (s < 3600) return `${Math.round(s / 60)}m`;
  if (s < 86400) return `${Math.round(s / 3600)}h`;
  return `${Math.round(s / 86400)}d`;
}

const rollupEdge = (from: string, to: string, e: ObsGateEdge | ObsHopRollup, tips?: string[]): PlaneEdge => ({
  id: `${from}>${to}`,
  from,
  to,
  n: e.count,
  st: e.outcome,
  lastAt: e.lastAt,
  pol: e.policies[0],
  split: { allowed: e.allowed, elevated: e.elevated, flagged: e.flagged },
  tips,
});

/** One agent's calls to an app: the API gives a count and outcome per caller, not a split. */
const callEdge = (from: string, to: string, c: ObsAgentFlowApp["calledBy"][number], app: ObsAgentFlowApp): PlaneEdge => {
  const others = app.calledBy.length - 1;
  return {
    id: `${from}>${to}`,
    from,
    to,
    n: c.count,
    st: c.outcome,
    tips: [
      `${app.appName || "App"} overall: ${plural(app.count, "interaction")} in ${plural(app.intentsCount, "intent")}`,
      ...(others > 0 ? [`Also called by ${plural(others, "other agent")}`] : []),
    ],
  };
};

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

type UserCard = Pick<ObsUser | ObsAppFlowUser, "userDID" | "userName" | "email" | "subtitle" | "kind" | "signed">;

const userNode = (u: UserCard, k: number): PlaneNode => ({
  id: nodeId("u", u.userDID),
  t: "u",
  ref: u.userDID,
  name: u.userName || u.email || u.userDID,
  sub: u.subtitle || u.email,
  ini: initials(u.userName || u.email || "?"),
  av: k % 5,
  svc: u.kind === "service" || !u.signed,
  y: listY("u", k),
});

const agentSub = (a: ObsGraph["agents"][number]) => `${plural(a.usersCount, "user")}${a.revoked ? " · revoked" : ""}`;

const peerNodes = (peers: ObsAgentFlow["peers"]): PlaneNode[] =>
  [...peers]
    .sort((x, y) => y.count - x.count)
    .map((p, k) => ({
      id: nodeId("r", p.agentDID),
      t: "r",
      ref: p.agentDID,
      name: p.agentName || p.agentDID,
      // Whether the two messaged each other directly is on the line's tooltip.
      sub: `${plural(p.intentsCount, "shared intent")}${p.revoked ? " · revoked" : ""}`,
      y: listY("r", k),
    }));

const peerTips = (p: ObsAgentFlow["peers"][number]) => [
  p.direct
    ? `Direct: ${p.direct.sent.toLocaleString()} sent · ${p.direct.received.toLocaleString()} received`
    : "No direct messages · shared intents only",
  plural(p.intentsCount, "shared intent"),
];

const intentNode = (it: ObsIntent, k: number): PlaneNode => {
  const agentsNote = it.agents?.length ? `${plural(it.agents.length, "agent")} · ` : "";
  return {
    id: nodeId("i", it.intentID),
    t: "i",
    ref: it.intentID,
    name: it.intentTitle || it.intentID,
    st: it.outcome,
    meta:
      it.outcome === "allowed"
        ? `${agentsNote}${it.interactionsCount.toLocaleString()} ixns · ${ago(it.lastAt)}${ago(it.lastAt) === "just now" ? "" : " ago"}`
        : `${it.policy ?? "Needs review"} · ${plural(it.flags, "flag")}`,
    // The plane re-stacks whichever intents are showing, so this is only the default.
    y: listY("i", k),
  };
};

/** Shared bookkeeping for both builders. */
function modelParts() {
  const nodes: Record<string, PlaneNode> = {};
  const edges = new Map<string, PlaneEdge>();
  const flows: PlaneFlow[] = [];
  const addNode = (n: PlaneNode) => (nodes[n.id] = n);
  const addEdge = (e: PlaneEdge) => (edges.set(e.id, e), e);
  const addFlow = (n: string[], es: (PlaneEdge | null | undefined)[], st?: PlaneStatus, also?: string[]) => {
    const list = es.filter((e): e is PlaneEdge => !!e);
    flows.push({
      n: Array.from({ length: COLUMN_COUNT }, (_, k) => n[k] ?? ""),
      es: list,
      st: st ?? worst(list.map((e) => e.st)),
      also,
    });
  };
  return { nodes, edges, flows, addNode, addEdge, addFlow };
}

interface BuildInput {
  graph: ObsGraph;
  users: ObsUser[];
  /** The picked user's agents, once loaded. */
  userFlow: ObsUserFlow | null;
  /**
   * Peers and apps for the picked user + agent, once loaded. `narrowed` is the same call
   * with the picked peer, which narrows the apps to the intents the two shared.
   */
  agentFlow: { base: ObsAgentFlow; narrowed: ObsAgentFlow | null } | null;
  /** Intents for the picked user + agent (+ peer) + app, once loaded. */
  intents: { userDID: string; agentDID: string; peerDID: string | null; appDID: string; list: ObsIntent[] } | null;
}

/** User-first plane: User → Agent → Peer agents → App → Intent. */
export function buildPlaneModel({ graph, users, userFlow, agentFlow, intents }: BuildInput): PlaneModel {
  const { nodes, edges, flows, addNode, addEdge, addFlow } = modelParts();

  /* ---------- Users (list order = most recently active first) ---------- */
  const userPos = new Map<string, number>();
  users.forEach((u, i) => userPos.set(addNode(userNode(u, i)).id, i));

  /* ---------- Agents ---------- */
  const userAgentLinks = users.flatMap((u) =>
    u.agentEdges.map((e) => ({ from: nodeId("u", e.from), to: e.to, w: e.count })),
  );
  const agents = byBarycenter(graph.agents, (a) => a.agentDID, userAgentLinks, userPos);
  agents.forEach((a, k) => {
    const id = nodeId("a", a.agentDID);
    nodes[id] = { id, t: "a", ref: a.agentDID, name: a.agentName || a.agentDID, sub: agentSub(a), y: listY("a", k) };
  });

  /* ---------- Peer column: every agent at rest, the picked agent's peers once loaded ---------- */
  if (agentFlow) {
    peerNodes(agentFlow.base.peers).forEach(addNode);
  } else {
    agents.forEach((a, k) => {
      const id = nodeId("r", a.agentDID);
      nodes[id] = { id, t: "r", ref: a.agentDID, name: a.agentName || a.agentDID, sub: agentSub(a), y: listY("r", k) };
    });
  }

  /* ---------- Apps (order stays fixed whatever is picked) ---------- */
  const agentPos = new Map(agents.map((a, k) => [nodeId("a", a.agentDID), k]));
  const agentAppLinks = graph.agentAppEdges.map((e) => ({ from: nodeId("a", e.from), to: e.to, w: e.count }));
  const flowApps = agentFlow ? (agentFlow.narrowed ?? agentFlow.base).apps : [];
  const known = new Set(graph.apps.map((p) => p.appDID));
  const apps = [
    ...byBarycenter(graph.apps, (p) => p.appDID, agentAppLinks, agentPos),
    // Apps the agent flow reached that the org-wide graph left out.
    ...flowApps.filter((p) => !known.has(p.appDID)).map((p) => ({ appDID: p.appDID, appName: p.appName, operation: "" })),
  ];
  const appCalls = new Map<string, number>();
  for (const e of graph.agentAppEdges) appCalls.set(e.to, (appCalls.get(e.to) ?? 0) + e.count);
  const flowApp = new Map(flowApps.map((p) => [p.appDID, p]));
  apps.forEach((p, k) => {
    const id = nodeId("p", p.appDID);
    const fa = flowApp.get(p.appDID);
    const calls = fa?.count ?? appCalls.get(p.appDID) ?? 0;
    nodes[id] = {
      id,
      t: "p",
      ref: p.appDID,
      name: p.appName || p.appDID,
      sub: fa ? `${fmtCount(calls)} interactions` : plural(calls, "call"),
      y: listY("p", k),
    };
  });

  /* ---------- User → agent ---------- */
  for (const u of users) {
    for (const e of u.agentEdges) {
      const from = nodeId("u", e.from);
      const to = nodeId("a", e.to);
      if (!nodes[to]) continue;
      addFlow([from, to], [addEdge(rollupEdge(from, to, e))]);
    }
  }
  if (userFlow) {
    const u = nodeId("u", userFlow.userDID);
    const direct = new Set<string>();
    for (const e of userFlow.agentEdges) {
      const to = nodeId("a", e.to);
      if (!nodes[u] || !nodes[to]) continue;
      direct.add(to);
      addFlow([u, to], [addEdge(rollupEdge(u, to, e))]);
    }
    // Agents that worked on the user's intents without the user messaging them: lit, no line.
    for (const x of userFlow.involvedAgents ?? []) {
      const a = nodeId("a", x.agentDID);
      if (nodes[u] && nodes[a] && !direct.has(a)) addFlow([u, a], [], x.outcome);
    }
  }

  /* ---------- At rest: peer-column agents → apps, org-wide ---------- */
  if (!agentFlow) {
    for (const e of graph.agentAppEdges) {
      const from = nodeId("r", e.from);
      const to = nodeId("p", e.to);
      if (!nodes[from] || !nodes[to]) continue;
      addFlow(["", "", from, to], [addEdge(rollupEdge(from, to, e))]);
    }
  }

  /* ---------- Picked user + agent: peers and apps ---------- */
  if (agentFlow) {
    const { base, narrowed } = agentFlow;
    const u = nodeId("u", base.userDID);
    const a = nodeId("a", base.agentDID);
    const ua = edges.get(`${u}>${a}`);
    const peerEdge = new Map<string, PlaneEdge>();
    for (const p of base.peers) {
      const r = nodeId("r", p.agentDID);
      const e = addEdge(rollupEdge(a, r, p, peerTips(p)));
      peerEdge.set(r, e);
      addFlow([u, a, r], [ua, e]);
    }

    const peer = narrowed?.peerDID ? nodeId("r", narrowed.peerDID) : null;
    for (const app of (narrowed ?? base).apps) {
      const p = nodeId("p", app.appDID);
      if (!nodes[p]) continue;
      const byA = app.calledBy.find((c) => c.agentDID === base.agentDID);
      const ap = byA ? addEdge(callEdge(a, p, byA, app)) : null;
      if (peer) {
        // Narrowed to one peer: every app belongs to the pair, whichever of them called it.
        const byB = app.calledBy.find((c) => nodeId("r", c.agentDID) === peer);
        const bp = byB && nodes[peer] ? addEdge(callEdge(peer, p, byB, app)) : null;
        addFlow([u, a, peer, p], [ua, peerEdge.get(peer), ap, bp], app.outcome);
        continue;
      }
      for (const c of app.calledBy) {
        const r = nodeId("r", c.agentDID);
        if (c.agentDID === base.agentDID || !nodes[r]) continue;
        addFlow([u, a, r, p], [ua, peerEdge.get(r), addEdge(callEdge(r, p, c, app))], app.outcome);
      }
      // Lights the app even when only other agents called it.
      addFlow([u, a, "", p], [ua, ap], app.outcome);
    }
  }

  /* ---------- Picked user + agent (+ peer) + app: intents ---------- */
  if (intents) {
    const u = nodeId("u", intents.userDID);
    const a = nodeId("a", intents.agentDID);
    const r = intents.peerDID ? nodeId("r", intents.peerDID) : "";
    const picked = nodeId("p", intents.appDID);
    intents.list.forEach((it, k) => {
      const { id } = addNode(intentNode(it, k));
      // Every app the intent reached feeds into it, so agents that went to different apps
      // meet again at the intent they share.
      const appIds = [...new Set([intents.appDID, ...it.appDIDs])].map((d) => nodeId("p", d)).filter((p) => nodes[p]);
      const es = appIds.map((p) =>
        addEdge({
          id: `${p}>${id}`,
          from: p,
          to: id,
          n: it.appCalls?.filter((c) => nodeId("p", c.appDID) === p).reduce((s, c) => s + c.count, 0) || it.interactionsCount,
          st: it.outcome,
          lastAt: it.lastAt,
          pol: it.policy ?? undefined,
        }),
      );
      // Light the picked agent's and peer's lines into the intent's other apps too.
      const callers = appIds.flatMap((p) => [edges.get(`${a}>${p}`), r ? edges.get(`${r}>${p}`) : undefined]);
      addFlow([u, a, r, picked, id], [...es, ...callers], it.outcome, appIds.filter((p) => p !== picked));
    });
  }

  return { nodes, edges: [...edges.values()], flows, height: PLANE_H };
}

function fmtCount(n: number) {
  return n < 1000 ? String(n) : `${(n / 1000).toFixed(1).replace(/\.0$/, "")}K`;
}

interface AppBuildInput {
  graph: ObsGraph;
  /** The paged user list, shown until a peer is picked. */
  users: ObsUser[];
  /**
   * Peers for the picked app + agent, once loaded. `narrowed` is the same call with the
   * picked peer, which adds the users behind the intents the three share.
   */
  appFlow: { base: ObsAppFlow; narrowed: ObsAppFlow | null } | null;
  /** Intents for the picked app + agent + peer + user, once loaded. */
  intents: { userDID: string; agentDID: string; peerDID: string; appDID: string; list: ObsIntent[] } | null;
}

/** App-first plane: App → Agent → Peer agents → User → Intent. Flow `n` follows that order. */
export function buildAppPlaneModel({ graph, users, appFlow, intents }: AppBuildInput): PlaneModel {
  const { nodes, edges, flows, addNode, addEdge, addFlow } = modelParts();
  const narrowed = appFlow?.narrowed ?? null;

  /* ---------- Apps (busiest first) ---------- */
  const appCalls = new Map<string, number>();
  for (const e of graph.agentAppEdges) appCalls.set(e.to, (appCalls.get(e.to) ?? 0) + e.count);
  const apps = [...graph.apps].sort((x, y) => (appCalls.get(y.appDID) ?? 0) - (appCalls.get(x.appDID) ?? 0));
  const appPos = new Map<string, number>();
  apps.forEach((p, k) => {
    const calls = appCalls.get(p.appDID) ?? 0;
    appPos.set(nodeId("p", p.appDID), k);
    addNode({ id: nodeId("p", p.appDID), t: "p", ref: p.appDID, name: p.appName || p.appDID, sub: plural(calls, "call"), y: listY("p", k) });
  });

  /* ---------- Agents, ordered to follow the apps they call ---------- */
  const appAgentLinks = graph.agentAppEdges.map((e) => ({ from: nodeId("p", e.to), to: e.from, w: e.count }));
  const agents = byBarycenter(graph.agents, (a) => a.agentDID, appAgentLinks, appPos);
  agents.forEach((a, k) =>
    addNode({ id: nodeId("a", a.agentDID), t: "a", ref: a.agentDID, name: a.agentName || a.agentDID, sub: agentSub(a), y: listY("a", k) }),
  );

  /* ---------- Peer column: every agent at rest, the picked agent's peers once loaded ---------- */
  if (appFlow) peerNodes(appFlow.base.peers).forEach(addNode);
  else
    agents.forEach((a, k) =>
      addNode({ id: nodeId("r", a.agentDID), t: "r", ref: a.agentDID, name: a.agentName || a.agentDID, sub: agentSub(a), y: listY("r", k) }),
    );

  /* ---------- Users: the paged list, or the picked trio's users once loaded ---------- */
  if (narrowed) narrowed.users.forEach((u, k) => addNode(userNode(u, k)));
  else users.forEach((u, k) => addNode(userNode(u, k)));

  /* ---------- App → agent (agents drawn to the right of the apps they called) ---------- */
  for (const e of graph.agentAppEdges) {
    const p = nodeId("p", e.to);
    const a = nodeId("a", e.from);
    if (!nodes[p] || !nodes[a]) continue;
    addFlow([p, a], [addEdge(rollupEdge(p, a, e))]);
  }

  /* ---------- At rest: peer-column agents → the users who messaged them ---------- */
  if (!appFlow) {
    for (const u of users) {
      for (const e of u.agentEdges) {
        const r = nodeId("r", e.to);
        const id = nodeId("u", e.from);
        if (!nodes[r] || !nodes[id]) continue;
        addFlow(["", "", r, id], [addEdge(rollupEdge(r, id, e))]);
      }
    }
  }

  /* ---------- Picked app + agent: peers; + peer: users ---------- */
  if (appFlow) {
    const { base } = appFlow;
    const p = nodeId("p", base.appDID);
    const a = nodeId("a", base.agentDID);
    const pa = edges.get(`${p}>${a}`);
    const peerEdge = new Map<string, PlaneEdge>();
    for (const peer of base.peers) {
      const r = nodeId("r", peer.agentDID);
      const e = addEdge(rollupEdge(a, r, peer, peerTips(peer)));
      peerEdge.set(r, e);
      addFlow([p, a, r], [pa, e]);
    }
    if (narrowed?.peerDID) {
      const r = nodeId("r", narrowed.peerDID);
      for (const u of narrowed.users) {
        const id = nodeId("u", u.userDID);
        const e = addEdge(rollupEdge(r, id, u, [plural(u.intentsCount, "intent")]));
        addFlow([p, a, r, id], [pa, peerEdge.get(r), e]);
      }
    }
  }

  /* ---------- + user: intents ---------- */
  if (intents) {
    const p = nodeId("p", intents.appDID);
    const a = nodeId("a", intents.agentDID);
    const r = nodeId("r", intents.peerDID);
    const u = nodeId("u", intents.userDID);
    intents.list.forEach((it, k) => {
      const { id } = addNode(intentNode(it, k));
      const e = addEdge({
        id: `${u}>${id}`,
        from: u,
        to: id,
        n: it.interactionsCount,
        st: it.outcome,
        lastAt: it.lastAt,
        pol: it.policy ?? undefined,
      });
      addFlow([p, a, r, u, id], [e], it.outcome);
    });
  }

  return { nodes, edges: [...edges.values()], flows, height: PLANE_H };
}

export const STATUS_COLOR: Record<PlaneStatus, string> = { allowed: "#059669", elevated: "#D97706", flagged: "#DC2626" };
export const STATUS_TINT: Record<PlaneStatus, string> = {
  allowed: "rgba(5,150,105,.12)",
  elevated: "rgba(217,119,6,.12)",
  flagged: "rgba(220,38,38,.12)",
};
