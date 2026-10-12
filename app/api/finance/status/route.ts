import { readStatus } from "@/lib/finance-snapshots";
import { json, failure } from "@/lib/finance-http";
export const dynamic="force-dynamic";
export async function GET(){try{return json(await readStatus());}catch(e){return failure(e);}}
