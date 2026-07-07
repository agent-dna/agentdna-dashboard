// Data layer — mixes real API calls with stubs for endpoints that don't exist yet.
// Shapes defined in src/types.ts; API contracts in the middleware README.

import { apiRequest } from "../api/client";
import { isDummyMode } from "./dummyRouter";
import dummy from "./dummy.json";
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
  PublicMetrics,
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
  /** Backend-supplied block type (chain block category / classification). */
  blockType?: string;
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
    blockType: i.blockType,
  };
}

// ============ Home ============

export function fetchHomeMetrics(page = 1): Promise<HomeMetrics> {
  return apiRequest<HomeMetrics>("/home-metrics", { query: { page } });
}

export function fetchPublicMetrics(): Promise<PublicMetrics> {
  return apiRequest<PublicMetrics>("/global-stats", { auth: false });
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

export interface PagedInteractionsResult {
  interactions: Interaction[];
  total: number;
  totalPages: number;
  page: number;
  pageSize: number;
}

export async function fetchInteractionsPaged(page = 1): Promise<PagedInteractionsResult> {
  try {
    const res = await apiRequest<PagedInteractions>("/interactions-list", { query: { page } });
    return {
      interactions: (res.interactionList || []).map(mapInteraction),
      total: res.total || 0,
      totalPages: res.totalPages || 1,
      page: res.page || page,
      pageSize: res.pageSize || 0,
    };
  } catch {
    return { interactions: [], total: 0, totalPages: 1, page, pageSize: 0 };
  }
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
    const items = (res.toolsList || []).map(mapTool);
    out.push(...items);
    if (items.length === 0 || (res.totalPages && page >= res.totalPages)) break;
  }
  return out;
}

interface ApiIntent {
  intentID: string;
  initiatorDID: string;
  /** Backend-resolved display name for the initiator (e.g. "user_1" / email). */
  initiatorName?: string;
  startedAt: string;
  /** Present only if the intent has ended. */
  endedAt?: string;
  status: string;
  threatDetected: boolean;
  /** Actual count of threat interactions within this intent. */
  threatCount?: number;
  flowType?: string;
  executor?: string;
  chainDepth?: number;
  /** Total interactions recorded under this intent. */
  interactionsCount?: number;
  /** Distinct agents touched by this intent. */
  agentsCount?: number;
  /** Distinct tools touched by this intent. */
  toolsCount?: number;
  provenanceRecordID?: string;
}

