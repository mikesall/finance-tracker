import {z} from 'zod';
// Planning evidence only: these records never establish an approved budget.
export const financeRecurringCostSchema=z.object({
 id:z.string().min(1).max(200).regex(/^[a-zA-Z0-9_:-]+$/),label:z.string().min(1).max(4000),
 amountCents:z.number().int().safe().nonnegative().max(1e13),currency:z.literal('USD'),
 cadence:z.enum(['weekly','monthly','quarterly','annual']),status:z.enum(['estimate','confirmed']),
 category:z.string().min(1).max(200).optional(),subcategory:z.string().max(4000).optional(),basis:z.string().min(1).max(4000),
}).strict();
export const financeRecurringCostsSchema=z.array(financeRecurringCostSchema).max(100).refine(rows=>new Set(rows.map(r=>r.id)).size===rows.length,'Recurring cost IDs must be unique.');
