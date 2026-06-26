import { useEffect, useState, type FormEvent } from "react";
import { Modal } from "../Modal";
import { Icon } from "../Icon";
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

type Phase = "idle" | "uploading" | "success";

export function EditAgentPolicyModal({ open, agentDID, agentName, onClose, onSuccess }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setFile(null);
      setErr(null);
      setPhase("idle");
    }
  }, [open]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!file) {
      setErr("Pick a .md or .txt policy file first");
      return;
    }
    setErr(null);
    setPhase("uploading");
    try {
      await uploadAgentPolicy(agentDID, file);
      setPhase("success");
    } catch (e2) {
      setErr(e2 instanceof ApiError ? e2.message : "Failed to upload policy");
      setPhase("idle");
    }
  };

  const handleDone = () => {
    setPhase("idle");
    onSuccess();
  };

  // ---- Success view ----
  if (phase === "success") {
    return (
      <Modal
        open={open}
        title="Policy updated"
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
              Policy uploaded for “{agentName}”
            </div>
            <div style={{ fontSize: 13, color: "var(--fg-muted)", lineHeight: 1.55, maxWidth: 360 }}>
              The new policy is now in effect. The agent's behaviour will reflect it on its next interaction.
            </div>
          </div>
        </div>
      </Modal>
    );
  }

  // ---- Form view (with uploading overlay) ----
  const uploading = phase === "uploading";
  return (
    <Modal
      open={open}
      title={`Edit policy · ${agentName}`}
      onClose={uploading ? () => {} : onClose}
      footer={
        <>
          <button type="button" className="btn ghost" onClick={onClose} disabled={uploading}>
            Cancel
          </button>
          <button
            type="submit"
            form="edit-agent-policy-form"
            className="btn primary"
            disabled={uploading || !file}
            style={{ minWidth: 130, justifyContent: "center" }}
          >
            {uploading ? (
              <>
                <Spinner size={14} /> Uploading…
              </>
            ) : (
              "Upload policy"
            )}
          </button>
        </>
      }
    >
      <form
        id="edit-agent-policy-form"
        onSubmit={onSubmit}
        style={{ ...formStyle, position: "relative", opacity: uploading ? 0.6 : 1, pointerEvents: uploading ? "none" : "auto" }}
      >
        <div style={{ fontSize: 12.5, color: "var(--fg-muted)" }}>
          Replace this agent's policy by uploading a new .md or .txt file. The new policy takes effect immediately.
        </div>
        <PolicyFilePicker file={file} onChange={setFile} label="New policy file" />
        {err && <div style={errorStyle}>{err}</div>}
        {uploading && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "grid",
              placeItems: "center",
              background: "rgba(255,255,255,0.55)",
              backdropFilter: "blur(2px)",
              borderRadius: 10,
              pointerEvents: "auto",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                background: "var(--bg-1)",
                border: "1px solid var(--line-strong)",
                borderRadius: 999,
                padding: "8px 16px",
                boxShadow: "0 8px 24px rgba(15,32,70,0.12)",
              }}
            >
              <Spinner size={16} />
              <span style={{ fontSize: 13, fontWeight: 500, color: "var(--fg)" }}>Uploading policy…</span>
            </div>
          </div>
        )}
      </form>
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
      style={{ animation: "policy-spin 0.9s linear infinite" }}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.18" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <style>{`@keyframes policy-spin { to { transform: rotate(360deg); } }`}</style>
    </svg>
  );
}
