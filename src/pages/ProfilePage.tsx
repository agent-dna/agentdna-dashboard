import { useEffect, useState, type CSSProperties } from "react";
import { Icon } from "../components/Icon";
import { useAuth } from "../context/AuthContext";
import { fetchTokenUsage, type TokenUsage } from "../api/keys";
import { fetchUserProfile, fetchAdminProfile, updateUserProfile, changePassword, type UserProfile, type AdminProfile } from "../api/profile";
import { ApiError } from "../api/client";

function maskKey(key: string) {
  if (!key) return "—";
  if (key.length <= 8) return "•".repeat(key.length);
  return key.slice(0, 4) + "•".repeat(Math.min(key.length - 8, 20)) + key.slice(-4);
}

const SUPPORT_EMAIL = "support@agentdna.ai";

export function ProfilePage() {
  const { user, patchUser, logout } = useAuth();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [adminProfile, setAdminProfile] = useState<AdminProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [msgSubject, setMsgSubject] = useState("");
  const [msgBody, setMsgBody] = useState("");
  const [usage, setUsage] = useState<TokenUsage | null>(null);
  const [usageLoading, setUsageLoading] = useState(true);

  const [editField, setEditField] = useState<"name" | "email" | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  const [pwOpen, setPwOpen] = useState(false);
  const [pwCurrent, setPwCurrent] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSaving, setPwSaving] = useState(false);
  const [pwSuccess, setPwSuccess] = useState(false);

  useEffect(() => {
    setProfileLoading(true);
    if (user?.is_admin) {
      fetchAdminProfile()
        .then((p) => { setAdminProfile(p); if (p.name) patchUser({ name: p.name }); })
        .catch(() => setAdminProfile(null))
        .finally(() => setProfileLoading(false));
    } else {
      fetchUserProfile()
        .then((p) => { setProfile(p); if (p.name) patchUser({ name: p.name }); })
        .catch(() => setProfile(null))
        .finally(() => setProfileLoading(false));
    }
  }, [user?.is_admin]);

  useEffect(() => {
    setUsageLoading(true);
    fetchTokenUsage()
      .then(setUsage)
      .catch(() => setUsage(null))
      .finally(() => setUsageLoading(false));
  }, []);

  const isAdmin = !!user?.is_admin;
  const activeProfile = isAdmin ? adminProfile : profile;
  const apiKey = activeProfile?.apiKey || user?.api_key || "";
  const displayName = activeProfile?.name || (isAdmin ? "ADMIN" : "");
  const displayEmail = activeProfile?.email || user?.email || "—";
  const displayOrg = activeProfile?.organizationID || user?.org_id || (isAdmin ? "AGENT_DNA_BETA" : "");
  const displayRole = isAdmin ? "Administrator" : "User";

  function formatDate(dateStr: string) {
    try { return new Date(dateStr).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }); }
    catch { return dateStr; }
  }
  function formatEpoch(epoch: number) {
    return new Date(epoch * 1000).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  }

  const memberSince = isAdmin && adminProfile?.createdAt
    ? formatEpoch(adminProfile.createdAt)
    : profile?.createdAt ? formatDate(profile.createdAt) : null;

  async function handleCopy() {
    if (!apiKey) return;
    try { await navigator.clipboard.writeText(apiKey); setCopied(true); window.setTimeout(() => setCopied(false), 2000); }
    catch { /* clipboard unavailable */ }
  }

  function sendMessage() {
    const sub = encodeURIComponent(msgSubject.trim() || "Support request");
    const body = encodeURIComponent(msgBody.trim());
    window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${sub}&body=${body}`;
  }

  function startEdit(field: "name" | "email") {
    setEditField(field);
    setEditValue(field === "name" ? (displayName || "") : (activeProfile?.email || ""));
    setEditError(null);
  }

  function cancelEdit() { setEditField(null); setEditValue(""); setEditError(null); }

  async function saveEdit() {
    if (!editField || !editValue.trim()) return;
    setEditSaving(true); setEditError(null);
    try {
      await updateUserProfile({ [editField]: editValue.trim() });
      const trimmed = editValue.trim();
      setProfile((prev) => prev ? { ...prev, [editField!]: trimmed } : prev);
      if (editField === "email") patchUser({ email: trimmed });
      cancelEdit();
    } catch (err) {
      setEditError(err instanceof ApiError ? err.message : "Failed to save changes.");
    } finally { setEditSaving(false); }
  }

  async function handlePasswordChange() {
    if (!pwCurrent.trim()) { setPwError("Current password is required."); return; }
    if (!pwNew.trim()) { setPwError("New password cannot be empty."); return; }
    if (pwNew !== pwConfirm) { setPwError("New passwords do not match."); return; }
    setPwSaving(true); setPwError(null);
    try {
      await changePassword({ currentPassword: pwCurrent, newPassword: pwNew });
      setPwOpen(false); setPwCurrent(""); setPwNew(""); setPwConfirm("");
      setPwSuccess(true); window.setTimeout(() => setPwSuccess(false), 4000);
    } catch (err) {
      setPwError(err instanceof ApiError ? err.message : "Failed to change password.");
    } finally { setPwSaving(false); }
  }

  const initials = (displayName || user?.email || "?")
    .split(/[\s@._-]+/).filter(Boolean).slice(0, 2).map((s) => s[0].toUpperCase()).join("");

  // Token usage computed values
  const usedTokens = usage?.tokensUsed ?? 0;
  const limitTokens = usage?.tokensLimit ?? 0;
  const remainingTokens = Math.max(0, limitTokens - usedTokens);
  const usagePct = limitTokens > 0 ? Math.min(100, (usedTokens / limitTokens) * 100) : 0;

  return (
    <div className="page" style={{ paddingBottom: 40 }}>

      {/* ── Identity header ── */}
      <div className="card" style={{ padding: "24px 28px", marginBottom: 20, display: "flex", alignItems: "center", gap: 20 }}>
        <div style={{
          width: 64, height: 64, borderRadius: "50%", flexShrink: 0,
          background: "linear-gradient(135deg, #101c3d 0%, #2450e6 100%)",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "#fff", fontSize: 24, fontWeight: 700, letterSpacing: "0.02em",
        }}>
          {initials}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: "var(--fg)", marginBottom: 4 }}>
            {profileLoading ? "—" : (displayName || displayEmail)}
          </div>
          <div style={{ fontSize: 13, color: "var(--fg-muted)", marginBottom: 10 }}>{displayEmail}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {displayOrg && (
              <span style={pillStyle}>{displayOrg}</span>
            )}
            <span style={pillStyle}>{displayRole}</span>
            {memberSince && <span style={pillStyle}>Since {memberSince}</span>}
          </div>
        </div>

        <button
          className="btn"
          onClick={() => startEdit("name")}
          style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 6 }}
        >
          <Icon name="user" size={13} />
          Edit profile
        </button>
      </div>

      {/* ── Two-column layout ── */}
      <div style={{ display: "grid", gridTemplateColumns: "7fr 5fr", gap: 20, alignItems: "start" }}>

        {/* ── Left column ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

          {/* Account details 2×2 */}
          <div className="card" style={{ padding: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--fg)", marginBottom: 18, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Account details
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
              {/* Name */}
              <AccountDetailCell
                label="Name"
                editing={editField === "name"}
                editValue={editValue}
                saving={editSaving}
                onEdit={() => startEdit("name")}
                onChange={setEditValue}
                onSave={saveEdit}
                onCancel={cancelEdit}
              >
                {profileLoading ? "—" : (displayName || "—")}
              </AccountDetailCell>

              {/* Email */}
              <AccountDetailCell
                label="Email"
                editing={editField === "email"}
                editValue={editValue}
                saving={editSaving}
                onEdit={() => startEdit("email")}
                onChange={setEditValue}
                onSave={saveEdit}
                onCancel={cancelEdit}
              >
                {profileLoading ? "—" : displayEmail}
              </AccountDetailCell>

              {/* Organization */}
              <AccountDetailCell label="Organization" readonly>
                {profileLoading ? "—" : displayOrg}
              </AccountDetailCell>

              {/* Role */}
              <AccountDetailCell label="Role" readonly>
                {displayRole}
              </AccountDetailCell>
            </div>

            {editError && (
              <div style={{ marginTop: 14, padding: "8px 10px", borderRadius: 7, background: "rgba(220,38,38,0.06)", border: "1px solid rgba(220,38,38,0.18)", color: "var(--threat)", fontSize: 12 }}>
                {editError}
              </div>
            )}
          </div>

          {/* Security */}
          <div className="card" style={{ padding: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--fg)", marginBottom: 18, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Security
            </div>

            {/* Password row */}
            <div style={{ borderBottom: "1px solid var(--line)", paddingBottom: 16, marginBottom: 16 }}>
              {!pwOpen ? (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--fg)" }}>Password</div>
                    <div style={{ fontSize: 12, color: "var(--fg-muted)", marginTop: 2 }}>Last changed: unknown</div>
                  </div>
                  <button className="btn" onClick={() => { setPwOpen(true); setPwError(null); }} style={{ fontSize: 12, padding: "6px 12px" }}>
                    Change
                  </button>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 2 }}>
                    <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--fg)" }}>Change password</span>
                    <button className="btn ghost" onClick={() => { setPwOpen(false); setPwError(null); setPwCurrent(""); setPwNew(""); setPwConfirm(""); }} style={{ fontSize: 12, padding: "4px 8px" }}>
                      Cancel
                    </button>
                  </div>
                  <input type="password" placeholder="Current password" value={pwCurrent} onChange={(e) => setPwCurrent(e.target.value)} style={fieldInputStyle} />
                  <input type="password" placeholder="New password" value={pwNew} onChange={(e) => setPwNew(e.target.value)} style={fieldInputStyle} />
                  <input type="password" placeholder="Confirm new password" value={pwConfirm} onChange={(e) => setPwConfirm(e.target.value)} style={fieldInputStyle} />
                  {pwError && (
                    <div style={{ padding: "8px 10px", borderRadius: 7, background: "rgba(220,38,38,0.06)", border: "1px solid rgba(220,38,38,0.18)", color: "var(--threat)", fontSize: 12 }}>
                      {pwError}
                    </div>
                  )}
                  <button className="btn primary" onClick={handlePasswordChange} disabled={pwSaving} style={{ alignSelf: "flex-start", fontSize: 12, padding: "7px 16px" }}>
                    {pwSaving ? "Saving…" : "Update password"}
                  </button>
                </div>
              )}
              {pwSuccess && (
                <div style={{ marginTop: 8, padding: "8px 10px", borderRadius: 7, background: "rgba(37,99,235,0.06)", border: "1px solid rgba(37,99,235,0.18)", color: "var(--accent)", fontSize: 12 }}>
                  Password updated successfully.
                </div>
              )}
            </div>

            {/* 2FA row */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--line)", paddingBottom: 16, marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--fg)" }}>Two-factor authentication</div>
                <div style={{ fontSize: 12, color: "var(--fg-muted)", marginTop: 2 }}>Add an extra layer of security to your account</div>
              </div>
              <button className="btn" disabled style={{ fontSize: 12, padding: "6px 12px", opacity: 0.4 }}>
                Enable
              </button>
            </div>

            {/* Sessions row */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--fg)" }}>Active sessions</div>
                <div style={{ fontSize: 12, color: "var(--fg-muted)", marginTop: 2 }}>Manage devices logged into your account</div>
              </div>
              <button className="btn" disabled style={{ fontSize: 12, padding: "6px 12px", opacity: 0.4 }}>
                View
              </button>
            </div>
          </div>

          {/* Deploy agent strip */}
          <div style={{
            background: "#0b1633", borderRadius: 14, padding: 24,
            border: "1px solid rgba(255,255,255,0.06)",
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.9)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Deploy your agent
            </div>
            <div style={{ fontSize: 12.5, color: "rgba(255,255,255,0.45)", marginBottom: 20 }}>
              Get up and running in minutes
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
              {[
                { step: "01", icon: "key" as const, title: "Copy your API key", desc: "Find your API key in the card on the right. This authenticates your agent with the AgentDNA platform." },
                { step: "02", icon: "helix" as const, title: "Install the SDK", desc: "Install the AgentDNA SDK in your project and initialise it with your API key and organisation ID." },
                { step: "03", icon: "activity" as const, title: "Wrap your agent", desc: "Wrap your agent's inference calls with the AgentDNA middleware to start capturing interactions automatically." },
              ].map(({ step, icon, title, desc }) => (
                <div key={step} style={{ padding: "16px 18px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 7, background: "rgba(95,131,232,0.18)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Icon name={icon} size={14} style={{ color: "#5f83e8" }} />
                    </div>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "rgba(255,255,255,0.3)", fontWeight: 600 }}>Step {step}</span>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.88)", marginBottom: 6 }}>{title}</div>
                  <div style={{ fontSize: 11.5, color: "rgba(255,255,255,0.4)", lineHeight: 1.55 }}>{desc}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 16, display: "flex", gap: 10 }}>
              <a href="https://docs.agentdna.ai/getting-started" target="_blank" rel="noopener noreferrer"
                style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 14px", background: "#5f83e8", color: "#fff", borderRadius: 8, fontSize: 12.5, fontWeight: 600 }}>
                <Icon name="arrowUpRight" size={13} />
                Full guide
              </a>
              <a href="https://docs.agentdna.ai/sdk" target="_blank" rel="noopener noreferrer"
                style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 14px", background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.7)", borderRadius: 8, fontSize: 12.5, fontWeight: 600, border: "1px solid rgba(255,255,255,0.1)" }}>
                <Icon name="box" size={13} />
                SDK reference
              </a>
            </div>
          </div>
        </div>

        {/* ── Right column ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

          {/* API Key card — dark */}
          <div style={{ background: "#0b1633", borderRadius: 14, padding: 24, border: "1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.9)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              API Key
            </div>
            <div style={{ fontSize: 12.5, color: "rgba(255,255,255,0.4)", marginBottom: 18 }}>
              Keep this secret — never share it publicly
            </div>

            {/* Key field */}
            <div style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 9, padding: "11px 14px", display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <Icon name="key" size={14} style={{ color: "rgba(255,255,255,0.35)", flexShrink: 0 }} />
              <span style={{ flex: 1, fontFamily: "var(--font-mono)", fontSize: 12.5, color: "rgba(255,255,255,0.85)", wordBreak: "break-all", letterSpacing: revealed ? "0.03em" : "0.12em" }}>
                {apiKey
                  ? (revealed ? apiKey : maskKey(apiKey))
                  : <span style={{ color: "rgba(255,255,255,0.25)", fontFamily: "var(--font-body)", letterSpacing: 0 }}>No API key available</span>}
              </span>
              {apiKey && (
                <>
                  <button onClick={() => setRevealed((r) => !r)} title={revealed ? "Hide" : "Reveal"}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.45)", padding: 4, display: "flex" }}>
                    <Icon name={revealed ? "eyeOff" : "eye"} size={15} />
                  </button>
                  <button onClick={handleCopy} title="Copy"
                    style={{ background: "none", border: "none", cursor: "pointer", color: copied ? "#5f83e8" : "rgba(255,255,255,0.45)", padding: 4, display: "flex" }}>
                    <Icon name={copied ? "check" : "copy"} size={15} />
                  </button>
                </>
              )}
            </div>

            {/* Token usage stats */}
            {usageLoading ? (
              <div style={{ fontSize: 12.5, color: "rgba(255,255,255,0.3)" }}>Loading usage…</div>
            ) : !usage ? (
              <div style={{ fontSize: 12.5, color: "rgba(255,255,255,0.3)" }}>Usage data unavailable</div>
            ) : (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 14 }}>
                  {[
                    { label: "Used", value: usedTokens.toLocaleString() },
                    { label: "Remaining", value: remainingTokens.toLocaleString() },
                    { label: "Limit", value: limitTokens.toLocaleString() },
                  ].map(({ label, value }) => (
                    <div key={label} style={{ padding: "12px 14px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 9 }}>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: 15, fontWeight: 700, color: "rgba(255,255,255,0.88)", marginBottom: 4 }}>{value}</div>
                      <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.35)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
                    </div>
                  ))}
                </div>

                {/* Usage bar */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontSize: 11.5, color: "rgba(255,255,255,0.45)" }}>
                      {usagePct.toFixed(1)}% used
                    </span>
                    {usage.resetAt && (
                      <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", display: "flex", alignItems: "center", gap: 3 }}>
                        <Icon name="clock" size={10} />
                        Resets {new Date(usage.resetAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                      </span>
                    )}
                  </div>
                  <div style={{ height: 6, borderRadius: 99, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${usagePct}%`, borderRadius: 99, background: "linear-gradient(90deg, #5f83e8, #a8bdf5)", transition: "width 0.5s ease" }} />
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Contact support */}
          <div className="card" style={{ padding: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--fg)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Contact support
            </div>
            <div style={{ fontSize: 12.5, color: "var(--fg-muted)", marginBottom: 18 }}>
              Having trouble? Drop us a message and we'll get back to you.
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={labelStyle}>Subject</label>
                <input type="text" placeholder="Brief description of your issue" value={msgSubject} onChange={(e) => setMsgSubject(e.target.value)} style={fieldInputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Message</label>
                <textarea placeholder="Describe your issue in detail…" value={msgBody} onChange={(e) => setMsgBody(e.target.value)} rows={5}
                  style={{ ...fieldInputStyle, resize: "vertical", lineHeight: 1.6 }} />
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button className="btn primary" onClick={sendMessage} disabled={!msgBody.trim()} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <Icon name="arrowUpRight" size={14} />
                  Send message
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Danger zone ── */}
      <div style={{ marginTop: 20, padding: "20px 24px", borderRadius: 12, border: "1px solid rgba(220,38,38,0.18)", background: "rgba(220,38,38,0.03)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
       <div>
  <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--fg)", marginBottom: 2 }}>
    Session
  </div>
  <div style={{ fontSize: 12.5, color: "var(--fg-muted)" }}>
    Sign out securely from your account.
  </div>
</div>
        <div style={{ display: "flex", gap: 10, flexShrink: 0 }}>
          <button className="btn" onClick={logout}
            style={{ color: "var(--threat)", borderColor: "rgba(220,38,38,0.3)", display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Icon name="arrowRight" size={13} />
            Sign out
          </button>
          {/* <button className="btn" disabled
            style={{ color: "rgba(220,38,38,0.4)", borderColor: "rgba(220,38,38,0.15)", display: "inline-flex", alignItems: "center", gap: 6, opacity: 0.5 }}>
            Delete account
          </button> */}
        </div>
      </div>

    </div>
  );
}

function AccountDetailCell({
  label, children, readonly = false, editing = false, editValue = "", saving = false,
  onEdit, onChange, onSave, onCancel,
}: {
  label: string;
  children: React.ReactNode;
  readonly?: boolean;
  editing?: boolean;
  editValue?: string;
  saving?: boolean;
  onEdit?: () => void;
  onChange?: (v: string) => void;
  onSave?: () => void;
  onCancel?: () => void;
}) {
  return (
    <div style={{ padding: "14px 16px", background: "var(--bg-0, var(--bg))", border: "1px solid var(--line)", borderRadius: 9 }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--fg-muted)", marginBottom: 6 }}>
        {label}
      </div>
      {editing ? (
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input
            autoFocus
            value={editValue}
            onChange={(e) => onChange?.(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") onSave?.(); if (e.key === "Escape") onCancel?.(); }}
            style={{ ...fieldInputStyle, padding: "5px 8px", fontSize: 12 }}
          />
          <button className="btn primary" onClick={onSave} disabled={saving} style={{ fontSize: 11, padding: "5px 10px", whiteSpace: "nowrap" }}>
            {saving ? "…" : "Save"}
          </button>
          <button className="btn ghost" onClick={onCancel} style={{ fontSize: 11, padding: "5px 8px" }}>×</button>
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <span style={{ fontSize: 13.5, fontWeight: 500, color: "var(--fg)", wordBreak: "break-all" }}>{children}</span>
          {!readonly && onEdit && (
            <button onClick={onEdit} style={{ background: "none", border: "1px solid var(--line)", borderRadius: 5, padding: "2px 8px", fontSize: 11, fontWeight: 600, color: "var(--accent)", cursor: "pointer", flexShrink: 0, fontFamily: "var(--font-body)" }}>
              Edit
            </button>
          )}
        </div>
      )}
    </div>
  );
}

const pillStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "3px 10px",
  borderRadius: 20,
  fontSize: 11.5,
  fontWeight: 600,
  background: "rgba(37,99,235,0.07)",
  color: "var(--accent)",
  border: "1px solid rgba(37,99,235,0.15)",
};

const labelStyle: CSSProperties = {
  fontSize: 10.5,
  fontWeight: 700,
  color: "var(--fg-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.07em",
  display: "block",
  marginBottom: 5,
};

const fieldInputStyle: CSSProperties = {
  width: "100%",
  background: "var(--bg-0, var(--bg))",
  border: "1px solid var(--line-strong)",
  color: "var(--fg)",
  padding: "8px 11px",
  borderRadius: 7,
  fontFamily: "var(--font-body)",
  fontSize: 13,
  outline: "none",
  boxSizing: "border-box",
};
