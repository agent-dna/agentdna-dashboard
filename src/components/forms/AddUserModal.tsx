import { useEffect, useState, type FormEvent } from "react";
import { Modal } from "../Modal";
import { errorStyle, formStyle, inputStyle, labelStyle } from "./styles";
import { PolicyFilePicker } from "./PolicyFilePicker";
import { addUser } from "../../api/users";
import { uploadUserPolicy } from "../../api/policy";
import { ApiError } from "../../api/client";

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function AddUserModal({ open, onClose, onSuccess }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [policyFile, setPolicyFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setEmail("");
      setPassword("");
      setPolicyFile(null);
      setErr(null);
    }
  }, [open]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    setSubmitting(true);
    try {
      const res = await addUser({ email: email.trim(), password });
      if (policyFile) {
        try {
          await uploadUserPolicy(res.userID, policyFile);
        } catch (uploadErr) {
          // User was created but policy upload failed — surface it but don't block.
          setErr(
            (uploadErr instanceof ApiError ? uploadErr.message : "Policy upload failed") +
              " — user was still created; you can re-upload the policy from their profile.",
          );
          setSubmitting(false);
          return;
        }
      }
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
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          <button type="submit" form="add-user-form" className="btn primary" disabled={submitting}>
            {submitting ? "Creating…" : "Create user"}
          </button>
        </>
      }
    >
      <form id="add-user-form" onSubmit={onSubmit} style={formStyle}>
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
          <input
            type="text"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Set a starting password"
            style={inputStyle}
            autoComplete="new-password"
          />
          <span style={{ fontSize: 11.5, color: "var(--fg-muted)", fontWeight: 400 }}>
            Share this with the user securely. They can change it after first sign-in.
          </span>
        </label>
        <PolicyFilePicker file={policyFile} onChange={setPolicyFile} label="User policy (optional, .md / .txt)" />
        {err && <div style={errorStyle}>{err}</div>}
      </form>
    </Modal>
  );
}
