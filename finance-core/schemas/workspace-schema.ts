import { z } from "zod";
const text=z.string().max(20000);
const id=z.string().min(1).max(200).regex(/^[a-zA-Z0-9_:-]+$/);
const cents=z.number().int().safe().min(-1e13).max(1e13);
const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s=>!Number.isNaN(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s);
const treatment=z.enum(["ongoing","one_time","discontinued","transfer","tax","outside","income","unassessed","unresolved"]);
const split=z.object({id,label:text,category:id,subcategory:text,amountCents:cents,treatment});
const override=z.object({label:text.optional(),category:id.optional(),subcategory:text.optional(),treatment:treatment.optional(),note:text.optional(),reviewed:z.boolean().optional(),review:z.array(text).max(100).optional(),splits:z.array(split).max(100).optional(),splitBasisCents:cents.optional()});
const category=z.object({id,name:text.min(1),annualCents:cents.nonnegative(),note:text,budgeted:z.boolean()});
const transaction=z.object({id,date,amountCents:cents,merchant:text,description:text,account:text,category:id,subcategory:text,treatment,label:text,note:text,review:z.array(text).max(100),evidence:text,sourceCategory:text,sourceDetail:text,sourceConfidence:text,linkedTransfer:z.boolean(),source:text,splits:z.array(split).max(100)});
export const workspaceSchema=z.object({schemaVersion:z.literal(1),workspaceId:id,meta:z.object({title:text,currency:z.literal("USD"),asOf:date,queriedAt:text,coverageStart:date,coverageEnd:date,baselineStart:date,baselineEnd:date,sourceFreshness:text,coverageComplete:z.boolean(),sourceFile:text,sourceSha256:text,sourceCount:z.number().int().nonnegative(),accounts:z.array(text).max(1000),limitations:z.array(text).max(100)}),categories:z.array(category).min(1).max(200),transactions:z.array(transaction).max(30000),overrides:z.record(id,override),sourceCategoryMappings:z.record(id,id).optional(),budgetGroupOverrides:z.record(id,cents.nonnegative()).optional(),categoryNameOverrides:z.record(id,text).optional(),rules:z.array(z.object({id,merchant:text,category:id,subcategory:text,createdAt:z.string().datetime({offset:true}).optional()})).max(10000),audit:z.array(z.object({at:text,message:text,detail:text})).max(1000),budgetHistory:z.array(z.unknown()).max(10000),importHistory:z.array(z.object({at:text,source:text,added:z.number().int().nonnegative(),updated:z.number().int().nonnegative(),conflicts:z.number().int().nonnegative().optional()})).max(10000),housingPlan:z.array(z.object({label:text,annualCents:cents,kind:text})).max(100)}).superRefine((w,ctx)=>{
 const cats=new Set(w.categories.map(c=>c.id)); const txs=new Map(w.transactions.map(t=>[t.id,t]));
 const error=(message:string)=>ctx.addIssue({code:"custom",message});
 if(cats.size!==w.categories.length||txs.size!==w.transactions.length)error("Duplicate category or transaction ID.");
 const checkSplits=(parts:z.infer<typeof split>[],amount:number)=>{
  if(parts.length&&parts.reduce((s,p)=>s+p.amountCents,0)!==amount)error("Split allocations must match the original charge.");
  if(parts.some(p=>!cats.has(p.category)||(p.amountCents!==0&&Math.sign(p.amountCents)!==Math.sign(amount))))error("Invalid split category or sign.");
 };
 for(const t of w.transactions){if(!cats.has(t.category))error("Unknown transaction category.");checkSplits(t.splits,t.amountCents);}
 for(const [key,o] of Object.entries(w.overrides)){const t=txs.get(key);if(!t){error("Override refers to a missing transaction.");continue;}if(o.category&&!cats.has(o.category))error("Unknown override category.");checkSplits(o.splits||[],o.splitBasisCents??t.amountCents);}
 if(w.sourceCategoryMappings&&Object.values(w.sourceCategoryMappings).some(id=>!cats.has(id)))error("Unknown source category mapping.");
 if(w.rules.some(r=>!cats.has(r.category)))error("Unknown rule category.");
 if(w.meta.coverageStart>w.meta.coverageEnd||w.meta.baselineStart>w.meta.baselineEnd||w.meta.asOf<w.meta.coverageEnd)error("Invalid coverage dates.");
});
export async function encodeWorkspace(value:unknown){
 const gzip=new Blob([JSON.stringify(value)]).stream().pipeThrough(new CompressionStream("gzip"));
 const bytes=new Uint8Array(await new Response(gzip).arrayBuffer());
 let binary="";for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
 const result=btoa(binary);if(result.length>1_800_000)throw new Error("Workspace storage limit reached. Export a backup before importing more records.");return result;
}
export async function decodeWorkspace(value:string){
 const bytes=Uint8Array.from(atob(value),c=>c.charCodeAt(0));
 return JSON.parse(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"))).text());
}
