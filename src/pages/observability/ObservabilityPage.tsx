import { useMemo, useState } from "react";
import { Icon } from "../../components/Icon";
import { initials } from "../../lib/format";
import { buildObsGraph, type ObsGraph, type ObsIntentStatus } from "./mockData";
import { ObservabilityCanvas, type ObsNodeVM, type ObsLegendItem } from "./ObservabilityCanvas";
import { IntentTrace } from "./IntentTrace";
import { AppInteractionsPanel } from "./AppInteractionsPanel";

const STATUS_COLORS: Record<ObsIntentStatus, string> = {
  active: "#34D399",
  completed: "#94A3B8",
  elevated: "#FBBF24",
  "high-risk": "#F87171",
  blocked: "#64748B",
};

const STATUS_LEGEND: ObsLegendItem[] = [
  { label: "Active", color: STATUS_COLORS.active },
  { label: "Completed", color: STATUS_COLORS.completed },
  { label: "Elevated", color: STATUS_COLORS.elevated },
  { label: "High risk", color: STATUS_COLORS["high-risk"] },
  { label: "Blocked", color: STATUS_COLORS.blocked },
];

const HOP_LEGEND: ObsLegendItem[] = [
  { label: "Allowed", color: "#38BDF8" },
  { label: "Blocked", color: "#F87171" },
];

const ENTITY_LEGEND: ObsLegendItem[] = [
  { label: "User", color: "#2B4FA0" },
  { label: "Agent", color: "#2563EB" },
];

/** Agent tile: total intents it took part in (top-right) + how many of those are high-risk/blocked (top-left). */
function agentNode(g: ObsGraph, id: string): ObsNodeVM | undefined {
  const a = g.agentById.get(id);
  if (!a) return undefined;
  const intentIds = new Set((g.interactionsByAgent.get(a.id) ?? []).map((ix) => ix.intentId));
  let threats = 0;
  for (const intentId of intentIds) {
    const status = g.intentById.get(intentId)?.status;
    if (status === "high-risk" || status === "blocked") threats++;
  }
  return {
    variant: "avatar", id, title: a.name, sub: "AGENT", initials: initials(a.name), colorKind: "agent",
    badge: intentIds.size, altBadge: threats, statusDot: true,
  };
}

/** "View as trace" button + panel for whichever intent the current drill path is inside. */
function useIntentTrace(g: ObsGraph, intentId: string | undefined) {
  const [open, setOpen] = useState(false);
  const intent = intentId ? g.intentById.get(intentId) : undefined;
  const actions = intent ? (
    <button type="button" className="obs-trace-btn" onClick={() => setOpen(true)}>
      <Icon name="flow" size={12} />
      View as trace
    </button>
  ) : null;
  const overlay = open && intent ? (
    <IntentTrace g={g} intentId={intent.id} statusColor={STATUS_COLORS[intent.status]} onClose={() => setOpen(false)} />
  ) : null;
  return { actions, overlay, close: () => setOpen(false) };
}

/* ---------------- User-centric drill-down ---------------- */
// depth 0 = users, 1 = intents, 2 = interactions, 3 = agents (leaf)

const USER_LEVELS = ["Users", "Intents", "Interactions", "Agents"];

