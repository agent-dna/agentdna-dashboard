import { RevokeModal, REVOKE_STYLE, type RevokeCopy, type RevokeMode } from "./RevokeAgentModal";
import { updateUserStatus } from "../../api/users";
import { ApiError } from "../../api/client";

interface Props {
  open: boolean;
  /** The DID whose status changes. Only this DID is affected, not the user's others. */
  userDID: string;
  userName: string;
  /** How many other DIDs the user holds; they keep their own status. */
  otherDidCount: number;
  /** "revoke" sends is_active: false, "whitelist" sends is_active: true. */
  mode: RevokeMode;
  onClose: () => void;
  onSuccess: () => void;
}

function copyFor(mode: RevokeMode, otherDidCount: number): RevokeCopy {
  const others =
    otherDidCount > 0
      ? ` Their other ${otherDidCount === 1 ? "DID keeps its" : `${otherDidCount} DIDs keep their`} current status.`
      : "";
  return mode === "revoke"
    ? {
        actionLabel: "Revoke user",
        workingLabel: "Revoking…",
        modalTitle: "Revoke user",
        confirmBody: (name) =>
          `This will revoke ${name}. Requests made with this DID will be refused until you whitelist it again.${others}`,
        successTitle: (name) => `"${name}" has been revoked`,
        successBody: "Requests made with this DID will be refused until you whitelist it again.",
        ...REVOKE_STYLE.revoke,
      }
    : {
        actionLabel: "Whitelist user",
        workingLabel: "Whitelisting…",
        modalTitle: "Whitelist user",
        confirmBody: (name) => `This will reverse the revoke on ${name}, restoring access for this DID.${others}`,
        successTitle: (name) => `"${name}" has been whitelisted`,
        successBody: "Requests made with this DID are accepted again.",
        ...REVOKE_STYLE.whitelist,
      };
}

/** /update-user-status errors in plain words; a 400 passes the admin server's own message through. */
async function run(userDID: string, mode: RevokeMode) {
  try {
    return await updateUserStatus(userDID, mode === "whitelist");
  } catch (e) {
    if (e instanceof ApiError) {
      if (e.status === 403) throw new ApiError("Only admins can revoke or whitelist users.", 403);
      if (e.status === 404) throw new ApiError("The admin server doesn't recognise this user's DID.", 404);
      if (e.status >= 500)
        throw new ApiError("Couldn't reach the admin server, so nothing was changed. Try again in a moment.", e.status);
    }
    throw e;
  }
}

export function RevokeUserModal({ open, userDID, userName, otherDidCount, mode, onClose, onSuccess }: Props) {
  return (
    <RevokeModal
      open={open}
      name={userName}
      copy={copyFor(mode, otherDidCount)}
      successHeading={mode === "revoke" ? "User revoked" : "User whitelisted"}
      failureMessage={`Failed to ${mode === "revoke" ? "revoke" : "whitelist"} user`}
      run={() => run(userDID, mode)}
      onClose={onClose}
      onSuccess={onSuccess}
    />
  );
}
