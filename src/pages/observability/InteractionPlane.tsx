import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode, type Ref, type UIEvent } from "react";
import { Icon } from "../../components/Icon";
import {
  fetchObsAgentFlow,
  fetchObsGraph,
  fetchObsIntents,
  fetchObsPaths,
  fetchObsSummary,
  fetchObsUserFlow,
  fetchObsUsers,
  type ObsPath,
  type ObsPathFilter,
  type ObsScope,
  type ObsUser,
  type ObsUsersPage,
} from "../../api/observability";
import {
  COLUMNS,
  COLUMN_TYPE,
  ORDER,
  PLANE_W,
  ROW_H,
  USER_LIST_TOP,
  USER_PITCH,
  ago,
  columnOf,
  listHeight,
  listY,
  buildPlaneModel,
  nodeId,
  type ListColumn,
  type PlaneColumn,
  type PlaneEdge,
  type PlaneFlow,
  type PlaneNode,
  type PlaneStatus,
} from "./planeModel";
import { IntentDetailPanel } from "./IntentDetailPanel";

/**
 * Observability · Interaction plane.
 *
 * A five-column map: User → Agent → Peer agents → App → Intent.
 *
 * Selection drills left to right: pick a user and the agents in their intents light up;
 * pick one of those agents and the peer column is repopulated with the agents it worked
 * with in that user's intents, and the apps those intents involved light up. Pick a peer
 * to narrow the apps to the intents the two agents shared, then an app to see those
 * intents. The box below shows every path matching the selection, or the picked intent's
 * detail.
 * Data: middleware `/observability-*` endpoints (src/api/observability.ts).
 */

const STATUS_COLOR: Record<PlaneStatus, string> = { allowed: "#059669", elevated: "#D97706", flagged: "#DC2626" };
const STATUS_TINT: Record<PlaneStatus, string> = {
  allowed: "rgba(5,150,105,.12)",
  elevated: "rgba(217,119,6,.12)",
  flagged: "rgba(220,38,38,.12)",
};
const LINE_COLOR: Record<PlaneStatus, string> = { allowed: "#2563EB", elevated: "#D97706", flagged: "#DC2626" };
const RING: Record<PlaneColumn, string> = {
  u: "rgba(46,74,127,.75)",
  a: "rgba(37,99,235,.8)",
  r: "rgba(37,99,235,.8)",
  p: "rgba(27,138,143,.8)",
  i: "rgba(46,74,127,.7)",
};
const RING_TINT: Record<PlaneColumn, string> = {
  u: "rgba(46,74,127,.14)",
  a: "rgba(37,99,235,.16)",
  r: "rgba(37,99,235,.16)",
  p: "rgba(27,138,143,.16)",
  i: "rgba(46,74,127,.12)",
};
/** Resting node outline — dark enough to read against the dotted canvas. */
const NODE_BORDER = "rgba(15,32,70,.24)";
const AVATARS: [string, string][] = [
  ["rgba(37,99,235,.10)", "#2563EB"],
  ["rgba(14,165,233,.12)", "#0B7FB5"],
  ["rgba(95,115,160,.14)", "#2E4A7F"],
  ["rgba(27,138,143,.12)", "#1B8A8F"],
  ["rgba(10,34,64,.08)", "#0A2240"],
];

type Filter = "all" | "risk" | "flagged";
const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All intents" },
  { key: "risk", label: "High risk" },
  { key: "flagged", label: "Flagged only" },
];

/**
 * The canvas always loads everything in the window and filters client-side (so a filter
 * dims rather than removes); only the trace box asks the server with `status=`.
 */
const REST: ObsScope = { range: "all", status: "all" };
const RANGE_LABEL = "All time";
const USERS_PAGE = 50;

/** Room either side of cards inside a scroll list, so the pick ring isn't clipped. */
const LIST_GUTTER = 8;

/** Position of a card inside its scroll list (its column's width, offset by the gutter). */
const listRowBox = (n: PlaneNode): CSSProperties => ({
  left: LIST_GUTTER,
  top: n.y - ROW_H[n.t] / 2,
  width: COLUMNS[n.t][1] - COLUMNS[n.t][0],
  height: ROW_H[n.t],
});
/** Edges below this volume collapse to a small dot instead of a count pill. */
const PILL_THRESHOLD = 10;
const NEXT_HINT: Record<PlaneColumn, string> = {
  u: "Pick an agent to see the agents it worked with and the apps involved.",
  a: "Pick a peer agent to narrow the apps to the intents they shared, or an app to see intents.",
  r: "Pick an app to see the intents the two agents shared there.",
  p: "Pick an intent to see its detail.",
  i: "",
};
const PATH_PARAM: Record<PlaneColumn, keyof ObsPathFilter> = {
  u: "userDID",
  a: "agentDID",
  r: "peerDID",
  p: "appDID",
  i: "intentID",
};

/** One selected node per layer, filled left to right. Values are plane node ids. */
type Chain = Partial<Record<PlaneColumn, string>>;

const matchesChain = (f: PlaneFlow, chain: Chain) =>
  ORDER.every((col, k) => !chain[col] || f.n[k] === chain[col]);

/** DID / intentID behind a plane node id (`u:<did>` → `<did>`). */
const refOf = (id: string) => id.slice(2);

const fmt = (n: number) => (n < 1000 ? String(n) : `${(n / 1000).toFixed(1).replace(/\.0$/, "")}K`);
const tint = (st: PlaneStatus, alpha: string) => STATUS_TINT[st].replace(".12", alpha);
const glyph = (st: PlaneStatus) => (st === "flagged" ? "×" : st === "elevated" ? "!" : "");
const errorText = (e: unknown) => (e instanceof Error ? e.message : "Request failed");

type Visibility = "normal" | "lit" | "muted";

/**
 * Fetch-once-per-key with a per-component cache: a null key fetches nothing, and a key
 * seen before is served from the cache, so clicking back and forth doesn't refetch.
 */
