/**
 * Self-contained mock dataset for the Observability page.
 *
 * This is a prototype built on static data — not wired to the real API yet.
 * It exists so the two drill-down flows (by user, by agent) can be designed
 * and reviewed before hooking up real hooks (useUsers/useUserInfo/useAgents/
 * useAgentInteractions/useIntentInteractions).
 */

export interface ObsUser {
  id: string;
  name: string;
}

export interface ObsAgent {
  id: string;
  name: string;
}

export type ObsIntentStatus = "active" | "completed" | "elevated" | "high-risk" | "blocked";

export interface ObsIntent {
  id: string;
  name: string;
  userId: string;
  status: ObsIntentStatus;
}

export interface ObsInteraction {
  id: string;
  intentId: string;
  fromAgentId: string;
  toAgentId: string;
  action: string;
  detail: string;
  status: "allowed" | "blocked";
  latencyMs: number;
}

export interface ObsApp {
  id: string;
  name: string;
  category: string;
}

/** An agent calling an app (a tool) while carrying out an intent. */
export interface ObsAppInteraction {
  id: string;
  appId: string;
  intentId: string;
  agentId: string;
  action: string;
  detail: string;
  status: "allowed" | "blocked";
  latencyMs: number;
  minutesAgo: number;
}

export interface ObsGraph {
  users: ObsUser[];
  agents: ObsAgent[];
  intents: ObsIntent[];
  interactions: ObsInteraction[];
  apps: ObsApp[];
  appById: Map<string, ObsApp>;
  appInteractions: ObsAppInteraction[];
  appInteractionById: Map<string, ObsAppInteraction>;
  /** Newest first. */
  appInteractionsByApp: Map<string, ObsAppInteraction[]>;
  userById: Map<string, ObsUser>;
  agentById: Map<string, ObsAgent>;
  intentById: Map<string, ObsIntent>;
  interactionById: Map<string, ObsInteraction>;
  intentsByUser: Map<string, ObsIntent[]>;
  interactionsByIntent: Map<string, ObsInteraction[]>;
  interactionsByAgent: Map<string, ObsInteraction[]>;
  /** Deduped undirected agent-agent pairs, keyed "a>b" (a < b), built only from direct interactions. */
  agentPairs: [string, string][];
}

/* ---- deterministic PRNG so the layout/data is stable across renders ---- */

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let a = seed;
  return function rand() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const USER_NAMES = [
  "Aditya Soni", "Maria Chen", "Devon Clarke", "Priya Nair", "Sam O'Connell",
  "Liu Wei", "Fatima Khan", "Noah Becker", "Grace Kim", "Omar Haddad",
];

const AGENT_NAMES = [
  "Orchestrator", "Notify Agent", "Forecast Agent", "Triage Agent", "Finance Agent",
  "Support Agent", "KB Agent", "Escalation Agent", "Ledger Agent", "Monitor Agent",
  "Sandbox Agent", "Research Agent", "Policy Agent", "Data Analysis Agent", "Compliance Agent",
  "Incident Agent", "Embedding Agent", "ETL Agent", "QA Agent", "Audit Agent", "Redaction Agent",
];

const INTENT_TEMPLATES: { name: string; action: string; detail: string }[] = [
  { name: "Close monthly ledger", action: "ledger.close", detail: "Post period-end journal entries" },
  { name: "Generate quarterly financial report", action: "finance.report", detail: "Compile P&L across all cost centers" },
  { name: "Audit vendor payments", action: "postgres.query", detail: "Cross-check invoices against PO records" },
  { name: "Export customer table", action: "postgres.query", detail: "Bulk read customers.pii — policy DLP-4" },
  { name: "Bulk download HR docs", action: "s3.read", detail: "Fetch employee records archive" },
  { name: "Resolve customer issue", action: "slack.notify", detail: "Post resolution summary to #support" },
  { name: "Escalate customer complaint", action: "pagerduty.trigger", detail: "Sev-2 escalation to on-call" },
  { name: "Summarize support thread", action: "openai.completion", detail: "Condense 40-message thread" },
  { name: "Draft churn-risk outreach", action: "mail.send", detail: "Personalized retention email" },
  { name: "Backfill embeddings", action: "vector.upsert", detail: "Re-embed knowledge base articles" },
  { name: "Label training data QA", action: "dataset.label", detail: "Spot-check 200 samples" },
  { name: "Research competitor pricing", action: "web.fetch", detail: "Scrape public pricing pages" },
  { name: "Correlate error spike", action: "logs.query", detail: "Join error rate with deploy timeline" },
  { name: "Create incident report", action: "incident.create", detail: "File postmortem draft" },
  { name: "Deploy patch 4.12.1", action: "ci.deploy", detail: "Roll out hotfix to prod" },
  { name: "Quarterly access review", action: "iam.audit", detail: "Review agent scopes against policy" },
  { name: "Rotate service credentials", action: "vault.rotate", detail: "Rotate service account keys" },
  { name: "Update DLP policy config", action: "policy.update", detail: "Tighten export scope on customers.pii" },
  { name: "Reconcile transactions", action: "postgres.query", detail: "Match ledger against bank feed" },
  { name: "Investigate production issue", action: "logs.query", detail: "Trace 500 spike to root cause" },
];

