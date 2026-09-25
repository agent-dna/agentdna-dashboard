import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { Icon } from "../../components/Icon";
import {
  COLUMNS,
  COLUMN_TYPE,
  CONTROLS,
  EDGES,
  FLOWS,
  GATE2_WALLS,
  NODES,
  PLANE_H,
  PLANE_SUMMARY,
  PLANE_W,
  ROW_H,
  USER_LIST_H,
  USER_LIST_TOP,
  type PlaneColumn,
  type PlaneFlow,
  type PlaneEdge,
  type PlaneNode,
  type PlaneStatus,
} from "./interactionPlaneData";

/**
 * Observability · Interaction plane.
 *
 * A fixed four-column map (User → Agent → App → Intent) with the gates drawn as
 * bands between columns: gate 1 (user→agent) is a single COCA wall; gate 2
 * (agent→app) is three walls — COCA, CBAC and Whitelisting.
 *
 * Selection drills left to right: pick a user and the agents they used light up; pick
 * one of those agents and the apps it called in that user's loop light up; then the
 * intents. The table below lists every path matching the current chain, hop by hop.
 * Mock data for now — see interactionPlaneData.ts.
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

/** Edges below this volume collapse to a small dot instead of a count pill. */
const PILL_THRESHOLD = 10;
const ORDER: PlaneColumn[] = ["u", "a", "p", "i"];
const NEXT_HINT: Record<PlaneColumn, string> = {
  u: "Pick an agent to see its apps and intents for this user.",
  a: "Pick an app to narrow the intents.",
  p: "Pick an intent to see the full path.",
  i: "",
};

/** One selected node per layer, filled left to right. */
type Chain = Partial<Record<PlaneColumn, string>>;

const matchesChain = (f: PlaneFlow, chain: Chain) =>
  ORDER.every((col, k) => !chain[col] || f.n[k] === chain[col]);

const fmt = (n: number) => (n < 1000 ? String(n) : `${(n / 1000).toFixed(1).replace(/\.0$/, "")}K`);
const tint = (st: PlaneStatus, alpha: string) => STATUS_TINT[st].replace(".12", alpha);
const glyph = (st: PlaneStatus, gated: boolean) => (st === "flagged" ? "×" : st === "elevated" ? "!" : gated ? "✓" : "");

type Visibility = "normal" | "lit" | "muted";

