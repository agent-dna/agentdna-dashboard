import { useEffect, useState, type FormEvent } from "react";
import { Modal } from "../Modal";
import { errorStyle, formStyle, inputStyle, labelStyle } from "./styles";
import { addUser } from "../../api/users";
import { ApiError } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { Icon } from "../Icon";

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function AddUserModal({ open, onClose, onSuccess }: Props) {
  const { user } = useAuth();
  const defaultOrg = user?.org_id || "";

  const [userId, setUserId] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [orgID, setOrgID] = useState(defaultOrg);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setUserId("");
      setName("");
      setEmail("");
      setPassword("");
      setShowPassword(false);
      setOrgID(defaultOrg);
      setErr(null);
    }
  }, [open, defaultOrg]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    const trimmedUserId = userId.trim();
    const trimmedEmail = email.trim();
    const trimmedOrg = orgID.trim();
    if (!trimmedUserId) { setErr("User ID is required."); return; }
    if (!trimmedOrg) { setErr("Org ID is required."); return; }
    setSubmitting(true);
    try {
      await addUser({
        did: trimmedUserId,
        name: name.trim() || undefined,
        email: trimmedEmail,
        password,
        orgID: trimmedOrg,
      });
      onSuccess();
    } catch (e2) {
      setErr(e2 instanceof ApiError ? e2.message : "Failed to create user");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      title="Add user"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button type="submit" form="add-user-form" className="btn primary" disabled={submitting}
            style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 110, justifyContent: "center" }}>
            {submitting && (
              <span style={{
                width: 13, height: 13, border: "2px solid rgba(255,255,255,0.35)",
                borderTopColor: "#fff", borderRadius: "50%",
                display: "inline-block", animation: "spin 0.7s linear infinite",
              }} />
            )}
            {submitting ? "Creating…" : "Create user"}
          </button>
        </>
      }
    >
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <form id="add-user-form" onSubmit={onSubmit} style={formStyle}>

        <label style={labelStyle}>
          User ID
          <input
            type="text"
            required
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            placeholder="bafybmi…"
            style={{ ...inputStyle, fontFamily: "var(--font-mono)", fontSize: 12.5 }}
            autoComplete="off"
          />
        </label>

        <label style={labelStyle}>
          Name
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name"
            style={inputStyle}
            autoComplete="off"
          />
        </label>

        <label style={labelStyle}>
          Email
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="user@example.com"
            style={inputStyle}
          />
        </label>

        <label style={labelStyle}>
          Initial password
          <div style={{ position: "relative" }}>
            <input
              type={showPassword ? "text" : "password"}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Set a starting password"
              style={{ ...inputStyle, paddingRight: 40 }}
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              style={{
                position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                background: "none", border: "none", cursor: "pointer",
                color: "var(--fg-muted)", padding: 2, display: "grid", placeItems: "center",
              }}
              title={showPassword ? "Hide password" : "Show password"}
            >
              <Icon name={showPassword ? "eyeOff" : "eye"} size={15} />
            </button>
          </div>
          <span style={{ fontSize: 11.5, color: "var(--fg-muted)", fontWeight: 400 }}>
            Share this with the user securely. They can change it after first sign-in.
          </span>
        </label>

        <label style={labelStyle}>
          Org ID
          <input
            type="text"
            required
            value={orgID}
            onChange={(e) => setOrgID(e.target.value)}
            placeholder="Test_Org"
            style={{ ...inputStyle, fontFamily: "var(--font-mono)", fontSize: 12.5 }}
            autoComplete="off"
          />
          <span style={{ fontSize: 11.5, color: "var(--fg-muted)", fontWeight: 400 }}>
            Defaults to your org. Change only if assigning the user to a different org.
          </span>
        </label>

        {err && <div style={errorStyle}>{err}</div>}
      </form>
    </Modal>
  );
}