const APP_DEFS: { key: string; name: string; category: string; ops: [string, string][] }[] = [
  { key: "postgres", name: "Postgres", category: "Database", ops: [
    ["postgres.query", "Read rows from ledger.entries"],
    ["postgres.query", "Join invoices against purchase_orders"],
    ["postgres.write", "Insert reconciliation results"],
    ["postgres.query", "Bulk read customers.pii"],
  ] },
  { key: "s3", name: "AWS S3", category: "Storage", ops: [
    ["s3.read", "Fetch employee records archive"],
    ["s3.list", "List objects under hr-docs/"],
    ["s3.write", "Upload generated report PDF"],
  ] },
  { key: "slack", name: "Slack", category: "Messaging", ops: [
    ["slack.notify", "Post resolution summary to #support"],
    ["slack.read", "Read thread history"],
  ] },
  { key: "openai", name: "OpenAI", category: "LLM", ops: [
    ["openai.completion", "Summarize support thread"],
    ["openai.completion", "Draft outreach email"],
    ["openai.embed", "Embed knowledge base chunk"],
  ] },
  { key: "pagerduty", name: "PagerDuty", category: "Incidents", ops: [
    ["pagerduty.trigger", "Sev-2 escalation to on-call"],
    ["pagerduty.ack", "Acknowledge open incident"],
  ] },
  { key: "vector", name: "Vector DB", category: "Search", ops: [
    ["vector.upsert", "Re-embed knowledge base articles"],
    ["vector.query", "Top-k similarity lookup"],
  ] },
  { key: "web", name: "Web Fetch", category: "Network", ops: [
    ["web.fetch", "Scrape public pricing pages"],
    ["web.fetch", "Fetch vendor status page"],
  ] },
  { key: "logs", name: "Log Store", category: "Observability", ops: [
    ["logs.query", "Join error rate with deploy timeline"],
    ["logs.query", "Trace 500 spike to root cause"],
  ] },
  { key: "mail", name: "Mail", category: "Messaging", ops: [
    ["mail.send", "Send personalized retention email"],
  ] },
  { key: "vault", name: "Vault", category: "Secrets", ops: [
    ["vault.read", "Read service account key"],
    ["vault.rotate", "Rotate service credentials"],
  ] },
  { key: "iam", name: "IAM", category: "Identity", ops: [
    ["iam.audit", "Review agent scopes against policy"],
    ["iam.list_roles", "List roles attached to agent"],
  ] },
  { key: "ci", name: "CI/CD", category: "Deploys", ops: [
    ["ci.deploy", "Roll out hotfix to prod"],
    ["ci.status", "Check pipeline status"],
  ] },
];

/** Intent actions whose prefix isn't itself an app, mapped to the app that serves them. */
const ACTION_APP_ALIAS: Record<string, string> = {
  ledger: "postgres",
  finance: "postgres",
  incident: "pagerduty",
  dataset: "s3",
  policy: "iam",
};

const STATUS_WEIGHTS: [ObsIntentStatus, number][] = [
  ["active", 5],
  ["completed", 4],
  ["elevated", 2],
  ["high-risk", 1],
  ["blocked", 1],
];

function pickStatus(rand: () => number): ObsIntentStatus {
  const total = STATUS_WEIGHTS.reduce((s, [, w]) => s + w, 0);
  let r = rand() * total;
  for (const [status, w] of STATUS_WEIGHTS) {
    if (r < w) return status;
    r -= w;
  }
  return "active";
}

function pick<T>(arr: T[], rand: () => number): T {
  return arr[Math.floor(rand() * arr.length)];
}

let cached: ObsGraph | null = null;

