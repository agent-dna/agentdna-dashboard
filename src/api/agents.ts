import { apiRequest } from "./client";

/** Admin only — permanently revokes an agent via the admin server. */
export function revokeAgent(agentDID: string): Promise<null> {
  return apiRequest<null>("/revoke-agent", { method: "POST", body: { agent_did: agentDID } });
}

/** Admin only — reverses a revoke, whitelisting the agent again via the admin server. */
export function unrevokeAgent(agentDID: string): Promise<null> {
  return apiRequest<null>("/unrevoke-agent", { method: "POST", body: { agent_did: agentDID } });
}
