import { Fragment, memo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppWindow, Bot, ExternalLink, FileText, UserRound, X, type LucideIcon } from "lucide-react";
import { fetchObsPaths, type ObsPath, type ObsPathFilter, type ObsScope } from "../../api/observability";
import { AgentInfoPanel, AppInfoPanel, UserInfoPanel } from "./ProfilePanels";
import { IntentDetailPanel } from "./IntentDetailPanel";
import { loadIntentDetail } from "./intentDetail";
import { COLUMN_TYPE, STATUS_COLOR, STATUS_TINT, nodeId, refOf, type PlaneColumn, type PlaneMode, type PlaneNode, type PlaneStatus } from "./planeModel";
import { useObsQuery } from "./useObsQuery";
import type { Chain, Filter } from "./InteractionPlane";

/**
 * Observability · detail box, the card under the interaction plane.
 *
 * Once something is picked it shows four tabs (User, Agents, Application, Intent Info); a tab
 * is enabled once its layer is picked, and the deepest pick's tab opens by default. With
 * nothing picked it shows the paths behind a hover preview or a risk filter. It owns its own
 * requests and loading state, so fetching here never re-renders the plane; the plane only
 * hands it the current selection.
 */

interface DetailBoxProps {
  mode: PlaneMode;
  order: PlaneColumn[];
  chain: Chain;
  /** Node under the pointer while Trace interaction is on. */
  preview: string | null;
  filter: Filter;
  /** The plane's nodes, for names; `null` until the plane has loaded. */
  nodes: Record<string, PlaneNode> | null;
  scope: ObsScope;
  onChain: (chain: Chain) => void;
  onClearTrace: () => void;
}

const NEXT_HINT: Record<PlaneMode, Record<PlaneColumn, string>> = {
  user: {
    u: "Pick an agent to see the agents it worked with and the apps involved.",
    a: "Pick a peer agent to narrow the apps to the intents they shared, or an app to see intents.",
    r: "Pick an app to see the intents the two agents shared there.",
    p: "Pick an intent to see its detail.",
    i: "",
  },
  app: {
    p: "Pick one of the agents that called this app.",
    a: "Pick a peer agent to see who started the intents they shared on this app.",
    r: "Pick a user to see their intents.",
    u: "Pick an intent to see its detail.",
    i: "",
  },
};
const PATH_PARAM: Record<PlaneColumn, keyof ObsPathFilter> = {
  u: "userDID",
  a: "agentDID",
  r: "peerDID",
  p: "appDID",
  i: "intentID",
};

type TabKey = "user" | "agent" | "app" | "intent";
/** Each tab and the layer whose pick enables it. */
const TABS: { key: TabKey; label: string; col: PlaneColumn; icon: LucideIcon }[] = [
  { key: "user", label: "User Info", col: "u", icon: UserRound },
  { key: "agent", label: "Agents Info", col: "a", icon: Bot },
  { key: "app", label: "Application Info", col: "p", icon: AppWindow },
  { key: "intent", label: "Intent Info", col: "i", icon: FileText },
];
const TAB_OF: Record<PlaneColumn, TabKey> = { u: "user", a: "agent", r: "agent", p: "app", i: "intent" };

const fmt = (n: number) => (n < 1000 ? String(n) : `${(n / 1000).toFixed(1).replace(/\.0$/, "")}K`);
const tint = (st: PlaneStatus, alpha: string) => STATUS_TINT[st].replace(".12", alpha);

