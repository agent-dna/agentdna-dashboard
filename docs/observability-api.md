# Observability API — backend spec

Endpoints the dashboard's **Observability** page needs. The page currently runs on a client-side mock
(`src/pages/observability/mockData.ts`); these endpoints replace it one-for-one.

---

## 0. Conventions (same as every existing endpoint)

| Thing | Rule |
|---|---|
| Base URL | `VITE_API_BASE_URL` (same host as `/intent-list`, `/interactions-list`, …) |
| Auth | `Authorization: Bearer <token>`. **Every query is scoped to the caller's org** via the token — never return another org's rows. Admins and users see the same org-wide data (same as `/interactions-list`). |
| Envelope | `{ "status": true, "data": <payload>, "message": "optional" }`. On failure: `status: false` + `message`, with a matching HTTP code. |
| Errors | `401` bad/expired token (dashboard logs out). `404` unknown or other-org ID. `400` bad query param (say which in `message`). |
| JSON casing | camelCase. IDs end in `ID` (`intentID`, `interactionID`, `userID`); DIDs are plain strings. |
| Time | ISO‑8601 UTC strings, e.g. `"2026-09-21T10:42:07Z"`. The dashboard turns them into "3m ago". |
| Paging | `?page=1&pageSize=50` in. Out: `{ <x>List: [...], total, page, pageSize, totalPages }`. `pageSize` default 50, max 200. `page` is 1-based. |
| Names | Always send a resolved display name next to every DID (`agentName`, `userName`, `appName`). Fall back to the DID yourself if unknown — the dashboard should never have to resolve names for this page. |

---

## 1. Shared vocabulary

These are the definitions every count below is built on. Please implement them once and reuse.

### 1.1 Entities

| Entity | Meaning | ID |
|---|---|---|
| **User** | A human in the org who starts intents. | `userID` (same as `/users-list`) |
| **Agent** | An AI agent. | agent DID (same as `/agents-list.agentID`) |
| **App** | A tool/app agents call (DB, S3, Slack, LLM, …). | tool DID (same as `/tools-list.toolDID`) |
| **Intent** | One task a user asked for; a tree of interactions. | `intentID` |
| **Hop** (agent interaction) | One agent → agent call inside an intent. | `interactionID` |
| **App call** (app interaction) | One agent → app call inside an intent. | `interactionID` |

A hop and an app call are both rows of the existing interactions table — the difference is the target type
(agent vs tool). Please keep them in the same ID space.

### 1.2 Intent status (5 values)

The page colours intents with exactly these values. Derive them in this **precedence order** (first match wins):

| `status` | Rule |
|---|---|
| `"blocked"` | At least one interaction in the intent has `verdict = "blocked"` (policy denied it). |
| `"high-risk"` | `threatDetected = true` (or `threatCount > 0`) but nothing was blocked. |
| `"elevated"` | Intent needed elevated scope / risk score above your elevated threshold. **If you have no such signal, never return this value** — don't approximate it. |
| `"active"` | Not ended (`endedAt` is null). |
| `"completed"` | Ended cleanly. |

**"At-risk intent"** (used in several counts) = status is `"high-risk"` or `"blocked"`.

### 1.3 Interaction verdict

| Field | Values | Meaning |
|---|---|---|
| `verdict` | `"allowed"` \| `"blocked"` | Whether the call was let through. |
| `threat` | bool | A threat was detected on this call (can be true on an allowed call). |
| `threatID` | string, optional | Present only when `threat = true`; same as today — dashboard can call `GET /threat-by-id`. |

### 1.4 Fields interactions need that don't exist today

The current `/interactions-list` rows have `interactionID, from, to, fromName, toName, threat, intentID, time,
blockType, threatID`. Observability additionally needs:

| New field | Type | Meaning / source |
|---|---|---|
| `action` | string | Machine name of what was called, e.g. `"postgres.query"`, `"s3.read"`, `"delegate"` for agent→agent hand-offs. |
| `detail` | string | One-line human description, e.g. `"Bulk read customers.pii"`. Empty string if unknown. |
| `latencyMs` | int | Call duration in ms. `0` if unknown. |
| `verdict` | `"allowed"`\|`"blocked"` | See 1.3. |
| `sequence` | int | 1-based order of this interaction **within its intent** (by `time`, tie-break by block index). |
| `parentInteractionID` | string \| null | The interaction that handed work to this one's initiator (call stack parent). `null` for calls made directly by the user / root. Used to nest the trace. |

