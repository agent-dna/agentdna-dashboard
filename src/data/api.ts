// Data layer — mixes real API calls with stubs for endpoints that don't exist yet.
// Shapes defined in src/types.ts; API contracts in the middleware README.

import { apiRequest } from "../api/client";
import type {
  Agent,
  Tool,
  Intent,
  Interaction,
  TimeSeries,
  HeatmapRow,
  LogEntry,
  IntentParticipant,
  HomeMetrics,
} from "../types";

// ============ Helpers (API → internal type mappers) ============

function isoToMinutesAgo(iso: string | undefined | null): number {
  if (!iso) return 0;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 0;
  return Math.max(0, Math.floor((Date.now() - t) / 60000));
}

function shortDid(did: string): string {
  if (!did) return "";
  return did.length > 24 ? `${did.slice(0, 12)}…${did.slice(-6)}` : did;
}

interface ApiInteraction {
  interactionID: string;
  from: string;
  to: string;
  /** Backend-resolved display name for the initiator (preferred over DID lookup). */
  fromName?: string;
  /** Backend-resolved display name for the target. */
  toName?: string;
  threat: boolean;
  intentID: string;
  time: string;
}

function mapInteraction(i: ApiInteraction): Interaction {
  const fromName = i.fromName && i.fromName.trim() ? i.fromName.trim() : shortDid(i.from);
  const toName = i.toName && i.toName.trim() ? i.toName.trim() : shortDid(i.to);
  return {
    id: i.interactionID,
    initiator: { id: i.from, name: fromName },
    target: { id: i.to, name: toName },
    targetType: "agent",
    intent: { id: i.intentID, name: "" },
    runtime: 0,
    threat: !!i.threat,
    created: isoToMinutesAgo(i.time),
  };
}

// ============ Home ============

export function fetchHomeMetrics(page = 1): Promise<HomeMetrics> {
  return apiRequest<HomeMetrics>("/home-metrics", { query: { page } });
}

// ============ Lists (org-scoped) ============

