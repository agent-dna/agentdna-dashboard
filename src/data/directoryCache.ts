/**
 * A plain (non-React) mirror of DirectoryContext's DID → {name, kind} map.
 *
 * api.ts needs this to tell agents apart from tools — the DID-prefix
 * heuristic (`isAgentId`, still used as a fallback) doesn't work in
 * production: real tool/app DIDs share the same "bafy…" CID format as agent
 * DIDs, so it misclassifies real apps as agents (e.g. a tool like "Github
 * MCP" gets silently dropped from an intent's "apps interacted" list). The
 * org directory actually knows which is which; api.ts just can't reach it
 * directly since DirectoryContext is a React context and (to avoid a
 * circular import — DirectoryContext already imports fetchAllAgents/
 * fetchAllTools from api.ts) can't import back from api.ts either. This
 * standalone module is the neutral ground both sides import from.
 */

export interface DirectoryEntry {
  name: string;
  kind: "agent" | "tool" | "user";
}

let snapshot = new Map<string, DirectoryEntry>();

/** Called by DirectoryProvider whenever its resolved map changes. */
export function setDirectorySnapshot(map: Map<string, DirectoryEntry>) {
  snapshot = map;
}

export function getDirectorySnapshot(): Map<string, DirectoryEntry> {
  return snapshot;
}
