/**
 * Mock data for the Observability interaction plane.
 *
 * The plane reads left to right: User → [COCA] → Agent → [COCA · CBAC · Whitelisting] → App → Intent.
 * Gate 1 (user→agent) verifies identity/integrity with COCA. Gate 2 (agent→app) runs three
 * walls in order: COCA re-verifies the agent, CBAC authorizes the call against policy, and
 * Whitelisting confirms the app/tool is on the agent's allow-list.
 */

export type PlaneColumn = "u" | "a" | "p" | "i";
export type PlaneStatus = "allowed" | "elevated" | "flagged";

export interface PlaneNode {
  id: string;
  t: PlaneColumn;
  name: string;
  /**
   * Vertical centre. Users: relative to the top of the scrollable user list.
   * Everything else: relative to the 760px-tall canvas.
   */
  y: number;
  sub?: string;
  /** Users only. */
  ini?: string;
  av?: number;
  /** Agents only: runtime handle, e.g. agent_finance. */
  handle?: string;
  /** Unsigned service identity (drawn in threat red). */
  svc?: boolean;
  /** Intents only. */
  st?: PlaneStatus;
  meta?: string;
}

export interface PlaneEdge {
  id: string;
  from: string;
  to: string;
  n: number;
  st: PlaneStatus;
  last: string;
  pol?: string;
  /** Allowed / flagged split for the tooltip. */
  a: number;
  b: number;
}

export interface PlaneFlow {
  n: string[];
  es: PlaneEdge[];
  st: PlaneStatus;
}

export const PLANE_W = 1452;
export const PLANE_H = 760;

export const COLUMNS: Record<PlaneColumn, [number, number]> = {
  u: [0, 168],
  a: [352, 532],
  p: [964, 1108],
  i: [1192, 1452],
};
export const ROW_H: Record<PlaneColumn, number> = { u: 48, a: 60, p: 48, i: 60 };
/** The user layer is a scrollable list below the column title. */
export const USER_LIST_TOP = 56;
export const USER_LIST_H = PLANE_H - USER_LIST_TOP;
const USER_PITCH = 60;

export const COLUMN_TYPE: Record<PlaneColumn, string> = { u: "User", a: "Agent", p: "App", i: "Intent" };

export const NODES: Record<string, PlaneNode> = {
  ...Object.fromEntries(
    (
      [
        ["u_svc", "svc-batch-07", "Service identity · unsigned", "SV"],
        ["u_aditya", "Aditya Soni", "Finance", "AS"],
        ["u_priya", "Priya Nair", "Site reliability", "PN"],
        ["u_omar", "Omar Haddad", "Customer success", "OH"],
        ["u_noah", "Noah Becker", "Data analytics", "NB"],
        ["u_lena", "Lena Park", "People ops", "LP"],
        ["u_maya", "Maya Chen", "Finance", "MC"],
        ["u_ravi", "Ravi Kumar", "Research", "RK"],
        ["u_sofia", "Sofia Alvarez", "Support", "SA"],
        ["u_ethan", "Ethan Brooks", "Legal", "EB"],
        ["u_hana", "Hana Kim", "Data analytics", "HK"],
        ["u_lucas", "Lucas Moreau", "Sales ops", "LM"],
        ["u_grace", "Grace Liu", "Finance", "GL"],
        ["u_arjun", "Arjun Mehta", "Platform engineering", "AM"],
      ] as const
    ).map(([id, name, sub, ini], i): [string, PlaneNode] => [
      id,
      {
        id, t: "u", name, sub, ini,
        y: 8 + ROW_H.u / 2 + i * USER_PITCH,
        ...(id === "u_svc" ? { svc: true } : { av: (i - 1) % 5 }),
      },
    ]),
  ),
  a_fin: { id: "a_fin", t: "a", name: "Finance Agent", handle: "agent_finance", y: 230 },
  a_res: { id: "a_res", t: "a", name: "Research Agent", handle: "agent_research", y: 370 },
  a_sup: { id: "a_sup", t: "a", name: "Support Agent", handle: "agent_support", y: 520 },
  a_cmp: { id: "a_cmp", t: "a", name: "Compliance Agent", handle: "agent_compliance", y: 660 },
  p_slack: { id: "p_slack", t: "p", name: "Slack", sub: "slack.notify", y: 180 },
  p_pg: { id: "p_pg", t: "p", name: "Postgres", sub: "postgres.query", y: 300 },
  p_oai: { id: "p_oai", t: "p", name: "OpenAI", sub: "openai.responses", y: 440 },
  p_pd: { id: "p_pd", t: "p", name: "PagerDuty", sub: "pagerduty.incident", y: 530 },
  p_sf: { id: "p_sf", t: "p", name: "Salesforce", sub: "salesforce.query", y: 610 },
  p_wd: { id: "p_wd", t: "p", name: "Workday", sub: "workday.documents", y: 690 },
  i_sum: { id: "i_sum", t: "i", name: "Post ledger summary", st: "allowed", meta: "41 ixns · 3m ago", y: 180 },
  i_ledger: { id: "i_ledger", t: "i", name: "Close monthly ledger", st: "allowed", meta: "72 ixns · 2m ago", y: 252 },
  i_rec: { id: "i_rec", t: "i", name: "Reconcile Q3 invoices", st: "allowed", meta: "112 ixns · 5m ago", y: 324 },
  i_export: { id: "i_export", t: "i", name: "Export customer table", st: "flagged", meta: "3407 LLM deny · 4 flags", y: 396 },
  i_fil: { id: "i_fil", t: "i", name: "Summarize market filings", st: "allowed", meta: "1.2K ixns · just now", y: 468 },
  i_inc: { id: "i_inc", t: "i", name: "Create incident report", st: "elevated", meta: "3408 LLM advise · review", y: 540 },
  i_churn: { id: "i_churn", t: "i", name: "Draft churn-risk outreach", st: "flagged", meta: "3303 contradiction deny · 2 flags", y: 612 },
  i_hr: { id: "i_hr", t: "i", name: "Bulk download HR docs", st: "elevated", meta: "3408 LLM advise · review", y: 684 },
};

