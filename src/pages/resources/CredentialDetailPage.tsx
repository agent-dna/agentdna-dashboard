import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Icon } from "../../components/Icon";
import { DataTable, type DataTableColumn } from "../../components/DataTable";
import { Pagination } from "../../components/Pagination";
import { ThreatPill } from "../../components/ThreatPill";
import { CredentialStatusChip } from "../../components/CredentialStatusChip";
import { CredentialStatusModal } from "../../components/forms/CredentialStatusModal";
import { useAuth } from "../../context/AuthContext";
import { useCredentialInfo } from "../../data/hooks";
import { ApiError } from "../../api/client";
import { IntentIdChip } from "../../context/IntentNumbersContext";
import { useResolveName } from "../../context/DirectoryContext";
import { CopyId } from "../observability/IntentDetailPanel";
import { authMethodLabel, sentence } from "../../lib/credFormat";
import { whenShort } from "../../lib/resource";
import type { CredentialIntent, CredentialParty } from "../../data/api";

/**
 * One credential (GET /credential-info): how it authenticates, where its checks were seen, the
 * intents it was used in (paged, most recent first) and the agents, apps and users that used it.
 */

type Tab = "intents" | "agents" | "tools" | "users" | "unknown";

const REVIEW_STYLE: Record<string, { color: string; bg: string }> = {
  Unreviewed: { color: "var(--accent)", bg: "rgba(37,99,235,0.10)" },
  Acknowledged: { color: "var(--safe)", bg: "rgba(5,150,105,0.10)" },
  Flagged: { color: "var(--threat)", bg: "rgba(220,38,38,0.10)" },
};

const shortId = (s: string) => (s.length > 22 ? `${s.slice(0, 10)}…${s.slice(-6)}` : s);
const mono = (v: string, muted = false) => (
  <span style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, color: muted ? "var(--fg-muted)" : undefined }}>{v}</span>
);

/** Where a party's own page is: agents and users by DID, apps by name (as the Apps table links them). */
function partyPath(tab: Tab, p: CredentialParty): string | null {
  if (tab === "agents") return `/agents/${encodeURIComponent(p.did)}`;
  if (tab === "users") return `/users/${encodeURIComponent(p.did)}`;
  if (tab === "tools") return `/tools/${encodeURIComponent(p.name || p.did)}`;
  return null;
}

