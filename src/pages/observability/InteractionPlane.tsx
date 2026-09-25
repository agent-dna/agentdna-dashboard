import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type UIEvent } from "react";
import { Icon } from "../../components/Icon";
import {
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
  type ObsWallResult,
  type ObsWallStats,
} from "../../api/observability";
import {
  COLUMNS,
  COLUMN_TYPE,
  GATE2_WALLS,
  PLANE_W,
  ROW_H,
  USER_LIST_TOP,
  USER_PITCH,
  ago,
  buildPlaneModel,
  nodeId,
  type PlaneColumn,
  type PlaneEdge,
  type PlaneFlow,
  type PlaneNode,
  type PlaneStatus,
} from "./planeModel";

/**
 * Observability · Interaction plane.
 *
 * A four-column map (User → Agent → App → Intent) with the gates drawn as bands between
 * columns: gate 1 (user→agent) is a single COCA wall; gate 2 (agent→app) is three walls —
 * COCA, CBAC and Whitelisting.
 *
 * Selection drills left to right: pick a user and the agents they used light up; pick
 * one of those agents and the apps it called in that user's loop light up, with the
 * intents. The table below lists every path matching the current selection.
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
  p: "rgba(27,138,143,.8)",
  i: "rgba(46,74,127,.7)",
};
const RING_TINT: Record<PlaneColumn, string> = {
  u: "rgba(46,74,127,.14)",
  a: "rgba(37,99,235,.16)",
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
 * dims rather than removes); only the trace table asks the server with `status=`.
 */
const REST: ObsScope = { range: "all", status: "all" };
const RANGE_LABEL = "All time";
const USERS_PAGE = 50;

