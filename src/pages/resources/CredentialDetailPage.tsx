import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Icon } from "../../components/Icon";
import { DataTable, type DataTableColumn } from "../../components/DataTable";
import { Pagination } from "../../components/Pagination";
import { CredentialStatusChip } from "../../components/CredentialStatusChip";
import { CredentialStatusPicker } from "../../components/CredentialStatusPicker";
import { SharedKeyTag } from "../../components/SharedKeyTag";
import { intentTableColumns } from "../../components/intentTableColumns";
import { useAuth } from "../../context/AuthContext";
import { useCredentialInfo, useIntentsByIds } from "../../data/hooks";
import { ApiError } from "../../api/client";
import { useResolveName } from "../../context/DirectoryContext";
import { CopyId } from "../observability/IntentDetailPanel";
import { authMethodLabel, sentence } from "../../lib/credFormat";
import { resourceLabel, resourcePath, whenShort } from "../../lib/resource";
import { DestinationLogo } from "../../components/DestinationLogo";
import { TrustStatusChip } from "../../components/TrustStatusChip";
import { TrustStatusPicker } from "../../components/TrustStatusPicker";
import type { CredentialParty, CredentialResource, TrustStatus } from "../../data/api";
import type { Intent } from "../../types";

/**
 * One credential (GET /credential-info): how it authenticates, where its checks were seen, the
 * intents it was used in (paged, most recent first) and the agents, apps and users that used it.
 */

type Tab = "intents" | "resources" | "agents" | "tools" | "users" | "unknown";
type PartyTab = Exclude<Tab, "intents" | "resources">;

const shortId = (s: string) => (s.length > 22 ? `${s.slice(0, 10)}…${s.slice(-6)}` : s);
const mono = (v: string, muted = false) => (
  <span style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, color: muted ? "var(--fg-muted)" : undefined }}>{v}</span>
);

