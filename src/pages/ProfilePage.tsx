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

function InfoRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <div style={{ fontSize: 11.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--fg-muted)" }}>
        {label}
      </div>
      <div style={{ fontSize: 14, fontWeight: 500, color: "var(--fg)", fontFamily: mono ? "var(--font-mono)" : "var(--font-body)", wordBreak: "break-all" }}>
        {value || "—"}
      </div>
    </div>
  );
}

function EditableInfoRow({
  label, value, editing, editValue, onEdit, onChange, onSave, onCancel, saving,
}: {
  label: string;
  value: string;
  editing: boolean;
  editValue: string;
  onEdit: () => void;
  onChange: (v: string) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
}) {
  if (editing) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ fontSize: 11.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--fg-muted)" }}>
          {label}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            autoFocus
            value={editValue}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") onSave(); if (e.key === "Escape") onCancel(); }}
            style={fieldInputStyle}
          />
          <button className="btn primary" onClick={onSave} disabled={saving} style={{ fontSize: 12, padding: "6px 12px", whiteSpace: "nowrap" }}>
            {saving ? "Saving…" : "Save"}
          </button>
          <button className="btn ghost" onClick={onCancel} style={{ fontSize: 12, padding: "6px 10px" }}>
            Cancel
          </button>
        </div>
      </div>
    );
  }
  return (
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
      <InfoRow label={label} value={value} />
      <button
        onClick={onEdit}
        style={{
          background: "none",
          border: "1px solid var(--line)",
          borderRadius: 6,
          padding: "3px 8px",
          fontSize: 11,
          fontWeight: 600,
          color: "var(--fg-muted)",
          cursor: "pointer",
          flexShrink: 0,
          marginTop: 18,
          fontFamily: "var(--font-body)",
        }}
      >
        Edit
      </button>
    </div>
  );
}

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
        .then(setAdminProfile)
        .catch(() => setAdminProfile(null))
        .finally(() => setProfileLoading(false));
    } else {
      fetchUserProfile()
        .then(setProfile)
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
  const displayOrg = activeProfile?.organizationID || user?.org_id || (isAdmin ? "AGENT_DNA_BETA" : "");

  function formatDate(dateStr: string) {
    try {
      return new Date(dateStr).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
    } catch {
      return dateStr;
    }
  }

  function formatEpoch(epoch: number) {
    // backend sends Unix seconds
    return new Date(epoch * 1000).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
  }

  const SUPPORT_EMAIL = "support@agentdna.ai";

  async function handleCopy() {
    if (!apiKey) return;
    try {
      await navigator.clipboard.writeText(apiKey);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable
    }
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

  function cancelEdit() {
    setEditField(null);
    setEditValue("");
    setEditError(null);
  }

  async function saveEdit() {
    if (!editField || !editValue.trim()) return;
    setEditSaving(true);
    setEditError(null);
    try {
      await updateUserProfile({ [editField]: editValue.trim() });
      const trimmed = editValue.trim();
      setProfile((prev) => prev ? { ...prev, [editField!]: trimmed } : prev);
      if (editField === "email") patchUser({ email: trimmed });
      cancelEdit();
    } catch (err) {
      setEditError(err instanceof ApiError ? err.message : "Failed to save changes.");
    } finally {
      setEditSaving(false);
    }
  }

  async function handlePasswordChange() {
    if (!pwCurrent.trim()) { setPwError("Current password is required."); return; }
    if (!pwNew.trim()) { setPwError("New password cannot be empty."); return; }
    if (pwNew !== pwConfirm) { setPwError("New passwords do not match."); return; }
    setPwSaving(true);
    setPwError(null);
    try {
      await changePassword({ currentPassword: pwCurrent, newPassword: pwNew });
      setPwOpen(false);
      setPwCurrent(""); setPwNew(""); setPwConfirm("");
      setPwSuccess(true);
      window.setTimeout(() => setPwSuccess(false), 4000);
    } catch (err) {
      setPwError(err instanceof ApiError ? err.message : "Failed to change password.");
    } finally {
      setPwSaving(false);
    }
  }

  const initials = (displayName || user?.email || "?")
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0].toUpperCase())
    .join("");

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Profile</h1>
          <div className="sub">Account details and API key management</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, alignItems: "start" }}>
        {/* Account card */}
        <div className="card" style={{ padding: 24 }}>
          <div className="card-head" style={{ marginBottom: 20 }}>
            <h3>Account</h3>
          </div>

          {/* Avatar header */}
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: "50%",
                background: "linear-gradient(135deg, var(--accent), var(--accent-2))",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                fontSize: 20,
                fontWeight: 700,
                letterSpacing: "0.02em",
                flexShrink: 0,
              }}
            >
              {initials}
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "var(--fg)" }}>
                {profileLoading ? "—" : (displayName || activeProfile?.email || user?.email || "—")}
              </div>
              <div style={{ fontSize: 13, color: "var(--fg-muted)", marginTop: 2 }}>
                {profileLoading ? "—" : displayOrg}
              </div>
              {user?.is_admin && (
                <span className="chip info" style={{ marginTop: 6, display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <Icon name="shield" size={11} /> Admin
                </span>
              )}
            </div>
          </div>

          {/* Editable fields */}
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <EditableInfoRow
              label="Name"
              value={profileLoading ? "—" : (displayName || "—")}
              editing={editField === "name"}
              editValue={editValue}
              onEdit={() => startEdit("name")}
              onChange={(v) => setEditValue(v)}
              onSave={saveEdit}
              onCancel={cancelEdit}
              saving={editSaving}
            />

            <EditableInfoRow
              label="Email"
              value={profileLoading ? "—" : (activeProfile?.email || user?.email || "—")}
              editing={editField === "email"}
              editValue={editValue}
              onEdit={() => startEdit("email")}
              onChange={(v) => setEditValue(v)}
              onSave={saveEdit}
              onCancel={cancelEdit}
              saving={editSaving}
            />

            {editError && (
              <div style={{ padding: "8px 10px", borderRadius: 7, background: "rgba(220,38,38,0.06)", border: "1px solid rgba(220,38,38,0.18)", color: "var(--threat)", fontSize: 12 }}>
                {editError}
              </div>
            )}

            <InfoRow label="Organization" value={profileLoading ? "—" : displayOrg} />
            <InfoRow label="Role" value={isAdmin ? "Administrator" : "User"} />
            {isAdmin && adminProfile?.createdAt ? (
              <InfoRow label="Member since" value={formatEpoch(adminProfile.createdAt)} />
            ) : profile?.createdAt ? (
              <InfoRow label="Member since" value={formatDate(profile.createdAt)} />
            ) : null}
            {!isAdmin && profile?.adminEmail && (
              <InfoRow label="Admin contact" value={profile.adminEmail} />
            )}
          </div>

          {/* Change password */}
          <div style={{ marginTop: 24, paddingTop: 20, borderTop: "1px solid var(--line)" }}>
            {!pwOpen ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--fg)" }}>Password</span>
                <button
                  className="btn"
                  onClick={() => { setPwOpen(true); setPwError(null); setPwSuccess(false); }}
                  style={{ fontSize: 12, padding: "6px 12px" }}
                >
                  Change password
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 2 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--fg)" }}>Change password</span>
                  <button
                    className="btn ghost"
                    onClick={() => { setPwOpen(false); setPwError(null); setPwCurrent(""); setPwNew(""); setPwConfirm(""); }}
                    style={{ fontSize: 12, padding: "4px 8px" }}
                  >
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
                <button
                  className="btn primary"
                  onClick={handlePasswordChange}
                  disabled={pwSaving}
                  style={{ alignSelf: "flex-start", fontSize: 12, padding: "7px 16px" }}
                >
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
        </div>

        {/* API Key card */}
        <div className="card" style={{ padding: 24 }}>
          <div className="card-head" style={{ marginBottom: 20 }}>
            <h3>API Key</h3>
          </div>

          <div
            style={{
              background: "var(--bg-2, var(--bg))",
              border: "1px solid var(--line-strong)",
              borderRadius: 8,
              padding: "12px 14px",
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <Icon name="key" size={15} style={{ color: "var(--fg-muted)", flexShrink: 0 }} />
            <span
              style={{
                flex: 1,
                fontFamily: "var(--font-mono)",
                fontSize: 13,
                color: "var(--fg)",
                wordBreak: "break-all",
                letterSpacing: revealed ? "0.03em" : "0.15em",
              }}
            >
              {apiKey
                ? revealed
                  ? apiKey
                  : maskKey(apiKey)
                : <span style={{ color: "var(--fg-faint)", fontFamily: "var(--font-body)", letterSpacing: 0 }}>No API key available</span>}
            </span>
            {apiKey && (
              <>
                <button
                  className="icon-btn"
                  title={revealed ? "Hide key" : "Reveal key"}
                  onClick={() => setRevealed((r) => !r)}
                >
                  <Icon name={revealed ? "eyeOff" : "eye"} size={15} />
                </button>
                <button
                  className="icon-btn"
                  title="Copy to clipboard"
                  onClick={handleCopy}
                >
                  <Icon name={copied ? "check" : "copy"} size={15} />
                </button>
              </>
            )}
          </div>

          <div
            style={{
              marginTop: 12,
              padding: "10px 12px",
              background: "rgba(37,99,235,0.05)",
              border: "1px solid rgba(37,99,235,0.12)",
              borderRadius: 6,
              fontSize: 12.5,
              color: "var(--fg-muted)",
              lineHeight: 1.55,
            }}
          >
            Your API key grants full access to the AgentDNA API on behalf of your account. Keep it secret and never share it publicly.
          </div>

          {/* Token usage */}
          <div style={{ marginTop: 24, borderTop: "1px solid var(--line)", paddingTop: 20 }}>
            {usageLoading ? (
              <div style={{ fontSize: 13, color: "var(--fg-faint)" }}>Loading usage…</div>
            ) : !usage ? (
              <div style={{ fontSize: 13, color: "var(--fg-faint)" }}>Usage data unavailable</div>
            ) : (() => {
              const used = usage.tokensUsed;
              const lim = usage.tokensLimit;
              const remaining = Math.max(0, lim - used);
              const pct = lim > 0 ? Math.min(100, (used / lim) * 100) : 0;
              const barColor = pct >= 90 ? "#DC2626" : pct >= 70 ? "#D97706" : "#2563EB";
              const statusLabel = pct >= 90 ? "Critical" : pct >= 70 ? "Warning" : "Healthy";
              const statusBg = pct >= 90 ? "rgba(220,38,38,0.08)" : pct >= 70 ? "rgba(217,119,6,0.08)" : "rgba(37,99,235,0.08)";
              const statusText = pct >= 90 ? "#DC2626" : pct >= 70 ? "#D97706" : "#2563EB";
              const statusBorder = pct >= 90 ? "rgba(220,38,38,0.22)" : pct >= 70 ? "rgba(217,119,6,0.22)" : "rgba(37,99,235,0.22)";
              return (
                <>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--fg)" }}>Token usage</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {usage.resetAt && (
                        <span style={{ fontSize: 11, color: "var(--fg-faint)", display: "flex", alignItems: "center", gap: 3 }}>
                          <Icon name="clock" size={11} />
                          Resets {new Date(usage.resetAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                        </span>
                      )}
                      <span style={{ fontSize: 10.5, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: statusBg, color: statusText, border: `1px solid ${statusBorder}` }}>
                        {statusLabel}
                      </span>
                    </div>
                  </div>
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 8 }}>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 26, fontWeight: 800, color: barColor, lineHeight: 1 }}>
                        {pct.toFixed(1)}%
                      </span>
                      <span style={{ fontSize: 11.5, color: "var(--fg-muted)" }}>of {lim.toLocaleString()} tokens</span>
                    </div>
                    <div style={{ height: 10, borderRadius: 99, background: "var(--line-strong)", overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${pct}%`, borderRadius: 99, background: `linear-gradient(90deg, ${barColor}bb, ${barColor})`, transition: "width 0.5s ease" }} />
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <div style={{ padding: "10px 12px", background: "var(--bg-2, var(--bg))", border: "1px solid var(--line)", borderRadius: 8 }}>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: 16, fontWeight: 700, color: "var(--fg)" }}>{used.toLocaleString()}</div>
                      <div style={{ fontSize: 11, color: "var(--fg-muted)", marginTop: 3, fontWeight: 500 }}>used</div>
                    </div>
                    <div style={{ padding: "10px 12px", background: "var(--bg-2, var(--bg))", border: "1px solid var(--line)", borderRadius: 8 }}>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: 16, fontWeight: 700, color: "var(--fg)" }}>{remaining.toLocaleString()}</div>
                      <div style={{ fontSize: 11, color: "var(--fg-muted)", marginTop: 3, fontWeight: 500 }}>remaining</div>
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      </div>

      {/* Deployment guide */}
      <div className="card" style={{ padding: 24, marginTop: 20 }}>
        <div className="card-head" style={{ marginBottom: 20 }}>
          <h3>Deploy your agent</h3>
          <div className="sub" style={{ color: "var(--fg-muted)", fontSize: 13 }}>Get up and running in minutes</div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          {[
            {
              step: "01",
              icon: "key" as const,
              title: "Copy your API key",
              desc: "Find your API key in the API Key section above. This authenticates your agent with the AgentDNA platform.",
            },
            {
              step: "02",
              icon: "helix" as const,
              title: "Install the SDK",
              desc: "Install the AgentDNA SDK in your project and initialise it with your API key and organisation ID.",
              code: "npm install @agentdna/sdk",
            },
            {
              step: "03",
              icon: "activity" as const,
              title: "Wrap your agent",
              desc: "Wrap your agent's inference calls with the AgentDNA middleware to start capturing interactions and intents automatically.",
            },
          ].map(({ step, icon, title, desc, code }) => (
            <div
              key={step}
              style={{
                padding: "18px 20px",
                border: "1px solid var(--line)",
                borderRadius: 10,
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    background: "rgba(37,99,235,0.08)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <Icon name={icon} size={16} style={{ color: "var(--accent)" }} />
                </div>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-faint)", fontWeight: 600 }}>
                  Step {step}
                </span>
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--fg)" }}>{title}</div>
              <div style={{ fontSize: 13, color: "var(--fg-muted)", lineHeight: 1.55 }}>{desc}</div>
              {code && (
                <div
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 12.5,
                    background: "var(--bg-2, var(--bg))",
                    border: "1px solid var(--line-strong)",
                    borderRadius: 6,
                    padding: "8px 12px",
                    color: "var(--fg)",
                  }}
                >
                  {code}
                </div>
              )}
            </div>
          ))}
        </div>

        <div style={{ marginTop: 20, display: "flex", alignItems: "center", gap: 12 }}>
          <a
            href="https://docs.agentdna.ai/getting-started"
            target="_blank"
            rel="noopener noreferrer"
            className="btn primary"
            style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            <Icon name="arrowUpRight" size={14} />
            Read the full guide
          </a>
          <a
            href="https://docs.agentdna.ai/sdk"
            target="_blank"
            rel="noopener noreferrer"
            className="btn"
            style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            <Icon name="box" size={14} />
            SDK reference
          </a>
        </div>
      </div>

      {/* Contact support */}
      <div className="card" style={{ padding: 24, marginTop: 20 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
          <div>
            <h3 style={{ margin: 0 }}>Contact support</h3>
            <div style={{ fontSize: 12.5, color: "var(--fg-muted)", marginTop: 4 }}>
              Having trouble? Drop us a message and we'll get back to you.
            </div>
          </div>
          <span style={{ fontSize: 12, color: "var(--fg-faint)", fontFamily: "var(--font-mono)", paddingTop: 2 }}>{SUPPORT_EMAIL}</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: "var(--fg-muted)", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 5 }}>
              Subject
            </label>
            <input
              type="text"
              placeholder="Brief description of your issue"
              value={msgSubject}
              onChange={(e) => setMsgSubject(e.target.value)}
              style={fieldInputStyle}
            />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: "var(--fg-muted)", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 5 }}>
              Message
            </label>
            <textarea
              placeholder="Describe your issue in detail…"
              value={msgBody}
              onChange={(e) => setMsgBody(e.target.value)}
              rows={5}
              style={{ ...fieldInputStyle, resize: "vertical", lineHeight: 1.6 }}
            />
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              className="btn primary"
              onClick={sendMessage}
              disabled={!msgBody.trim()}
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <Icon name="arrowUpRight" size={14} />
              Send message
            </button>
          </div>
        </div>
      </div>

      {/* Sign out */}
      <div style={{ marginTop: 28, paddingTop: 24, borderTop: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--fg)" }}>Sign out</div>
          <div style={{ fontSize: 12, color: "var(--fg-muted)", marginTop: 2 }}>You will be returned to the login screen.</div>
        </div>
        <button
          className="btn"
          onClick={logout}
          style={{ color: "var(--threat)", borderColor: "rgba(220,38,38,0.3)", display: "inline-flex", alignItems: "center", gap: 6 }}
        >
          <Icon name="arrowRight" size={14} />
          Sign out
        </button>
      </div>
    </div>
  );
}

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