type RawEdge = [string, string, number, PlaneStatus, string, string?, number?, number?];

const RAW_EDGES: RawEdge[] = [
  ["u_svc", "a_fin", 2, "flagged", "6m", "2002 · COCA verification failed (heavy)"],
  ["u_aditya", "a_fin", 24, "allowed", "2m"],
  ["u_aditya", "a_res", 12, "allowed", "8m"],
  ["u_aditya", "a_sup", 6, "allowed", "31m"],
  ["u_priya", "a_sup", 38, "allowed", "14m"],
  ["u_priya", "a_res", 9, "allowed", "1h"],
  ["u_omar", "a_sup", 17, "allowed", "9m"],
  ["u_noah", "a_cmp", 4, "allowed", "4m"],
  ["u_noah", "a_fin", 5, "allowed", "40m"],
  ["u_lena", "a_cmp", 21, "allowed", "22m"],
  ["u_lena", "a_res", 64, "allowed", "3m"],
  ["u_maya", "a_fin", 18, "allowed", "6m"],
  ["u_ravi", "a_res", 31, "allowed", "11m"],
  ["u_sofia", "a_sup", 22, "allowed", "17m"],
  ["u_ethan", "a_cmp", 7, "allowed", "35m"],
  ["u_hana", "a_res", 15, "allowed", "12m"],
  ["u_hana", "a_fin", 3, "allowed", "52m"],
  ["u_lucas", "a_sup", 5, "allowed", "19m"],
  ["u_grace", "a_fin", 9, "allowed", "25m"],
  ["u_arjun", "a_sup", 11, "allowed", "41m"],
  ["u_arjun", "a_res", 4, "allowed", "2h"],
  ["a_fin", "p_slack", 41, "allowed", "3m"],
  ["a_fin", "p_pg", 184, "allowed", "2m", "3202 · Tier 1 gap deny", 181, 3],
  ["a_res", "p_oai", 1240, "allowed", "just now"],
  ["a_sup", "p_pd", 62, "elevated", "14m", "3408 · LLM advise — human review"],
  ["a_sup", "p_sf", 2, "flagged", "9m", "3303 · Tier 2 contradiction deny"],
  ["a_cmp", "p_pg", 4, "flagged", "4m", "3407 · Tier 3 LLM deny"],
  ["a_cmp", "p_wd", 21, "elevated", "22m", "3408 · LLM advise — human review"],
  ["p_slack", "i_sum", 41, "allowed", "3m"],
  ["p_pg", "i_ledger", 72, "allowed", "2m"],
  ["p_pg", "i_rec", 112, "allowed", "5m"],
  ["p_pg", "i_export", 4, "flagged", "4m", "3407 · Tier 3 LLM deny"],
  ["p_oai", "i_fil", 1240, "allowed", "just now"],
  ["p_pd", "i_inc", 62, "elevated", "14m", "3408 · LLM advise — human review"],
  ["p_sf", "i_churn", 2, "flagged", "9m", "3303 · Tier 2 contradiction deny"],
  ["p_wd", "i_hr", 21, "elevated", "22m", "3408 · LLM advise — human review"],
];