interface PagedInteractions {
  interactionList: ApiInteraction[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export async function fetchInteractions(page = 1): Promise<Interaction[]> {
  const res = await apiRequest<PagedInteractions>("/interactions-list", { query: { page } });
  return (res.interactionList || []).map(mapInteraction);
}

export async function fetchAlerts(page = 1): Promise<Interaction[]> {
  // No dedicated alerts endpoint — filter the org's interactions client-side.
  const res = await apiRequest<PagedInteractions>("/interactions-list", { query: { page } });
  return (res.interactionList || []).map(mapInteraction).filter((i) => i.threat);
}

interface ApiAgent {
  agentID: string;
  agentName: string;
  createdAt: string;
  deployer: string;
  policy: string;
  totalInteractions: number;
  totalThreats: number;
  score: number;
}

interface PagedAgents {
  agentsList: ApiAgent[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

function mapAgent(a: ApiAgent): Agent {
  return {
    id: a.agentID,
    name: a.agentName,
    score: a.score,
    created: isoToMinutesAgo(a.createdAt),
    interactions: a.totalInteractions,
    threats: a.totalThreats,
    connected: 0,
    status: a.totalThreats > 5 ? "warn" : "safe",
    env: "",
    owner: a.deployer || "",
    policy: a.policy || "",
  };
}

export async function fetchAgents(page = 1): Promise<Agent[]> {
  const res = await apiRequest<PagedAgents>("/agents-list", { query: { page } });
  console.log(`[GET /agents-list?page=${page}]`, res);
  return (res.agentsList || []).map(mapAgent);
}

export interface PagedAgentsResult {
  items: Agent[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export async function fetchAgentsPaged(page = 1): Promise<PagedAgentsResult> {
  const res = await apiRequest<PagedAgents>("/agents-list", { query: { page } });
  console.log(`[GET /agents-list?page=${page}]`, res);
  return {
    items: (res.agentsList || []).map(mapAgent),
    total: res.total || 0,
    page: res.page || page,
    pageSize: res.pageSize || 10,
    totalPages: res.totalPages || 1,
  };
}

/** Walk every page of /agents-list — used by the DID→name directory. */
export async function fetchAllAgents(): Promise<Agent[]> {
  const out: Agent[] = [];
  for (let page = 1; page <= 200; page++) {
    const res = await apiRequest<PagedAgents>("/agents-list", { query: { page } });
    console.log(`[GET /agents-list?page=${page}]`, res);
    const items = (res.agentsList || []).map(mapAgent);
    out.push(...items);
    if (items.length === 0 || (res.totalPages && page >= res.totalPages)) break;
  }
  return out;
}

interface ApiTool {
  toolDID: string;
  toolName: string;
  totalInteractions: number;
  totalThreats: number;
  score: number;
}

interface PagedTools {
  toolsList: ApiTool[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

function mapTool(t: ApiTool): Tool {
  const provider = (t.toolName || "").split(".")[0] || "";
  return {
    id: t.toolDID,
    name: t.toolName,
    score: t.score,
    created: 0,
    interactions: t.totalInteractions,
    threats: t.totalThreats,
    connected: 0,
    status: t.totalThreats > 4 ? "warn" : "safe",
    scope: "",
    provider,
  };
}

export async function fetchTools(page = 1): Promise<Tool[]> {
  const res = await apiRequest<PagedTools>("/tools-list", { query: { page } });
  return (res.toolsList || []).map(mapTool);
}

export interface PagedToolsResult {
  items: Tool[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export async function fetchToolsPaged(page = 1): Promise<PagedToolsResult> {
  const res = await apiRequest<PagedTools>("/tools-list", { query: { page } });
  console.log(`[GET /tools-list?page=${page}]`, res);
  return {
    items: (res.toolsList || []).map(mapTool),
    total: res.total || 0,
    page: res.page || page,
    pageSize: res.pageSize || 10,
    totalPages: res.totalPages || 1,
  };
}

/** Walk every page of /tools-list — used by the DID→name directory. */
export async function fetchAllTools(): Promise<Tool[]> {
  const out: Tool[] = [];
  for (let page = 1; page <= 200; page++) {
    const res = await apiRequest<PagedTools>("/tools-list", { query: { page } });
    console.log(`[GET /tools-list?page=${page}]`, res);
    const items = (res.toolsList || []).map(mapTool);
    out.push(...items);
    if (items.length === 0 || (res.totalPages && page >= res.totalPages)) break;
  }
  return out;
}

interface ApiIntent {
  intentID: string;
  initiatorDID: string;
  startedAt: string;
  status: string;
  threatDetected: boolean;
}

interface PagedIntents {
  intentsList: ApiIntent[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

function stubAgent(did: string): Agent {
  return {
    id: did,
    name: shortDid(did),
    score: 0,
    created: 0,
    interactions: 0,
    threats: 0,
    connected: 0,
    status: "safe",
    env: "",
    owner: "",
  };
}

function mapIntent(i: ApiIntent): Intent {
  return {
    id: i.intentID,
    name: i.status || "",
    initiator: stubAgent(i.initiatorDID),
    runtime: 0,
    started: isoToMinutesAgo(i.startedAt),
    agentsInteracted: 0,
    toolsInteracted: 0,
    threats: i.threatDetected ? 1 : 0,
    score: 0,
    status: i.threatDetected ? "threat" : "safe",
  };
}

export async function fetchIntents(page = 1): Promise<Intent[]> {
  const res = await apiRequest<PagedIntents>("/intent-list", { query: { page } });
  console.log(`[GET /intent-list?page=${page}]`, res);
  return (res.intentsList || []).map(mapIntent);
}

export interface PagedIntentsResult {
  items: Intent[];
  total: number;
  page: number;
  totalPages: number;
}

export async function fetchIntentsPaged(page = 1): Promise<PagedIntentsResult> {
  const res = await apiRequest<PagedIntents>("/intent-list", { query: { page } });
  console.log(`[GET /intent-list?page=${page}]`, res);
  return {
    items: (res.intentsList || []).map(mapIntent),
    total: res.total || 0,
    page: res.page || page,
    totalPages: res.totalPages || 1,
  };
}

export async function fetchSeries(_range: "24h" | "7d"): Promise<TimeSeries> {
  return { total: [], safe: [], threats: [] };
}

export async function fetchHeatmap(): Promise<HeatmapRow[]> {
  return [];
}

// ============ Detail pages ============

interface ApiAgentInfo {
  agentDID: string;
  agentName: string;
  createdAt: string;
  deployerDID: string;
  policy?: string;
  orgID: string;
  totalInteractions: number;
  totalThreats: number;
  score: number;
}

export async function fetchAgent(id: string): Promise<Agent | null> {
  try {
    const r = await apiRequest<ApiAgentInfo>("/agent-info", { query: { agentDID: id } });
    console.log(`[GET /agent-info?agentDID=${id}]`, r);
    return {
      id: r.agentDID,
      name: r.agentName,
      score: r.score,
      created: isoToMinutesAgo(r.createdAt),
      interactions: r.totalInteractions,
      threats: r.totalThreats,
      connected: 0,
      status: r.totalThreats > 5 ? "warn" : "safe",
      env: r.orgID || "",
      owner: r.deployerDID || "",
      policy: r.policy || "",
    };
  } catch {
    return null;
  }
}

interface ApiIntentInfo {
  intentID: string;
  initiatorDID: string;
  startedAt: string;
  endedAt?: string;
  status: string;
  threatDetected: boolean;
  interactions?: ApiInteraction[];
}

async function fetchIntentInfo(id: string): Promise<ApiIntentInfo | null> {
  try {
    const res = await apiRequest<ApiIntentInfo>("/intent-info", { query: { intentID: id } });
    console.log(`[GET /intent-info?intentID=${id}]`, res);
    return res;
  } catch (e) {
    console.warn(`[GET /intent-info?intentID=${id}] failed`, e);
    return null;
  }
}

export async function fetchIntent(id: string): Promise<Intent | null> {
  const r = await fetchIntentInfo(id);
  if (!r) return null;
  return mapIntent({
    intentID: r.intentID,
    initiatorDID: r.initiatorDID,
    startedAt: r.startedAt,
    status: r.status,
    threatDetected: r.threatDetected,
  });
}

interface PagedAgentInteractions {
  interactionsList: ApiInteraction[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export async function fetchAgentInteractions(id: string, page = 1): Promise<Interaction[]> {
  try {
    const res = await apiRequest<PagedAgentInteractions>("/agent-interactions", {
      query: { agentDID: id, page },
    });
    return (res.interactionsList || []).map(mapInteraction);
  } catch {
    return [];
  }
}

export async function fetchAgentIntents(id: string, page = 1): Promise<Intent[]> {
  try {
    const res = await apiRequest<PagedIntents>("/agent-intents", { query: { agentDID: id, page } });
    return (res.intentsList || []).map(mapIntent);
  } catch {
    return [];
  }
}

export async function fetchIntentInteractions(id: string): Promise<Interaction[]> {
  const r = await fetchIntentInfo(id);
  return (r?.interactions || []).map(mapInteraction);
}

export async function fetchIntentParticipants(id: string): Promise<IntentParticipant[]> {
  const interactions = await fetchIntentInteractions(id);
  const map = new Map<string, IntentParticipant>();
  for (const r of interactions) {
    const sides: { ref: { id: string; name: string }; type: "agent" | "tool" }[] = [
      { ref: r.initiator, type: "agent" },
      { ref: r.target, type: r.targetType },
    ];
    for (const { ref, type } of sides) {
      const k = `${type}:${ref.id}`;
      const existing = map.get(k);
      if (existing) {
        existing.count++;
        existing.lastSeen = Math.min(existing.lastSeen, r.created);
        if (r.threat) existing.threats++;
      } else {
        map.set(k, {
          entity: { id: ref.id, name: ref.name, score: 0 },
          type,
          count: 1,
          threats: r.threat ? 1 : 0,
          lastSeen: r.created,
        });
      }
    }
  }
  return Array.from(map.values()).sort((a, b) => b.count - a.count);
}

// No log endpoint in spec yet — stays stubbed.
export async function fetchLogs(_kind: "agent" | "intent", _id: string): Promise<LogEntry[]> {
  return [];
}
