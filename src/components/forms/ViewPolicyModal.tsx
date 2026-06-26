import { Modal } from "../Modal";
import { Icon } from "../Icon";

interface Props {
  open: boolean;
  /** Label shown in the modal title, e.g. an agent or user name. */
  name: string;
  /** Raw policy text (.md / .txt content). Empty/missing → renders empty state. */
  content?: string;
  /** Optional metadata to display in the modal header. */
  filename?: string;
  uploadedAt?: string;
  /** Fallback message when content is missing. */
  emptyMessage?: string;
  onClose: () => void;
}

export function ViewPolicyModal({
  open,
  name,
  content,
  filename,
  uploadedAt,
  emptyMessage = "No policy uploaded yet.",
  onClose,
}: Props) {
  const hasContent = !!content && content.length > 0;

  const onCopy = () => {
    if (!content || !navigator.clipboard) return;
    navigator.clipboard.writeText(content);
  };

  const onDownload = () => {
    if (!content) return;
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename || `${name.replace(/\s+/g, "-").toLowerCase()}-policy.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <Modal
      open={open}
      title={`Policy · ${name}`}
      onClose={onClose}
      width={680}
      footer={
        <>
          {hasContent && (
            <>
              <button type="button" className="btn" onClick={onCopy}>
                <Icon name="copy" size={14} /> Copy
              </button>
              <button type="button" className="btn" onClick={onDownload}>
                <Icon name="download" size={14} /> Download
              </button>
            </>
          )}
          <button type="button" className="btn primary" onClick={onClose}>
            Close
          </button>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div style={{ fontSize: 12.5, color: "var(--fg-muted)" }}>
            {filename ? (
              <span style={{ fontFamily: "var(--font-mono)", color: "var(--fg-dim)" }}>{filename}</span>
            ) : (
              <span>Active policy content</span>
            )}
            {uploadedAt && (
              <span style={{ marginLeft: 10 }}>· uploaded {new Date(uploadedAt).toLocaleString()}</span>
            )}
          </div>
          {hasContent && (
            <span
              style={{
                fontSize: 11.5,
                color: "var(--fg-muted)",
                fontFamily: "var(--font-mono)",
                background: "var(--bg-2)",
                border: "1px solid var(--line)",
                padding: "2px 8px",
                borderRadius: 999,
              }}
            >
              {content!.length.toLocaleString()} chars
            </span>
          )}
        </div>

        {hasContent ? (
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
            {content}
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
            {emptyMessage}
          </div>
        )}
      </div>
    </Modal>
  );
}
