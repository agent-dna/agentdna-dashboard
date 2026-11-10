import { RevokeModal, REVOKE_STYLE, type RevokeCopy, type RevokeMode } from "./RevokeAgentModal";
import { updateUserStatus } from "../../api/users";

interface Props {
  open: boolean;
  /** The user's email (`userName` on /user-info). The change applies to the whole user. */
  userEmail: string;
  userName: string;
  /** "revoke" sends is_active: false, "whitelist" sends is_active: true. */
  mode: RevokeMode;
  onClose: () => void;
  onSuccess: () => void;
}

const COPY: Record<RevokeMode, RevokeCopy> = {
  revoke: {
    actionLabel: "Revoke user",
    workingLabel: "Revoking…",
    modalTitle: "Revoke user",
    confirmBody: (name) => `Are you sure you want to revoke access for "${name}"? You can whitelist the user again later.`,
    successTitle: (name) => `"${name}" has been revoked`,
    successBody: "Requests made by the user will be refused until you whitelist them again.",
    ...REVOKE_STYLE.revoke,
  },
  whitelist: {
    actionLabel: "Whitelist user",
    workingLabel: "Whitelisting…",
    modalTitle: "Whitelist user",
    confirmBody: (name) => `This will reverse the revoke on "${name}", restoring their access.`,
    successTitle: (name) => `"${name}" has been whitelisted`,
    successBody: "Requests made by the user are accepted again.",
    ...REVOKE_STYLE.whitelist,
  },
};

// Errors (status: false) surface the backend's message as-is via ApiError.
export function RevokeUserModal({ open, userEmail, userName, mode, onClose, onSuccess }: Props) {
  return (
    <RevokeModal
      open={open}
      name={userName}
      copy={COPY[mode]}
      successHeading={mode === "revoke" ? "User revoked" : "User whitelisted"}
      failureMessage={`Failed to ${mode === "revoke" ? "revoke" : "whitelist"} user`}
      run={() => updateUserStatus(userEmail, mode === "whitelist")}
      onClose={onClose}
      onSuccess={onSuccess}
    />
  );
}
