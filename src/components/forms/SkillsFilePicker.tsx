import { useRef, type ChangeEvent } from "react";
import { Icon } from "../Icon";

interface SkillsFilePickerProps {
  onLoaded: (text: string, filename: string) => void;
}

const ACCEPTED = ".md,.txt,text/markdown,text/plain";

export function SkillsFilePicker({ onLoaded }: SkillsFilePickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const lower = file.name.toLowerCase();
    if (!(lower.endsWith(".md") || lower.endsWith(".txt"))) {
      alert("Please pick a .md or .txt file");
      e.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => onLoaded(String(reader.result || ""), file.name);
    reader.readAsText(file);
    e.target.value = "";
  };

  return (
    <button
      type="button"
      className="btn"
      style={{ alignSelf: "flex-start", padding: "6px 12px", fontSize: 12.5 }}
      onClick={() => inputRef.current?.click()}
    >
      <Icon name="download" size={12} style={{ transform: "rotate(180deg)" }} />
      Load .md / .txt
      <input ref={inputRef} type="file" accept={ACCEPTED} onChange={onChange} style={{ display: "none" }} />
    </button>
  );
}
