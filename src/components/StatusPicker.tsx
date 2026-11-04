import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./Icon";
import { ApiError } from "../api/client";
import type { IntentReviewStatus } from "../types";

export const REVIEW_STATUSES: IntentReviewStatus[] = ["Unreviewed", "Acknowledged", "Flagged"];

const REVIEW_STATUS_STYLE: Record<IntentReviewStatus, { color: string; bg: string }> = {
  Unreviewed: { color: "var(--accent)", bg: "rgba(37,99,235,0.10)" },
  Acknowledged: { color: "var(--safe)", bg: "rgba(5,150,105,0.10)" },
  Flagged: { color: "var(--threat)", bg: "rgba(220,38,38,0.10)" },
};

const INCIDENT_STYLE = { color: "var(--threat)", bg: "rgba(220,38,38,0.10)" };

/** A status's colors. An unreviewed intent that has an incident reads red — it needs attention. */
export function reviewStatusStyle(status: IntentReviewStatus, hasIncident = false) {
  return status === "Unreviewed" && hasIncident ? INCIDENT_STYLE : REVIEW_STATUS_STYLE[status];
}

interface Props {
  status: IntentReviewStatus;
  /** The intent has at least one incident (colors "Unreviewed" red). */
  hasIncident?: boolean;
  /** Saves the new status; a rejection shows its message under the pill. */
  onChange: (next: IntentReviewStatus) => Promise<void>;
  size?: "sm" | "md";
}

/**
 * An intent's review status as a pill that is also the picker: click it to choose one of the
 * three statuses. The menu renders in a portal so a table or card's overflow can't clip it.
 */
export function StatusPicker({ status, hasIncident = false, onChange, size = "md" }: Props) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const update = () => {
      const rect = btnRef.current?.getBoundingClientRect();
      if (rect) setPos({ top: rect.bottom + 6, left: rect.left });
    };
    update();
    const onOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!btnRef.current?.contains(target) && !menuRef.current?.contains(target)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setOpen(false); btnRef.current?.focus(); }
    };
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    document.addEventListener("mousedown", onOutside);
    document.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
      document.removeEventListener("mousedown", onOutside);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const pick = async (next: IntentReviewStatus) => {
    if (next === status) { setOpen(false); return; }
    setSaving(true);
    setError(null);
    try {
      await onChange(next);
      setOpen(false);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't update the status. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const tone = reviewStatusStyle(status, hasIncident);

  // Clicks here mustn't reach a clickable table row behind the pill (React bubbles through portals).
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();

  return (
    <div className="status-picker" onClick={stop}>
      <button
        ref={btnRef}
        type="button"
        className={`status-trigger ${size}`}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Change status"
        onClick={() => setOpen((o) => !o)}
        disabled={saving}
        style={{ color: tone.color, background: tone.bg }}
      >
        {saving ? "Saving…" : status}
        <Icon name="chevronDown" size={size === "sm" ? 12 : 13} />
      </button>
      {error && <div className="status-error">{error}</div>}
      {open &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            aria-label="Set intent status"
            className="status-menu"
            style={{ top: pos.top, left: pos.left }}
            onClick={stop}
          >
            {REVIEW_STATUSES.map((s) => (
              <button
                key={s}
                type="button"
                role="menuitemradio"
                aria-checked={s === status}
                className={`status-option ${s === status ? "current" : ""}`}
                onClick={() => pick(s)}
                disabled={saving}
              >
                <span className="status-option-label">
                  <span className="status-dot" style={{ background: reviewStatusStyle(s, hasIncident).color }} />
                  {s}
                </span>
                {s === status && <Icon name="check" size={13} style={{ color: "var(--accent)" }} />}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </div>
  );
}