/** Where a party's own page is: agents and users by DID, apps by name (as the Apps table links them). */
function partyPath(tab: PartyTab, p: CredentialParty): string | null {
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
  const [tab, setTab] = useState<Tab>("intents");
  const [intentsPage, setIntentsPage] = useState(1);
  /** Trust statuses an admin changed here, by resource; the update call returns them, so no refetch. */
  const [trustEdits, setTrustEdits] = useState<Record<string, TrustStatus>>({});
  const { data: cred, loading, error, refetch } = useCredentialInfo(credentialId, intentsPage);
  // The intents table matches Home's, which needs each intent's own details (interactions, apps).
  const pageIntentIds = cred?.intents.items.map((i) => i.intentID) ?? [];
  const { data: pageIntents, loading: pageIntentsLoading } = useIntentsByIds(pageIntentIds);

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

  const method = authMethodLabel(cred.authMethod);
  const seenBy = cred.sources.map(sentence).filter(Boolean).join(" → ");
  const parties: Record<PartyTab, CredentialParty[]> = {
    agents: cred.agents,
    tools: cred.tools,
    users: cred.users,
    unknown: cred.unknown,
  };
  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "intents", label: "Intents", count: cred.intents.total },
    { key: "resources", label: "Resources", count: cred.resources.length },
    { key: "agents", label: "Agents", count: cred.agents.length },
    { key: "tools", label: "Tools", count: cred.tools.length },
    { key: "users", label: "Users", count: cred.users.length },
    // DIDs that matched nothing; only shown when there are some.
    ...(cred.unknown.length ? [{ key: "unknown" as const, label: "Unrecognised", count: cred.unknown.length }] : []),
  ];

  const intentCols = intentTableColumns(navigate);
  // Each row is the intent as /intent-info has it; one that failed to load is skipped.
  const intentRows = pageIntents.filter((i): i is Intent => !!i);

  const resourceRows = cred.resources.map((r) => ({ ...r, id: r.resourceID, trustStatus: trustEdits[r.resourceID] ?? r.trustStatus }));
  const resourceCols: DataTableColumn<CredentialResource & { id: string }>[] = [
    {
      key: "name",
      label: "Resource",
      render: (r) => {
        const { title, dest } = resourceLabel(r.resourceID, r.name);
        return (
          <span className="rt-res">
            <span className="dest-row-logo">
              <DestinationLogo entity={dest.entity} size={15} />
            </span>
            <span className="rt-names">
              <span className="rt-title">{title}</span>
              <span className="rt-sub" title={r.resourceID}>{r.resourceID}</span>
            </span>
          </span>
        );
      },
    },
    {
      key: "trust",
      label: "Trust status",
      width: 150,
      render: (r) =>
        isAdmin ? (
          <TrustStatusPicker
            resourceID={r.resourceID}
            current={r.trustStatus}
            onSaved={(s) => setTrustEdits((m) => ({ ...m, [r.resourceID]: s }))}
          />
        ) : (
          <TrustStatusChip value={r.trustStatus} />
        ),
    },
    {
      key: "urls",
      label: "URL",
      // One line, cut with an ellipsis; the full list is in the tooltip.
      render: (r) =>
        r.urls.length ? (
          <span style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, maxWidth: 420 }} title={r.urls.join("\n")}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--fg-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>
              {r.urls[0]}
            </span>
            {r.urls.length > 1 && (
              <span className="pill" style={{ flexShrink: 0, fontSize: 11 }}>+{r.urls.length - 1}</span>
            )}
          </span>
        ) : (
          mono("—", true)
        ),
    },
  ];

  const partyCols = (t: PartyTab): DataTableColumn<CredentialParty & { id: string }>[] => [
    {
      key: "name",
      label: t === "agents" ? "Agent" : t === "tools" ? "Tool" : t === "users" ? "User" : "DID",
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
              {/* The credential is named by its ID. */}
              <h1
                style={{ margin: 0, minWidth: 0, fontFamily: "var(--font-mono)", fontSize: 20, fontWeight: 600, color: "var(--fg)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                title={cred.credentialID}
              >
                {cred.credentialID}
              </h1>
              <CopyId value={cred.credentialID} label="credential ID" />
              <span className="chip warn" style={{ fontSize: 10.5, padding: "2px 7px" }}>credential</span>
              {/* Counts from the summary; the party lists stand in if the server left them out. */}
              <SharedKeyTag
                userCount={Math.max(cred.userCount, cred.users.length)}
                agentCount={Math.max(cred.agentCount, cred.agents.length)}
              />
              {isAdmin ? (
                <CredentialStatusPicker credentialID={cred.credentialID} current={cred.status} onSaved={refetch} />
              ) : (
                <CredentialStatusChip value={cred.status.value} />
              )}
            </div>
            <div style={{ display: "flex", gap: 20, flexWrap: "wrap", fontSize: 12.5, color: "var(--fg-muted)", marginBottom: 16 }}>
              <span>
                Auth method: <span style={{ color: method ? "var(--fg)" : "var(--fg-faint)" }}>{method || "Not reported"}</span>
              </span>
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
              {/* Where the credential was presented: name and trust status. Two shown; the rest are in the Resources tab. */}
              <div style={{ minWidth: 0, gridColumn: "span 2" }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--fg-muted)", marginBottom: 4 }}>
                  {cred.resources.length > 1 ? "Resources" : "Resource"}
                </div>
                {resourceRows.length ? (
                  <div style={{ display: "flex", alignItems: "center", gap: "6px 14px", flexWrap: "wrap", minWidth: 0 }}>
                    {resourceRows.slice(0, 2).map((r) => (
                      <span key={r.resourceID} style={{ display: "inline-flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                        <button
                          type="button"
                          onClick={() => navigate(resourcePath(r.resourceID))}
                          title={r.resourceID}
                          style={{ background: "none", border: 0, padding: 0, cursor: "pointer", font: "inherit", fontSize: 13, fontWeight: 700, color: "var(--fg)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 220 }}
                        >
                          {resourceLabel(r.resourceID, r.name).title}
                        </button>
                        <TrustStatusChip value={r.trustStatus} />
                      </span>
                    ))}
                    {resourceRows.length > 2 && (
                      <button type="button" className="dest-row-link" style={{ padding: "2px 4px" }} onClick={() => setTab("resources")}>
                        +{resourceRows.length - 2} more
                      </button>
                    )}
                  </div>
                ) : (
                  <div style={{ fontSize: 13, color: "var(--fg-faint)" }}>None recorded</div>
                )}
              </div>
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
            rows={intentRows}
            columns={intentCols}
            onRowClick={(r) => navigate(`/intents/${encodeURIComponent(r.id)}`)}
            emptyText={pageIntentsLoading || (pageIntentIds.length > 0 && pageIntents.length === 0) ? "Loading intents…" : "This credential hasn’t been used in an intent."}
          />
        ) : tab === "resources" ? (
          <DataTable
            rows={resourceRows}
            columns={resourceCols}
            alignCells
            onRowClick={(r) => navigate(resourcePath(r.resourceID))}
            rowStyle={(r) => (r.trustStatus === "Flagged" ? { background: "rgba(220,38,38,.045)" } : undefined)}
            emptyText="This credential hasn’t been presented to a resource."
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
              tab === "agents" ? "No agent has used this credential." : tab === "tools" ? "No tool has used this credential." : tab === "users" ? "No user has used this credential." : "None."
            }
          />
        )}
      </div>

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