interface PagedIntents {
  intentsList: ApiIntent[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

function stubAgent(did: string, name?: string): Agent {
  return {
    id: did,
    name: name && name.trim() ? name.trim() : shortDid(did),
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
  // Runtime is the gap between startedAt and endedAt (if ended), in ms.
  let runtime = 0;
  if (i.endedAt && i.startedAt) {
    const start = new Date(i.startedAt).getTime();
    const end = new Date(i.endedAt).getTime();
    if (!Number.isNaN(start) && !Number.isNaN(end) && end >= start) {
      runtime = end - start;
    }
  }
  return {
    id: i.intentID,
    name: i.status || "",
    initiator: stubAgent(i.initiatorDID, i.initiatorName),
    runtime,
    started: isoToMinutesAgo(i.startedAt),
    agentsInteracted: i.agentsCount ?? 0,
    toolsInteracted: i.toolsCount ?? 0,
    interactionsCount: i.interactionsCount ?? 0,
    threats: i.threatCount ?? (i.threatDetected ? 1 : 0),
    score: 0,
    status: i.threatDetected ? "threat" : "safe",
    provenanceRecordID: i.provenanceRecordID ?? "",
  };
}

export async function fetchIntents(page = 1): Promise<Intent[]> {
  const res = await apiRequest<PagedIntents>("/intent-list", { query: { page } });
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
  return {
    items: (res.intentsList || []).map(mapIntent),
    total: res.total || 0,
    page: res.page || page,
    totalPages: res.totalPages || 1,
  };
}

export async function fetchAllIntents(): Promise<Intent[]> {
  const out: Intent[] = [];
  for (let page = 1; page <= 200; page++) {
    const res = await apiRequest<PagedIntents>("/intent-list", { query: { page } });
    const items = (res.intentsList || []).map(mapIntent);
    out.push(...items);
    if (items.length === 0 || (res.totalPages && page >= res.totalPages)) break;
  }
  return out;
}

export async function fetchSeries(range: "24h" | "7d"): Promise<TimeSeries> {
  if (isDummyMode()) {
    return dummySeries(range);
  }
  try {
    const res = await apiRequest<{ safe: number[]; threats: number[] }>(
      "/interactions/series",
      { query: { range } },
    );
    if (!res) return { total: [], safe: [], threats: [] };
    const safe = res.safe ?? [];
    const threats = res.threats ?? [];
    const total = safe.map((v, i) => v + (threats[i] ?? 0));
    return { total, safe, threats };
  } catch {
    return { total: [], safe: [], threats: [] };
  }
}

interface DummyInteractionForSeries {
  time: string;
  threat: boolean;
}

/**
 * Bucket dummy interactions into hourly (24h) or daily (7d) slots ending "now".
 * Built so the demo chart isn't flat — values come from the dummy.json times,
 * augmented with a small synthetic baseline so we don't show a row of zeros.
 */
function dummySeries(range: "24h" | "7d"): TimeSeries {
  const ix: DummyInteractionForSeries[] = (dummy.intents as Array<{ interactions: DummyInteractionForSeries[] }>)
    .flatMap((i) => i.interactions);

  const buckets = range === "24h" ? 24 : 7;
  const stepMs = range === "24h" ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
  // Anchor on the latest interaction so the chart fills the whole window even
  // if "now" has drifted past the seeded times.
  const latest = ix.reduce(
    (m, x) => Math.max(m, new Date(x.time).getTime()),
    new Date(dummy.intents[0]?.startedAt || "").getTime() || 0,
  ) || Date.now();
  const endMs = latest;
  const startMs = endMs - (buckets - 1) * stepMs;

  const safe = Array<number>(buckets).fill(0);
  const threats = Array<number>(buckets).fill(0);

  for (const x of ix) {
    const t = new Date(x.time).getTime();
    if (Number.isNaN(t)) continue;
    const b = Math.floor((t - startMs) / stepMs);
    if (b < 0 || b >= buckets) continue;
    if (x.threat) threats[b]++;
    else safe[b]++;
  }

  // Layer a deterministic baseline so the chart looks alive even when the
  // bucketed dataset is sparse.
  const baseline = range === "24h"
    ? [4, 3, 2, 2, 3, 4, 6, 9, 12, 15, 17, 19, 22, 24, 23, 21, 19, 17, 15, 13, 11, 9, 7, 5]
    : [42, 51, 48, 63, 70, 58, 66];
  const threatBaseline = range === "24h"
    ? [0, 0, 0, 0, 0, 0, 1, 1, 2, 2, 2, 3, 3, 4, 4, 3, 2, 2, 1, 1, 0, 0, 0, 0]
    : [3, 5, 4, 6, 7, 5, 4];

  for (let i = 0; i < buckets; i++) {
    safe[i] += baseline[i] ?? 0;
    threats[i] += threatBaseline[i] ?? 0;
  }

  const total = safe.map((v, i) => v + threats[i]);
  return { total, safe, threats };
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
  initiatorName?: string;
  startedAt: string;
  endedAt?: string;
  status: string;
  threatDetected: boolean;
  provenanceRecordID?: string;
  interactions?: ApiInteraction[];
}

async function fetchIntentInfo(id: string): Promise<ApiIntentInfo | null> {
  try {
    const res = await apiRequest<ApiIntentInfo>("/intent-info", { query: { intentID: id } });
    return res;
  } catch (e) {
    console.warn(`[GET /intent-info?intentID=${id}] failed`, e);
    return null;
  }
}

export async function fetchIntent(id: string): Promise<Intent | null> {
  const [r, firstPage] = await Promise.all([
    fetchIntentInfo(id),
    fetchIntentInteractionsPaged(id, 1),
  ]);
  if (!r) return null;

  // Collect all interactions across pages to derive participant counts.
  const allInteractions = [...firstPage.interactions];
  for (let p = 2; p <= firstPage.totalPages; p++) {
    const page = await fetchIntentInteractionsPaged(id, p);
    allInteractions.push(...page.interactions);
  }

  const initiatorDID = (r.initiatorDID ?? "").trim().toLowerCase();
  const agentDids = new Set<string>();
  const toolDids = new Set<string>();
  const isAgentId = (id: string) => id.trim().toLowerCase().startsWith("bafy");
  for (const ix of allInteractions) {
    const fromId = ix.initiator.id.trim().toLowerCase();
    const toId = ix.target.id.trim().toLowerCase();
    if (fromId && fromId !== initiatorDID) {
      if (isAgentId(fromId)) agentDids.add(ix.initiator.id);
      else toolDids.add(ix.initiator.id);
    }
    if (toId && toId !== initiatorDID) {
      if (isAgentId(toId)) agentDids.add(ix.target.id);
      else toolDids.add(ix.target.id);
    }
  }

  return mapIntent({
    intentID: r.intentID,
    initiatorDID: r.initiatorDID,
    initiatorName: r.initiatorName,
    startedAt: r.startedAt,
    endedAt: r.endedAt,
    status: r.status,
    threatDetected: r.threatDetected,
    agentsCount: agentDids.size,
    toolsCount: toolDids.size,
    interactionsCount: firstPage.total,
    provenanceRecordID: r.provenanceRecordID ?? "",
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

export interface PagedIntentInteractionsResult {
  interactions: Interaction[];
  total: number;
  totalPages: number;
  page: number;
}

export async function fetchIntentInteractionsPaged(
  intentId: string,
  page = 1,
): Promise<PagedIntentInteractionsResult> {
  try {
    const res = await apiRequest<PagedInteractions>("/interactions-list", {
      query: { intentID: intentId, page },
    });
    return {
      interactions: (res.interactionList || []).map(mapInteraction),
      total: res.total || 0,
      totalPages: res.totalPages || 1,
      page: res.page || page,
    };
  } catch {
    return { interactions: [], total: 0, totalPages: 1, page };
  }
}

export async function fetchIntentParticipants(id: string): Promise<IntentParticipant[]> {
  const [intentInfo, firstPage] = await Promise.all([
    fetchIntentInfo(id),
    fetchIntentInteractionsPaged(id, 1),
  ]);
  const initiatorDID = (intentInfo?.initiatorDID ?? "").trim().toLowerCase();
  const allInteractions = [...firstPage.interactions];
  for (let p = 2; p <= firstPage.totalPages; p++) {
    const page = await fetchIntentInteractionsPaged(id, p);
    allInteractions.push(...page.interactions);
  }
  const interactions = allInteractions;
  const map = new Map<string, IntentParticipant>();
  for (const r of interactions) {
    const sides: { ref: { id: string; name: string }; type: "agent" | "tool" }[] = [
      { ref: r.initiator, type: "agent" },
      { ref: r.target, type: r.targetType },
    ];
    for (const { ref, type } of sides) {
      if (initiatorDID && ref.id.trim().toLowerCase() === initiatorDID) continue;
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

export interface IntentBlock {
  id: string;
  block_index: number;
  agent_did: string;
  agent_name: string;
  direction: string;
  block_type: "trigger" | "delegate" | "tool_call" | "execute" | "response" | "verify" | string;
  message: string;
  response: string;
  delegate_to: string;
  received_from: string;
  cbac_app: string;
  cbac_decision: string;
  threat_detected: boolean;
  trust_issues: string[];
  signature: string;
  created_at: string;
  parent_block: IntentBlock | null;
}

/** Walk the parent_block chain and return blocks ordered oldest → newest. */
export function flattenIntentBlocks(root: IntentBlock): IntentBlock[] {
  const chain: IntentBlock[] = [];
  let cur: IntentBlock | null = root;
  while (cur) {
    chain.push(cur);
    cur = cur.parent_block;
  }
  return chain.reverse();
}

export async function fetchIntentBlockData(intentId: string): Promise<IntentBlock | null> {
  try {
    // apiRequest already unwraps { status, data } and returns the inner object directly.
    const res = await apiRequest<IntentBlock>("/intent-block-data", {
      query: { intent_id: intentId },
    });
    return res ?? null;
  } catch (e) {
    console.warn(`[GET /intent-block-data?intent_id=${intentId}] failed`, e);
    return null;
  }
}

export interface DiagramBasicInfo {
  intentID: string;
  initiatorDID: string;
  initiatorName: string;
  flowType: string;
  status: string;
  threatDetected: boolean;
  chainDepth: number;
  interactionsCount: number;
  agentsCount: number;
  toolsCount: number;
  startedAt: string;
}

export interface DiagramInteraction {
  interactionID: string;
  initiator: string;    // DID of sender
  initiatorName: string;
  to: string;           // DID of recipient
  toName: string;
  type: "trigger" | "delegate" | "tool_call" | "response" | "execute";
  message: string;
  intentID: string;
  threat: boolean;
  epoch: number;
}

export interface IntentDiagram {
  basicInfo: DiagramBasicInfo;
  interactions: DiagramInteraction[];
}

export async function fetchIntentDiagram(id: string): Promise<IntentDiagram | null> {
  try {
    // apiRequest already unwraps { status, data } and returns data directly.
    const res = await apiRequest<IntentDiagram>("/intent-diagram", { query: { intentID: id } });
    return res ?? null;
  } catch (e) {
    console.warn("[intent-diagram] failed", e);
    return null;
  }
}
