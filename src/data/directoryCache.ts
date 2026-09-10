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

// ── Readiness gate ───────────────────────────────────────────────────────────
// Bug this fixes: classifyParticipant() (in api.ts) falls back to the
// DID-prefix heuristic above whenever a DID isn't in the directory yet — which
// is *always true* for every DID until DirectoryProvider's initial
// fetchAllAgents/fetchAllTools walk finishes. Since that walk and, say, the
// Home page's /intents-list + per-intent interaction fetches all kick off in
// parallel on mount, whichever one lost the race used to silently misclassify
// every tool as an agent, so the "Apps interacted" column's icons intermittently
// came back empty depending on network timing — the exact "sometimes the icons
// don't load" symptom. Callers that classify participants should await
// waitForDirectoryReady() first so they always see the real directory instead
// of racing it.
let ready = false;
let resolveReady: (() => void) | null = null;
const readyPromise = new Promise<void>((resolve) => {
  resolveReady = resolve;
});

/** Called once by DirectoryProvider after its initial load settles (success or caught-empty). */
export function markDirectoryReady() {
  if (ready) return;
  ready = true;
  resolveReady?.();
}

/**
 * Resolves once the org directory has completed its initial load — await
 * this before classifying participants.
 *
 * markDirectoryReady() is *guaranteed* to fire eventually (DirectoryProvider's
 * fetchAllAgents/fetchAllTools/listAllUsers are all wrapped in .catch(), so
 * Promise.all there always settles, success or not) — so this doesn't
 * actually need a timeout to avoid hanging forever. It still has a generous
 * one purely as a last-resort backstop for the pathological case of
 * DirectoryProvider never mounting at all; it's deliberately long (20s, well
 * past how long the directory walk should ever take) so it can't fire *before*
 * a real but slow load finishes and reintroduce the exact race this exists to
 * close (an earlier, shorter timeout did exactly that).
 */
export function waitForDirectoryReady(): Promise<void> {
  if (ready) return Promise.resolve();
  return Promise.race([
    readyPromise,
    new Promise<void>((resolve) =>
      setTimeout(() => {
        if (!ready) console.warn("[directoryCache] waitForDirectoryReady() timed out after 20s — proceeding without a full directory");
        resolve();
      }, 20000),
    ),
  ]);
}