### 1.5 App category

Apps are grouped by `category` (`"Database"`, `"Storage"`, `"Messaging"`, `"LLM"`, `"Incidents"`, `"Search"`,
`"Secrets"`, `"Identity"`, `"Deploys"`, `"Observability"`, `"Network"`, …). Free-form string from the tool
registry. If you don't store one, send `""` — the dashboard shows `"APP"`.

---

## 2. Endpoints at a glance

| # | Method + path | Powers |
|---|---|---|
| 1 | `GET /observability/users` | **By User** — first plane (all user tiles) |
| 2 | `GET /observability/users/{userID}/intents` | **By User** — ring of a user's intents |
| 3 | `GET /observability/intents/{intentID}` | **By User** hop ring, **By Agent** leaf, and **"View as trace"** in all views |
| 4 | `GET /observability/agents` | **By Agent** — first plane (agent tiles + dotted links) |
| 5 | `GET /observability/agents/{agentID}/interactions` | **By Agent** — ring of an agent's hops |
| 6 | `GET /observability/apps` | **By App** — first plane (app tiles) |
| 7 | `GET /observability/apps/{appID}/interactions` | **By App** — scrollable interaction timeline + details |

Path IDs are URL-encoded (DIDs contain `:`).

Common optional query param on 1, 4, 6: **`window`** = `24h` \| `7d` \| `30d` \| `all`. Default **`7d`**.
All counts on those endpoints are computed over interactions/intents inside the window. (The UI has no window
picker yet — it will send nothing and get the default.)

---

## 3. Endpoint details

### 3.1 `GET /observability/users`

All users that started at least one intent in the window, for the scatter plane.

**Query:** `window` (optional), `limit` (optional, default 200, max 500).
Sort: most recent intent first. If more users exist than `limit`, return the top `limit` and set `truncated: true`.

**Response `data`:**
```ts
interface ObsUsersResponse {
  usersList: ObsUserNode[];
  total: number;        // users with ≥1 intent in window (before limit)
  truncated: boolean;   // true if usersList was cut at limit
  generatedAt: string;  // ISO time the numbers were computed
}

interface ObsUserNode {
  userID: string;
  userName: string;            // display name / email
  intentCount: number;         // intents this user initiated in window   → tile's count pill
  atRiskIntentCount: number;   // of those, status high-risk|blocked       → reserved, send it
  lastActiveAt: string;        // ISO, latest intent start
}
```

**Example:**
```json
{
  "status": true,
  "data": {
    "usersList": [
      { "userID": "u_91", "userName": "priya@acme.com", "intentCount": 4, "atRiskIntentCount": 1, "lastActiveAt": "2026-09-21T10:02:11Z" }
    ],
    "total": 1,
    "truncated": false,
    "generatedAt": "2026-09-21T10:05:00Z"
  }
}
```

---

### 3.2 `GET /observability/users/{userID}/intents`

The intents one user started — shown as a ring of cards around the user.

**Query:** `window`, `page`, `pageSize` (default 50).

**Sort (important):** at-risk first (`blocked`, then `high-risk`), then newest first. The canvas draws only the
first 5 cards and shows "5 of N" using `total`, so the sort decides what's visible — threats must never be pushed
off the first page by safe intents.

**Response `data`:**
```ts
interface ObsUserIntentsResponse {
  intentsList: ObsIntentCard[];
  total: number;
  flaggedTotal: number;   // how many of `total` are at-risk (drives the "N flagged" caption)
  page: number;
  pageSize: number;
  totalPages: number;
}

interface ObsIntentCard {
  intentID: string;
  title: string;            // human name of the task, e.g. "Close monthly ledger"
  status: "active" | "completed" | "elevated" | "high-risk" | "blocked";
  hopCount: number;         // agent→agent interactions in this intent (not app calls)
  appCallCount: number;     // agent→app interactions in this intent
  startedAt: string;
  endedAt: string | null;
}
```

