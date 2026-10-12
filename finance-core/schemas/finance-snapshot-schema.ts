import { z } from "zod";
import { nativeSnapshotSchema, nativeView, type NativeSnapshot } from "./finance-native-schema.ts";

const text = z.string().max(2000);
const id = z.string().min(1).max(120).regex(/^[a-zA-Z0-9_.:-]+$/);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s => !Number.isNaN(Date.parse(s)) && new Date(s).toISOString().slice(0,10) === s);
const time = z.string().datetime({ offset: true });
const cents = z.number().int().safe().min(-1e13).max(1e13);
const count = z.number().int().min(0).max(1_000_000);
const status = z.enum(["available", "partial", "unavailable"]);
const amount = z.object({label: text.min(1), amountCents: cents.nullable()}).strict();
export const financeSnapshotSchema = z.object({
  schemaVersion: z.literal(1),
  snapshotId: id,
  collectedAt: time,
  sourceAsOf: time.nullable(),
  currency: z.literal("USD"),
  coverage: z.object({
    status: z.enum(["complete", "partial", "unknown"]),
    from: date.nullable(), to: date.nullable(),
    linkedAccounts: count.nullable(), queriedAccounts: count.nullable(),
    providerFreshness: text,
    issues: z.array(text).max(100),
  }).strict(),
  spending: z.object({
    status, periodStart: date.nullable(), periodEnd: date.nullable(),
    totalCents: cents.nullable(), transactionCount: count.nullable(),
    byCategory: z.array(amount).max(200),
    monthly: z.array(z.object({month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/), amountCents: cents.nullable(), complete: z.boolean()}).strict()).max(240),
    methodology: text,
  }).strict(),
  portfolio: z.object({
    status, asOf: time.nullable(), totalValueCents: cents.nullable(),
    cashValueCents: cents.nullable(), holdingsCount: count.nullable(),
    allocation: z.array(amount).max(100),
    holdings: z.array(z.object({symbol: text, name: text, valueCents: cents.nullable()}).strict()).max(500),
    notes: z.array(text).max(100),
  }).strict(),
  notes: z.array(text).max(100),
}).strict().superRefine((s, ctx) => {
  const error = (message: string) => ctx.addIssue({code:"custom",message});
  if (Date.parse(s.collectedAt) > Date.now() + 5 * 60_000) error("Collection time cannot be in the future.");
  if (s.sourceAsOf && Date.parse(s.sourceAsOf) > Date.parse(s.collectedAt) + 5 * 60_000) error("Source time cannot be after collection.");
  if (s.portfolio.asOf && Date.parse(s.portfolio.asOf) > Date.parse(s.collectedAt) + 5 * 60_000) error("Portfolio time cannot be after collection.");
  if (s.coverage.from && s.coverage.to && s.coverage.from > s.coverage.to) error("Invalid coverage window.");
  if (s.spending.periodStart && s.spending.periodEnd && s.spending.periodStart > s.spending.periodEnd) error("Invalid spending period.");
  if (s.coverage.linkedAccounts !== null && s.coverage.queriedAccounts !== null && s.coverage.queriedAccounts > s.coverage.linkedAccounts) error("Queried account count exceeds linked count.");
  if (s.spending.status === "unavailable" && (s.spending.totalCents !== null || s.spending.transactionCount !== null || s.spending.byCategory.length || s.spending.monthly.length)) error("Unavailable spending must use null amounts and empty arrays.");
  if (s.portfolio.status === "unavailable" && (s.portfolio.totalValueCents !== null || s.portfolio.cashValueCents !== null || s.portfolio.holdingsCount !== null || s.portfolio.allocation.length || s.portfolio.holdings.length)) error("Unavailable portfolio must use null values and empty arrays.");
  if (s.spending.status !== "unavailable" && (!s.spending.periodStart || !s.spending.periodEnd)) error("Available spending needs a reporting period.");
  for (const rows of [s.spending.byCategory, s.portfolio.allocation]) if (new Set(rows.map(r => r.label)).size !== rows.length) error("Duplicate aggregate labels.");
  if (new Set(s.spending.monthly.map(r => r.month)).size !== s.spending.monthly.length) error("Duplicate spending months.");
});
// Keep validation and read projection on the same injected application schema.
export function createSnapshotAdapter<T extends z.ZodType<NativeSnapshot>>(nativeSchema:T){return {
 snapshotWriteSchema:z.object({expectedRevision:z.number().int().nonnegative(),snapshot:z.union([financeSnapshotSchema,nativeSchema])}).strict(),
 snapshotView:(s:unknown)=>{const parsed=nativeSchema.safeParse(s);return parsed.success?nativeView(parsed.data):financeSnapshotSchema.parse(s);},
};}
export const {snapshotWriteSchema,snapshotView}=createSnapshotAdapter(nativeSnapshotSchema);
export type FinanceSnapshot = z.infer<typeof financeSnapshotSchema>;

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  return `{${Object.entries(value as Record<string, unknown>).sort(([a],[b]) => a.localeCompare(b)).map(([k,v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`;
}

