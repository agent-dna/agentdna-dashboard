import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  ArrowRight,
  Bot,
  CalendarDays,
  Check,
  Copy,
  ExternalLink,
  FileText,
  Layers,
  LayoutGrid,
  Link2,
  Shield,
  Star,
  TrendingUp,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { useResolveName } from "../../context/DirectoryContext";
import { useDrawer } from "../../context/DrawerContext";
import { useAgent, useAgentInteractions, useToolAgentScores, useToolInfo, useUserInfo } from "../../data/hooks";
import { AppIcon } from "../../components/AppIcon";
import { timeAgo } from "../../lib/format";
import type { Interaction } from "../../types";

/**
 * User, Agents and Application Info tabs of the observability detail box: a profile header,
 * stat tiles, then details, recent intents (user), the latest interactions or the app's
 * agents with their LHI scores. Clicking an interaction opens it in the interaction drawer.
 * Data: `/user-info` for the user; `/agent-info` and `/agent-interactions` for the agent;
 * `/tool-info` and `/tool-agent-scores` for the app (the same calls as the app page).
 */

const shortId = (id: string) => (id.length > 18 ? `${id.slice(0, 8)}…${id.slice(-6)}` : id);
const count = (n: number) => n.toLocaleString();
const ago = (mins: number) => (mins > 0 ? timeAgo(mins) : "—");

type Tone = "safe" | "threat" | "warn";
interface ActivityRow {
  key: string;
  mins: number;
  icon: LucideIcon;
  text: ReactNode;
  tone: Tone;
  label: string;
}
/** Interactions listed under "Recent interactions". */
const RECENT_INTERACTIONS = 5;

/* ---------------- User ---------------- */

export function UserInfoPanel({ did, name }: { did: string; name: string }) {
  const navigate = useNavigate();
  const { data, loading } = useUserInfo(did);
  const u = data?.user;
  const title = u?.displayName || name;
  /** `userName` is the user's email. */
  const email = u?.userName && u.userName !== title ? u.userName : undefined;
  const openPath = `/users/${encodeURIComponent(did)}`;

  // Recent activity: the intents the user ran, newest first.
  const activity: ActivityRow[] = (data?.intents ?? []).slice(0, 3).map((it) => ({
    key: it.id,
    mins: it.started,
    icon: FileText,
    text: <>Executed intent “{it.name}”</>,
    tone: it.threats > 0 ? "threat" : "safe",
    label: it.threats > 0 ? "Threat" : "Allowed",
  }));

  return (
    <div className="ip-pf">
      <Hero
        avatar={<span className="ip-pf-initial">{(title.trim()[0] || "?").toUpperCase()}</span>}
        title={title}
        chip={u && (u.isActive ? <StatusChip tone="safe">Active</StatusChip> : <StatusChip>Inactive</StatusChip>)}
        email={email}
        // sub="User details and activity overview"
        action={
          <button type="button" className="btn primary ip-pf-open" onClick={() => navigate(openPath)}>
            Open user <ExternalLink size={14} />
          </button>
        }
      />
      {!u ? (
        <div className="ip-empty">{loading ? "Loading user…" : "Couldn't load this user's details."}</div>
      ) : (
        <>
          <div className="ip-pf-stats ip-pf-stats-4">
            <Stat icon={Activity} value={count(u.totalIntents)} label="Intents" />
            <Stat icon={Link2} value={count(u.totalInteractions)} label="Interactions" />
            <Stat icon={Shield} value={count(u.totalThreats)} label="Threats" />
            <Stat icon={Layers} value={count(u.totalAgentsDeployed)} label="Agents deployed" />
          </div>

          <div className="ip-pf-section">Basic information</div>
          <div className="ip-pf-box">
            <div className="ip-pf-basic">
              <Field k="Status">{u.isActive ? <StatusChip tone="safe" plain>Active</StatusChip> : <StatusChip plain>Inactive</StatusChip>}</Field>
              <Field k="Last active">{ago(u.lastActiveMinsAgo)}</Field>
              <Field k="Joined">{ago(u.createdMinsAgo)}</Field>
              <Field k="User ID (DID)" wide>
                <Did did={did} />
              </Field>
            </div>
            {/* <div className="ip-pf-basic ip-pf-basic-2">
              <Field k="Email">{u.userName || "—"}</Field>
              <Field k="Display name">{u.displayName || "—"}</Field>
            </div> */}
          </div>

          <RecentActivity title="Recent activity" rows={activity} onViewAll={() => navigate(openPath)} />
          <RecentInteractions interactions={data?.interactions ?? []} total={data?.interactionsTotal} onViewAll={() => navigate(openPath)} />
        </>
      )}
    </div>
  );
}

/* ---------------- Agent ---------------- */

