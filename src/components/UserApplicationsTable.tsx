import { Fragment, useId, useMemo, useState } from "react";
import { ChevronRight, Search } from "lucide-react";
import { Link } from "react-router-dom";
import { CopyId } from "../pages/observability/IntentDetailPanel";
import { authMethodLabel } from "../lib/credFormat";
import { credentialPath, whenShort } from "../lib/resource";
import { initials, timeAgo } from "../lib/format";
import type { CredentialStatusValue, UserApplication } from "../data/api";

/** Intents listed in an expanded row before "View all". */
const INTENT_PREVIEW = 5;

const AVATAR_TINTS = [
  { bg: "rgba(37,99,235,0.10)", fg: "#2563EB" },
  { bg: "rgba(14,165,233,0.10)", fg: "#0284C7" },
  { bg: "rgba(5,150,105,0.10)", fg: "#059669" },
  { bg: "rgba(217,119,6,0.10)", fg: "#B45309" },
  { bg: "rgba(15,32,70,0.07)", fg: "var(--fg)" },
];

const STATUS_LABEL: Record<CredentialStatusValue, string> = { active: "Active", flagged: "Flagged", compromised: "Compromised" };

function tint(name: string) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_TINTS[h % AVATAR_TINTS.length];
}

const minutesSince = (iso: string) => {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? Math.max(0, (Date.now() - t) / 60000) : null;
};

function Ago({ iso }: { iso: string }) {
  const mins = minutesSince(iso);
  return <span className="apps-ago" title={whenShort(iso)}>{mins === null ? "—" : timeAgo(mins)}</span>;
}

/** Neutral pill like the rest of the row; only flagged/compromised get colour. */
function StatusPill({ value }: { value: CredentialStatusValue }) {
  const cls = value === "flagged" ? " warn" : value === "compromised" ? " threat" : "";
  return <span className={`chip${cls} apps-pill`}>{STATUS_LABEL[value]}</span>;
}

function summarize(app: UserApplication) {
  const lastUsedAt = app.credentials.reduce<string>((latest, c) =>
    (Date.parse(c.lastUsedAt) || 0) > (Date.parse(latest) || 0) ? c.lastUsedAt : latest, "");
  const methods = [...new Set(app.credentials.flatMap((c) => c.authMethods.map(authMethodLabel).filter(Boolean)))];
  return { lastUsedAt, methods };
}

/** "summaryagent.backend.local" → name, then the domain dimmed. */
function AppName({ name }: { name: string }) {
  const dot = name.indexOf(".");
  return <span className="apps-name" title={name}>
    {dot > 0 ? <>{name.slice(0, dot)}<span className="apps-name-domain">{name.slice(dot)}</span></> : name}
  </span>;
}

/** "fp_svc_5c1d…" → the short type prefix dimmed. */
function CredentialId({ id }: { id: string }) {
  const short = id.length > 22 ? `${id.slice(0, 12)}…${id.slice(-6)}` : id;
  const cut = short.indexOf("_");
  return <Link to={credentialPath(id)} title={id} className="apps-cred-id">
    {cut > 0 && cut <= 4 ? <><span className="apps-cred-prefix">{short.slice(0, cut + 1)}</span>{short.slice(cut + 1)}</> : short}
  </Link>;
}