function useObsQuery<T>(key: string | null, fetcher: () => Promise<T>) {
  const [store, setStore] = useState<Record<string, { data?: T; error?: string }>>({});
  const entry = key ? store[key] : undefined;
  useEffect(() => {
    if (!key || entry) return;
    let live = true;
    fetcher().then(
      (data) => live && setStore((s) => ({ ...s, [key]: { data } })),
      (e: unknown) => live && setStore((s) => ({ ...s, [key]: { error: errorText(e) } })),
    );
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, entry]);
  return {
    data: entry?.data ?? null,
    error: entry?.error ?? null,
    loading: !!key && !entry,
    retry: () =>
      key &&
      setStore((s) => {
        const next = { ...s };
        delete next[key];
        return next;
      }),
  };
}

export function InteractionPlane() {
  const [chain, setChain] = useState<Chain>({});
  const [hovered, setHovered] = useState<string | null>(null);
  const [traceMode, setTraceMode] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [hoverEdge, setHoverEdge] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [userScroll, setUserScroll] = useState(0);
  const [agentScroll, setAgentScroll] = useState(0);
  /** Peer-list scroll, tied to the agent whose peers it lists (a new agent starts at the top). */
  const [peerScrollState, setPeerScrollState] = useState({ key: "", top: 0 });
  /** Intent-list scroll, tied to the selection it was scrolled under (a new selection starts at the top). */
  const [intentScrollState, setIntentScrollState] = useState({ key: "", top: 0 });
  const [searchMiss, setSearchMiss] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const userListRef = useRef<HTMLDivElement>(null);
  const agentListRef = useRef<HTMLDivElement>(null);
  const peerListRef = useRef<HTMLDivElement>(null);
  const intentListRef = useRef<HTMLDivElement>(null);

  /* ---------- Data ---------- */

  const summary = useObsQuery("summary", () => fetchObsSummary(REST));
  const graph = useObsQuery("graph", () => fetchObsGraph(REST));

  // The user layer pages in as it scrolls; pages load one after another.
  const [userPages, setUserPages] = useState<ObsUsersPage[]>([]);
  const [usersWanted, setUsersWanted] = useState(1);
  const [usersError, setUsersError] = useState<string | null>(null);
  /** Users found through search that aren't on a loaded page yet. */
  const [foundUsers, setFoundUsers] = useState<ObsUser[]>([]);
  useEffect(() => {
    const next = userPages.length + 1;
    if (next > usersWanted || usersError) return;
    let live = true;
    fetchObsUsers(REST, next, USERS_PAGE).then(
      (page) => live && setUserPages((p) => (p.length === next - 1 ? [...p, page] : p)),
      (e: unknown) => live && setUsersError(errorText(e)),
    );
    return () => {
      live = false;
    };
  }, [userPages, usersWanted, usersError]);

  const usersTotal = userPages[0]?.total ?? 0;
  const hasMoreUsers = userPages.length > 0 && userPages.length < (userPages[0]?.totalPages ?? 0);
  const users = useMemo(() => {
    const listed = userPages.flatMap((p) => p.usersList);
    const seen = new Set(listed.map((u) => u.userDID));
    return [...listed, ...foundUsers.filter((u) => !seen.has(u.userDID))];
  }, [userPages, foundUsers]);

  const pickedUser = chain.u ? refOf(chain.u) : null;
  const pickedAgent = chain.a ? refOf(chain.a) : null;
  // A peer or app only counts once a user and agent are picked; before that they just highlight.
  const pickedPeer = pickedUser && pickedAgent && chain.r ? refOf(chain.r) : null;
  const pickedApp = pickedUser && pickedAgent && chain.p ? refOf(chain.p) : null;
  const userFlow = useObsQuery(pickedUser && `flow:${pickedUser}`, () => fetchObsUserFlow(REST, pickedUser!));
  const agentFlow = useObsQuery(
    pickedUser && pickedAgent && `aflow:${pickedUser}:${pickedAgent}`,
    () => fetchObsAgentFlow(REST, pickedUser!, pickedAgent!),
  );
  const peerFlow = useObsQuery(
    agentFlow.data && pickedPeer && `aflow:${pickedUser}:${pickedAgent}:${pickedPeer}`,
    () => fetchObsAgentFlow(REST, pickedUser!, pickedAgent!, pickedPeer!),
  );
  const intents = useObsQuery(
    pickedApp && `intents:${pickedUser}:${pickedAgent}:${pickedPeer ?? ""}:${pickedApp}`,
    () => fetchObsIntents(REST, pickedUser!, pickedAgent!, { peerDID: pickedPeer ?? undefined, appDID: pickedApp! }),
  );

  const model = useMemo(
    () =>
      graph.data
        ? buildPlaneModel({
            graph: graph.data,
            users,
            userFlow: userFlow.data,
            agentFlow: agentFlow.data ? { base: agentFlow.data, narrowed: pickedPeer ? peerFlow.data : null } : null,
            intents:
              intents.data && pickedUser && pickedAgent && pickedApp
                ? {
                    userDID: pickedUser,
                    agentDID: pickedAgent,
                    peerDID: pickedPeer,
                    appDID: pickedApp,
                    list: intents.data.intentsList,
                  }
                : null,
          })
        : null,
    [graph.data, users, userFlow.data, agentFlow.data, peerFlow.data, intents.data, pickedUser, pickedAgent, pickedPeer, pickedApp],
  );
  const NODES = model?.nodes ?? {};
  const planeH = model?.height ?? 760;
  const userListH = planeH - USER_LIST_TOP;

  const booting = graph.loading || summary.loading || (userPages.length === 0 && !usersError);
  const bootError = graph.error || summary.error || (userPages.length === 0 ? usersError : null);
  const retryBoot = () => {
    graph.retry();
    summary.retry();
    setUsersError(null);
  };

  /* ---------- Layout effects ---------- */

  // Scale the fixed-size canvas down to fit narrow viewports; below the floor it scrolls instead.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => setScale(Math.max(0.55, Math.min(1, (el.clientWidth - 48) / PLANE_W)));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Esc clears the current flow (selection and any hover preview).
  useEffect(() => {
    const onKey = (ev: globalThis.KeyboardEvent) => {
      if (ev.key !== "Escape") return;
      setChain({});
      setHovered(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /* ---------- Selection ---------- */

  const FLOWS = useMemo(() => model?.flows ?? [], [model]);
  const preview = traceMode && hovered && NODES[hovered] ? hovered : null;
  const chainIds = ORDER.map((c) => chain[c]).filter((x): x is string => !!x);
  const hasChain = chainIds.length > 0;
  /** Deepest selected layer; the layer after it is what gets revealed. */
  const depth = ORDER.reduce((d, col, k) => (chain[col] ? k : d), -1);

  const filtered = useMemo(
    () => FLOWS.filter((f) => (filter === "all" ? true : filter === "risk" ? f.st !== "allowed" : f.st === "flagged")),
    [FLOWS, filter],
  );

  /** Paths the canvas highlights. */
  const activeFlows = useMemo(() => {
    if (preview) return filtered.filter((f) => f.n.includes(preview));
    return filtered.filter((f) => matchesChain(f, chain));
  }, [filtered, preview, chain]);

  const hasFocus = !!preview || hasChain;
  const emphasis = hasFocus || filter !== "all";
  /**
   * Intents only appear once a user, an agent and an app are picked: the intents that user
   * ran through that agent (and the picked peer, if any) which involved that app.
   */
  const showIntents = !!pickedApp;
  const visibleIntents = useMemo(() => {
    const ids = new Set<string>();
    if (!showIntents) return ids;
    for (const f of filtered) if (matchesChain(f, chain) && f.n[4]) ids.add(f.n[4]);
    return ids;
  }, [filtered, chain, showIntents]);

  // A hover preview shows whole paths; a chain reveals one layer past its deepest pick,
  // except that picking user + agent reveals its peers and apps together.
  const revealTo = preview || !hasChain ? ORDER.length - 1 : Math.max(depth + 1, pickedUser && pickedAgent ? 3 : 0);
  const revealed = (id: string) => ORDER.indexOf(columnOf(id)) <= revealTo;

  const { litNodes, litEdges } = useMemo(() => {
    const litNodes = new Set<string>();
    const litEdges = new Set<string>();
    for (const f of activeFlows) {
      for (const x of [...f.n, ...(f.also ?? [])]) if (x && revealed(x)) litNodes.add(x);
      for (const e of f.es) if (revealed(e.to)) litEdges.add(e.id);
    }
    return { litNodes, litEdges };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFlows, revealTo]);

  const visibility = (lit: boolean): Visibility => (!emphasis ? "normal" : lit ? (hasFocus ? "lit" : "normal") : "muted");
  const isPicked = (id: string) => (preview ? id === preview : chainIds.includes(id));

  /**
   * Clicking a node sets its layer in the chain and clears every layer after it. Earlier
   * picks are kept when they still lead to this node; otherwise the chain restarts here.
   * Clicking a picked node un-picks it (and everything after it).
   */
  const pick = (id: string) => {
    const col = NODES[id].t;
    const k = ORDER.indexOf(col);
    setChain((cur) => {
      const upstream: Chain = {};
      ORDER.slice(0, k).forEach((c) => cur[c] && (upstream[c] = cur[c]));
      if (cur[col] === id) return upstream;
      const next = { ...upstream, [col]: id };
      return FLOWS.some((f) => matchesChain(f, next)) ? next : { [col]: id };
    });
    if (col === "u") revealAgentsOf(id);
  };

  /** If none of a user's agents is on screen in the agent list, scroll to the first of them. */
  const revealAgentsOf = (userId: string) => {
    const ys = FLOWS.filter((f) => f.n[0] === userId && f.n[1]).map((f) => NODES[f.n[1]]?.y ?? Infinity);
    if (!ys.length || ys.some((y) => y - agentScroll > 0 && y - agentScroll < userListH)) return;
    revealAgent(Math.min(...ys));
  };
  const revealAgent = (y: number) => {
    agentListRef.current?.scrollTo({ top: Math.max(0, y - userListH / 2), behavior: "smooth" });
  };
  const revealPeer = (y: number) => {
    peerListRef.current?.scrollTo({ top: Math.max(0, y - userListH / 2), behavior: "smooth" });
  };
  const revealIntent = (y: number) => {
    intentListRef.current?.scrollTo({ top: Math.max(0, y - userListH / 2), behavior: "smooth" });
  };

  const nodeHandlers = (id: string) => ({
    onClick: () => pick(id),
    onMouseEnter: () => traceMode && setHovered(id),
    onMouseLeave: () => setHovered(null),
  });

  /** Highlight styling shared by every node card. Position is added by the caller. */
  const nodeLook = (node: PlaneNode): CSSProperties => {
    const vis = visibility(litNodes.has(node.id));
    const picked = isPicked(node.id);
    let border = NODE_BORDER;
    let background = "#fff";
    if (node.t === "i" && node.st && node.st !== "allowed") {
      border = node.st === "flagged" ? "rgba(220,38,38,.5)" : "rgba(217,119,6,.55)";
      background = node.st === "flagged" ? "#FEF7F7" : "#FFFAF2";
    }
    if (node.svc) border = "rgba(220,38,38,.5)";
    if (vis === "lit") border = picked ? "#2563EB" : RING[node.t];
    const boxShadow = picked
      ? "0 0 0 4px rgba(37,99,235,.16), 0 4px 14px rgba(10,34,64,.10)"
      : vis === "lit"
        ? `0 0 0 3px ${RING_TINT[node.t]}, 0 2px 8px rgba(10,34,64,.06)`
        : "0 1px 2px rgba(15,32,70,.06)";
    return {
      borderColor: border,
      borderWidth: picked ? 2 : 1,
      background,
      boxShadow,
      opacity: vis === "muted" ? 0.3 : 1,
    };
  };

  const nodeBox = (node: PlaneNode): CSSProperties => {
    const [left, right] = COLUMNS[node.t];
    const h = ROW_H[node.t];
    return { left, top: node.y - h / 2, width: right - left, height: h, ...nodeLook(node) };
  };

  const byColumn = (t: PlaneColumn) => Object.values(NODES).filter((n) => n.t === t);
  const userNodes = byColumn("u");
  const agentNodes = byColumn("a");
  const peerNodes = byColumn("r");
  const peerListKey = agentFlow.data ? `${chain.u}|${chain.a}` : "rest";
  const peerScroll = peerScrollState.key === peerListKey ? peerScrollState.top : 0;
  /** Intents showing right now, re-stacked so a narrowed list has no gaps. */
  const intentNodes = byColumn("i")
    .filter((n) => visibleIntents.has(n.id))
    .map((n, k) => ({ ...n, y: listY("i", k) }));
  const intentById = new Map(intentNodes.map((n) => [n.id, n]));
  const nodeAt = (id: string): PlaneNode | undefined => intentById.get(id) ?? NODES[id];
  const intentListKey = `${chain.u}|${chain.a}|${chain.r}|${chain.p}|${filter}`;
  const intentScroll = intentScrollState.key === intentListKey ? intentScrollState.top : 0;

  /* ---------- Edges, count pills and tooltip ---------- */

  /** How far a node's list is scrolled; apps don't scroll. */
  const scrollOf = (node: PlaneNode) =>
    node.t === "u" ? userScroll : node.t === "a" ? agentScroll : node.t === "r" ? peerScroll : node.t === "i" ? intentScroll : null;

  /** Where a node's centre sits on the canvas; list rows follow their list's scroll position. */
  const canvasY = (node: PlaneNode) => {
    const scroll = scrollOf(node);
    if (scroll == null) return node.y;
    const y = USER_LIST_TOP + node.y - scroll;
    // Rows scrolled out of view anchor their lines to the list's top/bottom edge.
    return Math.max(USER_LIST_TOP + 10, Math.min(USER_LIST_TOP + userListH - 10, y));
  };
  const inView = (node: PlaneNode) => {
    const scroll = scrollOf(node);
    if (scroll == null) return true;
    const y = node.y - scroll;
    return y > 0 && y < userListH;
  };

  const edgeGeometry = (model?.edges ?? [])
    .filter((e) => NODES[e.from] && NODES[e.to] && (NODES[e.to].t !== "i" || visibleIntents.has(e.to)))
    .map((e) => {
      const a = nodeAt(e.from)!;
      const b = nodeAt(e.to)!;
      const x1 = COLUMNS[a.t][1];
      const x2 = COLUMNS[b.t][0];
      const y1 = canvasY(a);
      const y2 = canvasY(b);
      const cx = (x1 + x2) / 2;
      // A line that skips a column (agent → app, past the peers) carries its pill in the last
      // gap, so it doesn't sit on a card. Agent → peer lines all leave one card, so their
      // pills sit nearer the peers, where the lines have fanned out.
      const t = ORDER.indexOf(b.t) - ORDER.indexOf(a.t) > 1 ? 0.85 : a.t === "a" && b.t === "r" ? 0.62 : 0.5;
      const bez = (p0: number, p1: number, p2: number, p3: number) =>
        (1 - t) ** 3 * p0 + 3 * (1 - t) ** 2 * t * p1 + 3 * (1 - t) * t ** 2 * p2 + t ** 3 * p3;
      const vis = visibility(litEdges.has(e.id));
      const offscreen = !inView(a) || !inView(b);
      return { e, a, d: `M${x1} ${y1} C${cx} ${y1} ${cx} ${y2} ${x2} ${y2}`, cx: bez(x1, cx, cx, x2), my: bez(y1, y1, y2, y2), vis, offscreen };
    });

  const hoveredEdge = edgeGeometry.find((g) => g.e.id === hoverEdge);
  const tooltip = hoveredEdge ? { x: hoveredEdge.cx, y: hoveredEdge.my, edge: hoveredEdge.e } : null;

  const edgeHover = (id: string) => ({
    onMouseEnter: () => setHoverEdge(id),
    onMouseLeave: () => setHoverEdge(null),
  });

  /* ---------- Trace table ---------- */

  const hasRows = emphasis && !!model;
  const pathFilter: ObsPathFilter | null = !hasRows
    ? null
    : preview
      ? { [PATH_PARAM[NODES[preview].t]]: refOf(preview) }
      : Object.fromEntries(ORDER.filter((c) => chain[c]).map((c) => [PATH_PARAM[c], refOf(chain[c]!)]));
  const pathsKey = pathFilter && `paths:${filter}:${JSON.stringify(pathFilter)}`;
  const paths = useObsQuery(pathsKey, () => fetchObsPaths({ ...REST, status: filter }, pathFilter!));

  // The picked intent's detail has its own call, so it stays put while the filter or a hover preview changes the table.
  const pickedIntent = chain.i ? refOf(chain.i) : null;
  const intentDetail = useObsQuery(pickedIntent && `intent-detail:${pickedIntent}`, () =>
    fetchObsPaths(REST, { intentID: pickedIntent! }, 1),
  );
  const nameOf = (did: string) => (["u", "a", "p"] as const).map((t) => NODES[nodeId(t, did)]?.name).find(Boolean);
  const rows = paths.data?.pathsList ?? [];

  const flaggedCount = rows.filter((r) => r.outcome === "flagged").length;
  const elevatedCount = rows.filter((r) => r.outcome === "elevated").length;
  const agentCount = new Set(rows.map((r) => r.agent.did)).size;
  const appCount = new Set(rows.map((r) => r.app?.did).filter(Boolean)).size;
  const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;
  const traceStats: [string, string, PlaneStatus?][] = paths.data
    ? [
        ["Paths", paths.data.total.toLocaleString()],
        ["Interactions", rows.reduce((s, r) => s + r.interactionsCount, 0).toLocaleString()],
        ["Agents", String(agentCount)],
        ["Apps", String(appCount)],
        ["Flagged", String(flaggedCount), "flagged"],
        ["Needs review", String(elevatedCount), "elevated"],
      ]
    : [];
  /** Open a path's intent in the detail box, keeping the canvas on the same user → agent → peer → app. */
  const openPath = (r: ObsPath) => {
    if (!r.intent) return;
    setChain({
      u: nodeId("u", r.user.did),
      a: nodeId("a", r.agent.did),
      ...(r.peer ? { r: nodeId("r", r.peer.did) } : {}),
      ...(r.app ? { p: nodeId("p", r.app.did) } : {}),
      i: nodeId("i", r.intent.id),
    });
    setHovered(null);
  };
  const traceKicker = preview
    ? `TRACE PREVIEW · ${COLUMN_TYPE[NODES[preview].t].toUpperCase()}`
    : hasChain
      ? `TRACE · ${ORDER.filter((c) => chain[c]).map((c) => COLUMN_TYPE[c].toUpperCase()).join(" → ")}`
      : filter !== "all"
        ? "FILTER"
        : "TRACE";
  const traceTitle = preview
    ? NODES[preview].name
    : hasChain
      ? chainIds.map((id) => NODES[id]?.name ?? "…").join(" → ")
      : filter === "risk"
        ? "High-risk interactions"
        : filter === "flagged"
          ? "Flagged interactions"
          : "No selection";
  const nextHint = !preview && hasChain ? NEXT_HINT[ORDER[depth]] : "";

  /* ---------- User list: scroll paging and search ---------- */

  const onUserScroll = (ev: UIEvent<HTMLDivElement>) => {
    const el = ev.currentTarget;
    setUserScroll(el.scrollTop);
    const nearEnd = el.scrollTop + el.clientHeight >= el.scrollHeight - 2 * USER_PITCH;
    if (nearEnd && hasMoreUsers && userPages.length === usersWanted && !usersError) setUsersWanted((w) => w + 1);
  };

  /** Scroll the user list so a user is in view (search, or an off-screen pick). */
  const revealUser = (y: number) => {
    userListRef.current?.scrollTo({ top: Math.max(0, y - userListH / 2), behavior: "smooth" });
  };

  const onSearchKey = (ev: KeyboardEvent<HTMLInputElement>) => {
    setSearchMiss(false);
    if (ev.key !== "Enter") return;
    const q = ev.currentTarget.value.trim().toLowerCase();
    if (!q) return;
    const hit = Object.values(NODES).find(
      (n) => n.name.toLowerCase().includes(q) || (n.sub ?? "").toLowerCase().includes(q) || n.ref.toLowerCase() === q,
    );
    if (hit) {
      setChain({ [hit.t]: hit.id });
      setHovered(null);
      if (hit.t === "u") revealUser(hit.y);
      if (hit.t === "a") revealAgent(hit.y);
      if (hit.t === "r") revealPeer(hit.y);
      if (hit.t === "i") revealIntent(intentById.get(hit.id)?.y ?? hit.y);
      return;
    }
    // Not on a loaded page — ask the server, then add the user to the bottom of the list.
    fetchObsUsers(REST, 1, 1, q)
      .then((res) => {
        const u = res.usersList[0];
        if (!u) return setSearchMiss(true);
        setFoundUsers((cur) => (cur.some((x) => x.userDID === u.userDID) ? cur : [...cur, u]));
        setChain({ u: nodeId("u", u.userDID) });
        setHovered(null);
        requestAnimationFrame(() => {
          const el = userListRef.current;
          el?.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
        });
      })
      .catch(() => setSearchMiss(true));
  };

  /* ---------- Header ---------- */

  const headline = summary.data
    ? `${plural(summary.data.identities, "identity").replace("identitys", "identities")} · ${plural(summary.data.agents, "agent")} · ` +
      `${plural(summary.data.apps, "app")} · ${summary.data.toolInteractions.toLocaleString()} tool interactions · ${RANGE_LABEL}`
    : summary.error
      ? `Summary unavailable · ${RANGE_LABEL}`
      : "Loading…";

  const isEmpty = !!model && userNodes.length === 0 && agentNodes.length === 0;

  return (
    <div className="ip-layout">
      {/* ================= Plane ================= */}
      <section className="ip-card ip-main">
        <header className="ip-head">
          <div style={{ minWidth: 0 }}>
            <div className="ip-title-row">
              <h1 className="ip-title">Interaction plane</h1>
              <span className="chip safe ip-live">
                <span className="ip-live-dot" />
                Live
              </span>
            </div>
            <div className="ip-summary">{headline}</div>
          </div>
          <div className="ip-head-tools">
            <label className={`ip-search${searchMiss ? " miss" : ""}`} title={searchMiss ? "No match" : undefined}>
              <Icon name="search" size={14} />
              <input placeholder="Find a node…" onKeyDown={onSearchKey} aria-label="Find a user, agent, app or intent" aria-invalid={searchMiss} />
            </label>
            <div className="seg">
              {FILTERS.map((f) => (
                <button key={f.key} type="button" className={filter === f.key ? "active" : ""} onClick={() => setFilter(f.key)}>
                  {f.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              className={`btn${traceMode ? " primary" : ""}`}
              onClick={() => {
                setTraceMode((v) => !v);
                setHovered(null);
              }}
            >
              <Icon name="activity" size={15} />
              Trace interaction
            </button>
          </div>
        </header>

        <div ref={wrapRef} className="ip-canvas-wrap" style={{ height: Math.round(planeH * scale + 40) }}>
          <div className="ip-canvas" style={{ width: PLANE_W, height: planeH, transform: `scale(${scale})` }}>
            <ColumnLabel col="u" n="01 · USER" hint={`Who initiated · ${usersTotal}`} />
            <ColumnLabel col="a" n="02 · AGENT" hint="Which agent acted" />
            <ColumnLabel
              col="r"
              n="03 · PEER AGENTS"
              hint={agentFlow.data && chain.a ? `Worked with ${NODES[chain.a]?.name ?? "this agent"}` : "Agents it worked with"}
            />
            <ColumnLabel col="p" n="04 · APP" hint="What was accessed" />
            <ColumnLabel col="i" n="05 · INTENT" hint="Shown for the picked app" />

            {(booting || bootError || isEmpty) && (
              <div className="ip-state" style={{ top: USER_LIST_TOP, height: userListH - 8 }}>
                {bootError ? (
                  <>
                    <div className="ip-state-title">Couldn't load the interaction plane</div>
                    <div className="ip-state-body">{bootError}</div>
                    <button type="button" className="btn" onClick={retryBoot}>Retry</button>
                  </>
                ) : booting ? (
                  <div className="ip-state-body">Loading interactions…</div>
                ) : (
                  <>
                    <div className="ip-state-title">No interactions yet</div>
                    <div className="ip-state-body">No interaction has reached an agent yet.</div>
                  </>
                )}
              </div>
            )}

            <svg className="ip-edges" width={PLANE_W} height={planeH}>
              {edgeGeometry.map(({ e, d, vis, offscreen }) => {
                const lit = vis === "lit";
                const sw = 1.1 + Math.min(1.7, Math.log10(e.n + 1) * 0.55) + (lit ? 0.4 : 0);
                const base = vis === "muted" ? 0.08 : lit ? 0.9 : e.st === "allowed" ? 0.42 : 0.65;
                const op = offscreen ? base * 0.35 : base;
                return (
                  <g key={e.id}>
                    <path
                      d={d}
                      fill="none"
                      stroke={LINE_COLOR[e.st]}
                      strokeWidth={sw}
                      strokeOpacity={op}
                      strokeDasharray={e.st === "flagged" ? "4 4" : undefined}
                      strokeLinecap="round"
                    />
                    {lit && e.st !== "flagged" && (
                      <path d={d} fill="none" stroke="#fff" strokeWidth={sw * 0.7} strokeDasharray="2 16" strokeLinecap="round" strokeOpacity={0.95}>
                        <animate attributeName="stroke-dashoffset" from="36" to="0" dur="1.6s" repeatCount="indefinite" />
                      </path>
                    )}
                  </g>
                );
              })}
            </svg>

            {edgeGeometry.map(({ e, a, cx, my, vis, offscreen }) => {
              // The agent → peer gap is too narrow for the FLAGGED tag; the red × carries it.
              const tagged = e.st === "flagged" && a.t !== "a";
              const muted = vis === "muted";
              if (offscreen) return null;
              if (e.st === "allowed" && e.n < PILL_THRESHOLD && vis !== "lit") {
                return (
                  <div key={e.id} className="ip-dot" style={{ left: cx, top: my, opacity: muted ? 0.25 : 1 }} {...edgeHover(e.id)} />
                );
              }
              return (
                <div
                  key={e.id}
                  className="ip-pill"
                  style={{
                    left: cx,
                    top: my,
                    opacity: muted ? 0.25 : 1,
                    color: e.st === "allowed" ? "var(--fg-dim)" : STATUS_COLOR[e.st],
                    background: e.st === "flagged" ? "#FEF6F6" : e.st === "elevated" ? "#FFF9F0" : "#fff",
                    borderColor:
                      e.st === "allowed"
                        ? vis === "lit"
                          ? "rgba(37,99,235,.55)"
                          : "rgba(15,32,70,.26)"
                        : e.st === "flagged"
                          ? "rgba(220,38,38,.45)"
                          : "rgba(217,119,6,.5)",
                  }}
                  {...edgeHover(e.id)}
                >
                  {e.st !== "allowed" && <span style={{ color: STATUS_COLOR[e.st] }}>{glyph(e.st)}</span>}
                  <span>{fmt(e.n)}</span>
                  {tagged && <span className="ip-pill-tag">FLAGGED</span>}
                </div>
              );
            })}

            <PlaneList
              col="u"
              listRef={userListRef}
              height={userListH}
              contentHeight={listHeight("u", userNodes.length) + (hasMoreUsers ? 36 : 0)}
              onScroll={onUserScroll}
            >
              {userNodes.map((n) => {
                const [bg, fg] = n.svc ? ["rgba(220,38,38,.08)", "#DC2626"] : AVATARS[n.av ?? 0];
                return (
                  <div
                    key={n.id}
                    className="ip-node ip-node-user"
                    style={{ ...listRowBox(n), ...nodeLook(n) }}
                    title={n.sub}
                    {...nodeHandlers(n.id)}
                  >
                    <div className="ip-av" style={{ background: bg, color: fg }}>{n.ini}</div>
                    <div className="ip-node-text">
                      <div className="ip-node-name" style={{ fontFamily: n.svc ? "var(--font-mono)" : undefined }}>{n.name}</div>
                      <div className="ip-node-sub">{n.sub}</div>
                    </div>
                  </div>
                );
              })}
              {hasMoreUsers && (
                <div className="ip-user-more" style={{ left: LIST_GUTTER, top: listHeight("u", userNodes.length) }}>
                  {usersError ? (
                    <button type="button" className="btn ghost" onClick={() => setUsersError(null)}>Retry</button>
                  ) : (
                    "Loading more…"
                  )}
                </div>
              )}
            </PlaneList>

            <PlaneList
              col="a"
              listRef={agentListRef}
              height={userListH}
              contentHeight={listHeight("a", agentNodes.length)}
              onScroll={(ev) => setAgentScroll(ev.currentTarget.scrollTop)}
            >
              {agentNodes.map((n) => (
                <div
                  key={n.id}
                  className="ip-node ip-node-agent"
                  style={{ ...listRowBox(n), ...nodeLook(n) }}
                  title={n.ref}
                  {...nodeHandlers(n.id)}
                >
                  <div className="ip-glyph ip-glyph-agent"><Icon name="agents" size={16} /></div>
                  <div className="ip-node-text">
                    <div className="ip-node-name ip-display">{n.name}</div>
                    <div className="ip-node-sub ip-mono">{n.sub}</div>
                  </div>
                </div>
              ))}
            </PlaneList>

            <PlaneList
              key={peerListKey}
              col="r"
              listRef={peerListRef}
              height={userListH}
              contentHeight={listHeight("r", peerNodes.length)}
              onScroll={(ev) => setPeerScrollState({ key: peerListKey, top: ev.currentTarget.scrollTop })}
            >
              {peerNodes.map((n) => (
                <div
                  key={n.id}
                  className="ip-node ip-node-agent"
                  style={{ ...listRowBox(n), ...nodeLook(n) }}
                  title={n.ref}
                  {...nodeHandlers(n.id)}
                >
                  <div className="ip-glyph ip-glyph-agent"><Icon name="agents" size={16} /></div>
                  <div className="ip-node-text">
                    <div className="ip-node-name ip-display">{n.name}</div>
                    <div className="ip-node-sub ip-mono">{n.sub}</div>
                  </div>
                </div>
              ))}
            </PlaneList>
            {pickedUser && pickedAgent && (agentFlow.loading || agentFlow.error || agentFlow.data?.peers.length === 0) && (
              <div className="ip-intent-gate" style={{ left: COLUMNS.r[0], top: USER_LIST_TOP + 8, width: COLUMNS.r[1] - COLUMNS.r[0], height: 120 }}>
                <div className="ip-intent-gate-body">
                  {agentFlow.loading ? (
                    "Loading peer agents…"
                  ) : agentFlow.error ? (
                    <>
                      Couldn't load peer agents: {agentFlow.error}{" "}
                      <button type="button" className="btn ghost" onClick={agentFlow.retry}>Retry</button>
                    </>
                  ) : (
                    "No other agent took part in this user's intents with this agent."
                  )}
                </div>
              </div>
            )}

            {byColumn("p").map((n) => (
              <div key={n.id} className="ip-node ip-node-app" style={nodeBox(n)} title={n.ref} {...nodeHandlers(n.id)}>
                <div className="ip-glyph ip-glyph-app"><Icon name="box" size={14} /></div>
                <div className="ip-node-text">
                  <div className="ip-node-name">{n.name}</div>
                  <div className="ip-node-sub ip-mono">{n.sub}</div>
                </div>
              </div>
            ))}

            {!showIntents && !booting && !bootError && !isEmpty && (
              <div
                className="ip-intent-gate"
                style={{ left: COLUMNS.i[0], top: USER_LIST_TOP + 8, width: COLUMNS.i[1] - COLUMNS.i[0], height: userListH - 16 }}
              >
                <Icon name="intents" size={18} />
                <div className="ip-intent-gate-title">Intents appear here</div>
                <div className="ip-intent-gate-body">
                  {!chain.u
                    ? "Pick a user, then an agent, then an app."
                    : !chain.a
                      ? "Now pick one of the highlighted agents."
                      : "Pick an app to see the intents that involved it."}
                </div>
              </div>
            )}
            {showIntents && visibleIntents.size === 0 && (
              <div className="ip-intent-gate" style={{ left: COLUMNS.i[0], top: USER_LIST_TOP + 8, width: COLUMNS.i[1] - COLUMNS.i[0], height: 120 }}>
                <div className="ip-intent-gate-body">
                  {intents.loading ? (
                    "Loading intents…"
                  ) : intents.error ? (
                    <>
                      Couldn't load intents: {intents.error}{" "}
                      <button type="button" className="btn ghost" onClick={intents.retry}>Retry</button>
                    </>
                  ) : (
                    "No intents match this selection and filter."
                  )}
                </div>
              </div>
            )}
            {intentNodes.length > 0 && (
              <PlaneList
                key={intentListKey}
                col="i"
                listRef={intentListRef}
                height={userListH}
                contentHeight={listHeight("i", intentNodes.length)}
                onScroll={(ev) => setIntentScrollState({ key: intentListKey, top: ev.currentTarget.scrollTop })}
              >
                {intentNodes.map((n) => {
                  const st = n.st ?? "allowed";
                  return (
                    <div key={n.id} className="ip-node ip-node-intent" style={{ ...listRowBox(n), ...nodeLook(n) }} title={n.name} {...nodeHandlers(n.id)}>
                      <div className="ip-intent-top">
                        <span className="ip-status-dot" style={{ background: STATUS_COLOR[st], boxShadow: `0 0 0 3px ${STATUS_TINT[st]}` }} />
                        <span className="ip-node-name">{n.name}</span>
                      </div>
                      <div className="ip-intent-meta">
                        <span style={{ color: STATUS_COLOR[st], fontWeight: 600, letterSpacing: ".08em" }}>{st.toUpperCase()}</span>
                        <span style={{ color: "var(--fg-faint)" }}>·</span>
                        <span className="ip-ellipsis" style={{ color: "var(--fg-muted)" }}>{n.meta}</span>
                      </div>
                    </div>
                  );
                })}
              </PlaneList>
            )}

            {tooltip && <EdgeTooltip {...tooltip} />}
          </div>
        </div>

        {/* ================= Detail box: the picked intent's hops, or every path in the trace ================= */}
        {pickedIntent ? (
          <IntentDetailPanel
            intentId={pickedIntent}
            intent={intentDetail.data?.pathsList[0]?.intent ?? null}
            loading={intentDetail.loading}
            error={intentDetail.error}
            onRetry={intentDetail.retry}
            onClose={() =>
              setChain((cur) => {
                const next = { ...cur };
                delete next.i;
                return next;
              })
            }
            nameOf={nameOf}
          />
        ) : (
        <div className="ip-trace">
          <div className="ip-trace-head">
            <span className="ip-kicker">{traceKicker}</span>
            <span className="ip-trace-title">{traceTitle}</span>
            {nextHint && <span className="ip-trace-next">{nextHint}</span>}
            {hasChain && (
              <button
                type="button"
                className="btn ghost ip-clear"
                onClick={() => {
                  setChain({});
                  setHovered(null);
                }}
              >
                Clear trace
              </button>
            )}
          </div>
          {hasRows ? (
            <>
              {paths.data && rows.length > 0 && (
                <div className="ip-trace-stats">
                  {traceStats.map(([k, v, st]) => (
                    <div key={k} className="ip-trace-stat">
                      <div className="k">{k}</div>
                      <div className="v" style={st && v !== "0" ? { color: STATUS_COLOR[st] } : undefined}>{v}</div>
                    </div>
                  ))}
                </div>
              )}
              {paths.loading && <div className="ip-empty">Loading paths…</div>}
              {paths.error && (
                <div className="ip-empty">
                  Couldn't load paths: {paths.error}{" "}
                  <button type="button" className="btn ghost" onClick={paths.retry}>Retry</button>
                </div>
              )}
              {paths.data && rows.length === 0 && <div className="ip-empty">No paths match this selection and filter.</div>}
              <div className="ip-hops-list">
                {rows.map((r, k) => (
                  <PathHops key={k} row={r} onOpen={r.intent ? () => openPath(r) : undefined} />
                ))}
              </div>
              {paths.data && paths.data.total > rows.length && (
                <div className="ip-empty" style={{ marginTop: 10 }}>
                  Showing the {rows.length} most recent of {paths.data.total.toLocaleString()} paths. Narrow the selection to see the rest.
                </div>
              )}
            </>
          ) : (
            <div className="ip-empty">
              Start with a user: the agents in their intents light up. Pick an agent to see the agents it worked with and the apps involved, pick a peer to narrow to the intents the two shared, then an app to see those intents. Turn on Trace interaction to preview whole paths on hover.
            </div>
          )}
        </div>
        )}
      </section>
    </div>
  );
}

/* ---------------- Pieces ---------------- */

/**
 * One of the matching scroll lists (users, agents, peers, intents): same top and height,
 * a gutter either side of its column, and the edge fade only once it actually scrolls.
 */
function PlaneList({
  col,
  listRef,
  height,
  contentHeight,
  onScroll,
  children,
}: {
  col: ListColumn;
  listRef: Ref<HTMLDivElement>;
  height: number;
  contentHeight: number;
  onScroll: (ev: UIEvent<HTMLDivElement>) => void;
  children: ReactNode;
}) {
  const [left, right] = COLUMNS[col];
  return (
    <div
      ref={listRef}
      className={`ip-list${contentHeight > height ? " scrolls" : ""}`}
      style={{ left: left - LIST_GUTTER, top: USER_LIST_TOP, height, width: right - left + LIST_GUTTER * 2 }}
      onScroll={onScroll}
    >
      <div style={{ position: "relative", height: contentHeight }}>{children}</div>
    </div>
  );
}

function ColumnLabel({ col, n, hint }: { col: PlaneColumn; n: string; hint: string }) {
  const [left, right] = COLUMNS[col];
  return (
    <div className="ip-col-label" style={{ left, width: right - left }}>
      <div className="ip-col-title">{n}</div>
      <div className="ip-col-hint">{hint}</div>
    </div>
  );
}

/** One party on a path card: its layer and name, full DID on hover. */
function HopNode({ kind, did, name }: { kind: string; did?: string; name?: string }) {
  return (
    <span className="ip-hop-node" title={did}>
      <span className="k">{kind}</span>
      <span className="v">{did ? name || did : "—"}</span>
    </span>
  );
}

function HopArrow() {
  return (
    <span className="ip-hop-gate">
      <span className="ip-hop-line" />
      <span className="ip-hop-line arrow" />
    </span>
  );
}

/**
 * A path in the trace as its hops — user → agent → peer → app — with the intent it ran and
 * how it ended. Clicking opens that intent's detail.
 */
function PathHops({ row, onOpen }: { row: ObsPath; onOpen?: () => void }) {
  const code = row.policy?.split(" ")[0];
  const title = row.intent
    ? row.intent.titleFull || row.intent.title || row.intent.id
    : "No intent recorded";
  return (
    <div
      className={`ip-hops ip-hops-${row.outcome}${onOpen ? " clickable" : ""}`}
      onClick={onOpen}
      onKeyDown={onOpen && ((ev) => (ev.key === "Enter" || ev.key === " ") && (ev.preventDefault(), onOpen()))}
      role={onOpen ? "button" : undefined}
      tabIndex={onOpen ? 0 : undefined}
    >
      <div className="ip-hops-top">
        <span
          className="ip-outcome"
          style={{ color: STATUS_COLOR[row.outcome], background: tint(row.outcome, ".07"), borderColor: tint(row.outcome, ".22") }}
        >
          {row.outcome.toUpperCase()}
        </span>
        <span className="ip-hops-title" style={{ color: row.intent ? undefined : "var(--fg-faint)" }} title={row.intent?.titleFull ?? row.intent?.title}>
          {title}
        </span>
        {code && row.outcome !== "allowed" && <span className="ip-mono ip-faint" title={row.policy ?? "Threat code"}>{code}</span>}
        <span className="ip-hops-meta">
          <span className="ip-mono">{fmt(row.interactionsCount)} interactions</span>
          {onOpen && <span className="ip-hops-open">Details →</span>}
        </span>
      </div>
      <div className="ip-hops-chain">
        <HopNode kind="User" did={row.user.did} name={row.user.name} />
        <HopArrow />
        <HopNode kind="Agent" did={row.agent.did} name={row.agent.name} />
        {row.peer && (
          <>
            <HopArrow />
            <HopNode kind="Peer agent" did={row.peer.did} name={row.peer.name} />
          </>
        )}
        <HopArrow />
        <HopNode kind="App" did={row.app?.did} name={row.app?.name} />
      </div>
    </div>
  );
}

function EdgeTooltip({ x, y, edge }: { x: number; y: number; edge: PlaneEdge }) {
  const last = edge.lastAt ? ago(edge.lastAt) : null;
  return (
    <div className="ip-tooltip" style={{ left: x, top: y }}>
      <div className="ip-tooltip-title">{edge.n.toLocaleString()} interactions</div>
      {last && <div className="ip-tooltip-line">Last interaction: {last === "just now" ? last : `${last} ago`}</div>}
      {edge.tips?.map((t) => (
        <div key={t} className="ip-tooltip-line">{t}</div>
      ))}
      {edge.split && (
        <div className="ip-mono ip-tooltip-split">
          Allowed {edge.split.allowed.toLocaleString()} · Flagged {edge.split.flagged.toLocaleString()}
          {edge.split.elevated ? ` · Review ${edge.split.elevated.toLocaleString()}` : ""}
        </div>
      )}
      <div className="ip-mono ip-tooltip-split" style={{ color: STATUS_COLOR[edge.st] }}>
        {edge.pol ?? edge.st.charAt(0).toUpperCase() + edge.st.slice(1)}
      </div>
    </div>
  );
}
