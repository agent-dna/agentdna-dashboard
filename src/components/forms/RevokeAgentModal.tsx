import { useEffect, useState } from "react";
import { Modal } from "../Modal";
import { Icon } from "../Icon";
import { errorStyle } from "./styles";
import { revokeAgent, unrevokeAgent } from "../../api/agents";
import { ApiError } from "../../api/client";

type Mode = "revoke" | "whitelist";

interface Props {
  open: boolean;
  agentDID: string;
  agentName: string;
  /** "revoke" (default) blocks the agent; "whitelist" reverses a prior revoke via /unrevoke-agent. */
  mode?: Mode;
  onClose: () => void;
  onSuccess: () => void;
}

type Phase = "confirm" | "working" | "success";

const COPY: Record<Mode, {
  actionLabel: string;
  workingLabel: string;
  modalTitle: string;
  confirmBody: (name: string) => string;
  successTitle: (name: string) => string;
  successBody: string;
  color: string;
  bg: string;
  border: string;
  buttonClass: string;
}> = {
  revoke: {
    actionLabel: "Revoke agent",
    workingLabel: "Revoking…",
    modalTitle: "Revoke agent",
    confirmBody: (name) =>
      `This will permanently revoke ${name}. It will lose all access to connected apps and will no longer be able to handle intents.`,
    successTitle: (name) => `"${name}" has been revoked`,
    successBody: "This agent can no longer interact with connected apps or intents.",
    color: "var(--threat)",
    bg: "linear-gradient(135deg, rgba(220,38,38,0.18), rgba(220,38,38,0.04))",
    border: "1px solid rgba(220,38,38,0.22)",
    buttonClass: "btn danger solid",
  },
  whitelist: {
    actionLabel: "Whitelist agent",
    workingLabel: "Whitelisting…",
    modalTitle: "Whitelist agent",
    confirmBody: (name) => `This will reverse the revoke on ${name}, restoring its access to connected apps and intents.`,
    successTitle: (name) => `"${name}" has been whitelisted`,
    successBody: "This agent can interact with connected apps and handle intents again.",
    color: "var(--safe)",
    bg: "linear-gradient(135deg, rgba(5,150,105,0.18), rgba(5,150,105,0.04))",
    border: "1px solid rgba(5,150,105,0.22)",
    buttonClass: "btn safe solid",
  },
};

export function RevokeAgentModal({ open, agentDID, agentName, mode = "revoke", onClose, onSuccess }: Props) {
  const [phase, setPhase] = useState<Phase>("confirm");
  const [err, setErr] = useState<string | null>(null);
  const copy = COPY[mode];

  useEffect(() => {
    if (open) {
      setPhase("confirm");
      setErr(null);
    }
  }, [open]);

  const doAction = async () => {
    setErr(null);
    setPhase("working");
    try {
      if (mode === "revoke") await revokeAgent(agentDID);
      else await unrevokeAgent(agentDID);
      setPhase("success");
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : `Failed to ${mode === "revoke" ? "revoke" : "whitelist"} agent`);
      setPhase("confirm");
    }
  };

  const handleDone = () => {
    setPhase("confirm");
    onSuccess();
  };

  if (phase === "success") {
    return (
      <Modal
        open={open}
        title={mode === "revoke" ? "Agent revoked" : "Agent whitelisted"}
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
              background: copy.bg,
              color: copy.color,
              border: copy.border,
            }}
          >
            <Icon name="shield" size={28} />
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
              {copy.successTitle(agentName)}
            </div>
            <div style={{ fontSize: 13, color: "var(--fg-muted)", lineHeight: 1.55, maxWidth: 360 }}>
              {copy.successBody}
            </div>
          </div>
        </div>
      </Modal>
    );
  }

  const working = phase === "working";
  return (
    <Modal
      open={open}
      title={copy.modalTitle}
      onClose={working ? () => {} : onClose}
      footer={
        <>
          <button type="button" className="btn ghost" onClick={onClose} disabled={working}>
            Cancel
          </button>
          <button
            type="button"
            className={copy.buttonClass}
            onClick={doAction}
            disabled={working}
            style={{ minWidth: 130, justifyContent: "center" }}
          >
            {working ? (
              <>
                <Spinner size={14} /> {copy.workingLabel}
              </>
            ) : (
              <>
                <Icon name="shield" size={14} />
                {copy.actionLabel}
              </>
            )}
          </button>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ fontSize: 13.5, color: "var(--fg)", lineHeight: 1.55 }}>{copy.confirmBody(agentName)}</div>
        {err && <div style={errorStyle}>{err}</div>}
      </div>
    </Modal>
  );
}

function Spinner({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      style={{ animation: "revoke-spin 0.9s linear infinite" }}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.18" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <style>{`@keyframes revoke-spin { to { transform: rotate(360deg); } }`}</style>
    </svg>
  );
}
