import { Icon } from "../components/Icon";
import { MetricTile } from "../components/MetricTile";
import { FilterPill } from "../components/FilterPill";
import { DataTable } from "../components/DataTable";
import { useAlerts } from "../data/hooks";
import { useDrawer } from "../context/DrawerContext";
import { useInteractionColumns } from "./InteractionsPage";

export function AlertsPage() {
  const { data: threats } = useAlerts();
  const { openDrawer } = useDrawer();
  const cols = useInteractionColumns((k, e) => openDrawer(k, e));

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Alerts</h1>
          <div className="sub">{threats.length} threat-flagged interactions in the last 7 days</div>
        </div>
        <div className="right">
          <button className="btn">
            <Icon name="bell" size={14} />
            Notification rules
          </button>
          <button className="btn primary">Acknowledge all</button>
        </div>
      </div>

      <div className="metrics">
        <MetricTile label="Open Alerts" value={threats.length} icon="alerts" sparkColor="#DC2626" spark={[]} />
        <MetricTile label="Critical" value={Math.floor(threats.length * 0.35)} icon="zap" sparkColor="#D97706" spark={[]} />
        <MetricTile label="Acknowledged" value={Math.floor(threats.length * 1.6)} icon="shield" sparkColor="#0EA5E9" spark={[]} />
        <MetricTile label="MTTA" value="—" unit="min" icon="clock" sparkColor="#2563EB" spark={[]} />
      </div>

      <div className="card">
        <div className="tb-toolbar">
          <div className="filters">
            <FilterPill label="Severity" value="any" />
            <FilterPill label="Initiator" value="any" />
            <FilterPill label="Status" value="open" />
            <FilterPill label="Time" value="last 7d" />
          </div>
          <span className="count">{threats.length} flagged</span>
        </div>
        <DataTable
          rows={threats}
          columns={cols}
          onRowClick={(r) => openDrawer("interaction", r)}
          emptyText="No alerts"
        />
      </div>
    </div>
  );
}
