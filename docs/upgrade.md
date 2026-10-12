# Upgrade the shared core safely

The canonical reusable code is the set of paths and SHA-256 digests in `CORE_RELEASE.json`: browser models/renderer, shared schemas and the ledger shell. The surrounding adapters, private `profile/`, hosting identity, database, policy, snapshots, workspace and schedules are outside that update boundary.

For an existing private deployment, download and review a new pristine release in a different directory. Run its tests and `npm run check:release`. Then run the updater from the pristine release:

```sh
node scripts/sync-core.mjs --target /absolute/path/to/private-deployment
```

The default is a dry run. It verifies every source digest, rejects symlinks/path traversal and checks the target against its previous release manifest. If no previous manifest exists, adoption is allowed only when every current core file is already identical. A locally modified core file blocks the update; merge it deliberately and revalidate instead of forcing replacement. No force flag is provided.

After reviewing the dry run and backing up the private deployment, apply the exact same release:

```sh
node scripts/sync-core.mjs --target /absolute/path/to/private-deployment --apply
```

Only canonical core files and the release manifest are written. No database operation, import, policy write, dependency installation or publication is performed. Test the private profile and adapters against the updated core, compare saved revisions and financial reconciliation, inspect desktop/mobile views, and privately publish using the supported Sites flow. Changes outside the core, schema migrations and dependencies need their own review; do not copy the entire new template over a personalized deployment.

A failed update may leave some core files replaced; the prior files are copied to a private local backup directory reported by the updater before any replacement. Restore from that backup before retrying. Never upload that backup to the public repository. A scheduled data refresh must not apply code updates automatically.

## Wire an existing private build to upstream

This is **versioned vendoring**, not a runtime download or `main` dependency. The private build serves only the reviewed files recorded in the release manifest. There is no automatic updater. Maintaining a pin and a build-time check makes those files an explicit upstream dependency rather than an independently edited copy.

After reviewing a specific published Git commit and its full file manifest:

1. Obtain that exact commit in a clean source directory; verify the remote and `git rev-parse HEAD`. Do not execute code from an unreviewed commit. Compute the SHA-256 of `CORE_RELEASE.json` and compare it with the review receipt.
2. Run `sync-core.mjs --target PRIVATE_DIRECTORY --expected-manifest-sha REVIEWED_SHA256` for a dry run, then the same command with `--apply`. Existing matching files can adopt the manifest without a behavior change.
3. Copy the reviewed generic `scripts/core-release.mjs` and `scripts/verify-core-pin.mjs` into the private build. Add a **private** `CORE_UPSTREAM.json` with `schemaVersion: 1`, `repository` (reviewed GitHub URL without credentials), `commit` (full 40-character reviewed commit), `version` and `manifestSha256`. This record contains no financial data and must not be generated from a floating branch.
4. Chain `node scripts/verify-core-pin.mjs` before the private build command. It verifies the pinned manifest, every core file and the exact core path set. A changed or extra core file fails the build; configuration in `profile/` remains independent.
5. Run that private instance's compatibility, classification, window, receipt/override and reconciliation tests. Compare effective metrics with the currently deployed version. With no intended behavior change, source/policy/workspace revisions, digests and derived output must match. Privately publish through the supported Sites source helper only after those checks, and verify the existing URL and anonymous denial.

Updates repeat this explicit procedure with a newly reviewed commit. Never fetch or execute latest code inside a request handler or a scheduled refresh. A private instance may keep application-specific adapters and preferences while sharing exactly the same versioned canonical core.
