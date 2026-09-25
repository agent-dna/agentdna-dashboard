import { useCallback, useMemo, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Controls,
  Panel,
  useNodesState,
  useEdgesState,
  useReactFlow,
  type Edge,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Icon } from "../../components/Icon";
import { buildObsGraph, type ObsGraph, type ObsIntentStatus } from "./mockData";
import { PLANE_NODE_TYPES, type PlaneNodeData, type PlaneShape } from "./PlaneNodes";

/**
 * One plane holding apps, the intents that touched them, and the agents and users
 * behind those intents — scattered rather than drilled into.
 *
 * Selection: 5 apps, then each app's 5 most recent intents, then everything those
 * intents connect to. Positions come from a deterministic relaxation pass, so the
 * graph always opens the same way; React Flow owns pan/zoom/drag from there.
 */

const APP_COUNT = 5;
const INTENTS_PER_APP = 5;

const STATUS_COLORS: Record<ObsIntentStatus, string> = {
  active: "#10B981",
  completed: "#94A3B8",
  elevated: "#F59E0B",
  "high-risk": "#F43F5E",
  blocked: "#64748B",
};

/** One hue per kind, kept far enough apart to read at a glance. */
const KIND_COLORS = {
  app: "#10B981",   // emerald
  agent: "#6366F1", // indigo
  user: "#F43F5E",  // rose
} as const;
const BLOCKED_EDGE = "#F43F5E";

/** Approximate rendered box per kind — the layout needs sizes before React Flow measures. */
const SIZES = {
  entity: { w: 140, h: 82 },
  intent: { w: 210, h: 44 },
} as const;

type Kind = "app" | "intent" | "agent" | "user";

interface Seed {
  id: string;
  kind: Kind;
  type: keyof typeof SIZES;
  data: PlaneNodeData;
  w: number;
  h: number;
  x: number;
  y: number;
}

interface SeedEdge {
  id: string;
  source: string;
  target: string;
  blocked: boolean;
  /** Hue of the non-intent end, so an edge says what it connects without a legend. */
  tint: string;
}

