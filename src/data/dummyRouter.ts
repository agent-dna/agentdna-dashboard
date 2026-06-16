import dummy from "./dummy.json";

export function isDummyMode(): boolean {
  const v = (import.meta.env.VITE_DUMMY as string | undefined) || "";
  return v === "true" || v === "1";
}

type Query = Record<string, string | number | undefined | null> | undefined;

const PAGE_SIZE = 10;

function paginate<T>(items: T[], page: number) {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const p = Math.min(Math.max(1, page), totalPages);
  const start = (p - 1) * PAGE_SIZE;
  return {
    slice: items.slice(start, start + PAGE_SIZE),
    total,
    page: p,
    pageSize: PAGE_SIZE,
    totalPages,
  };
}

function getPage(q: Query): number {
  const raw = q?.page;
  const n = typeof raw === "number" ? raw : raw ? parseInt(String(raw), 10) : 1;
  return Number.isFinite(n) && n > 0 ? n : 1;
}

function getStr(q: Query, key: string): string {
  const v = q?.[key];
  return v == null ? "" : String(v);
}

const agents = dummy.agents as Array<{
  agentDID: string;
  agentName: string;
  createdAt: string;
  deployer: string;
  policy: string;
  totalInteractions: number;
  totalThreats: number;
  score: number;
}>;
const tools = dummy.tools as Array<{
  toolDID: string;
  toolName: string;
  totalInteractions: number;
  totalThreats: number;
  score: number;
}>;
const users = dummy.users as Array<{
  userID: string;
  userName: string;
  createdAt: string;
  totalIntents: number;
  totalThreats: number;
  accessAgentCount: number;
}>;

interface DummyInteraction {
  interactionID: string;
  from: string;
  to: string;
  fromName: string;
  toName: string;
  threat: boolean;
  intentID: string;
  time: string;
  blockType: string;
}

interface DummyIntent {
  intentID: string;
  initiatorDID: string;
  initiatorName: string;
  startedAt: string;
  endedAt?: string;
  status: string;
  threatDetected: boolean;
  flowType: string;
  executor: string;
  chainDepth: number;
  agentsCount: number;
  toolsCount: number;
  interactionsCount: number;
  interactions: DummyInteraction[];
}

const intents = dummy.intents as DummyIntent[];

function allInteractions(): DummyInteraction[] {
  return intents.flatMap((i) => i.interactions);
}

function homeMetrics() {
  const totalThreats = intents.reduce((a, i) => a + (i.threatDetected ? 1 : 0), 0);
  const interactionsTotal = allInteractions().length;
  const agentList = agents
    .map((a) => ({
      agentID: a.agentDID,
      agentName: a.agentName,
      totalInteractions: a.totalInteractions,
      totalThreats: a.totalThreats,
    }))
    .sort((a, b) => b.totalInteractions - a.totalInteractions)
    .slice(0, 5);
  return {
    agentCount: agents.length,
    intentCount: intents.length,
    interactionsCount: interactionsTotal,
    threatCount: totalThreats,
    page: 1,
    agentList,
  };
}

/**
 * Returns a fake response for the given backend path when dummy mode is on, or
 * `undefined` to let the real fetch proceed (for endpoints the demo doesn't
 * cover). The shape matches what apiRequest unwraps from `payload.data`.
 */
