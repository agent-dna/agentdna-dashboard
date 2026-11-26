import { useNavigate } from "react-router-dom";
import { Icon } from "./Icon";
import { DataTable, type DataTableColumn } from "./DataTable";
import { DestinationLogo } from "./DestinationLogo";
import { TrustStatusChip } from "./TrustStatusChip";
import { TrustStatusPicker } from "./TrustStatusPicker";
import { CopyId } from "../pages/observability/IntentDetailPanel";
import { authMethodLabel } from "../lib/credFormat";
import { credentialPath, resourceLabel, resourcePath } from "../lib/resource";
import type { IntentCredential } from "../lib/intentResources";
import type { IntentResource, TrustStatus } from "../data/api";

/**
 * The Resources tab of the intent page: two boxes. Destinations is every outside service a server
 * called while serving this intent (/intent-info's `resources`, most used first) with its trust
 * status; flagged rows are tinted and admins change a status in place. Credentials is every
 * credential the hops presented, from their auth checks. Clicking anywhere on a row opens its page
 * (the trust-status picker stops its own clicks, so changing a status stays in place).
 */
export function IntentResources({ resources, credentials, credentialsLoading, isAdmin, onTrustChange }: {
  resources: IntentResource[];
  credentials: IntentCredential[];
  credentialsLoading: boolean;
  isAdmin: boolean;
  onTrustChange: (resourceID: string, status: TrustStatus) => void;
}) {
  const navigate = useNavigate();
  const destRows = resources.map((r) => ({ ...r, id: r.resourceID }));
  const credRows = credentials.map((c) => ({ ...c, id: c.credentialID }));

  const destCols: DataTableColumn<IntentResource & { id: string }>[] = [
    {
      key: "resource",
      label: "Destination",
      render: (r) => {
        const { title, dest } = resourceLabel(r.url, r.name);
        return (
          <span className="rt-res">
            <span className="dest-row-logo">
              <DestinationLogo entity={dest.entity} size={15} />
            </span>
            <span className="rt-names">
              <span className="rt-title">{title}</span>
              <span className="rt-sub" title={r.url}>{r.url}</span>
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
          <TrustStatusPicker resourceID={r.resourceID} current={r.trustStatus} onSaved={(s) => onTrustChange(r.resourceID, s)} />
        ) : (
          <TrustStatusChip value={r.trustStatus} />
        ),
    },
  ];

  const credCols: DataTableColumn<IntentCredential & { id: string }>[] = [
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
    { key: "method", label: "Auth method", width: 150, render: (c) => <span className="res-dim">{authMethodLabel(c.authMethod) || "Not reported"}</span> },
  ];

  return (
    <div className="ir">
      <section className="ir-box" aria-labelledby="ir-dest-title">
        <header className="ir-head">
          <h3 id="ir-dest-title">Destinations</h3>
          <span className="rt-count">{resources.length}</span>
        </header>
        <DataTable
          rows={destRows}
          columns={destCols}
          alignCells
          onRowClick={(r) => navigate(resourcePath(r.resourceID))}
          rowStyle={(r) => (r.trustStatus === "Flagged" ? { background: "rgba(220,38,38,.045)" } : undefined)}
          emptyText="This intent reached no recorded destination."
        />
      </section>
      <section className="ir-box" aria-labelledby="ir-cred-title">
        <header className="ir-head">
          <h3 id="ir-cred-title">Credentials</h3>
          <span className="rt-count">{credentials.length}</span>
        </header>
        <DataTable
          rows={credRows}
          columns={credCols}
          alignCells
          onRowClick={(c) => navigate(credentialPath(c.credentialID))}
          emptyText={credentialsLoading ? "Loading credentials…" : "No credential was presented in this intent."}
        />
      </section>
    </div>
  );
}

const shortId = (s: string) => (s.length > 22 ? `${s.slice(0, 10)}…${s.slice(-6)}` : s);