export const EDGES: PlaneEdge[] = RAW_EDGES.map(([from, to, n, st, last, pol, a, b]) => ({
  id: `${from}>${to}`,
  from,
  to,
  n,
  st,
  last,
  pol,
  a: a ?? (st === "flagged" ? 0 : n),
  b: b ?? (st === "flagged" ? n : 0),
}));

const EDGE_BY_ID = new Map(EDGES.map((e) => [e.id, e]));

/** End-to-end paths. A path stopped at COCA has only user and agent. */
const RAW_FLOWS: string[][] = [
  ["u_svc", "a_fin"],
  ["u_aditya", "a_fin", "p_pg", "i_ledger"],
  ["u_aditya", "a_fin", "p_pg", "i_rec"],
  ["u_aditya", "a_fin", "p_slack", "i_sum"],
  ["u_aditya", "a_res", "p_oai", "i_fil"],
  ["u_aditya", "a_sup", "p_pd", "i_inc"],
  ["u_priya", "a_sup", "p_pd", "i_inc"],
  ["u_priya", "a_res", "p_oai", "i_fil"],
  ["u_omar", "a_sup", "p_sf", "i_churn"],
  ["u_noah", "a_cmp", "p_pg", "i_export"],
  ["u_noah", "a_fin", "p_pg", "i_rec"],
  ["u_lena", "a_cmp", "p_wd", "i_hr"],
  ["u_lena", "a_res", "p_oai", "i_fil"],
  ["u_maya", "a_fin", "p_pg", "i_ledger"],
  ["u_maya", "a_fin", "p_slack", "i_sum"],
  ["u_ravi", "a_res", "p_oai", "i_fil"],
  ["u_sofia", "a_sup", "p_pd", "i_inc"],
  ["u_ethan", "a_cmp", "p_wd", "i_hr"],
  ["u_hana", "a_res", "p_oai", "i_fil"],
  ["u_hana", "a_fin", "p_pg", "i_rec"],
  ["u_lucas", "a_sup", "p_sf", "i_churn"],
  ["u_grace", "a_fin", "p_pg", "i_rec"],
  ["u_arjun", "a_sup", "p_pd", "i_inc"],
  ["u_arjun", "a_res", "p_oai", "i_fil"],
];

export const FLOWS: PlaneFlow[] = RAW_FLOWS.map((n) => {
  const es = n.slice(1).map((x, i) => EDGE_BY_ID.get(`${n[i]}>${x}`)!);
  const st: PlaneStatus = es.some((e) => e.st === "flagged")
    ? "flagged"
    : es.some((e) => e.st === "elevated")
      ? "elevated"
      : "allowed";
  return { n, es, st };
});

// Agent subtitles carry how many distinct users reached them.
for (const node of Object.values(NODES)) {
  if (node.t !== "a") continue;
  const users = new Set(FLOWS.filter((f) => f.n[1] === node.id).map((f) => f.n[0]));
  node.sub = `${node.handle} · ${users.size} user${users.size === 1 ? "" : "s"}`;
}

export const CONTROLS = {
  /**
   * Phase 1 (existing data): COCA = no 2001–2003 threat on the hop; Whitelist = no 1001.
   * CBAC decisions aren't recorded yet, so it has no numbers (null → "Not tracked yet").
   */
  /** Gate 1 · user → agent */
  coca: { passPct: 99.1, flagged: 2 },
  /** Gate 2 · agent → app */
  agentCoca: { passPct: 100, flagged: 0 },
  cbac: null as { passPct: number; flagged: number } | null,
  whitelist: { passPct: 100, flagged: 0 },
};

/** Gate-2 walls, left to right, in the order they are evaluated. */
export const GATE2_WALLS = [
  { key: "coca", left: 568 },
  { key: "cbac", left: 692 },
  { key: "whitelist", left: 816 },
] as const;

export const PLANE_SUMMARY = "14 identities · 4 agents · 6 apps · 1,554 tool interactions · Last 24h";
