import {and,eq,sql} from 'drizzle-orm';
import {getDb} from '@/db';
import {financeSnapshots} from '@/db/schema';
import {encodeWorkspace,decodeWorkspace} from './workspace-schema';
import {canonicalJson} from './finance-snapshot-schema';
import {lookbackPeriod,lookbackWriteSchema} from './finance-lookback-schema';
import {readSnapshot,SnapshotError} from './finance-snapshots';
const recordId='chart-lookback';
export async function readLookback(){
 const [row]=await getDb().select().from(financeSnapshots).where(eq(financeSnapshots.id,recordId));
 if(!row)return {revision:0,digest:null,updatedAt:null,lookback:null};
 return {revision:row.revision,digest:row.digest,updatedAt:row.updatedAt,lookback:await decodeWorkspace(row.data.slice(3))};
}
export async function writeLookback(input:unknown){
 const parsed=lookbackWriteSchema.safeParse(input);if(!parsed.success)throw new SnapshotError(parsed.error.issues.map(x=>`${x.path.join('.')}: ${x.message}`).slice(0,5).join('; '));
 const {lookback,expectedRevision,expectedSourceRevision,expectedSourceDigest}=parsed.data;
 const source=await readSnapshot();
 if(source.revision!==expectedSourceRevision||source.digest!==expectedSourceDigest)throw new SnapshotError('Source changed. Read the source and lookback before retrying.',409);
 if(!source.snapshot?.metadata)throw new SnapshotError('A native transaction snapshot is required.');
 const displayStart=new Date(source.snapshot.metadata.period.end.slice(0,7)+'-01T00:00:00Z');displayStart.setUTCMonth(displayStart.getUTCMonth()-11);
 const expected=lookbackPeriod(displayStart.toISOString().slice(0,10));
 if(lookback.period.start!==expected.start||lookback.period.end!==expected.end)throw new SnapshotError('Lookback must cover the two months immediately before the displayed source window.');
 const sourceAccounts=new Set(source.snapshot.accounts.map((a:{id:string})=>a.id));
 if(lookback.coverage.accountIds.some(id=>!sourceAccounts.has(id)))throw new SnapshotError('Lookback account scope differs from current source.');
 const transactionAccounts=new Set<string>(source.snapshot.transactions.map((t:{accountId:string})=>t.accountId));
 if(lookback.coverage.queryComplete&&[...transactionAccounts].some(id=>!lookback.coverage.accountIds.includes(id)))throw new SnapshotError('Complete context must cover every transaction account in the displayed source.');
 const sourceIds=new Set(source.snapshot.transactions.map((t:{id:string})=>t.id));
 if(lookback.transactions.some(t=>sourceIds.has(t.id)))throw new SnapshotError('A context ID overlaps the displayed source. Reconcile the source date before writing.');
 const data=canonicalJson(lookback);if(new TextEncoder().encode(data).length>5_000_000)throw new SnapshotError('Lookback exceeds 5 MB.',413);
 const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(data))),x=>x.toString(16).padStart(2,'0')).join('');
 const current=await readLookback();
 if(current.lookback?.contextId===lookback.contextId){if(current.digest!==digest)throw new SnapshotError('Context ID already exists with different content.',409);return {...current,idempotent:true};}
 if(current.revision!==expectedRevision)throw new SnapshotError('Lookback revision conflict. Read before retrying.',409);
 if(current.lookback&&Date.parse(lookback.collectedAt)<=Date.parse(current.lookback.collectedAt))throw new SnapshotError('Collection timestamp must be newer than stored context.',409);
 const record={id:recordId,data:'gz:'+await encodeWorkspace(lookback),digest,snapshotId:lookback.contextId,revision:expectedRevision+1,collectedAt:lookback.collectedAt,updatedAt:new Date().toISOString()},db=getDb();
 // Check the source and context revisions atomically without mutating the source row.
 const sourceGuard=sql`exists(select 1 from finance_snapshots where id='current' and revision=${expectedSourceRevision} and digest=${expectedSourceDigest})`;
 const rows=expectedRevision===0
  ?await db.all<{revision:number}>(sql`insert into finance_snapshots (id,data,snapshot_id,digest,revision,collected_at,updated_at) select ${record.id},${record.data},${record.snapshotId},${record.digest},${record.revision},${record.collectedAt},${record.updatedAt} where ${sourceGuard} on conflict(id) do nothing returning revision`)
  :await db.update(financeSnapshots).set(record).where(and(eq(financeSnapshots.id,recordId),eq(financeSnapshots.revision,expectedRevision),sourceGuard)).returning({revision:financeSnapshots.revision});
 if(!rows.length)throw new SnapshotError('Source or lookback changed concurrently. Read back before retrying.',409);
 return {revision:record.revision,digest,updatedAt:record.updatedAt,contextId:lookback.contextId,collectedAt:lookback.collectedAt,idempotent:false};
}
