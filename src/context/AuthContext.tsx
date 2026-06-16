import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { login as apiLogin, adminLogin as apiAdminLogin, adminRegister as apiAdminRegister, registerAdminMiddleware, type LoginResponse } from "../api/auth";
import { getToken, setToken, setUnauthorizedHandler } from "../api/client";
import { dummyCurrentUser, isDummyMode } from "../data/dummyRouter";

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
  loginAdmin: (email: string, password: string) => Promise<void>;
  registerAdmin: (username: string, password: string, org: string) => Promise<void>;
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
  sub?: string;       // admin JWT: username
  did?: string;
  email?: string;     // user JWT: email address
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
  if (!claims) return null;
  if (claims.exp && claims.exp * 1000 < Date.now()) return null;
  // User JWT uses `email`; admin JWT uses `sub` (username) — accept either
  const identifier = claims.email || claims.sub || "";
  if (!identifier) return null;
  return {
    did: claims.did || "",
    email: identifier,
    org_id: claims.org_id || "",
    api_key: claims.api_key || "",
    nft_id: claims.nft_id,
    // Admin JWT has no is_admin field — treat as admin if sub is present and no email
    is_admin: claims.is_admin !== undefined ? !!claims.is_admin : !!claims.sub && !claims.email,
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

function dummyUser(): AuthUser {
  const u = dummyCurrentUser();
  return {
    did: u.did,
    email: u.email,
    org_id: u.org_id,
    api_key: u.api_key,
    nft_id: u.nft_id,
    is_admin: u.is_admin,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const dummy = isDummyMode();
  const [user, setUser] = useState<AuthUser | null>(() =>
    dummy ? dummyUser() : readStoredUser() || userFromToken(getToken()),
  );
  const [token, setTokenState] = useState<string | null>(() => (dummy ? "dummy.jwt.token" : getToken()));
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

  const applyAuthResponse = useCallback((res: LoginResponse) => {
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
  }, []);

  const login = useCallback(async (email: string, _password: string) => {
    setLoading(true);
    try {
      if (isDummyMode()) {
        const u = dummyUser();
        u.email = email || u.email;
        setToken("dummy.jwt.token");
        writeStoredUser(u);
        setUser(u);
        setTokenState("dummy.jwt.token");
        return;
      }
      applyAuthResponse(await apiLogin(email, _password));
    } finally {
      setLoading(false);
    }
  }, [applyAuthResponse]);

  // applyJwt: used when the backend returns a raw JWT string (admin login/register auto-login)
  const applyJwt = useCallback((jwt: string) => {
    const u = userFromToken(jwt);
    if (!u) throw new Error("Received invalid or expired token.");
    setToken(jwt);
    writeStoredUser(u);
    setUser(u);
    setTokenState(jwt);
  }, []);

  const loginAdmin = useCallback(async (username: string, password: string) => {
    setLoading(true);
    try {
      if (isDummyMode()) {
        const u = dummyUser();
        u.email = username || u.email;
        u.is_admin = true;
        setToken("dummy.jwt.token");
        writeStoredUser(u);
        setUser(u);
        setTokenState("dummy.jwt.token");
        return;
      }
      // adminLogin returns a raw JWT string
      applyJwt(await apiAdminLogin(username, password));
    } finally {
      setLoading(false);
    }
  }, [applyJwt]);

  const registerAdmin = useCallback(async (username: string, password: string, org: string) => {
    setLoading(true);
    try {
      if (isDummyMode()) {
        const u = dummyUser();
        u.email = username || u.email;
        u.org_id = org || u.org_id;
        u.is_admin = true;
        setToken("dummy.jwt.token");
        writeStoredUser(u);
        setUser(u);
        setTokenState("dummy.jwt.token");
        return;
      }
      // Step 1: register on admin server → get DID
      const { did } = await apiAdminRegister({ username, org, password });
      // Step 2: whitelist DID in user-server middleware (new_admins table)
      await registerAdminMiddleware(did, org);
      // Step 3: auto-login → get JWT and store it
      applyJwt(await apiAdminLogin(username, password));
    } finally {
      setLoading(false);
    }
  }, [applyJwt]);

  const value = useMemo<AuthContextValue>(
    () => ({ user, token, loading, login, loginAdmin, registerAdmin, logout }),
    [user, token, loading, login, loginAdmin, registerAdmin, logout],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used inside AuthProvider");
  return v;
}
