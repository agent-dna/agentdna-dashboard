import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Icon } from "../components/Icon";
import { MetricTile } from "../components/MetricTile";
import { Tabs } from "../components/Tabs";
import { DataTable, type DataTableColumn } from "../components/DataTable";
import { EntityCell } from "../components/EntityCell";
import { EntityLink } from "../components/EntityLink";
import { entityPath } from "../lib/entityLinks";
import { useResolveName, resolveDisplayName } from "../context/DirectoryContext";
import { ScoreBar } from "../components/ScoreBar";
import { InfoStat } from "../components/InfoStat";
import { useIntent, useIntentInteractionsPaged, useIntentParticipants, useThreatByID } from "../data/hooks";
import { Pagination } from "../components/Pagination";
import { useDrawer } from "../context/DrawerContext";
import { useIntentReview } from "../context/IntentReviewContext";
import { timeAgo } from "../lib/format";
import { LedgerTable } from "../components/LedgerTable";
import { exportIntentPdf } from "../lib/exportIntentPdf";
import { updateIntentStatus } from "../data/api";
import { ApiError } from "../api/client";
import { IntentIdChip } from "../context/IntentNumbersContext";
import type { IntentParticipant, Tool, IntentReviewStatus } from "../types";

const REVIEW_STATUSES: IntentReviewStatus[] = ["Ongoing", "Acknowledged", "Flagged"];

const REVIEW_STATUS_STYLE: Record<IntentReviewStatus, { color: string; bg: string }> = {
  Ongoing: { color: "var(--accent)", bg: "rgba(37,99,235,0.10)" },
  Acknowledged: { color: "var(--safe)", bg: "rgba(5,150,105,0.10)" },
  Flagged: { color: "var(--threat)", bg: "rgba(220,38,38,0.10)" },
};

type Tab = "interactions" | "participants";