function UserFlow() {
  const g = useMemo(() => buildObsGraph(), []);
  const [path, setPath] = useState<string[]>([]);
  const trace = useIntentTrace(g, path[1]);
  const drill = (next: string[]) => {
    setPath(next);
    trace.close();
  };

  const rootIds = useMemo(() => g.users.map((u) => u.id), [g]);

  const childrenOf = (depthIndex: number, anchorId: string): string[] => {
    if (depthIndex === 0) return (g.intentsByUser.get(anchorId) ?? []).map((i) => i.id);
    if (depthIndex === 1) return (g.interactionsByIntent.get(anchorId) ?? []).map((ix) => ix.id);
    if (depthIndex === 2) {
      const ix = g.interactionById.get(anchorId);
      if (!ix) return [];
      return ix.fromAgentId === ix.toAgentId ? [ix.fromAgentId] : [ix.fromAgentId, ix.toAgentId];
    }
    return [];
  };

  const nodeAt = (depthIndex: number, id: string): ObsNodeVM | undefined => {
    if (depthIndex === 0) {
      const u = g.userById.get(id);
      if (!u) return undefined;
      const count = g.intentsByUser.get(u.id)?.length ?? 0;
      return { variant: "avatar", id, title: u.name, sub: "USER", initials: initials(u.name), colorKind: "user", badge: count };
    }
    if (depthIndex === 1) {
      const intent = g.intentById.get(id);
      if (!intent) return undefined;
      const count = g.interactionsByIntent.get(intent.id)?.length ?? 0;
      return {
        variant: "card", id,
        eyebrow: intent.id,
        statusLabel: intent.status.replace("-", " ").toUpperCase(),
        statusColor: STATUS_COLORS[intent.status],
        title: intent.name,
        meta: `${count} hop${count === 1 ? "" : "s"}`,
        blocked: intent.status === "blocked" || intent.status === "high-risk",
      };
    }
    if (depthIndex === 2) {
      const ix = g.interactionById.get(id);
      if (!ix) return undefined;
      const from = g.agentById.get(ix.fromAgentId);
      const to = g.agentById.get(ix.toAgentId);
      return {
        variant: "card", id,
        statusLabel: ix.status.toUpperCase(),
        statusColor: ix.status === "blocked" ? "#F87171" : "#38BDF8",
        title: `${from?.name} → ${to?.name}`,
        meta: `${ix.action} · ${ix.latencyMs}ms`,
        blocked: ix.status === "blocked",
      };
    }
    if (depthIndex === 3) {
      return agentNode(g, id);
    }
    return undefined;
  };

  const depth = path.length;
  const liveLabel = (() => {
    if (depth === 0) return `LIVE · ${g.users.length} users`;
    if (depth === 1) {
      const user = g.userById.get(path[0])!;
      const count = g.intentsByUser.get(user.id)?.length ?? 0;
      return `LIVE · ${count} intents · ${user.name}`;
    }
    if (depth === 2) {
      const intent = g.intentById.get(path[1])!;
      const count = g.interactionsByIntent.get(intent.id)?.length ?? 0;
      return `LIVE · ${count} interactions · ${intent.name}`;
    }
    const ix = g.interactionById.get(path[2])!;
    return `LIVE · ${ix.fromAgentId === ix.toAgentId ? 1 : 2} agents · ${ix.action}`;
  })();

  const legend = depth === 0 ? ENTITY_LEGEND : depth === 1 ? STATUS_LEGEND : depth === 2 ? HOP_LEGEND : ENTITY_LEGEND.slice(1);
  const footerHint = depth === 0
    ? "Start here: each tile is a person. Click one to see the intents (tasks) they asked agents to do."
    : depth === 1
    ? "These are the user's intents. Click one to see each hop agents made to carry it out."
    : depth === 2
    ? "Each card is one hop between two agents. Click a hop to see both agents — or use View as trace to see them in order."
    : g.interactionById.get(path[2])?.detail;
  const emptyText = depth === 1
    ? "This user has no intents yet."
    : depth === 2
    ? "This intent has no recorded interactions."
    : "Nothing to show here.";

  return (
    <ObservabilityCanvas
      liveLabel={liveLabel}
      legend={legend}
      footerHint={footerHint}
      emptyText={emptyText}
      rootIds={rootIds}
      path={path}
      childrenOf={childrenOf}
      nodeAt={nodeAt}
      maxDepth={3}
      onDrill={drill}
      levels={USER_LEVELS}
      actions={trace.actions}
      overlay={trace.overlay}
    />
  );
}

/* ---------------- Agent-centric drill-down ---------------- */
// depth 0 = agents, 1 = interactions, 2 = intent (leaf)

const AGENT_LEVELS = ["Agents", "Interactions", "Intent"];

