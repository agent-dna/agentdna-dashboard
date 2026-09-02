import type { Interaction } from "../types";

export function timeAgo(mins: number): string {
  if (mins < 1) return "just now";
  if (mins < 60) return `${Math.floor(mins)}m ago`;
  const h = mins / 60;
  if (h < 24) return `${Math.floor(h)}h ago`;
  const d = h / 24;
  if (d < 30) return `${Math.floor(d)}d ago`;
  return `${Math.floor(d / 30)}mo ago`;
}

export function fmtRuntime(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${m}m ${s}s`;
}

/** Uppercases just the first character — leaves the rest of the string untouched. */
export function capitalizeFirst(s: string): string {
  return s.length > 0 ? s[0].toUpperCase() + s.slice(1) : s;
}

export function initials(name: string): string {
  return name
    .split(/[\s.]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0].toUpperCase())
    .join("");
}

/**
 * Canonical shape of an interaction's "Raw data" JSON — used by the drawer's
 * Raw data panel and the Flow page's trace inspector so they never drift
 * apart and always show identical data for the same interaction.
 */
export function interactionRawData(i: Interaction) {
  return {
    id: i.id,
    blockType: i.blockType,
    threat: i.threat,
    threatID: i.threatID,
    message: i.message,
    created: i.created,
    runtime: i.runtime,
    targetType: i.targetType,
    initiator: { id: i.initiator.id, name: i.initiator.name },
    target: { id: i.target.id, name: i.target.name },
    intent: { id: i.intent?.id, name: i.intent?.name },
  };
}
