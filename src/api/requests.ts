import { apiRequest, apiUpload } from "./client";

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
  agentID?: string;
  requestInfo?: string;
  /** Policy file (.md / .txt). Sent as multipart "policy" field. */
  policyFile?: File;
  /** Fallback when no file is picked: server accepts plaintext in the "policy" field. */
  policyText?: string;
}

export function createAgentRequest(body: CreateAgentRequestBody): Promise<{ requestID: string }> {
  const name = (body.agentName || "").trim();
  if (!name) {
    return Promise.reject(new Error("agentName is required"));
  }
  const fd = new FormData();
  fd.append("agentName", name);
  if (body.agentID && body.agentID.trim()) fd.append("agentID", body.agentID.trim());
  if (body.requestInfo && body.requestInfo.trim()) fd.append("requestInfo", body.requestInfo.trim());
  if (body.policyFile) {
    fd.append("policy", body.policyFile);
  } else if (body.policyText && body.policyText.trim()) {
    fd.append("policy", body.policyText.trim());
  }
  // Log exactly what's going on the wire so you can compare with backend expectations.
  const debug: Record<string, string> = {};
  fd.forEach((v, k) => {
    debug[k] = v instanceof File ? `<File ${v.name} (${v.size} bytes, ${v.type})>` : String(v);
  });
  console.log("[POST /agents-creation-requests-create] multipart fields:", debug);
  return apiUpload<{ requestID: string }>("/agents-creation-requests-create", fd);
}

export interface EditAgentRequestBody {
  requestID: string;
  agentName: string;
  policy: string;
  requestInfo?: string;
  agentID?: string;
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
