import { z } from "zod";

const text=z.string().max(4000),id=z.string().min(1).max(200).regex(/^[a-zA-Z0-9_:-]+$/);
const cents=z.number().int().safe();
const treatment=z.enum(["ongoing","one_time","discontinued","transfer","tax","outside","income","unassessed","unresolved"]);
const pattern=z.string().max(500).refine(s=>{try{new RegExp(s,"i");return true;}catch{return false;}});
const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s=>!Number.isNaN(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s);
const split=z.object({id,label:text,category:id,subcategory:text,amountCents:cents,treatment}).strict();

// Receipt allocations belong to exact payments, never all future merchant rows.
export const financePolicyRuleSchema=z.object({
 id,sourceKeys:z.array(text.min(1)).min(1).max(100).optional(),label:text.min(1).optional(),
 effectiveAt:z.string().datetime({offset:true}).optional(),
 merchantPattern:pattern.optional(),accountPattern:pattern.optional(),detailPattern:pattern.optional(),
 direction:z.enum(["any","outflow","inflow"]),amountCents:cents.optional(),onDate:date.optional(),
 category:id,subcategory:text,treatment:treatment.optional(),note:text,priority:z.number().int(),
 scope:z.enum(["merchant","unidentified_only","identified_detail"]),fromDate:date.optional(),
 status:z.literal("refund_pending").optional(),
 resolvedSourceWarning:z.object({pattern,replacement:text}).strict().optional(),
 splits:z.array(split).min(1).max(100).optional(),
}).strict().superRefine((rule,ctx)=>{
 if(!rule.splits)return;
 const fail=(message:string)=>ctx.addIssue({code:"custom",message});
 if(!rule.sourceKeys?.length||rule.amountCents===undefined||!rule.onDate)fail("Receipt splits require exact source keys, date and payment amount.");
 if(new Set(rule.splits.map(p=>p.id)).size!==rule.splits.length)fail("Receipt split IDs must be unique.");
 if(rule.splits.reduce((sum,p)=>sum+p.amountCents,0)!==rule.amountCents)fail("Receipt splits must sum to the original payment.");
 if(rule.splits.some(p=>p.amountCents!==0&&Math.sign(p.amountCents)!==Math.sign(rule.amountCents??0)))fail("Receipt split signs must match the payment.");
});