/** Deterministic PRNG — the opening layout must not jitter between renders. */
function rng(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let x = t;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

const W = 1700;
const H = 1040;

function buildPlane(g: ObsGraph) {
  const apps = g.apps.slice(0, APP_COUNT);
  const seeds = new Map<string, Seed>();
  const edgeKeys = new Set<string>();
  const edges: SeedEdge[] = [];
  const rand = rng(0x5eed);

  const add = (s: Omit<Seed, "x" | "y" | "w" | "h">) => {
    if (seeds.has(s.id)) return;
    const { w, h } = SIZES[s.type];
    seeds.set(s.id, { ...s, w, h, x: W / 2 + (rand() - 0.5) * W * 0.7, y: H / 2 + (rand() - 0.5) * H * 0.7 });
  };
  const link = (a: string, b: string, blocked: boolean, tint: string) => {
    const key = a < b ? `${a}|${b}` : `${b}|${a}`;
    if (edgeKeys.has(key)) return;
    edgeKeys.add(key);
    edges.push({ id: key, source: a, target: b, blocked, tint });
  };

  for (const app of apps) {
    add({
      id: app.id, kind: "app", type: "entity",
      data: { label: app.name, sub: "APP", color: KIND_COLORS.app, icon: "box", shape: "hexagon" },
    });

    // appInteractionsByApp is newest-first, so the first distinct intent ids are the latest.
    const latest: string[] = [];
    for (const ax of g.appInteractionsByApp.get(app.id) ?? []) {
      if (!latest.includes(ax.intentId)) latest.push(ax.intentId);
      if (latest.length >= INTENTS_PER_APP) break;
    }

    for (const intentId of latest) {
      const intent = g.intentById.get(intentId);
      if (!intent) continue;
      const hopCount = g.interactionsByIntent.get(intent.id)?.length ?? 0;
      add({
        id: intent.id, kind: "intent", type: "intent",
        data: {
          label: intent.name,
          sub: intent.status.replace("-", " ").toUpperCase(),
          color: STATUS_COLORS[intent.status],
          meta: `${hopCount} hop${hopCount === 1 ? "" : "s"}`,
          flagged: intent.status === "high-risk" || intent.status === "blocked",
        },
      });

      const hops = (g.appInteractionsByApp.get(app.id) ?? []).filter((ax) => ax.intentId === intentId);
      link(intent.id, app.id, hops.some((ax) => ax.status === "blocked"), KIND_COLORS.app);

      const user = g.userById.get(intent.userId);
      if (user) {
        add({
          id: user.id, kind: "user", type: "entity",
          data: { label: user.name, sub: "USER", color: KIND_COLORS.user, icon: "user", shape: "pentagon" },
        });
        link(user.id, intent.id, false, KIND_COLORS.user);
      }

      for (const ax of hops) {
        const agent = g.agentById.get(ax.agentId);
        if (!agent) continue;
        add({
          id: agent.id, kind: "agent", type: "entity",
          data: { label: agent.name, sub: "AGENT", color: KIND_COLORS.agent, icon: "agents", shape: "circle" },
        });
        link(agent.id, intent.id, ax.status === "blocked", KIND_COLORS.agent);
      }
    }
  }

  const list = [...seeds.values()];
  relax(list, edges);

  const neighbors = new Map<string, Set<string>>();
  for (const s of list) neighbors.set(s.id, new Set());
  for (const e of edges) {
    neighbors.get(e.source)?.add(e.target);
    neighbors.get(e.target)?.add(e.source);
  }

  // React Flow positions from the top-left; the layout works in centres.
  const rfNodes: Node[] = list.map((s) => ({
    id: s.id,
    type: s.type,
    position: { x: s.x - s.w / 2, y: s.y - s.h / 2 },
    data: { ...s.data },
  }));

  const byId = new Map(list.map((s) => [s.id, s]));
  const rfEdges: Edge[] = edges.map((e) => {
    const [sh, th] = handlePair(byId.get(e.source)!, byId.get(e.target)!);
    return {
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: sh,
      targetHandle: th,
      animated: e.blocked,
      style: {
        stroke: e.blocked ? BLOCKED_EDGE : e.tint,
        strokeWidth: e.blocked ? 1.6 : 1.3,
        strokeDasharray: e.blocked ? "5 4" : undefined,
        strokeLinecap: "round" as const,
      },
      data: { blocked: e.blocked },
    };
  });

  return {
    nodes: rfNodes,
    edges: rfEdges,
    neighbors,
    kindById: new Map(list.map((n) => [n.id, n.kind])),
    counts: {
      apps: list.filter((s) => s.kind === "app").length,
      intents: list.filter((s) => s.kind === "intent").length,
      agents: list.filter((s) => s.kind === "agent").length,
      users: list.filter((s) => s.kind === "user").length,
    },
  };
}

/** Attach each edge to the sides that face each other, so lines don't cut across node bodies. */
function handlePair(a: Seed, b: Seed): [string, string] {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? ["r", "l"] : ["l", "r"];
  return dy > 0 ? ["b", "t"] : ["t", "b"];
}

/** Spring/repulsion relaxation — spreads ~50 nodes without pulling in a layout engine. */
function relax(nodes: Seed[], edges: SeedEdge[]) {
  const index = new Map(nodes.map((n, i) => [n.id, i]));
  const pad = 40;
  for (let step = 0; step < 340; step++) {
    const cool = 1 - step / 340;

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i];
        const b = nodes[j];
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        const d = Math.hypot(dx, dy) || 0.01;
        // Boxes are wider than tall, so they need more horizontal clearance.
        const overlap = Math.abs(dx) < (a.w + b.w) / 2 + 34 && Math.abs(dy) < (a.h + b.h) / 2 + 26;
        const force = 26000 / (d * d) + (overlap ? 30 : 0);
        dx /= d;
        dy /= d;
        a.x -= dx * force * cool;
        a.y -= dy * force * cool;
        b.x += dx * force * cool;
        b.y += dy * force * cool;
      }
    }

    for (const e of edges) {
      const a = nodes[index.get(e.source)!];
      const b = nodes[index.get(e.target)!];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy) || 0.01;
      const pull = ((d - 280) / d) * 0.055 * cool;
      a.x += dx * pull;
      a.y += dy * pull;
      b.x -= dx * pull;
      b.y -= dy * pull;
    }

    for (const n of nodes) {
      n.x += (W / 2 - n.x) * 0.003 * cool;
      n.y += (H / 2 - n.y) * 0.003 * cool;
      n.x = Math.max(pad + n.w / 2, Math.min(W - pad - n.w / 2, n.x));
      n.y = Math.max(pad + n.h / 2, Math.min(H - pad - n.h / 2, n.y));
    }
  }
}

