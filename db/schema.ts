import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
export const workspaces = sqliteTable("spending_workspaces", {
  userId: text("user_id").primaryKey(),
  data: text("data").notNull(),
  revision: integer("revision").notNull().default(0),
  updatedAt: text("updated_at").notNull(),
});
// Separate from the editable ledger: a scheduled refresh cannot replace user edits.
export const financeSnapshots = sqliteTable("finance_snapshots", {
  id: text("id").primaryKey(),
  data: text("data").notNull(),
  snapshotId: text("snapshot_id").notNull(),
  digest: text("digest").notNull(),
  revision: integer("revision").notNull(),
  collectedAt: text("collected_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});
// Immutable versions of confirmed reporting instructions.
// Source refreshes cannot replace or alter this policy history.
export const reportingPolicies = sqliteTable("finance_reporting_policies", {
  revision: integer("revision").primaryKey(),
  data: text("data").notNull(),
  digest: text("digest").notNull(),
  createdAt: text("created_at").notNull(),
});

