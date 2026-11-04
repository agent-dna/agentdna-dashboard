import type { NavigateFunction } from "react-router-dom";
import { Icon } from "./Icon";
import { InspectButton } from "./InspectButton";
import { AppIcon } from "./AppIcon";
import { ThreatPill } from "./ThreatPill";
import type { DataTableColumn } from "./DataTable";
import { IntentIdChip } from "../context/IntentNumbersContext";
import { timeAgo, capitalizeFirst } from "../lib/format";
import type { Intent } from "../types";

/**
 * The intents table's columns, shared by the Home page and a resource's page so the two tables
 * stay identical: intent, initiator, interactions, apps interacted, incidents, time, Inspect.
 */
export function intentTableColumns(navigate: NavigateFunction): DataTableColumn<Intent>[] {
  return [
    {
      key: "id",
      label: "Intent",
      render: (r) => (
        <IntentIdChip id={r.id} style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 600, color: "var(--fg)" }} />
      ),
    },
    {
      key: "initiator",
      label: "Initiator",
      render: (r) => (
        <span style={{ fontSize: 13, color: "var(--fg)", fontWeight: 600 }}>{capitalizeFirst(r.initiator.name)}</span>
      ),
    },
    {
      key: "interactions",
      label: "Interactions",
      render: (r) => <span style={{ fontFamily: "var(--font-mono)", fontSize: 13 }}>{r.interactionsCount}</span>,
    },
    {
      key: "apps",
      label: "Apps interacted",
      render: (r) => {
        // /intent-list's `apps`: each app the intent called, with its name.
        const apps = r.appsInteracted;
        if (apps && apps.length > 0) {
          const shown = apps.slice(0, 3);
          return (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {shown.map((app) =>
                app.name ? (
                  // Brand logo when known, else the default tile with the app's first letter.
                  <span key={app.id} title={app.name} style={{ display: "inline-flex" }}>
                    <AppIcon name={app.name} size={22} />
                  </span>
                ) : (
                  <span key={app.id} title={`App ${app.id}`} className="app-icon-unnamed">
                    <Icon name="apps" size={12} />
                  </span>
                ),
              )}
              {apps.length > shown.length && (
                <span
                  style={{ fontSize: 13, color: "var(--fg-muted)", fontFamily: "var(--font-mono)" }}
                  title={apps.slice(shown.length).map((a) => a.name || a.id).join(", ")}
                >
                  +{apps.length - shown.length}
                </span>
              )}
            </div>
          );
        }
        // Older responses without `apps` only have a count.
        return r.toolsInteracted > 0 && !apps ? (
          <span style={{ fontSize: 13, color: "var(--fg-dim)", fontWeight: 600 }}>
            {r.toolsInteracted} {r.toolsInteracted === 1 ? "app" : "apps"}
          </span>
        ) : (
          <span style={{ color: "var(--fg-faint)", fontFamily: "var(--font-mono)", fontSize: 13 }}>—</span>
        );
      },
    },
    {
      key: "threats",
      label: "Incidents",
      render: (r) => <ThreatPill threat={r.threats > 0} />,
    },
    {
      key: "time",
      label: "Time",
      align: "right",
      render: (r) => (
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--fg-muted)" }}>{timeAgo(r.started)}</span>
      ),
    },
    {
      key: "actions",
      label: "",
      align: "right",
      // Fits the Inspect button plus cell padding, so it can't push the table into a scroll.
      width: 112,
      render: (r) => (
        <div className="row-actions">
          <InspectButton onClick={() => navigate(`/intents/${r.id}`)} />
        </div>
      ),
    },
  ];
}
