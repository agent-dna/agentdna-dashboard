import { useEffect, useState, type FormEvent } from "react";
import { Modal } from "../Modal";
import { ApiError } from "../../api/client";
import {
  CREDENTIAL_STATUSES,
  updateCredentialStatus,
  type CredentialStatus,
  type CredentialStatusValue,
} from "../../data/api";
import { CredentialStatusChip } from "../CredentialStatusChip";
import { errorStyle, formStyle, inputStyle, labelStyle } from "./styles";

const REASON_MAX = 1000;

const HINT: Record<CredentialStatusValue, string> = {
  active: "Nothing wrong with it. Choose this to clear a flag.",
  flagged: "Looks suspicious and needs a closer look.",
  compromised: "Known to be leaked or misused. It is still accepted; this only marks it.",
};

interface Props {
  open: boolean;
  credentialID: string;
  current: CredentialStatus;
  onClose: () => void;
  onSaved: (status: CredentialStatus) => void;
}

/** Admins set a credential's status (POST /update-credential-status) with an optional reason. */
export function CredentialStatusModal({ open, credentialID, current, onClose, onSaved }: Props) {
  const [value, setValue] = useState<CredentialStatusValue>(current.value);
  const [reason, setReason] = useState(current.reason);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Start from the saved status each time the modal opens.
  useEffect(() => {
    if (!open) return;
    setValue(current.value);
    setReason(current.reason);
    setError(null);
  }, [open, current.value, current.reason]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await updateCredentialStatus(credentialID, value, reason.trim());
      onSaved(res.status);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't update the status. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      title="Credential status"
      onClose={() => !submitting && onClose()}
      footer={
        <>
          <button type="button" className="btn ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button type="submit" form="cred-status-form" className="btn primary" disabled={submitting}>
            {submitting ? "Saving…" : "Save"}
          </button>
        </>
      }
    >
      <form id="cred-status-form" onSubmit={onSubmit} style={formStyle}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {CREDENTIAL_STATUSES.map((s) => (
            <label
              key={s}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
                padding: "10px 12px",
                borderRadius: 8,
                cursor: "pointer",
                border: `1px solid ${value === s ? "var(--accent)" : "var(--line)"}`,
                background: value === s ? "rgba(37,99,235,0.04)" : undefined,
              }}
            >
              <input type="radio" name="cred-status" checked={value === s} onChange={() => setValue(s)} style={{ marginTop: 3 }} />
              <span style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <CredentialStatusChip value={s} />
                <span style={{ fontSize: 12.5, color: "var(--fg-muted)" }}>{HINT[s]}</span>
              </span>
            </label>
          ))}
        </div>

        <label style={labelStyle}>
          Reason (optional)
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={REASON_MAX}
            rows={3}
            placeholder="e.g. token found in public logs"
            style={{ ...inputStyle, resize: "vertical" }}
          />
          <span style={{ alignSelf: "flex-end", fontSize: 11, color: "var(--fg-faint)" }}>
            {reason.length}/{REASON_MAX}
          </span>
        </label>

        {error && <div style={errorStyle}>{error}</div>}
      </form>
    </Modal>
  );
}