export function CredentialDetailPage() {
  const { credentialId = "" } = useParams<{ credentialId: string }>();
  const navigate = useNavigate();
  const resolve = useResolveName();
  const { user } = useAuth();
  const isAdmin = !!user?.is_admin;
  const [statusOpen, setStatusOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("intents");
  const [intentsPage, setIntentsPage] = useState(1);
  const { data: cred, loading, error, refetch } = useCredentialInfo(credentialId, intentsPage);

  if (!cred && loading) {
    return (
      <div className="page">
        <div className="stub"><h2>Loading…</h2></div>
      </div>
    );
  }
  if (!cred) {
    const notFound = error instanceof ApiError && error.status === 404;
    return (
      <div className="page">
        <div className="stub">
          <h2>{notFound ? "Credential not found" : "Couldn’t load this credential"}</h2>
          <div style={{ fontSize: 13, color: "var(--fg-muted)", marginTop: 6 }}>
            {notFound ? "This credential hasn’t been seen in any request." : error?.message}
          </div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, marginTop: 6 }}>{credentialId}</div>
          <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
            <button className="btn" style={{ marginTop: 16 }} onClick={() => navigate("/resources")}>
              <Icon name="arrowRight" size={14} style={{ transform: "rotate(180deg)" }} /> Back to resources
            </button>
            {!notFound && (
              <button className="btn" style={{ marginTop: 16 }} onClick={refetch}>Retry</button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const method = authMethodLabel(cred.authMethod) || "Unknown method";
  const seenBy = cred.sources.map(sentence).filter(Boolean).join(" → ");
  const parties: Record<Exclude<Tab, "intents">, CredentialParty[]> = {
    agents: cred.agents,
    tools: cred.tools,
    users: cred.users,
    unknown: cred.unknown,
  };
  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "intents", label: "Intents", count: cred.intents.total },
    { key: "agents", label: "Agents", count: cred.agents.length },
    { key: "tools", label: "Apps", count: cred.tools.length },
    { key: "users", label: "Users", count: cred.users.length },
    // DIDs that matched nothing; only shown when there are some.
    ...(cred.unknown.length ? [{ key: "unknown" as const, label: "Unrecognised", count: cred.unknown.length }] : []),
  ];

  const intentCols: DataTableColumn<CredentialIntent & { id: string }>[] = [
    {
      key: "intent",
      label: "Intent",
      render: (r) => <IntentIdChip id={r.intentID} style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 600, color: "var(--fg)" }} />,
    },
    {
      key: "initiator",
      label: "Initiator",
      render: (r) => (
        <span style={{ fontSize: 13, color: "var(--fg)", fontWeight: 600 }}>
          {r.initiatorDID ? resolve(r.initiatorDID, r.initiatorName).name : r.initiatorName || "Unknown"}
        </span>
      ),
    },
    { key: "requests", label: "Requests", render: (r) => mono(r.requestCount.toLocaleString()) },
    { key: "incident", label: "Incidents", render: (r) => <ThreatPill threat={r.threatDetected} /> },
    {
      key: "review",
      label: "Review",
      render: (r) => {
        const st = REVIEW_STYLE[r.reviewStatus] ?? { color: "var(--fg-muted)", bg: "var(--bg-2)" };
        return (
          <span style={{ fontSize: 11.5, fontWeight: 700, padding: "3px 9px", borderRadius: 999, color: st.color, background: st.bg }}>
            {r.reviewStatus || "Unreviewed"}
          </span>
        );
      },
    },
    { key: "started", label: "Started", render: (r) => mono(whenShort(r.startedAt), true) },
    { key: "lastUsed", label: "Last used", align: "right", render: (r) => mono(whenShort(r.lastUsedAt), true) },
  ];

  const partyCols = (t: Tab): DataTableColumn<CredentialParty & { id: string }>[] => [
    {
      key: "name",
      label: t === "agents" ? "Agent" : t === "tools" ? "App" : t === "users" ? "User" : "DID",
      render: (p) => (
        <span style={{ display: "flex", flexDirection: "column", minWidth: 0, alignItems: "flex-start" }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--fg)" }}>{p.name || resolve(p.did).name}</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--fg-muted)" }} title={p.did}>{shortId(p.did)}</span>
            <span onClick={(e) => e.stopPropagation()}>
              <CopyId value={p.did} label="DID" />
            </span>
          </span>
        </span>
      ),
    },
    { key: "requests", label: "Requests", render: (p) => mono(p.requestCount.toLocaleString()) },
    { key: "intents", label: "Intents", render: (p) => mono(p.intentCount.toLocaleString()) },
    { key: "lastUsed", label: "Last used", align: "right", render: (p) => mono(whenShort(p.lastUsedAt), true) },
  ];

  return (
    <div className="page">
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 14, fontSize: 13 }}>
        <button className="btn ghost" style={{ padding: "4px 8px", fontSize: 12.5 }} onClick={() => navigate("/resources")}>
          <Icon name="arrowRight" size={12} style={{ transform: "rotate(180deg)" }} /> Resources
        </button>
        <span style={{ color: "var(--fg-faint)" }}>/</span>
        <span style={{ color: "var(--fg)", fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 600 }}>{shortId(cred.credentialID)}</span>
      </div>

      <div className="card" style={{ padding: "24px 28px", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 20 }}>
          <span className="res-key big">
            <Icon name="key" size={28} />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6, flexWrap: "wrap" }}>
              <h1 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 600, letterSpacing: "-0.02em", color: "var(--fg)" }}>
                {method}
              </h1>
              <span className="chip warn" style={{ fontSize: 10.5, padding: "2px 7px" }}>credential</span>
              <CredentialStatusChip value={cred.status.value} />
              {isAdmin && (
                <button className="btn ghost" style={{ padding: "3px 8px", fontSize: 12 }} onClick={() => setStatusOpen(true)}>
                  Change status
                </button>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--fg-muted)", fontSize: 12.5, fontFamily: "var(--font-mono)", marginBottom: 6, minWidth: 0 }}>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={cred.credentialID}>{cred.credentialID}</span>
              <CopyId value={cred.credentialID} label="credential ID" />
            </div>
            <div style={{ display: "flex", gap: 20, flexWrap: "wrap", fontSize: 12.5, color: "var(--fg-muted)", marginBottom: 16 }}>
              <span>
                Person:{" "}
                <span style={{ color: cred.identityID ? "var(--fg)" : "var(--fg-faint)", fontFamily: cred.identityID ? "var(--font-mono)" : undefined }}>
                  {cred.identityID ? shortId(cred.identityID) : "Not reported"}
                </span>
              </span>
              <span>
                Seen by: <span style={{ color: seenBy ? "var(--fg)" : "var(--fg-faint)" }}>{seenBy || "Not reported"}</span>
              </span>
            </div>
            {/* Who set the status and why; nothing until an admin has set one. */}
            {cred.status.updatedAt && (
              <div style={{ fontSize: 12.5, color: "var(--fg-muted)", marginTop: -8, marginBottom: 16 }}>
                {cred.status.reason ? <span style={{ color: "var(--fg)" }}>“{cred.status.reason}”</span> : "No reason given"}
                {" · set by "}
                {cred.status.updatedBy || "an admin"} {whenShort(cred.status.updatedAt)}
              </div>
            )}
            <div className="res-stats">
              <Stat label="First used" value={whenShort(cred.firstUsedAt)} small />
              <Stat label="Last used" value={whenShort(cred.lastUsedAt)} small />
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="tb-toolbar">
          <div className="filters">
            {tabs.map((t) => (
              <div key={t.key} className={`tab ${tab === t.key ? "active" : ""}`} onClick={() => setTab(t.key)}>
                {t.label}
                <span className="pill">{t.count}</span>
              </div>
            ))}
          </div>
          {tab === "intents" && (
            <Pagination page={intentsPage} totalPages={cred.intents.totalPages} total={cred.intents.total} pageSize={cred.intents.pageSize} inline onChange={setIntentsPage} />
          )}
        </div>

        {tab === "intents" ? (
          <DataTable
            rows={cred.intents.items.map((i) => ({ ...i, id: i.intentID }))}
            columns={intentCols}
            onRowClick={(r) => navigate(`/intents/${encodeURIComponent(r.intentID)}`)}
            emptyText="This credential hasn’t been used in an intent."
          />
        ) : (
          <DataTable
            rows={parties[tab].map((p) => ({ ...p, id: p.did }))}
            columns={partyCols(tab)}
            onRowClick={(p) => {
              const path = partyPath(tab, p);
              if (path) navigate(path);
            }}
            emptyText={
              tab === "agents" ? "No agent has used this credential." : tab === "tools" ? "No app has used this credential." : tab === "users" ? "No user has used this credential." : "None."
            }
          />
        )}
      </div>

      {isAdmin && (
        <CredentialStatusModal
          open={statusOpen}
          credentialID={cred.credentialID}
          current={cred.status}
          onClose={() => setStatusOpen(false)}
          onSaved={refetch}
        />
      )}
    </div>
  );
}

function Stat({ label, value, small }: { label: string; value: string; small?: boolean }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--fg-muted)", marginBottom: 4 }}>{label}</div>
      <div
        style={{ fontFamily: small ? "var(--font-mono)" : "var(--font-display)", fontSize: small ? 13 : 18, fontWeight: 700, color: "var(--fg)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
        title={value}
      >
        {value}
      </div>
    </div>
  );
}
