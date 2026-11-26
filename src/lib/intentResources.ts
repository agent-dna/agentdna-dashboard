import type { Interaction } from "../types";
import type { IntentResource } from "../data/api";

/** A credential an intent's hops presented, with where it went. Built from the hops' auth checks. */
export interface IntentCredential {
  credentialID: string;
  authMethod: string;
  /** Raw destinations the credential was sent to (deduplicated, in first-seen order). */
  destinations: string[];
  /** How many hops carried it. */
  hops: number;
  /** Warning codes on the hops that carried it. */
  warningCodes: Set<number>;
}

/** Warning codes that are about the credential a hop used (5105 shared key, 5107 stale key, 5108 never rotated). */
export const CREDENTIAL_WARNING_CODES = new Set([5105, 5107, 5108]);
/** Warning code for a call to a destination that is not trusted. */
export const NEW_HOST_WARNING_CODE = 5101;

/** Every credential the intent used, from the hops' auth evidence, most used first. */
export function intentCredentials(interactions: Interaction[]): IntentCredential[] {
  const byId = new Map<string, IntentCredential>();
  for (const ix of interactions) {
    const seenHere = new Set<string>();
    for (const e of ix.authEvidence ?? []) {
      const id = (e.credentialID || "").trim();
      if (!id) continue;
      let c = byId.get(id);
      if (!c) {
        c = { credentialID: id, authMethod: e.authMethod || "", destinations: [], hops: 0, warningCodes: new Set() };
        byId.set(id, c);
      }
      if (!c.authMethod && e.authMethod) c.authMethod = e.authMethod;
      const dest = (e.destination || "").trim();
      if (dest && !c.destinations.includes(dest)) c.destinations.push(dest);
      if (!seenHere.has(id)) {
        seenHere.add(id);
        c.hops += 1;
        for (const w of ix.warnings ?? []) c.warningCodes.add(w.code);
      }
    }
  }
  return [...byId.values()].sort((a, b) => b.hops - a.hops);
}

/** The intent's destinations that are not trusted: what warning 5101 is about. */
export const untrustedResources = (resources: IntentResource[]) => resources.filter((r) => r.trustStatus !== "Trusted");

/** The credentials behind a credential warning: those on hops that carry the code. */
export const credentialsForWarning = (credentials: IntentCredential[], code: number) =>
  credentials.filter((c) => c.warningCodes.has(code));
