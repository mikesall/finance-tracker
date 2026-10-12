import { readSnapshot, writeSnapshot, restoreSnapshot } from "@/lib/finance-snapshots";
import { json, readBody, failure } from "@/lib/finance-http";
export const dynamic="force-dynamic";
// Sites dispatch enforces owner-only access for both authenticated visitors and
// its supported service bearer. That bearer intentionally has no visitor identity.
export async function GET(req:Request){try{return json(await readSnapshot(new URL(req.url).searchParams.get("digest")||undefined));}catch(e){return failure(e);}}
export async function PUT(req:Request){try{return json(await writeSnapshot(await readBody(req)));}catch(e){return failure(e);}}

export async function POST(req:Request){try{return json(await restoreSnapshot(await readBody(req)));}catch(e){return failure(e);}}
