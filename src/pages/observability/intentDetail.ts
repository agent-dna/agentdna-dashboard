import { fetchObsPaths, type ObsPathFilter, type ObsPathIntent, type ObsScope } from "../../api/observability";
import { fetchIntentInfo } from "../../data/api";

const defined = <T extends object>(o: T) => Object.fromEntries(Object.entries(o).filter(([, v]) => v != null)) as Partial<T>;

/**
 * The picked intent's detail. The paths endpoint is asked with the whole selection (user,
 * agent, peer, app and intent) so it answers one row per intent; `/intent-info` — what the
 * Intent page uses — fills in whatever that row leaves out, or stands in when it has none.
 * `title` is the plane's card title, used when neither source has one.
 */
export async function loadIntentDetail(scope: ObsScope, filter: ObsPathFilter & { intentID: string }, title: string) {
  const [paths, info] = await Promise.allSettled([fetchObsPaths(scope, filter, 5), fetchIntentInfo(filter.intentID)]);
  const row = paths.status === "fulfilled" ? paths.value.pathsList.find((r) => r.intent?.id === filter.intentID)?.intent : undefined;
  const i = info.status === "fulfilled" ? info.value : null;
  if (!row && !i) {
    if (paths.status === "rejected") throw paths.reason;
    return null;
  }
  const fromInfo: Partial<ObsPathIntent> = i
    ? {
        initiatorDID: i.initiatorDID,
        initiatorName: i.initiatorName,
        startedAt: i.startedAt,
        lastInteractionAt: i.endedAt,
        status: i.status,
        reviewStatus: i.reviewStatus,
        threatDetected: i.threatDetected,
        provenanceRecordID: i.provenanceRecordID,
        interactionsCount: i.interactions?.length,
        interactions: i.interactions?.map((x) => ({
          interactionID: x.interactionID,
          from: x.from,
          fromName: x.fromName ?? "",
          to: x.to,
          toName: x.toName ?? "",
          type: "",
          direction: "",
          message: "",
          signature: "",
          threat: x.threat,
          threatID: x.threatID ?? "",
          time: x.time,
        })),
      }
    : {};
  const merged: ObsPathIntent = { id: filter.intentID, title, ...defined(fromInfo), ...(row ? defined(row) : {}) };
  // The paths row's interactions carry messages and signatures; /intent-info's are the fallback.
  if (!row?.interactions?.length) merged.interactions = fromInfo.interactions;
  return merged;
}
