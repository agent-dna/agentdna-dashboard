export type Status = "safe" | "warn" | "threat";

export interface Agent {
  id: string;
  name: string;
  score: number;
  created: number;
  interactions: number;
  threats: number;
  /** Distinct count of apps interacted with. From /agent-info's `appsInteracted`; 0 for endpoints that don't return it. */
  connected: number;
  /** Names of the apps counted in `connected`. Only populated by /agent-info. */
  appsList?: string[];
  status: Status;
  env: string;
  owner: string;
  /** Deployer's display name. Only /agent-info returns it, and it can be blank. */
  ownerName?: string;
  /** Raw .md/.txt policy text from /agent-info; empty string when no policy uploaded. */
  policy?: string;
  /** From /agent-info's `revoked` field. Only /agent-info returns this — false for endpoints that don't. */
  revoked?: boolean;
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
  /** Total interactions in this intent (from /intent-list). 0 when unknown. */
  interactionsCount: number;
  threats: number;
  score: number;
  status: Status;
  signature?: string;
  /** Distinct apps/tools this intent's interactions touched. Only populated where explicitly computed (e.g. an agent's own intents list). */
  appsInteracted?: EntityRef[];
  /** Human review state — separate from the pipeline `status` field. Defaults to "Unreviewed" server-side. */
  reviewStatus: IntentReviewStatus;
}

export type IntentReviewStatus = "Unreviewed" | "Acknowledged" | "Flagged";

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
  /** Backend-supplied block type (e.g. on-chain block category). Optional. */
  blockType?: string;
  /** Non-empty only when `threat` is true — pass to GET /threat-by-id for the full message. */
  threatID?: string;
  /** Resolved threat message, when the caller already has it (e.g. from /threats-list) — skips the GET /threat-by-id lookup in the drawer. */
  message?: string;
  /**
   * The sender's original envelope for this hop, exactly as the agent sent it (from /intent-info's
   * `rawData`; earlier envelopes nest in `parent_envelope`). Shown as the interaction's raw data.
   */
  raw?: unknown;
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
  appCount: number;
  intentCount: number;
  interactionsCount: number;
  threatCount: number;
  page: number;
  agentList: HomeAgentSummary[];
  // 24-hour changes
  agentCount24hChange?: number;
  appCount24hChange?: number;
  intentCount24hChange?: number;
  interactionsCount24hChange?: number;
  threatCount24hChange?: number;
  /**
   * Intents with a threat whose review status isn't "Acknowledged" (missing counts as Unreviewed);
   * clean intents are never counted. Org-wide for admins, the user's visible intents otherwise.
   * Ignores `page`. Drives the sidebar badge on Intents.
   */
  unacknowledgedTotal?: number;
}

export interface PublicMetrics {
  totalUsers: number;
  totalAgents: number;
  totalInteractions: number;
  totalIntents: number;
  totalThreats: number;
}
