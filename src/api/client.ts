import { dummyRespond, isDummyMode } from "../data/dummyRouter";

const BASE = (import.meta.env.VITE_API_BASE_URL || "http://localhost:9000").replace(/\/$/, "");
const DEV_TOKEN: string | undefined = import.meta.env.VITE_DEV_TOKEN;

const TOKEN_KEY = "agentdna.token";

export function getToken(): string | null {
  try {
    const stored = localStorage.getItem(TOKEN_KEY);
    if (stored) return stored;
  } catch {
    // fall through to dev token
  }
  return DEV_TOKEN || null;
}

export function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // ignore
  }
}

export interface ApiResponse<T> {
  status: boolean;
  data: T;
  message?: string;
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  query?: Record<string, string | number | undefined | null>;
  auth?: boolean;
}

let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(fn: (() => void) | null) {
  onUnauthorized = fn;
}

export async function apiRequest<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, query, auth = true } = opts;

  if (isDummyMode()) {
    const out = dummyRespond(path, query, method);
    if (out !== undefined) {
      console.log(`[DUMMY ${method} ${path}]`, query || {}, "→", out);
      return out as T;
    }
  }

  const url = new URL(BASE + path);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v != null && v !== "") url.searchParams.set(k, String(v));
    }
  }

  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";

  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(url.toString(), {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) {
    setToken(null);
    if (onUnauthorized) onUnauthorized();
    throw new ApiError("Unauthorized", 401);
  }

  let payload: ApiResponse<T> | null = null;
  try {
    payload = (await res.json()) as ApiResponse<T>;
  } catch {
    throw new ApiError(`Invalid JSON response (HTTP ${res.status})`, res.status);
  }

  if (!res.ok || payload?.status === false) {
    console.warn(`[${method} ${url.pathname}${url.search}] ${res.status}`, payload);
    throw new ApiError(payload?.message || `HTTP ${res.status}`, res.status);
  }

  console.log(`[${method} ${url.pathname}${url.search}]`, payload?.data);
  return payload.data;
}

export async function apiUpload<T>(
  path: string,
  formData: FormData,
  opts: { method?: string; auth?: boolean } = {},
): Promise<T> {
  const { method = "POST", auth = true } = opts;

  if (isDummyMode()) {
    const out = dummyRespond(path, undefined, method);
    if (out !== undefined) {
      console.log(`[DUMMY ${method} ${path}] (multipart)`, "→", out);
      return out as T;
    }
  }

  const headers: Record<string, string> = { Accept: "application/json" };
  // Do NOT set Content-Type; the browser sets multipart/form-data with the boundary.
  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(BASE + path, { method, headers, body: formData });

  if (res.status === 401) {
    setToken(null);
    if (onUnauthorized) onUnauthorized();
    throw new ApiError("Unauthorized", 401);
  }

  let payload: ApiResponse<T> | null = null;
  try {
    payload = (await res.json()) as ApiResponse<T>;
  } catch {
    throw new ApiError(`Invalid JSON response (HTTP ${res.status})`, res.status);
  }

  if (!res.ok || payload?.status === false) {
    console.warn(`[${method} ${path}] ${res.status}`, payload);
    throw new ApiError(payload?.message || `HTTP ${res.status}`, res.status);
  }

  console.log(`[${method} ${path}]`, payload?.data);
  return payload.data;
}
