/** Formatting shared by the chain of custody views (observability, intent page, flow page). */

export const shortId = (id: string) => (id.length > 18 ? `${id.slice(0, 8)}…${id.slice(-6)}` : id);

/**
 * The short form of an evidence identity name: a person's first name ("Shreya Patil (shreya.p@…)"
 * → "Shreya"), or the kind for a non-person identity ("app: qUh03…" → "App").
 */
export function firstName(name: string) {
  const n = name.trim();
  const kind = /^([a-z][\w-]*):\s*\S/i.exec(n);
  if (kind) return kind[1][0].toUpperCase() + kind[1].slice(1);
  return n.replace(/\s*\(.*\)\s*$/, "").split(/\s+/)[0] || n;
}

/** How to show an evidence identity: the first name (else the short ID), and the full name + ID on hover. */
export function identityLabel(e: { identityID?: string | null; identityName?: string | null }) {
  const id = e.identityID || "";
  const name = (e.identityName || "").trim();
  if (!id && !name) return null;
  return {
    text: name ? firstName(name) : shortId(id),
    title: [name, id].filter(Boolean).join("\n"),
    named: !!name,
  };
}

export const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString()} ${n === 1 ? one : many}`;

export const ms = (iso?: string) => {
  const t = iso ? new Date(iso).getTime() : NaN;
  return Number.isNaN(t) ? null : t;
};

export function fmtDuration(seconds?: number | null) {
  if (seconds == null || seconds < 0) return "—";
  if (seconds < 1) return `${Math.round(seconds * 1000)}ms`;
  if (seconds < 60) return `${seconds < 10 ? seconds.toFixed(1).replace(/\.0$/, "") : Math.round(seconds)}s`;
  const m = Math.floor(seconds / 60);
  return m < 60 ? `${m}m ${String(Math.round(seconds % 60)).padStart(2, "0")}s` : `${Math.floor(m / 60)}h ${m % 60}m`;
}

export function fmtDate(iso?: string) {
  const t = ms(iso);
  return t == null ? "—" : new Date(t).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "medium" });
}
