import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { ApiError } from "../api/client";
import { TRUST_STATUSES, updateResourceTrustStatus, type TrustStatus } from "../data/api";
import { trustStatusLabel, trustStatusTone } from "../lib/trustStatus";

const HINT: Record<TrustStatus, string> = {
  Unreviewed: "No decision yet",
  Flagged: "Agents should not be reaching this",
  Trusted: "A known, expected destination",
};

/**
 * A resource's trust status as a chip that is also the control (admins only): click it, pick a
 * status. The choice saves straight away (POST /update-resource-trust-status) and the caller
 * gets the saved value back to update its own row, with no refetch. Shares the credential
 * picker's styles (csp-*).
 */
export function TrustStatusPicker({ resourceID, current, onSaved, align = "left" }: {
  resourceID: string;
  current: TrustStatus;
  onSaved: (status: TrustStatus) => void;
  /** Which edge of the chip the menu hangs from. */
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onOutside = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onOutside);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onOutside);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const pick = async (value: TrustStatus) => {
    if (value === current) {
      setOpen(false);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await updateResourceTrustStatus(resourceID, value);
      onSaved(res.trustStatus);
      setOpen(false);
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 403
          ? "Only an admin can change this."
          : err instanceof ApiError
          ? err.message
          : "Couldn't update the status. Try again.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    // Sits inside clickable rows: keep its clicks and Enter from opening the row.
    <div className="csp" ref={wrapRef} onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
      <button
        type="button"
        className={`chip ${trustStatusTone(current)} csp-btn`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => {
          setError(null);
          setOpen((o) => !o);
        }}
        title="Change trust status"
      >
        {trustStatusLabel(current)}
        <ChevronDown size={12} className={`csp-chev${open ? " up" : ""}`} />
      </button>
      {open && (
        <div className={`csp-menu${align === "right" ? " right" : ""}`} role="menu">
          {TRUST_STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              role="menuitemradio"
              aria-checked={current === s}
              className={`csp-opt${current === s ? " on" : ""}`}
              onClick={() => pick(s)}
              disabled={saving}
            >
              <span className={`csp-dot ${trustStatusTone(s)}`} />
              <span className="csp-opt-text">
                <span className="t">{trustStatusLabel(s)}</span>
                <span className="s">{HINT[s]}</span>
              </span>
            </button>
          ))}
          {error && <div className="csp-error">{error}</div>}
        </div>
      )}
    </div>
  );
}

