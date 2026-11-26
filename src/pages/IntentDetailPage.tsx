import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Icon } from "../components/Icon";
import { MetricTile } from "../components/MetricTile";
import { Tabs } from "../components/Tabs";
import { DataTable, type DataTableColumn } from "../components/DataTable";
import { EntityCell } from "../components/EntityCell";
import { EntityLink } from "../components/EntityLink";
import { entityPath } from "../lib/entityLinks";
import { useResolveName, shortDid } from "../context/DirectoryContext";
import { InfoStat } from "../components/InfoStat";
import { StatusPicker } from "../components/StatusPicker";
import { IntentEvidenceTrail } from "../components/IntentEvidenceTrail";
// import { IntentCredentials } from "../components/IntentCredentials"; // Credentials tab hidden for now
import { IntentResources } from "../components/IntentResources";
import { TrustStatusChip } from "../components/TrustStatusChip";
import { useAuth } from "../context/AuthContext";
import { useIntent, useIntentInteractions, useIntentInteractionsPaged, useIntentParticipants, useIntentThreats } from "../data/hooks";
import { useDrawer } from "../context/DrawerContext";
import { useIntentReview } from "../context/IntentReviewContext";
import { timeAgo, titleOrUnknown } from "../lib/format";
import { exportIntentPdf } from "../lib/exportIntentPdf";
import { intentTrustStatus, invalidateIntentInfo, updateIntentStatus, type IntentThreat, type TrustStatus, type WarningCount } from "../data/api";
import { IntentIdChip } from "../context/IntentNumbersContext";
import { branchName, compareInteractionIds, parseInteractionId } from "../lib/interactionBranch";
import { credentialPath, resourceLabel, resourcePath } from "../lib/resource";
import { CREDENTIAL_WARNING_CODES, NEW_HOST_WARNING_CODE, credentialsForWarning, intentCredentials, untrustedResources } from "../lib/intentResources";
import type { IntentParticipant, Tool, IntentReviewStatus } from "../types";

type Tab = "evidence" | /* "credentials" | */ "resources" | "participants";

