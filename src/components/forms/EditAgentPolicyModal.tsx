import { useEffect, useState, type FormEvent } from "react";
import { Modal } from "../Modal";
import { PolicyFilePicker } from "./PolicyFilePicker";
import { errorStyle, formStyle } from "./styles";
import { uploadAgentPolicy } from "../../api/policy";
import { ApiError } from "../../api/client";

interface Props {
  open: boolean;
  agentDID: string;
  agentName: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function EditAgentPolicyModal({ open, agentDID, agentName, onClose, onSuccess }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setFile(null);
      setErr(null);
    }
  }, [open]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!file) {
      setErr("Pick a .md or .txt policy file first");
      return;
    }
    setErr(null);
    setSubmitting(true);
    try {
      await uploadAgentPolicy(agentDID, file);
      onSuccess();
    } catch (e2) {
      setErr(e2 instanceof ApiError ? e2.message : "Failed to upload policy");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      title={`Edit policy · ${agentName}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          <button
            type="submit"
            form="edit-agent-policy-form"
            className="btn primary"
            disabled={submitting || !file}
          >
            {submitting ? "Uploading…" : "Upload policy"}
          </button>
        </>
      }
    >
      <form id="edit-agent-policy-form" onSubmit={onSubmit} style={formStyle}>
        <div style={{ fontSize: 12.5, color: "var(--fg-muted)" }}>
          Replace this agent's policy by uploading a new .md or .txt file. The new policy takes effect immediately.
        </div>
        <PolicyFilePicker file={file} onChange={setFile} label="New policy file" />
        {err && <div style={errorStyle}>{err}</div>}
      </form>
    </Modal>
  );
}
