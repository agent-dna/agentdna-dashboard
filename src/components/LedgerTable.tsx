import type { Interaction } from "../types";
import { useResolveName } from "../context/DirectoryContext";
import { IntentIdChip } from "../context/IntentNumbersContext";
import { timeAgo } from "../lib/format";
import { AppIcon, isKnownApp } from "./AppIcon";

const TD_STYLE = { padding: "14px 22px", borderBottom: "1px solid var(--line)", verticalAlign: "middle" } as const;

export function LedgerTable({
  rows,
  emptyText = "No interactions",
  onView,
}: {
  rows: Interaction[];
  emptyText?: string;
  onView: (r: Interaction) => void;
}) {
  const resolve = useResolveName();

  function resolveName(did: string, apiName: string | undefined): string {
    const hit = resolve(did);
    if (hit.kind && hit.name) return hit.name;
    if (apiName && apiName.trim()) return apiName.trim();
    return hit.name || did || "—";
  }

  const TH = ({ children, right }: { children: React.ReactNode; right?: boolean }) => (
    <th style={{
      textAlign: right ? "right" : "left",
      font: "700 11.5px var(--font-body)",
      letterSpacing: "0.07em",
      textTransform: "uppercase",
      color: "var(--fg-muted)",
      padding: "13px 22px",
      background: "var(--bg-2)",
      borderBottom: "1px solid var(--line)",
      whiteSpace: "nowrap",
    }}>
      {children}
    </th>
  );

  if (rows.length === 0) {
    return (
      <div style={{ padding: "32px 20px", textAlign: "center", fontSize: 13, color: "var(--fg-faint)" }}>
        {emptyText}
      </div>
    );
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, fontSize: 13 }}>
        <thead>
          <tr>
            <TH>Interaction ID</TH>
            <TH>Initiator</TH>
            <TH>Interacted with</TH>
            <TH>Intent</TH>
            <TH>Threat</TH>
            <TH right>Time</TH>
            <TH right>{""}</TH>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.id}
              onClick={() => onView(r)}
              style={{
                cursor: "pointer",
                boxShadow: r.threat ? "inset 3px 0 0 var(--threat)" : undefined,
              }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLTableRowElement).style.background = "rgba(37,99,235,0.03)")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLTableRowElement).style.background = "")}
            >
              <td style={TD_STYLE}>
                <span style={{ font: "600 13px var(--font-mono)", color: "var(--fg)" }}>
                  {r.id.length > 12 ? r.id.slice(0, 4) + "…" + r.id.slice(-4) : r.id}
                </span>
              </td>
              <td style={TD_STYLE}>
                {(() => {
                  const name = resolveName(r.initiator.id, r.initiator.name);
                  return isKnownApp(name) ? (
                    <AppIcon name={name} size={22} />
                  ) : (
                    <span style={{ font: "600 13px var(--font-mono)", color: "var(--fg)" }}>{name}</span>
                  );
                })()}
              </td>
              <td style={TD_STYLE}>
                {(() => {
                  const name = resolveName(r.target.id, r.target.name);
                  return r.targetType === "tool" || isKnownApp(name) ? (
                    <AppIcon name={name} size={22} />
                  ) : (
                    <span style={{ font: "500 13px var(--font-mono)", color: "var(--fg-dim, var(--fg-muted))" }}>{name}</span>
                  );
                })()}
              </td>
              <td style={TD_STYLE}>
                <IntentIdChip id={r.intent.id} style={{ font: "500 13px var(--font-mono)", color: "var(--accent)" }} />
              </td>
              <td style={TD_STYLE}>
                {r.threat ? (
                  <span style={{ font: "600 11.5px var(--font-mono)", letterSpacing: "0.06em", padding: "3px 9px", borderRadius: 5, color: "var(--threat)", background: "rgba(220,38,38,0.10)" }}>
                    Detected
                  </span>
                ) : (
                  <span style={{ font: "600 11.5px var(--font-mono)", letterSpacing: "0.06em", padding: "3px 9px", borderRadius: 5, color: "var(--fg-muted)", background: "var(--bg-2)" }}>
                    Clear
                  </span>
                )}
              </td>
              <td style={{ ...TD_STYLE, textAlign: "right" }}>
                <span style={{ font: "500 12.5px var(--font-mono)", color: "var(--fg-faint)" }}>
                  {timeAgo(r.created)}
                </span>
              </td>
              <td style={{ ...TD_STYLE, textAlign: "right" }}>
                <span
                  onClick={(e) => { e.stopPropagation(); onView(r); }}
                  style={{ font: "600 12px var(--font-mono)", color: "var(--accent)", letterSpacing: "0.04em", cursor: "pointer" }}
                >
                  VIEW
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
