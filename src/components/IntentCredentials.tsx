import { Fragment, useMemo, useState, type ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { authTone, fetchIntentAuthEvidence, type AuthEvidence } from "../api/observability";
import { useResolveName } from "../context/DirectoryContext";
import { useIntentInteractions } from "../data/hooks";
import { buildDestinationRows, type DestinationRow, type TrailLink } from "../lib/credentialTrail";
import { parseDestination } from "../lib/destination";
import { clockAt, loginLabel, statusLabel } from "../pages/observability/EvidenceTable";
import { identityLabel, shortId } from "../pages/observability/format";
import { useObsQuery } from "../pages/observability/useObsQuery";
import { DestinationLogo } from "./DestinationLogo";
import { Icon } from "./Icon";

/**
 * Credentials tab of the intent page. One row per outside service an app reached, read from the
 * service back to whoever started the request, by name: the service, the app that called it, the
 * agent that called the app, and so on. "Evidence" opens every check behind the row, keys included.
 * Data: `/intent-auth-evidence` (shared with the Evidence trail tab) and `/intent-info`.
 */
export function IntentCredentials({ intentId }: { intentId: string }) {
  const resolve = useResolveName();
  const evidence = useObsQuery(`auth-evidence:${intentId}`, () => fetchIntentAuthEvidence(intentId));
  const { data: interactions, loading: ixLoading } = useIntentInteractions(intentId);
  const [open, setOpen] = useState<string | null>(null);

  const rows = useMemo(() => {
    const name = (did: string, given?: string) => (given && !given.includes("…") ? given : resolve(did).name || shortId(did));
    return buildDestinationRows(evidence.data?.interactions ?? [], interactions, name);
  }, [evidence.data, interactions, resolve]);

  if (evidence.loading || ixLoading) return <div className="ix-empty">Loading credentials…</div>;
  if (evidence.error) {
    return (
      <div className="ix-empty">
        Couldn't load this intent's credentials: {evidence.error}.{" "}
        <button type="button" className="btn ghost" onClick={evidence.retry}>Try again</button>
      </div>
    );
  }
  if (!rows.length) {
    return <div className="ix-empty">No app in this intent called an outside service, so there are no credentials to follow.</div>;
  }

  return (
    <div className="ct">
      <ul className="ct-list">
        {rows.map((r) => (
          <DestinationItem key={r.key} row={r} open={open === r.key} onToggle={() => setOpen(open === r.key ? null : r.key)} />
        ))}
      </ul>
    </div>
  );
}

function DestinationItem({ row, open, onToggle }: { row: DestinationRow; open: boolean; onToggle: () => void }) {
  const panelId = `ct-ev-${row.key.replace(/[^a-z0-9]/gi, "")}`;
  return (
    <li className={`ct-row ${row.tone}${open ? " open" : ""}`}>
      <div className="ct-head">
        <div className="ct-main">
          <div className="ct-path">
            <span className="ct-dest" title={row.raw}>
              <span className="ct-dest-logo"><DestinationLogo entity={row.dest.entity} size={14} /></span>
              {row.label}
            </span>
            <Back />
            <span className="ct-party">{row.callerName}</span>
            {row.trail.map((l) => (
              <Fragment key={l.interactionId}>
                <Back />
                <LinkFlags link={l} />
                <span className="ct-party">{l.fromName}</span>
              </Fragment>
            ))}
          </div>
          <div className="ct-meta">
            <ReplyPill row={row} />
          </div>
        </div>
        <button type="button" className="ct-toggle" aria-expanded={open} aria-controls={panelId} onClick={onToggle}>
          Evidence
          <Icon name="chevronDown" size={13} />
        </button>
      </div>
      {open && (
        <div id={panelId} className="ct-evidence">
          <RowEvidence row={row} />
        </div>
      )}
    </li>
  );
}

const Back = () => <ArrowLeft size={13} className="ct-back" aria-label="reached by" />;

/**
 * Names only in the trail; keys and auth methods are in the Evidence table. A hand-off is flagged
 * only when something is off: the key changed on the way, or the receiver's check failed or wasn't seen.
 */
function LinkFlags({ link }: { link: TrailLink }) {
  return (
    <>
      {link.match === "changed" && <span className="ct-chip bad" title="The receiver got a different key from the one the sender sent">key changed</span>}
      {link.tone === "warn" && <span className="ct-chip warn" title={`${link.toName}'s check of this key wasn't recorded`}>not verified</span>}
      {link.tone === "bad" && <span className="ct-chip bad">rejected</span>}
    </>
  );
}

function ReplyPill({ row }: { row: DestinationRow }) {
  const n = row.onward.length;
  const times = n > 1 ? ` ×${n}` : "";
  if (row.tone === "ok") return <span className="ct-chip ok">replied OK{times}</span>;
  if (row.tone === "warn") return <span className="ct-chip warn">reply not recorded{times}</span>;
  return <span className="ct-chip bad">rejected{times}</span>;
}

/** Every check behind the row, oldest first, with where each one was seen and where it went. */
function RowEvidence({ row }: { row: DestinationRow }) {
  const resolve = useResolveName();
  const lines: { e: AuthEvidence; to: string }[] = [
    ...[...row.trail].reverse().flatMap((l) => l.checks.map((e) => ({ e, to: l.toName }))),
    ...row.onward.map((e) => ({ e, to: row.label })),
  ];
  const sentTo = (e: AuthEvidence, fallback: string) => {
    const raw = (e.destination || "").trim();
    if (!raw) return fallback;
    if (raw.toLowerCase().startsWith("bafy")) return resolve(raw).name || shortId(raw);
    // The address itself for websites and local services ("127.0.0.1"), else the service name.
    const d = parseDestination(raw);
    return d.entity === "web" || d.entity === "local" ? d.host || raw : d.name;
  };
  const requests = [...new Set(lines.map((l) => l.e.requestID).filter(Boolean))];
  return (
    <div className="evt">
      <div className="evt-scroll">
        <table className="evt-table">
          <thead>
            <tr>
              <th scope="col">Seen at</th>
              <th scope="col">Seen by</th>
              <th scope="col">Login</th>
              <th scope="col">Key fingerprint</th>
              <th scope="col">Person</th>
              <th scope="col">Sent to</th>
              <th scope="col">Reply</th>
            </tr>
          </thead>
          <tbody>
            {lines.map(({ e, to }, k) => {
              const at = clockAt(e.observedAt);
              const seenBy = (e.source || "").replace(/_/g, " ");
              return (
                <tr key={`${e.requestID}:${e.source}:${k}`}>
                  <td className="evt-mono" title={at?.full}>{at?.short ?? <None />}</td>
                  <td>{seenBy ? seenBy[0].toUpperCase() + seenBy.slice(1) : <None />}</td>
                  <td>{loginLabel(e.authMethod) || <None />}</td>
                  <td className="evt-mono evt-key">{e.credentialID || <None />}</td>
                  <PersonCell e={e} empty={<None />} />
                  <td title={e.destination || undefined}>{sentTo(e, to)}</td>
                  <td className={`evt-status ${authTone(e.authStatus)}`}>{statusLabel(e.authStatus)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {requests.length > 0 && (
        <div className="evt-foot">
          {requests.map((id) => (
            <span key={id} className="evt-req" title={id}>request {shortId(id)}</span>
          ))}
        </div>
      )}
    </div>
  );
}

const None = () => <span className="evt-none" aria-label="None">—</span>;

/** The person behind a check: their first name, the full name and ID on hover (the short ID when unnamed). */
function PersonCell({ e, empty }: { e: AuthEvidence; empty: ReactNode }) {
  const who = identityLabel(e);
  if (!who) return <td>{empty}</td>;
  return <td className={who.named ? undefined : "evt-mono"} title={who.title}>{who.text}</td>;
}