function AgentFlow() {
  const g = useMemo(() => buildObsGraph(), []);
  const [path, setPath] = useState<string[]>([]);
  const trace = useIntentTrace(g, path[1] ? g.interactionById.get(path[1])?.intentId : undefined);
  const drill = (next: string[]) => {
    setPath(next);
    trace.close();
  };

  const rootIds = useMemo(() => g.agents.map((a) => a.id), [g]);

  const childrenOf = (depthIndex: number, anchorId: string): string[] => {
    if (depthIndex === 0) return (g.interactionsByAgent.get(anchorId) ?? []).map((ix) => ix.id);
    if (depthIndex === 1) {
      const ix = g.interactionById.get(anchorId);
      return ix ? [ix.intentId] : [];
    }
    return [];
  };

  const nodeAt = (depthIndex: number, id: string): ObsNodeVM | undefined => {
    if (depthIndex === 0) {
      return agentNode(g, id);
    }
    if (depthIndex === 1) {
      const ix = g.interactionById.get(id);
      if (!ix) return undefined;
      const from = g.agentById.get(ix.fromAgentId);
      const to = g.agentById.get(ix.toAgentId);
      const intent = g.intentById.get(ix.intentId);
      return {
        variant: "card", id,
        statusLabel: ix.status.toUpperCase(),
        statusColor: ix.status === "blocked" ? "#F87171" : "#38BDF8",
        title: `${from?.name} → ${to?.name}`,
        meta: intent?.name ?? ix.intentId,
        blocked: ix.status === "blocked",
      };
    }
    if (depthIndex === 2) {
      const intent = g.intentById.get(id);
      if (!intent) return undefined;
      const count = g.interactionsByIntent.get(intent.id)?.length ?? 0;
      return {
        variant: "card", id,
        eyebrow: intent.id,
        statusLabel: intent.status.replace("-", " ").toUpperCase(),
        statusColor: STATUS_COLORS[intent.status],
        title: intent.name,
        meta: `${count} hop${count === 1 ? "" : "s"}`,
        blocked: intent.status === "blocked" || intent.status === "high-risk",
      };
    }
    return undefined;
  };

  const depth = path.length;
  const liveLabel = (() => {
    if (depth === 0) return `LIVE · ${g.agents.length} agents · ${g.agentPairs.length} links`;
    if (depth === 1) {
      const agent = g.agentById.get(path[0])!;
      const count = g.interactionsByAgent.get(agent.id)?.length ?? 0;
      return `LIVE · ${count} interactions · ${agent.name}`;
    }
    return `LIVE · 1 intent`;
  })();

  const legend = depth === 0 ? ENTITY_LEGEND.slice(1) : depth === 1 ? HOP_LEGEND : STATUS_LEGEND;
  const footerHint = depth === 0
    ? "Start here: each tile is an agent; dotted lines join agents that talked directly. Click one to see its interactions."
    : depth === 1
    ? "Each card is one hop this agent sent or received. Click a hop to see which intent it served."
    : g.interactionById.get(path[1])?.detail;
  const emptyText = depth === 1 ? "This agent has no recorded interactions." : "Nothing to show here.";

  return (
    <ObservabilityCanvas
      liveLabel={liveLabel}
      legend={legend}
      footerHint={footerHint}
      emptyText={emptyText}
      rootIds={rootIds}
      rootEdges={g.agentPairs}
      path={path}
      childrenOf={childrenOf}
      nodeAt={nodeAt}
      maxDepth={2}
      onDrill={drill}
      levels={AGENT_LEVELS}
      actions={trace.actions}
      overlay={trace.overlay}
    />
  );
}

/* ---------------- App-centric view ---------------- */
// depth 0 = apps; depth 1 = the app's interactions, read as a list panel rather than a ring.

const APP_LEVELS = ["Apps", "Interactions"];

const APP_LEGEND: ObsLegendItem[] = [{ label: "App", color: "#0EA5E9" }];

