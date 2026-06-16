import { Modal } from "../Modal";
import { Icon } from "../Icon";

export type DeployPhase = "loading" | "done" | "error";

interface Props {
  open: boolean;
  phase: DeployPhase;
  agentName?: string;
  errorMessage?: string;
  onClose: () => void;
}

/**
 * Two-state modal shown while an admin is approving a deploy_agent request:
 *   1. "loading" — spinner + "Deploying your agent securely"
 *   2. "done"    — green check + "Deployed"
 * The parent flips `phase` once the approval API resolves.
 */
export function DeployAgentModal({ open, phase, agentName, errorMessage, onClose }: Props) {
  const dismissable = phase !== "loading";

  return (
    <Modal
      open={open}
      title={
        phase === "done"
          ? "Deployment complete"
          : phase === "error"
          ? "Deployment failed"
          : "Deploying agent"
      }
      onClose={dismissable ? onClose : () => undefined}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
          padding: "12px 4px 4px",
          gap: 18,
        }}
      >
        {phase === "loading" && <Spinner />}
        {phase === "done" && <CheckBadge />}
        {phase === "error" && <ErrorBadge />}

        <div>
          <div
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 18,
              fontWeight: 600,
              color: "var(--fg)",
              marginBottom: 8,
            }}
          >
            {phase === "loading" && "Deploying your agent securely"}
            {phase === "done" && (agentName ? `${agentName} deployed` : "Deployed")}
            {phase === "error" && "We couldn't deploy this agent"}
          </div>
          <div style={{ fontSize: 13, color: "var(--fg-muted)", lineHeight: 1.55, maxWidth: 360 }}>
            {phase === "loading" &&
              "Signing the deployment block, anchoring it on-chain, and provisioning the agent's policy. This usually takes a couple of seconds."}
            {phase === "done" &&
              "The agent is now live and visible in the Agents list. The requester has been notified."}
            {phase === "error" && (errorMessage || "The deployment didn't go through. Please try again.")}
          </div>
        </div>
      </div>
    </Modal>
  );
}

function Spinner() {
  return (
    <div
      style={{
        width: 56,
        height: 56,
        borderRadius: 999,
        border: "3px solid rgba(37,99,235,0.18)",
        borderTopColor: "var(--accent)",
        animation: "deploySpin 0.9s linear infinite",
      }}
    >
      <style>{`@keyframes deploySpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function CheckBadge() {
  return (
    <div
      style={{
        width: 56,
        height: 56,
        borderRadius: 999,
        display: "grid",
        placeItems: "center",
        background: "linear-gradient(135deg, rgba(5,150,105,0.20), rgba(5,150,105,0.04))",
        color: "var(--safe)",
        border: "1px solid rgba(5,150,105,0.25)",
        animation: "deployPop 360ms cubic-bezier(0.2, 1.4, 0.4, 1)",
      }}
    >
      <Icon name="check" size={28} />
      <style>{`@keyframes deployPop { 0% { transform: scale(0.6); opacity: 0; } 60% { transform: scale(1.08); opacity: 1; } 100% { transform: scale(1); opacity: 1; } }`}</style>
    </div>
  );
}

function ErrorBadge() {
  return (
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
      <Icon name="close" size={28} />
    </div>
  );
}
