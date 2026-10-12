CREATE TABLE `finance_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`data` text NOT NULL,
	`snapshot_id` text NOT NULL,
	`digest` text NOT NULL,
	`revision` integer NOT NULL,
	`collected_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `finance_reporting_policies` (
	`revision` integer PRIMARY KEY NOT NULL,
	`data` text NOT NULL,
	`digest` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `spending_workspaces` (
	`user_id` text PRIMARY KEY NOT NULL,
	`data` text NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`updated_at` text NOT NULL
);
