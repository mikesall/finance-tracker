# Release verification

The initial template has passed 171 automated model, schema, renderer and upgrade tests, TypeScript checking, the Sites production build, and release-boundary checks. All 16 canonical shared files match the existing validated implementation. The template contains an empty profile and newly generated three-table migration; no existing private database or migration history is included.

An isolated local D1 preview passed synthetic tests for:

- Empty state and idempotent workspace initialization.
- Anonymous MCP tool/workspace denial under local mock identity.
- Native snapshot validation, exact readback, identical retry, and stale revision rejection.
- Separate policy/workspace edits preserved after a source refresh.
- Effective summary and runtime asset availability.
- Unknown targets, mandatory proposal/approval provenance, rejected false approval, and a visible provisional-target notice.
- Pinned core adoption, modified-file refusal, path/symlink refusal and preservation of private configuration.
- Exact pinning of the generic icon and disabled request helper, safe adoption of identical existing assets, and coverage of every shell dependency with one intentional private profile adapter.

To reproduce local integration tests, build the template, start its local preview on port 5173, and initialize **only its empty synthetic local database** with the migration:

```sh
node node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_special_manta.sql
node scripts/test-local.mjs --allow-local-synthetic-writes
node scripts/test-proposals-local.mjs --allow-local-synthetic-writes
```

The first script refuses populated source state; the second requires its exact synthetic predecessor. These scripts are hardcoded to loopback and must never be adapted to a live financial deployment. Local mock identity does not validate production Sites access.

Browser access to the candidate's local preview was blocked during preparation, so this candidate's desktop/mobile visual check remains pending. Automated renderer checks passed; the unchanged shared core had earlier desktop/mobile validation. A recipient setup still requires its own authorized browser, anonymous-denial, connection and cloud refresh checks. No second-owner Finances/Site setup or weekly task is claimed by these tests.
