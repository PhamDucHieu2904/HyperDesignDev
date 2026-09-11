# Hyper D content database

This directory is the source of truth for the D1 schema and the local portfolio seed.

## Files

- `migrations/0001_initial.sql` creates the category, media, draft, immutable revision, public projection, asset-reference and audit tables.
- `seeds/portfolio-seed.json` is a readable manifest generated from `app/portfolio/data.ts` and the current local media files.
- `seeds/portfolio-seed.sql` is the idempotent SQL seed applied after the migration.

Do not edit either generated seed file directly. Update the current portfolio source or the generator, then run:

```powershell
npm run db:seed
```

Verify the schema and seed together with:

```powershell
npm run db:verify
npm run test:contracts
```

The seed deliberately uses stable legacy project IDs and deterministic media IDs. Re-running it inserts missing seed rows but does not overwrite a project whose draft version or update timestamp has changed in the admin.

## Migration policy

- Treat applied migration files as immutable; add a numbered migration for every later schema change.
- Apply migrations to local/staging before production.
- Keep draft JSON separate from immutable published revisions.
- Use `UPDATE ... WHERE draft_version = ?` for saves and return a conflict when no row changes.
- Populate `revision_assets` and `draft_assets` inside the same transaction that saves or publishes content.
- Never delete a media object before its database row is no longer referenced.
