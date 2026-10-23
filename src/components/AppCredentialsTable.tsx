import { Fragment } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "./Icon";
import { IntentIdChip } from "../context/IntentNumbersContext";
import { CopyId } from "../pages/observability/IntentDetailPanel";
import { authMethodLabel } from "../lib/credFormat";
import type { AppCredentials } from "../data/api";

/**
 * The credentials presented to an app (GET /app-credentials), each with the intents it was
 * used in. A credential's ID and auth method span its intents' rows, so a credential reused
 * across many intents reads as one group. Clicking an intent opens it.
 */

/** "Oct 14, 2026, 09:11"; "" when unknown. */
function when(iso: string): string {
  const t = Date.parse(iso);
  if (!iso || !Number.isFinite(t)) return "";
  return new Date(t).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

/** Chip colour for an intent status. */
function statusTone(status: string): "safe" | "threat" | "info" | "" {
  const s = status.toLowerCase();
  if (s === "completed" || s === "finished" || s === "success") return "safe";
  if (s === "halted" || s === "failed" || s === "blocked" || s === "threat") return "threat";
  if (s === "running" || s === "active" || s === "in_progress") return "info";
  return "";
}

const shortId = (s: string) => (s.length > 22 ? `${s.slice(0, 10)}…${s.slice(-6)}` : s);

export function AppCredentialsTable({ data, loading, error }: {
  data: AppCredentials | null;
  loading: boolean;
  error: Error | null;
}) {
  const navigate = useNavigate();
  const creds = data?.credentials ?? [];

  if (loading) return <div className="appcred-empty">Loading credentials…</div>;
  if (error) return <div className="appcred-empty">Couldn’t load this app’s credentials: {error.message}</div>;
  if (creds.length === 0) {
    return <div className="appcred-empty">No credential has been presented to this app yet. Credentials appear here once an agent calls it with one.</div>;
  }

  return (
    <div className="table-wrap appcred">
      <table className="dt">
        <thead>
          <tr>
            <th>Credential</th>
            <th>Auth method</th>
            <th>Intent</th>
            <th>Initiator</th>
            <th>Status</th>
            <th>Started</th>
          </tr>
        </thead>
        <tbody>
          {creds.map((c) => {
            const rows = c.intents.length ? c.intents : [null];
            return (
              <Fragment key={c.credentialID}>
                {rows.map((it, i) => (
                  <tr
                    key={it?.intentID ?? "none"}
                    className={i === 0 ? "appcred-first" : ""}
                    onClick={it ? () => navigate(`/intents/${encodeURIComponent(it.intentID)}`) : undefined}
                    style={{ cursor: it ? "pointer" : "default" }}
                  >
                    {i === 0 && (
                      <>
                        <td rowSpan={rows.length} className="appcred-cred">
                          <div className="appcred-id">
                            <span className="appcred-key">
                              <Icon name="key" size={13} />
                            </span>
                            <span className="appcred-mono" title={c.credentialID}>
                              {shortId(c.credentialID)}
                            </span>
                            <span onClick={(e) => e.stopPropagation()}>
                              <CopyId value={c.credentialID} label="credential ID" />
                            </span>
                          </div>
                          <div className="appcred-sub">
                            Used in {c.intents.length} intent{c.intents.length === 1 ? "" : "s"}
                          </div>
                        </td>
                        <td rowSpan={rows.length} className="appcred-method">
                          {authMethodLabel(c.authMethod) || "Not reported"}
                        </td>
                      </>
                    )}
                    {it ? (
                      <>
                        <td>
                          <IntentIdChip id={it.intentID} style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, fontWeight: 600, color: "var(--fg)" }} />
                        </td>
                        <td className="appcred-strong">{it.initiatorName || "Unknown"}</td>
                        <td>
                          {it.status ? (
                            <span className={`chip ${statusTone(it.status)}`}>{it.status.replace(/_/g, " ")}</span>
                          ) : (
                            <span className="appcred-faint">Not reported</span>
                          )}
                        </td>
                        <td className="appcred-mono appcred-muted">{when(it.startedAt) || "—"}</td>
                      </>
                    ) : (
                      <td colSpan={4} className="appcred-faint">
                        Not linked to an intent yet.
                      </td>
                    )}
                  </tr>
                ))}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
