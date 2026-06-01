import { useState, type MouseEvent } from "react";
import { initials } from "../lib/format";
import { Icon } from "./Icon";

interface EntityCellProps {
  name: string;
  sub?: string;
  paletteIx?: number;
  icon?: string;
}

export function EntityCell({ name, sub, paletteIx = 0, icon }: EntityCellProps) {
  const av = `a${(paletteIx % 5) + 1}`;
  return (
    <div className="cell-name">
      <div className={`av ${av}`}>{icon || initials(name)}</div>
      <div className="nm">
        <div>{name}</div>
        {sub && <div className="sub">{sub}</div>}
      </div>
    </div>
  );
}

interface IdCellProps {
  id: string;
  /** If true, render hash as `abcd...wxyz` instead of full length. */
  truncate?: boolean;
  /** Total visible chars when truncated (split evenly head/tail). Default 8. */
  truncateLength?: number;
}

function truncateId(s: string, total = 8): string {
  const head = Math.ceil(total / 2);
  const tail = Math.floor(total / 2);
  if (s.length <= head + tail + 3) return s;
  return `${s.slice(0, head)}...${s.slice(-tail)}`;
}

export function IdCell({ id, truncate = false, truncateLength = 8 }: IdCellProps) {
  const [copied, setCopied] = useState(false);
  const parts = id.split("_");
  const prefix = parts[0];
  const hash = parts.slice(1).join("_") || prefix;
  const displayHash = truncate ? truncateId(hash, truncateLength) : hash;

  const onCopy = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    e.preventDefault();
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(id).then(
        () => {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1200);
        },
        () => {
          // ignore clipboard failures
        },
      );
    }
  };

  return (
    <span className="cell-id" title={truncate ? id : undefined}>
      {!truncate && <span className="pre">{prefix}_</span>}
      {displayHash}
      <button
        type="button"
        onClick={onCopy}
        title={copied ? "Copied!" : "Copy ID"}
        aria-label="Copy ID"
        style={{
          marginLeft: 6,
          display: "inline-grid",
          placeItems: "center",
          width: 20,
          height: 20,
          border: "1px solid var(--line)",
          background: "var(--bg-1)",
          color: copied ? "var(--safe)" : "var(--fg-muted)",
          borderRadius: 5,
          cursor: "pointer",
          padding: 0,
          transition: "color 120ms, border-color 120ms, background 120ms",
        }}
        onMouseEnter={(ev) => {
          if (!copied) (ev.currentTarget as HTMLButtonElement).style.color = "var(--accent)";
        }}
        onMouseLeave={(ev) => {
          if (!copied) (ev.currentTarget as HTMLButtonElement).style.color = "var(--fg-muted)";
        }}
      >
        <Icon name={copied ? "check" : "copy"} size={12} />
      </button>
    </span>
  );
}
