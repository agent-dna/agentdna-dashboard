import type { Interaction } from "../types";
import type { AuthEvidence } from "../api/observability";
import { useResolveName } from "../context/DirectoryContext";
import { IntentIdChip } from "../context/IntentNumbersContext";
import { timeAgo } from "../lib/format";
import { EntityLink } from "./EntityLink";

const TD_STYLE = { padding: "14px 22px", borderBottom: "1px solid var(--line)", verticalAlign: "middle", textAlign: "center" } as const;

export function LedgerTable({
  rows,
  emptyText = "No interactions",
  onView,
  showIntent = true,
  evidenceOf,
}: {
  rows: Interaction[];
  emptyText?: string;
  onView: (r: Interaction) => void;
  /** Hide the Intent column where every row shares one — e.g. an intent's own page. */
  showIntent?: boolean;
  /**
   * An interaction's auth checks (`undefined` while loading). When given, the table drops the
   * Interaction ID column for Identity (identity ID beside its auth method) and Result (auth status).
   */
  evidenceOf?: (interactionID: string) => AuthEvidence[] | undefined;
}) {
  const withEvidence = !!evidenceOf;
  const resolve = useResolveName();

  function resolveName(did: string, apiName: string | undefined): string {
    const hit = resolve(did);
    if (hit.kind && hit.name) return hit.name;
    if (apiName && apiName.trim()) return apiName.trim();
    return hit.name || did || "—";
  }

  const TH = ({ children }: { children: React.ReactNode; right?: boolean }) => (
    <th style={{
      textAlign: "center",
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
            {!withEvidence && <TH>Interaction ID</TH>}
            <TH>Initiator</TH>
            <TH>Interacted with</TH>
            {withEvidence && <TH>Identity</TH>}
            {withEvidence && <TH>Result</TH>}
            {showIntent && <TH>Intent</TH>}
            <TH>Incident</TH>
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
              {!withEvidence && <td style={TD_STYLE}>
                <span
                  onClick={(e) => { e.stopPropagation(); onView(r); }}
                  title={r.id}
                  style={{ font: "600 13px var(--font-mono)", color: "var(--fg)", cursor: "pointer" }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLSpanElement).style.textDecoration = "underline")}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLSpanElement).style.textDecoration = "none")}
                >
                  {r.id.length > 12 ? r.id.slice(0, 4) + "…" + r.id.slice(-4) : r.id}
                </span>
              </td>}
              <td style={TD_STYLE}>
                <EntityLink
                  did={r.initiator.id}
                  fallbackName={r.initiator.name}
                  style={{ font: "600 13px var(--font-mono)" }}
                  color="var(--fg)"
                >
                  {resolveName(r.initiator.id, r.initiator.name)}
                </EntityLink>
              </td>
              <td style={TD_STYLE}>
                {r.initiator.id === r.target.id ? (
                  <span style={{ font: "500 13px var(--font-mono)", color: "var(--fg-faint)" }}>—</span>
                ) : (
                  <EntityLink
                    did={r.target.id}
                    fallbackName={r.target.name}
                    style={{ font: "500 13px var(--font-mono)" }}
                    color="var(--fg-dim, var(--fg-muted))"
                  >
                    {resolveName(r.target.id, r.target.name)}
                  </EntityLink>
                )}
              </td>
              {evidenceOf && <EvidenceCells checks={evidenceOf(r.id)} />}
              {showIntent && (
                <td style={TD_STYLE}>
                  <IntentIdChip id={r.intent.id} style={{ font: "500 13px var(--font-mono)", color: "var(--accent)" }} />
                </td>
              )}
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
              <td style={TD_STYLE}>
                <span style={{ font: "500 12.5px var(--font-mono)", color: "var(--fg-faint)" }}>
                  {timeAgo(r.created)}
                </span>
              </td>
              <td style={TD_STYLE}>
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

const short = (id: string) => (id.length > 18 ? `${id.slice(0, 8)}…${id.slice(-6)}` : id);
/** "api_key" → "Api key". */
const sentence = (v: string) => {
  const t = v.replace(/_/g, " ").trim();
  return t ? t[0].toUpperCase() + t.slice(1) : "";
};

/**
 * Identity and Result cells for an interaction's auth checks: the identity that presented the
 * credential beside its auth method, and whether the checks passed.
 */
function EvidenceCells({ checks }: { checks: AuthEvidence[] | undefined }) {
  const faint = <span style={{ font: "500 13px var(--font-mono)", color: "var(--fg-faint)" }}>—</span>;
  if (!checks) return <><td style={TD_STYLE}>{faint}</td><td style={TD_STYLE}>{faint}</td></>;

  const identities = [...new Set(checks.map((c) => c.identityID).filter(Boolean))];
  const methods = [...new Set(checks.map((c) => c.authMethod).filter(Boolean))].map(sentence);
  const failed = checks.filter((c) => c.authStatus?.toLowerCase() !== "ok");
  const result =
    checks.length === 0
      ? { text: "No evidence", color: "var(--warn)", bg: "rgba(217,119,6,0.10)" }
      : failed.length > 0
        ? { text: sentence(failed[0].authStatus || "") || "Failed", color: "var(--threat)", bg: "rgba(220,38,38,0.10)" }
        : { text: "Passed", color: "var(--safe)", bg: "rgba(5,150,105,0.10)" };

  return (
    <>
      <td style={TD_STYLE}>
        {identities.length === 0 ? faint : (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8, whiteSpace: "nowrap" }}>
            <span title={identities.join("\n")} style={{ font: "500 13px var(--font-mono)", color: "var(--fg)" }}>
              {short(identities[0])}
              {identities.length > 1 && <span style={{ color: "var(--fg-muted)" }}> +{identities.length - 1}</span>}
            </span>
            {methods.length > 0 && (
              <span style={{ font: "500 11.5px var(--font-body)", padding: "2px 8px", borderRadius: 5, background: "var(--bg-2)", color: "var(--fg-dim)" }}>
                {methods.join(", ")}
              </span>
            )}
          </span>
        )}
      </td>
      <td style={TD_STYLE}>
        <span style={{ font: "600 11.5px var(--font-mono)", letterSpacing: "0.06em", padding: "3px 9px", borderRadius: 5, color: result.color, background: result.bg, whiteSpace: "nowrap" }}>
          {result.text}
        </span>
      </td>
    </>
  );
}

