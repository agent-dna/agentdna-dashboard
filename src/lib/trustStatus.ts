import type { TrustStatus } from "../data/api";

const TONE: Record<TrustStatus, { cls: "safe" | "warn" | "threat"; label: string }> = {
  Trusted: { cls: "safe", label: "Trusted" },
  Unreviewed: { cls: "warn", label: "Unreviewed" },
  Flagged: { cls: "threat", label: "Flagged" },
};

export const trustStatusLabel = (v: TrustStatus) => (TONE[v] ?? TONE.Unreviewed).label;
/** The chip tone for a trust status: green trusted, amber unreviewed, red flagged. */
export const trustStatusTone = (v: TrustStatus) => (TONE[v] ?? TONE.Unreviewed).cls;
