# Observability · Interaction plane — backend API spec

Status: **implemented (Phase 1) — middleware `handler/observability.go`** · Frontend: `src/pages/observability/InteractionPlane.tsx`, fetchers in `src/api/observability.ts`, graph model in `planeModel.ts`

This document describes the six read-only endpoints the Observability "Interaction plane" needs to run on real data, how each one should derive its numbers from the data the backend already stores, and the order the frontend calls them in.

---

## 0. Paste-ready prompt for the backend implementer

> Build six read-only, org-scoped GET endpoints for the dashboard's Observability page. They follow the same conventions as the existing dashboard API (`/users-list`, `/intent-list`, `/interactions-list`, `/threats-list`): JWT bearer auth, `{ status, data, message }` response envelope, camelCase fields, DIDs as ids, ISO-8601 UTC timestamps, paged lists shaped `{ <name>List, total, page, pageSize, totalPages }`. Admins see the whole org; non-admins see only data where they are the intent initiator (same rule as `/threats-list`).
>
> The page draws a 4-layer graph: **User → Agent → App → Intent**, with security gates between layers. Gate 1 (user→agent) is **COCA** (identity/signature verification). Gate 2 (agent→app) is three walls evaluated in order: **COCA** (agent identity), **CBAC** (policy authorization: allowed / denied / needs review), **Whitelisting** (is the calling agent approved in admin-service, i.e. not revoked — agent-level, not per app). In Phase 1 a threat code only *flags* a hop (the interaction already happened), so the outcome is `allowed | elevated | flagged`, never "blocked".
>
> Classify every stored interaction hop server-side as `user→agent`, `agent→app`, or `agent→agent`/other using the users, agents and tools registries (never by DID prefix — agent and app DIDs share the `bafy…` format). Attribute every hop to a user through its intent's `initiatorDID`. Gate results come from the new `interaction_gate_decisions` table (Phase 2, §8). Until it exists, ship Phase 1: COCA from the absence/presence of threat codes 2001–2003, outcome from `new_interactions.threat` + threat code, CBAC as "not tracked", Whitelisting from the current `new_agents.revoked` flag only.
>
> Endpoints: `GET /observability-summary`, `GET /observability-graph`, `GET /observability-users` (paged, for an infinitely scrolling list), `GET /observability-user-flow?userDID=`, `GET /observability-intents?userDID=&agentDID=[&appDID=]`, `GET /observability-paths` (trace table). All accept `range=24h|7d|30d` (default `24h`) and `status=all|risk|flagged` (default `all`). Exact request/response contracts, derivation rules and examples are in `docs/observability-api.md` in the dashboard repo — implement to that contract and flag anything you can't satisfy. §6 has the review findings and §8 the phased delivery plan.

---

## 1. What the screen shows, and when it needs data

```
 USER ──[COCA]──► AGENT ──[COCA | CBAC | WHITELIST]──► APP ────► INTENT
 (scrolls)                                                     (hidden until a user
                                                                 AND an agent are picked)
```

| Step | What the user does | What lights up | Data needed | Endpoint |
|---|---|---|---|---|
| Load | Opens page | All nodes and edges at rest; gate stats; header summary | Totals + gate rates; every agent, app, agent→app edge; first page of users with their user→agent edges | `/observability-summary`, `/observability-graph`, `/observability-users?page=1` |
| Scroll | Scrolls the user layer | More users appear | Next page of users (+ their edges) | `/observability-users?page=N` |
| 1 | Clicks a **user** | That user + the agents they used | Which agents this user reached, and — scoped to this user — which apps each agent called | `/observability-user-flow?userDID=` |
| 2 | Clicks one of those **agents** | Apps that agent called *in this user's loop*, and the **intents** column appears | Intents this user ran through this agent | `/observability-intents?userDID=&agentDID=` |
| 3 | Clicks an **app** | Intents narrow to those that touched that app | Same intents, filtered | client-side (intents carry their apps) — or re-call with `&appDID=` |
| 4 | Clicks an **intent** | The full path | Already loaded | — |
| Table | Any of the above | Trace table rows | Path rows at the current selection | `/observability-paths` |
| Filter | "High risk" / "Flagged only" | Only risky paths | Same calls with `status=` | all of the above |
| Esc | Clears selection | Back to rest | — | — |

