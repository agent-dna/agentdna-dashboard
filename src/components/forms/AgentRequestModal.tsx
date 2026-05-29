import { useEffect, useState, type FormEvent } from "react";
import { Modal } from "../Modal";
import { Icon } from "../Icon";
import { SkillsFilePicker } from "./SkillsFilePicker";
import { errorStyle, formStyle, inputStyle, labelStyle } from "./styles";
import {
  createAgentRequest,
  editAgentRequest,
  submitAgentCreationResult,
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
  const [skills, setSkills] = useState("");
  const [skillsFilename, setSkillsFilename] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [submittedAgentName, setSubmittedAgentName] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setAgentName(editTarget?.agentName || "");
      setSkills(editTarget?.requestInfo || "");
      setSkillsFilename(null);
      setErr(null);
      setSubmittedAgentName(null);
    }
  }, [open, editTarget]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    setSubmitting(true);
    try {
      const trimmedName = agentName.trim();
      const payload = {
        agentName: trimmedName,
        // Backend requires `policy` — pass a default until the form needs to expose it.
        policy: "default",
        requestInfo: skills.trim(),
      };
      if (editing && editTarget) {
        await editAgentRequest({ requestID: editTarget.requestID, ...payload });
        // Edits don't have the same provisioning delay — close immediately.
        onSuccess();
      } else {
        const created = await createAgentRequest(payload);
        // Admin flow: auto-approve the request so the agent actually gets deployed.
        // Non-admin flow: stop here — request stays pending until an admin approves.
        if (isAdmin) {
          await submitAgentCreationResult(created.requestID, "approved");
        }
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
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", padding: "12px 8px 4px", gap: 16 }}>
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
            <div style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 600, color: "var(--fg)", marginBottom: 6 }}>
              {isAdmin
                ? `“${submittedAgentName}” is being provisioned`
                : `Request for “${submittedAgentName}” submitted`}
            </div>
            <div style={{ fontSize: 13, color: "var(--fg-muted)", lineHeight: 1.55, maxWidth: 360 }}>
              {isAdmin
                ? "The agent will appear on the dashboard in a couple of minutes once it's deployed on-chain. You can keep working — the list will refresh automatically when you close this dialog."
                : "An admin needs to review and approve your request. You'll see status updates in the Requests page."}
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
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>Skills (markdown / text)</span>
            {skillsFilename && (
              <span style={{ fontSize: 11.5, color: "var(--fg-muted)", fontFamily: "var(--font-mono)" }}>
                {skillsFilename}
              </span>
            )}
          </div>
          <SkillsFilePicker
            onLoaded={(text, name) => {
              setSkills(text);
              setSkillsFilename(name);
            }}
          />
          <textarea
            value={skills}
            onChange={(e) => {
              setSkills(e.target.value);
              if (skillsFilename) setSkillsFilename(null);
            }}
            rows={10}
            placeholder="Paste skills markdown here, or load a .md/.txt file above"
            style={{ ...inputStyle, fontFamily: "var(--font-mono)", fontSize: 12.5, resize: "vertical" }}
          />
        </label>
        {err && <div style={errorStyle}>{err}</div>}
      </form>
    </Modal>
  );
}