`title`: today `/intent-list` has no title field (the dashboard falls back to status). Please add the real task
title here — the intent's prompt/summary, truncated to ~120 chars.

---

### 3.3 `GET /observability/intents/{intentID}`

Everything about one intent: header, every hop in order, and stats for each agent involved. One call powers
three things: the hop ring (By User level 3), the intent leaf (By Agent level 3), and the **"View as trace"**
panel (left-to-right replay).

**Query:** none. Not paged — intents are small. If an intent has more than 500 hops, return the first 500 by
`sequence` and set `truncated: true`.

**Response `data`:**
```ts
interface ObsIntentDetail {
  intent: {
    intentID: string;
    title: string;
    status: "active" | "completed" | "elevated" | "high-risk" | "blocked";
    initiator: { userID: string; userName: string };
    startedAt: string;
    endedAt: string | null;
    totalLatencyMs: number;   // sum of hop latencyMs
    blockedHopCount: number;
  };
  hops: ObsHop[];             // agent→agent only, ordered by `sequence` ascending
  agents: Record<string, ObsAgentStats>;  // keyed by agent DID; every agent that appears in `hops`
  truncated: boolean;
}

interface ObsHop {
  interactionID: string;
  sequence: number;                 // 1-based, order within the intent
  parentInteractionID: string | null;
  from: { agentID: string; agentName: string };
  to:   { agentID: string; agentName: string };
  action: string;                   // "delegate" for hand-offs, otherwise the operation
  detail: string;
  verdict: "allowed" | "blocked";
  threat: boolean;
  threatID?: string;
  latencyMs: number;
  time: string;
}

// Same numbers as endpoint 4 — lets the dashboard draw an agent tile without another call.
interface ObsAgentStats {
  agentName: string;
  intentCount: number;         // distinct intents this agent took part in (window = 7d)
  atRiskIntentCount: number;   // of those, at-risk
}
```

**Example (trimmed):**
```json
{
  "status": true,
  "data": {
    "intent": {
      "intentID": "I-1804", "title": "Bulk download HR docs", "status": "blocked",
      "initiator": { "userID": "u_91", "userName": "priya@acme.com" },
      "startedAt": "2026-09-21T09:58:00Z", "endedAt": "2026-09-21T09:58:03Z",
      "totalLatencyMs": 412, "blockedHopCount": 1
    },
    "hops": [
      { "interactionID": "ix-17", "sequence": 1, "parentInteractionID": null,
        "from": { "agentID": "bafy…orch", "agentName": "Orchestrator" },
        "to":   { "agentID": "bafy…kb",   "agentName": "KB Agent" },
        "action": "delegate", "detail": "Delegate to KB Agent",
        "verdict": "allowed", "threat": false, "latencyMs": 118, "time": "2026-09-21T09:58:00Z" },
      { "interactionID": "ix-18", "sequence": 2, "parentInteractionID": "ix-17",
        "from": { "agentID": "bafy…kb",  "agentName": "KB Agent" },
        "to":   { "agentID": "bafy…etl", "agentName": "ETL Agent" },
        "action": "s3.read", "detail": "Fetch employee records archive",
        "verdict": "blocked", "threat": true, "threatID": "th_552", "latencyMs": 294, "time": "2026-09-21T09:58:01Z" }
    ],
    "agents": {
      "bafy…orch": { "agentName": "Orchestrator", "intentCount": 20, "atRiskIntentCount": 4 },
      "bafy…kb":   { "agentName": "KB Agent",     "intentCount": 6,  "atRiskIntentCount": 1 },
      "bafy…etl":  { "agentName": "ETL Agent",    "intentCount": 3,  "atRiskIntentCount": 1 }
    },
    "truncated": false
  }
}
```

---

### 3.4 `GET /observability/agents`

All agents active in the window, plus which agents talked to each other directly (the dotted lines).

**Query:** `window`, `limit` (default 200, max 500). Sort: most `intentCount` first.