export function buildObsGraph(): ObsGraph {
  if (cached) return cached;
  const rand = mulberry32(hashStr("agentdna-observability-mock-v1"));

  const users: ObsUser[] = USER_NAMES.map((name, i) => ({ id: `u-${i + 1}`, name }));
  const agents: ObsAgent[] = AGENT_NAMES.map((name, i) => ({ id: `a-${i + 1}`, name }));

  const intents: ObsIntent[] = INTENT_TEMPLATES.map((t, i) => {
    const user = pick(users, rand);
    return {
      id: `I-${1800 + i}`,
      name: t.name,
      userId: user.id,
      status: pickStatus(rand),
    };
  });

  const interactions: ObsInteraction[] = [];
  let ixSeq = 1;
  for (const intent of intents) {
    const template = INTENT_TEMPLATES.find((t) => t.name === intent.name)!;
    const hopCount = 1 + Math.floor(rand() * 3); // 1..3 hops per intent
    // Chain through a small random sequence of distinct agents, starting from
    // the Orchestrator most of the time so the graph has a recognizable hub.
    const chain: ObsAgent[] = [agents[0]];
    for (let h = 0; h < hopCount; h++) {
      let next = pick(agents, rand);
      let guard = 0;
      while (next.id === chain[chain.length - 1].id && guard++ < 5) next = pick(agents, rand);
      chain.push(next);
    }
    const blockedHop = intent.status === "blocked" ? Math.floor(rand() * hopCount) : -1;
    for (let h = 0; h < hopCount; h++) {
      const from = chain[h];
      const to = chain[h + 1];
      interactions.push({
        id: `ix-${ixSeq++}`,
        intentId: intent.id,
        fromAgentId: from.id,
        toAgentId: to.id,
        action: h === hopCount - 1 ? template.action : "delegate",
        detail: h === hopCount - 1 ? template.detail : `Delegate to ${to.name}`,
        status: h === blockedHop ? "blocked" : "allowed",
        latencyMs: 40 + Math.floor(rand() * 400),
      });
    }
  }

  const userById = new Map(users.map((u) => [u.id, u]));
  const agentById = new Map(agents.map((a) => [a.id, a]));
  const intentById = new Map(intents.map((i) => [i.id, i]));
  const interactionById = new Map(interactions.map((ix) => [ix.id, ix]));

  const intentsByUser = new Map<string, ObsIntent[]>();
  for (const intent of intents) {
    const list = intentsByUser.get(intent.userId) ?? [];
    list.push(intent);
    intentsByUser.set(intent.userId, list);
  }

  const interactionsByIntent = new Map<string, ObsInteraction[]>();
  const interactionsByAgent = new Map<string, ObsInteraction[]>();
  const pairSet = new Set<string>();
  for (const ix of interactions) {
    const listI = interactionsByIntent.get(ix.intentId) ?? [];
    listI.push(ix);
    interactionsByIntent.set(ix.intentId, listI);

    for (const agentId of [ix.fromAgentId, ix.toAgentId]) {
      const listA = interactionsByAgent.get(agentId) ?? [];
      listA.push(ix);
      interactionsByAgent.set(agentId, listA);
    }

    if (ix.fromAgentId !== ix.toAgentId) {
      const [a, b] = [ix.fromAgentId, ix.toAgentId].sort();
      pairSet.add(`${a}>${b}`);
    }
  }
  const agentPairs: [string, string][] = Array.from(pairSet).map((k) => {
    const [a, b] = k.split(">");
    return [a, b];
  });

  // ---- Apps: agents calling tools while carrying out each intent ----
  // Separate PRNG stream so adding apps doesn't reshuffle the user/agent data above.
  const appRand = mulberry32(hashStr("agentdna-observability-apps-v1"));
  const apps: ObsApp[] = APP_DEFS.map((d) => ({ id: `app-${d.key}`, name: d.name, category: d.category }));
  const appDefById = new Map(APP_DEFS.map((d) => [`app-${d.key}`, d]));
  const appInteractions: ObsAppInteraction[] = [];
  let axSeq = 1;
  for (const intent of intents) {
    const hops = interactionsByIntent.get(intent.id) ?? [];
    if (hops.length === 0) continue;
    const template = INTENT_TEMPLATES.find((t) => t.name === intent.name)!;
    const prefix = template.action.split(".")[0];
    const primaryId = `app-${ACTION_APP_ALIAS[prefix] ?? prefix}`;
    const agentIds = Array.from(new Set(hops.flatMap((h) => [h.fromAgentId, h.toAgentId])));

    const call = (agentId: string, appId: string) => {
      const def = appDefById.get(appId)!;
      const [action, detail] = pick(def.ops, appRand);
      const blocked = intent.status === "blocked" ? appRand() < 0.5 : appRand() < 0.06;
      appInteractions.push({
        id: `ax-${axSeq++}`,
        appId, intentId: intent.id, agentId, action, detail,
        status: blocked ? "blocked" : "allowed",
        latencyMs: 20 + Math.floor(appRand() * 380),
        minutesAgo: Math.floor(appRand() * 1440),
      });
    };

    // The agent that finishes the intent always touches its primary app; others dip into apps along the way.
    const finisher = hops[hops.length - 1].toAgentId;
    for (let k = 1 + Math.floor(appRand() * 3); k > 0; k--) call(finisher, primaryId);
    for (const agentId of agentIds) {
      const n = Math.floor(appRand() * 4.5);
      for (let k = 0; k < n; k++) {
        call(agentId, appRand() < 0.45 ? primaryId : pick(apps, appRand).id);
      }
    }
  }
  const appById = new Map(apps.map((a) => [a.id, a]));
  const appInteractionById = new Map(appInteractions.map((ax) => [ax.id, ax]));
  const appInteractionsByApp = new Map<string, ObsAppInteraction[]>(apps.map((a) => [a.id, []]));
  for (const ax of appInteractions) appInteractionsByApp.get(ax.appId)!.push(ax);
  for (const list of appInteractionsByApp.values()) list.sort((a, b) => a.minutesAgo - b.minutesAgo);

  cached = {
    users, agents, intents, interactions,
    apps, appById, appInteractions, appInteractionById, appInteractionsByApp,
    userById, agentById, intentById, interactionById,
    intentsByUser, interactionsByIntent, interactionsByAgent,
    agentPairs,
  };
  return cached;
}
