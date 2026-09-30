/**
 * Where an interaction sits in its intent's branch tree, read from its ID.
 *
 * An intent is a tree of hops. The shared prefix is the trunk (`<intentId>-1`, `-2`, …).
 * When a later transaction for the same intent diverges at some position, the hops stored
 * from there on move into branch `a` and the new hops become branch `b` (`c`, … for more):
 * `<intentId>-3-a-1`, `<intentId>-3-b-1`. A branch can fork again inside itself:
 * `<intentId>-3-b-2-a-1`. Branch `a` is always the original. Branches are not alternatives —
 * they may run in parallel, and several may succeed.
 */

export interface BranchPos {
  /** Tokens after the intent ID: positions and branch letters, e.g. `[3, "b", 2, "a", 1]`. */
  path: (number | string)[];
  /** `""` on the trunk, else the fork choices, e.g. `"3b"` or `"3b.2a"`. */
  branch: string;
  /** Short hop label: `"1"`, `"3b.1"`, `"3b.2a.1"`. */
  label: string;
  /** Position within its own branch (the last number). */
  seq: number;
}

/** `null` when the ID doesn't follow `<intentId>-<n>[-<letter>-<n>]…`. */
export function parseInteractionId(id: string): BranchPos | null {
  const dash = id.indexOf("-");
  if (dash < 0) return null;
  const tokens = id.slice(dash + 1).split("-");
  // Positions and letters alternate, starting and ending on a position.
  if (tokens.length % 2 === 0) return null;
  const path: (number | string)[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (i % 2 === 0) {
      if (!/^\d+$/.test(t)) return null;
      path.push(parseInt(t, 10));
    } else {
      if (!/^[a-z]+$/i.test(t)) return null;
      path.push(t.toLowerCase());
    }
  }
  const forks: string[] = [];
  for (let i = 0; i + 1 < path.length; i += 2) forks.push(`${path[i]}${path[i + 1]}`);
  const seq = path[path.length - 1] as number;
  const branch = forks.join(".");
  return { path, branch, label: branch ? `${branch}.${seq}` : String(seq), seq };
}

/**
 * Tree order: the trunk up to a fork, then each branch in letter order, depth first.
 * IDs that don't parse go last, in their original order (the sort is stable).
 */
export function compareInteractionIds(a: string, b: string): number {
  const pa = parseInteractionId(a);
  const pb = parseInteractionId(b);
  if (!pa || !pb) return pa ? -1 : pb ? 1 : 0;
  const n = Math.min(pa.path.length, pb.path.length);
  for (let i = 0; i < n; i++) {
    const x = pa.path[i];
    const y = pb.path[i];
    if (x === y) continue;
    if (typeof x === "number" && typeof y === "number") return x - y;
    return String(x).localeCompare(String(y));
  }
  return pa.path.length - pb.path.length;
}

/** Parent of a branch key: `"3b.2a"` → `"3b"`, `"3b"` → `""`. */
export const parentBranch = (key: string) => (key.includes(".") ? key.slice(0, key.lastIndexOf(".")) : "");

/** Whether `key` is `leaf` or one of its ancestors (the trunk `""` is everyone's). */
export const isOnPath = (key: string, leaf: string) => key === "" || key === leaf || leaf.startsWith(`${key}.`);

/** Reader-facing name: `"3b"` → `"Branch B"`, `"3b.2a"` → `"Branch B › A"`. */
export function branchName(key: string): string {
  if (!key) return "Main";
  const letters = key.split(".").map((f) => f.replace(/^\d+/, "").toUpperCase());
  return `Branch ${letters.join(" › ")}`;
}

/** Position on its parent where a branch forked: `"3b.2a"` → 2. */
export const forkPosition = (key: string) => parseInt(key.slice(key.lastIndexOf(".") + 1), 10);
