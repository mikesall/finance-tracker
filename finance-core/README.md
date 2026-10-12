# Reusable finance dashboard core

This is the reusable USD ledger and presentation core. It contains no owner's source snapshot, initial workspace, bank identity, budget amounts, merchant decisions or credentials. The surrounding template deploys one private Site per owner; the backend is not a multiuser service.

- Browser-compatible pure models and renderer: `public/finance-core/`.
- Validation and serialization: `finance-core/schemas/` (Zod).
- Shared HTML/CSS design: `finance-core/ui/ledger-shell.html`. The title is a template token.
- Synthetic fixtures and default tests: `tests/fixtures/` and `tests/*.test.mjs`.
- Minimal runnable example: `node finance-core/examples/basic.mjs`.

Provide an explicit `globalThis.FinanceProfile` before loading the models. Its presentation settings are `title`, `timezone`, optional `timezoneLabel`, `categorySlugs`, `spendingColorOrder`, `assetColorOrder`, `familyClasses` and `familyDefinitions`. Omitting settings does not import an owner's preferences. Calendar bars use a validated named profile timezone; missing or invalid runtime configuration falls back to UTC. Snapshot reporting/browsing schemas accept valid named timezones and reject invalid values. Unknown asset families stay unknown. Finite member allocation targets are summed for every family; an application may explicitly leave particular families unassigned with `familyTargetPolicy.unassignedFamilyIds`.

Optional classification hooks are `allowClassificationRule({rule,base,saved,policy,context})` (only an explicit `false` vetoes an otherwise matching rule), `prepareClassification({w,n,policy,matches})`, `customizeClassification({policy,base,saved,o,policyPatch,preserved,policyNotes,appliedRules,matches,context})`, and `classificationDiagnostics(rows,context)`. The hook supplies a policy patch before the existing direct-item and split precedence logic. Source and saved inputs remain immutable. Hooks are application code, never interpreted transaction text.

Read/write adapters, owner authentication and durable storage are outside this core. Each private deployment's profile owns presentation choices. Versioned live policy, source snapshots and workspace remain in private storage. Updating the core does not migrate or replace them.

Core releases include only the paths in `CORE_RELEASE.json`. Do not export a personalized deployment, hosting identity, database contents, local `.env` files or private audit evidence. See `docs/upgrade.md` for the safe update procedure.

`nativeSnapshotSchema` uses neutral planning fields with optional `extensions` keyed by application namespace. `createNativeSnapshotSchema(customPlanningSchema)` supports private compatibility adapters without changing existing stored records or imposing legacy fields on other profiles.
