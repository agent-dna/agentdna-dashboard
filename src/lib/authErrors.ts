import { ApiError } from "../api/client";

export interface FriendlyError {
  message: string;
  /** Optional follow-up the UI can offer alongside the message. */
  action?: "signin";
}

/**
 * Auth endpoints surface raw driver/database text (e.g. `pq: duplicate key value
 * violates unique constraint "new_org_users_pkey"`). Translate the known shapes
 * into something a user can act on, and fall back to a generic message so no raw
 * backend internals ever reach the screen.
 */
export function friendlyAuthError(err: unknown, fallback = "Something went wrong. Please try again."): FriendlyError {
  const raw = err instanceof ApiError || err instanceof Error ? err.message : typeof err === "string" ? err : "";
  const m = raw.toLowerCase();

  if (m.includes("duplicate key") || m.includes("already exists") || m.includes("already registered")) {
    return { message: "An account with this email already exists.", action: "signin" };
  }
  if (m.includes("otp") && (m.includes("invalid") || m.includes("incorrect") || m.includes("mismatch") || m.includes("wrong"))) {
    return { message: "That OTP code is incorrect. Check the code and try again." };
  }
  if (m.includes("otp") && m.includes("expire")) {
    return { message: "Your OTP code has expired. Request a new one." };
  }
  if (m.includes("invalid credentials") || m.includes("unauthorized") || m.includes("password")) {
    return { message: "Incorrect email or password." };
  }
  if (m.includes("not found") || m.includes("no rows")) {
    return { message: "We couldn't find an account with those details." };
  }
  if (m.includes("failed to fetch") || m.includes("networkerror") || m.includes("network") || m.includes("timeout")) {
    return { message: "Can't reach the server. Check your connection and try again." };
  }

  if (import.meta.env.DEV && raw) console.error("[auth]", raw);
  return { message: fallback };
}