function Details({ app, id }: { app: UserApplication; id: string }) {
  const [showAll, setShowAll] = useState(false);
  const intentIDs = [...new Set(app.intentIDs ?? [])];
  const shown = showAll ? intentIDs : intentIDs.slice(0, INTENT_PREVIEW);

  return <div id={id} className="apps-details">
    <section className="apps-pane">
      <header className="apps-pane-head">
        <h4>Credentials</h4><span className="apps-pane-count">{app.credentials.length}</span>
      </header>
      {!app.credentials.length ? <p className="apps-pane-empty">No credentials recorded for this application.</p> : (
        <div className="apps-cred-grid" role="table" aria-label={`Credentials for ${app.applicationName}`}>
          <div className="apps-cred-row apps-cred-cols" role="row">
            <span role="columnheader">ID</span><span role="columnheader">Method</span>
            <span role="columnheader">Status</span><span role="columnheader">Last used</span>
          </div>
          {app.credentials.map((c) => (
            <div key={c.credentialID} className="apps-cred-row" role="row">
              <span role="cell" className="apps-cred-idcell">
                <CredentialId id={c.credentialID} />
                <CopyId value={c.credentialID} label="credential ID" />
              </span>
              <span role="cell" className="apps-method">{c.authMethods.map(authMethodLabel).filter(Boolean).join(", ") || "—"}</span>
              <span role="cell"><StatusPill value={c.status} /></span>
              <span role="cell"><Ago iso={c.lastUsedAt} /></span>
            </div>
          ))}
        </div>
      )}
    </section>

    <section className="apps-pane">
      <header className="apps-pane-head">
        <h4>Intents</h4><span className="apps-pane-count">{app.intentCount.toLocaleString()}</span>
        {intentIDs.length > INTENT_PREVIEW && (
          <button type="button" className="apps-view-all" onClick={() => setShowAll((v) => !v)}>
            {showAll ? "Show fewer" : `Show all ${intentIDs.length}`}
          </button>
        )}
      </header>
      {!shown.length ? <p className="apps-pane-empty">
        {app.intentCount === 0 ? "No intents recorded for this application." : "No intent IDs returned for this application."}
      </p> : (
        <ul className="apps-intent-list">
          {shown.map((intentId) => (
            <li key={intentId}>
              <Link to={`/intents/${encodeURIComponent(intentId)}`} className="apps-intent-row">
                <span className="apps-intent-id">{intentId}</span>
                <ChevronRight size={14} className="apps-intent-chevron" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  </div>;
}

export function UserApplicationsTable({ applications }: { applications: UserApplication[] }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const panelId = useId();

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? applications.filter((a) => a.applicationName.toLowerCase().includes(q)) : applications;
  }, [applications, query]);

  const allOpen = visible.length > 0 && visible.every((a) => expanded.has(a.applicationName));
  const toggle = (name: string) => setExpanded((cur) => {
    const next = new Set(cur);
    if (!next.delete(name)) next.add(name);
    return next;
  });

  return <div className="applications-table">
    <div className="apps-toolbar">
      <label className="apps-filter">
        <Search size={16} />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter applications" aria-label="Filter applications" />
      </label>
      <span className="apps-total">{visible.length} of {applications.length} applications</span>
      <button type="button" className="btn" style={{ marginLeft: "auto" }} disabled={!visible.length}
        onClick={() => setExpanded(allOpen ? new Set() : new Set(visible.map((a) => a.applicationName)))}>
        {allOpen ? "Collapse all" : "Expand all"}
      </button>
    </div>

    <div className="table-wrap">
      <table className="dt applications-main" style={{ width: "100%", tableLayout: "fixed" }}>
        <thead><tr>
          <th style={{ width: 44 }} aria-label="Expand" />
          <th>Application</th>
          <th style={{ width: "22%" }}>Credentials</th>
          <th style={{ width: "12%" }}>Intents</th>
          <th style={{ width: "14%", textAlign: "right" }}>Last used</th>
        </tr></thead>
        <tbody>
          {!visible.length && <tr><td colSpan={5} style={{ padding: 40, textAlign: "center", color: "var(--fg-muted)" }}>
            {applications.length ? "No applications match this filter." : "No applications interacted with yet."}
          </td></tr>}
          {visible.map((app, index) => {
            const open = expanded.has(app.applicationName);
            const id = `${panelId}-${index}`;
            const { lastUsedAt, methods } = summarize(app);
            const t = tint(app.applicationName);
            return <Fragment key={app.applicationName}>
              <tr className={`applications-row${open ? " applications-row-open" : ""}`} onClick={() => toggle(app.applicationName)}>
                <td>
                  <button type="button" className="apps-expand" aria-expanded={open} aria-controls={open ? id : undefined}
                    aria-label={`${open ? "Collapse" : "Expand"} ${app.applicationName}`}
                    onClick={(e) => { e.stopPropagation(); toggle(app.applicationName); }}>
                    <ChevronRight size={16} style={{ transform: open ? "rotate(90deg)" : undefined }} />
                  </button>
                </td>
                <td>
                  <span style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                    <span className="apps-avatar" style={{ background: t.bg, color: t.fg }}>{initials(app.applicationName.split(".")[0].replace(/[-_]/g, " ")) || "?"}</span>
                    <AppName name={app.applicationName} />
                  </span>
                </td>
                <td>
                  <span className="apps-count">{app.credentials.length.toLocaleString()}</span>
                  <span className="apps-method" title={methods.join(", ")}>{methods[0] ?? "—"}{methods.length > 1 ? ` +${methods.length - 1}` : ""}</span>
                </td>
                <td><span className="apps-count">{app.intentCount.toLocaleString()}</span></td>
                <td style={{ textAlign: "right" }}>{lastUsedAt ? <Ago iso={lastUsedAt} /> : <span className="apps-ago">—</span>}</td>
              </tr>
              {open && <tr className="applications-row-open"><td colSpan={5} style={{ padding: 0 }}>
                <Details app={app} id={id} />
              </td></tr>}
            </Fragment>;
          })}
        </tbody>
      </table>
    </div>
  </div>;
}
