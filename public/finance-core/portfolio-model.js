'use strict';
// Shared private-data presentation model. No account data or classifications live
// in this asset; all financial values and confirmed mappings arrive at runtime.
globalThis.PortfolioModel=(()=>{
 const cents=v=>v===null||v===undefined||!Number.isFinite(v)?null:Math.round(v*100);
 const sum=rows=>rows.length&&rows.every(x=>x!==null)?rows.reduce((a,b)=>a+b,0):null;
 const sumValues=rows=>rows.length&&rows.every(x=>x!==null&&x!==undefined&&Number.isFinite(x))?rows.reduce((a,b)=>a+b,0):null;
 const keySymbol=s=>String(s||'').trim().toUpperCase();
 const unknownId='unclassified';
 // Confirmed strategy families, independent of instrument type or color.
 const familyClasses=globalThis.FinanceProfile?.familyClasses||{},familyDefinitions=globalThis.FinanceProfile?.familyDefinitions||[{id:'unclassified',label:'Unclassified',color:'#e2e5eb'}];
 const configuredFamilies=Object.keys(familyClasses).length>0;
 const broadFamilies=[{id:'equity',label:'Equity'},{id:'debt',label:'Credit / debt'},{id:'real_assets',label:'Real assets'},{id:'cash',label:'Cash'},{id:'mixed_multi_asset',label:'Mixed asset funds'},{id:'unclassified',label:'Unclassified'}];
 // Group an already classified taxonomy, never infer exposures from securities.
 function broadFamily(c){
  const name=(c.id+' '+(c.label||'')).toLowerCase().replace(/[_-]/g,' ');
  if(c.id===unknownId||/\bunclassified\b|\bunknown\b/.test(name))return unknownId;
  if(/\bmixed\b|\bbalanced\b|\bmulti asset\b/.test(name))return 'mixed_multi_asset';
  if(/\breal assets?\b|\breal estate\b|\bhome\b|\bresidence\b|\bproperty\b|\breits?\b|\bgold\b|\bcommodit(?:y|ies)\b|\binfrastructure\b/.test(name))return 'real_assets';
  if(/\bcash\b|\bmoney market\b/.test(name))return 'cash';
  if(/\bbonds?\b|\bfixed income\b|\bcredit\b|\bdebt\b|\btreasur(?:y|ies)\b|\btips\b/.test(name))return 'debt';
  if(/\bequit(?:y|ies)\b|\bstocks?\b/.test(name))return 'equity';
  return null;
 }
 const familyId=(value,report)=>{const id=typeof value==='string'?value:value.id,c=report?.taxonomy?.find(c=>c.id===id)||(typeof value==='string'?{id}:value);return configuredFamilies?(Object.keys(familyClasses).find(f=>familyClasses[f].includes(id))||unknownId):(c.familyId||broadFamily(c)||'needs_family:'+id);};
 function definitions(allocation,report){
  if(configuredFamilies)return familyDefinitions;
  const used=new Set(allocation.map(c=>familyId(c,report))),custom=report?.families||[];
  return [...broadFamilies.filter(f=>used.has(f.id)),...custom.filter(f=>used.has(f.id)&&!broadFamilies.some(b=>b.id===f.id)),...allocation.filter(c=>used.has('needs_family:'+c.id)).map(c=>({id:'needs_family:'+c.id,label:(c.label||c.id)+' · family unresolved'}))];
 }
 function allocationFamilies(allocation,denominator,report={taxonomy:allocation}){return definitions(allocation,report).map(f=>{
  const members=allocation.filter(c=>familyId(c,report)===f.id),known=members.every(c=>Number.isFinite(c.valueCents)),valueCents=known?members.reduce((s,c)=>s+c.valueCents,0):null;
  return {...f,memberIds:members.map(c=>c.id),valueCents,actualPercent:valueCents!==null&&denominator>0?valueCents/denominator*100:null,targetPercent:globalThis.FinanceProfile?.familyTargetPolicy?.unassignedFamilyIds?.includes(f.id)||members.some(c=>!Number.isFinite(c.targetPercent))?null:members.reduce((s,c)=>s+c.targetPercent,0)};
 });}
 function groupHoldings(holdings,report){
  const classifications=new Map((report?.classifications||[]).map(c=>[keySymbol(c.symbol)+'|'+c.currency,c]));
  const exactClassifications=new Map((report?.holdingClassifications||[]).map(c=>[c.holdingId,c]));
  const groups=new Map();
  for(const h of holdings){
   const symbol=keySymbol(h.symbol),currency=h.currency||'USD';
   // Tickering is a stable security identity within the supplied currency/type.
   // Untickered cash baskets and unidentified securities retain their own source
   // identity: sharing a generic cash label never establishes a shared security.
   const key=symbol?'security:'+symbol+'|'+currency+'|'+h.securityType:(h.isCashEquivalent?'cash:':'unidentified:')+h.id+'|'+currency;
   const mapping=exactClassifications.get(h.id)||classifications.get(symbol+'|'+currency),assetClassId=mapping?.assetClassId||(h.isCashEquivalent?report?.cashAssetClassId:unknownId)||unknownId;
   const assetClass=report?.taxonomy.find(c=>c.id===assetClassId)?.label||'Unclassified / mixed';
   const presentation=globalThis.FinanceProfile?.holdingPresentation?.(h)||{};
   const identity=exactClassifications.get(h.id),confirmedIdentity=identity?.sourceName===h.name&&identity.identityAuthority&&identity.identityConfirmedAt?identity:null;
   if(!groups.has(key))groups.set(key,{key,symbol: symbol||null,displaySymbol:confirmedIdentity&&Object.hasOwn(confirmedIdentity,'displaySymbol')?confirmedIdentity.displaySymbol:Object.hasOwn(presentation,'displaySymbol')?presentation.displaySymbol:symbol||null,instrumentLabel:presentation.instrumentLabel||null,name:confirmedIdentity?.displayName||h.name,sourceName:h.name,sourceSymbol:symbol||null,identityBasis:confirmedIdentity?.identityAuthority||null,currency,assetClassId,assetClass,classificationBasis:(mapping?.basis||(h.isCashEquivalent?'Source identifies cash equivalent.':'No verified asset-class mapping or fund look-through.'))+(confirmedIdentity?' Source identity: '+h.name+'; source symbol: '+(symbol||'not supplied')+'. '+confirmedIdentity.identityAuthority:''),rows:[],accounts:[]});
   const group=groups.get(key);group.rows.push(h);
   if(group.assetClassId!==assetClassId){group.assetClassId=unknownId;group.assetClass='Unclassified / mixed';}
  }
  return [...groups.values()].map(g=>{
   const accountGroups=new Map();for(const h of g.rows){const k=h.accountId||h.id;if(!accountGroups.has(k))accountGroups.set(k,{id:k,name:h.account,rows:[]});accountGroups.get(k).rows.push(h);}
   g.accounts=[...accountGroups.values()].map(a=>({id:a.id,name:a.name,valueCents:cents(sumValues(a.rows.map(h=>h.value))),quantity:a.rows.every(h=>Number.isFinite(h.quantity))?a.rows.reduce((s,h)=>s+h.quantity,0):null,priceDates:[...new Set(a.rows.map(h=>h.priceAsOf||'Unavailable'))],sourceHoldingCount:a.rows.length}));
   return {...g,rawValue:sumValues(g.rows.map(h=>h.value)),valueCents:cents(sumValues(g.rows.map(h=>h.value))),sourceHoldingCount:g.rows.length,priceDates:[...new Set(g.rows.map(h=>h.priceAsOf||'Unavailable'))]};
  }).sort((a,b)=>(b.valueCents??-Infinity)-(a.valueCents??-Infinity)||a.key.localeCompare(b.key));
 }
 function build(native,policy){
  const profile=globalThis.FinanceProfile||{},originalNative=native,originalPolicy=policy;
  const adapted=profile.adaptPortfolioInput?.({native,policy});if(adapted){native=adapted.native;policy=adapted.policy;}
  const report=policy?.portfolioReporting||null,pf=native?.portfolio,accounts=native?.accounts||[];
  if(!pf)return {available:false,groups:[],netRows:[],netTableTotal:null,allocation:[],families:[],liquidity:{knownLiquidAssetsCents:null,unknownCents:null,basis:"Liquidity unavailable."},metrics:{netWorth:null,liquidNetWorth:null,totalAssets:null,totalLiabilities:null,investmentAccounts:null,cash:null,change3:null,change12:null},notes:['Portfolio data unavailable.']};
  const groups=groupHoldings(pf.holdings||[],report),holdingsTotal=!(pf.holdings||[]).length&&pf.linkedInvestmentAccountsValue===0?0:cents(sumValues((pf.holdings||[]).map(h=>h.value)));
  const investment=cents(pf.linkedInvestmentAccountsValue),depository=cents(pf.linkedDepositorySnapshotValue);
  let denominator=investment===null||depository===null?null:investment+depository;
  const valuationComplete=holdingsTotal!==null&&(pf.holdings||[]).every(h=>h.currency==='USD'&&cents(h.value)!==null&&cents(h.value)>=0);
  const gap=investment===null||holdingsTotal===null?null:investment-holdingsTotal;
  const classValues=new Map((report?.taxonomy||pf.targets?.map((t,i)=>({id:'target_'+i,label:t.category,targetPercent:t.percent}))||[]).map(c=>[c.id,{...c,valueCents:0}]));
  classValues.set(unknownId,{id:unknownId,label:'Unclassified / mixed',targetPercent:null,valueCents:0});
  for(const g of groups){const id=classValues.has(g.assetClassId)?g.assetClassId:unknownId;classValues.get(id).valueCents+=(g.rawValue??0)*100;}
  if(depository!==null){const cash=classValues.get(report?.cashAssetClassId)||classValues.get(unknownId);cash.valueCents+=depository;}
  for(const value of classValues.values())value.valueCents=Math.round(value.valueCents);
  const roundedAllocationGap=denominator===null?null:denominator-[...classValues.values()].reduce((s,c)=>s+c.valueCents,0);
  if(roundedAllocationGap!==null&&roundedAllocationGap>=-2)classValues.get(unknownId).valueCents+=roundedAllocationGap;
  let allocationAvailable=!!report&&valuationComplete&&denominator!==null&&denominator>0&&gap!==null&&gap>=-2&&roundedAllocationGap!==null&&roundedAllocationGap>=-2;
  let allocation=[...classValues.values()].map(c=>({...c,valueCents:allocationAvailable?c.valueCents:null,actualPercent:allocationAvailable?c.valueCents/denominator*100:null}));
  // The linked scope stands on its own. Manual evidence enters only by an
  // explicit policy selection; references to existing accounts are not additive.
  const selectedIds=[...new Set(report?.netWorth?.manualBalanceIds||[])],manualById=new Map((pf.manualBalances||[]).map(r=>[r.id,r]));
  const manualScope=selectedIds.map(id=>{const record=manualById.get(id),duplicate=record?.linkedAccountId&&accounts.some(a=>a.id===record.linkedAccountId),eligible=record&&['confirmed','documented','estimate'].includes(record.status)&&!duplicate;return {id,record,duplicate,eligible};});
  const manualRows=manualScope.filter(s=>!s.duplicate).map(s=>({key:'manual:'+s.id,kind:'manual',security:s.record?s.record.kind==='liability'?'Liability':'Asset':'Unknown component',symbol:null,name:s.record?s.record.label+(s.record.status==='estimate'?' · estimate':''):'Missing selected manual record',assetClass:s.record?s.record.kind==='liability'?'Manual liability':'Manual asset':'Unknown component',valueCents:s.eligible&&s.record.currency==='USD'?cents(s.record.value):null,accounts:[],basis:(s.record?.status==='unverified'?'Unverified manual evidence. ':'')+(s.record?.basis||'Selected evidence unavailable.')+(s.record?.status==='documented'&&s.record.valuationDate==null?' Documented amount; valuation date unavailable.':'')}));
  const linkedValues=accounts.map(a=>a.currency==='USD'?cents(a.netBalance):null),manualValues=manualRows.map(r=>r.valueCents),netValues=[...linkedValues,...manualValues];
  const netWorth=sum(netValues),netWorthBasis=report?.netWorth?.basis||'Signed linked account net balances. No manual records are selected.';
  const sourceDates=[...new Set(accounts.map(a=>a.balanceDate||'Unavailable'))];
  const linkedAssets=cents(sumValues(accounts.filter(a=>!['credit','loan'].includes(a.type)).map(a=>a.netBalance)));
  const linkedLiabilities=cents(sumValues(accounts.filter(a=>['credit','loan'].includes(a.type)).map(a=>a.netBalance)));
  const netRows=groups.map(g=>({...g,kind:'security',security:g.displaySymbol||g.instrumentLabel||'—'}));
  for(const [i,a] of accounts.entries())if(a.type!=='investment')netRows.push({key:'balance:'+(a.id||i),kind:'balance',security:a.type==='depository'?'Cash':['credit','loan'].includes(a.type)?'Liability':'Asset',symbol:null,name:a.label||a.institution||'Linked account',currency:a.currency,assetClass:a.type==='depository'?'Depository cash':['credit','loan'].includes(a.type)?'Linked liability':'Linked asset',valueCents:a.currency==='USD'?cents(a.netBalance):null,accounts:[],basis:'Signed linked account net balance.',valuationDate:a.balanceDate||null});
  netRows.push(...manualRows);
  const groupedTotal=groups.length?sum(groups.map(g=>g.valueCents)):0,linkedInvestment=cents(sumValues(accounts.filter(a=>a.type==='investment').map(a=>a.currency==='USD'?a.netBalance:null)));
  const netRounding=groupedTotal===null||linkedInvestment===null?null:linkedInvestment-groupedTotal;
  if(netRounding)netRows.push({key:'investment:reconciliation',kind:'reconciliation',security:'—',symbol:null,name:Math.abs(netRounding)<=2?'Investment balance rounding':'Investment balance reconciliation',assetClass:'Reconciliation',valueCents:netRounding,accounts:[],basis:'Linked investment balances less the sum of displayed security values. This is not an additional account.'});
  // Missing or unverified selected evidence makes totals unknown; unselected records are references only.
  const netTableTotal=netWorth!==null?sum(netRows.map(r=>r.valueCents)):null;
  // Account balances define assets/debts. A holdings reconciliation is never debt.
  // Unknown components affect only metrics that actually depend on them.
  const components=[...accounts.map((a,i)=>({valueCents:linkedValues[i],kind:['credit','loan'].includes(a.type)?'liability':'asset'})),...manualScope.filter(s=>!s.duplicate).map((s,i)=>({valueCents:manualRows[i].valueCents,kind:s.record?.kind||'unknown'}))];
  const availability=(kind)=>{const missing=components.filter(r=>!Number.isFinite(r.valueCents)&&(r.kind===kind||r.kind==='unknown')),known=components.filter(r=>Number.isFinite(r.valueCents)),knownSubtotalCents=components.length?known.reduce((n,r)=>n+(kind==='asset'?Math.max(0,r.valueCents):Math.max(0,-r.valueCents)),0):null;return {complete:components.length>0&&missing.length===0,knownSubtotalCents,missingCount:missing.length};};
  const assetsAvailability=availability('asset'),liabilitiesAvailability=availability('liability'),totalAssets=assetsAvailability.complete?assetsAvailability.knownSubtotalCents:null,totalLiabilities=liabilitiesAvailability.complete?liabilitiesAvailability.knownSubtotalCents:null;
  const holdingsByAccount=new Map();for(const h of pf.holdings||[]){if(!holdingsByAccount.has(h.accountId))holdingsByAccount.set(h.accountId,[]);holdingsByAccount.get(h.accountId).push(h);}
  const liquidityRows=[];
  for(const a of accounts){
   if(['credit','loan'].includes(a.type))continue;
   const sub=String(a.subtype||'').toLowerCase(),valueCents=a.currency==='USD'?cents(a.netBalance):null,retirement=/401.?k|403.?b|457|\bira\b|roth|retirement|pension|529/.test(sub);
   const holdings=holdingsByAccount.get(a.id)||[],privateRows=holdings.filter(h=>/private|restricted|non.?traded/.test(String(h.securitySubtype||'').toLowerCase())),uncertain=holdings.filter(h=>!['etf','equity','mutual fund','cash'].includes(String(h.securityType).toLowerCase()));
   const status=retirement?'retirement':a.type==='depository'?'liquid':a.type==='investment'&&sub==='brokerage'&&holdings.length&&!uncertain.length?'liquid':'unknown';
   const privateValue=privateRows.every(h=>Number.isFinite(h.value))?privateRows.reduce((n,h)=>n+Math.max(0,cents(h.value)),0):null;
   liquidityRows.push({valueCents:status==='liquid'&&valueCents!==null&&privateValue!==null?valueCents-privateValue:valueCents,status:status==='liquid'&&privateValue===null?'unknown':status});
   if(status==='liquid'&&privateValue>0)liquidityRows.push({valueCents:privateValue,status:'illiquid'});
  }
  const liquiditySubtotal=status=>{const rows=liquidityRows.filter(r=>r.status===status);return liquidityRows.length&&rows.every(r=>Number.isFinite(r.valueCents))?rows.reduce((n,r)=>n+Math.max(0,r.valueCents),0):null;},knownLiquidAssets=liquiditySubtotal('liquid');
  const liquidity={estimated:true,knownLiquidAssetsCents:knownLiquidAssets,unknownCents:liquiditySubtotal('unknown'),retirementCents:liquiditySubtotal('retirement'),illiquidCents:liquiditySubtotal('illiquid'),basis:'Cash plus nonretirement brokerage investments of identified marketable types, less all liabilities. Manual assets, identified private holdings, retirement accounts and unverified liquidity are excluded. Account balances already include holdings and are counted once.'};
  const liquidNetWorth=knownLiquidAssets!==null&&totalLiabilities!==null?knownLiquidAssets-totalLiabilities:null;
  const metricAvailability={totalAssets:assetsAvailability,totalLiabilities:liabilitiesAvailability,netWorth:{complete:netWorth!==null,knownSubtotalCents:components.length?components.reduce((n,r)=>n+(Number.isFinite(r.valueCents)?r.valueCents:0),0):null,missingCount:components.filter(r=>!Number.isFinite(r.valueCents)).length},liquidNetWorth:{complete:liquidNetWorth!==null,knownSubtotalCents:liquidityRows.length?liquidityRows.filter(r=>r.status==='liquid'&&Number.isFinite(r.valueCents)).reduce((n,r)=>n+Math.max(0,r.valueCents),0)-(liabilitiesAvailability.knownSubtotalCents||0):null,missingCount:liquidityRows.filter(r=>r.status==='liquid'&&!Number.isFinite(r.valueCents)).length+liabilitiesAvailability.missingCount}};
  const compositionScope=profile.compositionScope||report?.composition?.scope||'all_assets',targetScope=profile.compositionTargetScope||report?.targetProvenance?.compositionScope||null;
  if(compositionScope==='all_assets'){
   // The source inventory/policy selects manual evidence once; only eligible
   // positive assets enter composition. Debts never become negative pie slices.
   const extraAccounts=accounts.filter(a=>!['investment','depository','credit','loan'].includes(a.type));
   const selectedAssets=manualScope.filter(s=>!s.duplicate&&s.record?.kind!=='liability');
   const knownAssets=accounts.filter(a=>!['credit','loan'].includes(a.type)).every(a=>a.currency==='USD'&&Number.isFinite(a.netBalance))&&selectedAssets.every(s=>s.eligible&&s.record.currency==='USD'&&Number.isFinite(s.record.value));
   const depositValues=accounts.filter(a=>a.type==='depository'),positiveCash=depositValues.reduce((n,a)=>n+Math.max(0,cents(a.netBalance)||0),0);
   const values=new Map(allocation.map(c=>[c.id,{...c,valueCents:classValues.get(c.id).valueCents}]));
   const cashId=values.has(report?.cashAssetClassId)?report.cashAssetClassId:unknownId;
   values.get(cashId).valueCents+=positiveCash-(depository||0);
   function addBalance(record,source,valueCents){
    if(!(valueCents>0))return;
    const mapping=(report?.balanceClassifications||[]).find(m=>m.source===source&&m.balanceId===record.id),mapped=values.get(mapping?.assetClassId);
    if(mapped)mapped.valueCents+=valueCents;
    else {const id=source+'_asset:'+record.id;values.set(id,{id,label:record.label||record.institution||'Other asset',targetPercent:null,valueCents});}
   }
   for(const a of extraAccounts)addBalance(a,'linked',a.currency==='USD'?cents(a.netBalance):null);
   for(const selected of selectedAssets)if(selected.eligible)addBalance(selected.record,'manual',selected.record.currency==='USD'?cents(selected.record.value):null);
   const linkedPositive=accounts.filter(a=>!['credit','loan'].includes(a.type)).reduce((n,a)=>n+Math.max(0,cents(a.netBalance)||0),0),manualPositive=selectedAssets.reduce((n,s)=>n+(s.eligible?Math.max(0,cents(s.record.value)||0):0),0);
   denominator=knownAssets?linkedPositive+manualPositive:null;
   // Aggregate balances and account scope must agree; a holdings total is not
   // a substitute for an unavailable account balance.
   const investments=accounts.filter(a=>a.type==='investment');
   const investmentMatches=investments.every(a=>a.netBalance>=0)&&investments.reduce((n,a)=>n+(cents(a.netBalance)||0),0)===investment;
   allocationAvailable=!!report&&knownAssets&&valuationComplete&&investmentMatches&&denominator>0&&gap!==null&&gap>=-2&&[...values.values()].every(c=>c.valueCents>=0)&&[...values.values()].reduce((n,c)=>n+c.valueCents,0)===denominator;
   allocation=[...values.values()].map(c=>({...c,valueCents:allocationAvailable?c.valueCents:null,actualPercent:allocationAvailable?c.valueCents/denominator*100:null}));
  }
  const suppliedTargets=(report?.taxonomy||[]).some(c=>Number.isFinite(c.targetPercent)),targetsCompatible=!suppliedTargets||targetScope===compositionScope;
  if(!targetsCompatible)allocation=allocation.map(c=>({...c,targetPercent:null}));
  const composition={scope:compositionScope,label:compositionScope==='all_assets'?'Total assets':'Investments + cash',basis:report?.composition?.basis||(compositionScope==='all_assets'?'All evidenced positive linked assets and selected manual assets, counted once. Liabilities remain separate. Unknown selected asset values make composition unavailable.':'Linked investment accounts and depository cash; manual assets and liabilities excluded by explicit composition choice.'),targetScope,targetsCompatible,targetMessage:targetsCompatible?null:'Targets are hidden until their stated scope matches this composition. Existing weights are retained; no rescaling has been applied.'};
  const result={available:true,composition,metricAvailability,collectionNote:globalThis.FinanceReadModel?.collectionProvenance(native)||'',collectedAt:native.metadata?.reusedAccountHoldingsSnapshot?.retrievedAt||native.metadata?.retrievedAt||null,report,groups,netRows,netTableTotal,netTableReconciles:netTableTotal!==null&&netWorth!==null&&netTableTotal===netWorth,netRoundingCents:netRounding,sourceHoldingCount:(pf.holdings||[]).length,holdingsTotal,investment,depository,denominator,allocation,families:allocationFamilies(allocation,denominator,report),allocationAvailable,reconciliationGapCents:gap,allocationRoundingAdjustmentCents:roundedAllocationGap,sourceDates,components:{linkedAssets,linkedLiabilities,manualNet:manualRows.length?sum(manualValues):0},liquidity,metrics:{netWorth,liquidNetWorth,totalAssets,totalLiabilities,investmentAccounts:investment,cash:depository,change3:null,change12:null},netWorthBasis,historyBasis:'Comparable full balance history is unavailable. Transaction history does not establish past net worth.',notes:report?.notes||['Asset-class mappings await verified evidence.'],manualReferences:pf.manualBalances||[],manualInclusion:manualScope.map(s=>({id:s.id,status:s.duplicate?'already_in_linked_scope':s.eligible?'selected':'unavailable_or_unverified'}))};
  return profile.finalizePortfolio?.({result,native:originalNative,policy:originalPolicy})||result;
 }
 // Display projections keep the exact accounting model intact. A real unknown
 // holding is retained even when it is worth only one cent.
 function display(pf){
  const knownIds=new Set((pf.report?.taxonomy||[]).map(c=>c.id)),realUnknown=(pf.groups||[]).some(g=>!knownIds.has(g.assetClassId))||(Number.isFinite(pf.depository)&&pf.depository!==0&&!knownIds.has(pf.report?.cashAssetClassId));
  const allocation=(pf.allocation||[]).filter(c=>c.id!==unknownId||realUnknown||!(Number.isFinite(c.valueCents)&&Math.abs(c.valueCents)<=1&&Number.isFinite(pf.allocationRoundingAdjustmentCents)&&c.valueCents===pf.allocationRoundingAdjustmentCents));
  const families=allocationFamilies(allocation,pf.denominator,pf.report).filter(f=>f.id!==unknownId||allocation.some(c=>familyId(c,pf.report)===unknownId));
  const rows=(pf.netRows||[]).filter(r=>r.kind!=='reconciliation'),cash=rows.filter(r=>(r.kind==='balance'&&r.security==='Cash')||(r.kind==='security'&&r.rows?.length&&r.rows.every(h=>h.isCashEquivalent===true||String(h.securityType).toLowerCase()==='cash'))),liabilities=rows.filter(r=>(r.kind==='balance'&&r.security==='Liability')||(r.kind==='manual'&&(r.security==='Liability'||globalThis.FinanceProfile?.isManualLiability?.(r))));
  const grouped=new Set([...cash,...liabilities]);
  const parent=(id,label,members)=>{
   const accounts=new Map();for(const row of members){const children=row.kind==='security'?row.accounts:[{id:row.key,name:row.name,valueCents:row.valueCents,assetClass:row.assetClass}];for(const child of children){const key=child.id,existing=accounts.get(key);if(existing)existing.valueCents=Number.isFinite(existing.valueCents)&&Number.isFinite(child.valueCents)?existing.valueCents+child.valueCents:null;else accounts.set(key,{...child,assetClass:child.assetClass||row.assetClass});}}
   return {key:'display:'+id,kind:'group',security:label,name:label,assetClass:label,valueCents:sumValues(members.map(r=>r.valueCents)),accounts:[...accounts.values()],classificationBasis:'Display group of existing signed components. Expanded account values are included in the parent; no additional assets or liabilities are created.',memberKeys:members.map(r=>r.key)};
  };
  return {...pf,allocation,families,netRows:[...rows.filter(r=>!grouped.has(r)),...(cash.length?[parent('cash','Cash',cash)]:[]),...(liabilities.length?[parent('liabilities','Liabilities',liabilities)]:[])]};
 }
 function familyCoverage(pf){
  const expected=pf.allocation||[],families=pf.families||[],report=pf.report;
  const missing=expected.filter(c=>c.id!==unknownId&&(!families.some(f=>f.memberIds.includes(c.id))||familyId(c,report)===unknownId)).map(c=>c.id);
  const invalid=expected.filter(c=>families.reduce((n,f)=>n+f.memberIds.filter(id=>id===c.id).length,0)!==1||(configuredFamilies&&c.id!==unknownId&&Object.values(familyClasses).reduce((n,ids)=>n+ids.filter(id=>id===c.id).length,0)!==1)).map(c=>c.id);
  const extra=families.flatMap(f=>f.memberIds).filter(id=>!expected.some(c=>c.id===id));
  const unresolved=expected.filter(c=>familyId(c,report).startsWith('needs_family:')).map(c=>c.id);
  // Only reject split siblings where their existing class labels establish a
  // shared broad exposure. Cash-only and genuine singleton families are valid.
  const splitBroadGroups=broadFamilies.filter(b=>{const siblings=expected.filter(c=>broadFamily(c)===b.id);return siblings.length>1&&new Set(siblings.flatMap(c=>families.filter(f=>f.memberIds.includes(c.id)).map(f=>f.id))).size>1;}).map(b=>b.id);
  const same=(a,b)=>a===b||(Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<.000001);
  const aggregateIssues=families.filter(f=>{const members=expected.filter(c=>f.memberIds.includes(c.id)),values=members.every(c=>Number.isFinite(c.valueCents))?members.reduce((n,c)=>n+c.valueCents,0):null,percent=values!==null&&pf.denominator>0?values/pf.denominator*100:null,targets=globalThis.FinanceProfile?.familyTargetPolicy?.unassignedFamilyIds?.includes(f.id)||members.some(c=>!Number.isFinite(c.targetPercent))?null:members.reduce((n,c)=>n+c.targetPercent,0);return !same(f.valueCents,values)||!same(f.actualPercent,percent)||!same(f.targetPercent,targets);}).map(f=>f.id);
  const denominatorReconciles=!pf.allocationAvailable||(expected.every(c=>same(c.actualPercent,c.valueCents/pf.denominator*100))&&families.reduce((n,f)=>n+f.valueCents,0)===pf.denominator);
  return {ok:!missing.length&&!invalid.length&&!extra.length&&!unresolved.length&&!splitBroadGroups.length&&!aggregateIssues.length&&denominatorReconciles,derivedFromTaxonomy:!configuredFamilies,missingClassIds:missing,invalidMembershipClassIds:invalid,unexpectedClassIds:extra,unresolvedFamilyClassIds:unresolved,splitBroadGroups,aggregateIssueFamilyIds:aggregateIssues,denominatorReconciles,classifiedValueCents:pf.allocationAvailable?expected.filter(c=>c.id!==unknownId).reduce((n,c)=>n+c.valueCents,0):null};
 }
 return {build,display,groupHoldings,allocationFamilies,familyId,familyCoverage};
})();