export function IntentDetailPage() {
  const { intentId = "" } = useParams<{ intentId: string }>();
  const navigate = useNavigate();
  const { openDrawer } = useDrawer();
  const resolve = useResolveName();
  const { refetch: refetchIntentReview } = useIntentReview();
  const [tab, setTab] = useState<Tab>("interactions");
  const [interactionsPage, setInteractionsPage] = useState(1);
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const [statusSaving, setStatusSaving] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const statusBtnRef = useRef<HTMLButtonElement>(null);
  const statusMenuRef = useRef<HTMLDivElement>(null);
  const [statusMenuPos, setStatusMenuPos] = useState({ top: 0, right: 0 });

  // Fixed positioning (computed from the button's own rect) so the menu
  // isn't clipped by the hero card's `overflow: hidden` the way an
  // absolutely-positioned child would be.
  useEffect(() => {
    if (!statusMenuOpen) return;
    const update = () => {
      const rect = statusBtnRef.current?.getBoundingClientRect();
      if (rect) setStatusMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    };
    update();
    const onOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!statusBtnRef.current?.contains(target) && !statusMenuRef.current?.contains(target)) {
        setStatusMenuOpen(false);
      }
    };
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    document.addEventListener("mousedown", onOutside);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
      document.removeEventListener("mousedown", onOutside);
    };
  }, [statusMenuOpen]);

  const intentState = useIntent(intentId);
  const { data: intent, loading } = intentState;
  const { data: interactionsPaged, loading: interactionsLoading } = useIntentInteractionsPaged(intentId, interactionsPage);
  const interactions = interactionsPaged.interactions;
  const interactionsTotal = interactionsPaged.total;
  const interactionsTotalPages = interactionsPaged.totalPages;
  const { data: participants } = useIntentParticipants(intentId);
  const firstThreatID = interactions.find((i) => i.threat && i.threatID)?.threatID;
  const { data: threatSummary, loading: threatSummaryLoading } = useThreatByID(firstThreatID);
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
    if (next === intent.reviewStatus) { setStatusMenuOpen(false); return; }
    setStatusSaving(true);
    setStatusError(null);
    try {
      await updateIntentStatus(intent.id, next);
      intentState.refetch();
      refetchIntentReview();
      setStatusMenuOpen(false);
    } catch (e) {
      setStatusError(e instanceof ApiError ? e.message : "Failed to update status");
    } finally {
      setStatusSaving(false);
    }
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

  const threatCount = interactions.filter((i: { threat: boolean }) => i.threat).length;

  // Interaction IDs end in "-<n>", the sequence number within the intent's
  // block chain — list them in that order (1, 2, 3, …) rather than however
  // the backend happened to return the page.
  const interactionSeq = (id: string): number => {
    const m = id.match(/-(\d+)$/);
    return m ? parseInt(m[1], 10) : Number.MAX_SAFE_INTEGER;
  };
  const sortedInteractions = [...interactions].sort((a, b) => interactionSeq(a.id) - interactionSeq(b.id));

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
      label: "Threats",
      align: "right",
      render: (r) =>
        r.threats > 0 ? (
          <span className="chip threat">{r.threats}</span>
        ) : (
          <span style={{ color: "var(--fg-faint)", fontFamily: "var(--font-mono)", fontSize: 12.5 }}>0</span>
        ),
    },
    {
      key: "score",
      label: "Reliability",
      align: "right",
      render: (r) => {
        if (r.count <= 0) {
          return <span style={{ color: "var(--fg-faint)", fontFamily: "var(--font-mono)", fontSize: 12.5 }}>—</span>;
        }
        const pct = Math.max(0, Math.round((((r.count - r.threats) / r.count) * 100) * 100) / 100);
        return <ScoreBar value={pct} />;
      },
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
                <div
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: 20,
                    fontWeight: 600,
                    color: "var(--fg)",
                    letterSpacing: "-0.01em",
                    wordBreak: "break-word",
                  }}
                >
                  {resolveDisplayName(resolve, intent.initiator)}
                </div>
                {intent.provenanceRecordID ? (
                  <a
                    href={`https://testnetexplorer.rubix.net/transaction-explorer?tx=${intent.provenanceRecordID}`}
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
                ) : (
                  <span style={{
                    display: "inline-flex", alignItems: "center", gap: 5, marginTop: 6,
                    fontFamily: "var(--font-mono)", fontSize: 11.5,
                    color: "var(--fg-faint)", fontWeight: 600,
                  }}>
                    Saved on Provenance Layer
                  </span>
                )}
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
                value={
                  <span
                    style={{
                      display: "inline-block",
                      fontSize: 12.5,
                      fontWeight: 700,
                      padding: "3px 10px",
                      borderRadius: 999,
                      color: REVIEW_STATUS_STYLE[intent.reviewStatus].color,
                      background: REVIEW_STATUS_STYLE[intent.reviewStatus].bg,
                    }}
                  >
                    {intent.reviewStatus}
                  </span>
                }
              />
              <InfoStat
                label="Threat detected"
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
            <button ref={statusBtnRef} className="btn" onClick={() => setStatusMenuOpen((o) => !o)} disabled={statusSaving}>
              <Icon name="settings" size={14} />
              {statusSaving ? "Saving…" : "Change status"}
            </button>
            {statusMenuOpen && (
              <div
                ref={statusMenuRef}
                style={{
                  position: "fixed",
                  top: statusMenuPos.top,
                  right: statusMenuPos.right,
                  background: "var(--bg-1)",
                  border: "1px solid var(--line-strong)",
                  borderRadius: 10,
                  boxShadow: "0 12px 32px rgba(10,34,64,0.16)",
                  padding: 6,
                  minWidth: 160,
                  zIndex: 300,
                  display: "flex",
                  flexDirection: "column",
                  gap: 2,
                }}
              >
                {REVIEW_STATUSES.map((s) => (
                  <button
                    key={s}
                    onClick={() => changeStatus(s)}
                    disabled={statusSaving}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 8,
                      background: s === intent.reviewStatus ? "var(--bg-2)" : "transparent",
                      border: "none",
                      borderRadius: 7,
                      padding: "7px 10px",
                      fontSize: 13,
                      fontWeight: 500,
                      color: "var(--fg)",
                      cursor: statusSaving ? "default" : "pointer",
                      textAlign: "left",
                    }}
                  >
                    {s}
                    {s === intent.reviewStatus && <Icon name="check" size={13} style={{ color: "var(--accent)" }} />}
                  </button>
                ))}
              </div>
            )}
            {statusError && (
              <div style={{ fontSize: 11.5, color: "var(--threat)", maxWidth: 160 }}>{statusError}</div>
            )}
          </div>
        </div>

        {threatCount > 0 && (
          <div
            style={{
              marginTop: 18,
              paddingTop: 16,
              borderTop: "1px solid var(--line)",
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
            }}
          >
            <Icon name="shield" size={15} style={{ color: "var(--threat)", flexShrink: 0, marginTop: 1 }} />
            <div style={{ minWidth: 0 }}>
              {threatSummaryLoading ? (
                <span style={{ fontSize: 12.5, color: "var(--fg-muted)" }}>Loading threat details…</span>
              ) : threatSummary ? (
                <>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--threat)" }}>{threatSummary.title}</span>
                  <span style={{ fontSize: 11.5, fontFamily: "var(--font-mono)", color: "var(--fg-muted)", marginLeft: 8 }}>
                    code {threatSummary.threatCode}
                  </span>
                  {threatSummary.message && (
                    <div style={{ fontSize: 12.5, color: "var(--fg-muted)", marginTop: 3 }}>{threatSummary.message}</div>
                  )}
                  {threatCount > 1 && (
                    <div style={{ fontSize: 11.5, color: "var(--fg-faint)", marginTop: 3 }}>
                      +{threatCount - 1} more threat{threatCount - 1 === 1 ? "" : "s"} in this intent
                    </div>
                  )}
                </>
              ) : (
                <span style={{ fontSize: 12.5, color: "var(--fg-muted)" }}>
                  {threatCount} threat{threatCount === 1 ? "" : "s"} detected in this intent
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Activity metrics */}
      <div className="metrics">
        <MetricTile label="Interactions" value={interactions.length} icon="activity" sparkColor="#2563EB" spark={[]} />
        <MetricTile label="Agents touched" value={intent.agentsInteracted} icon="agents" sparkColor="#0EA5E9" spark={[]} />
        <MetricTile label="Apps touched" value={intent.toolsInteracted} icon="box" sparkColor="#0A2240" spark={[]} />
        <MetricTile label="Threats" value={threatCount} icon="shield" sparkColor="#DC2626" spark={[]} />
      </div>

      {/* Tabbed table */}
      <div className="card">
        <Tabs
          active={tab}
          onChange={(k) => setTab(k as Tab)}
          tabs={[
            { key: "interactions", label: "Interactions", count: interactionsTotal },
            { key: "participants", label: "Agents & Apps", count: participantRows.length },
          ]}
        />

        {tab === "interactions" && (
          <>
            <LedgerTable
              rows={sortedInteractions}
              emptyText={interactionsLoading ? "Loading…" : "No interactions recorded for this intent yet."}
              onView={(r) => openDrawer("interaction", r)}
              // Every row here belongs to this intent — the column repeats the page.
              showIntent={false}
            />
            <Pagination page={interactionsPage} totalPages={interactionsTotalPages} total={interactionsTotal} pageSize={10} loading={interactionsLoading} onChange={setInteractionsPage} />
          </>
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
