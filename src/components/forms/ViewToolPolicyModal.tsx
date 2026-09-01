import { Modal } from "../Modal";
import { Icon } from "../Icon";
import type { ToolPolicyFile } from "../../data/api";

interface Props {
  open: boolean;
  /** e.g. "github" — shown in the modal title alongside the agent name. */
  toolName: string;
  agentName: string;
  file?: ToolPolicyFile;
  onClose: () => void;
}

const isPdf = (file: ToolPolicyFile) =>
  (file.filename || file.url || "").toLowerCase().endsWith(".pdf");

/** Views a tool's policy file for one agent — plain text inline, or a hosted file (PDF) embedded/linked. */
export function ViewToolPolicyModal({ open, toolName, agentName, file, onClose }: Props) {
  const hasText = !!file?.content;
  const hasFile = !!file?.url;

  return (
    <Modal
      open={open}
      title={`${toolName} policy · ${agentName}`}
      onClose={onClose}
      width={hasFile && isPdf(file!) ? 760 : 680}
      footer={
        <>
          {hasFile && (
            <a
              href={file!.url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn"
              style={{ textDecoration: "none" }}
            >
              <Icon name="arrowUpRight" size={14} /> Open in new tab
            </a>
          )}
          <button type="button" className="btn primary" onClick={onClose}>
            Close
          </button>
        </>
      }
    >
      {hasFile ? (
        isPdf(file!) ? (
          <iframe
            src={file!.url}
            title={`${toolName} policy`}
            style={{ width: "100%", height: 560, border: "1px solid var(--line)", borderRadius: 10 }}
          />
        ) : (
          <div
            style={{
              padding: 28,
              textAlign: "center",
              color: "var(--fg-muted)",
              background: "var(--bg-2)",
              border: "1px dashed var(--line-strong)",
              borderRadius: 10,
              fontSize: 13.5,
            }}
          >
            {file!.filename || "Policy file"} can't be previewed here — use "Open in new tab".
          </div>
        )
      ) : hasText ? (
        <pre
          style={{
            margin: 0,
            maxHeight: 460,
            overflow: "auto",
            background: "var(--bg-2)",
            border: "1px solid var(--line)",
            borderRadius: 10,
            padding: "14px 16px",
            fontFamily: "var(--font-mono)",
            fontSize: 12.5,
            lineHeight: 1.55,
            color: "var(--fg)",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {file!.content}
        </pre>
      ) : (
        <div
          style={{
            padding: 28,
            textAlign: "center",
            color: "var(--fg-muted)",
            background: "var(--bg-2)",
            border: "1px dashed var(--line-strong)",
            borderRadius: 10,
            fontSize: 13.5,
          }}
        >
          No policy file uploaded for this app yet.
        </div>
      )}
    </Modal>
  );
}
