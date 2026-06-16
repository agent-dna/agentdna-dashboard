import { apiRequest, ApiError } from "./client";

// ── Existing user login (original backend, unchanged) ──────────────────────

export interface LoginResponse {
  token: string;
  did: string;
  email: string;
  org_id: string;
  api_key: string;
  nft_id?: string;
  is_admin: boolean;
  agent_access_list?: string[];
}

export function login(email: string, password: string): Promise<LoginResponse> {
  return apiRequest<LoginResponse>("/login", {
    method: "POST",
    body: { email, password },
    auth: false,
  });
}

// ── Admin auth — /agent-admin/v1 base ─────────────────────────────────────
// Response shapes per README:
//   POST /login           → { status, message, data: <jwt string> }
//   POST /register-admin  → { status, message, data: null }  (message = DID)

const ADMIN_BASE = (
  (import.meta.env.VITE_ADMIN_API_BASE_URL as string | undefined) ||
  "http://localhost:8000/agent-admin/v1"
).replace(/\/$/, "");

interface AdminRawResponse {
  status: boolean;
  message: string;
  data: unknown;
}

async function adminFetch(path: string, body: unknown): Promise<AdminRawResponse> {
  const res = await fetch(`${ADMIN_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  let payload: AdminRawResponse;
  try {
    payload = (await res.json()) as AdminRawResponse;
  } catch {
    throw new ApiError(`Invalid JSON response (HTTP ${res.status})`, res.status);
  }
  if (!payload.status) {
    throw new ApiError(payload.message || `HTTP ${res.status}`, res.status);
  }
  return payload;
}

/** POST /agent-admin/v1/login — returns the JWT string */
export async function adminLogin(username: string, password: string): Promise<string> {
  const res = await adminFetch("/login", { username, password });
  return res.data as string;
}

/** POST /agent-admin/v1/register-admin — returns the new admin's DID */
export interface AdminRegisterBody {
  username: string;
  org: string;
  password: string;
}

export async function adminRegister(body: AdminRegisterBody): Promise<{ did: string }> {
  const res = await adminFetch("/register-admin", body);
  // On success, message contains the DID; data is null
  return { did: res.message };
}

/**
 * POST /register-admin (user server / middleware)
 * Called after admin-server registration to whitelist the DID in new_admins table.
 * Public endpoint — no JWT needed.
 */
export function registerAdminMiddleware(did: string, org_id: string): Promise<{ did: string; org_id: string }> {
  return apiRequest<{ did: string; org_id: string }>("/register-admin", {
    method: "POST",
    body: { did, org_id },
    auth: false,
  });
}
