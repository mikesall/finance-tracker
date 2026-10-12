import { z } from "zod";
import {withSnapshotCorrection,validateCorrectionCollection} from "./finance-snapshot-corrections";
import {nativeSnapshotSchema} from "./finance-native-schema";
import {requireFinanceInventory} from "../finance-core/schemas/finance-inventory-schema.ts";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { financeSnapshots } from "@/db/schema";
import { encodeWorkspace, decodeWorkspace } from "./workspace-schema";
import { canonicalJson, snapshotWriteSchema, snapshotView } from "./finance-snapshot-schema";

export class SnapshotError extends Error { constructor(message: string, public status = 400) { super(message); } }
export async function readSnapshot(historyDigest?:string) {
  if(historyDigest&&!/^[a-f0-9]{64}$/.test(historyDigest))throw new SnapshotError("Invalid snapshot digest.");
  const [row] = await getDb().select().from(financeSnapshots).where(eq(financeSnapshots.id, historyDigest?"history:"+historyDigest:"current"));
  if(!row)return {revision:0,digest:null,updatedAt:null,snapshot:null,view:null};
  const snapshot=row.data.startsWith("gz:")?await decodeWorkspace(row.data.slice(3)):JSON.parse(row.data);
  return {revision:row.revision,digest:row.digest,updatedAt:row.updatedAt,snapshot,view:snapshotView(snapshot)};
}
export async function readStatus() {
  const {view:snapshot, snapshot:raw, ...meta} = await readSnapshot();
  return {...meta, snapshotId:snapshot?.snapshotId ?? null, collectedAt:snapshot?.collectedAt ?? null, sourceAsOf:snapshot?.sourceAsOf ?? null, coverageStatus:snapshot?.coverage.status ?? "unknown", spendingStatus:snapshot?.spending.status ?? "unavailable", portfolioStatus:snapshot?.portfolio.status ?? "unavailable"};
}
export async function writeSnapshot(input: unknown) {
  const parsed = snapshotWriteSchema.safeParse(input);
  if (!parsed.success) throw new SnapshotError(parsed.error.issues.map(x=>`${x.path.join(".")}: ${x.message}`).slice(0,5).join("; "));
  const {expectedRevision,correction} = parsed.data;
  const amended=correction?withSnapshotCorrection(parsed.data.snapshot,expectedRevision,correction):parsed.data.snapshot;
  const valid=nativeSnapshotSchema.safeParse(amended);
  if(!valid.success)throw new SnapshotError("Invalid correction provenance or snapshot.");
  const snapshot=valid.data;
  try{requireFinanceInventory(snapshot as any);}catch(e){throw new SnapshotError(e instanceof Error?e.message:"Source inventory reconciliation failed.");}
  const view=snapshotView(snapshot);
  const data = canonicalJson(snapshot);
  if (new TextEncoder().encode(data).length > 5_000_000) throw new SnapshotError("Snapshot exceeds 5 MB.",413);
  const digest = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(data))),x=>x.toString(16).padStart(2,"0")).join("");
  const current = await readSnapshot();
  if (current.digest === digest) return {...await readStatus(),idempotent:true};
  if (current.revision !== expectedRevision) throw new SnapshotError("Revision conflict. Read the current snapshot before retrying.",409);
  if(correction){
    if(!current.snapshot||current.digest!==correction.expectedDigest)throw new SnapshotError("Correction base digest conflict. Read the current snapshot before retrying.",409);
    try{validateCorrectionCollection(current.snapshot,snapshot);}catch(e){throw new SnapshotError(e instanceof Error?e.message:"Correction changed source collection facts.");}
  }else{
    if(snapshot.metadata.correction)throw new SnapshotError("New collections must omit prior correction provenance; use the explicit correction option for an existing collection.");
    if(current.view?.snapshotId===view.snapshotId)throw new SnapshotError("Snapshot ID already exists with different content. Use an explicit same-collection correction when justified.",409);
    if(current.view&&Date.parse(view.collectedAt)<=Date.parse(current.view.collectedAt))throw new SnapshotError("Collection time must be newer than the current snapshot.",409);
  }
  const record={id:"current",data:"gz:"+await encodeWorkspace(snapshot),digest,snapshotId:view.snapshotId,revision:expectedRevision+1,collectedAt:view.collectedAt,updatedAt:new Date().toISOString()};
  const db=getDb();
  await archiveCurrentSnapshot(current);
  const rows=expectedRevision===0
    ? await db.insert(financeSnapshots).values(record).onConflictDoNothing().returning({revision:financeSnapshots.revision})
    : await db.update(financeSnapshots).set(record).where(and(eq(financeSnapshots.id,"current"),eq(financeSnapshots.revision,expectedRevision))).returning({revision:financeSnapshots.revision});
  if (!rows.length) throw new SnapshotError("Concurrent refresh detected. Read back before retrying.",409);
  // Never read or write spending_workspaces here. A browser save cannot undo this snapshot.
  return {revision:record.revision,digest,updatedAt:record.updatedAt,snapshotId:view.snapshotId,collectedAt:view.collectedAt,idempotent:false};
}

// Private rollback preserves original collection/source dates. It never invents
// a fresh collection or writes workspace corrections, reporting policy or budgets.
async function archiveCurrentSnapshot(current:Awaited<ReturnType<typeof readSnapshot>>){
 if(!current.snapshot||!current.digest||!current.view)return;
 await getDb().insert(financeSnapshots).values({id:"history:"+current.digest,data:"gz:"+await encodeWorkspace(current.snapshot),snapshotId:current.view.snapshotId,digest:current.digest,revision:current.revision,collectedAt:current.view.collectedAt,updatedAt:current.updatedAt!}).onConflictDoNothing();
}
export async function restoreSnapshot(input:unknown){
 const parsed=z.object({expectedRevision:z.number().int().positive(),restoreDigest:z.string().regex(/^[a-f0-9]{64}$/)}).strict().safeParse(input);
 if(!parsed.success)throw new SnapshotError("Expected current revision and an archived digest are required.");
 const {expectedRevision,restoreDigest}=parsed.data,current=await readSnapshot();
 if(current.digest===restoreDigest)return {...await readStatus(),idempotent:true};
 if(current.revision!==expectedRevision)throw new SnapshotError("Revision conflict. Read the current snapshot before restoring.",409);
 const previous=await readSnapshot(restoreDigest);if(!previous.snapshot||!previous.view)throw new SnapshotError("Requested prior snapshot is not archived.",404);
 const bytes=canonicalJson(previous.snapshot),digest=[...new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(bytes)))].map(b=>b.toString(16).padStart(2,"0")).join("");
 if(digest!==restoreDigest)throw new SnapshotError("Archived snapshot digest verification failed.",409);
 await archiveCurrentSnapshot(current);
 const record={data:"gz:"+await encodeWorkspace(previous.snapshot),snapshotId:previous.view.snapshotId,digest,revision:expectedRevision+1,collectedAt:previous.view.collectedAt,updatedAt:new Date().toISOString()};
 const rows=await getDb().update(financeSnapshots).set(record).where(and(eq(financeSnapshots.id,"current"),eq(financeSnapshots.revision,expectedRevision))).returning({revision:financeSnapshots.revision});
 if(!rows.length)throw new SnapshotError("Concurrent refresh detected; restore was not applied.",409);
 return {...await readStatus(),idempotent:false,restoredFromDigest:restoreDigest};
}
