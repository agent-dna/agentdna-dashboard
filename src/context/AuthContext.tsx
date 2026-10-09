import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  login as apiLogin,
  adminLogin as apiAdminLogin,
  adminRegister as apiAdminRegister,
  registerAdminMiddleware,
  registerUser as apiRegisterUser,
  fetchSession,
  logoutSession,
  logoutAllSessions,
  type SessionInfo,
} from "../api/auth";
import { ApiError, setUnauthorizedHandler } from "../api/client";
import { clearIntentInfoCache } from "../data/api";

/*
 * The session is an HttpOnly cookie the backend sets on login; nothing about it is stored or
 * decoded here. Who is signed in comes from the login responses and GET /session, which the
 * app asks on load. Only an HTTP 401 means the session is gone.
 */

export interface AuthUser {
  /** Primary DID. A user can hold several; see `dids` on /user-info for all of them. */
  did: string;
  /** For admins, their admin username. */
  name?: string;
  /** May be empty for admins. */
  email: string;
  org_id: string;
  /** Only the login responses carry these; /session doesn't. */
  api_key?: string;
  userCardId?: string;
  agent_access_list?: string[];
  is_admin: boolean;
}

interface AuthContextValue {
  user: AuthUser | null;
  /** False until the boot-time GET /session has answered; nothing should redirect before then. */
  ready: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginAdmin: (username: string, password: string) => Promise<void>;
  registerAdmin: (username: string, email: string, password: string, org: string, otp?: string) => Promise<void>;
  registerUser: (username: string, email: string, password: string, orgId: string, otp?: string) => Promise<void>;
  /** Ends this session (POST /logout) and clears the signed-in user. */
  logout: () => Promise<void>;
  /** Ends every session of the account on all devices (POST /logout-all), this one included. */
  logoutAll: () => Promise<void>;
  /** Re-reads GET /session, e.g. after the primary DID may have changed. */
  refreshSession: () => Promise<void>;
  patchUser: (patch: Partial<AuthUser>) => void;
}

const Ctx = createContext<AuthContextValue | null>(null);

const fromSession = (s: SessionInfo, prev: AuthUser | null): AuthUser => ({
  // Login-only fields survive a session refresh; everything /session sends wins.
  ...(prev ?? {}),
  did: s.did,
  email: s.email || "",
  name: s.name || prev?.name,
  org_id: s.org_id,
  is_admin: !!s.is_admin,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);

  /** Signed out, by us or by the server: drop the user and anything cached for them. */
  const clearUser = useCallback(() => {
    clearIntentInfoCache();
    setUser(null);
  }, []);

  const refreshSession = useCallback(async () => {
    try {
      const s = await fetchSession();
      setUser((prev) => fromSession(s, prev));
    } catch (e) {
      // 401: no live session. Anything else (network, 5xx) leaves the current state alone.
      if (e instanceof ApiError && e.status === 401) clearUser();
    }
  }, [clearUser]);

  // On load, ask the server who (if anyone) is signed in.
  useEffect(() => {
    let live = true;
    fetchSession()
      .then((s) => live && setUser(fromSession(s, null)))
      .catch(() => live && setUser(null))
      .finally(() => live && setReady(true));
    return () => {
      live = false;
    };
  }, []);

  // Any 401 from any call: the session expired or was ended elsewhere.
  useEffect(() => {
    setUnauthorizedHandler(clearUser);
    return () => setUnauthorizedHandler(null);
  }, [clearUser]);

  const login = useCallback(async (email: string, password: string) => {
    setLoading(true);
    try {
      const r = await apiLogin(email, password);
      setUser({
        did: r.did,
        email: r.email,
        org_id: r.org_id,
        api_key: r.api_key,
        userCardId: r.nft_id,
        agent_access_list: r.agent_access_list,
        is_admin: !!r.is_admin,
      });
      void refreshSession(); // fills in the name
    } finally {
      setLoading(false);
    }
  }, [refreshSession]);

  const loginAdmin = useCallback(async (username: string, password: string) => {
    setLoading(true);
    try {
      const r = await apiAdminLogin(username, password);
      setUser({
        did: r.did,
        name: r.username,
        email: r.email || "",
        org_id: r.org_id,
        api_key: r.api_key,
        is_admin: !!r.is_admin,
      });
      void refreshSession();
    } finally {
      setLoading(false);
    }
  }, [refreshSession]);

  const registerAdmin = useCallback(async (username: string, email: string, password: string, org: string, otp = "") => {
    setLoading(true);
    try {
      const { did } = await apiAdminRegister({ username, email, orgID: org, password, otp });
      await registerAdminMiddleware(did, org);
    } finally {
      setLoading(false);
    }
    await loginAdmin(username, password);
  }, [loginAdmin]);

  const registerUser = useCallback(async (name: string, email: string, password: string, orgId: string, otp = "") => {
    setLoading(true);
    try {
      await apiRegisterUser({ name: name || undefined, email, password, orgID: orgId, otp });
    } finally {
      setLoading(false);
    }
    await login(email, password);
  }, [login]);

  const logout = useCallback(async () => {
    try {
      await logoutSession();
    } catch {
      // Already gone server-side, or unreachable: still sign out here.
    }
    clearUser();
  }, [clearUser]);

  const logoutAll = useCallback(async () => {
    try {
      await logoutAllSessions();
    } finally {
      clearUser();
    }
  }, [clearUser]);

  const patchUser = useCallback((patch: Partial<AuthUser>) => {
    setUser((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, ready, loading, login, loginAdmin, registerAdmin, registerUser, logout, logoutAll, refreshSession, patchUser }),
    [user, ready, loading, login, loginAdmin, registerAdmin, registerUser, logout, logoutAll, refreshSession, patchUser],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used inside AuthProvider");
  return v;
}
