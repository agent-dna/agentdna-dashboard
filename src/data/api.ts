// Data layer — mixes real API calls with stubs for endpoints that don't exist yet.
// Shapes defined in src/types.ts; API contracts in the middleware README.

import { apiRequest } from "../api/client";
import { isDummyMode } from "./dummyRouter";
import { getDirectorySnapshot, waitForDirectoryReady } from "./directoryCache";
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
  EntityRef,
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

/**
 * Interactions carry no explicit participant-type field from the backend
 * (mapInteraction always stubs `targetType: "agent"`), so this DID-shape
 * heuristic was the fallback for telling them apart client-side. It doesn't
 * actually work in production, though — real tool/app DIDs use the same
 * "bafy…" CID format as agent DIDs, so it silently misclassified real tools
 * (e.g. a "Github MCP" app) as agents. Kept only as a last resort for a DID
 * the org directory hasn't resolved at all.
 */
function isAgentId(id: string): boolean {
  return id.trim().toLowerCase().startsWith("bafy");
}

/** Agent-vs-tool classification for one DID, directory-first. */
function classifyParticipant(id: string): "agent" | "tool" {
  const hit = getDirectorySnapshot().get(id);
  if (hit) return hit.kind === "tool" ? "tool" : "agent";
  return isAgentId(id) ? "agent" : "tool";
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
  /** Non-empty only when `threat` is true — pass to GET /threat-by-id for the full message. */
  threatID?: string;
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
    threatID: i.threatID || undefined,
  };
}

// ============ Home ============

export function fetchHomeMetrics(page = 1): Promise<HomeMetrics> {
  return apiRequest<HomeMetrics>("/home-metrics", { query: { page } });
}

export function fetchPublicMetrics(): Promise<PublicMetrics> {
  return apiRequest<PublicMetrics>("/global-stats", { auth: false });
}

// ============ Agents & Apps metrics ============

export interface AgentsAppsTopItem {
  name: string;
  totalInteractions: number;
  totalThreats: number;
}

export interface AgentsAppsMetrics {
  topAgents: AgentsAppsTopItem[];
  topApps: AgentsAppsTopItem[];
  metrics: {
    totalInteractions: number;
    totalThreats: number;
    totalAgents: number;
    totalApps: number;
    avgReliability: number;
  };
}

