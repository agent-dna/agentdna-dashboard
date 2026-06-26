import { useRef, type ChangeEvent } from "react";
import { Icon } from "../Icon";

interface PolicyFilePickerProps {
  file: File | null;
  onChange: (file: File | null) => void;
  label?: string;
}

const ACCEPTED = ".md,.txt,text/markdown,text/plain";

export function PolicyFilePicker({ file, onChange, label = "Policy file" }: PolicyFilePickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const onPick = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null;
    if (f) {
      const lower = f.name.toLowerCase();
      if (!(lower.endsWith(".md") || lower.endsWith(".txt"))) {
        alert("Please pick a .md or .txt file");
        e.target.value = "";
        return;
      }
    }
    onChange(f);
    e.target.value = "";
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <span style={{ fontSize: 12, fontWeight: 500, color: "var(--fg-dim)" }}>{label}</span>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 12px",
          background: "var(--bg-1)",
          border: "1px dashed var(--line-strong)",
          borderRadius: 8,
        }}
      >
        <Icon name="download" size={14} style={{ transform: "rotate(180deg)", color: "var(--fg-muted)" }} />
        <div style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
          {file ? (
            <div>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "var(--fg)",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {file.name}
              </div>
              <div style={{ fontSize: 11.5, color: "var(--fg-muted)", fontFamily: "var(--font-mono)" }}>
                {(file.size / 1024).toFixed(1)} kB
              </div>
            </div>
          ) : (
            <span style={{ fontSize: 12.5, color: "var(--fg-muted)" }}>No file selected (.md or .txt)</span>
          )}
        </div>
        <button
          type="button"
          className="btn"
          style={{ padding: "6px 12px", fontSize: 12.5 }}
          onClick={() => inputRef.current?.click()}
        >
          {file ? "Replace" : "Choose file"}
        </button>
        {file && (
          <button
            type="button"
            className="btn ghost"
            style={{ padding: "6px 10px", fontSize: 12.5 }}
            onClick={() => onChange(null)}
            aria-label="Remove file"
          >
            <Icon name="close" size={12} />
          </button>
        )}
        <input ref={inputRef} type="file" accept={ACCEPTED} onChange={onPick} style={{ display: "none" }} />
      </div>
    </div>
  );
}
