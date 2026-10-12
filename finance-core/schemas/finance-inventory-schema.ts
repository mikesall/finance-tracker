import {z} from 'zod';

const id=z.string().min(1).max(200).regex(/^[a-zA-Z0-9_:-]+$/),text=z.string().min(1).max(4000);
const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s=>!Number.isNaN(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s);
const timestamp=z.string().datetime({offset:true});
export const inventoryCollections=['linked_accounts','manual_accounts','assets','liabilities'] as const;
const collection=z.enum(inventoryCollections);
// Expected records are enumerated from source responses BEFORE import selection.
// entityId represents verified underlying identity, never a label/value heuristic.
export const financeInventorySchema=z.object({
 collectedAt:timestamp,
 collections:z.array(z.object({name:collection,status:z.enum(['complete','unavailable','not_authorized']),returnedCount:z.number().int().nonnegative().max(10000).nullable(),basis:text}).strict()).length(4),
 expected:z.array(z.object({ref:id,collection,entityId:id,kind:z.enum(['asset','liability']),nature:z.enum(['balance','alternative_valuation','redemption_claim']),value:z.number().finite().min(-1e11).max(1e11).nullable(),currency:z.literal('USD'),valuationDate:date.nullable(),sourceAsOf:timestamp.nullable(),status:z.enum(['confirmed','estimate','unverified']),basis:text,identityBasis:text}).strict()).max(10000),
 dispositions:z.array(z.object({ref:id,disposition:z.enum(['included','duplicate','alternative_valuation','unresolved','excluded']),targetType:z.enum(['linked_account','manual_balance']).nullable(),targetId:id.nullable(),reason:text}).strict()).max(10000),
}).strict();

