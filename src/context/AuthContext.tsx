import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { login as apiLogin, type LoginResponse } from "../api/auth";
import { getToken, setToken, setUnauthorizedHandler } from "../api/client";

const USER_KEY = "agentdna.user";

export interface AuthUser {
  did: string;
  email: string;
  org_id: string;
  api_key: string;
  nft_id?: string;
  is_admin: boolean;
  agent_access_list?: string[];
}

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const Ctx = createContext<AuthContextValue | null>(null);

function readStoredUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

interface JwtClaims {
  did?: string;
  email?: string;
  org_id?: string;
  api_key?: string;
  nft_id?: string;
  is_admin?: boolean;
  exp?: number;
}

function decodeJwt(token: string): JwtClaims | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json) as JwtClaims;
  } catch {
    return null;
  }
}

function userFromToken(token: string | null): AuthUser | null {
  if (!token) return null;
  const claims = decodeJwt(token);
  if (!claims || !claims.email) return null;
  if (claims.exp && claims.exp * 1000 < Date.now()) return null;
  return {
    did: claims.did || "",
    email: claims.email,
    org_id: claims.org_id || "",
    api_key: claims.api_key || "",
    nft_id: claims.nft_id,
    is_admin: !!claims.is_admin,
  };
}

function writeStoredUser(user: AuthUser | null) {
  try {
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
    else localStorage.removeItem(USER_KEY);
  } catch {
    // ignore
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => readStoredUser() || userFromToken(getToken()));
  const [token, setTokenState] = useState<string | null>(() => getToken());
  const [loading, setLoading] = useState(false);

  const logout = useCallback(() => {
    setToken(null);
    writeStoredUser(null);
    setUser(null);
    setTokenState(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      writeStoredUser(null);
      setUser(null);
      setTokenState(null);
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setLoading(true);
    try {
      const res: LoginResponse = await apiLogin(email, password);
      const u: AuthUser = {
        did: res.did,
        email: res.email,
        org_id: res.org_id,
        api_key: res.api_key,
        nft_id: res.nft_id,
        is_admin: res.is_admin,
        agent_access_list: res.agent_access_list,
      };
      setToken(res.token);
      writeStoredUser(u);
      setUser(u);
      setTokenState(res.token);
    } finally {
      setLoading(false);
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, token, loading, login, logout }),
    [user, token, loading, login, logout],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used inside AuthProvider");
  return v;
}
