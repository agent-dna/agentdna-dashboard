import { useNavigate } from "react-router-dom";
import { Icon } from "./Icon";
import { DataTable, type DataTableColumn } from "./DataTable";
import { DestinationLogo } from "./DestinationLogo";
import { TrustStatusChip } from "./TrustStatusChip";
import { TrustStatusPicker } from "./TrustStatusPicker";
import { resourceLabel, resourcePath } from "../lib/resource";
import type { IntentResource, TrustStatus } from "../data/api";

/**
 * The Destinations tab of the intent page: every outside service a server called while serving
 * this intent (/intent-info's `resources`, most used first) with its trust status. Flagged rows
 * are tinted. Admins change a status in place; the caller keeps the new value so the header's
 * summary follows without a refetch.
 */
export function IntentDestinations({ resources, isAdmin, onTrustChange }: {
  resources: IntentResource[];
  isAdmin: boolean;
  onTrustChange: (resourceID: string, status: TrustStatus) => void;
}) {
  const navigate = useNavigate();
  const rows = resources.map((r) => ({ ...r, id: r.resourceID }));

  const cols: DataTableColumn<IntentResource & { id: string }>[] = [
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
    {
      key: "open",
      label: "",
      align: "right",
      width: 120,
      render: (r) => (
        <button
          type="button"
          className="dest-row-link"
          onClick={(e) => {
            e.stopPropagation();
            navigate(resourcePath(r.resourceID));
          }}
        >
          Open resource <Icon name="arrowUpRight" size={12} />
        </button>
      ),
    },
  ];

  return (
    <DataTable
      rows={rows}
      columns={cols}
      alignCells
      onRowClick={(r) => navigate(resourcePath(r.resourceID))}
      rowStyle={(r) => (r.trustStatus === "Flagged" ? { background: "rgba(220,38,38,.045)" } : undefined)}
      emptyText="This intent reached no recorded destination."
    />
  );
}
