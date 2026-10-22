# DevFlow

A focused task manager for developers — personal tasks, shared workspaces, daily journal,
and analytics, with real-time sync and a keyboard-first interface.

**Live:** [devflow-todo.vercel.app](https://devflow-todo.vercel.app)

## Features

### Tasks
- Quick-add with natural-language parsing: `Ship release #work tomorrow high`
- Projects, priorities, tags, due dates and times, subtasks, and notes
- Inline editing, instant search, and status/priority/project filters
- One-click completion and delete with undo toasts
- Command palette (`Ctrl/Cmd + K`) and shortcuts (`/` search, `N` new task)

### Workspaces (collaboration)
- Create a shared workspace and invite teammates with a 10-character code
- Roles: owner, admin, member, viewer (viewers are read-only)
- Role-based permissions enforced server-side
- Rename, regenerate invite codes, remove members, leave, or delete a workspace
- Tasks and projects are scoped per workspace; personal items stay private
- Real-time updates for every member through Convex subscriptions

### Dashboard
- Active, completed, overdue, and current-streak stats
- Last 7 days completion bar chart and 30-day activity heatmap
- Active-task breakdown by priority

### Journal
- Daily entries with mood tracking and per-day navigation
- Search across entries and best-effort autosave when changing days

### Focus mode
- 25-minute Pomodoro timer that can be attached to a task

### Data ownership
- Export all visible tasks and projects as JSON
- Import a JSON backup into the active workspace
- Copy the current dataset to the clipboard

## Tech stack

| Layer | Choice |
| --- | --- |
| UI | React 19, Vite 8 (Rolldown), Tailwind CSS v4 |
| Animation | framer-motion |
| Icons | lucide-react |
| Routing | react-router-dom v7 |
| Auth | Clerk (`@clerk/react`) |
| Backend | Convex (queries, mutations, real-time sync) |
| Hosting | Vercel (static SPA + Clerk proxy rewrite) |

## Architecture

```text
Browser (React SPA)
  │
  ├── Clerk session ──► JWT template "convex" ──► Convex auth
  │
  └── Convex client ──► queries / mutations ──► Convex deployment
                                                │
                                                ├── per-user authz
                                                └── workspace role checks

Vercel
  └── static assets (dist/) served as an SPA
```

- Every Convex query and mutation resolves the Clerk identity server-side.
- Unauthenticated reads return empty results; unauthenticated writes throw.
- Workspace reads require membership; writes require a non-viewer role.
- Personal data is never visible to workspace members, and workspace data is never
  visible outside the workspace.

## Data model

| Table | Purpose | Key indexes |
| --- | --- | --- |
| `users` | Clerk profile mirror | `by_clerkId` |
| `projects` | Personal and workspace projects | `by_user`, `by_workspace` |
| `tasks` | Tasks with tags, subtasks, notes, due dates | `by_user`, `by_workspace`, `by_user_project` |
| `journal` | One entry per user per day | `by_user_date` |
| `activityLog` | Task lifecycle events for analytics | `by_user_time`, `by_user_action` |
| `workspaces` | Shared workspace metadata and invite code | `by_owner`, `by_inviteCode` |
| `workspaceMembers` | Membership and role per workspace | `by_workspace`, `by_user`, `by_workspace_user` |

## Getting started

### Prerequisites

- Node.js 20+ (22 recommended)
- A [Convex](https://convex.dev) account
- A [Clerk](https://clerk.com) application

### 1. Install

```bash
git clone https://github.com/iftakharH/devflow.git
cd devflow
npm install
```

### 2. Configure environment

Copy `.env.example` to `.env.local` and fill in the values:

| Variable | Where | Purpose |
| --- | --- | --- |
| `VITE_CONVEX_URL` | `.env.local` | Convex deployment URL |
| `VITE_CLERK_PUBLISHABLE_KEY` | `.env.local` | Clerk publishable key |
| `CLERK_FRONTEND_API_URL` | Convex environment | Clerk issuer domain for JWT validation |

For local Convex development, `npx convex dev` writes `CONVEX_DEPLOYMENT` to `.env.local`
automatically.

Set the Convex-side variable once:

```bash
# Development deployment
npx convex env set CLERK_FRONTEND_API_URL https://your-instance.clerk.accounts.dev

# Production deployment
npx convex env set CLERK_FRONTEND_API_URL https://your-instance.clerk.accounts.dev --prod
```

### 3. Configure Clerk

1. In the Clerk dashboard, open **JWT templates** and create a template named `convex`.
2. Keep the default claims and set the **Application ID** (`aud`) to `convex`.
3. This must match `applicationID` in `convex/auth.config.ts`.

### 4. Run

```bash
# Terminal 1 — Convex functions and schema
npx convex dev

# Terminal 2 — Vite dev server
npm run dev
```

Open the URL printed by Vite (usually `http://localhost:5173`).

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Run ESLint across the repository |
| `npx convex dev` | Push functions and schema to the dev deployment |
| `npx convex deploy` | Deploy functions and schema to production |

## Deployment

### Backend (Convex)

```bash
npx convex deploy -y
```

Deploys the schema and functions to the production deployment configured for the
project. Add the `CLERK_FRONTEND_API_URL` environment variable in the Convex dashboard
for the production deployment.

### Frontend (Vercel)

```bash
npx vercel --prod --yes
```

Required Vercel environment variables:

- `VITE_CONVEX_URL`
- `VITE_CLERK_PUBLISHABLE_KEY`

`vercel.json` serves the SPA for all non-asset routes. If you configure a Clerk proxy
URL, add a rewrite for that path in `vercel.json`.

### Production Clerk checklist

Clerk development instances are rate-limited, use `pk_test` keys, and log a browser
warning. A Clerk production instance requires a domain you control — a
`*.vercel.app` domain cannot host one because Clerk needs DNS records.

1. Own a domain you can add DNS records to.
2. In Clerk, create a production instance, add `clerk.yourdomain.com`, and publish the
   CNAME records Clerk provides.
3. In the production instance, create the JWT template `convex` with application ID
   `convex`. Templates are per instance, so the development template does not carry over.
4. In Vercel production environment variables, set:
   - `VITE_CLERK_PUBLISHABLE_KEY` to the production `pk_live_...` key
   - `CLERK_FRONTEND_API_URL` to the production frontend API URL
5. In the Convex production deployment, set `CLERK_FRONTEND_API_URL` to the same value.
6. Redeploy Convex and Vercel, then sign in to verify.

`convex/auth.config.ts` reads `CLERK_FRONTEND_API_URL` and fails the deploy when it is
missing, so a production deployment cannot silently fall back to a development instance.

## Project structure

```text
convex/
  authz.ts          Workspace membership and role checks
  schema.ts         Tables, validators, and indexes
  tasks.ts          Task queries and mutations with workspace scoping
  projects.ts       Project queries and mutations with workspace scoping
  journal.ts        Daily journal entries
  workspace.ts      Workspace lifecycle, invites, and membership
  users.ts          Clerk user synchronization
  seed.ts           Default personal projects on first run
src/
  App.jsx           Application shell, views, and UI components
  main.jsx          Clerk and Convex providers
  index.css         Tailwind entry and global styles
  pages/            Landing, sign-in, and sign-up routes
```

## Security notes

- Authorization is enforced in Convex functions, never only in the UI.
- Workspace mutation access requires owner, admin, or member; viewers are read-only.
- Only owners can delete a workspace; owners must transfer or delete rather than leave.
- Invite codes are single-purpose join tokens; regenerate them if leaked.
- Never commit `.env.local` or deployment secrets.

## Quality checks

```bash
npm run lint
npm run build
```

CI runs both on every push and pull request via GitHub Actions.
