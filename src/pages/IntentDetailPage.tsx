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
import { useIntent, useIntentInteractionsPaged, useIntentParticipants, useIntentThreats } from "../data/hooks";
import { useDrawer } from "../context/DrawerContext";
import { useIntentReview } from "../context/IntentReviewContext";
import { timeAgo, titleOrUnknown } from "../lib/format";
import { exportIntentPdf } from "../lib/exportIntentPdf";
import { updateIntentStatus, type IntentThreat } from "../data/api";
import { IntentIdChip } from "../context/IntentNumbersContext";
import { branchName, compareInteractionIds, parseInteractionId } from "../lib/interactionBranch";
import type { IntentParticipant, Tool, IntentReviewStatus } from "../types";

type Tab = "evidence" | "participants";

export function IntentDetailPage() {
  const { intentId = "" } = useParams<{ intentId: string }>();
  const navigate = useNavigate();
  const { openDrawer } = useDrawer();
  const resolve = useResolveName();

  /**
   * Owner label: a real display name when the backend or the directory has one, otherwise the
   * initiator's full DID (not the "did:abc…1234" short form, and never a bare "—").
   */
  function ownerLabel(initiator: { id: string; name: string }): { text: string; isDid: boolean } {
    const resolved = resolve(initiator.id, initiator.name).name;
    const unresolved = !resolved || resolved === "—" || resolved === shortDid(initiator.id);
    if (unresolved && initiator.id) return { text: initiator.id, isDid: true };
    return { text: resolved || "—", isDid: false };
  }
  const { refetch: refetchIntentReview } = useIntentReview();
  const [tab, setTab] = useState<Tab>("evidence");
  /** The incident list starts collapsed to its one-line summary. */
  const [incidentsOpen, setIncidentsOpen] = useState(false);
  const intentState = useIntent(intentId);
  const { data: intent, loading } = intentState;
  // The intent's interactions: the Interactions tile, the incident count's fallback and Export use them.
  const { data: interactionsPaged } = useIntentInteractionsPaged(intentId, 1);
  const interactions = interactionsPaged.interactions;
  const { data: participants } = useIntentParticipants(intentId);
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
                gridTemplateColumns: "repeat(5, 1fr)",
                gap: 24,
              }}
            >
              <div>
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
                label="Incident detected"
                value={
                  <span style={{ color: threatCount > 0 ? "var(--threat)" : "var(--fg)", fontWeight: 600 }}>
                    {threatCount}
                  </span>
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
      </div>

      {/* Activity metrics */}
      <div className="metrics">
        <MetricTile label="Interactions" value={interactions.length} icon="activity" sparkColor="#2563EB" spark={[]} />
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
            { key: "participants", label: "Agents & Apps", count: participantRows.length },
          ]}
        />

        {tab === "evidence" && <IntentEvidenceTrail intentId={intent.id} />}

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
