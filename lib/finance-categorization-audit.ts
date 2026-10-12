import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { workspaces } from "@/db/schema";
import { decodeWorkspace, workspaceSchema } from "./workspace-schema";
import type {z} from "zod";
import seed from "../profile/empty-workspace.json";
import { canonicalJson } from "./finance-snapshot-schema";

// Read-only inspection for the authenticated owner's native MCP connection.
// No transaction IDs, dates, merchants/amounts from individual rows, or notes
// are returned. Exact-merchant rule definitions and category budgets are included.
export async function readCategorizationState(userId:string) {
  const [row]=await getDb().select().from(workspaces).where(eq(workspaces.userId,userId));
  return summarizeCategorizationState(row);
}

// A derived, read-only summary for the existing owner-private Site service path.
// User-scoped workspace read/write routes retain their signed-in identity checks.
// Never select an arbitrary user's record if this Site gains multiple workspaces.
export async function readPrivateCategorizationSummary() {
  const rows=await getDb().select().from(workspaces).limit(2);
  if(rows.length!==1)return {workspaceExists:false,message:"A unique owner workspace is unavailable. Use the signed-in categorization tool."};
  return summarizeCategorizationState(rows[0]);
}

async function summarizeCategorizationState(row:typeof workspaces.$inferSelect|undefined) {
  if(!row)return {workspaceExists:false,revision:null,updatedAt:null,message:"This signed-in Site identity has no saved editable workspace. No row was initialized or changed."};
  const w=workspaceSchema.parse(await decodeWorkspace(row.data));
  const sourceById=new Map((seed.transactions as z.infer<typeof workspaceSchema>['transactions']).map(t=>[t.id,t]));
  const seedCategories=new Map(seed.categories.map(c=>[c.id,c]));
  const categoryName=(id:string)=>w.categories.find(c=>c.id===id)?.name??id;
  const overrides=w.overrides as Record<string,Record<string,unknown>>;
  const fields:Record<string,number>={};
  for(const override of Object.values(overrides))for(const key of Object.keys(override))fields[key]=(fields[key]||0)+1;
  let splitOrders=0,splitParts=0,modifiedBaseRecords=0;
  const splitCategories=new Set<string>();
  for(const t of w.transactions){
    const initial=sourceById.get(t.id);
    if(initial&&canonicalJson(t)!==canonicalJson(initial))modifiedBaseRecords++;
    const parts=(overrides[t.id]?.splits??t.splits) as Array<{category:string}>;
    if(parts?.length){splitOrders++;splitParts+=parts.length;parts.forEach(p=>splitCategories.add(categoryName(p.category)));}
  }
  const rules=w.rules as Array<{merchant:string;category:string;subcategory:string}>;
  return {
    workspaceExists:true,revision:row.revision,updatedAt:row.updatedAt,
    scope:"Site-only editing state. This is not a Finances memory update or proof of user confirmation for seeded assumptions.",
    categories:w.categories.map(c=>({id:c.id,name:c.name,budgeted:c.budgeted,annualCents:c.annualCents,note:c.note,changedFromInitial:{name:c.name!==seedCategories.get(c.id)?.name,budget:c.annualCents!==seedCategories.get(c.id)?.annualCents,note:c.note!==seedCategories.get(c.id)?.note}})),
    merchantRules:rules.map(r=>({merchant:r.merchant,categoryId:r.category,categoryName:categoryName(r.category),subcategory:r.subcategory,scope:"exact case-sensitive merchant; category/subcategory only"})),
    perTransactionOverrides:{count:Object.keys(overrides).length,fieldCounts:fields},
    splits:{orderCount:splitOrders,partCount:splitParts,categories:[...splitCategories]},
    baseRecords:{count:w.transactions.length,modifiedFromInitialCount:modifiedBaseRecords,addedSinceInitialCount:w.transactions.filter(t=>!sourceById.has(t.id)).length},
    budgetHistoryCount:w.budgetHistory.length,auditEventCount:w.audit.length,
    precedence:["Base editable-ledger classification","Latest matching exact-merchant rule overrides category/subcategory","Per-transaction override fields win over the merchant rule","Explicit split parts determine allocation category/treatment when present; parent category does not replace split-part categories"],
    refreshBehavior:"Weekly source writes do not modify this workspace. The effective view admits new source IDs and applies separate owner policy, saved merchant rules, item edits and splits to rows and charts consistently. Raw source snapshots are unchanged; invalid splits remain retained and flagged. Read /api/finance/policy for the current policy; these counts describe only saved workspace edits.",
  };
}
