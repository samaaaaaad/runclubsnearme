# RunClubsNearMe (Post-MCP Baseline)

This repository is now treated as a Supabase MCP-era codebase.

Goal: evolve from a dynamic run-club directory into a management tool with auth, club-owner dashboards, and runner discovery flows.

## Current Architecture

- Frontend: Next.js App Router (TypeScript)
- Auth/data client: Supabase JS in `src/lib/supabase.ts`
- Route protection: `src/middleware.ts`
- MCP configuration: `.vscode/mcp.json`

## Source Of Truth (Important)

- Supabase MCP server config is defined in `.vscode/mcp.json`.
- App runtime keys come from local environment variables only.
- Do not hardcode keys in source files.
- Do not expose service role keys to browser code.

## Required Environment Variables

Create a local `.env.local` file with:

```env
NEXT_PUBLIC_SUPABASE_URL=your_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

Only use anon/public keys with client-side code.

## Local Development

Install and run:

```bash
npm install
npm run dev
```

App runs at `http://localhost:3000`.

## Auth and Protected Routes

- Login/signup UI: `src/app/auth/page.tsx`
- Protected areas: `/dashboard/*`, `/discover/*`
- Guarding logic: `src/middleware.ts`

If you change auth behavior, update middleware and auth page together to avoid redirect loops.

## MCP Workflow

Use Supabase MCP for schema-safe and project-safe operations.

Recommended pattern:

1. Make schema/table policy changes via MCP.
2. Reflect resulting app logic in code.
3. Run lint/tests after each unit of change.

## Cleanup Guardrails

To avoid pre-MCP drift reappearing:

- Keep `.env.local` local-only.
- Keep `.vscode/mcp.json` as the single MCP config file.
- Avoid duplicate Supabase client factories unless required.
- Avoid mixing old auth experiments with current flow.

## Reset To Clean Working State

When local runtime state is odd:

1. Stop dev server.
2. Delete `.next` build cache.
3. Restart with `npm run dev`.

## Branching Discipline

Use small commits for each auth/data change so rollback is easy.

Suggested commit sequence:

1. `chore: baseline post-mcp docs`
2. `feat: auth flow`
3. `feat: dashboard management actions`
