# AgentDNA Dashboard Portal

The AgentDNA Dashboard Portal is a web-based monitoring and analytics interface for visualizing,
inspecting, and understanding the behavior of autonomous agents.

It gives an organization visibility into:

- **Agents & Apps (tools)** deployed in the org — reliability score, interaction volume, threats, policy history
- **Intents** — a user-initiated task and the full multi-agent chain it triggers
- **Interactions** — every individual agent→agent / agent→tool call in the ledger
- **Flow** — an animated, replayable graph of how an intent traveled through the agent network
- **Requests** — agent-deployment and agent-access approval workflows
- **Users** — org members, their activity, and the agents they can reach

The dashboard is a pure client-side SPA. It holds no database of its own — every screen is a view over
two backend services (the **dashboard middleware** and the **agent-admin** service).

---

## Table of contents

- [Tech stack](#tech-stack)
- [Architecture](#architecture)
- [Project structure](#project-structure)
- [Routes & pages](#routes--pages)
- [Data layer](#data-layer)
- [API surface](#api-surface)
- [Authentication](#authentication)
- [Local development](#local-development)
- [Environment variables](#environment-variables)
- [Docker](#docker)
- [Dummy / demo mode](#dummy--demo-mode)

---

## Tech stack

| Concern | Choice |
|---|---|
| Framework | React 19 + TypeScript 5.9 |
| Build tool | Vite 7 |
| Routing | react-router-dom 7 (`BrowserRouter`) |
| Styling | Tailwind CSS 4 (`@tailwindcss/vite`) + hand-written CSS variables in `src/index.css` |
| Charts | Recharts 3 |
| Animation | Framer Motion 12 |
| Icons | lucide-react |
| PDF export | jsPDF |
| Server (prod) | nginx (static, SPA fallback) |
| State | React Context + local hooks — **no** Redux/Zustand/React Query |

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                     Browser (SPA, nginx)                     │
│                                                              │
│  main.tsx → Providers → <Routes>                             │
│    AuthProvider → DirectoryProvider → IntentNumbersProvider   │
│      → TweaksProvider → DrawerProvider                        │
│                                                              │
│  Pages (src/pages)                                           │
│      │ call                                                  │
│      ▼                                                       │
│  Hooks (src/data/hooks.ts)   ← useAsync wrapper              │
│      │ call                                                  │
│      ▼                                                       │
│  Data layer (src/data/api.ts + src/api/*.ts)                 │
│      │  maps wire shapes → src/types.ts domain types         │
│      ▼                                                       │
│  HTTP client (src/api/client.ts)                             │
│      • injects Bearer JWT                                    │
│      • unwraps { status, data, message }                     │
│      • 401 handling, logging, dummy-mode short-circuit       │
└───────────────┬──────────────────────────┬───────────────────┘
                │                          │
   VITE_API_BASE_URL          VITE_ADMIN_API_BASE_URL
                │                          │
                ▼                          ▼
    Dashboard middleware API        Agent-admin API
    (/dashboard/v1/…)               (/agent-admin/v1/…)
```

**Layering rules**

1. Pages never call `fetch` and never construct URLs — they call hooks or data-layer functions.
2. `src/data/api.ts` owns every *wire → domain* mapping (`ApiAgent → Agent`, ISO date → "minutes ago", etc.).
   Backend field renames should only ever need a change in this file.
3. `src/api/client.ts` is the only place that knows about the base URL, the token, and the
   `{ status, data, message }` envelope.

---

## Project structure

```
src/
├── main.tsx                 Route table + provider tree
├── App.tsx                  Authenticated shell: sidebar, topbar, global search, drawer
├── types.ts                 Domain types (Agent, Tool, Intent, Interaction, …)
├── index.css                Design tokens + all component CSS
│
├── api/                     Thin per-domain HTTP wrappers
│   ├── client.ts            apiRequest / apiUpload, token store, ApiError
│   ├── auth.ts              login, admin login, register, OTP, password reset
│   ├── profile.ts           user/admin profile, update profile, change password
│   ├── users.ts             org users list, create user, access grant/revoke
│   ├── requests.ts          agent-creation + agent-access request workflows
│   ├── policy.ts            agent/user policy upload, history, single update
│   └── keys.ts              API key generate/revoke, token usage
│
├── data/
│   ├── api.ts               Domain data layer + wire→domain mappers
│   ├── hooks.ts             useAsync-based hooks consumed by pages
│   ├── dummyRouter.ts       Offline mock router (VITE_DUMMY=true)
│   └── dummy.json           Seed data for dummy mode
│
├── context/
│   ├── AuthContext.tsx      Session, JWT decode/expiry, login/register/logout
│   ├── DirectoryContext.tsx DID → { name, kind } lookup (agents + tools + users)
│   ├── IntentNumbersContext.tsx  Stable "Intent #N" numbering
│   ├── DrawerContext.tsx    Global right-hand detail drawer
│   └── TweaksContext.tsx    UI prefs (density, sidebar, chart style, font)
│
├── components/              DataTable, LedgerTable, Chart, MetricTile, Pagination,
│                            Drawer, Modal, Tabs, SearchDropdown, TraceInspector, …
│   ├── drawer/              Drawer bodies: EntityDetail, InteractionDetail, IntentDetail
│   └── forms/               Modals: AgentRequestModal, AddUserModal, DeployAgentModal,
│                            EditAgentPolicyModal, ViewPolicyModal, AccessRequestModal,
│                            UserAccessDrawer, PolicyFilePicker
│
├── lib/
│   ├── exportAgentPdf.ts    Agent report → PDF
│   ├── exportIntentPdf.ts   Intent report → PDF
│   ├── exportListPdf.ts     Agents/Apps list → PDF
│   └── format.ts            timeAgo, fmtRuntime, initials
│
└── pages/
    ├── LockedPage.tsx       Public landing + sign-in / register / forgot-password
    ├── LoginPage.tsx        Standalone login screen
    ├── HomePage.tsx         Dashboard overview
    ├── IntentsPage.tsx      Intent list
    ├── IntentDetailPage.tsx Intent detail
    ├── AgentsToolsPage.tsx  Agents & Apps list
    ├── AgentDetailPage.tsx  Agent detail
    ├── ToolDetailPage.tsx   App/tool detail
    ├── UserDetailPage.tsx   User detail
    ├── RequestsPage.tsx     Requests + Users tabs
    ├── ProfilePage.tsx      Profile, API key, token usage, password
    ├── requests/UsersTab.tsx
    └── flow/                FlowPage, FlowCanvas, flowData (graph builders)
```

---

## Routes & pages

| Path | Page | Auth | What it shows |
|---|---|---|---|
| `/` | `LockedPage` | public | Landing + auth (sign-in, register, OTP, forgot password), public global stats |
| `/login` | `LoginPage` | public | Standalone sign-in |
| `/dashboard` | `HomePage` | ✅ | KPI tiles, 30-day interaction volume chart, top agents/apps, interactions & threats ledger, CSV export |
| `/intents` | `IntentsPage` | ✅ | Paginated intent list |
| `/intents/:intentId` | `IntentDetailPage` | ✅ | Intent header + tiles, tabs: **Interactions**, **Agents & Apps**; PDF export |
| `/agents` | `AgentsToolsPage` | ✅ | Top-agents/top-apps cards + tabbed **Agents** / **Apps** tables; deploy + access request modals |
| `/agents/:agentId` | `AgentDetailPage` | ✅ | Agent header, policy viewer, tabs: **Interactions**, **Intents**, **Policy History**; PDF export |
| `/tools/:toolId` | `ToolDetailPage` | ✅ | App/tool stats, tabs: **Interactions**, **Intents** (`:toolId` may be a name or a DID) |
| `/users/:userId` | `UserDetailPage` | ✅ | User stats, tabs: **Interactions**, **Intents**, **Threats**, **Agents Deployed** |
| `/graph`, `/graph/:intentId` | `FlowPage` | ✅ | Animated intent flow graph + step rail + `TraceInspector` |
| `/requests` | `RequestsPage` | ✅ | Tabs: **Creation requests**, **Org access requests**, **My access requests**, **Users** (admin) |
| `/interactions` | `InteractionsPage` | ✅ | Full paginated interaction ledger |
| `/profile` | `ProfilePage` | ✅ | Profile, org, API key (mask/reveal/copy), token usage, edit name/email, change password |
| `*` | → `/dashboard` | ✅ | Fallback redirect |

Authenticated routes are nested under `<ProtectedRoute><App /></ProtectedRoute>`; `App` renders the
sidebar, topbar (breadcrumb + debounced global search), the `<Outlet />`, and the global `Drawer`.

---

## Data layer

**`useAsync`** (in `src/data/hooks.ts`) is the single async primitive: it tracks
`{ data, loading, error, refetch }`, cancels stale responses, and re-runs on dependency change.
Every `useX` hook is a one-liner on top of it. There is no request cache — remounting a page refetches.

**Contexts that prefetch on login:**

- `DirectoryProvider` walks *every page* of `/agents-list`, `/tools-list`, and `/users-list` once and
  builds a `Map<DID, { name, kind }>` so tables can render real names instead of raw DIDs.
- `IntentNumbersProvider` walks every page of `/intent-list` and assigns each intent a stable
  sequential number (oldest = #1) so the UI can say "Intent #3" instead of showing a hash.

**Notable derived data:** intent participant counts and agent/tool splits are computed client-side by
walking every page of that intent's interactions (`fetchIntentParticipants`, `fetchIntent`), because the
backend does not expose them directly.

---

## API surface

All dashboard endpoints are relative to `VITE_API_BASE_URL` and return `{ status, data, message }`,
which `apiRequest` unwraps to `data`. Admin auth uses `VITE_ADMIN_API_BASE_URL`.

### Auth & account

| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| POST | `/login` | – | User sign-in → token, did, org, api_key, is_admin |
| POST | `/login` *(admin base)* | – | Admin sign-in → raw JWT string |
| POST | `/register-user` | – | Self-service user registration (needs OTP) |
| POST | `/create-admin` | – | Admin registration |
| POST | `/register-admin` | – | Whitelist the admin DID in the middleware |
| POST | `/send-otp` | – | Email an OTP before registration |
| POST | `/forgot-password` | – | Email a password-reset OTP |
| POST | `/reset-password` | – | Reset password with OTP |
| GET | `/user-profile` | ✅ | Profile for a normal user |
| GET | `/admin-profile` | ✅ | Profile + org counters for an admin |
| PATCH | `/update-profile` | ✅ | Update name / email |
| POST | `/change-password` | ✅ | Change password |
| POST | `/generate-api-key`, `/revoke-api-key` | ✅ | API key lifecycle |
| GET | `/token-usage` | ✅ | Token quota usage |

### Metrics

| Method | Endpoint | Used by |
|---|---|---|
| GET | `/global-stats` | Public landing stats (no auth) |
| GET | `/home-metrics?page=` | Home KPI tiles + agent summary list |
| GET | `/agents-apps-metrics` | Top agents / top apps cards, avg reliability |
| GET | `/interactions/series?range=24h\|7d\|30d` | Volume chart (falls back to empty on error) |

### Lists

| Method | Endpoint | Used by |
|---|---|---|
| GET | `/agents-list?page=` | Agents table, directory |
| GET | `/tools-list?page=` | Apps table, directory |
| GET | `/intent-list?page=` | Intents table, intent numbering |
| GET | `/interactions-list?page=[&intentID=]` | Interactions ledger, threats, intent interactions |
| GET | `/users-list?page=` | Users tab, directory |
| GET | `/search?q=` | Topbar global search (agents / apps / intents) |

### Detail

| Method | Endpoint | Used by |
|---|---|---|
| GET | `/agent-info?agentDID=` | Agent detail |
| GET | `/agent-interactions?agentDID=&page=` | Agent → Interactions tab |
| GET | `/agent-intents?agentDID=&page=` | Agent → Intents tab |
| GET | `/tool-info?toolDID=\|name=&interactionsPage=&intentsPage=` | App detail (both tabs in one call) |
| GET | `/user-info?userID=&interactionsPage=&intentsPage=&threatsPage=&agentsPage=` | User detail (all four tabs in one call) |
| GET | `/intent-info?intentID=` | Intent header |
| GET | `/intent-diagram?intentID=` | Flow graph (preferred source — real messages + tree structure) |
| GET | `/intent-block-data?intent_id=` | Block chain fallback for the trace inspector |

### Policy

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/agent-policy-history?agentDID=` | Policy update history |
| GET | `/agent-policy-update?agentDID=&updateID=` | Full policy text for one update |
| GET | `/user-policy?userDID=` | User policy file |
| POST | `/upload-agent-policy` | multipart `agentDID` + `file` |
| POST | `/upload-user-policy` | multipart `userDID` + `file` |

### Requests & user administration

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/agents-creation-requests-list?page=` | Admin: all creation requests in the org |
| GET | `/agents-creation-requests-list-user?page=` | User: own creation requests |
| POST | `/agents-creation-requests-create` | multipart `agentName`, `agentID?`, `requestInfo?`, `policy` |
| POST | `/agents-creation-requests-edit` | Edit a pending creation request |
| POST | `/agent-creation-request-result-submit` | Admin approve / reject |
| GET | `/agent-access-requests-list-org?page=` | Admin: org access requests |
| GET | `/agent-access-requests-list-user?page=` | User: own access requests |
| POST | `/agent-access-request-create` | User asks for access to an agent |
| POST | `/agent-access-request-submit` | Admin approve / reject |
| POST | `/create-user` | Admin creates an org user |

> Endpoints marked *proposed* in `src/api/users.ts` (`/user-access-list`,
> `/admin-grant-agent-access`, `/admin-revoke-agent-access`) are wired in the client but may not
> exist on every backend build.

---

## Authentication

- Two login paths: **user** (`/login` on the dashboard API, returns a full payload) and
  **admin** (`/login` on the admin API, returns a raw JWT string).
- The JWT is stored in `localStorage` under `agentdna.token`; the decoded user under `agentdna.user`.
- `AuthContext` decodes the JWT, treats `exp` as authoritative, and polls every 30s to sign the user
  out the moment the token expires.
- `apiRequest` attaches `Authorization: Bearer <token>` and routes 401s through a registered
  unauthorized handler (opt-in per request via `skipLogoutOn401`).
- `ProtectedRoute` redirects unauthenticated users to `/` and non-admins away from admin-only routes.
- Admin-only UI (Requests approvals, Users tab, Add User) is gated on `user.is_admin`.

---

## Local development

```bash
npm install
npm run dev        # Vite dev server, default port 4009 (override with VITE_PORT)
npm run build      # tsc -b && vite build → dist/
npm run preview    # serve the production build locally
npm run lint       # eslint
```

Create a `.env` from `.env.sample` before starting:

```bash
cp .env.sample .env
```

---

## Environment variables

| Variable | Required | Description | Example |
|---|---|---|---|
| `VITE_API_BASE_URL` | Yes | Base URL of the dashboard middleware API | `http://your-backend-ip:9000/dashboard/v1/` |
| `VITE_ADMIN_API_BASE_URL` | Yes | Base URL of the agent-admin API | `http://your-backend-ip:8001/agent-admin/v1` |
| `VITE_DUMMY` | No | `true` runs entirely on mock data, no backend needed | `false` |
| `VITE_PORT` | No | Dev-server port (default `4009`) | `8989` |
| `VITE_DEV_TOKEN` | No | Fallback bearer token used when `localStorage` has none — dev only | – |

At runtime the app reads `window.__ENV__.VITE_API_BASE_URL` first and falls back to the build-time
`import.meta.env` value, which is what makes the Docker image configurable without a rebuild.

---

## Docker

All commands run from the **project root** (`agentdna-dashboard/`).

### Build the image

```bash
docker build -t agentdna-dashboard -f docker/Dockerfile .
```

Multi-stage: `node:22-alpine` builds with `npm ci && npx vite build`, then `dist/` is copied into
`nginx:1.27-alpine` with SPA fallback (`try_files $uri $uri/ /index.html`), gzip, and 1-year
immutable caching for hashed assets.

### Run the container

Pass environment variables at runtime with `-e`:

```bash
docker run -p 80:80 \
  -e VITE_API_BASE_URL=http://your-backend-ip:9000/dashboard/v1/ \
  -e VITE_ADMIN_API_BASE_URL=http://your-backend-ip:8001/agent-admin/v1 \
  -e VITE_DUMMY=false \
  agentdna-dashboard
```

The app will be available at `http://localhost`. Map to a different host port if needed
(e.g. `-p 3000:80`).

> **Note for Mac/Windows:** If the backend runs on the same machine as Docker, use
> `host.docker.internal` instead of `localhost` as the IP. On Linux, use the host's LAN IP address.

### How runtime env vars work

Environment variables are injected at container startup — you build the image once and configure it
at runtime. There is no need to rebuild the image to change the backend URL.

`docker/entrypoint.sh` generates `/usr/share/nginx/html/env-config.js` from the env vars you pass at
`docker run` time:

```js
window.__ENV__ = {
  VITE_API_BASE_URL: "…",
  VITE_ADMIN_API_BASE_URL: "…",
  VITE_DUMMY: "false"
};
```

`index.html` loads that file before the bundle, so `src/api/client.ts` picks the values up before any
API call is made.

---

## Dummy / demo mode

Set `VITE_DUMMY=true` to run the whole dashboard with no backend. `src/api/client.ts` short-circuits
every request through `src/data/dummyRouter.ts`, which serves paginated slices of
`src/data/dummy.json` and logs each intercepted call as `[DUMMY <METHOD> <path>]`. Auth is stubbed
with a fixed demo user, and the volume chart is generated from the seeded interaction timestamps plus
a deterministic baseline so the chart is never flat.
