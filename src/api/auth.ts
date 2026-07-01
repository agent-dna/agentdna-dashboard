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

/** POST /send-otp — public, triggers OTP email before registration */
export function sendOtp(email: string): Promise<{ message: string }> {
  return apiRequest<{ message: string }>("/send-otp", {
    method: "POST",
    body: { email },
    auth: false,
  });
}

export interface AdminRegisterBody {
  username: string;
  email: string;
  org: string;
  password: string;
  otp: string;
}

export function adminRegister(body: AdminRegisterBody): Promise<{ did: string }> {
  return apiRequest<{ did: string }>("/create-admin", {
    method: "POST",
    body,
    auth: false,
  });
}

export interface RegisterUserBody {
  name?: string;
  email: string;
  password: string;
  orgID: string;
  otp: string;
}

export interface RegisterUserResponse {
  api_key: string;
  name: string;
  email: string;
  orgID: string;
}

export function registerUser(body: RegisterUserBody): Promise<RegisterUserResponse> {
  return apiRequest<RegisterUserResponse>("/signup", {
    method: "POST",
    body,
    auth: false,
  });
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