**Response `data`:**
```ts
interface ObsAgentsResponse {
  agentsList: ObsAgentNode[];
  links: ObsAgentLink[];
  total: number;
  truncated: boolean;
  generatedAt: string;
}

interface ObsAgentNode {
  agentID: string;
  agentName: string;
  intentCount: number;         // distinct intents it appears in (as from OR to)   → white count pill
  atRiskIntentCount: number;   // of those, at-risk                                 → red pill (hidden when 0)
  interactionCount: number;    // hops it sent or received
  hasThreats: boolean;         // atRiskIntentCount > 0                              → red health dot
}

// One entry per unordered pair of agents with ≥1 direct hop in the window. Agent→app calls are NOT links.
interface ObsAgentLink {
  a: string;                   // agent DID, lexicographically smaller of the pair
  b: string;                   // the other agent DID
  hopCount: number;
  blockedHopCount: number;
}
```

Only include links where **both** agents are in `agentsList` (so a truncated list has no dangling lines).
Self-calls (`from == to`) are not links.

---

### 3.5 `GET /observability/agents/{agentID}/interactions`

Hops this agent sent **or** received — the ring around a selected agent.

**Query:** `window`, `page`, `pageSize` (default 50).
**Sort:** blocked first, then newest first (same reason as 3.2).

**Response `data`:**
```ts
interface ObsAgentInteractionsResponse {
  interactionList: ObsAgentHop[];
  total: number;
  flaggedTotal: number;   // blocked hops in `total`
  page: number;
  pageSize: number;
  totalPages: number;
}

interface ObsAgentHop extends ObsHop {
  direction: "outbound" | "inbound";   // relative to {agentID}
  intent: {
    intentID: string;
    title: string;
    status: "active" | "completed" | "elevated" | "high-risk" | "blocked";
  };
}
```

Clicking a hop leads to its intent — the dashboard then calls **3.3** with `intent.intentID`.

---

### 3.6 `GET /observability/apps`

All apps agents called in the window.

**Query:** `window`, `limit` (default 200, max 500). Sort: most `interactionCount` first.

**Response `data`:**
```ts
interface ObsAppsResponse {
  appsList: ObsAppNode[];
  total: number;
  truncated: boolean;
  generatedAt: string;
}

interface ObsAppNode {
  appID: string;               // tool DID
  appName: string;
  category: string;            // see 1.5; "" if unknown
  interactionCount: number;    // agent→app calls in window        → white count pill
  blockedCount: number;        // of those, verdict = blocked       → red pill (hidden when 0)
  agentCount: number;          // distinct agents that called it
  lastCalledAt: string;
}
```

---

### 3.7 `GET /observability/apps/{appID}/interactions`

The scrollable vertical timeline for one app, plus everything the details pane shows when an item is clicked
(so clicking needs **no extra request**).

**Query:**

| Param | Default | Notes |
|---|---|---|
| `status` | `all` | `all` \| `blocked` — the All/Blocked filter |
| `window` | `7d` | |
| `page` | `1` | Dashboard loads the next page as the user scrolls to the bottom |
| `pageSize` | `50` | |

**Sort:** newest first (`time` desc). **Not** risk-first here — it's a timeline.

**Response `data`:**
```ts
interface ObsAppInteractionsResponse {
  app: { appID: string; appName: string; category: string };
  summary: {                    // over the whole window, independent of `status` and `page`
    interactionCount: number;   // drives "All N"
    blockedCount: number;       // drives "Blocked N"
    agentCount: number;
  };
  interactionList: ObsAppCall[];
  total: number;                // rows matching `status` (for paging)
  page: number;
  pageSize: number;
  totalPages: number;
}

interface ObsAppCall {
  interactionID: string;
  seq: number;                  // 1-based position in this app's history in the window, OLDEST = 1.
                                // Must be the same number whichever `status` filter is used,
                                // so "#12" means the same call in All and Blocked.
  agent: { agentID: string; agentName: string };
  action: string;               // e.g. "postgres.query"
  detail: string;               // e.g. "Bulk read customers.pii"
  verdict: "allowed" | "blocked";
  threat: boolean;
  threatID?: string;
  latencyMs: number;
  time: string;
  intent: {
    intentID: string;
    title: string;
    status: "active" | "completed" | "elevated" | "high-risk" | "blocked";
    initiator: { userID: string; userName: string };
  };
}
```

