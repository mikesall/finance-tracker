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
 const familyId=id=>Object.keys(familyClasses).find(f=>familyClasses[f].includes(id))||'unclassified';
 function allocationFamilies(allocation,denominator){return familyDefinitions.map(f=>{
  const members=allocation.filter(c=>familyId(c.id)===f.id),known=members.every(c=>Number.isFinite(c.valueCents)),valueCents=known?members.reduce((s,c)=>s+c.valueCents,0):null;
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
   const identity=exactClassifications.get(h.id),confirmedIdentity=identity?.sourceName===h.name&&identity.identityAuthority&&identity.identityConfirmedAt?identity:null;
   if(!groups.has(key))groups.set(key,{key,symbol: symbol||null,displaySymbol:confirmedIdentity&&Object.hasOwn(confirmedIdentity,'displaySymbol')?confirmedIdentity.displaySymbol:/^CUR:|^US\.DIRECT\.INDEXING$/.test(symbol)?null:symbol||null,instrumentLabel:/^CUR:/.test(symbol)?'Cash':symbol==='US.DIRECT.INDEXING'?'Basket':null,name:confirmedIdentity?.displayName||h.name,sourceName:h.name,sourceSymbol:symbol||null,identityBasis:confirmedIdentity?.identityAuthority||null,currency,assetClassId,assetClass,classificationBasis:(mapping?.basis||(h.isCashEquivalent?'Source identifies cash equivalent.':'No verified asset-class mapping or fund look-through.'))+(confirmedIdentity?' Source identity: '+h.name+'; source symbol: '+(symbol||'not supplied')+'. '+confirmedIdentity.identityAuthority:''),rows:[],accounts:[]});
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
  const report=policy?.portfolioReporting||null,pf=native?.portfolio,accounts=native?.accounts||[];
  if(!pf)return {available:false,groups:[],netRows:[],netTableTotal:null,allocation:[],families:[],liquidity:{knownLiquidAssetsCents:null,unknownCents:null,basis:"Liquidity unavailable."},metrics:{netWorth:null,liquidNetWorth:null,totalAssets:null,totalLiabilities:null,investmentAccounts:null,cash:null,realEstate:null,change3:null,change12:null},notes:['Portfolio data unavailable.']};
  const groups=groupHoldings(pf.holdings||[],report),holdingsTotal=cents(sumValues((pf.holdings||[]).map(h=>h.value)));
  const investment=cents(pf.linkedInvestmentAccountsValue),depository=cents(pf.linkedDepositorySnapshotValue);
  const denominator=investment===null||depository===null?null:investment+depository;
  const valuationComplete=holdingsTotal!==null&&(pf.holdings||[]).every(h=>h.currency==='USD'&&cents(h.value)!==null&&cents(h.value)>=0);
  const gap=investment===null||holdingsTotal===null?null:investment-holdingsTotal;
  const classValues=new Map((report?.taxonomy||pf.targets?.map((t,i)=>({id:'target_'+i,label:t.category,targetPercent:t.percent}))||[]).map(c=>[c.id,{...c,valueCents:0}]));
  classValues.set(unknownId,{id:unknownId,label:'Unclassified / mixed',targetPercent:null,valueCents:0});
  for(const g of groups){const id=classValues.has(g.assetClassId)?g.assetClassId:unknownId;classValues.get(id).valueCents+=(g.rawValue??0)*100;}
  if(depository!==null){const cash=classValues.get(report?.cashAssetClassId)||classValues.get(unknownId);cash.valueCents+=depository;}
  for(const value of classValues.values())value.valueCents=Math.round(value.valueCents);
  const roundedAllocationGap=denominator===null?null:denominator-[...classValues.values()].reduce((s,c)=>s+c.valueCents,0);
  if(roundedAllocationGap!==null&&roundedAllocationGap>=-2)classValues.get(unknownId).valueCents+=roundedAllocationGap;
  const allocationAvailable=!!report&&valuationComplete&&denominator!==null&&denominator>0&&gap!==null&&gap>=-2&&roundedAllocationGap!==null&&roundedAllocationGap>=-2;
  const allocation=[...classValues.values()].map(c=>({...c,valueCents:allocationAvailable?c.valueCents:null,actualPercent:allocationAvailable?c.valueCents/denominator*100:null}));
  let netWorth=null,netWorthBasis='Current net-worth components have not been verified.';
  if(report){
   const n=report.netWorth,home=pf.manualAssetSnapshots?.find(a=>a.label===n.homeLabel),mortgage=pf.manualAssetSnapshots?.find(a=>a.label===n.mortgageLabel);
   const linked=cents(sumValues(accounts.map(a=>a.currency==='USD'?a.netBalance:null)));
   const homeValue=cents(home?.value),mortgageValue=cents(mortgage?.value),pending=0;
   if(linked!==null&&homeValue!==null&&mortgageValue!==null&&pending!==null)netWorth=linked+homeValue-Math.abs(mortgageValue)+pending;
   netWorthBasis=n.basis;
  }
  const sourceDates=[...new Set(accounts.map(a=>a.balanceDate||'Unavailable'))];
  const linkedAssets=cents(sumValues(accounts.filter(a=>!['credit','loan'].includes(a.type)).map(a=>a.netBalance)));
  const linkedLiabilities=cents(sumValues(accounts.filter(a=>['credit','loan'].includes(a.type)).map(a=>a.netBalance)));
  const home=report?pf.manualAssetSnapshots?.find(a=>a.label===report.netWorth.homeLabel):null,mortgage=report?pf.manualAssetSnapshots?.find(a=>a.label===report.netWorth.mortgageLabel):null;
  const netRows=groups.map(g=>({...g,kind:'security',security:g.displaySymbol||g.instrumentLabel||'—'}));
  for(const [i,a] of accounts.entries())if(a.type!=='investment')netRows.push({key:'balance:'+(a.id||i),kind:'balance',security:a.type==='depository'?'Cash':['credit','loan'].includes(a.type)?'Liability':'Asset',symbol:null,name:a.label||a.institution||'Linked account',currency:a.currency,assetClass:a.type==='depository'?'Depository cash':['credit','loan'].includes(a.type)?'Linked liability':'Linked asset',valueCents:a.currency==='USD'?cents(a.netBalance):null,accounts:[],basis:'Signed linked account net balance.',valuationDate:a.balanceDate||null});
  if(home)netRows.push({key:'manual:home',kind:'manual',security:'Home',symbol:null,name:home.label+' · estimate',assetClass:'Real estate',valueCents:cents(home.value),accounts:[],basis:home.basis||'User-reported home estimate.'});
  if(mortgage)netRows.push({key:'manual:mortgage',kind:'manual',security:'Mortgage',symbol:null,name:mortgage.label,assetClass:'Mortgage liability',valueCents:cents(mortgage.value)===null?null:-Math.abs(cents(mortgage.value)),accounts:[],basis:mortgage.basis||'User-reported mortgage balance.'});
  const groupedTotal=sum(groups.map(g=>g.valueCents)),linkedInvestment=cents(sumValues(accounts.filter(a=>a.type==='investment').map(a=>a.currency==='USD'?a.netBalance:null)));
  const netRounding=groupedTotal===null||linkedInvestment===null?null:linkedInvestment-groupedTotal;
  if(netRounding)netRows.push({key:'investment:reconciliation',kind:'reconciliation',security:'—',symbol:null,name:Math.abs(netRounding)<=2?'Investment balance rounding':'Investment balance reconciliation',assetClass:'Reconciliation',valueCents:netRounding,accounts:[],basis:'Linked investment balances less the sum of displayed security values. This is not an additional account.'});
  // Unverified redemption claims never enter assets; received proceeds appear in accounts.
  const netTableTotal=sum(netRows.map(r=>r.valueCents));
  const netValuesKnown=netRows.length>0&&netRows.every(r=>Number.isFinite(r.valueCents)),totalAssets=netValuesKnown?netRows.reduce((n,r)=>n+Math.max(0,r.valueCents),0):null,totalLiabilities=netValuesKnown?netRows.reduce((n,r)=>n+Math.max(0,-r.valueCents),0):null;
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
  const liquidityValuesKnown=liquidityRows.length>0&&liquidityRows.every(r=>Number.isFinite(r.valueCents)),knownLiquidAssets=liquidityValuesKnown?liquidityRows.filter(r=>r.status==='liquid').reduce((n,r)=>n+Math.max(0,r.valueCents),0):null;
  const liquidity={estimated:true,knownLiquidAssetsCents:knownLiquidAssets,unknownCents:liquidityValuesKnown?liquidityRows.filter(r=>r.status==='unknown').reduce((n,r)=>n+Math.max(0,r.valueCents),0):null,retirementCents:liquidityValuesKnown?liquidityRows.filter(r=>r.status==='retirement').reduce((n,r)=>n+Math.max(0,r.valueCents),0):null,illiquidCents:liquidityValuesKnown?liquidityRows.filter(r=>r.status==='illiquid').reduce((n,r)=>n+Math.max(0,r.valueCents),0):null,basis:'Cash plus nonretirement brokerage investments of identified marketable types, less all liabilities. Home, identified private holdings, retirement accounts and unverified liquidity are excluded. Account balances already include holdings and are counted once.'};
  const liquidNetWorth=knownLiquidAssets!==null&&totalLiabilities!==null?knownLiquidAssets-totalLiabilities:null;
  return {available:true,collectionNote:globalThis.FinanceReadModel?.collectionProvenance(native)||'',collectedAt:native.metadata?.reusedAccountHoldingsSnapshot?.retrievedAt||native.metadata?.retrievedAt||null,report,groups,netRows,netTableTotal,netTableReconciles:netTableTotal!==null&&netWorth!==null&&netTableTotal===netWorth,netRoundingCents:netRounding,sourceHoldingCount:(pf.holdings||[]).length,holdingsTotal,investment,depository,denominator,allocation,families:allocationFamilies(allocation,denominator),allocationAvailable,reconciliationGapCents:gap,allocationRoundingAdjustmentCents:roundedAllocationGap,sourceDates,components:{linkedAssets,linkedLiabilities,home:cents(home?.value),mortgage:cents(mortgage?.value)},liquidity,metrics:{netWorth,liquidNetWorth,totalAssets,totalLiabilities,investmentAccounts:investment,cash:depository,realEstate:cents(home?.value),change3:null,change12:null},netWorthBasis,historyBasis:'Comparable full balance history is unavailable. Transaction history does not establish past net worth.',notes:report?.notes||['Asset-class mappings await verified evidence.'],manualReferences:pf.manualAssetSnapshots||[],pendingRedemption:pf.pendingRedemption};
 }
 // Display projections keep the exact accounting model intact. A real unknown
 // holding is retained even when it is worth only one cent.
 function display(pf){
  const knownIds=new Set((pf.report?.taxonomy||[]).map(c=>c.id)),realUnknown=(pf.groups||[]).some(g=>!knownIds.has(g.assetClassId))||(Number.isFinite(pf.depository)&&pf.depository!==0&&!knownIds.has(pf.report?.cashAssetClassId));
  const allocation=(pf.allocation||[]).filter(c=>c.id!==unknownId||realUnknown||!(Number.isFinite(c.valueCents)&&Math.abs(c.valueCents)<=1&&Number.isFinite(pf.allocationRoundingAdjustmentCents)&&c.valueCents===pf.allocationRoundingAdjustmentCents));
  const families=allocationFamilies(allocation,pf.denominator).filter(f=>f.id!==unknownId||allocation.some(c=>familyId(c.id)===unknownId));
  const rows=(pf.netRows||[]).filter(r=>r.kind!=='reconciliation'),cash=rows.filter(r=>(r.kind==='balance'&&r.security==='Cash')||(r.kind==='security'&&r.rows?.length&&r.rows.every(h=>h.isCashEquivalent===true||String(h.securityType).toLowerCase()==='cash'))),liabilities=rows.filter(r=>(r.kind==='balance'&&r.security==='Liability')||r.key==='manual:mortgage');
  const grouped=new Set([...cash,...liabilities]);
  const parent=(id,label,members)=>{
   const accounts=new Map();for(const row of members){const children=row.kind==='security'?row.accounts:[{id:row.key,name:row.name,valueCents:row.valueCents,assetClass:row.assetClass}];for(const child of children){const key=child.id,existing=accounts.get(key);if(existing)existing.valueCents=Number.isFinite(existing.valueCents)&&Number.isFinite(child.valueCents)?existing.valueCents+child.valueCents:null;else accounts.set(key,{...child,assetClass:child.assetClass||row.assetClass});}}
   return {key:'display:'+id,kind:'group',security:label,name:label,assetClass:label,valueCents:sumValues(members.map(r=>r.valueCents)),accounts:[...accounts.values()],classificationBasis:'Display group of existing signed components. Expanded account values are included in the parent; no additional assets or liabilities are created.',memberKeys:members.map(r=>r.key)};
  };
  return {...pf,allocation,families,netRows:[...rows.filter(r=>!grouped.has(r)),...(cash.length?[parent('cash','Cash',cash)]:[]),...(liabilities.length?[parent('liabilities','Liabilities',liabilities)]:[])]};
 }
 return {build,display,groupHoldings,allocationFamilies,familyId};
})();