export function dummyRespond(path: string, query?: Query, method = "GET"): unknown | undefined {
  // Mutations — accept and acknowledge so the UI's success paths work.
  if (method !== "GET") {
    if (path === "/login") {
      // We don't have access to the body here; assume any credentials work.
      const u = dummy.currentUser;
      return {
        token: "dummy.jwt.token",
        did: u.did,
        email: u.email,
        org_id: u.org_id,
        api_key: u.api_key,
        nft_id: u.nft_id,
        is_admin: u.is_admin,
        agent_access_list: [],
      };
    }
    if (path === "/agents-creation-requests-create") return { requestID: "req_dummy" };
    if (path === "/agents-creation-requests-edit") return { requestID: "req_dummy" };
    if (path === "/agent-creation-request-result-submit")
      return { requestID: "req_dummy", status: "approved" };
    if (path === "/agent-access-request-create") return { requestID: "req_dummy" };
    if (path === "/agent-access-request-submit") return { requestID: "req_dummy", status: "approved" };
    if (path === "/admin-add-user") return { userID: "user_dummy" };
    if (path === "/create-user") {
      return {
        did: "user_dummy",
        name: "user_dummy",
        email: "dummy@example.com",
        orgID: dummy.currentUser.org_id,
      };
    }
    if (path === "/admin-grant-agent-access") return {};
    if (path === "/admin-revoke-agent-access") return {};
    return {};
  }

  if (path === "/home-metrics") return homeMetrics();

  if (path === "/interactions-list") {
    const all = allInteractions().sort((a, b) => (a.time < b.time ? 1 : -1));
    const p = paginate(all, getPage(query));
    return { interactionList: p.slice, total: p.total, page: p.page, pageSize: p.pageSize, totalPages: p.totalPages };
  }

  if (path === "/agents-list") {
    const p = paginate(agents, getPage(query));
    return { agentsList: p.slice, total: p.total, page: p.page, pageSize: p.pageSize, totalPages: p.totalPages };
  }

  if (path === "/tools-list") {
    const p = paginate(tools, getPage(query));
    return { toolsList: p.slice, total: p.total, page: p.page, pageSize: p.pageSize, totalPages: p.totalPages };
  }

  if (path === "/users-list") {
    const p = paginate(users, getPage(query));
    return { usersList: p.slice, total: p.total, page: p.page, pageSize: p.pageSize, totalPages: p.totalPages };
  }

  if (path === "/intent-list") {
    const sorted = [...intents].sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1));
    const p = paginate(sorted, getPage(query));
    // /intent-list omits the nested interactions array — they come from /intent-info.
    const stripped = p.slice.map(({ interactions: _ignore, ...rest }) => rest);
    return { intentsList: stripped, total: p.total, page: p.page, pageSize: p.pageSize, totalPages: p.totalPages };
  }

  if (path === "/intent-info") {
    const id = getStr(query, "intentID");
    const intent = intents.find((i) => i.intentID === id);
    if (!intent) return null;
    return intent;
  }

  if (path === "/agent-info") {
    const id = getStr(query, "agentDID");
    const a = agents.find((x) => x.agentDID === id);
    if (!a) return null;
    return {
      agentDID: a.agentDID,
      agentName: a.agentName,
      createdAt: a.createdAt,
      deployerDID: a.deployer,
      policy: a.policy,
      orgID: dummy.currentUser.org_id,
      totalInteractions: a.totalInteractions,
      totalThreats: a.totalThreats,
      score: a.score,
    };
  }

  if (path === "/agent-interactions") {
    const id = getStr(query, "agentDID");
    const list = allInteractions().filter((i) => i.from === id || i.to === id);
    list.sort((a, b) => (a.time < b.time ? 1 : -1));
    const p = paginate(list, getPage(query));
    return {
      interactionsList: p.slice,
      total: p.total,
      page: p.page,
      pageSize: p.pageSize,
      totalPages: p.totalPages,
    };
  }

  if (path === "/agent-intents") {
    const id = getStr(query, "agentDID");
    const list = intents.filter((i) =>
      i.initiatorDID === id || i.interactions.some((x) => x.from === id || x.to === id),
    );
    list.sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1));
    const p = paginate(list, getPage(query));
    const stripped = p.slice.map(({ interactions: _ignore, ...rest }) => rest);
    return {
      intentsList: stripped,
      total: p.total,
      page: p.page,
      pageSize: p.pageSize,
      totalPages: p.totalPages,
    };
  }

  if (path === "/agents-creation-requests-list") {
    const list = dummy.agentCreationRequests as unknown[];
    const p = paginate(list, getPage(query));
    return {
      requestsList: p.slice,
      total: p.total,
      page: p.page,
      pageSize: p.pageSize,
      totalPages: p.totalPages,
    };
  }

  if (path === "/agents-creation-requests-list-user") {
    const me = dummy.currentUser.did;
    const list = (dummy.agentCreationRequests as Array<{ creatorDID: string }>).filter(
      (r) => r.creatorDID === me,
    );
    const p = paginate(list, getPage(query));
    return {
      requestsList: p.slice,
      total: p.total,
      page: p.page,
      pageSize: p.pageSize,
      totalPages: p.totalPages,
    };
  }

  if (path === "/agent-access-requests-list-org" || path === "/agent-access-requests-list-user") {
    return { requestsList: [], total: 0, page: 1, pageSize: PAGE_SIZE, totalPages: 1 };
  }

  if (path === "/agent-policy-history") {
    const id = getStr(query, "agentDID");
    const history = (dummy.agentPolicyHistory as Record<string, Array<{ updateID: string; time: number }>>)[id] || [];
    return { agentDID: id, history };
  }

  if (path === "/agent-policy-update") {
    const updateID = getStr(query, "updateID");
    const agentDID = getStr(query, "agentDID");
    const text = (dummy.agentPolicyUpdates as Record<string, string>)[updateID] || "";
    // Find the history entry to recover the timestamp.
    const history = (dummy.agentPolicyHistory as Record<string, Array<{ updateID: string; time: number }>>)[agentDID] || [];
    const entry = history.find((h) => h.updateID === updateID);
    return { updateID, time: entry?.time || 0, policy: text };
  }

  if (path === "/user-policy") {
    return { policy: "" };
  }

  if (path === "/user-access-list") {
    return { agentAccessList: agents.map((a) => a.agentDID) };
  }

  return undefined;
}

export function dummyCurrentUser() {
  return dummy.currentUser;
}
