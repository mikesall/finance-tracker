import { z } from "zod";
const text=z.string().max(4000),id=z.string().min(1).max(200).regex(/^[a-zA-Z0-9_:-]+$/);
export const financeReportingGroupsSchema=z.array(z.object({category:id,name:text,sourceSubcategories:z.array(text).max(100),note:text.optional()}).strict()).max(300);
export const financeBudgetComparisonScopeSchema=z.object({excludeUnresolvedTaxes:z.boolean(),excludedSourceKeys:z.array(id).max(30000).refine(ids=>new Set(ids).size===ids.length,'Comparison exclusions must be unique.'),basis:text.min(1)}).strict();
export const financeBudgetProposalSchema=z.object({status:z.literal("proposed"),createdAt:z.string().datetime({offset:true}),authority:text.min(1),comparisonScope:financeBudgetComparisonScopeSchema.optional(),subcategoryGroups:financeReportingGroupsSchema.optional(),categoryBudgets:z.array(z.object({category:id,subcategory:text.nullable(),annualCents:z.number().int().nonnegative(),basis:text}).strict()).max(300),notes:z.array(text).max(100)}).strict();
