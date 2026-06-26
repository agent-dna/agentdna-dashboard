import type { CSSProperties } from "react";

export const formStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 14,
};

export const inputStyle: CSSProperties = {
  width: "100%",
  background: "var(--bg-1)",
  border: "1px solid var(--line)",
  color: "var(--fg)",
  padding: "10px 12px",
  borderRadius: 8,
  fontFamily: "inherit",
  fontSize: 13.5,
  outline: "none",
};

export const labelStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 500,
  color: "var(--fg-dim)",
  display: "flex",
  flexDirection: "column",
  gap: 6,
};

export const errorStyle: CSSProperties = {
  fontSize: 12.5,
  color: "var(--threat)",
  background: "rgba(220, 38, 38, 0.06)",
  border: "1px solid rgba(220, 38, 38, 0.18)",
  borderRadius: 8,
  padding: "8px 12px",
};
