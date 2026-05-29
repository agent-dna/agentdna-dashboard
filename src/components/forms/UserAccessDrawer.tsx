import { useCallback, useEffect, useState } from "react";
import { Drawer } from "../Drawer";
import { Icon } from "../Icon";
import { IdCell } from "../EntityCell";
import { ApiError } from "../../api/client";
import { getUserAccessList, grantAgentAccess, revokeAgentAccess, type OrgUser } from "../../api/users";
import { errorStyle, inputStyle } from "./styles";

interface Props {
  user: OrgUser | null;
  onClose: () => void;
  onChanged?: () => void;
}

export function UserAccessDrawer({ user, onClose, onChanged }: Props) {
  const [accessList, setAccessList] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [newAgent, setNewAgent] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (userDID: string) => {
    setLoading(true);
    setErr(null);
    try {
      const res = await getUserAccessList(userDID);
      setAccessList(res.agentAccessList || []);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Failed to load access list");
      setAccessList([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) load(user.userID);
  }, [user, load]);

  if (!user) {
    return (
      <Drawer open={false} onClose={onClose}>
        <span />
      </Drawer>
    );
  }

  const onGrant = async () => {
    const agentDID = newAgent.trim();
    if (!agentDID || !user) return;
    setBusy(true);
    setErr(null);
    try {
      await grantAgentAccess({ userDID: user.userID, agentDID });
      setNewAgent("");
      await load(user.userID);
      onChanged?.();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Failed to grant access");
    } finally {
      setBusy(false);
    }
  };

  const onRevoke = async (agentDID: string) => {
    if (!user) return;
    if (!confirm(`Revoke access to ${agentDID}?`)) return;
    setBusy(true);
    setErr(null);
    try {
      await revokeAgentAccess({ userDID: user.userID, agentDID });
      await load(user.userID);
      onChanged?.();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Failed to revoke access");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Drawer open={!!user} onClose={onClose}>
      <div className="drawer-head">
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 10,
            background: "linear-gradient(135deg, rgba(37, 99, 235,0.18), rgba(14, 165, 233,0.06))",
            display: "grid",
            placeItems: "center",
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: 14,
            color: "var(--accent)",
            border: "1px solid var(--line-strong)",
          }}
        >
          {user.userName.slice(0, 2).toUpperCase()}
        </div>
        <div>
          <h2>{user.userName}</h2>
          <div className="meta">
            <span style={{ fontFamily: "var(--font-mono)" }}>{user.userID.slice(0, 24)}…</span>
          </div>
        </div>
        <button className="close" onClick={onClose}><Icon name="close" size={16} /></button>
      </div>
      <div className="drawer-body">
        <div className="drawer-section">
          <div className="title">Account</div>
          <div className="kv">
            <div className="k">User ID</div>
            <div className="v">{user.userID}</div>
            <div className="k">Created</div>
            <div className="v">{user.createdAt ? new Date(user.createdAt).toLocaleString() : "—"}</div>
            <div className="k">Intents</div>
            <div className="v">{user.totalIntents}</div>
            <div className="k">Threats</div>
            <div className="v" style={{ color: user.totalThreats > 0 ? "var(--threat)" : "var(--fg)" }}>
              {user.totalThreats}
            </div>
          </div>
        </div>

        <div className="drawer-section">
          <div className="title">
            Agent access · {accessList.length}
          </div>

          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <input
              type="text"
              value={newAgent}
              onChange={(e) => setNewAgent(e.target.value)}
              placeholder="did:rubix:…"
              style={{ ...inputStyle, flex: 1, fontFamily: "var(--font-mono)", fontSize: 12.5 }}
            />
            <button className="btn primary" onClick={onGrant} disabled={busy || !newAgent.trim()}>
              <Icon name="plus" size={14} /> Grant
            </button>
          </div>

          {err && <div style={{ ...errorStyle, marginBottom: 12 }}>{err}</div>}

          {loading && (
            <div style={{ color: "var(--fg-muted)", fontSize: 13, padding: "12px 0" }}>Loading…</div>
          )}

          {!loading && accessList.length === 0 && (
            <div style={{ color: "var(--fg-muted)", fontSize: 13, padding: "12px 0" }}>
              No agents in this user's access list.
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {accessList.map((agentDID) => (
              <div
                key={agentDID}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 12px",
                  border: "1px solid var(--line)",
                  borderRadius: 8,
                  background: "var(--bg-1)",
                }}
              >
                <div style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>
                  <IdCell id={agentDID} />
                </div>
                <button
                  className="btn-mini"
                  style={{ color: "var(--threat)", borderColor: "rgba(220,38,38,0.3)" }}
                  disabled={busy}
                  onClick={() => onRevoke(agentDID)}
                >
                  Revoke
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Drawer>
  );
}
