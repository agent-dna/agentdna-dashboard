import { apiRequest } from "./client";

export type RequestType = "deploy_agent" | "agent_access";
export type RequestStatus = "pending" | "approved" | "rejected";

export interface AgentRequest {
  requestID: string;
  requestType: RequestType;
  policy: string;
  creatorDID: string;
  agentDID: string;
  agentName: string;
  requestInfo: string;
  status: RequestStatus;
  createdAt: string;
}

export interface PagedRequests {
  requestsList: AgentRequest[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ============ Agent Creation Requests ============

export function listAgentCreationRequests(page = 1): Promise<PagedRequests> {
  return apiRequest<PagedRequests>("/agents-creation-requests-list", { query: { page } });
}

export interface CreateAgentRequestBody {
  agentName: string;
  policy: string;
  requestInfo?: string;
}

export function createAgentRequest(body: CreateAgentRequestBody): Promise<{ requestID: string }> {
  return apiRequest<{ requestID: string }>("/agents-creation-requests-create", {
    method: "POST",
    body,
  });
}

export interface EditAgentRequestBody {
  requestID: string;
  agentName: string;
  policy: string;
  requestInfo?: string;
}

export function editAgentRequest(body: EditAgentRequestBody): Promise<{ requestID: string }> {
  return apiRequest<{ requestID: string }>("/agents-creation-requests-edit", {
    method: "POST",
    body,
  });
}

export function submitAgentCreationResult(
  requestID: string,
  status: "approved" | "rejected",
): Promise<{ requestID: string; status: RequestStatus }> {
  return apiRequest("/agent-creation-request-result-submit", {
    method: "POST",
    body: { requestID, status },
  });
}

// ============ Agent Access Requests ============

export function listAccessRequestsForOrg(page = 1): Promise<PagedRequests> {
  return apiRequest<PagedRequests>("/agent-access-requests-list-org", { query: { page } });
}

export function listAccessRequestsForUser(page = 1): Promise<PagedRequests> {
  return apiRequest<PagedRequests>("/agent-access-requests-list-user", { query: { page } });
}

export function submitAccessRequestResult(
  requestID: string,
  status: "approved" | "rejected",
): Promise<{ requestID: string; status: RequestStatus }> {
  return apiRequest("/agent-access-request-submit", {
    method: "POST",
    body: { requestID, status },
  });
}

/** PROPOSED — user submits a new agent-access request */
export interface CreateAccessRequestBody {
  agentDID: string;
  agentName?: string;
  requestInfo?: string;
}

export function createAccessRequest(body: CreateAccessRequestBody): Promise<{ requestID: string }> {
  return apiRequest<{ requestID: string }>("/agent-access-request-create", {
    method: "POST",
    body,
  });
}
