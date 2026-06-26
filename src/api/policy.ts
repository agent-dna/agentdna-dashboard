import { apiRequest, apiUpload } from "./client";

export interface PolicyFile {
  /** Original filename if the backend has it (e.g. "weather.md"). */
  filename?: string;
  /** Raw policy text. */
  content: string;
  /** ISO timestamp of the last upload. */
  uploadedAt?: string;
}

export function fetchUserPolicy(userDID: string): Promise<PolicyFile> {
  return apiRequest<PolicyFile>("/user-policy", { query: { userDID } });
}

/** A lightweight entry in an agent's policy history — no policy content. */
export interface PolicyHistoryEntry {
  updateID: string;
  /** Epoch seconds. */
  time: number;
}

export interface PolicyHistory {
  agentDID?: string;
  nftID?: string;
  history: PolicyHistoryEntry[];
}

export function fetchAgentPolicyHistory(agentDID: string): Promise<PolicyHistory> {
  return apiRequest<PolicyHistory>("/agent-policy-history", { query: { agentDID } });
}

/** Full policy content for one update in the history. */
export interface PolicyUpdate {
  updateID: string;
  time: number;
  policy: string;
}

export function fetchAgentPolicyUpdate(agentDID: string, updateID: string): Promise<PolicyUpdate> {
  return apiRequest<PolicyUpdate>("/agent-policy-update", { query: { agentDID, updateID } });
}


/**
 * Upload a user policy file (.md or .txt).
 *
 * NOTE: the documented endpoint contract is `{ file }` only. We send `userDID`
 * as an additional multipart field because the admin's JWT identifies the
 * admin, not the target user. Confirm the backend accepts/uses this field, or
 * tell me which identifier it expects (e.g. email, lastCreatedUser, etc.).
 */
export function uploadUserPolicy(userDID: string, file: File): Promise<unknown> {
  const fd = new FormData();
  fd.append("userDID", userDID);
  fd.append("file", file);
  return apiUpload("/upload-user-policy", fd);
}

/** Upload an agent policy file (.md or .txt). Admin only. */
export function uploadAgentPolicy(agentDID: string, file: File): Promise<unknown> {
  const fd = new FormData();
  fd.append("agentDID", agentDID);
  fd.append("file", file);
  return apiUpload("/upload-agent-policy", fd);
}
