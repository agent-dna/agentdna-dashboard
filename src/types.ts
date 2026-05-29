export type Status = "safe" | "warn" | "threat";

export interface Agent {
  id: string;
  name: string;
  score: number;
  created: number;
  interactions: number;
  threats: number;
  connected: number;
  status: Status;
  env: string;
  owner: string;
  /** Raw .md/.txt policy text from /agent-info; empty string when no policy uploaded. */
  policy?: string;
}

export interface Tool {
  id: string;
  name: string;
  score: number;
  created: number;
  interactions: number;
  threats: number;
  connected: number;
  status: Status;
  scope: string;
  provider: string;
}

export interface Intent {
  id: string;
  name: string;
  initiator: Agent;
  runtime: number;
  started: number;
  agentsInteracted: number;
  toolsInteracted: number;
  threats: number;
  score: number;
  status: Status;
}

export type EntityRef = Pick<Agent | Tool, "id" | "name">;

export interface Interaction {
  id: string;
  initiator: EntityRef;
  target: EntityRef;
  targetType: "agent" | "tool";
  intent: Pick<Intent, "id" | "name">;
  runtime: number;
  threat: boolean;
  created: number;
}

export interface TimeSeries {
  total: number[];
  safe: number[];
  threats: number[];
}

export interface HeatmapRow {
  id: string;
  label: string;
  cells: number[];
}

export type LogLevel = "info" | "warn" | "error" | "debug";

export interface LogEntry {
  id: string;
  ts: number;
  level: LogLevel;
  message: string;
  source: string;
}

export interface IntentParticipant {
  entity: EntityRef & { score: number };
  type: "agent" | "tool";
  count: number;
  threats: number;
  lastSeen: number;
}

export interface HomeAgentSummary {
  agentID: string;
  agentName: string;
  totalInteractions: number;
  totalThreats: number;
}

export interface HomeMetrics {
  agentCount: number;
  intentCount: number;
  interactionsCount: number;
  threatCount: number;
  page: number;
  agentList: HomeAgentSummary[];
}