**Example (trimmed):**
```json
{
  "status": true,
  "data": {
    "app": { "appID": "did:tool:postgres", "appName": "Postgres", "category": "Database" },
    "summary": { "interactionCount": 31, "blockedCount": 4, "agentCount": 9 },
    "interactionList": [
      { "interactionID": "ax-140", "seq": 31,
        "agent": { "agentID": "bafy…ledger", "agentName": "Ledger Agent" },
        "action": "postgres.query", "detail": "Bulk read customers.pii",
        "verdict": "blocked", "threat": true, "threatID": "th_601", "latencyMs": 88,
        "time": "2026-09-21T10:01:44Z",
        "intent": { "intentID": "I-1803", "title": "Export customer table", "status": "blocked",
                    "initiator": { "userID": "u_12", "userName": "maria@acme.com" } } }
    ],
    "total": 31, "page": 1, "pageSize": 50, "totalPages": 1
  }
}
```

"View intent trace" in the details pane calls **3.3** with `intent.intentID`.

---

## 4. How the page calls these

| User action | Call(s) |
|---|---|
| Open **By User** | `GET /observability/users` |
| Click a user | `GET /observability/users/{userID}/intents` |
| Click an intent | `GET /observability/intents/{intentID}` (hop ring **and** agent tiles come from this one response) |
| Click a hop | none — agents already in the 3.3 response |
| "View as trace" | none if 3.3 already loaded, else `GET /observability/intents/{intentID}` |
| Open **By Agent** | `GET /observability/agents` |
| Click an agent | `GET /observability/agents/{agentID}/interactions` |
| Click a hop | `GET /observability/intents/{intent.intentID}` |
| Open **By App** | `GET /observability/apps` |
| Click an app | `GET /observability/apps/{appID}/interactions?page=1` |
| Scroll to bottom of timeline | same with `page=2`, `3`, … |
| Toggle **Blocked** | same with `status=blocked&page=1` |
| Click an interaction | none — details are in the row |

Live refresh: the first-plane endpoints (1, 4, 6) are polled every **15 s** while the tab is visible. Keep
them cheap (pre-aggregate if needed). Returning `generatedAt` lets the dashboard skip re-rendering when nothing
changed; supporting `ETag` / `If-None-Match` → `304` is welcome but optional.

---

## 5. Edge cases

- **Unknown names:** send the DID (or a shortened form) as the name; never `null`.
- **Deleted/revoked agent or app:** still return it in historical rows with its last known name.
- **Self-call** (`from == to`): valid hop; not a link in 3.4; counts once in `interactionCount`.
- **Intent with zero hops:** 3.3 returns `hops: []`, `agents: {}`. It still counts in `intentCount` (3.1) and
  `hopCount: 0` (3.2).
- **Empty org / empty window:** empty lists, `total: 0`, `status: true` (not a 404).
- **Other-org ID in a path:** `404`, same as a non-existent ID (don't leak existence).
- **Out-of-range page:** empty list with correct `total` / `totalPages`, `status: true`.
- **`elevated`:** only when you have a real signal (see 1.2).

---

## 6. Acceptance checks

1. For any user, `intentCount` in 3.1 equals `total` from 3.2 (same window).
2. For any agent, `intentCount` in 3.4 equals `agents[agentID].intentCount` in any 3.3 response that includes it.
3. For any app, `interactionCount` / `blockedCount` in 3.6 equal `summary` in 3.7.
4. 3.2 and 3.5 page 1 contain every blocked/at-risk row before any safe row (when there are ≤ `pageSize` of them).
5. In 3.7, the same `interactionID` has the same `seq` with `status=all` and `status=blocked`.
6. In 3.3, `hops` is strictly increasing by `sequence`, and every `parentInteractionID` (when not null) is an
   `interactionID` earlier in the same list.
7. Every `links[]` entry in 3.4 references two agents present in `agentsList`.
8. Nothing from another org is ever returned — test with two orgs' tokens.

---

## 7. Open questions for backend

1. Do interactions already record `action`, `detail`, `latencyMs`, and the call-stack parent? If some are
   missing, which can be added at ingest time?
2. Is there a real signal for `elevated`? If not, we'll ship without it.
3. Is `7d` a sensible default window for your data volumes, or should the first planes be `24h`?
4. Do tools have a category in the registry today?