export function IntentDetailPage() {
  const { intentId = "" } = useParams<{ intentId: string }>();
  const navigate = useNavigate();
  const { openDrawer } = useDrawer();
  const resolve = useResolveName();

  /**
   * Owner label: /intent-info's initiatorName, otherwise its full initiatorDID (not the
   * "did:abc…1234" short form, and never a bare "—").
   */
  function ownerLabel(initiator: { id: string; name: string }): { text: string; isDid: boolean } {
    const named = !!initiator.name && initiator.name !== shortDid(initiator.id);
    if (!named && initiator.id) return { text: initiator.id, isDid: true };
    return { text: initiator.name || "—", isDid: false };
  }
  const { refetch: refetchIntentReview } = useIntentReview();
  const { user } = useAuth();
  const isAdmin = !!user?.is_admin;
  const [tab, setTab] = useState<Tab>("evidence");
  /**
   * Trust statuses an admin changed on this page, by resource. The update call returns the saved
   * value, so rows and the header summary read from here rather than refetching the intent.
   */
  const [trustEdits, setTrustEdits] = useState<Record<string, TrustStatus>>({});
  /** The incident list starts collapsed to its one-line summary. */
  const [incidentsOpen, setIncidentsOpen] = useState(false);
  /** Same for the warnings list. */
  const [warningsOpen, setWarningsOpen] = useState(false);
  const intentState = useIntent(intentId);
  const { data: intent, loading } = intentState;
  // The first page of the intent's interactions: the incident count's fallback and Export use them.
  const { data: interactionsPaged } = useIntentInteractionsPaged(intentId, 1);
  const interactions = interactionsPaged.interactions;
  const { data: participants } = useIntentParticipants(intentId);
  // Every hop, with its auth checks and warnings (the same /intent-info the page already has).
  const { data: allInteractions, loading: allInteractionsLoading } = useIntentInteractions(intentId);
  const { data: threats, loading: threatsLoading, error: threatsError } = useIntentThreats(intentId);
  if (loading) {
    return (
      <div className="page">
        <div className="stub">
          <h2>Loading…</h2>
        </div>
      </div>
    );
  }

  if (!intent) {
    return (
      <div className="page">
        <div className="stub">
          <h2>Intent not found</h2>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, marginTop: 6 }}><IntentIdChip id={intentId} /></div>
          <button className="btn" style={{ marginTop: 16 }} onClick={() => navigate("/intents")}>
            <Icon name="arrowRight" size={14} style={{ transform: "rotate(180deg)" }} /> Back to intents
          </button>
        </div>
      </div>
    );
  }

  const participantRows = participants.map((p) => ({ ...p, id: `${p.type}:${p.entity.id}` }));
  const destinations = (intent.resources ?? []).map((r) => ({ ...r, trustStatus: trustEdits[r.resourceID] ?? r.trustStatus }));
  const trustSummary = intentTrustStatus(destinations);
  const flaggedCount = destinations.filter((r) => r.trustStatus === "Flagged").length;
  const changeTrust = (resourceID: string, status: TrustStatus) => {
    setTrustEdits((m) => ({ ...m, [resourceID]: status }));
    // The server recomputes warnings on a trust change, so the intent is read again (the row
    // already shows the new status from the edit above; the refetch keeps the warnings honest).
    invalidateIntentInfo(intent.id);
    intentState.refetch();
  };
  // Warnings (51xx): each code once, with how many hops carry it. Separate from incidents.
  const warnings: WarningCount[] = intent.warnings ?? [];
  const warningTotal = warnings.reduce((n, w) => n + w.count, 0);
  // The credentials the hops presented, for the Resources tab and the credential warnings.
  const credentials = intentCredentials(allInteractions);

  const changeStatus = async (next: IntentReviewStatus) => {
    await updateIntentStatus(intent.id, next);
    intentState.refetch();
    refetchIntentReview();
  };

  /**
   * Participants route to their own detail page when the directory knows what
   * they are; apps without a resolvable kind still fall back to the drawer.
   */
  const openParticipant = (p: IntentParticipant) => {
    const to = entityPath(resolve(p.entity.id).kind ?? (p.type === "agent" ? "agent" : undefined), p.entity.id);
    if (to) navigate(to);
    else openDrawer("tool", p.entity as unknown as Tool);
  };


  // Counted across the whole intent (every interaction), not just the page the table shows.
  const threatCount = threatsLoading || threatsError
    ? interactions.filter((i: { threat: boolean }) => i.threat).length
    : threats.length;

  const participantCols: DataTableColumn<IntentParticipant & { id: string }>[] = [
    {
      key: "name",
      label: "Name",
      render: (r) => (
        <EntityCell
          name={r.entity.name}
          sub={r.entity.id}
          nameNode={<EntityLink did={r.entity.id} fallbackName={r.entity.name} color="var(--fg)" />}
          subNode={<EntityLink did={r.entity.id} color="var(--fg-muted)">{r.entity.id}</EntityLink>}
          paletteIx={r.entity.name.charCodeAt(0)}
        />
      ),
    },
    {
      key: "count",
      label: "Interactions in this intent",
      align: "right",
      render: (r) => <span style={{ fontFamily: "var(--font-mono)", fontSize: 12.5 }}>{r.count}</span>,
    },
    {
      key: "threats",
      label: "Incidents",
      align: "right",
      render: (r) =>
        r.threats > 0 ? (
          <span className="chip threat">{r.threats}</span>
        ) : (
          <span style={{ color: "var(--fg-faint)", fontFamily: "var(--font-mono)", fontSize: 12.5 }}>0</span>
        ),
    },
    {
      key: "actions",
      label: "",
      align: "right",
      width: 60,
      render: (r) => (
        <div className="row-actions">
          <button
            className="btn-mini"
            onClick={(e) => {
              e.stopPropagation();
              openParticipant(r);
            }}
          >
            View
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="page">
      {/* Breadcrumb back */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 14, fontSize: 13 }}>
        <button
          className="btn ghost"
          style={{ padding: "4px 8px", fontSize: 12.5 }}
          onClick={() => navigate("/intents")}
        >
          <Icon name="arrowRight" size={12} style={{ transform: "rotate(180deg)" }} /> Intents
        </button>
        <span style={{ color: "var(--fg-faint)" }}>/</span>
        <IntentIdChip id={intent.id} style={{ color: "var(--fg)", fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 600 }} />
      </div>

      {/* Hero info card */}
      <div className="card" style={{ padding: "24px 28px", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 20 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
                gap: "20px 24px",
              }}
            >
              {/* Owner takes the first column of both rows; the other six stats fill the rest. */}
              <div style={{ gridRow: "1 / span 2", minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 10.5,
                    color: "var(--fg-muted)",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    marginBottom: 6,
                    fontWeight: 600,
                  }}
                >
                  Owner
                </div>
                {(() => {
                  const owner = ownerLabel(intent.initiator);
                  return (
                    <div
                      title={owner.isDid ? owner.text : undefined}
                      style={{
                        // A DID is long and not a name — render it in mono at a size that fits.
                        fontFamily: owner.isDid ? "var(--font-mono)" : "var(--font-display)",
                        fontSize: owner.isDid ? 13 : 20,
                        fontWeight: 600,
                        color: "var(--fg)",
                        letterSpacing: owner.isDid ? "0" : "-0.01em",
                        wordBreak: "break-all",
                        lineHeight: owner.isDid ? 1.45 : undefined,
                      }}
                    >
                      {/* The initiator is always a user, so it links to their page — same as the agent page's owner. */}
                      {intent.initiator.id ? (
                        <a
                          href={`/users/${encodeURIComponent(intent.initiator.id)}`}
                          title={owner.isDid ? owner.text : `Open ${owner.text}'s page`}
                          onClick={(e) => {
                            // Let modified clicks (new tab, etc.) behave natively.
                            if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
                            e.preventDefault();
                            navigate(`/users/${encodeURIComponent(intent.initiator.id)}`);
                          }}
                          className="owner-link owner-link--ink"
                        >
                          {owner.text}
                          <Icon name="arrowUpRight" size={13} />
                        </a>
                      ) : (
                        owner.text
                      )}
                    </div>
                  );
                })()}
                {/* The intent's record on the provenance layer, keyed by the intent ID. */}
                <a
                  href={`https://testnetexplorer.rubix.net/nft-explorer?token=${encodeURIComponent(intent.id)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    marginTop: 6,
                    fontFamily: "var(--font-mono)",
                    fontSize: 11.5,
                    color: "var(--accent)",
                    textDecoration: "none",
                    fontWeight: 600,
                    whiteSpace: "nowrap",
                  }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLAnchorElement).style.textDecoration = "underline")}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLAnchorElement).style.textDecoration = "none")}
                >
                  View on Provenance Layer ↗
                </a>
              </div>
              <InfoStat
                label="Intent ID"
                value={
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <IntentIdChip id={intent.id} />
                    <CopyButton text={intent.id} />
                  </div>
                }
              />
              <InfoStat label="Started" value={timeAgo(intent.started)} />
              <InfoStat
                label="Status"
                value={<StatusPicker status={intent.reviewStatus} hasIncident={threatCount > 0} onChange={changeStatus} />}
              />
              <InfoStat
                label="Resource status"
                value={
                  trustSummary ? (
                    <button
                      type="button"
                      className="it-trust-btn"
                      onClick={() => setTab("resources")}
                      title={
                        trustSummary === "Flagged"
                          ? `${flaggedCount} flagged destination${flaggedCount === 1 ? "" : "s"} — see Destinations`
                          : trustSummary === "Trusted"
                          ? "Every destination is trusted — see Destinations"
                          : "Some destinations are not reviewed yet — see Destinations"
                      }
                    >
                      <TrustStatusChip value={trustSummary} />
                    </button>
                  ) : (
                    <span className="it-trust-none" title="This intent reached no recorded destination">No destinations</span>
                  )
                }
              />
              <InfoStat
                label="Incident detected"
                value={
                  <span style={{ color: threatCount > 0 ? "var(--threat)" : "var(--fg)", fontWeight: 600 }}>
                    {threatCount}
                  </span>
                }
                mono
              />
              <InfoStat
                label="Warnings"
                value={
                  warningTotal > 0 ? (
                    <button
                      type="button"
                      className="it-stat-btn"
                      style={{ color: "var(--warn)", fontWeight: 600 }}
                      title={`${warnings.length} kind${warnings.length === 1 ? "" : "s"} of warning across ${warningTotal} hop${warningTotal === 1 ? "" : "s"}`}
                      onClick={() => setWarningsOpen((o) => !o)}
                    >
                      {warningTotal}
                    </button>
                  ) : (
                    <span style={{ fontWeight: 600 }}>0</span>
                  )
                }
                mono
              />
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8, position: "relative" }}>
            <button className="btn primary" onClick={() => navigate(`/graph/${intent.id}`)}>
              <Icon name="flow" size={14} />
              View Flow
            </button>
            <button
              className="btn"
              onClick={() => exportIntentPdf({ intent, interactions, participants })}
            >
              <Icon name="download" size={14} />
              Export
            </button>
          </div>
        </div>

        {threatCount > 0 && (
          <div className={`it-threats${incidentsOpen ? " open" : ""}`}>
            <button
              type="button"
              className="it-threats-head"
              aria-expanded={incidentsOpen}
              aria-controls="intent-incidents"
              onClick={() => setIncidentsOpen((o) => !o)}
            >
              <Icon name="shield" size={15} />
              <span className="it-threats-count">
                {threatCount} incident{threatCount === 1 ? "" : "s"} detected
              </span>
              <span className="it-threats-toggle">
                {incidentsOpen ? "Hide details" : "Show details"}
                <Icon name="chevronDown" size={13} />
              </span>
            </button>
            {!incidentsOpen ? null : threatsLoading ? (
              <div className="it-threats-note">Loading incident details…</div>
            ) : threatsError ? (
              <div className="it-threats-note">Couldn't load threat details: {threatsError.message}</div>
            ) : (
              <ol id="intent-incidents" className="it-threats-list">
                {[...threats]
                  .sort((a, b) => compareInteractionIds(a.interactionID, b.interactionID))
                  .map((t) => (
                    <ThreatRow key={t.threatID || t.interactionID} t={t} />
                  ))}
              </ol>
            )}
          </div>
        )}

        {warnings.length > 0 && (
          <div className={`it-warnings${warningsOpen ? " open" : ""}`}>
            <button
              type="button"
              className="it-warnings-head"
              aria-expanded={warningsOpen}
              aria-controls="intent-warnings"
              onClick={() => setWarningsOpen((o) => !o)}
            >
              <Icon name="alerts" size={15} />
              <span className="it-threats-count">
                {warningTotal} warning{warningTotal === 1 ? "" : "s"}
              </span>
              <span className="it-threats-toggle">
                {warningsOpen ? "Hide details" : "Show details"}
                <Icon name="chevronDown" size={13} />
              </span>
            </button>
            {warningsOpen && (
              <ul id="intent-warnings" className="it-warnings-list">
                {warnings.map((w) => (
                  <li key={w.code} className="it-warning">
                    <div className="it-warning-top">
                      <span className="it-warning-title">{w.title}</span>
                      <span className="it-threat-code">code {w.code}</span>
                    </div>
                    {/* 5101: the destinations in this intent that are not trusted. */}
                    {w.code === NEW_HOST_WARNING_CODE && (
                      <ul className="it-warning-refs">
                        {untrustedResources(destinations).map((r) => {
                          const { title } = resourceLabel(r.url, r.name);
                          return (
                            <li key={r.resourceID}>
                              <button type="button" className="it-warning-ref" onClick={() => navigate(resourcePath(r.resourceID))} title={r.url}>
                                <Icon name="globe" size={12} />
                                <span className="t">{title}</span>
                                <span className="s">{r.url}</span>
                              </button>
                              <TrustStatusChip value={r.trustStatus} />
                            </li>
                          );
                        })}
                      </ul>
                    )}
                    {/* 5105 / 5107 / 5108: the credentials on the hops that raised it. */}
                    {CREDENTIAL_WARNING_CODES.has(w.code) && (
                      <ul className="it-warning-refs">
                        {(allInteractionsLoading && credentials.length === 0
                          ? []
                          : credentialsForWarning(credentials, w.code)
                        ).map((c) => (
                          <li key={c.credentialID}>
                            <button type="button" className="it-warning-ref" onClick={() => navigate(credentialPath(c.credentialID))} title={c.credentialID}>
                              <Icon name="key" size={12} />
                              <span className="t">{c.credentialID.length > 22 ? `${c.credentialID.slice(0, 10)}…${c.credentialID.slice(-6)}` : c.credentialID}</span>
                              <span className="s">
                                {c.destinations.length} destination{c.destinations.length === 1 ? "" : "s"}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* Activity metrics */}
      <div className="metrics">
        {/* /intent-info's interactionsCount: the whole intent, not the first page of interactions. */}
        <MetricTile label="Interactions" value={intent.interactionsCount || interactions.length} icon="activity" sparkColor="#2563EB" spark={[]} />
        <MetricTile label="Agents touched" value={intent.agentsInteracted} icon="agents" sparkColor="#0EA5E9" spark={[]} />
        <MetricTile label="Apps touched" value={intent.toolsInteracted} icon="box" sparkColor="#0A2240" spark={[]} />
        <MetricTile label="Incidents" value={threatCount} icon="shield" sparkColor="#DC2626" spark={[]} />
      </div>

      {/* Tabbed table */}
      <div className="card">
        <Tabs
          active={tab}
          onChange={(k) => setTab(k as Tab)}
          tabs={[
            { key: "evidence", label: "Evidence trail" },
            // { key: "credentials", label: "Credentials" }, // hidden for now
            { key: "resources", label: "Resources", count: destinations.length + credentials.length },
            { key: "participants", label: "Agents & Apps", count: participantRows.length },
          ]}
        />

        {tab === "evidence" && <IntentEvidenceTrail intentId={intent.id} />}

        {/* {tab === "credentials" && <IntentCredentials intentId={intent.id} />} */}

        {tab === "resources" && (
          <IntentResources
            resources={destinations}
            credentials={credentials}
            credentialsLoading={allInteractionsLoading}
            isAdmin={isAdmin}
            onTrustChange={changeTrust}
          />
        )}

        {tab === "participants" && (
          <DataTable
            rows={participantRows}
            columns={participantCols}
            onRowClick={(r) => openParticipant(r)}
            emptyText="No participants found."
          />
        )}

      </div>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <button
      onClick={copy}
      title={copied ? "Copied!" : "Copy to clipboard"}
      style={{
        background: "transparent",
        border: "none",
        padding: "2px 4px",
        cursor: "pointer",
        color: copied ? "var(--safe)" : "var(--fg-muted)",
        display: "inline-flex",
        alignItems: "center",
        borderRadius: 4,
        transition: "color 120ms",
      }}
    >
      <Icon name={copied ? "check" : "copy"} size={13} />
    </button>
  );
}

/** One threat in the intent header: what it was, its code, which hop raised it, and the raw message. */
/** One incident, shown in full: the list it sits in is itself the collapsed view. */
function ThreatRow({ t }: { t: IntentThreat }) {
  const d = t.detail;
  const message = d?.message || "";
  const hop = [t.fromName || shortDid(t.from), t.toName || shortDid(t.to)].join(" → ");
  const pos = parseInteractionId(t.interactionID);
  return (
    <li className="it-threat">
      <div className="it-threat-top">
        <span className="it-threat-title">{d ? titleOrUnknown(d.title) : "Incident"}</span>
        {d && <span className="it-threat-code">code {d.threatCode}</span>}
        <span className="it-threat-hop" title={t.interactionID}>
          {pos && <b>#{pos.label}</b>} {pos?.branch ? `${branchName(pos.branch)} · ` : ""}{hop}
        </span>
        {t.time && <span className="it-threat-time">{timeAgo(Math.max(0, (Date.now() - new Date(t.time).getTime()) / 60000))}</span>}
      </div>
      {d?.description && <div className="it-threat-desc">{d.description}</div>}
      {message ? (
        <div className="it-threat-msg">{message}</div>
      ) : (
        !d && <div className="it-threat-desc">{t.error ?? "No details for this incident."}</div>
      )}
    </li>
  );
}
