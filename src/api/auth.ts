import { apiRequest } from "./client";

// All auth goes through the middleware (/dashboard/v1). Logging in sets the HttpOnly session
// cookie; identity comes from these responses and GET /session, never from a token.

/** POST /login — org users. Data only; the session itself is the cookie it sets. */
export interface LoginResponse {
  did: string;
  email: string;
  org_id: string;
  api_key: string;
  nft_id?: string;
  is_admin: boolean;
  agent_access_list?: string[];
}

/** 400 with the server's message on wrong credentials (admins get that here too; they use /admin-login). */
export function login(email: string, password: string): Promise<LoginResponse> {
  return apiRequest<LoginResponse>("/login", {
    method: "POST",
    body: { email, password },
    auth: false,
  });
}

/** POST /admin-login — admins. The middleware checks the credentials with the admin server. */
export interface AdminLoginResponse {
  username: string;
  did: string;
  /** May be empty for admins. */
  email: string;
  org_id: string;
  api_key: string;
  is_admin: boolean;
}

/**
 * Errors carry the server's message for the form: 400 (missing fields / wrong credentials),
 * 403 (admin not registered with this dashboard), 502/504 ("Admin server unavailable").
 */
export function adminLogin(username: string, password: string): Promise<AdminLoginResponse> {
  return apiRequest<AdminLoginResponse>("/admin-login", {
    method: "POST",
    body: { username, password },
    auth: false,
  });
}

/** GET /session — the signed-in account, fresh from the DB. 401 when there is no live session. */
export interface SessionInfo {
  /** Primary DID; can change when a new DID is registered, so re-read rather than cache. */
  did: string;
  /** May be empty for admins. */
  email: string;
  /** For admins, their admin username. */
  name: string;
  org_id: string;
  is_admin: boolean;
  expiresAt: string;
}

export function fetchSession(): Promise<SessionInfo> {
  // The caller decides what a 401 means (at boot it just means "signed out").
  return apiRequest<SessionInfo>("/session", { skipLogoutOn401: true });
}

/** POST /logout — ends this session and clears the cookie. */
export function logoutSession(): Promise<unknown> {
  return apiRequest<unknown>("/logout", { method: "POST", skipLogoutOn401: true });
}

/** POST /logout-all — ends every session of the account, this one included. */
export function logoutAllSessions(): Promise<{ sessionsEnded: number }> {
  return apiRequest<{ sessionsEnded: number }>("/logout-all", { method: "POST", skipLogoutOn401: true });
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

/** POST /reset-password — resets password using OTP. Ends every session of the account. */
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
