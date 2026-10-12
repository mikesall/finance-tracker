import "@/profile/runtime.js";
import "@/public/finance-core/effective-ledger.js";
import "@/public/finance-core/read-only-model.js";
import "@/public/finance-core/portfolio-model.js";
import {reconcileFinanceInventory} from "../finance-core/schemas/finance-inventory-schema.ts";
import {eq} from "drizzle-orm";
import {getDb} from "@/db";
import {workspaces} from "@/db/schema";
import {decodeWorkspace} from "./workspace-schema";
import {readSnapshot} from "./finance-snapshots";
import {readReportingPolicy} from "./finance-reporting-policy";
import seed from "../profile/empty-workspace.json";
export async function readEffectiveSummary(userId?:string){
 const rows=userId?await getDb().select().from(workspaces).where(eq(workspaces.userId,userId)):await getDb().select().from(workspaces).limit(2);
 if(rows.length!==1)return {available:false,reason:"A unique owner workspace is unavailable. Open the private dashboard once."};
 const workspace=await decodeWorkspace(rows[0].data),source=await readSnapshot(),policy=await readReportingPolicy();
 if(!source.snapshot)return {available:false,reason:"No financial snapshot imported.",sourceRevision:source.revision,workspaceRevision:rows[0].revision,policyRevision:policy.revision};
 const E=globalThis.EffectiveLedger,M=globalThis.FinanceReadModel,P=globalThis.PortfolioModel;
 const model=(E.build as (...args:any[])=>any)(workspace,source.snapshot,new Map(),seed,policy.policy),p=(M.project as (...args:any[])=>any)(model,workspace,source,policy.policy),pf=(P.build as (...args:any[])=>any)(source.snapshot,policy.policy);
 return {available:true,inventoryVerification:reconcileFinanceInventory(source.snapshot as any,policy.policy),sourceRevision:source.revision,sourceDigest:source.digest,workspaceRevision:rows[0].revision,policyRevision:policy.revision,policyDigest:policy.digest,displayMetrics:p.metrics,reportingWindow:p.reportingWindow,periods:['3M','6M','12M'].map(period=>M.categoryBudgetPeriod(p,period)),calendarChart:M.calendarChart(p,new Set(p.chartCategories.map((c:any)=>c.id))),transactionReconciliation:M.reconciliation(p),portfolio:pf,rawSourcePreserved:true};
}
