import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { ApiError } from "../api/client";
import { CREDENTIAL_STATUSES, updateCredentialStatus, type CredentialStatus, type CredentialStatusValue } from "../data/api";
import { credentialStatusLabel } from "./CredentialStatusChip";

const TONE: Record<CredentialStatusValue, string> = { active: "safe", flagged: "warn", compromised: "threat" };
const HINT: Record<CredentialStatusValue, string> = {
  active: "Nothing wrong with it",
  flagged: "Needs a closer look",
  compromised: "Leaked or misused (still accepted)",
};
const REASON_MAX = 1000;

/**
 * A credential's status as a chip that is also the control (admins only): click it, optionally
 * add a reason, pick a status. The choice saves straight away (POST /update-credential-status).
 */
export function CredentialStatusPicker({ credentialID, current, onSaved }: {
  credentialID: string;
  current: CredentialStatus;
  onSaved: (status: CredentialStatus) => void;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
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

  const toggle = () => {
    if (!open) {
      setReason(current.reason);
      setError(null);
    }
    setOpen((o) => !o);
  };

  const pick = async (value: CredentialStatusValue) => {
    setSaving(true);
    setError(null);
    try {
      const res = await updateCredentialStatus(credentialID, value, reason.trim());
      onSaved(res.status);
      setOpen(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't update the status. Try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="csp" ref={wrapRef}>
      <button
        type="button"
        className={`chip ${TONE[current.value]} csp-btn`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={toggle}
        title="Change status"
      >
        {credentialStatusLabel(current.value)}
        <ChevronDown size={12} className={`csp-chev${open ? " up" : ""}`} />
      </button>
      {open && (
        <div className="csp-menu" role="menu">
          <label className="csp-reason">
            <span>Reason (optional)</span>
            <input
              type="text"
              value={reason}
              maxLength={REASON_MAX}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. token found in public logs"
              disabled={saving}
            />
          </label>
          {CREDENTIAL_STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              role="menuitemradio"
              aria-checked={current.value === s}
              className={`csp-opt${current.value === s ? " on" : ""}`}
              onClick={() => pick(s)}
              disabled={saving}
            >
              <span className={`csp-dot ${TONE[s]}`} />
              <span className="csp-opt-text">
                <span className="t">{credentialStatusLabel(s)}</span>
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
