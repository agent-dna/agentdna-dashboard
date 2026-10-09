import { useNavigate } from "react-router-dom";
import { Icon } from "./Icon";

/**
 * Shown wherever the org has no agents yet. Mirrors the home page's empty state
 * so the "deploy your first agent" path looks the same everywhere it appears.
 */
export function EmptyAgentsState({ showBrowseLink = true }: { showBrowseLink?: boolean }) {
  const navigate = useNavigate();
  return (
    <div style={{ display: "flex", justifyContent: "center", padding: "24px 0 8px" }}>
      <div
        style={{
          maxWidth: 460,
          width: "100%",
          textAlign: "center",
          padding: "48px 40px",
          background: "var(--surface)",
          border: "1.5px dashed var(--line-strong)",
          borderRadius: 16,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 16,
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 14,
            background: "linear-gradient(135deg, rgba(37,99,235,0.12), rgba(10,34,64,0.10))",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 4,
          }}
        >
          <Icon name="agents" size={26} style={{ color: "var(--accent)" }} />
        </div>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "var(--fg)", marginBottom: 8 }}>
            No agents deployed yet
          </div>
          <div style={{ fontSize: 14, color: "var(--fg-muted)", lineHeight: 1.6 }}>
            Deploy your first agent to start monitoring interactions, detecting incidents, and tracking intents in real time.
          </div>
        </div>
        <button
          className="btn primary"
          style={{ marginTop: 8, padding: "10px 24px", fontSize: 14, fontWeight: 600 }}
          onClick={() => navigate("/profile")}
        >
          <Icon name="key" size={15} />
          Deploy your first agent
        </button>
        {showBrowseLink && (
          <div style={{ fontSize: 12, color: "var(--fg-faint)", marginTop: 4 }}>
            You can also browse existing{" "}
            <span
              style={{ color: "var(--accent)", cursor: "pointer", textDecoration: "underline" }}
              onClick={() => navigate("/agents")}
            >
              Agents &amp; Apps
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
