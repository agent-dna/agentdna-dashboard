import { apiRequest } from "./client";

/**
 * Observability · Interaction plane endpoints (middleware `/observability-*`).
 * Contract: docs/observability-api.md §4.
 */

export type ObsRange = "24h" | "7d" | "30d";
export type ObsStatus = "all" | "risk" | "flagged";
export type ObsOutcome = "allowed" | "elevated" | "flagged";
export type ObsWallResult = "pass" | "fail" | "review" | "not_tracked";

export interface ObsWallStats {
  checks: number;
  pass: number;
  fail: number;
  passRate: number;
}

export interface ObsSummary {
  range: ObsRange;
  identities: number;
  agents: number;
  apps: number;
  toolInteractions: number;
  gates: {
    gate1Coca: ObsWallStats;
    gate2Coca: ObsWallStats;
    gate2Cbac: (ObsWallStats & { review: number }) | null;
    gate2Whitelist: ObsWallStats;
  };
}

export interface ObsGateEdge {
  from: string;
  to: string;
  count: number;
  allowed: number;
  elevated: number;
  flagged: number;
  outcome: ObsOutcome;
  lastAt: string;
  policies: string[];
  /** Agent → app edges only. */
  walls?: {
    coca: { pass: number; fail: number };
    cbac: { pass: number; fail: number; review: number } | null;
    whitelist: { pass: number; fail: number };
  };
}

export interface ObsGraph {
  agents: { agentDID: string; agentName: string; handle: string; usersCount: number; revoked: boolean }[];
  apps: { appDID: string; appName: string; operation: string }[];
  agentAppEdges: ObsGateEdge[];
}

export interface ObsUser {
  userDID: string;
  userName: string;
  email: string;
  subtitle: string;
  kind: "human" | "service";
  signed: boolean;
  lastActiveAt: string;
  agentEdges: ObsGateEdge[];
}

interface Paged {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ObsUsersPage extends Paged {
  usersList: ObsUser[];
}

export interface ObsUserFlow {
  userDID: string;
  agentEdges: ObsGateEdge[];
  agentAppEdges: ObsGateEdge[];
}

export interface ObsIntent {
  intentID: string;
  intentTitle: string;
  outcome: ObsOutcome;
  policy: string | null;
  flags: number;
  interactionsCount: number;
  appDIDs: string[];
  startedAt: string;
  lastAt: string;
  reviewStatus: string;
}

export interface ObsIntentsPage extends Paged {
  intentsList: ObsIntent[];
}

export interface ObsPath {
  user: { did: string; name: string };
  agent: { did: string; name: string };
  app: { did: string; name: string } | null;
  intent: { id: string; title: string } | null;
  gate1: { result: "pass" | "fail"; count: number };
  gate2: {
    coca: { result: ObsWallResult; count: number };
    cbac: { result: ObsWallResult; count: number };
    whitelist: { result: ObsWallResult; count: number };
  } | null;
  interactionsCount: number;
  outcome: ObsOutcome;
  policy: string | null;
}

export interface ObsPathsPage extends Paged {
  pathsList: ObsPath[];
}

export interface ObsScope {
  range: ObsRange;
  status: ObsStatus;
}

export interface ObsPathFilter {
  userDID?: string;
  agentDID?: string;
  appDID?: string;
  intentID?: string;
}

export const fetchObsSummary = (s: ObsScope) =>
  apiRequest<ObsSummary>("/observability-summary", { query: { ...s } });

export const fetchObsGraph = (s: ObsScope) =>
  apiRequest<ObsGraph>("/observability-graph", { query: { ...s } });

export const fetchObsUsers = (s: ObsScope, page: number, pageSize = 50, search?: string) =>
  apiRequest<ObsUsersPage>("/observability-users", { query: { ...s, page, pageSize, search } });

export const fetchObsUserFlow = (s: ObsScope, userDID: string) =>
  apiRequest<ObsUserFlow>("/observability-user-flow", { query: { ...s, userDID } });

export const fetchObsIntents = (s: ObsScope, userDID: string, agentDID: string, pageSize = 30) =>
  apiRequest<ObsIntentsPage>("/observability-intents", { query: { ...s, userDID, agentDID, page: 1, pageSize } });

export const fetchObsPaths = (s: ObsScope, f: ObsPathFilter, pageSize = 50) =>
  apiRequest<ObsPathsPage>("/observability-paths", { query: { ...s, ...f, page: 1, pageSize } });