export function AgentInfoPanel({ did, name, nameOf }: { did: string; name: string; nameOf: (did: string) => string | undefined }) {
  const navigate = useNavigate();
  const { data: agent, loading } = useAgent(did);
  const { data: interactions } = useAgentInteractions(did);
  const openPath = `/agents/${encodeURIComponent(did)}`;
  const deployer = agent?.owner ? agent.ownerName || nameOf(agent.owner) || shortId(agent.owner) : "—";
  const [showPolicy, setShowPolicy] = useState(false);

  return (
    <div className="ip-pf">
      <Hero
        avatar={<Bot size={34} strokeWidth={1.8} />}
        title={agent?.name || name}
        chip={agent && (agent.revoked ? <StatusChip tone="threat">Revoked</StatusChip> : <StatusChip tone="safe">Approved</StatusChip>)}
        sub={agent ? [`Deployed by ${deployer}`, agent.env].filter(Boolean).join(" · ") : undefined}
        action={
          <button type="button" className="btn primary ip-pf-open" onClick={() => navigate(openPath)}>
            Open agent <ExternalLink size={14} />
          </button>
        }
      />
      {!agent ? (
        <div className="ip-empty">{loading ? "Loading agent…" : "Couldn't load this agent's details."}</div>
      ) : (
        <>
          <div className="ip-pf-stats">
            <Stat icon={Star} value={String(agent.score)} label="Score" />
            <Stat icon={TrendingUp} value={count(agent.interactions)} label="Interactions" />
            <Stat icon={Shield} value={count(agent.threats)} label="Threats" />
            <Stat icon={LayoutGrid} value={count(agent.connected)} label="Apps used" />
            <Stat icon={CalendarDays} value={ago(agent.created)} label="Created" />
          </div>

          <div className="ip-pf-section">Agent details</div>
          <div className="ip-pf-box ip-pf-split">
            <dl className="ip-pf-rows">
              <Row k="Agent name">{agent.name}</Row>
              <Row k="Status">
                {agent.revoked ? <StatusChip tone="threat">Revoked</StatusChip> : <StatusChip tone="safe">Approved</StatusChip>}
              </Row>
              <Row k="Deployer">
                <span title={agent.owner}>{deployer}</span>
              </Row>
              <Row k="Organization">{agent.env || "—"}</Row>
              <Row k="Policy">
                {agent.policy ? (
                  <>
                    Uploaded{" "}
                    <button type="button" className="ip-pf-link ip-pf-inline" onClick={() => setShowPolicy((v) => !v)}>
                      {showPolicy ? "Hide" : "View"}
                    </button>
                  </>
                ) : (
                  "None"
                )}
              </Row>
            </dl>
            <dl className="ip-pf-rows">
              <div className="ip-pf-did-block">
                <div className="k">Agent ID (DID)</div>
                <Did did={did} />
              </div>
              <Row k="Created">{ago(agent.created)}</Row>
              <Row k="Apps used">
                {agent.appsList?.length ? (
                  <span className="ip-pf-tags">
                    {agent.appsList.map((a) => (
                      <span key={a} className="ip-pf-tag">{a}</span>
                    ))}
                  </span>
                ) : (
                  "—"
                )}
              </Row>
            </dl>
          </div>

          {showPolicy && agent.policy && (
            <>
              <div className="ip-pf-section">Policy</div>
              <PolicyText text={agent.policy} />
            </>
          )}

          <RecentInteractions interactions={interactions} onViewAll={() => navigate(openPath)} />
        </>
      )}
    </div>
  );
}

/* ---------------- Application ---------------- */

const LHI_SCORES = [
  ["trustScore", "Trust"],
  ["intentScore", "Intent"],
  ["hallucinationScore", "Hallucination"],
  ["policyScore", "Policy"],
] as const;
const scoreTone = (n: number) => (n >= 80 ? "safe" : n >= 50 ? "warn" : "threat");

