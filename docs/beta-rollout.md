# Beta Rollout Plan

## Goal

Make the app usable by invited third parties without risking existing local sessions.

## Preserve Existing Projects

Before any deployment or database migration, export the current local sessions:

```bash
npm run backup:sessions
```

The command writes a timestamped JSON file under `backups/`. It includes sessions, story drafts, group members, and parsed session snapshots.

Keep the generated backup file outside public hosting if it contains workshop or user data.

## Beta Phases

### Phase 1: Closed Beta

- Deploy a private URL.
- Use a production database instead of local `prisma/dev.db`.
- Require login or an invite-based entry path.
- Confirm sessions survive reloads and browser changes.
- Export backups before and after user tests.

### Phase 2: Workshop Beta

- Create one workshop/session group per team.
- Prepare facilitator access to view group progress.
- Export all data immediately after the workshop.
- Avoid changing the AP schema during the workshop window.

### Phase 3: Public-ish Beta

- Add clear data deletion and export flows.
- Add privacy policy and usage notes.
- Add basic monitoring for failed saves and AI errors.

## Database Strategy

Current local development uses SQLite through `DATABASE_URL="file:./dev.db"`.

For multi-user beta use, move to a hosted database such as Supabase Postgres or another managed Postgres service. Do not point beta users at the local SQLite database.

Recommended migration order:

1. Backup local sessions.
2. Create hosted database.
3. Apply Prisma schema/migrations.
4. Import selected backup data if needed.
5. Deploy with production environment variables.
6. Run a small save/reload test with two accounts.

## Environment Variables

Use `.env.example` as the template. Never deploy the local `.env` file directly.

Required variables:

- `DATABASE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `OPENAI_API_KEY`
- `OPENAI_MODEL`

## Acceptance Checklist

- A new user can log in or enter via the agreed invite flow.
- A user can create a session.
- A user can reload the page and keep their session data.
- A second user does not see private sessions from the first user.
- Admin/facilitator can export backup data.
- `npm run build` passes before deployment.
