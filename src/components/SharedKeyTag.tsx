import { Users } from "lucide-react";

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;

/** A credential is shared when more than one user or agent (counted together) has used it. */
export const isSharedCredential = (userCount: number, agentCount: number) => userCount + agentCount > 1;

/**
 * "Shared access key": the credential was used by more than one user or agent. Renders nothing
 * otherwise, so callers can drop it in unconditionally.
 */
export function SharedKeyTag({ userCount, agentCount }: { userCount: number; agentCount: number }) {
  if (!isSharedCredential(userCount, agentCount)) return null;
  return (
    <span
      className="chip info"
      style={{ fontSize: 10.5, padding: "2px 7px", display: "inline-flex", alignItems: "center", gap: 4, whiteSpace: "nowrap", flexShrink: 0 }}
      title={`Used by ${plural(userCount, "user")} and ${plural(agentCount, "agent")}`}
    >
      <Users size={11} aria-hidden />
      Shared access key
    </span>
  );
}
