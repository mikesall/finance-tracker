import { z } from "zod";
import { desc } from "drizzle-orm";
import { getDb } from "@/db";
import { reportingPolicies } from "@/db/schema";
import { canonicalJson } from "./finance-snapshot-schema";
import { SnapshotError } from "./finance-snapshots";
import { stampPolicyPrecedence } from "./finance-policy-precedence";
export {reportingPolicySchema} from "../finance-core/schemas/finance-reporting-policy-schema.ts";
import {reportingPolicySchema} from "../finance-core/schemas/finance-reporting-policy-schema.ts";
export async function readReportingPolicy(){const [row]=await getDb().select().from(reportingPolicies).orderBy(desc(reportingPolicies.revision)).limit(1);return row?{revision:row.revision,digest:row.digest,createdAt:row.createdAt,policy:JSON.parse(row.data)}:{revision:0,digest:null,createdAt:null,policy:null};}
export async function writeReportingPolicy(body:unknown){
 const envelope=z.object({expectedRevision:z.number().int().nonnegative(),policy:reportingPolicySchema}).strict().safeParse(body);
 if(!envelope.success)throw new SnapshotError(envelope.error.issues[0]?.message||"Invalid reporting policy.");
 const {expectedRevision}=envelope.data,current=await readReportingPolicy(),createdAt=new Date().toISOString();
 const policy=stampPolicyPrecedence(current.policy,envelope.data.policy,createdAt),data=canonicalJson(policy);
 const digest=[...new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(data)))].map(b=>b.toString(16).padStart(2,"0")).join("");
 if(current.digest===digest)return {...current,idempotent:true};
 if(current.revision!==expectedRevision)throw new SnapshotError("Reporting policy changed. Read its current revision before writing.",409);
 const revision=current.revision+1;
 const rows=await getDb().insert(reportingPolicies).values({revision,data,digest,createdAt}).onConflictDoNothing().returning({revision:reportingPolicies.revision});
 if(!rows.length)throw new SnapshotError("Concurrent reporting policy update. Read the policy before retrying.",409);
 return {revision,digest,createdAt,policy,idempotent:false};
}
