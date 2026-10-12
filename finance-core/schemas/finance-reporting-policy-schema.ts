import {z} from 'zod';
import {financePolicyRuleSchema} from './finance-policy-rule-schema.ts';
import {financeAllocationMappingsSchema} from './finance-allocation-mapping-schema.ts';
import {financeBudgetProposalSchema,financeReportingGroupsSchema} from './finance-budget-policy-schema.ts';
import {financeRecurringCostsSchema} from './finance-recurring-cost-schema.ts';
const text=z.string().max(4000),id=z.string().min(1).max(200).regex(/^[a-zA-Z0-9_:-]+$/);
const pattern=z.string().max(500).refine(s=>{try{new RegExp(s,"i");return true;}catch{return false;}});
export const reportingPolicySchema=z.object({
 policyId:id,issuedAt:z.string().datetime({offset:true}),authority:text.min(1),
 accountPresentationMetadata:z.array(z.object({accountId:z.string().regex(/^acct_[a-f0-9]{24}$/),sourceLabel:text,sourceInstitution:text,institution:text.min(1),name:text.min(1),mask:z.string().regex(/^\d{4}$/).nullable(),verifiedAt:z.string().datetime({offset:true}),authority:text.min(1)}).strict()).max(1000).refine(rows=>new Set(rows.map(r=>r.accountId)).size===rows.length,"Account presentation identities must be unique.").optional(),
 incomeTaxTreatment:z.enum(['exclude','include']).optional(),
 spendingExclusions:z.object({categoryIds:z.array(id).max(50),authority:text.min(1),reason:text.min(1),confirmedAt:z.string().datetime({offset:true})}).strict().optional(),
 clarifications:z.array(z.object({id,status:z.enum(["open","resolved"]),question:text.min(1),context:text,sourceKeys:z.array(text).max(100),createdAt:z.string().datetime({offset:true}),resolvedAt:z.string().datetime({offset:true}).nullable(),answer:text.nullable()}).strict()).max(200).optional(),
 portfolioReporting:z.object({
  composition:z.object({scope:z.enum(['all_assets','investments_and_cash']),basis:text.min(1)}).strict().optional(),
  balanceClassifications:z.array(z.object({source:z.enum(['linked','manual']),balanceId:id,assetClassId:id,basis:text.min(1)}).strict()).max(1000).optional(),
  families:z.array(z.object({id,label:text.min(1),basis:text.min(1)}).strict()).max(50).optional(),
  taxonomy:z.array(z.object({id,label:text,familyId:id.optional(),targetPercent:z.number().min(0).max(100).nullable()}).strict()).min(1).max(50),
  targetProvenance:z.object({compositionScope:z.enum(['all_assets','investments_and_cash']).optional(),status:z.enum(["proposed","approved"]),authority:text.min(1),basis:text.min(1),createdAt:z.string().datetime({offset:true}),approvedAt:z.string().datetime({offset:true}).nullable(),assumptions:z.object({horizon:text.min(1),liquidityNeeds:text.min(1),riskTolerance:text.min(1),confirmedByOwner:z.boolean()}).strict(),evidenceUrls:z.array(z.string().url()).max(20)}).strict().optional(),
  classifications:z.array(z.object({symbol:text.min(1),currency:z.literal("USD"),assetClassId:id,basis:text.min(1)}).strict()).max(500),
  holdingClassifications:z.array(z.object({holdingId:id,sourceName:text,assetClassId:id,basis:text.min(1),verifiedAt:z.string().datetime({offset:true}),evidenceUrls:z.array(z.string().url()).max(20),displayName:text.min(1).optional(),displaySymbol:z.string().regex(/^[A-Z][A-Z0-9.-]{0,19}$/).nullable().optional(),identityAuthority:text.min(1).optional(),identityConfirmedAt:z.string().datetime({offset:true}).optional()}).strict().refine(c=>(c.displayName===undefined&&c.displaySymbol===undefined)||Boolean(c.identityAuthority&&c.identityConfirmedAt),"Display identity needs explicit owner authority and confirmation time.")).max(2000).optional(),
  cashAssetClassId:id,
  netWorth:z.object({manualBalanceIds:z.array(id).max(100).refine(ids=>new Set(ids).size===ids.length,"Manual inclusion IDs must be unique."),basis:text.min(1)}).strict().optional(),
  authority:text.min(1),verifiedAt:z.string().datetime({offset:true}),notes:z.array(text).max(100),
 }).strict().superRefine((p,ctx)=>{
  const ids=new Set(p.taxonomy.map(c=>c.id));
  const targets=p.taxonomy.filter(c=>c.targetPercent!==null);
  if((p.balanceClassifications||[]).some(c=>!ids.has(c.assetClassId))||new Set((p.balanceClassifications||[]).map(c=>c.source+':'+c.balanceId)).size!==(p.balanceClassifications||[]).length)ctx.addIssue({code:'custom',message:'Balance classifications require unique source/balance identities and known taxonomy classes.'});
  const standardFamilies=new Set(['equity','debt','real_assets','cash','mixed_multi_asset','unclassified']),custom=p.families||[];
  if(new Set(custom.map(f=>f.id)).size!==custom.length||custom.some(f=>standardFamilies.has(f.id)))ctx.addIssue({code:'custom',message:'Custom families must have unique nonstandard IDs, a label and evidence basis.'});
  if(p.taxonomy.some(c=>c.familyId&&!standardFamilies.has(c.familyId)&&!custom.some(f=>f.id===c.familyId)))ctx.addIssue({code:'custom',message:'Unknown portfolio family; custom groups require a labeled, justified family definition.'});

  if(ids.size!==p.taxonomy.length||(targets.length>0&&Math.abs(targets.reduce((s,c)=>s+c.targetPercent!,0)-100)>.0001))ctx.addIssue({code:"custom",message:"Asset classes must be unique. Leave every target null when no target proposal or approval exists; supplied targets must total 100%."});
  if(targets.length&&!p.targetProvenance)ctx.addIssue({code:"custom",message:"Supplied targets require proposed-versus-approved provenance and explicit assumptions."});
  if(p.targetProvenance?.status==='approved'&&!p.targetProvenance.approvedAt)ctx.addIssue({code:"custom",message:"Approved targets require an actual approval timestamp and authority."});
  if(p.targetProvenance?.status==='proposed'&&p.targetProvenance.approvedAt)ctx.addIssue({code:"custom",message:"Proposed targets must not claim owner approval."});
  if(!ids.has(p.cashAssetClassId)||p.classifications.some(c=>!ids.has(c.assetClassId))||(p.holdingClassifications||[]).some(c=>!ids.has(c.assetClassId)))ctx.addIssue({code:"custom",message:"Unknown portfolio asset class."});
  if(new Set((p.holdingClassifications||[]).map(c=>c.holdingId)).size!==(p.holdingClassifications||[]).length)ctx.addIssue({code:'custom',message:'Duplicate holding-specific classification.'});
  if(new Set(p.classifications.map(c=>c.symbol.trim().toUpperCase()+"|"+c.currency)).size!==p.classifications.length)ctx.addIssue({code:"custom",message:"Ambiguous security classification."});
 }).optional(),
 budgetProposal:financeBudgetProposalSchema.optional(),
 reportingSubcategoryGroups:financeReportingGroupsSchema.optional(),
 historicalBudgetProposals:z.array(z.object({archivedAt:z.string().datetime({offset:true}),reason:text.min(1),proposal:financeBudgetProposalSchema}).strict()).max(20).optional(),
 approvedBudgets:z.array(z.object({category:id,subcategory:text.nullable(),annualCents:z.number().int().nonnegative(),status:z.literal("approved"),authority:text,approvedAt:z.string().datetime({offset:true})}).strict()).max(300).optional(),
 budgetMethodology:z.object({period:z.object({start:text,end:text,months:z.number().int().positive()}).strict(),method:text,sourceLibraryFileId:text,sourceSha256:text,previousAnnualCents:z.number().int(),annualCents:z.number().int(),sourceRows:z.number().int(),bridge:z.record(z.number().finite()),notes:z.array(text).max(100),evidence:z.array(z.object({reference:text,summary:text}).strict()).max(50)}).strict().optional(),
 displayReplacements:z.array(z.object({pattern,replacement:text}).strict()).max(50).optional(),
 categoryNames:z.record(id,text),categoryAliases:z.record(id,id),
 allocationMappings:financeAllocationMappingsSchema.optional(),
 rules:z.array(financePolicyRuleSchema).max(200),
 recurringCosts:financeRecurringCostsSchema.optional(),
 unclassifiedCategoryIds:z.array(id).max(200).optional(),
 notes:z.array(text).max(100),
}).strict();
