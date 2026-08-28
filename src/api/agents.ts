import { apiRequest } from "./client";

/** Admin only — permanently revokes an agent via the admin server. */
export function revokeAgent(agentDID: string): Promise<null> {
  return apiRequest<null>("/revoke-agent", { method: "POST", body: { agent_did: agentDID } });
}