/* ---------------- Legend, shared with the page header ---------------- */

export const PLANE_LEGEND: { label: string; color: string; shape?: PlaneShape }[] = [
  { label: "App", color: KIND_COLORS.app, shape: "hexagon" },
  { label: "Agent", color: KIND_COLORS.agent, shape: "circle" },
  { label: "User", color: KIND_COLORS.user, shape: "pentagon" },
  { label: "Intent · active", color: STATUS_COLORS.active },
  { label: "Intent · high risk", color: STATUS_COLORS["high-risk"] },
];

/** Miniature of the canvas silhouette, so the key and the graph can't drift apart. */
function LegendShape({ shape, color }: { shape?: PlaneShape; color: string }) {
  if (!shape) return <span className="obs-plane-swatch" style={{ background: color }} />;
  return (
    <svg width={12} height={12} viewBox="0 0 100 100" style={{ flexShrink: 0, overflow: "visible" }}>
      {shape === "circle" ? (
        <circle cx="50" cy="50" r="42" fill={`${color}26`} stroke={color} strokeWidth={13} />
      ) : (
        <polygon
          points={shape === "pentagon" ? "50,3 97,38 79,94 21,94 3,38" : "50,2 93,26 93,74 50,98 7,74 7,26"}
          fill={`${color}26`}
          stroke={color}
          strokeWidth={13}
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}

export function PlaneLegend() {
  return (
    <div className="obs-plane-legend">
      {PLANE_LEGEND.map((l) => (
        <span key={l.label} className="obs-plane-legend-item">
          <LegendShape shape={l.shape} color={l.color} />
          {l.label}
        </span>
      ))}
    </div>
  );
}

/* ---------------- Canvas ---------------- */

const FILTERS: { key: Kind; label: string; color: string }[] = [
  { key: "app", label: "Apps", color: KIND_COLORS.app },
  { key: "agent", label: "Agents", color: KIND_COLORS.agent },
  { key: "user", label: "Users", color: KIND_COLORS.user },
  { key: "intent", label: "Intents", color: "#94A3B8" },
];

function PlaneCanvas() {
  const g = useMemo(() => buildObsGraph(), []);
  const plane = useMemo(() => buildPlane(g), [g]);
  const { fitView } = useReactFlow();

  const [nodes, , onNodesChange] = useNodesState(plane.nodes);
  const [edges, , onEdgesChange] = useEdgesState(plane.edges);
  const [selected, setSelected] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [hiddenKinds, setHiddenKinds] = useState<Set<Kind>>(new Set());

  const visible = useCallback(
    (id: string) => !hiddenKinds.has(plane.kindById.get(id) as Kind),
    [hiddenKinds, plane],
  );

  /** What stays bright: a hovered/pinned node and its neighbours, or search matches. */
  const lit = useMemo(() => {
    const focus = hovered ?? selected;
    if (focus) {
      const set = new Set<string>([focus]);
      for (const id of plane.neighbors.get(focus) ?? []) set.add(id);
      return set;
    }
    const q = query.trim().toLowerCase();
    if (!q) return null;
    const set = new Set<string>();
    for (const n of plane.nodes) {
      if (String((n.data as PlaneNodeData).label).toLowerCase().includes(q)) set.add(n.id);
    }
    return set;
  }, [hovered, selected, query, plane]);

  // Dimming rides on node data rather than a re-layout, so dragged positions survive it.
  const viewNodes = useMemo(
    () =>
      nodes
        .filter((n) => visible(n.id))
        .map((n) => ({
          ...n,
          data: { ...n.data, dim: !!lit && !lit.has(n.id), selected: selected === n.id },
        })),
    [nodes, lit, selected, visible],
  );

  const viewEdges = useMemo(
    () =>
      edges
        .filter((e) => visible(e.source) && visible(e.target))
        .map((e) => {
          const on = !lit || (lit.has(e.source) && lit.has(e.target));
          const blocked = (e.data as { blocked?: boolean } | undefined)?.blocked;
          return {
            ...e,
            animated: !!blocked && on,
            style: { ...e.style, opacity: on ? (blocked ? 1 : 0.4) : 0.05 },
          };
        }),
    [edges, lit, visible],
  );

  const onNodeClick = useCallback((_: unknown, n: Node) => {
    setSelected((cur) => (cur === n.id ? null : n.id));
  }, []);

  const selectedData = (selected ? nodes.find((n) => n.id === selected)?.data : undefined) as
    | PlaneNodeData
    | undefined;

  /** What the pinned node actually touches, split by kind — more use than a bare total. */
  const breakdown = useMemo(() => {
    if (!selected) return [];
    const tally: Record<Kind, number> = { app: 0, agent: 0, user: 0, intent: 0 };
    for (const id of plane.neighbors.get(selected) ?? []) {
      const k = plane.kindById.get(id) as Kind | undefined;
      if (k) tally[k]++;
    }
    return FILTERS.map((f) => ({ ...f, n: tally[f.key] })).filter((f) => f.n > 0);
  }, [selected, plane]);

  return (
    <div className="obs-plane-canvas">
      <ReactFlow
        nodes={viewNodes}
        edges={viewEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={PLANE_NODE_TYPES}
        onNodeClick={onNodeClick}
        onNodeMouseEnter={(_, n) => setHovered(n.id)}
        onNodeMouseLeave={() => setHovered(null)}
        onPaneClick={() => {
          setSelected(null);
          setFiltersOpen(false);
        }}
        fitView
        fitViewOptions={{ padding: 0.14 }}
        minZoom={0.2}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
        nodesConnectable={false}
        edgesFocusable={false}
      >
        <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="var(--line)" />
        <Controls showInteractive={false} position="bottom-left" />

        <Panel position="top-left">
          <label className="obs-plane-search">
            <Icon name="search" size={14} style={{ color: "var(--fg-muted)", flexShrink: 0 }} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search node…"
              aria-label="Search nodes by name"
            />
            {query && (
              <button type="button" onClick={() => setQuery("")} aria-label="Clear search">
                <Icon name="close" size={12} />
              </button>
            )}
          </label>
        </Panel>

        <Panel position="top-right">
          <div className="obs-plane-tools">
            <button type="button" className="obs-plane-tool" onClick={() => fitView({ padding: 0.14, duration: 300 })}>
              <Icon name="target" size={13} />
              Fit view
            </button>
            <div style={{ position: "relative" }}>
              <button
                type="button"
                className={`obs-plane-tool${hiddenKinds.size > 0 ? " active" : ""}`}
                onClick={() => setFiltersOpen((v) => !v)}
                aria-expanded={filtersOpen}
              >
                <Icon name="filter" size={13} />
                Filters
                {hiddenKinds.size > 0 && <span className="obs-plane-tool-badge">{FILTERS.length - hiddenKinds.size}</span>}
              </button>
              {filtersOpen && (
                <div className="obs-plane-pop">
                  {FILTERS.map((f) => {
                    const on = !hiddenKinds.has(f.key);
                    return (
                      <button
                        key={f.key}
                        type="button"
                        className="obs-plane-pop-row"
                        onClick={() =>
                          setHiddenKinds((prev) => {
                            const next = new Set(prev);
                            if (next.has(f.key)) next.delete(f.key);
                            else next.add(f.key);
                            return next;
                          })
                        }
                      >
                        <span
                          className="obs-plane-check"
                          style={{
                            background: on ? f.color : "transparent",
                            borderColor: on ? f.color : "var(--line-strong)",
                          }}
                        >
                          {on && <Icon name="check" size={9} style={{ color: "#fff" }} />}
                        </span>
                        {f.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </Panel>

        {selectedData && (
          <Panel position="bottom-center">
            <div className="obs-plane-detail">
              <span className="obs-plane-detail-dot" style={{ background: selectedData.color }} />
              <strong>{selectedData.label}</strong>
              <span className="obs-plane-foot-sub">{selectedData.sub}</span>
              <span className="obs-plane-foot-sep" />
              {breakdown.length > 0 ? (
                breakdown.map((b) => (
                  <span key={b.key} className="obs-plane-count" style={{ color: b.color, borderColor: "currentColor" }}>
                    <strong>{b.n}</strong> {b.label.toLowerCase()}
                  </span>
                ))
              ) : (
                <span className="obs-plane-foot-sub">No connections</span>
              )}
              <button type="button" className="obs-plane-detail-close" onClick={() => setSelected(null)} aria-label="Clear selection">
                <Icon name="close" size={12} />
              </button>
            </div>
          </Panel>
        )}
      </ReactFlow>
    </div>
  );
}

export function ObservabilityPlane() {
  return (
    <ReactFlowProvider>
      <PlaneCanvas />
    </ReactFlowProvider>
  );
}
