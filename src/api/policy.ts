import { apiRequest, apiUpload } from "./client";

export interface PolicyFile {
  /** Original filename if the backend has it (e.g. "weather.md"). */
  filename?: string;
  /** Raw policy text. */
  content: string;
  /** ISO timestamp of the last upload. */
  uploadedAt?: string;
}

/**
 * PROPOSED — fetch a user's current policy file content. Admin viewing any
 * user's policy or user viewing their own.
 * Suggested contract: `GET /user-policy?userDID=<did>`.
 *
 * (Agent policies don't need a dedicated GET — they ride along in /agent-info.)
 */
export function fetchUserPolicy(userDID: string): Promise<PolicyFile> {
  return apiRequest<PolicyFile>("/user-policy", { query: { userDID } });
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
