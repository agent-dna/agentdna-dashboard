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
    const items = res.usersList || [];
    out.push(...items);
    if (items.length === 0 || (res.totalPages && page >= res.totalPages)) break;
  }
  return out;
}

// ============ Admin: create user ============

export interface CreateUserBody {
  did: string;
  /** Optional — backend auto-assigns user_1, user_2, … when blank. */
  name?: string;
  email: string;
  password: string;
  orgID: string;
}

export interface CreateUserResponse {
  did: string;
  name: string;
  email: string;
  orgID: string;
}

/** Admin only — `nft_id` and `api_key` are auto-generated server-side. */
export function addUser(body: CreateUserBody): Promise<CreateUserResponse> {
  return apiRequest<CreateUserResponse>("/create-user", { method: "POST", body });
}

// ============ Proposed (backend not implemented yet) ============

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
