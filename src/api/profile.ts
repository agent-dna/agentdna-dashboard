import { apiRequest } from "./client";

export interface UserProfile {
  name: string;
  email: string;
  /** Older responses: the single DID; "none" for an unlinked user. */
  did?: string;
  /** Every DID the user holds. Empty until the account is linked. */
  dids?: string[];
  apiKey: string;
  organizationID: string;
  createdAt: string;
  adminEmail: string;
}

export function fetchUserProfile(): Promise<UserProfile> {
  return apiRequest<UserProfile>("/user-profile", {
    method: "GET",
    auth: true,
    skipLogoutOn401: true,
  });
}

export interface AdminProfile {
  name: string;
  email: string;
  did: string;
  organizationID: string;
  apiKey: string;
  agentCount: number;
  intentCount: number;
  threatCount: number;
  totalUsers: number;
  createdAt: number; // Unix epoch seconds
}

export function fetchAdminProfile(): Promise<AdminProfile> {
  return apiRequest<AdminProfile>("/admin-profile", {
    method: "GET",
    auth: true,
    skipLogoutOn401: true,
  });
}

export interface UpdateProfileBody {
  name?: string;
  email?: string;
}

/** Sends exactly one of { name } or { email }. `data` is always null — nothing to read on success. */
export function updateUserProfile(body: UpdateProfileBody): Promise<null> {
  return apiRequest<null>("/update-profile", {
    method: "POST",
    body,
    auth: true,
  });
}

/** Server-side minimum for POST /update-password — checked client-side too so the user gets instant feedback. */
export const MIN_PASSWORD_LENGTH = 8;

/**
 * POST /update-password — users and admins: sets a new password for whoever is signed in (the
 * middleware forwards admins' to the admin server). Every other device's session ends; this one stays.
 * Only the new password is sent: the server does not ask for or verify the current one.
 * Success carries no `data`; failures reject with ApiError carrying the server's message
 * (e.g. "password must be at least 8 characters", "account not found").
 */
export function updatePassword(newPassword: string): Promise<void> {
  return apiRequest<void>("/update-password", {
    method: "POST",
    body: { new_password: newPassword },
    auth: true,
  });
}