type InventorySnapshot={metadata?:{inventory?:unknown;retrievedAt?:string};accounts?:Array<{id:string;netBalance:number|null;balanceDate?:string|null;currency:string}>;portfolio?:{manualBalances?:Array<{id:string;value:number|null;kind:string;status:string;currency:string;valuationDate?:string|null;sourceAsOf?:string|null;collectedAt?:string|null;linkedAccountId?:string}>}};
type InclusionPolicy={portfolioReporting?:{netWorth?:{manualBalanceIds?:string[]}}}|null;
export function reconcileFinanceInventory(snapshot:InventorySnapshot,policy?:InclusionPolicy){
 const parsed=financeInventorySchema.safeParse(snapshot.metadata?.inventory);
 if(!parsed.success)return {ok:false,coverageComplete:false,issues:['Missing or invalid source inventory. Enumerate every returned item before import.'],expectedRecords:0,includedEntities:0,unresolvedEntities:0,excludedEntities:0};
 const inventory=parsed.data,issues:string[]=[];
 const fail=(message:string)=>{if(!issues.includes(message))issues.push(message);};
 const expected=new Map(inventory.expected.map(e=>[e.ref,e])),decisions=new Map(inventory.dispositions.map(d=>[d.ref,d]));
 if(expected.size!==inventory.expected.length)fail('Duplicate expected inventory reference.');
 if(decisions.size!==inventory.dispositions.length)fail('Duplicate inventory disposition.');
 if(expected.size!==decisions.size||[...expected.keys()].some(ref=>!decisions.has(ref))||[...decisions.keys()].some(ref=>!expected.has(ref)))fail('Every expected inventory record needs exactly one disposition; unexpected dispositions are invalid.');
 if(new Set(inventory.collections.map(c=>c.name)).size!==inventoryCollections.length)fail('Every source collection needs a distinct coverage disposition.');
 for(const c of inventory.collections){const count=inventory.expected.filter(e=>e.collection===c.name).length;if(c.status==='complete'?c.returnedCount!==count:c.returnedCount!==null||count!==0)fail('Returned source inventory counts do not reconcile.');}
 const collected=Date.parse(inventory.collectedAt),retrieved=Date.parse(snapshot.metadata?.retrievedAt||'');
 if(!Number.isFinite(retrieved)||collected>retrieved)fail('Inventory collection time cannot be after snapshot collection.');
 const targets=new Map<string,any>();
 for(const account of snapshot.accounts||[])targets.set('linked_account:'+account.id,account);
 for(const balance of snapshot.portfolio?.manualBalances||[])targets.set('manual_balance:'+balance.id,balance);
 const included=new Map<string,typeof inventory.dispositions[number]>(),includedTargets=new Set<string>();
 for(const e of inventory.expected){
  if(e.value!==null&&(e.kind==='asset'?e.value<0:e.value>0))fail('Inventory values must retain asset/liability signs.');
  if(e.valuationDate&&e.valuationDate>inventory.collectedAt.slice(0,10)||e.sourceAsOf&&Date.parse(e.sourceAsOf)>collected)fail('Inventory valuation/source dates cannot be after collection.');
  const d=decisions.get(e.ref);if(!d)continue;
  if((d.targetType===null)!==(d.targetId===null))fail('Inventory targets need both type and identity.');
  if(d.disposition!=='included')continue;
  if(e.nature!=='balance')fail('Alternative valuations and redemption claims are not additional balances.');
  if(included.has(e.entityId))fail('The same underlying entity was included more than once.');
  included.set(e.entityId,d);
  const key=d.targetType+':'+d.targetId,target=targets.get(key);
  if(includedTargets.has(key))fail('One imported balance cannot represent two distinct entities.');
  includedTargets.add(key);
  if(!target){fail('Included inventory item is missing from imported balances.');continue;}
  const value=d.targetType==='linked_account'?target.netBalance:target.value,valuationDate=d.targetType==='linked_account'?target.balanceDate:target.valuationDate;
  if(value!==e.value||target.currency!==e.currency||(valuationDate??null)!==e.valuationDate)fail('Imported value, currency or valuation date differs from selected evidence.');
  if(d.targetType==='manual_balance'){
   if(target.linkedAccountId&&(snapshot.accounts||[]).some(a=>a.id===target.linkedAccountId))fail('A manual reference to an imported linked account must be reconciled as duplicate evidence.');
   if(target.kind!==e.kind||target.status!==e.status||(target.sourceAsOf??null)!==e.sourceAsOf)fail('Manual balance must preserve evidence kind, status and source date.');
   if(target.collectedAt!==inventory.collectedAt)fail('Manual balance must retain its actual collection instant.');
   if(policy!==undefined&&!policy?.portfolioReporting?.netWorth?.manualBalanceIds?.includes(target.id))fail('An included manual balance is missing from the explicit net-worth selection.');
  }
 }
 for(const e of inventory.expected){const d=decisions.get(e.ref);if(!d)continue;
  const canonical=included.get(e.entityId);
  if(d.disposition==='duplicate'||d.disposition==='alternative_valuation'){
   if(!canonical||canonical.ref===d.ref||d.targetType!==canonical.targetType||d.targetId!==canonical.targetId)fail('Duplicate/alternative evidence must reference the same included underlying entity.');
   if(canonical&&expected.get(canonical.ref)?.kind!==e.kind)fail('Duplicate/alternative evidence must retain the underlying asset/liability kind.');
   if(e.nature==='redemption_claim')fail('A redemption claim needs an explicit unresolved/excluded disposition, not an added or duplicated balance.');
  }else if(d.disposition==='unresolved'||d.disposition==='excluded'){
   if(d.targetType!==null||d.targetId!==null)fail('Unresolved/excluded evidence cannot add an imported balance.');
  }
 }
 for(const key of targets.keys())if(!includedTargets.has(key))fail('An imported balance has no included source inventory disposition.');
 if(policy!==undefined)for(const id of policy?.portfolioReporting?.netWorth?.manualBalanceIds||[])if(!includedTargets.has('manual_balance:'+id))fail('Net-worth selection references a balance outside included inventory.');
 const unresolved=new Set(inventory.expected.filter(e=>decisions.get(e.ref)?.disposition==='unresolved').map(e=>e.entityId)),excluded=new Set(inventory.expected.filter(e=>decisions.get(e.ref)?.disposition==='excluded').map(e=>e.entityId));
 return {ok:issues.length===0,coverageComplete:issues.length===0&&unresolved.size===0&&inventory.collections.every(c=>c.status==='complete'),issues,expectedRecords:expected.size,includedEntities:included.size,unresolvedEntities:unresolved.size,excludedEntities:excluded.size};
}

// Public-template import gate; legacy private adapters retain their own contract.
export function requireFinanceInventory(snapshot:InventorySnapshot){const result=reconcileFinanceInventory(snapshot);if(!result.ok)throw new Error(result.issues.join(' '));return result;}
