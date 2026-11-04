import { useState, type KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, KeyRound } from "lucide-react";
import { useCredentialsPaged, useResourcesPaged } from "../../data/hooks";
import { CopyId } from "../observability/IntentDetailPanel";
import { authMethodLabel } from "../../lib/credFormat";
import { credentialPath, resourceLabel, resourcePath, whenShort } from "../../lib/resource";
import { DestinationLogo } from "../../components/DestinationLogo";
import { MetricTile } from "../../components/MetricTile";
import { CredentialStatusChip, credentialStatusLabel } from "../../components/CredentialStatusChip";
import { CREDENTIAL_STATUSES, type CredentialStatusValue } from "../../data/api";

/**
 * Resources: the outside services the org's agents and apps call (GET /resources-list), beside
 * every credential seen in the org (GET /credentials-list, most recently used first). Each
 * table pages on its own; clicking a row opens that resource's or credential's page.
 */

const shortId = (s: string) => (s.length > 20 ? `${s.slice(0, 10)}…${s.slice(-6)}` : s);

/** "just now", "5m ago", "3h ago", "2d ago", else the date. */
function ago(iso: string): string {
  const t = Date.parse(iso);
  if (!iso || !Number.isFinite(t)) return "—";
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)}d ago`;
  // Older than a month: day and month only; the year and time are on hover.
  return new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** Rows open on click or Enter. */
const rowProps = (go: () => void) => ({
  tabIndex: 0,
  onClick: go,
  onKeyDown: (e: KeyboardEvent) => {
    if (e.key === "Enter") go();
  },
});

/** "1–10 of 65" with previous and next. Hidden for a single page. */
function Pager({ page, totalPages, total, pageSize, onChange }: { page: number; totalPages: number; total: number; pageSize: number; onChange: (p: number) => void }) {
  if (totalPages <= 1) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  return (
    <div className="rt-pager">
      <span>
        {from}–{to} of {total.toLocaleString()}
      </span>
      <button type="button" onClick={() => onChange(page - 1)} disabled={page <= 1} aria-label="Previous page">
        <ChevronLeft size={14} />
      </button>
      <button type="button" onClick={() => onChange(page + 1)} disabled={page >= totalPages} aria-label="Next page">
        <ChevronRight size={14} />
      </button>
    </div>
  );
}

export function ResourcesPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [credPage, setCredPage] = useState(1);
  const [credStatus, setCredStatus] = useState<CredentialStatusValue | "">("");
  const { data: resources, loading, error, refetch } = useResourcesPaged(page);
  const { data: credentials, loading: credsLoading, error: credsError, refetch: refetchCreds } = useCredentialsPaged(
    credPage,
    10,
    credStatus || undefined,
  );
  // A new filter starts from its first page, in the same render.
  const changeCredStatus = (v: CredentialStatusValue | "") => {
    setCredStatus(v);
    setCredPage(1);
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Resources</h1>
          <div className="sub">Outside services your agents and apps call, and the credentials presented to them</div>
        </div>
      </div>

      {/* Org-wide totals, from the same paged responses as the tables below. */}
      <div className="metrics res-metrics">
        <MetricTile label="Total Resources" value={loading && !resources.total ? "—" : resources.total.toLocaleString()} icon="globe" spark={[]} />
        <MetricTile label="Total Credentials" value={credsLoading && !credentials.total ? "—" : credentials.total.toLocaleString()} icon="key" spark={[]} />
      </div>

      <div className="res-grid">
        <section className="rt-panel" aria-labelledby="rt-res-title">
          <header className="rt-head">
            <h2 id="rt-res-title">Resources</h2>
            <span className="rt-count">{resources.total.toLocaleString()}</span>
            <Pager page={page} totalPages={resources.totalPages} total={resources.total} pageSize={resources.pageSize} onChange={setPage} />
          </header>
          {error ? (
            <div className="rt-empty">
              Couldn’t load resources: {error.message}
              <button type="button" className="rt-retry" onClick={refetch}>Retry</button>
            </div>
          ) : resources.items.length === 0 ? (
            <div className="rt-empty">{loading ? "Loading resources…" : "No resources yet. They appear once an app calls an outside service."}</div>
          ) : (
            <table className="rt">
              <colgroup>
                <col />
                <col style={{ width: 80 }} />
                <col style={{ width: 96 }} />
              </colgroup>
              <thead>
                <tr>
                  <th>Resource</th>
                  <th className="num">Intents</th>
                  <th className="num">Credentials</th>
                </tr>
              </thead>
              <tbody>
                {resources.items.map((r) => {
                  const { title, dest } = resourceLabel(r.url, r.name);
                  return (
                    <tr key={r.resourceID} {...rowProps(() => navigate(resourcePath(r.resourceID)))}>
                      <td>
                        <span className="rt-res">
                          <span className="rt-logo">
                            <DestinationLogo entity={dest.entity} size={16} />
                          </span>
                          <span className="rt-names">
                            <span className="rt-title">{title}</span>
                            <span className="rt-sub" title={r.url}>{r.url}</span>
                          </span>
                        </span>
                      </td>
                      <td className="num">
                        <span className="rt-num">{r.intentCount.toLocaleString()}</span>
                      </td>
                      <td className="num">
                        <span className="rt-num">{r.credentialCount.toLocaleString()}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>

        <section className="rt-panel" aria-labelledby="rt-cred-title">
          <header className="rt-head">
            <h2 id="rt-cred-title">Credentials</h2>
            <span className="rt-count">{credentials.total.toLocaleString()}</span>
            <select
              className="rt-filter"
              value={credStatus}
              onChange={(e) => changeCredStatus(e.target.value as CredentialStatusValue | "")}
              aria-label="Filter credentials by status"
            >
              <option value="">All statuses</option>
              {CREDENTIAL_STATUSES.map((s) => (
                <option key={s} value={s}>{credentialStatusLabel(s)}</option>
              ))}
            </select>
            <Pager page={credPage} totalPages={credentials.totalPages} total={credentials.total} pageSize={credentials.pageSize} onChange={setCredPage} />
          </header>
          {credsError ? (
            <div className="rt-empty">
              Couldn’t load credentials: {credsError.message}
              <button type="button" className="rt-retry" onClick={refetchCreds}>Retry</button>
            </div>
          ) : credentials.items.length === 0 ? (
            <div className="rt-empty">
              {credsLoading
                ? "Loading credentials…"
                : credStatus
                ? `No ${credentialStatusLabel(credStatus).toLowerCase()} credentials.`
                : "No credentials seen yet. They appear once an agent or app presents one."}
            </div>
          ) : (
            <table className="rt">
              <colgroup>
                <col />
                <col style={{ width: 128 }} />
                <col style={{ width: 112 }} />
                <col style={{ width: 72 }} />
                <col style={{ width: 92 }} />
              </colgroup>
              <thead>
                <tr>
                  <th>Credential</th>
                  <th>Auth method</th>
                  <th>Status</th>
                  <th className="num">Intents</th>
                  <th className="num">Last used</th>
                </tr>
              </thead>
              <tbody>
                {credentials.items.map((c) => (
                  <tr key={c.credentialID} {...rowProps(() => navigate(credentialPath(c.credentialID)))}>
                    <td>
                      <span className="rt-cred">
                        <KeyRound size={13} className="rt-key" aria-hidden />
                        <span className="rt-mono" title={c.credentialID}>{shortId(c.credentialID)}</span>
                        <span onClick={(e) => e.stopPropagation()}>
                          <CopyId value={c.credentialID} label="credential ID" />
                        </span>
                      </span>
                    </td>
                    <td>
                      <span className={`rt-tag${c.authMethod ? "" : " none"}`}>{authMethodLabel(c.authMethod) || "Not reported"}</span>
                    </td>
                    <td>
                      <CredentialStatusChip value={c.status.value} title={c.status.reason || undefined} />
                    </td>
                    <td className="num">
                      <span className="rt-num">{c.intentCount.toLocaleString()}</span>
                    </td>
                    <td className="num">
                      <span className="rt-when" title={whenShort(c.lastUsedAt)}>{ago(c.lastUsedAt)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </div>
  );
}
