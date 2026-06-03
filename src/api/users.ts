import { apiRequest } from "./client";

// ============ Org users ============

export interface OrgUser {
  userID: string;
  userName: string; // email
  createdAt: string;
  totalIntents: number;
  totalThreats: number;
  accessAgentCount: number;
}

export interface PagedUsers {
  usersList: OrgUser[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export function listUsers(page = 1): Promise<PagedUsers> {
  return apiRequest<PagedUsers>("/users-list", { query: { page } });
}

/** Walk every page of /users-list — used by the DID→name directory. */
export async function listAllUsers(): Promise<OrgUser[]> {
  const out: OrgUser[] = [];
  for (let page = 1; page <= 200; page++) {
    const res = await listUsers(page);
    console.log(`[GET /users-list?page=${page}]`, res);
    const items = res.usersList || [];
    out.push(...items);
    if (items.length === 0 || (res.totalPages && page >= res.totalPages)) break;
  }
  return out;
}

// ============ Proposed (backend not implemented yet) ============

/** PROPOSED — admin creates a user with email + password (bcrypt-hashed server-side) */
export function addUser(body: { email: string; password: string }): Promise<{ userID: string }> {
  return apiRequest<{ userID: string }>("/admin-add-user", { method: "POST", body });
}

/** PROPOSED — returns the full agent_access_list for a user (admin only) */
export function getUserAccessList(userDID: string): Promise<{ agentAccessList: string[] }> {
  return apiRequest<{ agentAccessList: string[] }>("/user-access-list", { query: { userDID } });
}

/** PROPOSED — admin grants a user access to an agent */
export function grantAgentAccess(body: { userDID: string; agentDID: string }): Promise<unknown> {
  return apiRequest("/admin-grant-agent-access", { method: "POST", body });
}

/** PROPOSED — admin revokes a user's access to an agent */
export function revokeAgentAccess(body: { userDID: string; agentDID: string }): Promise<unknown> {
  return apiRequest("/admin-revoke-agent-access", { method: "POST", body });
}
