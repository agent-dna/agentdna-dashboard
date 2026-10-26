import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Icon } from "../../components/Icon";
import { DataTable, type DataTableColumn } from "../../components/DataTable";
import { Pagination } from "../../components/Pagination";
import { DestinationLogo } from "../../components/DestinationLogo";
import { useIntentsByIds, useResourceInfo } from "../../data/hooks";
import { intentTableColumns } from "../../components/intentTableColumns";
import { ApiError } from "../../api/client";
import { CopyId } from "../observability/IntentDetailPanel";
import { authMethodLabel } from "../../lib/credFormat";
import { CredentialStatusChip } from "../../components/CredentialStatusChip";
import { credentialPath, resourceLabel } from "../../lib/resource";
import type { ResourceCredential } from "../../data/api";
import type { Intent } from "../../types";

/**
 * One resource (GET /resource-info): which service it is, the intents that reached it (newest
 * first, with the credentials each presented there) and the credentials presented to it (most
 * used first). The two lists page separately.
 */

type Tab = "intents" | "credentials";

const shortId = (s: string) => (s.length > 22 ? `${s.slice(0, 10)}…${s.slice(-6)}` : s);

export function ResourceDetailPage() {
  const { resourceId = "" } = useParams<{ resourceId: string }>();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("intents");
  const [intentsPage, setIntentsPage] = useState(1);
  const [credentialsPage, setCredentialsPage] = useState(1);
  const { data: res, loading, error, refetch } = useResourceInfo(resourceId, intentsPage, credentialsPage);
  // The intents table matches Home's, which needs each intent's own details (interactions, apps).
  const pageIntentIds = res?.intents.items.map((i) => i.intentID) ?? [];
  const { data: pageIntents, loading: pageIntentsLoading } = useIntentsByIds(pageIntentIds);

  const back = (
    <button className="btn" style={{ marginTop: 16 }} onClick={() => navigate("/resources")}>
      <Icon name="arrowRight" size={14} style={{ transform: "rotate(180deg)" }} /> Back to resources
    </button>
  );

  if (!res && loading) {
    return (
      <div className="page">
        <div className="stub"><h2>Loading…</h2></div>
      </div>
    );
  }
  if (!res) {
    const notFound = error instanceof ApiError && error.status === 404;
    return (
      <div className="page">
        <div className="stub">
          <h2>{notFound ? "Resource not found" : "Couldn’t load this resource"}</h2>
          <div style={{ fontSize: 13, color: "var(--fg-muted)", marginTop: 6 }}>
            {notFound ? "No intent in your organization has reached it." : error?.message}
          </div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, marginTop: 6 }}>{resourceId}</div>
          <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
            {back}
            {!notFound && (
              <button className="btn" style={{ marginTop: 16 }} onClick={refetch}>Retry</button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const { title, dest } = resourceLabel(res.url, res.name);

  const intentCols = intentTableColumns(navigate);
  // Each row is the intent as /intent-info has it; one that failed to load is skipped.
  const intentRows = pageIntents.filter((i): i is Intent => !!i);

  const credentialCols: DataTableColumn<ResourceCredential & { id: string }>[] = [
    {
      key: "credential",
      label: "Credential",
      render: (c) => (
        <span className="res-cred">
          <span className="res-key">
            <Icon name="key" size={12} />
          </span>
          <span className="res-mono" title={c.credentialID}>{shortId(c.credentialID)}</span>
          <span onClick={(e) => e.stopPropagation()}>
            <CopyId value={c.credentialID} label="credential ID" />
          </span>
        </span>
      ),
    },
    { key: "method", label: "Auth method", render: (c) => <span className="res-dim">{authMethodLabel(c.authMethod) || "Not reported"}</span> },
    { key: "status", label: "Status", render: (c) => <CredentialStatusChip value={c.status} /> },
    {
      key: "intents",
      label: "Intents",
      align: "right",
      render: (c) => <span style={{ fontFamily: "var(--font-mono)", fontSize: 12.5 }}>{c.intentCount.toLocaleString()}</span>,
    },
  ];

  return (
    <div className="page">
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 14, fontSize: 13 }}>
        <button className="btn ghost" style={{ padding: "4px 8px", fontSize: 12.5 }} onClick={() => navigate("/resources")}>
          <Icon name="arrowRight" size={12} style={{ transform: "rotate(180deg)" }} /> Resources
        </button>
        <span style={{ color: "var(--fg-faint)" }}>/</span>
        <span style={{ color: "var(--fg)", fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 600 }}>{title}</span>
      </div>

      <div className="card" style={{ padding: "24px 28px", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 20 }}>
          <span className="res-logo big">
            <DestinationLogo entity={dest.entity} size={34} />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <h1 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 600, letterSpacing: "-0.02em", color: "var(--fg)" }}>
                {title}
              </h1>
              <span className="chip info" style={{ fontSize: 10.5, padding: "2px 7px" }}>
                {dest.entity === "local" ? "local service" : "resource"}
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--fg-muted)", fontSize: 12.5, fontFamily: "var(--font-mono)", marginBottom: 16, minWidth: 0 }}>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={res.url}>{res.url}</span>
              <CopyId value={res.url} label="URL" />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 24, borderTop: "1px solid var(--line)", paddingTop: 16 }}>
              <Stat label="Intents" value={res.intentCount.toLocaleString()} />
              <Stat label="Credentials" value={res.credentialCount.toLocaleString()} />
              <Stat label="Host" value={dest.host || "—"} mono />
              <Stat label="Service" value={dest.entity === "web" ? "Web" : dest.name} />
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="tb-toolbar">
          <div className="filters">
            {([
              { key: "intents", label: "Intents", count: res.intents.total },
              { key: "credentials", label: "Credentials", count: res.credentials.total },
            ] as const).map((t) => (
              <div key={t.key} className={`tab ${tab === t.key ? "active" : ""}`} onClick={() => setTab(t.key)}>
                {t.label}
                <span className="pill">{t.count}</span>
              </div>
            ))}
          </div>
          {tab === "intents" ? (
            <Pagination page={intentsPage} totalPages={res.intents.totalPages} total={res.intents.total} pageSize={res.intents.pageSize} inline onChange={setIntentsPage} />
          ) : (
            <Pagination page={credentialsPage} totalPages={res.credentials.totalPages} total={res.credentials.total} pageSize={res.credentials.pageSize} inline onChange={setCredentialsPage} />
          )}
        </div>

        {tab === "intents" ? (
          <DataTable
            rows={intentRows}
            columns={intentCols}
            onRowClick={(r) => navigate(`/intents/${encodeURIComponent(r.id)}`)}
            emptyText={pageIntentsLoading || (pageIntentIds.length > 0 && pageIntents.length === 0) ? "Loading intents…" : "No intents have reached this resource."}
          />
        ) : (
          <DataTable
            rows={res.credentials.items.map((c) => ({ ...c, id: c.credentialID }))}
            columns={credentialCols}
            onRowClick={(c) => navigate(credentialPath(c.credentialID))}
            emptyText="No credentials have been presented to this resource."
          />
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--fg-muted)", marginBottom: 4 }}>{label}</div>
      <div
        style={{ fontFamily: mono ? "var(--font-mono)" : "var(--font-display)", fontSize: mono ? 14 : 18, fontWeight: 700, color: "var(--fg)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
        title={value}
      >
        {value}
      </div>
    </div>
  );
}
