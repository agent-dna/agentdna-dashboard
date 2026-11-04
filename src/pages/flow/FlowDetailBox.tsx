import { forwardRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppWindow, Bot, ExternalLink, FileText, /* Globe, */ UserRound, type LucideIcon } from "lucide-react";
import { fetchIntentAuthEvidence } from "../../api/observability";
import { AgentInfoPanel, AppInfoPanel, UserInfoPanel } from "../observability/ProfilePanels";
import { IntentDetailPanel } from "../observability/IntentDetailPanel";
import { loadIntentDetail } from "../observability/intentDetail";
import { useObsQuery } from "../observability/useObsQuery";
import { DestinationsPanel } from "./DestinationsPanel";
import type { TraceHop, TraceModel, TraceNode } from "./traceModel";

/**
 * The box under the flow graph: the observability plane's detail box (User, Agents, Application
 * and Intent Info tabs, same panels), filled from this intent's participants instead of a plane
 * pick. The Agents and Application tabs open on the selected hop's agent and app; when the
 * intent has several, a switch above the panel picks another. Destinations lists the outside
 * services the intent reached and the credentials presented to each.
 */

export type FlowTab = "user" | "agent" | "app" | "intent" | "dest";
/** The tabs that show one participant at a time. */
type PartyTab = Exclude<FlowTab, "intent" | "dest">;
const isPartyTab = (t: FlowTab): t is PartyTab => t !== "intent" && t !== "dest";

const TABS: { key: FlowTab; label: string; icon: LucideIcon }[] = [
  { key: "user", label: "User Info", icon: UserRound },
  { key: "agent", label: "Agents Info", icon: Bot },
  { key: "app", label: "Application Info", icon: AppWindow },
  { key: "intent", label: "Intent Info", icon: FileText },
  // Destinations is hidden for now; uncomment this line (and Globe in the lucide import) to bring it back.
  // { key: "dest", label: "Destinations", icon: Globe },
];

const KIND_OF_TAB: Record<PartyTab, TraceNode["kind"]> = { user: "human", agent: "agent", app: "app" };
const NONE_HINT: Record<PartyTab, string> = {
  user: "No person took part in this intent",
  agent: "No agent took part in this intent",
  app: "No app took part in this intent",
};

interface Props {
  model: TraceModel;
  intentId: string;
  /** The selected hop: the Agents and Application tabs open on its agent and app. */
  hop: TraceHop | undefined;
  tab: FlowTab;
  onTab: (tab: FlowTab) => void;
  /** Selects a hop (the Destinations tab's hop links). */
  onSelectHop: (n: number) => void;
}

export const FlowDetailBox = forwardRef<HTMLElement, Props>(function FlowDetailBox(
  { model, intentId, hop, tab, onTab, onSelectHop },
  ref,
) {
  const navigate = useNavigate();
  const people = (kind: TraceNode["kind"]) => model.nodes.filter((n) => n.kind === kind && n.did);
  const byTab = { user: people("human"), agent: people("agent"), app: people("app") };

  // The selected hop's own participant of each kind, if it has one.
  const hopPick = (kind: TraceNode["kind"]) =>
    [hop?.src, hop?.dst].map((id) => (id ? model.nodeById.get(id) : undefined)).find((n) => n?.kind === kind && n.did);
  // A participant picked from the switch sticks until the selected hop changes.
  const [picked, setPicked] = useState<{ hop: number; tab: FlowTab; id: string } | null>(null);
  const shown = (t: PartyTab): TraceNode | undefined => {
    const list = byTab[t];
    const manual = picked && picked.hop === hop?.n && picked.tab === t ? list.find((n) => n.id === picked.id) : undefined;
    return manual ?? hopPick(KIND_OF_TAB[t]) ?? list[0];
  };

  // No title passed: the loader titles the intent with its opening message.
  const intentDetail = useObsQuery(intentId && `intent-detail:${intentId}`, () => loadIntentDetail(intentId, ""));
  // Fetched once Intent Info is open, for each step's "Credential info".
  const authEvidence = useObsQuery(tab === "intent" && intentId && `auth-evidence:${intentId}`, () => fetchIntentAuthEvidence(intentId));
  const nameOf = (did: string) => model.nodes.find((n) => n.did === did)?.name;

  const current = isPartyTab(tab) ? shown(tab) : undefined;
  const hasDestinations = model.nodes.some((n) => n.dest);
  const pagePath =
    tab === "intent"
      ? `/intents/${intentId}`
      : tab === "dest" || !current?.did
        ? null
        : tab === "user"
          ? `/users/${encodeURIComponent(current.did)}`
          : tab === "agent"
            ? `/agents/${encodeURIComponent(current.did)}`
            : // The app page looks apps up by name, as the observability box links to it.
              `/tools/${encodeURIComponent(current.name || current.did)}`;

  return (
    <section ref={ref} className="ip-card ip-detail tr-detail" aria-label="Intent details">
      <div className="tabs ip-detail-tabs" role="tablist">
        {TABS.map((t) => {
          const enabled = t.key === "intent" ? true : t.key === "dest" ? hasDestinations : byTab[t.key].length > 0;
          const I = t.icon;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={tab === t.key}
              className={`tab ${tab === t.key ? "active" : ""}`}
              disabled={!enabled}
              title={enabled ? undefined : t.key === "dest" ? "This intent didn’t call any outside service" : isPartyTab(t.key) ? NONE_HINT[t.key] : undefined}
              onClick={() => onTab(t.key)}
            >
              <I size={16} strokeWidth={1.8} />
              {t.label}
            </button>
          );
        })}
        <div className="ip-detail-actions">
          {pagePath && (
            <button type="button" className="btn ghost" onClick={() => navigate(pagePath)} title="Open full page" aria-label="Open full page">
              <ExternalLink size={16} />
            </button>
          )}
        </div>
      </div>

      {isPartyTab(tab) && byTab[tab].length > 1 && (
        <div className="seg ip-pf-peer-switch" role="group" aria-label={tab === "agent" ? "Agent shown" : tab === "app" ? "App shown" : "User shown"}>
          {byTab[tab].map((n) => (
            <button
              key={n.id}
              type="button"
              className={current?.id === n.id ? "active" : ""}
              onClick={() => hop && setPicked({ hop: hop.n, tab, id: n.id })}
            >
              {n.name}
            </button>
          ))}
        </div>
      )}

      {tab === "dest" ? (
        <DestinationsPanel model={model} hop={hop} onSelectHop={onSelectHop} />
      ) : tab === "intent" ? (
        <IntentDetailPanel
          intentId={intentId}
          intent={intentDetail.data ?? null}
          loading={intentDetail.loading}
          error={intentDetail.error}
          onRetry={intentDetail.retry}
          nameOf={nameOf}
          evidence={authEvidence.data ?? null}
          showFlowLink={false}
        />
      ) : current?.did ? (
        tab === "user" ? (
          <UserInfoPanel key={current.did} did={current.did} name={current.name} />
        ) : tab === "agent" ? (
          <AgentInfoPanel key={current.did} did={current.did} name={current.name} nameOf={nameOf} />
        ) : (
          <AppInfoPanel key={current.did} did={current.did} name={current.name} />
        )
      ) : (
        <div className="ip-empty">{NONE_HINT[tab]}.</div>
      )}
    </section>
  );
});
