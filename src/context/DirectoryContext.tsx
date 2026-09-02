import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { fetchAllAgents, fetchAllTools } from "../data/api";
import { listAllUsers, type OrgUser } from "../api/users";
import { setDirectorySnapshot, type DirectoryEntry } from "../data/directoryCache";
import type { Agent, Tool } from "../types";

export type { DirectoryEntry };

interface DirectoryContextValue {
  map: Map<string, DirectoryEntry>;
  loading: boolean;
}

const Ctx = createContext<DirectoryContextValue | null>(null);

/**
 * Fetches the org's agents and tools once (walking every page via
 * fetchAllAgents/fetchAllTools) and exposes a DID → { name, kind } lookup.
 * Used by interaction tables (and anywhere we render counterparty info) to
 * display real names instead of raw DIDs — and, via directoryCache, as the
 * source of truth for agent-vs-tool classification in api.ts.
 */
export function DirectoryProvider({ children }: { children: ReactNode }) {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [tools, setTools] = useState<Tool[]>([]);
  const [users, setUsers] = useState<OrgUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
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
      setAgents(a);
      setTools(t);
      setUsers(u);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const map = useMemo(() => {
    const m = new Map<string, DirectoryEntry>();
    agents.forEach((a) => m.set(a.id, { name: a.name, kind: "agent" }));
    tools.forEach((t) => m.set(t.id, { name: t.name, kind: "tool" }));
    users.forEach((u) => m.set(u.userID, { name: u.userName, kind: "user" }));
    return m;
  }, [agents, tools, users]);

  // Mirror into the plain (non-React) cache api.ts reads from, so its
  // agent-vs-tool classification can use the real directory instead of
  // guessing from DID shape.
  useEffect(() => setDirectorySnapshot(map), [map]);

  const value = useMemo<DirectoryContextValue>(() => ({ map, loading }), [map, loading]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Returns the DID → entry map (empty Map if no provider mounted). */
export function useDirectory(): Map<string, DirectoryEntry> {
  return useContext(Ctx)?.map ?? new Map<string, DirectoryEntry>();
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
