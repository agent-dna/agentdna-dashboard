import { useEffect, useState, type FormEvent } from "react";
import { Modal } from "../Modal";
import { Icon } from "../Icon";
import { PolicyFilePicker } from "./PolicyFilePicker";
import { ViewPolicyModal } from "./ViewPolicyModal";
import { errorStyle, formStyle, inputStyle, labelStyle } from "./styles";
import {
  createAgentRequest,
  editAgentRequest,
  type AgentRequest,
} from "../../api/requests";
import { ApiError } from "../../api/client";

interface Props {
  open: boolean;
  /** If set, modal is in edit mode for this request; otherwise create. */
  editTarget?: AgentRequest | null;
  /** Affects title and submit label (Admin: "Create agent" / User: "Request agent"). */
  isAdmin?: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function AgentRequestModal({ open, editTarget, isAdmin, onClose, onSuccess }: Props) {
  const editing = !!editTarget;
  const [agentName, setAgentName] = useState("");
  const [agentId, setAgentId] = useState("");
  const [requestInfo, setRequestInfo] = useState("");
  const [policyFile, setPolicyFile] = useState<File | null>(null);
  const [policyText, setPolicyText] = useState("");
  const [policyEditOpen, setPolicyEditOpen] = useState(false);
  const [viewPolicyOpen, setViewPolicyOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [submittedAgentName, setSubmittedAgentName] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setAgentName(editTarget?.agentName || "");
      setAgentId(editTarget?.agentDID || "");
      setRequestInfo(editTarget?.requestInfo || "");
      setPolicyFile(null);
      // In edit mode, prefill the textarea with the existing policy so the user
      // can tweak rather than rewrite from scratch.
      setPolicyText(editTarget?.policy || "");
      setPolicyEditOpen(false);
      setViewPolicyOpen(false);
      setErr(null);
      setSubmittedAgentName(null);
    }
  }, [open, editTarget]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);

    const trimmedName = agentName.trim();
    const trimmedId = agentId.trim();
    const trimmedInfo = requestInfo.trim();
    const trimmedPolicyText = policyText.trim();

    if (!editing && !policyFile && !trimmedPolicyText) {
      setErr("Please attach a policy file or paste policy text.");
      return;
    }

    setSubmitting(true);
    try {
      if (editing && editTarget) {
        // Edit endpoint stays JSON for now — multipart only required on create.
        // If the user touched the policy editor, send the new text; otherwise
        // pass through whatever was on the request so we don't wipe it.
        const nextPolicy = policyEditOpen ? trimmedPolicyText : editTarget.policy || "";
        await editAgentRequest({
          requestID: editTarget.requestID,
          agentName: trimmedName,
          policy: nextPolicy,
          requestInfo: trimmedInfo,
          ...(trimmedId ? { agentID: trimmedId } : {}),
        });
        onSuccess();
      } else {
        await createAgentRequest({
          agentName: trimmedName,
          agentID: trimmedId || undefined,
          requestInfo: trimmedInfo || undefined,
          policyFile: policyFile || undefined,
          policyText: !policyFile ? trimmedPolicyText : undefined,
        });
        setSubmittedAgentName(trimmedName);
      }
    } catch (e2) {
      setErr(e2 instanceof ApiError ? e2.message : "Failed to submit");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDone = () => {
    setSubmittedAgentName(null);
    onSuccess();
  };

  const title = editing
    ? "Edit agent request"
    : isAdmin
    ? "Create agent"
    : "Request agent creation";
  const submitLabel = editing
    ? submitting
      ? "Saving…"
      : "Save changes"
    : submitting
    ? "Submitting…"
    : isAdmin
    ? "Create agent"
    : "Submit request";

  if (submittedAgentName) {
    return (
      <Modal
        open={open}
        title={isAdmin ? "Agent submitted" : "Request submitted"}
        onClose={handleDone}
        footer={
          <button type="button" className="btn primary" onClick={handleDone}>
            Done
          </button>
        }
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            padding: "12px 8px 4px",
            gap: 16,
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 999,
              display: "grid",
              placeItems: "center",
              background: "linear-gradient(135deg, rgba(5,150,105,0.18), rgba(5,150,105,0.04))",
              color: "var(--safe)",
              border: "1px solid rgba(5,150,105,0.22)",
            }}
          >
            <Icon name="check" size={28} />
          </div>
          <div>
            <div
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 18,
                fontWeight: 600,
                color: "var(--fg)",
                marginBottom: 6,
              }}
            >
              Request for “{submittedAgentName}” submitted
            </div>
            <div style={{ fontSize: 13, color: "var(--fg-muted)", lineHeight: 1.55, maxWidth: 360 }}>
              {isAdmin
                ? "The request is now pending. Approve it from the Requests page to deploy the agent."
                : "An admin needs to review and approve your request. You'll see status updates on the Requests page."}
            </div>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      open={open}
      title={title}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          <button type="submit" form="agent-request-form" className="btn primary" disabled={submitting}>
            {submitLabel}
          </button>
        </>
      }
    >
      <form id="agent-request-form" onSubmit={onSubmit} style={formStyle}>
        <label style={labelStyle}>
          Agent name
          <input
            type="text"
            required
            value={agentName}
            onChange={(e) => setAgentName(e.target.value)}
            placeholder="e.g. WeatherAgent"
            style={inputStyle}
          />
        </label>

        <label style={labelStyle}>
          Agent ID
          <input
            type="text"
            value={agentId}
            onChange={(e) => setAgentId(e.target.value)}
            placeholder="did:rubix:agent…"
            style={{ ...inputStyle, fontFamily: "var(--font-mono)", fontSize: 12.5 }}
          />
          <span style={{ fontSize: 11.5, color: "var(--fg-muted)", fontWeight: 400 }}>
            Optional — leave blank to let the backend assign one on approval.
          </span>
        </label>

        {editing && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 500, color: "var(--fg-dim)" }}>Policy</span>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                className="btn"
                style={{ padding: "6px 12px", fontSize: 12.5 }}
                onClick={() => setViewPolicyOpen(true)}
                disabled={!editTarget?.policy}
                title={editTarget?.policy ? "View current policy" : "No policy attached"}
              >
                <Icon name="eye" size={13} />
                View policy
              </button>
              <button
                type="button"
                className={`btn ${policyEditOpen ? "primary" : ""}`}
                style={{ padding: "6px 12px", fontSize: 12.5 }}
                onClick={() => setPolicyEditOpen((o) => !o)}
              >
                <Icon name="settings" size={13} />
                {policyEditOpen ? "Cancel policy edit" : "Edit policy"}
              </button>
            </div>
          </div>
        )}

        {(!editing || policyEditOpen) && (
          <>
            <PolicyFilePicker
              file={policyFile}
              onChange={(f) => {
                setPolicyFile(f);
                if (f) setPolicyText("");
              }}
              label={editing ? "Replace with new policy file (.md / .txt)" : "Policy file (.md / .txt)"}
            />
            <label style={labelStyle}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>or paste policy as text</span>
                {policyFile && (
                  <span style={{ fontSize: 11.5, color: "var(--fg-muted)" }}>disabled — using uploaded file</span>
                )}
              </div>
              <textarea
                value={policyText}
                onChange={(e) => setPolicyText(e.target.value)}
                rows={8}
                placeholder="Paste policy markdown / text here"
                disabled={!!policyFile}
                style={{
                  ...inputStyle,
                  fontFamily: "var(--font-mono)",
                  fontSize: 12.5,
                  resize: "vertical",
                  opacity: policyFile ? 0.5 : 1,
                }}
              />
            </label>
          </>
        )}

        {err && <div style={errorStyle}>{err}</div>}
      </form>

      <ViewPolicyModal
        open={viewPolicyOpen}
        name={editTarget?.agentName || "Request policy"}
        content={editTarget?.policy}
        emptyMessage="No policy text on this request."
        onClose={() => setViewPolicyOpen(false)}
      />
    </Modal>
  );
}
