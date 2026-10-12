import type { FlowBranch } from "./flowData";

export const BRANCH_TONES = [
  { ui: "#7c3aed", line: "#A78BFA" }, // violet
  { ui: "#db2777", line: "#F472B6" }, // pink
  { ui: "#b45309", line: "#FBBF24" }, // amber
  { ui: "#4d7c0f", line: "#A3E635" }, // lime
  { ui: "#0f766e", line: "#2DD4BF" }, // teal
] as const;

/** The trunk: neutral in the timeline, the canvas's usual blue. */
export const TRUNK_TONE = { ui: "#94a3b8", line: "#60A5FA" } as const;

export const branchTone = (b?: FlowBranch) => (b ? BRANCH_TONES[b.color % BRANCH_TONES.length] : TRUNK_TONE);

/** `#RRGGBB` → `rgba(r,g,b,a)`. */
export function withAlpha(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
