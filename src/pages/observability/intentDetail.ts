import { getIntentInfo } from "../../data/api";
import type { ObsInteraction, ObsPathIntent } from "../../api/observability";
import { compareInteractionIds, parseInteractionId } from "../../lib/interactionBranch";

/** GET /intent-info: the intent's summary and every interaction in its chain. */
interface IntentInfo {
  intentID: string;
  initiatorDID?: string;
  initiatorName?: string;
  agentsCount?: number;
  toolsCount?: number;
  interactionsCount?: number;
  runtimeSeconds?: number;
  startedAt?: string;
  firstInteractionAt?: string;
  lastInteractionAt?: string;
  status?: string;
  reviewStatus?: string;
  threatDetected?: boolean;
  interactions?: (Partial<ObsInteraction> & { rawData?: unknown })[];
}

/**
 * The picked intent's detail, from `/intent-info` (what the Intent page uses). The endpoint
 * has no title, so `title` is the plane's card title, falling back to the triggering message.
 */
export async function loadIntentDetail(intentID: string, title: string): Promise<ObsPathIntent | null> {
  // The shared /intent-info cache: the intent page and flow page reuse this same response.
  const i = (await getIntentInfo(intentID)) as unknown as IntentInfo | null;
  if (!i) return null;
  const interactions: ObsInteraction[] = (i.interactions ?? []).map((x) => ({
    interactionID: x.interactionID ?? "",
    from: x.from ?? "",
    fromName: x.fromName ?? "",
    to: x.to ?? "",
    toName: x.toName ?? "",
    type: x.type ?? "",
    direction: x.direction ?? "",
    message: x.message ?? "",
    signature: x.signature ?? "",
    threat: !!x.threat,
    threatID: x.threatID ?? "",
    time: x.time ?? "",
    raw: x.rawData,
  })).sort((a, b) => compareInteractionIds(a.interactionID, b.interactionID));
  // Every branch shares the intent's first block, so its message is the intent's title.
  const first = interactions.find((x) => parseInteractionId(x.interactionID)?.path.join("-") === "1");
  const trigger = (first ?? interactions.find((x) => x.type === "trigger"))?.message;
  return {
    id: i.intentID || intentID,
    title: title && title !== intentID ? title : trigger || intentID,
    initiatorDID: i.initiatorDID,
    initiatorName: i.initiatorName,
    agentsCount: i.agentsCount,
    toolsCount: i.toolsCount,
    interactionsCount: i.interactionsCount ?? interactions.length,
    runtimeSeconds: i.runtimeSeconds,
    startedAt: i.startedAt,
    firstInteractionAt: i.firstInteractionAt,
    lastInteractionAt: i.lastInteractionAt,
    status: i.status,
    reviewStatus: i.reviewStatus,
    threatDetected: i.threatDetected,
    interactions,
  };
}
