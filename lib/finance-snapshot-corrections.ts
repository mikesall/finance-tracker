import {canonicalJson} from '../finance-core/schemas/finance-snapshot-schema.ts';
import {financeSnapshotCorrectionSchema} from '../finance-core/schemas/finance-native-schema.ts';
import type {z} from 'zod';
export type SnapshotCorrection=z.infer<typeof financeSnapshotCorrectionSchema>;
export function withSnapshotCorrection<T extends {metadata:object}>(snapshot:T,expectedRevision:number,correction:SnapshotCorrection){
 return {...snapshot,metadata:{...snapshot.metadata,correction:{...correction,baseRevision:expectedRevision}}};
}
// This narrow path corrects interpretation/value transcription of an existing
// collection. New source scope, dates or freshness require an ordinary refresh.
export function correctionCollectionFacts(s:any){
 const pick=(value:any,keys:string[])=>Object.fromEntries(keys.map(k=>[k,value?.[k]??null]));
 const rows=(values:any[],key:string,keys:string[])=>values.map(r=>({id:r[key],...pick(r,keys)})).sort((a,b)=>String(a.id).localeCompare(String(b.id)));
 return {
  metadata:pick(s.metadata,['retrievedAt','sourceAsOf','sourceFreshness','period','reportingWindow','browsingWindow','sourceAdditions','reusedAccountHoldingsSnapshot','transactionCoverage','transactionPagesComplete','holdingsPagesComplete']),
  inventoryCollectedAt:s.metadata.inventory?.collectedAt??null,
  inventoryCollections:rows(s.metadata.inventory?.collections||[],'name',['status','returnedCount']),
  inventory:rows(s.metadata.inventory?.expected||[],'ref',['collection','entityId','valuationDate','sourceAsOf']),
  accounts:rows(s.accounts||[],'id',['balanceDate','sourceReportedUpdatedAt','balanceAge','coverage']),
  manualBalances:rows(s.portfolio?.manualBalances||[],'id',['valuationDate','sourceAsOf','collectedAt']),
  holdings:rows(s.portfolio?.holdings||[],'id',['accountId','priceAsOf']),
  transactions:rows(s.transactions||[],'id',['accountId','date','sourceRecord']),
 };
}
export function validateCorrectionCollection(previous:any,next:any){
 if(canonicalJson(correctionCollectionFacts(previous))!==canonicalJson(correctionCollectionFacts(next)))throw Error('A same-collection correction must preserve source scope, collection/provider dates and freshness. Use a real new source query for a refresh.');
}
