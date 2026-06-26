import { useEffect, useState, type FormEvent } from "react";
import { Modal } from "../Modal";
import { errorStyle, formStyle, inputStyle, labelStyle } from "./styles";
import { createAccessRequest } from "../../api/requests";
import { ApiError } from "../../api/client";

interface Props {
  open: boolean;
  /** Optional prefill for the agent DID. */
  agentDID?: string;
  agentName?: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function AccessRequestModal({ open, agentDID, agentName, onClose, onSuccess }: Props) {
  const [did, setDid] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setDid(agentDID || "");
      setReason("");
      setErr(null);
    }
  }, [open, agentDID]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    setSubmitting(true);
    try {
      await createAccessRequest({
        agentDID: did.trim(),
        agentName,
        requestInfo: reason.trim(),
      });
      onSuccess();
    } catch (e2) {
      setErr(e2 instanceof ApiError ? e2.message : "Failed to submit");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      title={agentName ? `Request access · ${agentName}` : "Request agent access"}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          <button type="submit" form="access-request-form" className="btn primary" disabled={submitting}>
            {submitting ? "Submitting…" : "Submit request"}
          </button>
        </>
      }
    >
      <form id="access-request-form" onSubmit={onSubmit} style={formStyle}>
        <label style={labelStyle}>
          Agent DID
          <input
            type="text"
            required
            value={did}
            onChange={(e) => setDid(e.target.value)}
            placeholder="did:rubix:…"
            style={{ ...inputStyle, fontFamily: "var(--font-mono)", fontSize: 12.5 }}
            readOnly={!!agentDID}
          />
        </label>
        <label style={labelStyle}>
          Reason
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={4}
            placeholder="Tell the admin why you need access to this agent"
            style={{ ...inputStyle, resize: "vertical" }}
          />
        </label>
        {err && <div style={errorStyle}>{err}</div>}
      </form>
    </Modal>
  );
}
