import { useEffect, useState } from "react";
import { Modal } from "../Modal";
import { Icon } from "../Icon";
import { errorStyle } from "./styles";
import { revokeAgent } from "../../api/agents";
import { ApiError } from "../../api/client";

interface Props {
  open: boolean;
  agentDID: string;
  agentName: string;
  onClose: () => void;
  onSuccess: () => void;
}

type Phase = "confirm" | "revoking" | "success";

export function RevokeAgentModal({ open, agentDID, agentName, onClose, onSuccess }: Props) {
  const [phase, setPhase] = useState<Phase>("confirm");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setPhase("confirm");
      setErr(null);
    }
  }, [open]);

  const doRevoke = async () => {
    setErr(null);
    setPhase("revoking");
    try {
      await revokeAgent(agentDID);
      setPhase("success");
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Failed to revoke agent");
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
        title="Agent revoked"
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
              background: "linear-gradient(135deg, rgba(220,38,38,0.18), rgba(220,38,38,0.04))",
              color: "var(--threat)",
              border: "1px solid rgba(220,38,38,0.22)",
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
              “{agentName}” has been revoked
            </div>
            <div style={{ fontSize: 13, color: "var(--fg-muted)", lineHeight: 1.55, maxWidth: 360 }}>
              This agent can no longer interact with connected apps or intents.
            </div>
          </div>
        </div>
      </Modal>
    );
  }

  const revoking = phase === "revoking";
  return (
    <Modal
      open={open}
      title="Revoke agent"
      onClose={revoking ? () => {} : onClose}
      footer={
        <>
          <button type="button" className="btn ghost" onClick={onClose} disabled={revoking}>
            Cancel
          </button>
          <button
            type="button"
            className="btn danger solid"
            onClick={doRevoke}
            disabled={revoking}
            style={{ minWidth: 130, justifyContent: "center" }}
          >
            {revoking ? (
              <>
                <Spinner size={14} /> Revoking…
              </>
            ) : (
              <>
                <Icon name="shield" size={14} />
                Revoke agent
              </>
            )}
          </button>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ fontSize: 13.5, color: "var(--fg)", lineHeight: 1.55 }}>
          This will permanently revoke <strong>{agentName}</strong>. It will lose all access to
          connected apps and will no longer be able to handle intents. 
        </div>
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
