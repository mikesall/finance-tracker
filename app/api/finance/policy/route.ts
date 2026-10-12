import { readReportingPolicy, writeReportingPolicy } from "@/lib/finance-reporting-policy";
import { json, readBody, failure } from "@/lib/finance-http";
export const dynamic="force-dynamic";
// Shared reporting policy for this confirmed owner-private Site. Dispatch
// authenticates browser/service access. It grants no Finances/bank access.
export async function GET(){try{return json(await readReportingPolicy());}catch(e){return failure(e);}}
export async function PUT(req:Request){try{return json(await writeReportingPolicy(await readBody(req)));}catch(e){return failure(e);}}