export const DetailBox = memo(function DetailBox({ mode, order, chain, preview, filter, nodes, scope, onChain, onClearTrace }: DetailBoxProps) {
  const NODES = nodes ?? {};
  const userMode = mode === "user";
  const chainIds = order.map((c) => chain[c]).filter((x): x is string => !!x);
  const hasChain = chainIds.length > 0;
  const depth = order.reduce((d, col, k) => (chain[col] ? k : d), -1);
  const emphasis = !!preview || hasChain || filter !== "all";

  const pickedIntent = chain.i ? refOf(chain.i) : null;
  const tabEnabled = (tab: TabKey) => !!chain[TABS.find((t) => t.key === tab)!.col];
  // The deepest pick's tab opens by default; a tab the user switches to sticks until the selection changes.
  const chainKey = chainIds.join("|");
  const autoTab = depth >= 0 ? TAB_OF[order[depth]] : null;
  const [manualTab, setManualTab] = useState<{ key: string; tab: TabKey } | null>(null);
  const activeTab = manualTab && manualTab.key === chainKey && tabEnabled(manualTab.tab) ? manualTab.tab : autoTab;
  // With a peer picked too, the Agents tab switches between the agent and the peer; it resets with the selection.
  const [peerView, setPeerView] = useState<{ key: string; peer: boolean } | null>(null);
  const showPeer = !!chain.r && !!peerView && peerView.key === chainKey && peerView.peer;
  const shownAgent = showPeer ? chain.r : chain.a;
  const navigate = useNavigate();
  /** Full page for what the active tab shows. */
  const pagePath =
    activeTab === "user" && chain.u
      ? `/users/${encodeURIComponent(refOf(chain.u))}`
      : activeTab === "agent" && shownAgent
        ? `/agents/${encodeURIComponent(refOf(shownAgent))}`
        : activeTab === "app" && chain.p
          ? `/tools/${encodeURIComponent(refOf(chain.p))}`
          : activeTab === "intent" && pickedIntent
            ? `/intents/${pickedIntent}`
            : null;

  /** The current selection as path filters. */
  const chainFilter: ObsPathFilter = Object.fromEntries(order.filter((c) => chain[c]).map((c) => [PATH_PARAM[c], refOf(chain[c]!)]));
  /** With nothing picked, the box lists the paths behind a hover preview or a risk filter. */
  const hasRows = emphasis && !!nodes && !hasChain;
  const pathFilter: ObsPathFilter | null = !hasRows ? null : preview ? { [PATH_PARAM[NODES[preview].t]]: refOf(preview) } : chainFilter;
  const pathsKey = pathFilter && `paths:${filter}:${JSON.stringify(pathFilter)}`;
  const paths = useObsQuery(pathsKey, () => fetchObsPaths({ ...scope, status: filter }, pathFilter!));

  // The picked intent's detail has its own call, so it stays put while the filter or a hover preview changes the table.
  const intentDetail = useObsQuery(pickedIntent && `intent-detail:${JSON.stringify(chainFilter)}`, () =>
    loadIntentDetail(scope, { ...chainFilter, intentID: pickedIntent! }, NODES[chain.i!]?.name ?? pickedIntent!),
  );
  const nameOf = (did: string) => (["u", "a", "p"] as const).map((t) => NODES[nodeId(t, did)]?.name).find(Boolean);
  const rows = paths.data?.pathsList ?? [];

  const flaggedCount = rows.filter((r) => r.outcome === "flagged").length;
  const elevatedCount = rows.filter((r) => r.outcome === "elevated").length;
  const agentCount = new Set(rows.map((r) => r.agent.did)).size;
  const appCount = new Set(rows.map((r) => r.app?.did).filter(Boolean)).size;
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
    onChain({
      u: nodeId("u", r.user.did),
      a: nodeId("a", r.agent.did),
      ...(r.peer ? { r: nodeId("r", r.peer.did) } : {}),
      ...(r.app ? { p: nodeId("p", r.app.did) } : {}),
      i: nodeId("i", r.intent.id),
    });
  };
  const traceKicker = preview
    ? `TRACE PREVIEW · ${COLUMN_TYPE[NODES[preview].t].toUpperCase()}`
    : filter !== "all"
      ? "FILTER"
      : "TRACE";
  const traceTitle = preview
    ? NODES[preview].name
    : filter === "risk"
      ? "High-risk interactions"
      : filter === "flagged"
        ? "Flagged interactions"
        : "No selection";
  const nextHint = !preview && hasChain ? NEXT_HINT[mode][order[depth]] : "";

  const panelName = (id: string) => NODES[id]?.name ?? refOf(id);

  return (
    <section className="ip-card ip-detail">
      <div className="tabs ip-detail-tabs" role="tablist">
        {TABS.map((t) => {
          const enabled = tabEnabled(t.key);
          const I = t.icon;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={activeTab === t.key}
              className={`tab ${activeTab === t.key ? "active" : ""}`}
              disabled={!enabled}
              title={enabled ? undefined : `Pick ${t.col === "u" ? "a user" : t.col === "a" ? "an agent" : t.col === "p" ? "an app" : "an intent"} on the plane first`}
              onClick={() => setManualTab({ key: chainKey, tab: t.key })}
            >
              <I size={16} strokeWidth={1.8} />
              {t.label}
            </button>
          );
        })}
        {hasChain && (
          <div className="ip-detail-actions">
            {pagePath && (
              <button type="button" className="btn ghost" onClick={() => navigate(pagePath)} title="Open full page" aria-label="Open full page">
                <ExternalLink size={16} />
              </button>
            )}
            <button type="button" className="btn ghost" onClick={onClearTrace} title="Clear selection" aria-label="Clear selection">
              <X size={16} />
            </button>
          </div>
        )}
      </div>
      {activeTab === "intent" && pickedIntent ? (
        <IntentDetailPanel
          intentId={pickedIntent}
          intent={intentDetail.data ?? null}
          loading={intentDetail.loading}
          error={intentDetail.error}
          onRetry={intentDetail.retry}
          nameOf={nameOf}
        />
      ) : activeTab === "user" && chain.u ? (
        <UserInfoPanel key={chain.u} did={refOf(chain.u)} name={panelName(chain.u)} />
      ) : activeTab === "agent" && shownAgent ? (
        <>
          {chain.r && (
            <div className="seg ip-pf-peer-switch" role="group" aria-label="Agent shown">
              <button type="button" className={!showPeer ? "active" : ""} onClick={() => setPeerView({ key: chainKey, peer: false })}>
                {panelName(chain.a!)}
              </button>
              <button type="button" className={showPeer ? "active" : ""} onClick={() => setPeerView({ key: chainKey, peer: true })}>
                Peer · {panelName(chain.r)}
              </button>
            </div>
          )}
          <AgentInfoPanel key={shownAgent} did={refOf(shownAgent)} name={panelName(shownAgent)} nameOf={nameOf} />
        </>
      ) : activeTab === "app" && chain.p ? (
        <AppInfoPanel key={chain.p} did={refOf(chain.p)} name={panelName(chain.p)} />
      ) : (
        <div className="ip-trace">
          <div className="ip-trace-head">
            <span className="ip-kicker">{traceKicker}</span>
            <span className="ip-trace-title">{traceTitle}</span>
            {nextHint && <span className="ip-trace-next">{nextHint}</span>}
            {hasChain && (
              <button type="button" className="btn ghost ip-clear" onClick={onClearTrace}>
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
                  <PathHops key={k} row={r} order={order} onOpen={r.intent ? () => openPath(r) : undefined} />
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
              {userMode
                ? "Start with a user: the agents in their intents light up. Pick an agent to see the agents it worked with and the apps involved, pick a peer to narrow to the intents the two shared, then an app to see those intents."
                : "Start with an app: the agents that called it light up. Pick an agent to see the agents it worked with on that app, pick a peer to see who started those intents, then a user to see their intents."}{" "}
              Turn on Trace interaction to preview whole paths on hover.
            </div>
          )}
        </div>
      )}
    </section>
  );
});

/* ---------------- Pieces ---------------- */

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
 * A path in the trace as its hops, in the plane's column order (user → agent → peer → app,
 * or app → agent → peer → user), with the intent it ran and how it ended. Clicking opens
 * that intent's detail.
 */
function PathHops({ row, order, onOpen }: { row: ObsPath; order: PlaneColumn[]; onOpen?: () => void }) {
  const hop: Partial<Record<PlaneColumn, { kind: string; did?: string; name?: string }>> = {
    u: { kind: "User", did: row.user.did, name: row.user.name },
    a: { kind: "Agent", did: row.agent.did, name: row.agent.name },
    ...(row.peer ? { r: { kind: "Peer agent", did: row.peer.did, name: row.peer.name } } : {}),
    p: { kind: "App", did: row.app?.did, name: row.app?.name },
  };
  const hops = order.flatMap((c) => (hop[c] ? [{ col: c, ...hop[c] }] : []));
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
        {hops.map(({ col, kind, did, name }, k) => (
          <Fragment key={col}>
            {k > 0 && <HopArrow />}
            <HopNode kind={kind} did={did} name={name} />
          </Fragment>
        ))}
      </div>
    </div>
  );
}
