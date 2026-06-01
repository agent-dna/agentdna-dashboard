import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useAgents, useTools } from "../data/hooks";

export interface DirectoryEntry {
  name: string;
  kind: "agent" | "tool";
}

interface DirectoryContextValue {
  map: Map<string, DirectoryEntry>;
  loading: boolean;
}

const Ctx = createContext<DirectoryContextValue | null>(null);

/**
 * Fetches the org's agents and tools once and exposes a DID → { name, kind }
 * lookup. Used by interaction tables (and anywhere we render counterparty info)
 * to display real names instead of raw DIDs.
 *
 * NOTE: only page 1 of /agents-list and /tools-list (10 each) is loaded. Larger
 * orgs will see fallback shortened DIDs for un-cached entries until the backend
 * either (a) returns enough rows or (b) starts joining names into interactions.
 */
export function DirectoryProvider({ children }: { children: ReactNode }) {
  const agents = useAgents();
  const tools = useTools();

  const map = useMemo(() => {
    const m = new Map<string, DirectoryEntry>();
    agents.data.forEach((a) => m.set(a.id, { name: a.name, kind: "agent" }));
    tools.data.forEach((t) => m.set(t.id, { name: t.name, kind: "tool" }));
    return m;
  }, [agents.data, tools.data]);

  const value = useMemo<DirectoryContextValue>(
    () => ({ map, loading: agents.loading || tools.loading }),
    [map, agents.loading, tools.loading],
  );

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
export function useResolveName(): (did: string) => { name: string; kind?: "agent" | "tool" } {
  const map = useDirectory();
  return (did: string) => {
    const hit = map.get(did);
    if (hit) return hit;
    return { name: shortDid(did) };
  };
}
