import type { CredentialStatusValue } from "../data/api";

const CHIP: Record<CredentialStatusValue, { cls: string; label: string }> = {
  active: { cls: "safe", label: "Active" },
  flagged: { cls: "warn", label: "Flagged" },
  compromised: { cls: "threat", label: "Compromised" },
};

export const credentialStatusLabel = (v: CredentialStatusValue) => CHIP[v].label;

/** A credential's status: green active, amber flagged, red compromised. */
export function CredentialStatusChip({ value, title }: { value: CredentialStatusValue; title?: string }) {
  const c = CHIP[value] ?? CHIP.active;
  return (
    <span className={`chip ${c.cls}`} style={{ fontSize: 11, padding: "2px 8px" }} title={title}>
      {c.label}
    </span>
  );
}
