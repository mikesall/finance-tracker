import {reconcileFinanceInventory} from './finance-inventory-schema.ts';
// Inventory completeness and truthful presentation are separate checks. Unknown
// values may pass when each affected metric is explicitly incomplete.
export function verifyFinanceSetupState(snapshot:any,policy:any,portfolio:any,projection:any,familyCoverage:any){
 const inventory=reconcileFinanceInventory(snapshot,policy),issues:string[]=[],warnings:string[]=[];
 if(!portfolio?.available)issues.push('Portfolio presentation is unavailable.');
 if(!familyCoverage?.ok)issues.push('Portfolio hierarchy must preserve every class exactly once, group recognized broad siblings, justify additional families, and reconcile dollars, percentages and targets.');
 if(portfolio?.composition?.scope==='all_assets'&&portfolio?.allocationAvailable&&portfolio.denominator!==portfolio.metrics?.totalAssets)issues.push('All-assets composition must reconcile to positive assets, including selected manual assets, with liabilities separate.');
 if(!portfolio?.allocationAvailable)warnings.push('Complete asset composition is unavailable; review missing values and reconciliation without presenting a partial total as complete.');
 if(portfolio?.composition?.targetsCompatible===false)issues.push('Portfolio targets need an explicit scope matching the composition; saved weights have not been rescaled.');
 const availability=portfolio?.metricAvailability||{};
 for(const key of ['totalAssets','totalLiabilities','netWorth','liquidNetWorth']){
  const a=availability[key],value=portfolio?.metrics?.[key];
  if(!a||a.complete!==Number.isFinite(value)||!Number.isInteger(a.missingCount)||a.missingCount<0)issues.push('Portfolio metric availability is inconsistent.');
  if(a&&!a.complete)warnings.push(key+' is incomplete; its known subtotal is not a complete total.');
 }
 const m=portfolio?.metrics;if(m&&[m.totalAssets,m.totalLiabilities,m.netWorth].every(Number.isFinite)&&m.totalAssets-m.totalLiabilities!==m.netWorth)issues.push('Asset/liability/net-worth totals do not reconcile.');
 if(portfolio?.netTableTotal!==null&&portfolio?.metrics?.netWorth===null)issues.push('A complete holdings table cannot substitute for an unknown account balance.');
 const manual=snapshot?.portfolio?.manualBalances||[],selected=new Set(policy?.portfolioReporting?.netWorth?.manualBalanceIds||[]);
 const evidence=manual.filter((r:any)=>selected.has(r.id)).map((r:any)=>({id:r.id,status:r.status,amountAvailable:Number.isFinite(r.value)&&r.status!=='unverified',valuationDateKnown:!!r.valuationDate}));
 if(evidence.some((r:any)=>!r.valuationDateKnown))warnings.push('Some selected manual valuation dates are unknown. This does not invalidate a separately documented or estimated amount.');
 if(evidence.some((r:any)=>r.status==='unverified'&&Number.isFinite(manual.find((x:any)=>x.id===r.id)?.value)))warnings.push('Review unverified manual amounts against evidence. Lack of a valuation date or bank connection alone does not make a documented amount unverified.');
 let comparison=null;
 if(projection?.planIsProposed){
  const scope=policy?.budgetProposal?.comparisonScope;
  if(!scope)issues.push('A proposed budget requires an explicit comparisonScope matching its estimation basis.');
  else{
   const keys=new Set((snapshot.transactions||[]).flatMap((t:any)=>[t.id]));
   if(scope.excludedSourceKeys.some((key:string)=>!keys.has(key)))issues.push('Budget comparison exclusions reference unknown source transactions.');
   const parts=projection.parts||[],included=projection.budgetComparison?.parts||[],excluded=projection.budgetComparison?.excludedParts||[],sum=(rows:any[])=>rows.reduce((n,r)=>n+r.amountCents,0);
   if(parts.length!==included.length+excluded.length||sum(parts)!==sum(included)+sum(excluded))issues.push('Budget comparison scope does not reconcile to complete actual spending.');
   comparison={basis:scope.basis,excludeUnresolvedTaxes:scope.excludeUnresolvedTaxes,excludedSourceKeyCount:scope.excludedSourceKeys.length,excludedAllocationCount:excluded.length,reconciles:parts.length===included.length+excluded.length&&sum(parts)===sum(included)+sum(excluded)};
  }
 }
 return {...inventory,ok:inventory.ok&&issues.length===0,issues:[...inventory.issues,...issues],verificationScope:['source_inventory','manual_inclusion','portfolio_family_coverage','component_metric_availability','amount_evidence_vs_freshness','budget_comparison_scope'],inventoryOk:inventory.ok,presentationOk:issues.length===0,familyCoverage,composition:portfolio?.composition||null,metricAvailability:availability,manualEvidence:evidence,budgetComparison:comparison,warnings};
}
