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
  return apiRequest<LoginResponse>("agent-admin/v1/login", {
    method: "POST",
    body: { email, password },
    auth: false,
  });
}

// ── Admin auth — /agent-admin/v1 base ─────────────────────────────────────
// Response shapes per README:
//   POST /login           → { status, message, data: <jwt string> }
//   POST /register-admin  → { status, message, data: null }  (message = DID)

// No localhost fallback on purpose — same reasoning as BASE in client.ts: a
// deployed build with a missing VITE_ADMIN_API_BASE_URL should fail loudly
// (see the guard in adminFetch below), not silently point at whoever's
// machine happens to be running the browser.
const ADMIN_BASE = (
  (import.meta.env.VITE_ADMIN_API_BASE_URL as string | undefined) || ""
).replace(/\/$/, "");

interface AdminRawResponse {
  status: boolean;
  message: string;
  data: unknown;
}

async function adminFetch(path: string, body: unknown): Promise<AdminRawResponse> {
  if (!ADMIN_BASE) {
    throw new ApiError(
      "Admin API base URL is not configured (VITE_ADMIN_API_BASE_URL is missing) — nothing to send this request to.",
      0,
    );
  }
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

/** POST /forgot-password — sends OTP to email for password reset */
export function forgotPassword(email: string): Promise<{ message: string }> {
  return apiRequest<{ message: string }>("/forgot-password", {
    method: "POST",
    body: { email },
    auth: false,
  });
}

/** POST /reset-password — resets password using OTP */
export function resetPassword(email: string, otp: string, new_password: string): Promise<{ message: string }> {
  return apiRequest<{ message: string }>("/reset-password", {
    method: "POST",
    body: { email, otp, new_password },
    auth: false,
  });
}

export interface AdminRegisterBody {
  username: string;
  email: string;
  orgID: string;
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
  return apiRequest<RegisterUserResponse>("/register-user", {
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