Why split it this way instead of one big graph call:

- **The user layer is unbounded** (orgs can have thousands of identities), so it must page. Agents and apps are small and stable, so they come in one call.
- **User-scoped agent→app edges can't be derived from global edges.** Global "Finance Agent → Postgres: 184 calls" doesn't say how many of those were Noah's. Step 1 needs a per-user rollup, so it is its own call — and it's small (one user's slice).
- **Intents are the largest set** and only matter once the user has narrowed to one user + one agent, which is exactly when the UI reveals them. Fetching them any earlier would be wasted.

---

## 2. Common conventions

- **Auth:** `Authorization: Bearer <jwt>` (same as all dashboard endpoints). 401 → frontend logs out.
- **Envelope:** `{ "status": true, "data": { … }, "message": "" }`. On failure `status: false` with `message`.
- **Scoping:** admin → whole org (from the JWT's org). Non-admin → only hops whose intent `initiatorDID` is the caller. Non-admins still see agents/apps, but counts only reflect their own traffic.
- **Common query params** (every endpoint):

| Param | Type | Default | Meaning |
|---|---|---|---|
| `range` | `24h` \| `7d` \| `30d` | `24h` | Only hops with `time >= now - range` are counted. |
| `status` | `all` \| `risk` \| `flagged` | `all` | `risk` = hops/intents whose outcome is `elevated` or `flagged`; `flagged` = outcome `flagged` only. Filters rows *and* recomputes counts over the filtered set. |

- **Outcome enum** used everywhere: `"allowed" | "elevated" | "flagged"`. **Not "blocked":** the intent-workflow pipeline records interactions *after* they have already happened, so a threat code there can only ever mean flagged. "Blocked" is reserved for `/authorize-action` denials, which are the only confirmed real blocks and aren't persisted yet (§6).
- **Wall result enum:** `"pass" | "fail" | "review" | "not_tracked"`. Because flags don't stop a call, later walls are still evaluated, so there is no `not_reached` in Phase 1. CBAC is `not_tracked` until Phase 2.
- **Timestamps:** ISO-8601 UTC strings (`"2026-09-24T10:42:13Z"`). The frontend formats "3m ago".

---

## 3. How to derive the data (the important part)

### 3.1 Classifying hops

Every stored interaction has `from`, `to`, `intentID`, `time`, `threat`. Classify each hop by looking both DIDs up in the registries:

| `from` is a… | `to` is a… | Hop kind | Drawn as |
|---|---|---|---|
| user (users table) | agent (agents table) | `user_agent` | User → Agent edge, through gate 1 |
| agent | tool/app (tools table) | `agent_app` | Agent → App edge, through gate 2 |
| agent | agent | `agent_agent` | not drawn on this plane (ignored) |
| app | agent | response hop | not drawn; ignored for counts |

Do this server-side. The frontend's DID-prefix heuristic is known to misclassify apps as agents because both use `bafy…` CIDs (see comment on `isAgentId` in `src/data/api.ts`).

### 3.2 Attributing a hop to a user

An `agent_app` hop has no user in it. Attribute it via the intent: `hop.intentID → intents.initiatorDID`. This is what makes "apps this agent called **in this user's loop**" possible: the Finance Agent → Postgres edge for Noah = `agent_app` hops where `from = financeAgent`, `to = postgres`, and `intent.initiatorDID = noah`.

### 3.3 The intent → app link

An intent "touched" an app if it has at least one `agent_app` hop to that app. One intent can touch several apps, so it can appear under more than one app. The intents endpoint returns `appDIDs[]` per intent for this reason.

### 3.4 Gate decisions per hop

Walls are listed in evaluation order. In Phase 1 a flag doesn't stop the call, so each wall's result is read independently from the threat codes on the hop.

| Wall | Applies to | Source | `pass` | `fail` | `review` |
|---|---|---|---|---|---|
| **COCA (gate 1)** | `user_agent` | Phase 2: `interaction_gate_decisions` row (`wall='coca'`). Phase 1: no threat row with code 2001/2002/2003 on the interaction = pass | pass | threat 2001–2003 | — |
| **COCA (gate 2)** | `agent_app` | Same as gate 1, on the agent→app interaction | pass | threat 2001–2003 | — |
| **CBAC** | `agent_app` | Phase 2 only: `interaction_gate_decisions` row (`wall='cbac'`). Today `intent_block_data.cbac_decision`/`cbac_app` are **never populated**, and the cbac-decisions service only returns free-text reasons for already-flagged threats | pass | fail | review |
| **Whitelisting** | `agent_app` | Agent-level approval in admin-service (`agent-admin/v1/whitelist`). **There is no agent→app allow-list.** Phase 1: threat code **1001 Whitelist Error** on the hop = fail, no 1001 = pass (history comes for free, because it's per interaction). Phase 2: decision row written at call time | no 1001 | 1001 | — |

Hop outcome (Phase 1, from the hop's threat codes via the mapping below):

- `flagged` if any code on the hop is in the **flagged** column
- else `elevated` if any code is in the **elevated** column
- else `allowed`, including hops whose only codes are in the **excluded** column

**Policy code:** return the deciding threat code and title (for example `3407 · Tier 3: LLM Deny`). It's shown in edge tooltips, on intent cards and in the trace table's outcome column. Phase 2 adds a `policy` text field for rule ids.

**Phase 1 threat-code mapping** (agreed with backend, 2026-09-25):

| Outcome | Codes |
|---|---|
| **flagged** | 1001 Whitelist Error · 2001–2003 COCA Failed (Light / Heavy / Boundary) · 3001–3005 Guard: * failed · 3101 Check 1: Drift Deny · 3202 Tier 1: Gap Deny · 3301 Tier 2: No Allowed Chunks · 3303 Tier 2: Contradiction Deny · 3403 Tier 3: LLM Keyword Deny · 3407 Tier 3: LLM Deny |
| **elevated** (needs review) | 3401 Tier 3: No Backend · 3402 Tier 3: LLM Error · 3405 Tier 3: LLM Inconclusive · 3408 Tier 3: LLM Advise ("human review recommended") · 3409 Tier 3: LLM Malformed · 9101–9104 CBAC Client errors *(infra failures; `/authorize-action` fails closed on these, so they could reasonably move to flagged)* |
| **excluded** (not a security signal) | 4001 MCP Tool Exec Error (operational) |

**Decision (2026-09-25):** only code **1000** counts as allow. The backend keeps the existing flagging condition (`env.Code != 0 && env.Code != 1000` → threat), and endpoints use `threat` as stored — **no per-endpoint filtering** of 3201 / 3302 / 3404 / 3406. The product owner is handling any change to that condition in the backend.

**Wall attribution in Phase 1:** 1001 → Whitelisting, 2001–2003 → COCA. The 3xxx guard/tier codes and 9101–9104 count towards the hop **outcome** but aren't attributed to a wall until Phase 2 records per-wall decisions.

**Persistence:** intent-workflow interactions are always stored, whether or not they carry a threat (`handleIntentWorkflow`), so every flagged hop has a row. `/authorize-action` denials (real blocks) write **nothing** to the database today. They can't appear on this page until that handler gets a write path (§8).

### 3.5 Rollups

- **Edge** (any from→to pair, within scope + range + status filter): `count` = number of hops. `allowed`/`elevated`/`flagged` = hops by outcome. `lastAt` = max `time`. `outcome` = worst of its hops (flagged > elevated > allowed). `policies[]` = distinct deciding threat codes.
- **Intent outcome** = worst hop outcome across all its `user_agent` and `agent_app` hops.
- **Path** = `(user, agent, app, intent)`. A path stopped at gate 1 has only `(user, agent)`, and its app and intent are `null`.
- **Gate rate** for a wall = `pass / (pass + fail + review)` over hops where the wall has data. A `null`/`not_tracked` wall has no rate.

### 3.6 Display fields that don't exist yet

| UI field | Proposed source | Fallback |
|---|---|---|
| User subtitle ("Finance") | not stored (`new_org_users` has no department) | **email** |
| Service identity flag ("svc-batch-07 · unsigned") | not stored | `false` — drop the red "service" styling until a flag exists |
| Agent handle ("agent_finance") | agent registry short name / slug | agent name |
| App operation ("postgres.query") | not stored (`new_tools` has no operation column) | app name / category |
| **Intent title** ("Reconcile Q3 invoices") | ✅ **Available:** `titleFull` (untruncated) and `title` (first 5 words) on every intent list (`/intent-list`, `/agent-intents`, user/tool info). Derived at read time from the intent's first interaction message | `intentID` |

The frontend currently puts `status` into the intent `name` — it should switch to `titleFull` (cards) / `title` (compact lists).

---

## 4. Endpoints

### 4.1 `GET /observability-summary`

Header line plus the numbers printed in the four gate bands.

**Query:** `range`, `status`

**Response `data`:**
```ts
interface ObservabilitySummary {
  range: "24h" | "7d" | "30d";
  identities: number;        // distinct users with ≥1 user_agent hop in range
  agents: number;            // distinct agents with ≥1 hop in range
  apps: number;              // distinct apps with ≥1 agent_app hop in range
  toolInteractions: number;  // count of agent_app hops in range
  gates: {
    gate1Coca:    WallStats;   // user→agent
    gate2Coca:    WallStats;   // agent→app
    gate2Cbac:    (WallStats & { review: number }) | null;   // null until Phase 2 ("Not tracked yet")
    gate2Whitelist: WallStats;
  };
}
interface WallStats {
  checks: number;   // hops that reached this wall
  pass: number;
  fail: number;
  passRate: number; // 0–100, one decimal — rendered as "98.2%"
}
```
**Example:**
```json
{ "range": "24h", "identities": 14, "agents": 4, "apps": 6, "toolInteractions": 1554,
  "gates": {
    "gate1Coca":      { "checks": 225,  "pass": 223,  "fail": 2, "passRate": 99.1 },
    "gate2Coca":      { "checks": 1554, "pass": 1554, "fail": 0, "passRate": 100 },
    "gate2Cbac":      null,
    "gate2Whitelist": { "checks": 1554, "pass": 1554, "fail": 0, "passRate": 100 } } }
```
**Derivation:** counts over classified hops in range, using the stored `threat` flag (§3.4). COCA fail = hops with 2001–2003; Whitelist fail = hops with 1001. CBAC is `null` until Phase 2.

---

### 4.2 `GET /observability-graph`

The two fixed middle layers (agents, apps) and every agent→app edge, org-wide. Used for the resting view.

**Query:** `range`, `status`

**Response `data`:**
```ts
interface ObservabilityGraph {
  agents: {
    agentDID: string;
    agentName: string;       // "Finance Agent"
    handle: string;          // "agent_finance"
    usersCount: number;      // distinct initiators whose intents used this agent in range
    revoked: boolean;
  }[];
  apps: {
    appDID: string;
    appName: string;         // "Postgres"
    operation: string;       // "postgres.query"
  }[];
  agentAppEdges: GateEdge[];   // from = agentDID, to = appDID
}

interface GateEdge {
  from: string;
  to: string;
  count: number;
  allowed: number;
  elevated: number;
  flagged: number;
  outcome: "allowed" | "elevated" | "flagged";
  lastAt: string;
  policies: string[];          // deciding threat codes, e.g. ["3408 Tier 3: LLM Advise"]
  walls: {                     // present on agent→app edges only
    coca:      { pass: number; fail: number };
    cbac:      { pass: number; fail: number; review: number } | null;   // null until Phase 2
    whitelist: { pass: number; fail: number };
  };
}
```
**Example (one edge):**
```json
{ "from": "bafy…fin", "to": "bafy…pg", "count": 188, "allowed": 181, "elevated": 0, "flagged": 7,
  "outcome": "flagged", "lastAt": "2026-09-24T10:40:02Z", "policies": ["3407 Tier 3: LLM Deny"],
  "walls": { "coca": { "pass": 188, "fail": 0 },
             "cbac": null,
             "whitelist": { "pass": 188, "fail": 0 } } }
```
**Derivation:** group `agent_app` hops in range by `(from, to)` and apply §3.4–3.5. Agents and apps with no hops in range may be omitted.

---

### 4.3 `GET /observability-users` (paged)

The scrollable user layer. Each user carries their own user→agent edges, so newly loaded rows can draw their lines immediately.

**Query:** `range`, `status`, `page` (default 1), `pageSize` (default 30, max 100), `search` (optional, matches name/email/DID)

**Order:** most recent activity first (`lastActiveAt desc`), so the busiest identities are at the top.

**Response `data`:**
```ts
interface PagedObservabilityUsers {
  usersList: {
    userDID: string;
    userName: string;          // display name
    email: string;
    subtitle: string;          // department / title (fallback email)
    kind: "human" | "service";
    signed: boolean;           // false → drawn in red ("unsigned")
    lastActiveAt: string;
    agentEdges: GateEdge[];    // from = userDID, to = agentDID; `walls` omitted (gate 1 is COCA only — use outcome)
  }[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
```
**Derivation:** `user_agent` hops in range, grouped by `(from, to)`. `outcome = flagged` means COCA flagged the hop on gate 1 (2001–2003). A service identity with a failed signature appears here with a `flagged` edge to the agent it contacted.

---

### 4.4 `GET /observability-user-flow`

Step 1: everything needed to highlight a picked user's slice, including **user-scoped** agent→app edges.

**Query:** `userDID` (required), `range`, `status`

**Response `data`:**
```ts
interface ObservabilityUserFlow {
  userDID: string;
  agentEdges: GateEdge[];        // user → agent (same as in 4.3, returned here so the call is self-contained)
  agentAppEdges: GateEdge[];     // agent → app, counting ONLY hops whose intent.initiatorDID = userDID
}
```
**Frontend use:** click user → light the agents in `agentEdges`. Click an agent → light the apps in `agentAppEdges` where `from = agentDID`, with no extra call.

**Derivation:** join `agent_app` hops → `intents` on `intentID`, filter `initiatorDID = :userDID`, then group by `(from, to)`.

**Errors:** unknown `userDID` → `status:false, message:"user not found"`. Non-admin asking for another user → 403.

---

### 4.5 `GET /observability-intents`

Step 2: the intents column, which appears only once a user **and** an agent are picked.

**Query:** `userDID` (required), `agentDID` (required), `appDID` (optional), `range`, `status`, `page` (default 1), `pageSize` (default 50)

**Response `data`:**
```ts
interface PagedObservabilityIntents {
  intentsList: {
    intentID: string;
    intentTitle: string;           // = titleFull (see §3.6)
    outcome: "allowed" | "elevated" | "flagged";
    policy: string | null;         // deciding threat code + title, if any — shown on the card
    flags: number;                 // flagged hops in this intent (card: "3407 LLM deny · 4 flags")
    interactionsCount: number;     // hops in this intent through this agent (card: "112 ixns")
    appDIDs: string[];             // apps this intent reached via this agent → lets the UI narrow by app client-side
    startedAt: string;
    lastAt: string;                // card: "5m ago"
    reviewStatus: "Ongoing" | "Acknowledged" | "Flagged";
  }[];
  total: number; page: number; pageSize: number; totalPages: number;
}
```
**Derivation:** intents where `initiatorDID = :userDID` that have ≥1 hop involving `:agentDID` in range. `appDIDs` are the `to` of that intent's `agent_app` hops from `:agentDID`. If `appDID` is given, keep intents where `appDIDs` contains it. Order by `lastAt desc`.

**Why the user and agent are both required:** this mirrors the UI rule, and it keeps the result bounded (one user × one agent) no matter how big the org is.

---

### 4.6 `GET /observability-paths` (trace table)

Rows for the table under the plane. The grain depends on the selection:

- `userDID` **and** `agentDID` given → one row per **(user, agent, app, intent)**
- otherwise → one row per **(user, agent, app)** with `intent = null`, carrying the worst outcome of the paths it stands for

**Query:** `userDID?`, `agentDID?`, `appDID?`, `intentID?`, `range`, `status`, `page` (default 1), `pageSize` (default 50)

**Response `data`:**
```ts
interface PagedObservabilityPaths {
  pathsList: {
    user:   { did: string; name: string };
    agent:  { did: string; name: string };
    app:    { did: string; name: string } | null;     // null → stopped at gate 1
    intent: { id: string; title: string } | null;     // null at the (user, agent, app) grain
    gate1:  { result: "pass" | "fail"; count: number };                 // COCA column
    gate2:  {                                                           // COCA / CBAC / WHITELIST columns
      coca:      { result: WallResult; count: number };
      cbac:      { result: WallResult; count: number };
      whitelist: { result: WallResult; count: number };
    } | null;                                          // null when the path has no agent→app hop
    interactionsCount: number;                         // "112 ixns"
    outcome: "allowed" | "elevated" | "flagged";
    policy: string | null;         // deciding threat code, shown under the outcome badge
  }[];
  total: number; page: number; pageSize: number; totalPages: number;
}
type WallResult = "pass" | "fail" | "review" | "not_tracked";
```
**Derivation:** build paths from classified hops (§3.1–3.3) and filter by whichever of `userDID/agentDID/appDID/intentID` are present. A wall's `result` is its worst result across the row's hops, and `count` is the number of hops. With no selection and `status=all` the table is empty in the UI, so the frontend won't call it then. With `status=risk|flagged` and no selection it lists the flagged paths org-wide.

---

## 5. Frontend call sequence

```
mount ──► summary + graph + users(page 1)            (parallel)
scroll ─► users(page N)                              (when within 2 rows of the end)
click user U ─► user-flow(U) + paths(U)
click agent A (with U) ─► intents(U, A) + paths(U, A)
click app P ─► narrow intents client-side via appDIDs; paths(U, A, P)
click intent I ─► paths(U, A, P?, I)                 (or filter client-side)
filter change ─► re-run the calls for the current selection with status=
range change  ─► re-run everything
Esc ─► clear selection (no call)
```

Suggested caching: key `user-flow` and `intents` responses by `(userDID, agentDID, range, status)` and keep them for the session, so back-and-forth clicking doesn't refetch. Cache `graph` and `summary` per `(range, status)`.

Frontend implementation: the canvas loads `summary`, `graph` and `users` with `status=all` and filters client-side, so a filter dims nodes instead of removing them. Only `/observability-paths` (the trace table) is called with the active `status=`. Responses are cached per key for the life of the page.

---

## 6. Backend review findings (2026-09-25)

| # | Question | Finding | Consequence |
|---|---|---|---|
| 1 | Is there a blocked/allowed status? | None stored. Only `new_interactions.threat` (bool) + `threats.threat_code`. | Outcome comes from the threat-code mapping (§3.4). |
| 2 | Does a threat stop the call? | **Intent-workflow pipeline: no.** It records completed interactions after the fact, so a code only means *flagged*. **`/dashboard/v1/authorize-action`: yes.** A CBAC deny returns 403 and the app call never happens — but nothing is written to the DB, allowed or denied. | UI says **"flagged"** everywhere. "Blocked" is reserved for authorize-action, once it persists its decisions. |
| 3 | Threat-code list | ✅ Agreed mapping in §3.4. Only 1000 counts as allow. | Endpoints use the stored `threat` flag as-is; backend owner handles the flagging condition. |
| 4 | COCA result storage | Only failures stored (2001–2003); passes = absence of a row. | Phase 1 pass rate = `1 − COCA-flagged / interactions`. |
| 5 | Does every interaction go through COCA? | ✅ **Yes** — confirmed by the product owner (COCA runs in the agent runtime/SDK for every interaction). | "No 2001–2003 code on a hop" is a valid COCA pass. The Phase 1 pass rate is exact. |
| 6 | Whitelisting source | Admin-service, agent-level only (`{agent_id}`); local mirror `new_agents.revoked`; no agent→app allow-list. | Wall = "agent approved". Phase 1 uses code 1001 per hop. |
| 7 | CBAC decisions | `cbac_decision`/`cbac_app` never written; the cbac-decisions service only gives free-text reasons, fetched only for already-flagged threats. | CBAC wall = "Not tracked yet" in Phase 1. |
| 8 | Intent title | ✅ Shipped: `titleFull` + `title` on all intent lists. | Resolved. |
| 9 | Department / service flag / operation name | Not stored. | Fallbacks in §3.6. |

**Still open:** none.

**Scale:** index interactions on `(time)`, `(from, to, time)`, `(intent_id)`; intents on `(initiator_did, started_at)`; pre-aggregate if orgs get large.

---

## 7. UI element → field → endpoint

| UI element | Field | Endpoint |
|---|---|---|
| Header "14 identities · 4 agents · 6 apps · 1,554 tool interactions · Last 24h" | `identities`, `agents`, `apps`, `toolInteractions`, `range` | summary |
| Gate band "98.2% verified · 2 failed" | `gates.*.passRate`, `gates.*.fail` | summary |
| User card (name, subtitle, avatar initials, red if unsigned) | `userName`, `subtitle`, `kind`, `signed` | users |
| User→agent line, pill "✓ 24" / "× 2 FLAGGED" | `agentEdges[].count`, `outcome` | users / user-flow |
| Agent card "Finance Agent · agent_finance · 6 users" | `agentName`, `handle`, `usersCount` | graph |
| App card "Postgres · postgres.query" | `appName`, `operation` | graph |
| Agent→app line + pill + tooltip ("Allowed 181 · Flagged 3", threat code) | `GateEdge` | graph (rest) / user-flow (user picked) |
| Intent card (title, status, "112 ixns · 5m ago" / "3407 LLM deny · 4 flags") | `intentTitle`, `outcome`, `interactionsCount`, `lastAt`, `policy`, `flags` | intents |
| Trace table row and wall badges | `pathsList[]` | paths |

---

## 8. Delivery plan

### Phase 1 — existing data only (no schema change)

| Element | Source |
|---|---|
| Users, agents, apps, lines, counts, last activity | classified `new_interactions` + intents' initiator |
| Intent titles | `titleFull` |
| Outcome | threat-code mapping (§3.4) — `flagged` / `elevated` / `allowed` (only 1000 = allow) |
| Gate 1 / gate 2 COCA rate | `1 − (interactions with 2001–2003) / interactions` (every interaction goes through COCA — finding #5) |
| CBAC wall | not tracked — endpoints return `null` for CBAC stats and `"not_tracked"` in path rows |
| Whitelist wall | `1 − (interactions with 1001) / interactions` |

Contracts are as in §4. The frontend shows "Not tracked yet" for `null`, and already renders Phase 1 this way on mock data.

### Phase 2 — explicit gate decisions

Proposed by backend:

```sql
CREATE TABLE interaction_gate_decisions (
    id             TEXT PRIMARY KEY,
    interaction_id TEXT NOT NULL REFERENCES new_interactions(interaction_id),
    intent_id      TEXT NOT NULL,
    wall           TEXT NOT NULL,   -- 'coca' | 'cbac' | 'whitelist'
    result         TEXT NOT NULL,   -- 'pass' | 'fail' | 'review'
    code           INT,
    reason         TEXT DEFAULT '',
    decided_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_gate_decisions_interaction ON interaction_gate_decisions(interaction_id);
CREATE INDEX idx_gate_decisions_wall_result ON interaction_gate_decisions(wall, result);
```

One row per wall per interaction, written when the check actually runs.

Backend has agreed to notes 1–3 below.

Frontend review notes on the proposal:

1. **Add `policy TEXT`.** Rule ids like `PII-EXPORT-01` are strings, and `code INT` can't hold them. The UI shows the policy on tooltips and intent cards.
2. **Add `UNIQUE (interaction_id, wall)`** so retries don't double-count.
3. **Add `org_id`** (or rely on a join) for the admin/non-admin scoping, plus an index on `(intent_id)` and on `(decided_at)` for range queries.
4. **Gate 1 vs gate 2 COCA** is derivable from the interaction's hop type (user→agent vs agent→app), so no `gate` column is needed as long as classification (§3.1) is reliable.
5. **Denied calls need an interaction row** before the decision row, because of the foreign key. Intent-workflow hops already have one. `/authorize-action` needs a new write path, because today it records neither allows nor denies. That write path is what would make real **"blocked"** counts possible.
6. **CBAC** is only meaningful once cbac-decisions returns a structured `pass | fail | review` + code for every check (backend finding #4). Otherwise this table recreates the "only failures visible" gap.

