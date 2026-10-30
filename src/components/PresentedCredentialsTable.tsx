import { useNavigate } from "react-router-dom";
import { Icon } from "./Icon";
import { DataTable, type DataTableColumn } from "./DataTable";
import { CredentialStatusChip } from "./CredentialStatusChip";
import { CopyId } from "../pages/observability/IntentDetailPanel";
import { authMethodLabel, sentence } from "../lib/credFormat";
import { credentialPath, whenShort } from "../lib/resource";
import { timeAgo } from "../lib/format";
import type { PresentedCredential } from "../data/api";

/**
 * The credentials a user, admin or agent presented (most recently used first), on their detail
 * pages. One table for all three: the endpoints return the same shape. Each row opens the
 * credential's own page.
 */

const shortId = (s: string) => (s.length > 22 ? `${s.slice(0, 10)}…${s.slice(-6)}` : s);
const mono = (v: string, muted = false) => (
  <span style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, color: muted ? "var(--fg-muted)" : undefined }}>{v}</span>
);

export function PresentedCredentialsTable({ rows, loading, error, hideRequests = false }: {
  rows: PresentedCredential[];
  loading: boolean;
  error: Error | null;
  /** Leaves out the Requests column on user and agent pages. */
  hideRequests?: boolean;
}) {
  const navigate = useNavigate();
  const cols: DataTableColumn<PresentedCredential & { id: string }>[] = [
    {
      key: "credential",
      label: "Credential",
      render: (c) => (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 7, minWidth: 0 }}>
          <Icon name="key" size={13} style={{ color: "#B45309", flexShrink: 0 }} />
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, fontWeight: 600, color: "var(--fg)" }} title={c.credentialID}>
            {shortId(c.credentialID)}
          </span>
          <span onClick={(e) => e.stopPropagation()}>
            <CopyId value={c.credentialID} label="credential ID" />
          </span>
        </span>
      ),
    },
    { key: "method", label: "Auth method", render: (c) => <span>{authMethodLabel(c.authMethod) || "—"}</span> },
    {
      key: "seen",
      label: "Seen by",
      render: (c) => <span style={{ color: "var(--fg-muted)" }}>{c.sources.map(sentence).filter(Boolean).join(", ") || "—"}</span>,
    },
    ...(hideRequests
      ? []
      : [{ key: "requests", label: "Requests", render: (c: PresentedCredential) => mono(c.requestCount.toLocaleString()) }]),
    { key: "intents", label: "Intents", render: (c) => mono(c.intentCount.toLocaleString()) },
    { key: "status", label: "Status", render: (c) => <CredentialStatusChip value={c.status.value} title={c.status.reason || undefined} /> },
    {
      key: "lastUsed",
      label: "Last used",
      align: "right",
      render: (c) => {
        const timestamp = Date.parse(c.lastUsedAt);
        return (
          <span title={whenShort(c.lastUsedAt)}>
            {mono(Number.isFinite(timestamp) ? timeAgo(Math.max(0, (Date.now() - timestamp) / 60000)) : "—", true)}
          </span>
        );
      },
    },
  ];

  return (
    <DataTable
      rows={rows.map((c) => ({ ...c, id: c.credentialID }))}
      columns={cols}
      onRowClick={(c) => navigate(credentialPath(c.credentialID))}
      emptyText={error ? `Couldn’t load credentials: ${error.message}` : loading ? "Loading credentials…" : "No credentials used yet."}
    />
  );
}
