import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { fetchAllAgents, fetchAllTools } from "../data/api";
import { listAllUsers, type OrgUser } from "../api/users";
import {
  setDirectorySnapshot,
  markDirectoryReady,
  resetDirectory,
  setDirectoryLoader,
  requestDirectory,
  type DirectoryEntry,
} from "../data/directoryCache";
import { useAuth } from "./AuthContext";
import type { Agent, Tool } from "../types";

export type { DirectoryEntry };

interface DirectoryContextValue {
  map: Map<string, DirectoryEntry>;
  loading: boolean;
}

const Ctx = createContext<DirectoryContextValue | null>(null);

/**
 * Fetches the org's agents and tools (walking every page via
 * fetchAllAgents/fetchAllTools) and exposes a DID → { name, kind } lookup.
 * Loaded per signed-in identity: it reloads when a different user signs in and empties on
 * sign-out, since the page isn't reloaded between sessions and each user sees their own org.
 * Loaded on demand: nothing is fetched until a component reads the directory (useDirectory and
 * the hooks built on it) or api.ts awaits waitForDirectoryReady(). Pages that never resolve
 * names, like Home, never pay for walking every agent, tool and user.
 * Used by interaction tables (and anywhere we render counterparty info) to
 * display real names instead of raw DIDs — and, via directoryCache, as the
 * source of truth for agent-vs-tool classification in api.ts.
 */
export function DirectoryProvider({ children }: { children: ReactNode }) {
  const { user, token } = useAuth();
  // Who the directory is for. Not the token itself, so a token refresh doesn't reload it.
  const session = user && token ? `${user.org_id}:${user.did}:${user.is_admin ? "admin" : "user"}` : null;
  /** The last load, tagged with the session it was made for; another session's load is never shown. */
  const [loaded, setLoaded] = useState<{ session: string; agents: Agent[]; tools: Tool[]; users: OrgUser[] } | null>(null);
  const current = loaded && loaded.session === session ? loaded : null;
  const loading = session !== null && !current;
  /** Set once anything asks for the directory; it then stays loaded for later sessions too. */
  const [wanted, setWanted] = useState(false);

  useEffect(() => {
    setDirectoryLoader(() => setWanted(true));
    return () => setDirectoryLoader(null);
  }, []);

  useEffect(() => {
    // New user or signed out: drop the previous directory from the api.ts mirror and
    // make classification wait for this session's load.
    resetDirectory();
    if (!session || !wanted) return;
    let cancelled = false;
    Promise.all([
      fetchAllAgents().catch((e) => {
        console.warn("[Directory] fetchAllAgents failed", e);
        return [] as Agent[];
      }),
      fetchAllTools().catch((e) => {
        console.warn("[Directory] fetchAllTools failed", e);
        return [] as Tool[];
      }),
      listAllUsers().catch((e) => {
        console.warn("[Directory] listAllUsers failed", e);
        return [] as OrgUser[];
      }),
    ]).then(([a, t, u]) => {
      if (cancelled) return;
      console.group("[Directory] loaded");
      console.log(`agents (${a.length}):`, a);
      console.log(`tools (${t.length}):`, t);
      console.log(`users (${u.length}):`, u);
      console.groupEnd();
      setLoaded({ session, agents: a, tools: t, users: u });
      // Fill api.ts's mirror before signalling waitForDirectoryReady(): its waiters resume
      // before React re-renders, so the mirror effect below would land too late for them.
      setDirectorySnapshot(directoryMap(a, t, u));
      markDirectoryReady();
    });
    return () => {
      cancelled = true;
    };
  }, [session, wanted]);

  const map = useMemo(() => directoryMap(current?.agents ?? [], current?.tools ?? [], current?.users ?? []), [current]);

  // Mirror into the plain (non-React) cache api.ts reads from, so its
  // agent-vs-tool classification can use the real directory instead of
  // guessing from DID shape.
  useEffect(() => setDirectorySnapshot(map), [map]);

  const value = useMemo<DirectoryContextValue>(() => ({ map, loading }), [map, loading]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

function directoryMap(agents: Agent[], tools: Tool[], users: OrgUser[]): Map<string, DirectoryEntry> {
  const m = new Map<string, DirectoryEntry>();
  agents.forEach((a) => m.set(a.id, { name: a.name, kind: "agent" }));
  tools.forEach((t) => m.set(t.id, { name: t.name, kind: "tool" }));
  users.forEach((u) => m.set(u.userID, { name: u.userName, kind: "user" }));
  return m;
}

/** Returns the DID → entry map (empty Map if no provider mounted, or until it loads). Starts the load. */
export function useDirectory(): Map<string, DirectoryEntry> {
  useEffect(requestDirectory, []);
  return useContext(Ctx)?.map ?? new Map<string, DirectoryEntry>();
}

/** True until the directory's initial fetchAllAgents/fetchAllTools/listAllUsers walk settles. Starts the load. */
export function useDirectoryLoading(): boolean {
  useEffect(requestDirectory, []);
  return useContext(Ctx)?.loading ?? true;
}

/** Shortened DID fallback for unknown entries. */
export function shortDid(did: string): string {
  if (!did) return "—";
  return did.length > 24 ? `${did.slice(0, 12)}…${did.slice(-6)}` : did;
}

/** Look up a DID, falling back to a shortened version if not in directory. */
export function useResolveName(): (did: string) => { name: string; kind?: "agent" | "tool" | "user" } {
  const map = useDirectory();
  return (did: string) => {
    const hit = map.get(did);
    if (hit) return hit;
    return { name: shortDid(did) };
  };
}

/**
 * Best display name for an { id, name } entity (e.g. an intent's initiator).
 *
 * The list endpoints (/intent-list, /agent-intents, /intent-info, …) only
 * sometimes resolve a display name server-side — when they don't, the mapper
 * fills `name` with the same shortened-DID fallback `shortDid` produces here,
 * so a naive `entity.name || "—"` still shows a DID. Try the directory (which
 * covers the whole org, not just what one endpoint joined) before giving up.
 */
export function resolveDisplayName(
  resolve: (did: string) => { name: string; kind?: "agent" | "tool" | "user" },
  entity: { id: string; name: string },
): string {
  const backendName = entity.name?.trim();
  if (backendName && backendName !== shortDid(entity.id)) return backendName;
  return resolve(entity.id).name;
}