/** Edges below this volume collapse to a small dot instead of a count pill. */
const PILL_THRESHOLD = 10;
const ORDER: PlaneColumn[] = ["u", "a", "p", "i"];
const NEXT_HINT: Record<PlaneColumn, string> = {
  u: "Pick an agent to see its apps and intents for this user.",
  a: "Pick an app to narrow the intents.",
  p: "Pick an intent to see the full path.",
  i: "",
};
const PATH_PARAM: Record<PlaneColumn, keyof ObsPathFilter> = {
  u: "userDID",
  a: "agentDID",
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
const glyph = (st: PlaneStatus, gated: boolean) => (st === "flagged" ? "×" : st === "elevated" ? "!" : gated ? "✓" : "");
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
  const [searchMiss, setSearchMiss] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const userListRef = useRef<HTMLDivElement>(null);

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
  const userFlow = useObsQuery(pickedUser && `flow:${pickedUser}`, () => fetchObsUserFlow(REST, pickedUser!));
  const intents = useObsQuery(
    pickedUser && pickedAgent && `intents:${pickedUser}:${pickedAgent}`,
    () => fetchObsIntents(REST, pickedUser!, pickedAgent!),
  );

  const model = useMemo(
    () =>
      graph.data
        ? buildPlaneModel({
            graph: graph.data,
            users,
            userFlow: userFlow.data,
            intents:
              intents.data && pickedUser && pickedAgent
                ? { userDID: pickedUser, agentDID: pickedAgent, list: intents.data.intentsList }
                : null,
          })
        : null,
    [graph.data, users, userFlow.data, intents.data, pickedUser, pickedAgent],
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
   * Intents only appear once both a user and an agent are picked, and only the intents
   * from that user's runs through that agent (narrowed further by an app, if picked).
   */
  const showIntents = !!chain.u && !!chain.a;
  const visibleIntents = useMemo(() => {
    const ids = new Set<string>();
    if (!showIntents) return ids;
    for (const f of filtered) if (matchesChain(f, chain) && f.n[3]) ids.add(f.n[3]);
    return ids;
  }, [filtered, chain, showIntents]);

  // A hover preview shows whole paths; a chain reveals only one layer past its deepest pick,
  // except that picking user + agent reveals apps and intents together.
  const revealTo = preview || !hasChain || showIntents ? ORDER.length - 1 : depth + 1;

  const { litNodes, litEdges } = useMemo(() => {
    const litNodes = new Set<string>();
    const litEdges = new Set<string>();
    for (const f of activeFlows) {
      f.n.forEach((x, k) => x && k <= revealTo && litNodes.add(x));
      f.es.forEach((e, k) => e && k + 1 <= revealTo && litEdges.add(e.id));
    }
    return { litNodes, litEdges };
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

  /* ---------- Edges, count pills and tooltip ---------- */

  /** Where a node's centre sits on the canvas; users follow the list's scroll position. */
  const canvasY = (node: PlaneNode) => {
    if (node.t !== "u") return node.y;
    const y = USER_LIST_TOP + node.y - userScroll;
    // Users scrolled out of view anchor their lines to the list's top/bottom edge.
    return Math.max(USER_LIST_TOP + 10, Math.min(USER_LIST_TOP + userListH - 10, y));
  };
  const userInView = (node: PlaneNode) => {
    const y = node.y - userScroll;
    return y > 0 && y < userListH;
  };

  const edgeGeometry = (model?.edges ?? [])
    .filter((e) => NODES[e.from] && NODES[e.to] && (NODES[e.to].t !== "i" || visibleIntents.has(e.to)))
    .map((e) => {
      const a = NODES[e.from];
      const b = NODES[e.to];
      const x1 = COLUMNS[a.t][1];
      const x2 = COLUMNS[b.t][0];
      const y1 = canvasY(a);
      const y2 = canvasY(b);
      const cx = (x1 + x2) / 2;
      const my = (y1 + y2) / 2;
      const vis = visibility(litEdges.has(e.id));
      const offscreen = a.t === "u" && !userInView(a);
      return { e, a, d: `M${x1} ${y1} C${cx} ${y1} ${cx} ${y2} ${x2} ${y2}`, cx, my, vis, offscreen };
    });

  // A gate band lights up when a highlighted hop passes through it.
  const cocaLit = edgeGeometry.some((g) => g.vis === "lit" && g.a.t === "u");
  const gate2Lit = edgeGeometry.some((g) => g.vis === "lit" && g.a.t === "a");

  const hoveredEdge = edgeGeometry.find((g) => g.e.id === hoverEdge);
  const tooltip = hoveredEdge ? { x: hoveredEdge.cx, y: hoveredEdge.my, edge: hoveredEdge.e, from: hoveredEdge.a } : null;

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
  const rows = paths.data?.pathsList ?? [];

  const flaggedCount = rows.filter((r) => r.outcome === "flagged").length;
  const elevatedCount = rows.filter((r) => r.outcome === "elevated").length;
  const agentCount = new Set(rows.map((r) => r.agent.did)).size;
  const appCount = new Set(rows.map((r) => r.app?.did).filter(Boolean)).size;
  const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;
  const traceSub = paths.data
    ? `${plural(paths.data.total, "path")} · ${plural(agentCount, "agent")} · ${plural(appCount, "app")}` +
      (flaggedCount ? ` · ${flaggedCount} flagged` : "") +
      (elevatedCount ? ` · ${elevatedCount} elevated` : "")
    : "";
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

  /* ---------- Gate numbers ---------- */

  const gates = summary.data?.gates;
  const rate = (w: ObsWallStats | null | undefined) => (w ? `${w.passRate}%` : "—");
  const fails = (w: ObsWallStats | null | undefined) => (w ? `${w.fail.toLocaleString()} flagged` : "");
  const headline = summary.data
    ? `${plural(summary.data.identities, "identity").replace("identitys", "identities")} · ${plural(summary.data.agents, "agent")} · ` +
      `${plural(summary.data.apps, "app")} · ${summary.data.toolInteractions.toLocaleString()} tool interactions · ${RANGE_LABEL}`
    : summary.error
      ? `Summary unavailable · ${RANGE_LABEL}`
      : "Loading…";

  const isEmpty = !!model && userNodes.length === 0 && byColumn("a").length === 0;

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
            <GateBand
              left={204}
              lit={cocaLit}
              tone="coca"
              name="COCA"
              icon="shield"
              verb="VERIFY"
              desc="Identity & integrity"
              value={rate(gates?.gate1Coca)}
              unit="verified"
              fail={fails(gates?.gate1Coca)}
            />
            <GateBand
              left={GATE2_WALLS[0].left}
              lit={gate2Lit}
              tone="coca"
              name="COCA"
              icon="shield"
              verb="VERIFY"
              desc="Agent identity & integrity"
              value={rate(gates?.gate2Coca)}
              unit="verified"
              fail={fails(gates?.gate2Coca)}
            />
            <GateBand
              left={GATE2_WALLS[1].left}
              lit={gate2Lit}
              tone="cbac"
              name="CBAC"
              icon="key"
              verb="AUTHORIZE"
              desc="Policy & authorization"
              value={gates && !gates.gate2Cbac ? null : rate(gates?.gate2Cbac)}
              unit="allowed"
              fail={fails(gates?.gate2Cbac)}
            />
            <GateBand
              left={GATE2_WALLS[2].left}
              lit={gate2Lit}
              tone="whitelist"
              name="Whitelist"
              icon="check"
              verb="APPROVED"
              desc="Agent approved, not revoked"
              value={rate(gates?.gate2Whitelist)}
              unit="approved"
              fail={fails(gates?.gate2Whitelist)}
            />

            <ColumnLabel left={0} width={168} n="01 · USER" hint={`Who initiated · ${usersTotal}`} />
            <ColumnLabel left={352} width={180} n="03 · AGENT" hint="Which agent acted" />
            <ColumnLabel left={964} width={144} n="05 · APP" hint="What was accessed" />
            <ColumnLabel left={1192} width={260} n="06 · INTENT" hint="Shown for the picked user + agent" />

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
              const gated = a.t !== "p";
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
                  <span style={{ color: STATUS_COLOR[e.st] }}>{glyph(e.st, gated)}</span>
                  <span>{fmt(e.n)}</span>
                  {e.st === "flagged" && gated && <span className="ip-pill-tag">FLAGGED</span>}
                </div>
              );
            })}

            <div
              ref={userListRef}
              className="ip-user-list"
              style={{ top: USER_LIST_TOP, height: userListH, width: COLUMNS.u[1] + 10 }}
              onScroll={onUserScroll}
            >
              <div style={{ position: "relative", height: userNodes.length ? userNodes[userNodes.length - 1].y + ROW_H.u / 2 + 12 + (hasMoreUsers ? 40 : 0) : 0 }}>
                {userNodes.map((n) => {
                  const [bg, fg] = n.svc ? ["rgba(220,38,38,.08)", "#DC2626"] : AVATARS[n.av ?? 0];
                  return (
                    <div
                      key={n.id}
                      className="ip-node ip-node-user"
                      style={{ left: 0, top: n.y - ROW_H.u / 2, width: COLUMNS.u[1], height: ROW_H.u, ...nodeLook(n) }}
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
                  <div className="ip-user-more" style={{ top: userNodes[userNodes.length - 1].y + ROW_H.u / 2 + 12 }}>
                    {usersError ? (
                      <button type="button" className="btn ghost" onClick={() => setUsersError(null)}>Retry</button>
                    ) : (
                      "Loading more…"
                    )}
                  </div>
                )}
              </div>
            </div>

            {byColumn("a").map((n) => (
              <div key={n.id} className="ip-node ip-node-agent" style={nodeBox(n)} title={n.ref} {...nodeHandlers(n.id)}>
                <div className="ip-glyph ip-glyph-agent"><Icon name="agents" size={16} /></div>
                <div className="ip-node-text">
                  <div className="ip-node-name ip-display">{n.name}</div>
                  <div className="ip-node-sub ip-mono">{n.sub}</div>
                </div>
              </div>
            ))}

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
                style={{ left: COLUMNS.i[0], top: USER_LIST_TOP, width: COLUMNS.i[1] - COLUMNS.i[0], height: userListH - 8 }}
              >
                <Icon name="intents" size={18} />
                <div className="ip-intent-gate-title">Intents appear here</div>
                <div className="ip-intent-gate-body">
                  {chain.u ? "Now pick one of the highlighted agents." : "Pick a user, then one of their agents."}
                </div>
              </div>
            )}
            {showIntents && visibleIntents.size === 0 && (
              <div className="ip-intent-gate" style={{ left: COLUMNS.i[0], top: USER_LIST_TOP, width: COLUMNS.i[1] - COLUMNS.i[0], height: 120 }}>
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
            {byColumn("i").filter((n) => visibleIntents.has(n.id)).map((n) => {
              const st = n.st ?? "allowed";
              return (
                <div key={n.id} className="ip-node ip-node-intent" style={nodeBox(n)} title={n.name} {...nodeHandlers(n.id)}>
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

            {tooltip && <EdgeTooltip {...tooltip} />}
          </div>
        </div>

        {/* ================= Trace table ================= */}
        <div className="ip-trace">
          <div className="ip-trace-head">
            <span className="ip-kicker">{traceKicker}</span>
            <span className="ip-trace-title">{traceTitle}</span>
            {hasRows && traceSub && <span className="ip-trace-sub">{traceSub}</span>}
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
            <div className="ip-table-scroll">
              <div className="ip-table">
                <div className="ip-row ip-row-head">
                  <span>USER</span><span>COCA</span><span>AGENT</span><span>COCA</span><span>CBAC</span><span>WHITELIST</span><span>APP</span><span>INTENT</span><span>OUTCOME</span>
                </div>
                {paths.loading && <div className="ip-empty">Loading paths…</div>}
                {paths.error && (
                  <div className="ip-empty">
                    Couldn't load paths: {paths.error}{" "}
                    <button type="button" className="btn ghost" onClick={paths.retry}>Retry</button>
                  </div>
                )}
                {paths.data && rows.length === 0 && <div className="ip-empty">No paths match this selection and filter.</div>}
                {rows.map((r, k) => (
                  <PathRow key={k} row={r} />
                ))}
                {paths.data && paths.data.total > rows.length && (
                  <div className="ip-empty">
                    Showing the {rows.length} most recent of {paths.data.total.toLocaleString()} paths. Narrow the selection to see the rest.
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="ip-empty">
              Start with a user: the agents they used light up. Then pick an agent to see the apps it called and the intents it ran for that user. Turn on Trace interaction to preview whole paths on hover.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

/* ---------------- Pieces ---------------- */

function ColumnLabel({ left, width, n, hint }: { left: number; width: number; n: string; hint: string }) {
  return (
    <div className="ip-col-label" style={{ left, width }}>
      <div className="ip-col-title">{n}</div>
      <div className="ip-col-hint">{hint}</div>
    </div>
  );
}

interface GateBandProps {
  left: number;
  lit: boolean;
  tone: "coca" | "cbac" | "whitelist";
  name: string;
  icon: "shield" | "key" | "check";
  verb: string;
  desc: string;
  /** null → the wall isn't recorded yet; the band says so instead of showing numbers. */
  value: string | null;
  unit: string;
  fail: string;
}

function GateBand({ left, lit, tone, name, icon, verb, desc, value, unit, fail }: GateBandProps) {
  return (
    <div className={`ip-gate ip-gate-${tone}${lit ? " lit" : ""}`} style={{ left }}>
      <div className="ip-gate-card">
        <div className="ip-gate-head">
          <Icon name={icon} size={14} />
          <span className="ip-gate-name">{name}</span>
          <span className="ip-gate-live" />
        </div>
        <div className="ip-gate-verb">{verb}</div>
        <div className="ip-gate-desc">{desc}</div>
        {value == null ? (
          <div className="ip-gate-untracked">Not tracked yet</div>
        ) : (
          <>
            <div className="ip-gate-value">{value}</div>
            <div className="ip-mono ip-gate-unit">{unit}</div>
            <div className="ip-mono ip-gate-fail">{fail}</div>
          </>
        )}
      </div>
    </div>
  );
}

const WALL_STATUS: Record<Exclude<ObsWallResult, "not_tracked">, PlaneStatus> = {
  pass: "allowed",
  review: "elevated",
  fail: "flagged",
};

/** A wall's result on a trace row: ✓ / ! / × with the hop count, or "not tracked". */
function WallBadge({ wall }: { wall?: { result: ObsWallResult; count: number } | null }) {
  if (!wall) return <span className="ip-gate-badge" style={{ color: "var(--fg-faint)" }}>—</span>;
  if (wall.result === "not_tracked") {
    return <span className="ip-gate-badge ip-untracked" title="CBAC decisions aren't recorded yet">not tracked</span>;
  }
  const st = WALL_STATUS[wall.result];
  return (
    <span className="ip-gate-badge" style={{ color: STATUS_COLOR[st], background: tint(st, ".08") }}>
      {glyph(st, true)} {fmt(wall.count)}
    </span>
  );
}

function PathRow({ row }: { row: ObsPath }) {
  const code = row.policy?.split(" ")[0];
  return (
    <div className="ip-row">
      <span className="ip-ellipsis" style={{ fontWeight: 600 }} title={row.user.did}>{row.user.name || row.user.did}</span>
      <WallBadge wall={row.gate1} />
      <span className="ip-ellipsis" style={{ color: "var(--fg-dim)" }} title={row.agent.did}>{row.agent.name || row.agent.did}</span>
      <WallBadge wall={row.gate2?.coca} />
      <WallBadge wall={row.gate2?.cbac} />
      <WallBadge wall={row.gate2?.whitelist} />
      <span className="ip-ellipsis" style={{ color: "var(--fg-dim)" }}>{row.app ? row.app.name || row.app.did : "—"}</span>
      <span className="ip-intent-cell">
        <span className="ip-ellipsis" style={{ color: row.intent ? undefined : "var(--fg-faint)" }} title={row.intent?.title}>
          {row.intent ? row.intent.title || row.intent.id : row.gate1.result === "fail" ? "Identity check flagged" : "Pick a user + agent"}
        </span>
        <span className="ip-mono ip-faint">{fmt(row.interactionsCount)} ixns</span>
      </span>
      <span className="ip-outcome-cell">
        <span
          className="ip-outcome"
          style={{ color: STATUS_COLOR[row.outcome], background: tint(row.outcome, ".07"), borderColor: tint(row.outcome, ".22") }}
        >
          {row.outcome.toUpperCase()}
        </span>
        {code && row.outcome !== "allowed" && <span className="ip-mono ip-faint" title={row.policy ?? "Threat code"}>{code}</span>}
      </span>
    </div>
  );
}

function EdgeTooltip({ x, y, edge, from }: { x: number; y: number; edge: PlaneEdge; from: PlaneNode }) {
  const gate =
    edge.pol ?? (from.t === "u" ? "COCA · identity verified" : from.t === "a" ? "COCA · Whitelist passed · CBAC not tracked" : "Executed");
  const last = ago(edge.lastAt);
  return (
    <div className="ip-tooltip" style={{ left: x, top: y }}>
      <div className="ip-tooltip-title">{edge.n.toLocaleString()} interactions</div>
      <div className="ip-tooltip-line">Last interaction: {last === "just now" ? last : `${last} ago`}</div>
      <div className="ip-mono ip-tooltip-split">
        Allowed {edge.allowed.toLocaleString()} · Flagged {edge.flagged.toLocaleString()}
        {edge.elevated ? ` · Review ${edge.elevated.toLocaleString()}` : ""}
      </div>
      <div className="ip-mono ip-tooltip-split" style={{ color: STATUS_COLOR[edge.st] }}>{gate}</div>
    </div>
  );
}