function AppFlow() {
  const g = useMemo(() => buildObsGraph(), []);
  const [path, setPath] = useState<string[]>([]);
  const [traceIntentId, setTraceIntentId] = useState<string | null>(null);
  const drill = (next: string[]) => {
    setPath(next);
    setTraceIntentId(null);
  };

  const rootIds = useMemo(() => g.apps.map((a) => a.id), [g]);

  const childrenOf = (depthIndex: number, anchorId: string): string[] =>
    depthIndex === 0 ? (g.appInteractionsByApp.get(anchorId) ?? []).map((ax) => ax.id) : [];

  const nodeAt = (depthIndex: number, id: string): ObsNodeVM | undefined => {
    if (depthIndex === 0) {
      const app = g.appById.get(id);
      if (!app) return undefined;
      const list = g.appInteractionsByApp.get(id) ?? [];
      return {
        variant: "avatar", id, title: app.name, sub: app.category.toUpperCase(), initials: initials(app.name), colorKind: "app",
        badge: list.length, altBadge: list.filter((ax) => ax.status === "blocked").length, statusDot: true,
      };
    }
    // Interactions aren't drawn as nodes here, but the canvas still counts flagged ones for the stepper.
    const ax = g.appInteractionById.get(id);
    if (!ax) return undefined;
    return { variant: "card", id, title: ax.action, blocked: ax.status === "blocked" };
  };

  const appId = path[0];
  const app = appId ? g.appById.get(appId) : undefined;
  const liveLabel = app
    ? `LIVE · ${g.appInteractionsByApp.get(app.id)?.length ?? 0} interactions · ${app.name}`
    : `LIVE · ${g.apps.length} apps · ${g.appInteractions.length} interactions`;
  const footerHint = app
    ? "Scroll the list and pick an interaction to see who called the app and for which intent. Esc goes back to all apps."
    : "Start here: each tile is an app your agents call. Click one to see every interaction it was part of.";
  const traceIntent = traceIntentId ? g.intentById.get(traceIntentId) : undefined;

  return (
    <ObservabilityCanvas
      liveLabel={liveLabel}
      legend={app ? HOP_LEGEND : APP_LEGEND}
      footerHint={footerHint}
      emptyText="No apps have been called yet."
      rootIds={rootIds}
      path={path}
      childrenOf={childrenOf}
      nodeAt={nodeAt}
      maxDepth={1}
      onDrill={drill}
      levels={APP_LEVELS}
      focusPanel={
        appId && (
          <AppInteractionsPanel
            key={appId}
            g={g}
            appId={appId}
            statusColors={STATUS_COLORS}
            onOpenTrace={setTraceIntentId}
          />
        )
      }
      overlay={
        traceIntent && (
          <IntentTrace
            g={g}
            intentId={traceIntent.id}
            statusColor={STATUS_COLORS[traceIntent.status]}
            onClose={() => setTraceIntentId(null)}
          />
        )
      }
    />
  );
}

/* ---------------- Page shell ---------------- */

export function ObservabilityPage() {
  const [mode, setMode] = useState<"users" | "agents" | "apps">("users");

  return (
    <div className="page obs-page">
      <div className="obs-header">
        <div>
          <h1 className="obs-title">Observability</h1>
          <p className="obs-subtitle">
            {mode === "apps"
              ? "See which apps your agents call — pick an app to scroll through every interaction it was part of."
              : `Trace who touched what — drill from ${mode === "users" ? "a user, into their intents, interactions, and the agents involved" : "an agent, into its interactions, and the intent each one belongs to"}.`
            }
          </p>
        </div>
        <div className="obs-mode-toggle">
          <button type="button" className={mode === "users" ? "active" : ""} onClick={() => setMode("users")}>
            By User
          </button>
          <button type="button" className={mode === "agents" ? "active" : ""} onClick={() => setMode("agents")}>
            By Agent
          </button>
          <button type="button" className={mode === "apps" ? "active" : ""} onClick={() => setMode("apps")}>
            By App
          </button>
        </div>
      </div>

      {mode === "users" ? <UserFlow /> : mode === "agents" ? <AgentFlow /> : <AppFlow />}
    </div>
  );
}