export function InteractionPlane() {
  const [chain, setChain] = useState<Chain>({});
  const [hovered, setHovered] = useState<string | null>(null);
  const [traceMode, setTraceMode] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [hoverEdge, setHoverEdge] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [userScroll, setUserScroll] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const userListRef = useRef<HTMLDivElement>(null);

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

  const preview = traceMode && hovered ? hovered : null;
  const chainIds = ORDER.map((c) => chain[c]).filter((x): x is string => !!x);
  const hasChain = chainIds.length > 0;
  /** Deepest selected layer; the layer after it is what gets revealed. */
  const depth = ORDER.reduce((d, col, k) => (chain[col] ? k : d), -1);

  const filtered = useMemo(
    () => FLOWS.filter((f) => (filter === "all" ? true : filter === "risk" ? f.st !== "allowed" : f.st === "flagged")),
    [filter],
  );

  /** Paths the table lists and the canvas highlights. */
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
      f.n.forEach((x, k) => k <= revealTo && litNodes.add(x));
      f.es.forEach((e, k) => k + 1 <= revealTo && litEdges.add(e.id));
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
  const users = byColumn("u");

  /* ---------- Edges, count pills and tooltip ---------- */

  /** Where a node's centre sits on the canvas; users follow the list's scroll position. */
  const canvasY = (node: PlaneNode) => {
    if (node.t !== "u") return node.y;
    const y = USER_LIST_TOP + node.y - userScroll;
    // Users scrolled out of view anchor their lines to the list's top/bottom edge.
    return Math.max(USER_LIST_TOP + 10, Math.min(USER_LIST_TOP + USER_LIST_H - 10, y));
  };
  const userInView = (node: PlaneNode) => {
    const y = node.y - userScroll;
    return y > 0 && y < USER_LIST_H;
  };

  const edgeGeometry = EDGES.filter((e) => NODES[e.to].t !== "i" || visibleIntents.has(e.to)).map((e) => {
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
  const tooltip = hoveredEdge ? { x: hoveredEdge.cx, y: hoveredEdge.my, edge: hoveredEdge.e } : null;

  const edgeHover = (id: string) => ({
    onMouseEnter: () => setHoverEdge(id),
    onMouseLeave: () => setHoverEdge(null),
  });

  /* ---------- Trace table ---------- */

  /**
   * One row per full path when intents are shown; otherwise one row per user → agent → app,
   * carrying the worst outcome among the paths it stands for.
   */
  const tableRows = useMemo(() => {
    if (showIntents) return activeFlows;
    const rank: Record<PlaneStatus, number> = { allowed: 0, elevated: 1, flagged: 2 };
    const byKey = new Map<string, PlaneFlow>();
    for (const f of activeFlows) {
      const n = f.n.slice(0, 3);
      const key = n.join(">");
      const prev = byKey.get(key);
      if (!prev) byKey.set(key, { n, es: f.es.slice(0, 2), st: f.st });
      else if (rank[f.st] > rank[prev.st]) prev.st = f.st;
    }
    return [...byKey.values()];
  }, [activeFlows, showIntents]);

  const hasRows = emphasis;
  const flaggedCount = activeFlows.filter((f) => f.st === "flagged").length;
  const elevatedCount = activeFlows.filter((f) => f.st === "elevated").length;
  const agentCount = new Set(activeFlows.map((f) => f.n[1])).size;
  const appCount = new Set(activeFlows.map((f) => f.n[2]).filter(Boolean)).size;
  const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;
  const traceSub =
    `${plural(tableRows.length, "path")} · ${plural(agentCount, "agent")} · ${plural(appCount, "app")}` +
    (flaggedCount ? ` · ${flaggedCount} flagged` : "") +
    (elevatedCount ? ` · ${elevatedCount} elevated` : "");
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
      ? chainIds.map((id) => NODES[id].name).join(" → ")
      : filter === "risk"
        ? "High-risk interactions"
        : filter === "flagged"
          ? "Flagged interactions"
          : "No selection";
  const nextHint = !preview && hasChain ? NEXT_HINT[ORDER[depth]] : "";

  /** Scroll the user list so a user is in view (search, or an off-screen pick). */
  const revealUser = (id: string) => {
    const el = userListRef.current;
    const node = NODES[id];
    if (!el || node?.t !== "u") return;
    el.scrollTo({ top: Math.max(0, node.y - USER_LIST_H / 2), behavior: "smooth" });
  };

  const onSearchKey = (ev: KeyboardEvent<HTMLInputElement>) => {
    if (ev.key !== "Enter") return;
    const q = ev.currentTarget.value.trim().toLowerCase();
    if (!q) return;
    const hit = Object.values(NODES).find(
      (n) => n.name.toLowerCase().includes(q) || (n.sub ?? "").toLowerCase().includes(q),
    );
    if (hit) {
      setChain({ [hit.t]: hit.id });
      setHovered(null);
      revealUser(hit.id);
    }
  };

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
            <div className="ip-summary">{PLANE_SUMMARY}</div>
          </div>
          <div className="ip-head-tools">
            <label className="ip-search">
              <Icon name="search" size={14} />
              <input placeholder="Find a node…" onKeyDown={onSearchKey} aria-label="Find a user, agent, app or intent" />
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

        <div ref={wrapRef} className="ip-canvas-wrap" style={{ height: Math.round(PLANE_H * scale + 40) }}>
          <div className="ip-canvas" style={{ width: PLANE_W, height: PLANE_H, transform: `scale(${scale})` }}>
            <GateBand
              left={204}
              lit={cocaLit}
              tone="coca"
              name="COCA"
              icon="shield"
              verb="VERIFY"
              desc="Identity & integrity"
              value={`${CONTROLS.coca.passPct}%`}
              unit="verified"
              fail={`${CONTROLS.coca.flagged} flagged`}
            />
            <GateBand
              left={GATE2_WALLS[0].left}
              lit={gate2Lit}
              tone="coca"
              name="COCA"
              icon="shield"
              verb="VERIFY"
              desc="Agent identity & integrity"
              value={`${CONTROLS.agentCoca.passPct}%`}
              unit="verified"
              fail={`${CONTROLS.agentCoca.flagged} flagged`}
            />
            <GateBand
              left={GATE2_WALLS[1].left}
              lit={gate2Lit}
              tone="cbac"
              name="CBAC"
              icon="key"
              verb="AUTHORIZE"
              desc="Policy & authorization"
              value={CONTROLS.cbac ? `${CONTROLS.cbac.passPct}%` : null}
              unit="allowed"
              fail={CONTROLS.cbac ? `${CONTROLS.cbac.flagged} flagged` : ""}
            />
            <GateBand
              left={GATE2_WALLS[2].left}
              lit={gate2Lit}
              tone="whitelist"
              name="Whitelist"
              icon="check"
              verb="APPROVED"
              desc="Agent approved, not revoked"
              value={`${CONTROLS.whitelist.passPct}%`}
              unit="approved"
              fail={`${CONTROLS.whitelist.flagged} flagged`}
            />

            <ColumnLabel left={0} width={168} n="01 · USER" hint={`Who initiated · ${users.length}`} />
            <ColumnLabel left={352} width={180} n="03 · AGENT" hint="Which agent acted" />
            <ColumnLabel left={964} width={144} n="05 · APP" hint="What was accessed" />
            <ColumnLabel left={1192} width={260} n="06 · INTENT" hint="Shown for the picked user + agent" />

            <svg className="ip-edges" width={PLANE_W} height={PLANE_H}>
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
              style={{ top: USER_LIST_TOP, height: USER_LIST_H, width: COLUMNS.u[1] + 10 }}
              onScroll={(ev) => setUserScroll(ev.currentTarget.scrollTop)}
            >
              <div style={{ position: "relative", height: users[users.length - 1].y + ROW_H.u / 2 + 12 }}>
                {users.map((n) => {
                  const [bg, fg] = n.svc ? ["rgba(220,38,38,.08)", "#DC2626"] : AVATARS[n.av ?? 0];
                  return (
                    <div
                      key={n.id}
                      className="ip-node ip-node-user"
                      style={{ left: 0, top: n.y - ROW_H.u / 2, width: COLUMNS.u[1], height: ROW_H.u, ...nodeLook(n) }}
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
              </div>
            </div>

            {byColumn("a").map((n) => (
              <div key={n.id} className="ip-node ip-node-agent" style={nodeBox(n)} {...nodeHandlers(n.id)}>
                <div className="ip-glyph ip-glyph-agent"><Icon name="agents" size={16} /></div>
                <div className="ip-node-text">
                  <div className="ip-node-name ip-display">{n.name}</div>
                  <div className="ip-node-sub ip-mono">{n.sub}</div>
                </div>
              </div>
            ))}

            {byColumn("p").map((n) => (
              <div key={n.id} className="ip-node ip-node-app" style={nodeBox(n)} {...nodeHandlers(n.id)}>
                <div className="ip-glyph ip-glyph-app"><Icon name="box" size={14} /></div>
                <div className="ip-node-text">
                  <div className="ip-node-name">{n.name}</div>
                  <div className="ip-node-sub ip-mono">{n.sub}</div>
                </div>
              </div>
            ))}

            {!showIntents && (
              <div
                className="ip-intent-gate"
                style={{ left: COLUMNS.i[0], top: USER_LIST_TOP, width: COLUMNS.i[1] - COLUMNS.i[0], height: USER_LIST_H - 8 }}
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
                <div className="ip-intent-gate-body">No intents match this selection and filter.</div>
              </div>
            )}
            {byColumn("i").filter((n) => visibleIntents.has(n.id)).map((n) => {
              const st = n.st ?? "allowed";
              return (
                <div key={n.id} className="ip-node ip-node-intent" style={nodeBox(n)} {...nodeHandlers(n.id)}>
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
            {hasRows && <span className="ip-trace-sub">{traceSub}</span>}
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
                {tableRows.map((f, k) => {
                  const [u, a, p, i] = f.n;
                  const [e1, e2, e3] = f.es;
                  const flaggedAtCoca = e1.st === "flagged";
                  const code = f.es.find((e) => e.st === f.st && e.pol)?.pol?.split(" ")[0];
                  return (
                    <div key={k} className="ip-row">
                      <span className="ip-ellipsis" style={{ fontWeight: 600 }}>{NODES[u].name}</span>
                      <GateBadge edge={e1} />
                      <span className="ip-ellipsis" style={{ color: "var(--fg-dim)" }}>{NODES[a].name}</span>
                      <WallBadge edge={e2} wall="coca" />
                      <WallBadge edge={e2} wall="cbac" />
                      <WallBadge edge={e2} wall="whitelist" />
                      <span className="ip-ellipsis" style={{ color: "var(--fg-dim)" }}>{p ? NODES[p].name : "—"}</span>
                      <span className="ip-intent-cell">
                        <span className="ip-ellipsis" style={{ color: i ? undefined : "var(--fg-faint)" }}>
                          {i ? NODES[i].name : flaggedAtCoca ? "Identity check flagged" : "Pick a user + agent"}
                        </span>
                        {e3 && <span className="ip-mono ip-faint">{fmt(e3.n)} ixns</span>}
                      </span>
                      <span className="ip-outcome-cell">
                        <span
                          className="ip-outcome"
                          style={{ color: STATUS_COLOR[f.st], background: tint(f.st, ".07"), borderColor: tint(f.st, ".22") }}
                        >
                          {f.st.toUpperCase()}
                        </span>
                        {code && f.st !== "allowed" && <span className="ip-mono ip-faint" title="Threat code">{code}</span>}
                      </span>
                    </div>
                  );
                })}
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

function GateBadge({ edge }: { edge?: PlaneEdge }) {
  if (!edge) return <span className="ip-gate-badge" style={{ color: "var(--fg-faint)" }}>—</span>;
  return (
    <span className="ip-gate-badge" style={{ color: STATUS_COLOR[edge.st], background: tint(edge.st, ".08") }}>
      {glyph(edge.st, true)} {fmt(edge.n)}
    </span>
  );
}

/**
 * One gate-2 wall's result for an agent→app hop (Phase 1). Flags here come from tiered
 * policy checks (3xxx codes) that aren't attributed to a wall yet, so COCA and Whitelist
 * read as passed (no 2001–2003 / 1001 code) and CBAC isn't recorded at all.
 */
function WallBadge({ edge, wall }: { edge?: PlaneEdge; wall: "coca" | "cbac" | "whitelist" }) {
  if (!edge) return <GateBadge />;
  if (wall === "cbac") return <span className="ip-gate-badge ip-untracked" title="CBAC decisions aren't recorded yet">not tracked</span>;
  return <GateBadge edge={{ ...edge, st: "allowed" }} />;
}

function EdgeTooltip({ x, y, edge }: { x: number; y: number; edge: PlaneEdge }) {
  const from = NODES[edge.from];
  const to = NODES[edge.to];
  const gate =
    edge.pol ??
    (from.t === "u" ? "COCA · identity verified" : from.t === "a" ? "COCA · Whitelist passed · CBAC not tracked" : `${to.name} · executed`);
  return (
    <div className="ip-tooltip" style={{ left: x, top: y }}>
      <div className="ip-tooltip-title">{edge.n.toLocaleString()} interactions</div>
      <div className="ip-tooltip-line">Last interaction: {edge.last === "just now" ? "just now" : `${edge.last} ago`}</div>
      <div className="ip-mono ip-tooltip-split">
        {edge.st === "elevated" ? `Needs review: ${edge.n}` : `Allowed ${edge.a.toLocaleString()} · Flagged ${edge.b}`}
      </div>
      <div className="ip-mono ip-tooltip-split" style={{ color: STATUS_COLOR[edge.st] }}>{gate}</div>
    </div>
  );
}