export function fetchAgentsAppsMetrics(): Promise<AgentsAppsMetrics> {
  return apiRequest<AgentsAppsMetrics>("/agents-apps-metrics");
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

/** Used only by the unrouted legacy AlertsPage — HomePage uses fetchThreatEvents below. */
export async function fetchAlerts(page = 1): Promise<Interaction[]> {
  // No dedicated alerts endpoint — filter the org's interactions client-side.
  const res = await apiRequest<PagedInteractions>("/interactions-list", { query: { page } });
  return (res.interactionList || []).map(mapInteraction).filter((i) => i.threat);
}

// ============ Threat events ============

export interface ThreatEvent {
  id: string;
  intentID: string;
  interactionID: string;
  /** Minutes ago, same convention as everywhere else in this file. */
  time: number;
  threatCode: number;
  message: string;
}

interface ApiThreatEvent {
  id: string;
  intent_id: string;
  interaction_id: string;
  time: string;
  threat_code: number;
  message: string;
}

function mapThreatEvent(t: ApiThreatEvent): ThreatEvent {
  return {
    id: t.id,
    intentID: t.intent_id,
    interactionID: t.interaction_id,
    time: isoToMinutesAgo(t.time),
    threatCode: t.threat_code,
    message: t.message,
  };
}

export interface PagedThreatEvents {
  items: ThreatEvent[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface ApiPagedThreatEvents {
  threats: ApiThreatEvent[];
  total: number;
  page: number;
  limit: number;
}

export async function fetchThreatEvents(page = 1, limit = 10): Promise<PagedThreatEvents> {
  try {
    const res = await apiRequest<ApiPagedThreatEvents>("/threat-events", { query: { page, limit } });
    const pageSize = res.limit || limit;
    return {
      items: (res.threats || []).map(mapThreatEvent),
      total: res.total || 0,
      page: res.page || page,
      pageSize,
      totalPages: Math.max(1, Math.ceil((res.total || 0) / pageSize)),
    };
  } catch {
    return { items: [], total: 0, page, pageSize: limit, totalPages: 1 };
  }
}

/** One entry in the top-5-most-frequent-threats list. */
export interface TopThreat {
  threatCode: number;
  title: string;
  count: number;
}

interface ApiTopThreat {
  threat_code: number;
  title: string;
  count: number;
}

export async function fetchTopThreats(): Promise<TopThreat[]> {
  // No try/catch — let a real failure propagate to useAsync's `.error` so the
  // UI can tell "the request failed" apart from "there are genuinely no
  // threats", instead of both looking like a silent empty list.
  const res = await apiRequest<ApiTopThreat[]>("/top-threats");
  return (res || []).map((t) => ({ threatCode: t.threat_code, title: t.title, count: t.count }));
}

export interface ThreatDetail {
  threatCode: number;
  title: string;
  description: string;
  count: number;
  events: ThreatEvent[];
}

interface ApiThreatDetail {
  threat_code: number;
  title: string;
  description: string;
  count: number;
  threats: ApiThreatEvent[];
}

/** Not currently wired into any page — available for a future "view threat" drawer/page. */
export async function fetchThreatDetail(threatCode: number): Promise<ThreatDetail | null> {
  try {
    const res = await apiRequest<ApiThreatDetail>("/threat-detail", { query: { threat_code: threatCode } });
    return {
      threatCode: res.threat_code,
      title: res.title,
      description: res.description,
      count: res.count,
      events: (res.threats || []).map(mapThreatEvent),
    };
  } catch {
    return null;
  }
}

/** One specific threat event, looked up by its threatID (e.g. an interaction's `threatID`). */
export interface ThreatByID {
  id: string;
  intentID: string;
  interactionID: string;
  time: number;
  threatCode: number;
  title: string;
  description: string;
  message: string;
}

interface ApiThreatByID {
  id: string;
  intent_id: string;
  interaction_id: string;
  time: string;
  threat_code: number;
  title: string;
  description: string;
  message: string;
}

export async function fetchThreatByID(threatId: string): Promise<ThreatByID | null> {
  // No threatID to look up isn't a failure — it's a different case (this
  // interaction just doesn't carry one from whichever endpoint fetched it)
  // and the caller distinguishes it from a real fetch failure.
  if (!threatId) return null;
  // No try/catch beyond that — let a real failure (404 "threat ... not
  // found", network error, etc.) propagate to useAsync's `.error` instead of
  // collapsing into the same silent null as "no threatID", which made both
  // cases show an identical, undiagnosable "Unable to load threat details".
  const res = await apiRequest<ApiThreatByID>("/threat-by-id", { query: { threat_id: threatId } });
  return {
    id: res.id,
    intentID: res.intent_id,
    interactionID: res.interaction_id,
    time: isoToMinutesAgo(res.time),
    threatCode: res.threat_code,
    title: res.title,
    description: res.description,
    message: res.message,
  };
}

/**
 * The actual "list of threats" endpoint — flagged interactions (new_interactions
 * where threat = 1), each already carrying its resolved message. Role-scoped
 * server-side: admins see the whole org, non-admins see only their own DID.
 * Distinct from /threat-events (which this replaced as the Home page's Threats
 * table source) and from /threat-detail (the threat-code catalog).
 */
export interface ThreatListItem {
  /** Same value as interactionID — DataTable rows key off `id`. */
  id: string;
  interactionID: string;
  intentID: string;
  initiator: EntityRef;
  target: EntityRef;
  type: string;
  threatID: string;
  threatTitle: string;
  /** Now returned by /threats-list — undefined only if the backend omits it for a given row. */
  threatCode: number | undefined;
  message: string;
  /** Minutes ago. */
  time: number;
  reviewStatus: Intent["reviewStatus"];
}

interface ApiThreatListItem {
  interactionID: string;
  from: string;
  fromName?: string;
  to: string;
  toName?: string;
  type: string;
  direction?: string;
  threat: boolean;
  threatID: string;
  threatTitle?: string;
  threatCode?: number;
  intentID: string;
  reviewStatus?: string;
  time: string;
  message: string;
}

function mapThreatListItem(t: ApiThreatListItem): ThreatListItem {
  return {
    id: t.interactionID,
    interactionID: t.interactionID,
    intentID: t.intentID,
    initiator: { id: t.from, name: t.fromName?.trim() || shortDid(t.from) },
    target: { id: t.to, name: t.toName?.trim() || shortDid(t.to) },
    type: t.type,
    threatID: t.threatID,
    threatTitle: t.threatTitle?.trim() || "",
    threatCode: t.threatCode,
    message: t.message,
    time: isoToMinutesAgo(t.time),
    reviewStatus: toReviewStatus(t.reviewStatus),
  };
}

export interface PagedThreatsList {
  items: ThreatListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface ApiPagedThreatsList {
  threatsList: ApiThreatListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export async function fetchThreatsList(page = 1): Promise<PagedThreatsList> {
  // No try/catch here either, for the same reason as fetchTopThreats above.
  const res = await apiRequest<ApiPagedThreatsList>("/threats-list", { query: { page } });
  return {
    items: (res.threatsList || []).map(mapThreatListItem),
    total: res.total || 0,
    page: res.page || page,
    pageSize: res.pageSize || 10,
    totalPages: res.totalPages || 1,
  };
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
  /** Human review state — separate from `status` (the pipeline state). Defaults to "Ongoing" server-side. */
  reviewStatus?: string;
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

function toReviewStatus(s: string | undefined): Intent["reviewStatus"] {
  return s === "Acknowledged" || s === "Flagged" ? s : "Ongoing";
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
    reviewStatus: toReviewStatus(i.reviewStatus),
  };
}

export async function fetchIntents(page = 1): Promise<Intent[]> {
  const res = await apiRequest<PagedIntents>("/intent-list", { query: { page } });
  return (res.intentsList || []).map(mapIntent);
}

interface ApiUpdateIntentStatusResult {
  intentID: string;
  reviewStatus: string;
}

/** POST /update-intent-status. Not enforced one-directional server-side — any of the three values can be set at any time. */
export async function updateIntentStatus(
  intentID: string,
  status: Intent["reviewStatus"],
): Promise<{ intentID: string; reviewStatus: Intent["reviewStatus"] }> {
  const res = await apiRequest<ApiUpdateIntentStatusResult>("/update-intent-status", {
    method: "POST",
    body: { intentID, status },
  });
  return { intentID: res.intentID, reviewStatus: toReviewStatus(res.reviewStatus) };
}

export interface PagedIntentsResult {
  items: Intent[];
  total: number;
  page: number;
  totalPages: number;
  pageSize: number;
}

export async function fetchIntentsPaged(page = 1): Promise<PagedIntentsResult> {
  const res = await apiRequest<PagedIntents>("/intent-list", { query: { page } });
  const items = await Promise.all((res.intentsList || []).map(mapIntent).map(enrichIntentApps));
  return {
    items,
    total: res.total || 0,
    page: res.page || page,
    totalPages: res.totalPages || 1,
    pageSize: res.pageSize || 10,
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

export async function fetchSeries(range: "24h" | "7d" | "30d"): Promise<TimeSeries> {
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
function dummySeries(range: "24h" | "7d" | "30d"): TimeSeries {
  const ix: DummyInteractionForSeries[] = (dummy.intents as Array<{ interactions: DummyInteractionForSeries[] }>)
    .flatMap((i) => i.interactions);

  const buckets = range === "24h" ? 24 : range === "7d" ? 7 : 30;
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
    : range === "7d"
    ? [42, 51, 48, 63, 70, 58, 66]
    : [38, 42, 45, 50, 48, 55, 60, 58, 63, 66, 70, 68, 72, 75, 71, 69, 74, 78, 76, 80, 77, 73, 68, 65, 70, 74, 72, 76, 80, 78];
  const threatBaseline = range === "24h"
    ? [0, 0, 0, 0, 0, 0, 1, 1, 2, 2, 2, 3, 3, 4, 4, 3, 2, 2, 1, 1, 0, 0, 0, 0]
    : range === "7d"
    ? [3, 5, 4, 6, 7, 5, 4]
    : [2, 3, 2, 4, 3, 5, 4, 3, 5, 6, 5, 4, 6, 7, 5, 4, 6, 7, 5, 6, 4, 3, 5, 4, 6, 5, 4, 6, 7, 5];

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
  /** Distinct count of apps this agent has interacted with. */
  appsInteracted?: number;
  /** Names of the apps counted in `appsInteracted`. */
  appsList?: string[];
  revoked?: boolean;
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
      connected: r.appsInteracted ?? 0,
      appsList: r.appsList || [],
      status: r.totalThreats > 5 ? "warn" : "safe",
      env: r.orgID || "",
      owner: r.deployerDID || "",
      policy: r.policy || "",
      revoked: !!r.revoked,
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
  reviewStatus?: string;
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

  // "Owner" is the sender of the intent's very first interaction, not the
  // top-level initiatorDID/initiatorName — those two can disagree (e.g. the
  // human user who kicked things off vs. the first agent in the chain), and
  // the Intent page's Owner card should reflect who actually triggered it.
  const firstInteraction = r.interactions?.[0];
  const ownerDID = firstInteraction?.from || r.initiatorDID;
  const ownerName = firstInteraction?.fromName || r.initiatorName;

  // Wait for the org directory before classifying — otherwise a request that
  // races ahead of DirectoryProvider's initial load falls back to the
  // DID-prefix heuristic, which misclassifies tools as agents. See
  // directoryCache.ts for the full story.
  await waitForDirectoryReady();

  const initiatorDID = (ownerDID ?? "").trim().toLowerCase();
  const agentDids = new Set<string>();
  const toolDids = new Set<string>();
  for (const ix of allInteractions) {
    const fromId = ix.initiator.id.trim().toLowerCase();
    const toId = ix.target.id.trim().toLowerCase();
    if (fromId && fromId !== initiatorDID) {
      if (classifyParticipant(ix.initiator.id) === "agent") agentDids.add(ix.initiator.id);
      else toolDids.add(ix.initiator.id);
    }
    if (toId && toId !== initiatorDID) {
      if (classifyParticipant(ix.target.id) === "agent") agentDids.add(ix.target.id);
      else toolDids.add(ix.target.id);
    }
  }

  return mapIntent({
    intentID: r.intentID,
    initiatorDID: ownerDID,
    initiatorName: ownerName,
    startedAt: r.startedAt,
    endedAt: r.endedAt,
    status: r.status,
    threatDetected: r.threatDetected,
    agentsCount: agentDids.size,
    toolsCount: toolDids.size,
    interactionsCount: firstPage.total,
    provenanceRecordID: r.provenanceRecordID ?? "",
    reviewStatus: r.reviewStatus,
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

/**
 * List endpoints don't return which apps an intent touched, and /agent-intents
 * specifically doesn't reliably populate `interactionsCount` either (it comes
 * back 0 far more often than an intent actually has interactions). Recompute
 * both from the intent's own interaction list — the same authoritative source
 * the intent detail page uses — so every intent table agrees with it.
 */
async function enrichIntentApps(intent: Intent): Promise<Intent> {
  try {
    const [firstPage] = await Promise.all([
      fetchIntentInteractionsPaged(intent.id, 1),
      // See directoryCache.ts — without this, a request racing ahead of
      // DirectoryProvider's initial load misclassifies tools as agents via
      // the DID-prefix fallback, silently dropping them from "apps
      // interacted" (the intermittent "icons sometimes don't load" bug).
      waitForDirectoryReady(),
    ]);
    const apps = new Map<string, { id: string; name: string }>();
    for (const ix of firstPage.interactions) {
      if (classifyParticipant(ix.initiator.id) === "tool") apps.set(ix.initiator.id, ix.initiator);
      if (classifyParticipant(ix.target.id) === "tool") apps.set(ix.target.id, ix.target);
    }
    return { ...intent, interactionsCount: firstPage.total, appsInteracted: Array.from(apps.values()) };
  } catch {
    return intent;
  }
}

export async function fetchAgentIntents(id: string, page = 1): Promise<Intent[]> {
  try {
    const res = await apiRequest<PagedIntents>("/agent-intents", { query: { agentDID: id, page } });
    const intents = (res.intentsList || []).map(mapIntent);
    return await Promise.all(intents.map(enrichIntentApps));
  } catch {
    return [];
  }
}

// ============ Agent ↔ Tool links (GET /agent-lhi-scores) ============

/** A policy file governing one agent's use of one tool. Either raw text or a hosted file (e.g. PDF). */
export interface ToolPolicyFile {
  filename?: string;
  /** Raw .md/.txt content, when the policy is plain text. */
  content?: string;
  /** Hosted file URL (e.g. a PDF) to view/download, when the policy isn't plain text. */
  url?: string;
  uploadedAt?: string;
}

/** One row of an agent's "Tools" tab — this agent's trust relationship with one callee (LHI scoring). */
export interface AgentToolLink {
  /** Same as toolID/toolName — /agent-lhi-scores has no separate id, callee_name is the only key. */
  id: string;
  toolID: string;
  toolName: string;
  /** Raw callee_type from the backend ("tool", possibly "agent" for agent-to-agent trust edges). */
  calleeType: string;
  /** 0-100, from `trust`. */
  trustScore: number;
  /** 0-100, from `intent_score`. */
  intentScore: number;
  /** 0-100, from `policy_score`. */
  policyScore: number;
  /** 0-100, from `hallucination_score`. */
  hallucinationScore: number;
  /** /agent-lhi-scores has no policy data at all — always undefined until a real source exists. */
  policyFile?: ToolPolicyFile;
  /** Minutes since this score record's created_at — the closest thing to "last interacted" this endpoint has. */
  lastInteracted: number;
}

interface ApiLHIScoreEntry {
  callee_name: string;
  callee_type: string;
  intent_score: number;
  policy_score: number;
  hallucination_score: number;
  trust: number;
  created_at: string;
}

interface ApiAgentLHIScores {
  agentDID: string;
  scores: ApiLHIScoreEntry[];
}

/** Clamp to [0,1] before scaling — a slightly out-of-range score shouldn't render as e.g. 130 or -20. */
function scorePct(v: number): number {
  return Math.round(Math.max(0, Math.min(1, v)) * 100);
}

function mapAgentToolLink(e: ApiLHIScoreEntry): AgentToolLink {
  return {
    id: e.callee_name,
    toolID: e.callee_name,
    toolName: e.callee_name,
    calleeType: e.callee_type,
    trustScore: scorePct(e.trust),
    intentScore: scorePct(e.intent_score),
    policyScore: scorePct(e.policy_score),
    hallucinationScore: scorePct(e.hallucination_score),
    lastInteracted: isoToMinutesAgo(e.created_at),
  };
}

/**
 * GET /agent-lhi-scores?agentDID=... — no pagination, returns every trust
 * edge for the agent at once. Filtered to callee_type "tool" since this
 * feeds the Tools tab specifically (agent-to-agent edges, if any come back,
 * belong elsewhere).
 */
export async function fetchAgentTools(agentDID: string): Promise<AgentToolLink[]> {
  const res = await apiRequest<ApiAgentLHIScores>("/agent-lhi-scores", { query: { agentDID } });
  return (res.scores || [])
    .filter((s) => s.callee_type === "tool")
    .map(mapAgentToolLink);
}

/**
 * The "More details" destination for one agent↔tool pairing. There's no
 * dedicated detail endpoint yet, so this re-fetches the same /agent-lhi-scores
 * list and picks out the matching callee — interaction history isn't part of
 * that payload, so it's always empty here until a real source exists.
 */
export interface AgentToolDetail extends AgentToolLink {
  interactions: Interaction[];
  interactionsTotal: number;
  interactionsTotalPages: number;
}

export async function fetchAgentToolInfo(agentId: string, toolId: string): Promise<AgentToolDetail | null> {
  try {
    const links = await fetchAgentTools(agentId);
    const match = links.find((l) => l.toolID === toolId);
    if (!match) return null;
    return { ...match, interactions: [], interactionsTotal: 0, interactionsTotalPages: 1 };
  } catch {
    return null;
  }
}

/** One row of a tool's "Agents" section — each agent's trust relationship with this tool (LHI scoring). */
export interface ToolAgentScore {
  id: string;
  agentDID: string;
  agentName: string;
  /** 0-100, from `trust`. */
  trustScore: number;
  /** 0-100, from `intentScore`. */
  intentScore: number;
  /** 0-100, from `policyScore`. */
  policyScore: number;
  /** 0-100, from `hallucinationScore`. */
  hallucinationScore: number;
}

interface ApiToolAgentScoreEntry {
  agentDID: string;
  agentName: string;
  intentScore: number;
  policyScore: number;
  hallucinationScore: number;
  trust: number;
}

interface ApiToolAgentScores {
  toolDID: string;
  toolName: string;
  agents: ApiToolAgentScoreEntry[];
}

function mapToolAgentScore(e: ApiToolAgentScoreEntry): ToolAgentScore {
  return {
    id: e.agentDID,
    agentDID: e.agentDID,
    agentName: e.agentName,
    trustScore: scorePct(e.trust),
    intentScore: scorePct(e.intentScore),
    policyScore: scorePct(e.policyScore),
    hallucinationScore: scorePct(e.hallucinationScore),
  };
}

/**
 * GET /tool-agent-scores?toolDID=... — every agent that has this tool in its
 * agents_list, batched into one LHI-scores lookup on the backend. Agents with
 * no score entry for this tool yet still come back, with all scores at 0.
 */
export async function fetchToolAgentScores(toolDID: string): Promise<ToolAgentScore[]> {
  const res = await apiRequest<ApiToolAgentScores>("/tool-agent-scores", { query: { toolDID } });
  return (res.agents || []).map(mapToolAgentScore);
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
  /**
   * New schema carries no actor-type info, so `tool_call` / `tool_response`
   * no longer exist. Only three hop kinds remain:
   *   trigger  — first hop
   *   delegate — forward to a new agent
   *   response — returning back
   */
  type: "trigger" | "delegate" | "response";
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

// ============ Search ============

export interface SearchResultAgent { did: string; name: string; orgID: string }
export interface SearchResultApp   { did: string; name: string }
export interface SearchResultIntent { intentID: string; flowType: string; status: string; threatDetected: boolean; startedAt: string }

export interface SearchResults {
  agents: SearchResultAgent[];
  apps:   SearchResultApp[];
  intents: SearchResultIntent[];
}

export async function fetchSearch(q: string): Promise<SearchResults> {
  const res = await apiRequest<SearchResults>("/search", { query: { q } });
  return res ?? { agents: [], apps: [], intents: [] };
}

// ============ Tool / App detail ============

interface ApiToolInteraction {
  interactionID: string;
  from: string;
  fromName?: string;
  to: string;
  toName?: string;
  type: string;
  threat: boolean;
  intentID: string;
  message?: string;
  signature?: string;
  provenanceRecordID?: string;
  time: string;
  /** Non-empty only when `threat` is true — pass to GET /threat-by-id for the full message. */
  threatID?: string;
}

interface ApiToolIntent {
  intentID: string;
  initiatorDID: string;
  flowType?: string;
  status?: string;
  threatDetected?: boolean;
  startedAt?: string;
  endedAt?: string;
}

interface ApiToolInfo {
  toolDID: string;
  toolName: string;
  totalInteractions: number;
  totalThreats: number;
  totalIntents: number;
  totalAgents: number;
  score: number;
  interactions: {
    list: ApiToolInteraction[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
  intents: {
    list: ApiToolIntent[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

export interface ToolDetail {
  id: string;
  name: string;
  totalInteractions: number;
  totalThreats: number;
  totalIntents: number;
  totalAgents: number;
  score: number;
}

export interface ToolDetailResult {
  tool: ToolDetail;
  interactions: Interaction[];
  interactionsTotal: number;
  interactionsTotalPages: number;
  intents: Intent[];
  intentsTotal: number;
  intentsTotalPages: number;
}

function mapToolInteraction(i: ApiToolInteraction): Interaction {
  const fromName = i.fromName?.trim() || shortDid(i.from);
  const toName = i.toName?.trim() || shortDid(i.to);
  return {
    id: i.interactionID,
    initiator: { id: i.from, name: fromName },
    target: { id: i.to, name: toName },
    targetType: "tool",
    intent: { id: i.intentID, name: "" },
    runtime: 0,
    threat: !!i.threat,
    created: isoToMinutesAgo(i.time),
    threatID: i.threatID || undefined,
  };
}

function mapToolIntent(i: ApiToolIntent): Intent {
  return {
    id: i.intentID,
    name: i.intentID,
    initiator: { id: i.initiatorDID, name: shortDid(i.initiatorDID) } as Agent,
    runtime: 0,
    started: i.startedAt ? isoToMinutesAgo(i.startedAt) : 0,
    agentsInteracted: 0,
    toolsInteracted: 0,
    interactionsCount: 0,
    threats: i.threatDetected ? 1 : 0,
    score: i.threatDetected ? 0 : 100,
    status: (i.status as Agent["status"]) || "safe",
    provenanceRecordID: "",
    reviewStatus: "Ongoing",
  };
}

// ─── User detail ─────────────────────────────────────────────────────────────

interface ApiUserIntent {
  intentID: string;
  initiatorDID: string;
  initiatorName?: string;
  flowType?: string;
  status?: string;
  threatDetected?: boolean;
  threatCount?: number;
  startedAt?: string;
  endedAt?: string;
  runtimeSeconds?: number;
  agentsCount?: number;
  toolsCount?: number;
  interactionsCount?: number;
  chainDepth?: number;
  executor?: string;
  firstInteractionAt?: string | null;
  lastInteractionAt?: string | null;
  reviewStatus?: string;
}

function mapUserIntent(i: ApiUserIntent): Intent {
  return {
    id: i.intentID,
    name: i.intentID,
    initiator: { id: i.initiatorDID, name: i.initiatorName || shortDid(i.initiatorDID) } as Agent,
    runtime: (i.runtimeSeconds || 0) * 1000,
    started: i.startedAt ? isoToMinutesAgo(i.startedAt) : 0,
    agentsInteracted: i.agentsCount || 0,
    toolsInteracted: i.toolsCount || 0,
    interactionsCount: i.interactionsCount || 0,
    threats: i.threatCount ?? (i.threatDetected ? 1 : 0),
    score: i.threatDetected ? 0 : 100,
    status: (i.status as Agent["status"]) || "safe",
    provenanceRecordID: "",
    reviewStatus: toReviewStatus(i.reviewStatus),
  };
}

interface ApiUserInfo {
  user: {
    userID: string;
    userName: string;
    displayName?: string;
    createdAt: string;
    lastActive: string | null;
    isActive: boolean;
    accessAgentCount: number;
    totalInteractions: number;
    totalThreats: number;
    totalIntents: number;
    totalAgentsDeployed: number;
  };
  interactions: { list: ApiToolInteraction[]; total: number; page: number; pageSize: number; totalPages: number };
  intents: { list: ApiUserIntent[]; total: number; page: number; pageSize: number; totalPages: number };
  threats: { list: ApiToolInteraction[]; total: number; page: number; pageSize: number; totalPages: number };
  agents: {
    list: {
      agentDID: string;
      agentName: string;
      created: number;
      totalInteractions: number;
      totalThreats: number;
      status: "active" | "warn" | "inactive";
    }[];
    total: number; page: number; pageSize: number; totalPages: number;
  };
}

export interface UserDetail {
  userID: string;
  userName: string;
  displayName?: string;
  createdMinsAgo: number;    // minutes since createdAt
  lastActiveMinsAgo: number; // minutes since lastActive, 0 if null
  isActive: boolean;
  accessAgentCount: number;
  totalInteractions: number;
  totalThreats: number;
  totalIntents: number;
  totalAgentsDeployed: number;
}

export interface DeployedAgent {
  id: string;
  name: string;
  created: number;
  interactions: number;
  threats: number;
  status: "active" | "warn" | "inactive";
}

export interface UserDetailResult {
  user: UserDetail;
  interactions: Interaction[];
  interactionsTotal: number;
  interactionsTotalPages: number;
  intents: Intent[];
  intentsTotal: number;
  intentsTotalPages: number;
  threats: Interaction[];
  threatsTotal: number;
  threatsTotalPages: number;
  agents: DeployedAgent[];
  agentsTotal: number;
  agentsTotalPages: number;
}

export async function fetchUserInfo(
  userID: string,
  interactionsPage = 1,
  intentsPage = 1,
  threatsPage = 1,
  agentsPage = 1,
): Promise<UserDetailResult | null> {
  try {
    const r = await apiRequest<ApiUserInfo>("/user-info", {
      query: { userID, interactionsPage, intentsPage, threatsPage, agentsPage },
    });
    const u = r.user;
    return {
      user: {
        userID: u.userID,
        userName: u.userName,
        displayName: u.displayName,
        createdMinsAgo: isoToMinutesAgo(u.createdAt),
        lastActiveMinsAgo: isoToMinutesAgo(u.lastActive),
        isActive: !!u.isActive,
        accessAgentCount: u.accessAgentCount || 0,
        totalInteractions: u.totalInteractions || 0,
        totalThreats: u.totalThreats || 0,
        totalIntents: u.totalIntents || 0,
        totalAgentsDeployed: u.totalAgentsDeployed || 0,
      },
      interactions: (r.interactions?.list || []).map(mapToolInteraction),
      interactionsTotal: r.interactions?.total || 0,
      interactionsTotalPages: r.interactions?.totalPages || 1,
      intents: (r.intents?.list || []).map(mapUserIntent),
      intentsTotal: r.intents?.total || 0,
      intentsTotalPages: r.intents?.totalPages || 1,
      threats: (r.threats?.list || []).map(mapToolInteraction),
      threatsTotal: r.threats?.total || 0,
      threatsTotalPages: r.threats?.totalPages || 1,
      agents: (r.agents?.list || []).map((a) => ({
        id: a.agentDID,
        name: a.agentName,
        created: a.created,
        interactions: a.totalInteractions || 0,
        threats: a.totalThreats || 0,
        status: a.status,
      })),
      agentsTotal: r.agents?.total || 0,
      agentsTotalPages: r.agents?.totalPages || 1,
    };
  } catch {
    return null;
  }
}

export async function fetchToolInfo(
  nameOrDid: string,
  interactionsPage = 1,
  intentsPage = 1,
): Promise<ToolDetailResult | null> {
  try {
    const isDid = nameOrDid.startsWith("bafy") || nameOrDid.includes("did:");
    const query: Record<string, string | number> = {
      interactionsPage,
      intentsPage,
    };
    if (isDid) query.toolDID = nameOrDid;
    else query.name = nameOrDid;

    const r = await apiRequest<ApiToolInfo>("/tool-info", { query });
    return {
      tool: {
        id: r.toolDID,
        name: r.toolName,
        totalInteractions: r.totalInteractions,
        totalThreats: r.totalThreats,
        totalIntents: r.totalIntents,
        totalAgents: r.totalAgents || 0,
        score: r.score,
      },
      interactions: (r.interactions?.list || []).map(mapToolInteraction),
      interactionsTotal: r.interactions?.total || 0,
      interactionsTotalPages: r.interactions?.totalPages || 1,
      intents: (r.intents?.list || []).map(mapToolIntent),
      intentsTotal: r.intents?.total || 0,
      intentsTotalPages: r.intents?.totalPages || 1,
    };
  } catch {
    return null;
  }
}
