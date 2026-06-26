import type { ReactNode } from "react";

interface InfoStatProps {
  label: string;
  value: ReactNode;
  mono?: boolean;
}

export function InfoStat({ label, value, mono = false }: InfoStatProps) {
  return (
    <div>
      <div
        style={{
          fontSize: 10.5,
          color: "var(--fg-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          marginBottom: 6,
          fontWeight: 600,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 14,
          color: "var(--fg)",
          fontFamily: mono ? "var(--font-mono)" : "var(--font-body)",
          fontWeight: 500,
        }}
      >
        {value}
      </div>
    </div>
  );
}