export function AppInfoPanel({ did, name }: { did: string; name: string }) {
  const navigate = useNavigate();
  const { data, loading } = useToolInfo(did);
  const t = data?.tool;
  const { data: agents, loading: agentsLoading } = useToolAgentScores(t?.id);
  const title = t?.name || name;
  const openPath = `/tools/${encodeURIComponent(did)}`;

  return (
    <div className="ip-pf">
      <Hero
        avatar={<AppIcon name={title} size={72} />}
        bare
        title={title}
        chip={t && t.totalThreats > 0 && <StatusChip tone="threat">{count(t.totalThreats)} threats</StatusChip>}
        sub="Application details and the agents that use it"
        action={
          <button type="button" className="btn primary ip-pf-open" onClick={() => navigate(openPath)}>
            Open app <ExternalLink size={14} />
          </button>
        }
      />
      {!t ? (
        <div className="ip-empty">{loading ? "Loading app…" : "Couldn't load this app's details."}</div>
      ) : (
        <>
          <div className="ip-pf-stats ip-pf-stats-3">
            <Stat icon={Bot} value={count(t.totalAgents)} label="Agents interacted" />
            <Stat icon={TrendingUp} value={count(t.totalInteractions)} label="Interactions" />
            <Stat icon={Activity} value={count(t.totalIntents)} label="Intents" />
          </div>

          <div className="ip-pf-section ip-pf-section-row">
            <span>
              Agents · latest LHI scores
              {agents.length > 0 && <span className="ip-pf-count">{count(agents.length)}</span>}
            </span>
            <button type="button" className="ip-pf-link" onClick={() => navigate(openPath)}>
              View all <ArrowRight size={14} />
            </button>
          </div>
          <div className="ip-pf-box ip-pf-activity">
            {agents.length === 0 ? (
              <div className="ip-pf-activity-empty">{agentsLoading ? "Loading agents…" : "No agents have used this app yet."}</div>
            ) : (
              agents.map((a) => (
                <button
                  key={a.agentDID}
                  type="button"
                  className="ip-pf-agent-row ip-pf-act-btn"
                  onClick={() => navigate(`/agents/${encodeURIComponent(a.agentDID)}`)}
                  title="Open agent"
                >
                  <span className="ip-pf-act-icon">
                    <Bot size={16} strokeWidth={1.8} />
                  </span>
                  <span className="ip-pf-act-text">
                    <b>{a.agentName || shortId(a.agentDID)}</b>
                  </span>
                  <span className="ip-pf-scores">
                    {LHI_SCORES.map(([key, label]) => (
                      <span key={key} className={`ip-pf-score ${scoreTone(a[key])}`}>
                        <span className="k">{label}</span>
                        <span className="v">{a[key]}</span>
                      </span>
                    ))}
                  </span>
                </button>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}

/* ---------------- Pieces ---------------- */

/**
 * The latest interactions as "from → to" rows, each with the intent it ran. Names the payload
 * left blank (it often does for apps) come from the org directory, which also says whether a
 * party is an agent, a user or an app.
 */
function RecentInteractions({
  interactions,
  total,
  onViewAll,
}: {
  interactions: Interaction[];
  total?: number;
  onViewAll: () => void;
}) {
  const resolve = useResolveName();
  const { openDrawer } = useDrawer();
  const party = (id: string, given: string) => {
    const hit = resolve(id);
    return { name: given && given !== shortId(id) && !given.includes("…") ? given : hit.name, kind: hit.kind };
  };
  const rows = interactions.slice(0, RECENT_INTERACTIONS);
  return (
    <>
      <div className="ip-pf-section ip-pf-section-row">
        <span>
          Recent interactions
          {total != null && total > 0 && <span className="ip-pf-count">{count(total)}</span>}
        </span>
        <button type="button" className="ip-pf-link" onClick={onViewAll}>
          View all <ArrowRight size={14} />
        </button>
      </div>
      <div className="ip-pf-box ip-pf-activity">
        {rows.length === 0 ? (
          <div className="ip-pf-activity-empty">No interactions yet.</div>
        ) : (
          rows.map((ix) => {
            const from = party(ix.initiator.id, ix.initiator.name);
            const to = party(ix.target.id, ix.target.name);
            const intentId = ix.intent?.id;
            return (
              <button key={ix.id} type="button" className="ip-pf-ix ip-pf-act-btn" onClick={() => openDrawer("interaction", ix)} title="Open interaction">
                <span className={`ip-pf-dot ${ix.threat ? "threat" : "safe"}`} />
                <span className="ip-pf-ix-main">
                  <span className="ip-pf-ix-flow">
                    <PartyName name={from.name} kind={from.kind} />
                    <ArrowRight size={13} className="ip-pf-ix-arrow" aria-label="to" />
                    <PartyName name={to.name} kind={to.kind} />
                  </span>
                  <span className="ip-pf-ix-meta">
                    <span className="ip-pf-ix-meta-k">Intent</span>
                    <span className="ip-pf-ix-intent" title={intentId || undefined}>{intentId ? shortId(intentId) : "—"}</span>
                  </span>
                </span>
                <span className="ip-pf-ix-side">
                  <span className={`chip ${ix.threat ? "threat" : "safe"} ip-pf-act-pill`}>{ix.threat ? "Threat" : "Allowed"}</span>
                  <span className="ip-pf-ix-time">{ago(ix.created)}</span>
                </span>
              </button>
            );
          })
        )}
      </div>
    </>
  );
}

function PartyName({ name, kind }: { name: string; kind?: string }) {
  const I = kind === "tool" ? LayoutGrid : kind === "user" ? UserRound : Bot;
  return (
    <span className="ip-pf-ix-party" title={name}>
      <I size={14} strokeWidth={1.8} />
      <b>{name}</b>
    </span>
  );
}

/** The agent's policy markdown, lightly formatted: headings, bullets and `code`. */
function PolicyText({ text }: { text: string }) {
  const inline = (line: string) =>
    line.split(/(`[^`]+`)/).map((part, k) => (part.startsWith("`") && part.endsWith("`") ? <code key={k}>{part.slice(1, -1)}</code> : part));
  return (
    <div className="ip-pf-box ip-pf-policy">
      {text.split("\n").map((raw, k) => {
        const line = raw.trim();
        if (!line) return null;
        const h = line.match(/^(#{1,6})\s+(.*)$/);
        if (h) return <div key={k} className={`ip-pf-policy-h h${Math.min(h[1].length, 3)}`}>{inline(h[2])}</div>;
        if (/^[-*]\s+/.test(line)) return <div key={k} className="ip-pf-policy-li">{inline(line.replace(/^[-*]\s+/, ""))}</div>;
        return <p key={k}>{inline(line)}</p>;
      })}
    </div>
  );
}

function Hero({
  avatar,
  bare,
  title,
  chip,
  email,
  sub,
  action,
}: {
  avatar: ReactNode;
  /** The avatar brings its own tile (an app logo). */
  bare?: boolean;
  title: string;
  chip?: ReactNode;
  email?: string;
  sub?: string;
  action: ReactNode;
}) {
  return (
    <div className="ip-pf-hero">
      {bare ? avatar : <div className="ip-pf-avatar">{avatar}</div>}
      <div className="ip-pf-hero-text">
        <div className="ip-pf-title-row">
          <span className="ip-pf-title">{title}</span>
          {chip}
        </div>
        {email && <div className="ip-pf-email">{email}</div>}
        {sub && <div className="ip-pf-sub">{sub}</div>}
      </div>
      {action}
    </div>
  );
}

function StatusChip({ tone, plain, children }: { tone?: Tone; plain?: boolean; children: ReactNode }) {
  return (
    <span className={`chip ${tone ?? ""} ip-pf-chip`}>
      {!plain && <span className="ip-pf-chip-dot" />}
      {children}
    </span>
  );
}

function Stat({ icon: I, value, label }: { icon: LucideIcon; value: string; label: string }) {
  return (
    <div className="ip-pf-stat">
      <span className="ip-pf-stat-icon">
        <I size={18} strokeWidth={1.8} />
      </span>
      <span>
        <span className="v">{value}</span>
        <span className="k">{label}</span>
      </span>
    </div>
  );
}

function Field({ k, hover, wide, children }: { k: string; hover?: string; wide?: boolean; children: ReactNode }) {
  return (
    <div className={`ip-pf-field${wide ? " wide" : ""}`}>
      <div className="k">{k}</div>
      <div className="v" title={hover}>{children}</div>
    </div>
  );
}

function Row({ k, children }: { k: string; children: ReactNode }) {
  return (
    <div className="ip-pf-row">
      <dt>{k}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function Did({ did }: { did: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(did).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    });
  };
  return (
    <div className="ip-pf-did">
      <span className="ip-mono">{did}</span>
      <button type="button" className="btn ghost ip-pf-copy" onClick={copy} title={copied ? "Copied" : "Copy DID"} aria-label="Copy DID">
        {copied ? <Check size={14} /> : <Copy size={14} />}
      </button>
    </div>
  );
}

function RecentActivity({ title, rows, onViewAll }: { title: string; rows: ActivityRow[]; onViewAll: () => void }) {
  return (
    <>
      <div className="ip-pf-section ip-pf-section-row">
        <span>{title}</span>
        <button type="button" className="ip-pf-link" onClick={onViewAll}>
          View all <ArrowRight size={14} />
        </button>
      </div>
      <div className="ip-pf-box ip-pf-activity">
        {rows.length === 0 ? (
          <div className="ip-pf-activity-empty">No recent activity.</div>
        ) : (
          rows.map(({ key, mins, icon: I, text, tone, label }) => (
            <div key={key} className="ip-pf-act">
              <span className={`ip-pf-dot ${tone}`} />
              <span className="ip-pf-act-time">{ago(mins)}</span>
              <span className="ip-pf-act-icon">
                <I size={15} strokeWidth={1.8} />
              </span>
              <span className="ip-pf-act-text">{text}</span>
              <span className={`chip ${tone === "threat" ? "threat" : tone === "warn" ? "warn" : "safe"} ip-pf-act-pill`}>{label}</span>
            </div>
          ))
        )}
      </div>
    </>
  );
}
