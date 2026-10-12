'use strict';
globalThis.FinanceReadModel=(()=>{
 const money=x=>x===null||x===undefined?'—':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(x/100);
 const monthShift=(month,delta)=>{const d=new Date(month+'-01T00:00:00Z');d.setUTCMonth(d.getUTCMonth()+delta);return d.toISOString().slice(0,7);};
 const monthEnd=month=>new Date(Date.UTC(+month.slice(0,4),+month.slice(5,7),0)).toISOString().slice(0,10);
 const months=(end,count)=>Array.from({length:count},(_,i)=>monthShift(end.slice(0,7),i-count+1));
 const dayShift=(day,delta)=>new Date(Date.parse(day+'T12:00:00Z')+delta*86400000).toISOString().slice(0,10);
 // Invalid or absent application configuration uses UTC, never an owner's zone.
 const profileTimezone=()=>{const zone=globalThis.FinanceProfile?.timezone;try{if(typeof zone!=='string'||!zone||/^[+-]/.test(zone))return 'UTC';return new Intl.DateTimeFormat('en-US',{timeZone:zone}).resolvedOptions().timeZone;}catch{return 'UTC';}};
 const localDate=(timestamp,timezone=profileTimezone())=>{const parts=new Intl.DateTimeFormat('en-US',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(timestamp));return ['year','month','day'].map(type=>parts.find(p=>p.type===type).value).join('-');};
 const inWindow=(t,a,b)=>t.date>=a&&t.date<=b;
 // Shared visual tokens; spending and portfolio keep independent category maps.
 // One sequential scale, shared by spending and portfolio. Unknown values stay neutral.
 const sequentialColor=(index,count)=>{const t=count>1?Math.max(0,Math.min(1,index/(count-1))):0,stop=.4952,from=t<=stop?[4,86,222]:[0,216,255],to=t<=stop?[0,216,255]:[13,255,199],position=t<=stop?t/stop:(t-stop)/(1-stop);return '#'+from.map((v,i)=>Math.round(v+(to[i]-v)*position).toString(16).padStart(2,'0')).join('');};
 const palette={sequential:Array.from({length:16},(_,i)=>sequentialColor(i,16)),neutral:'#d9e0e5'};
 const spendingIds=globalThis.FinanceProfile?.spendingColorOrder||[];
 const spendingColor=id=>sequentialColor(Math.max(0,spendingIds.indexOf(id)),spendingIds.length);
 const assetIds=globalThis.FinanceProfile?.assetColorOrder||[];
 const assetColor=id=>assetIds.includes(id)?sequentialColor(assetIds.indexOf(id),assetIds.length):palette.neutral;
 const monthIndexAt=(x,left,width,count)=>Number.isFinite(x)&&width>0&&count>0?Math.max(0,Math.min(count-1,Math.floor((x-left)/width*count+1e-9))):null;
 function stack(rows){let positive=0,negative=0;const segments=[];for(const r of rows){if(!Number.isFinite(r.spend)||r.spend===0)continue;const from=r.spend>0?positive:negative,to=from+r.spend;if(r.spend>0)positive=to;else negative=to;segments.push({id:r.id,name:r.name,value:r.spend,from,to,color:r.color||spendingColor(r.id)});}return {positive,negative,net:positive+negative,segments};}

 const subcategoryLabel=value=>typeof value==='string'&&value.trim()?value.trim().replace(/\p{L}/u,c=>c.toLocaleUpperCase('en-US')):'Unspecified';
 // Reporting groups are shared by actuals, filters, rows and exports. They never
 // rewrite the effective classification, saved splits or original source.
 const reportingGroups=policy=>policy?.reportingSubcategoryGroups||policy?.budgetProposal?.subcategoryGroups||[];
 const reportingSubcategory=(part,p)=>subcategoryLabel(reportingGroups(p?.policy).find(g=>g.category===part.category&&g.sourceSubcategories.includes(part.subcategory))?.name||part.subcategory);
 const subcategories=(t,p)=>[...new Set(EffectiveLedger.partsFor(t).map(part=>reportingSubcategory(part,p)))].join(' / ');
 const subcategoryKey=(part,p)=>JSON.stringify([part.category,reportingSubcategory(part,p)]);
 function subcategoryOptions(p,selected){const options=new Map();for(const t of p.model.rows)for(const part of EffectiveLedger.partsFor(t)){if(!selected.has(part.category))continue;const key=subcategoryKey(part,p),parent=p.model.categories.find(c=>c.id===part.category)?.name||part.category;options.set(key,{key,category:part.category,parent,name:reportingSubcategory(part,p)});}return [...options.values()].sort((a,b)=>a.parent.localeCompare(b.parent)||a.name.localeCompare(b.name)||a.key.localeCompare(b.key));}
 function allocationMatches(p,part,{selected=new Set(p.model.categories.map(c=>c.id)),excludedSubcategories=new Set(),chips=[]}={}){return selected.has(part.category)&&!excludedSubcategories.has(subcategoryKey(part,p))&&chips.filter(c=>['category','subcategory'].includes(c.kind)).every(c=>c.category===part.category&&(c.kind!=='subcategory'||c.value===reportingSubcategory(part,p)))&&(!chips.some(c=>c.kind==='spending')||(EffectiveLedger.included(part)&&part.amountCents!==0));}
 function matchingParts(p,t,options={}){return EffectiveLedger.partsFor(t).filter(part=>allocationMatches(p,part,options));}
 const validMonth=value=>/^\d{4}-(0[1-9]|1[0-2])$/.test(value)&&+value.slice(0,4)>=1000;
 const validDate=value=>/^\d{4}-\d{2}-\d{2}$/.test(value)&&validMonth(value.slice(0,7))&&+value.slice(8)>=1&&value<=monthEnd(value.slice(0,7));
 const validMonthOfYear=value=>/^(0[1-9]|1[0-2])$/.test(value);
 const monthNames=['january','february','march','april','may','june','july','august','september','october','november','december'];
 const monthNameIndex=name=>{const matches=monthNames.map((m,i)=>m.startsWith(name.toLowerCase())&&name.length>=2?i:-1).filter(i=>i>=0);return matches.length===1?matches[0]:-1;};
 const validMonthDay=value=>/^\d{2}-\d{2}$/.test(String(value))&&validDate('2000-'+value);
 function dateSearch(value){const text=String(value||'').trim();if(validDate(text))return {kind:'date',value:text};if(validMonth(text))return {kind:'month',value:text};if(/^[a-z]+$/i.test(text)){const index=monthNameIndex(text);return index<0?null:{kind:'monthOfYear',value:String(index+1).padStart(2,'0')};}const yearless=/^([a-z]+)\s+(\d{1,2})$/i.exec(text);if(yearless){const i=monthNameIndex(yearless[1]),value=String(i+1).padStart(2,'0')+'-'+yearless[2].padStart(2,'0');return i>=0&&validMonthDay(value)?{kind:'monthDay',value}:null;}const match=/^([a-z]+)\s*(?:(\d{1,2})\s*,?\s*)?(\d{4})$/i.exec(text);if(!match)return null;const i=monthNameIndex(match[1]);if(i<0)return null;const month=match[3]+'-'+String(i+1).padStart(2,'0');if(!validMonth(month))return null;if(!match[2])return {kind:'month',value:month};const day=month+'-'+match[2].padStart(2,'0');return validDate(day)?{kind:'date',value:day}:null;}
 const normalizedSearch=value=>String(value||'').toLocaleLowerCase('en-US').replace(/\s*\/\s*/g,' ').replace(/\s+/g,' ').trim();
 function matchesChips(p,t,chips=[]){const hay=normalizedSearch([t.date,t.merchant,t.label,t.account,...EffectiveLedger.partsFor(t).flatMap(part=>[p.model.categories.find(c=>c.id===part.category)?.name||part.category,reportingSubcategory(part,p)])].join(' '));return chips.every(c=>c.kind==='text'?normalizedSearch(c.value).split(' ').every(term=>hay.includes(term)):c.kind==='date'?t.date===c.value:c.kind==='monthDay'?t.date.slice(5)===c.value:c.kind==='monthOfYear'?t.date.slice(5,7)===c.value:c.kind==='month'?t.date.slice(0,7)===c.value:c.kind==='range'?inWindow(t,c.start,c.end):c.kind==='merchant'?t.merchant===c.value:c.kind==='spending'?(!p.native||t.sourceState==='current'):true)&&matchingParts(p,t,{chips}).length>0;}
 function browsingRange(p){return {start:p.native?.metadata.period.start||p.start12,end:p.end};}
 function browseTransactions(p,{chips=[],search='',sortKey='date',sortDirection='desc',reviewOnly=false}={}){const r=browsingRange(p);return filterTransactions(p,{period:'ALL',sortKey,sortDirection,reviewOnly}).filter(t=>inWindow(t,r.start,r.end)&&matchesChips(p,t,[...chips,...(search?[dateSearch(search)||{kind:'text',value:search}]:[])]));}
 function transactionTotals(p,rows,options={}){const parts=rows.flatMap(t=>matchingParts(p,t,options)),sum=items=>items.reduce((s,t)=>s+t.amountCents,0),included=parts.filter(EffectiveLedger.included);return {transactionCount:rows.length,transactionCents:sum(rows),selectedAllocationCents:sum(parts),actualCents:sum(included),excludedCents:sum(parts.filter(t=>!EffectiveLedger.included(t))),includedAllocationCount:included.length};}
 const actualCents=(p,t,options={})=>transactionTotals(p,[t],options).actualCents;

 function sortRows(rows,key,direction='desc'){
  const value=typeof key==='function'?key:row=>row[key];
  return [...rows].sort((a,b)=>{const x=value(a),y=value(b),missing=v=>v===null||v===undefined||typeof v==='number'&&!Number.isFinite(v);if(missing(x)!==missing(y))return missing(x)?1:-1;if(missing(x))return String(a.name||a.key||a.id||'').localeCompare(String(b.name||b.key||b.id||''));const result=typeof x==='number'&&typeof y==='number'?x-y:String(x).localeCompare(String(y),undefined,{numeric:true,sensitivity:'base'});return (direction==='asc'?result:-result)||String(a.name||a.key||a.id||'').localeCompare(String(b.name||b.key||b.id||''));});
 }
 function sortOtherLast(rows,key='annualBudget',direction='desc'){
  const sorted=sortRows(rows,key,direction),other=row=>row.id==='other'||String(row.name||'').trim().toLowerCase()==='other';
  return [...sorted.filter(row=>!other(row)),...sorted.filter(other)];
 }
 function categoryDetails(p,category,start=p.start12,end=p.end){
  const parts=p.parts.filter(t=>t.category===category&&inWindow(t,start,end)),merchants=new Map(),payments=new Map(),sourceRows=new Map(p.current.map(t=>[t.id,t]));
  for(const part of parts){
   const subcategory=reportingSubcategory(part,p),merchant=merchants.get(part.merchant)||{name:part.merchant,amount:0,subcategories:new Set()};
   merchant.amount+=part.amountCents;merchant.subcategories.add(subcategory);merchants.set(part.merchant,merchant);
   if(part.amountCents<=0)continue;
   const source=sourceRows.get(part.id)||part,payment=payments.get(part.id)||{id:part.id,date:part.date,label:source.label||source.merchant,merchant:part.merchant,amountCents:0,subcategories:new Set()};
   payment.amountCents+=part.amountCents;payment.subcategories.add(subcategory);payments.set(part.id,payment);
  }
  const withNames=rows=>[...rows.values()].map(row=>({...row,subcategories:[...row.subcategories].sort((a,b)=>a.localeCompare(b))}));
  return {merchants:sortRows(withNames(merchants),'amount','desc'),largest:sortRows(withNames(payments),'amountCents','desc').slice(0,8),totalCents:parts.reduce((sum,p)=>sum+p.amountCents,0)};
 }
 function approvedBudgets(workspace,policy){
  const out=new Map();
  // Only explicit approved category amounts qualify; recurring components and
  // seeded assistant allowances do not constitute a complete category budget.
  for(const b of policy?.approvedBudgets||[])if(!b.subcategory&&b.status==='approved')out.set(b.category,b.annualCents);
  for(const [id,value] of Object.entries(workspace.budgetGroupOverrides||{}))out.set(workspace.sourceCategoryMappings?.[id]||policy?.categoryAliases?.[id]||id,value);
  return out;
 }
 function subcategoryTotals(category){
  const rows=category.subcategories||[],sum=key=>{const known=rows.filter(row=>Number.isFinite(row[key]));return known.length?known.reduce((n,row)=>n+row[key],0):null;};
  const annualBudget=sum('annualBudget'),spend12=category.spend12===null?null:sum('spend12'),notes=[];
  const unapproved=rows.filter(row=>row.annualBudget===null).length;
  if(unapproved)notes.push(unapproved+' subcategory budget'+(unapproved===1?' is':'s are')+' unapproved or unavailable; shown as — and not added to the approved budget total.');
  if(annualBudget!==category.annualBudget)notes.push('Subcategory budgets do not reconcile with the category budget.');
  if(spend12!==category.spend12)notes.push('Subcategory spending does not reconcile with the category total.');
  return {annualBudget,spend12,notes,budgetReconciles:annualBudget===category.annualBudget,actualReconciles:spend12===category.spend12};
 }
 /** @param {any} model @param {any} workspace @param {any} source @param {any} policy @param {any} lookbackModel */
 function project(model,workspace,source,policy,lookbackModel=null){
  const native=source?.snapshot?.metadata?source.snapshot:null,reportingWindow=native?.metadata.reportingWindow?.kind==='rolling_52_weeks'?native.metadata.reportingWindow:null,end=reportingWindow?.cutoff||native?.metadata.period.end||model.meta.coverageEnd;
  const start12=reportingWindow?dayShift(end,-363):monthShift(end.slice(0,7),-11)+'-01',start3=reportingWindow?dayShift(end,-90):monthShift(end.slice(0,7),-2)+'-01';
  const current=model.rows.filter(t=>!native||t.sourceState==='current'),parts=current.flatMap(EffectiveLedger.partsFor).filter(p=>EffectiveLedger.included(p));
  const approved=approvedBudgets(workspace,policy),activeProposal=approved.size===0&&policy?.budgetProposal?.status==='proposed'?policy.budgetProposal:null,proposed=new Map((activeProposal?.categoryBudgets||[]).filter(b=>!b.subcategory).map(b=>[b.category,b.annualCents])),budgets=new Map([...proposed,...approved]),budgeted=new Set(budgets.keys()),planIsProposed=[...budgets.keys()].some(id=>!approved.has(id)),budgetLabel=planIsProposed?'Proposed annual budget':'Annual budget';
  const covers=a=>!!native&&native.metadata.period.start<=a&&(!reportingWindow||(native.metadata.period.end>=end&&native.metadata.transactionCoverage?.is_complete_for_query===true&&native.metadata.transactionPagesComplete!==false));
  const spend=(a,b=end,cat=null,sub=null)=>parts.filter(t=>inWindow(t,a,b)&&(!cat||t.category===cat)&&(sub===null||t.subcategory===sub)).reduce((s,t)=>s+t.amountCents,0);
  const approvedSpend=a=>parts.filter(t=>inWindow(t,a,end)&&budgeted.has(t.category)).reduce((s,t)=>s+t.amountCents,0);
  const fullThree=covers(start3)&&(!!reportingWindow||end===monthEnd(end.slice(0,7)));
  const metrics={spend12:covers(start12)?spend(start12):null,budgetedSpend12:budgets.size&&covers(start12)?approvedSpend(start12):null,spend3:fullThree?spend(start3):null,annualized3:fullThree?spend(start3)*4:null,annualBudget:budgets.size?[...budgets.values()].reduce((a,b)=>a+b,0):null};
  const subGroup=(category,sub)=>reportingSubcategory({category,subcategory:sub},{policy});
  const categories=model.categories.filter(c=>parts.some(p=>p.category===c.id)||budgets.has(c.id)).map(c=>{
   const catParts=parts.filter(p=>p.category===c.id),proposal=(activeProposal?.categoryBudgets||[]).filter(b=>b.category===c.id),approvedSubs=(policy?.approvedBudgets||[]).filter(b=>b.status==='approved'&&b.category===c.id&&b.subcategory),components=approved.has(c.id)?approvedSubs:proposal,subs=[...new Set([...catParts.map(p=>subGroup(c.id,p.subcategory)),...components.filter(b=>b.subcategory).map(b=>subcategoryLabel(b.subcategory))])].sort();
   const subcategories=subs.map(sub=>{const actual=catParts.filter(p=>subGroup(c.id,p.subcategory)===sub),budget=components.find(b=>b.subcategory&&subcategoryLabel(b.subcategory)===sub);return {name:sub,note:reportingGroups(policy).find(g=>g.category===c.id&&subcategoryLabel(g.name)===sub)?.note||'',spend12:covers(start12)&&actual.length?actual.filter(p=>inWindow(p,start12,end)).reduce((s,p)=>s+p.amountCents,0):null,annualized3:fullThree&&actual.length?actual.filter(p=>inWindow(p,start3,end)).reduce((s,p)=>s+p.amountCents,0)*4:null,annualBudget:budget?.annualCents??null,basis:budget?.authority||budget?.basis||'Historical actual; no recurring allowance.'};});
   return {...c,annualBudget:budgets.get(c.id)??null,spend12:covers(start12)&&catParts.length?spend(start12,end,c.id):null,annualized3:fullThree&&catParts.length?spend(start3,end,c.id)*4:null,subcategories};
  });
  const context=lookbackModel?.context,contextStart=monthShift(start12.slice(0,7),-2)+'-01',contextEnd=monthEnd(monthShift(start12.slice(0,7),-1));
  const accountScope=new Set(context?.coverage.accountIds||[]),requiredAccounts=new Set((native?.transactions||[]).map(t=>t.accountId));
  const contextMatches=!!context&&context.period.start===contextStart&&context.period.end===contextEnd&&!lookbackModel.sourceOverlaps&&[...requiredAccounts].every(id=>accountScope.has(id));
  const contextParts=contextMatches?lookbackModel.parts.filter(t=>inWindow(t,contextStart,contextEnd)&&EffectiveLedger.included(t)):[];
  const completeMonth=month=>{const a=month+'-01',b=monthEnd(month);if(a>=start12)return !!native&&a>=native.metadata.period.start&&b<=end&&native.metadata.transactionCoverage?.is_complete_for_query===true&&native.metadata.transactionPagesComplete!==false;return contextMatches&&context.coverage.queryComplete===true&&context.coverage.months.some(m=>m.month===month&&m.complete===true);};
  const averageAvailable=month=>[0,-1,-2].every(offset=>completeMonth(monthShift(month,offset)));
  const averageSpend=(a,b,cat)=>[...parts,...contextParts].filter(t=>inWindow(t,a,b)&&t.category===cat).reduce((s,t)=>s+t.amountCents,0);
  const orderedChartCategories=[...categories,...(lookbackModel?.categories||[]).filter(c=>contextParts.some(t=>t.category===c.id)&&!categories.some(v=>v.id===c.id))].sort((a,b)=>(b.spend12??0)-(a.spend12??0)||a.id.localeCompare(b.id));
  const chartCategories=orderedChartCategories.map((c,i)=>({...c,color:sequentialColor(i,orderedChartCategories.length)}));
  return {model,workspace,source,policy,native,reportingWindow,yearLabel:reportingWindow?'52-week':'12-month',shortLabel:reportingWindow?'13-week':'3-month',end,start12,start3,current,parts,budgets,approvedBudgets:approved,planIsProposed,budgetLabel,categories,chartCategories,metrics,covers,spend,fullThree,lookbackModel,contextMatches,contextParts,averageAvailable,averageSpend};
 }
 function chart(p,selected){return months(p.end,12).map(month=>{
  const end=monthEnd(month)<p.end?monthEnd(month):p.end,rows=p.chartCategories.filter(c=>selected.has(c.id)).map(c=>({id:c.id,name:c.name,color:c.color,spend:p.covers(month+'-01')?p.spend(month+'-01',end,c.id):null,average:p.averageAvailable(month)?p.averageSpend(monthShift(month,-2)+'-01',end,c.id)/3:null,budget:p.budgets.has(c.id)?p.budgets.get(c.id)/12:null}));
  const sum=key=>rows.reduce((a,r)=>a+(r[key]??0),0);
  return {month,rows,spend:p.covers(month+'-01')?sum('spend'):null,average:rows.length&&rows.every(r=>r.average!==null)?rows.reduce((total,r)=>total+p.averageSpend(monthShift(month,-2)+'-01',end,r.id),0)/3:null,budget:rows.some(r=>r.budget!==null)?sum('budget'):null};
 });}
 // Calendar bars have separate boundaries from the complete-week metrics.
 function calendarChart(p,selected,asOf=new Date().toISOString()){
  const endExclusive=p.reportingWindow?dayShift(p.end,1):null,anchorMonth=endExclusive?endExclusive.slice(0,7):localDate(asOf).slice(0,7),partialMonth=endExclusive?(endExclusive.endsWith('-01')?null:p.end.slice(0,7)):anchorMonth,completedEnd=monthEnd(monthShift(anchorMonth,-1)),labels=[...months(completedEnd,12),...(partialMonth?[partialMonth]:[])],scope=p.native?.metadata;
  return labels.map(month=>{
   const partial=month===partialMonth,start=month+'-01',end=partial?(scope?.period.end<monthEnd(month)?scope.period.end:monthEnd(month)):monthEnd(month);
   const available=!!scope&&scope.period.start<=start&&scope.period.end>=end&&end>=start&&scope.transactionCoverage?.is_complete_for_query===true&&scope.transactionPagesComplete!==false;
   const rows=p.chartCategories.filter(c=>selected.has(c.id)).map(c=>({id:c.id,name:c.name,color:c.color,spend:available?p.spend(start,end,c.id):null,transactionCount:available?new Set(p.parts.filter(t=>t.category===c.id&&inWindow(t,start,end)&&t.amountCents!==0).map(t=>t.id)).size:null,budget:p.budgets.has(c.id)?p.budgets.get(c.id)/12:null}));
   return {month,partial,complete:!partial&&available,available,through:available?end:null,rows,spend:available?rows.reduce((sum,r)=>sum+r.spend,0):null,budget:rows.some(r=>r.budget!==null)?rows.reduce((sum,r)=>sum+(r.budget??0),0):null};
  });
 }
 function range(p,period){const m=p.end.slice(0,7);return {start:period==='1M'?m+'-01':period==='3M'?p.start3:period==='YTD'?p.end.slice(0,4)+'-01-01':period==='ALL'?'0000-01-01':p.start12,end:period==='ALL'?'9999-12-31':p.end};}
 function filterTransactions(p,{period='12M',selected=new Set(p.model.categories.map(c=>c.id)),search='',sortKey='date',sortDirection='desc',reviewOnly=false,excludedSubcategories=new Set()}={}){
  const r=range(p,period),q=search.trim().toLowerCase(),categoryName=t=>EffectiveLedger.partsFor(t).map(x=>p.model.categories.find(c=>c.id===x.category)?.name||x.category).join(', ');
  const options={selected,excludedSubcategories};
  const rows=(period==='ALL'?p.model.rows:p.current).filter(t=>inWindow(t,r.start,r.end)&&(!reviewOnly||t.review?.length)&&matchingParts(p,t,options).length&&(!q||[t.date,t.merchant,t.label,t.account,t.note,t.amountCents/100,categoryName(t),subcategories(t,p),subcategories(t)].join(' ').toLowerCase().includes(q)));
  const value=t=>sortKey==='actual'?actualCents(p,t,options):sortKey==='amount'?t.amountCents:sortKey==='account'?String(t.account||'').toLowerCase():sortKey==='merchant'?t.merchant.toLowerCase():sortKey==='category'?categoryName(t).toLowerCase():sortKey==='subcategory'?subcategories(t,p).toLowerCase():t.date;
  return rows.sort((a,b)=>{const x=value(a),y=value(b),n=typeof x==='number'?x-y:String(x).localeCompare(String(y));return (sortDirection==='asc'?n:-n)||a.id.localeCompare(b.id);});
 }
 function csv(p,rows,options={}){
  const quote=x=>'"'+String(x??'').replace(/^[=+@-]/,c=>"'"+c).replaceAll('"','""')+'"';
  const header=['Date','Merchant','Account','Category','Subcategory','Amount USD','Transaction ID','Source ID','Classification','Source coverage','Source period start','Source period end','Collected at','Allocations','Spending inclusion','Effective detail subcategory','Selected allocation USD','Actual spending USD','Excluded allocation USD'];
  const data=rows.map(t=>{const ps=EffectiveLedger.partsFor(t),s=transactionTotals(p,[t],options);return [t.date,t.merchant,t.account,[...new Set(ps.map(x=>p.model.categories.find(c=>c.id===x.category)?.name||x.category))].join(' / '),subcategories(t,p),(t.amountCents/100).toFixed(2),t.id,t.sourceId||'',t.treatment,t.sourceState==='current'?(p.native?.metadata.transactionCoverage?.is_complete_for_query?'Complete query; account coverage may be partial':'Partial / unverified coverage'):'Retained historical record',p.native?.metadata.period.start||'',p.native?.metadata.period.end||'',p.native?.metadata.retrievedAt||'',JSON.stringify(ps.map(x=>({category:x.category,subcategory:reportingSubcategory(x,p),effectiveDetailSubcategory:subcategoryLabel(x.subcategory),amountCents:x.amountCents,treatment:x.treatment,includedInSpending:EffectiveLedger.included(x),matchesSelection:allocationMatches(p,x,options)}))),ps.some(x=>x.spendingExclusionCategories?.includes(x.category))?(globalThis.FinanceProfile?.spendingExclusionReason?.(p,ps)||p.policy?.spendingExclusions?.reason||p.model.policy?.spendingExclusions?.reason||'Excluded by category policy'):ps.some(EffectiveLedger.included)?'Included per allocation; actuals retain one-time/discontinued costs and signed refunds':'Excluded from spending',subcategories(t),(s.selectedAllocationCents/100).toFixed(2),(s.actualCents/100).toFixed(2),(s.excludedCents/100).toFixed(2)];});
  return [header,...data].map((row,i)=>row.map((v,j)=>i&&[5,16,17,18].includes(j)?String(v):quote(v)).join(',')).join('\r\n');
 }
 function questionsFor(p,t,onlyOpen=false){const keys=new Set([t.id,t.sourceId].filter(Boolean));return (p.policy?.clarifications||[]).filter(q=>(!onlyOpen||q.status==='open')&&q.sourceKeys?.some(k=>keys.has(k)));}
 function clarificationRows(p){return p.model.rows.map(t=>({transaction:t,questions:questionsFor(p,t,true)})).filter(item=>item.questions.length);}
 function reconciliation(p){return p.categories.map(c=>({category:c.id,spend12:c.spend12,annualized3:c.annualized3,subcategories:c.subcategories.map(s=>{const selected=new Set([c.id]),excludedSubcategories=new Set(subcategoryOptions(p,selected).filter(o=>o.name!==s.name).map(o=>o.key)),options={selected,excludedSubcategories};const twelve=transactionTotals(p,filterTransactions(p,{...options,period:'12M'}),options),three=transactionTotals(p,filterTransactions(p,{...options,period:'3M'}),options);return {subcategory:s.name,tableSpend12Cents:s.spend12,filteredSpend12Cents:twelve.actualCents,transactionCount:twelve.transactionCount,excludedCents:twelve.excludedCents,tableAnnualized3Cents:s.annualized3,filteredAnnualized3Cents:three.actualCents*4,reconciles:(s.spend12===null||s.spend12===twelve.actualCents)&&(s.annualized3===null||s.annualized3===three.actualCents*4)};})}));}
 // The source account collection is the only linked-account inventory. Never use
 // holdings, manual balances or reconciliation groups here.
 function linkedAccounts(native,now=Date.now(),metadata=[]){return (native?.accounts||[]).map(a=>{const raw=a.sourceReportedUpdatedAt,valid=typeof raw==='string'&&/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(raw)&&Number.isFinite(Date.parse(raw))&&Date.parse(raw)<=now;const value=Number.isFinite(a.netBalance)?a.netBalance:Number.isFinite(a.balance)?a.balance:null;const verified=metadata.find(m=>m.accountId===a.id&&m.sourceLabel===a.label&&m.sourceInstitution===a.institution&&m.authority&&m.verifiedAt),institution=verified?.institution||a.institution||'Unknown',base=verified?.name||(a.label?.startsWith(a.institution+' · ')?a.label.slice(a.institution.length+3):a.label)||'Unnamed account',mask=verified?.mask&&/^\d{4}$/.test(verified.mask)?verified.mask:null,name=mask&&!new RegExp('(?:[•*xX]+\\s*|\\b)'+mask+'$').test(base)?base+' ••'+mask:base;return {institution,name,type:a.type?String(a.type).replaceAll('_',' ').replace(/^./,c=>c.toUpperCase()):'Unknown',valueCents:a.currency==='USD'&&value!==null?Math.round(value*100):null,syncedAt:valid?raw:null};});}
 function syncAge(timestamp,now=Date.now()){const at=Date.parse(timestamp);if(!Number.isFinite(at)||at>now)return 'Unknown';const seconds=Math.floor((now-at)/1000);if(seconds<60)return 'Just now';for(const [unit,length] of [['year',31536000],['month',2592000],['day',86400],['hour',3600],['minute',60]])if(seconds>=length){const n=Math.floor(seconds/length);return n+' '+unit+(n===1?'':'s')+' ago';}}
 // Display calculations only: source actuals and budgets remain immutable.
 function budgetDifference(actual,budget,totalBudget){if(!Number.isFinite(actual)||!Number.isFinite(budget))return {cents:null,percent:null,tone:'neutral'};const cents=actual-budget,absolute=Math.abs(cents),neutral=cents===0||(Number.isFinite(totalBudget)&&absolute*100<Math.abs(totalBudget))||absolute*20<Math.abs(budget);return {cents,percent:budget===0?null:cents/budget*100,tone:neutral?'neutral':cents<0?'under':'over'};}
 const allocationVisible=row=>!(row.valueCents===0&&row.targetPercent===0);
 function popoverPosition(anchor,container,width,height,gap=8){const clamp=(n,limit)=>Math.max(gap,Math.min(n,Math.max(gap,limit-gap)));let top=anchor.top-container.top-height-gap;if(top<gap)top=anchor.bottom-container.top+gap;return {left:clamp(anchor.left-container.left+anchor.width/2-width/2,container.width-width),top:clamp(top,container.height-height)};}
 function comparisonValues(row,denominator){const currentCents=Number.isFinite(row?.valueCents)?row.valueCents:null,targetCents=Number.isFinite(row?.targetPercent)&&Number.isFinite(denominator)&&denominator>0?Math.round(denominator*row.targetPercent/100):null;return {currentCents,targetCents,differenceCents:currentCents===null||targetCents===null?null:currentCents-targetCents};}
 function comparisonPopoverPosition(anchor,container,width,height,gap=8){return {left:Math.max(gap,Math.min(anchor.left-container.left+anchor.width/2-width/2,Math.max(gap,container.width-width-gap))),top:Math.max(gap,Math.min(anchor.top-container.top-height-gap,Math.max(gap,container.height-height-gap)))};}
 function compositionTotals(pf){const rows=pf.families||[],known=rows.length>0&&rows.every(r=>Number.isFinite(r.valueCents)),valueCents=known?rows.reduce((n,r)=>n+r.valueCents,0):null;return {valueCents,actualPercent:valueCents!==null&&Number.isFinite(pf.denominator)&&pf.denominator>0?valueCents/pf.denominator*100:null,targetPercent:rows.length&&rows.every(r=>Number.isFinite(r.targetPercent))?rows.reduce((n,r)=>n+r.targetPercent,0):null,reconciles:valueCents!==null&&valueCents===pf.denominator};}
 function targetPresentation(pf){const assigned=(pf.report?.taxonomy||[]).map(r=>r.targetPercent).filter(Number.isFinite),sum=assigned.reduce((n,x)=>n+x,0);return {total:assigned.length&&Math.abs(sum-100)<.000001?100:null,assignedSum:sum,value:target=>Number.isFinite(target)?target:0};}
 function collectionProvenance(native){const m=native?.metadata||{},additions=m.sourceAdditions||[];return (m.reusedAccountHoldingsSnapshot?(additions.length?'Prior accounts and all holdings':'Accounts and holdings')+' reused from collection '+m.reusedAccountHoldingsSnapshot.retrievedAt+'; provider freshness remains unverified.':'')+additions.map(a=>' Added account scope ('+a.accountIds.length+' account'+(a.accountIds.length===1?'':'s')+') collected '+a.accountCollectedAt+'; its transactions collected '+a.transactionsCollectedAt+'. Retained transactions were collected '+a.retainedSourceCollectedAt+'. Collection times do not establish valuation age.').join('');}
 function portfolioMetricInfo(pf){if(globalThis.FinanceProfile?.portfolioMetricInfo)return globalThis.FinanceProfile.portfolioMetricInfo(pf);const dates=(pf.sourceDates||[]).filter(d=>d!=='Unavailable'),valuation=' Account valuation dates: '+(dates.length?dates.join(', '):'unavailable')+'.'+((pf.sourceDates||[]).some(d=>d==='Unavailable')?' Some account valuation dates are unavailable.':'')+' '+(pf.collectionNote||'')+' Collection time does not verify account or holding freshness. Holding-specific classification evidence remains available in account-breakdown details.';return {netWorth:{label:'Total net worth',text:'Total assets minus total liabilities. Includes linked account net balances and explicitly selected manual assets and liabilities. Investment accounts and their holdings are counted once. Unverified manual evidence cannot establish a known total.'},liquidNetWorth:{label:'Liquid net worth',text:pf.liquidity.basis+' This is an estimate based on account and holding types, not verified unrestricted withdrawal value or after-tax proceeds.'},totalAssets:{label:'Total assets',text:'Sum of positive current asset values in this view, including investments, cash and selected manual assets. Account balances and underlying holdings are counted once. Unverified manual evidence cannot establish a known total.'+valuation},totalLiabilities:{label:'Total liabilities',text:'Sum of negative components in the net-worth view, shown as a positive amount. Includes linked credit and loan balances and selected manual liabilities.'}};}
 // Known UI wording only; source names, tickers and canonical keys are untouched.
 const titleLabel=value=>String(value).replace(/\b[a-z][a-z.-]*/gi,(word,offset)=>['vs.'].includes(word.toLowerCase())||offset>0&&['and','by','of','to','for','the','in'].includes(word.toLowerCase())?word.toLowerCase():word.charAt(0).toUpperCase()+word.slice(1));
 // Annualize exactly 91 covered days, independent of calendar-month lengths.
 const annualizedSpend=p=>{const start=dayShift(p.end,-90);return p.covers(start)?p.spend(start,p.end)*4:null;};
 // Sort a display copy so stored classifications, balances and targets retain their order.
 function allocationOrder(pf){
  const descending=rows=>[...rows].sort((a,b)=>{const knownA=Number.isFinite(a.valueCents),knownB=Number.isFinite(b.valueCents);return knownA!==knownB?(knownA?-1:1):knownA?b.valueCents-a.valueCents:0;});
  const families=descending(pf.families),ids=new Set(families.map(f=>f.id));
  return {families,allocation:families.flatMap(f=>descending(pf.allocation.filter(c=>PortfolioModel.familyId(c.id)===f.id))).concat(descending(pf.allocation.filter(c=>!ids.has(PortfolioModel.familyId(c.id)))))};
 }

 const sentenceLabel=value=>({'52-Week Spend':'52-week spend','13-Week Spend':'13-week spend','12-Month Spend':'12 mo. spend','3-Month Spend':'3 mo. spend','Annual Budget':'Annual budget','Liquid Net Worth':'Liquid net worth','Total Assets':'Total assets','Total Liabilities':'Total liabilities','12 Mo':'12 mo.'}[value]||value);
 // Presentation periods never overwrite annual budgets or the underlying ledger.
 function categoryBudgetPeriod(p,period='12M'){
  const selected=['3M','6M','12M'].includes(period)?period:'12M',days={'3M':91,'6M':182,'12M':364}[selected],factor=days/364,start=dayShift(p.end,1-days),available=p.covers(start),totalBudget=Number.isFinite(p.metrics.annualBudget)?p.metrics.annualBudget*factor:null;
  const rows=p.categories.map(c=>({...c,annualBudget:Number.isFinite(c.annualBudget)?c.annualBudget*factor:null,spend12:selected==='12M'?c.spend12:available&&p.parts.some(part=>part.category===c.id)?p.spend(start,p.end,c.id):null}));
  return {period:selected,days,weeks:days/7,start,end:p.end,factor,totalBudget,totalSpend:selected==='12M'?p.metrics.spend12:available?p.spend(start,p.end):null,rows,budgetLabel:selected.slice(0,-1)+' mo. budget',spendLabel:selected.slice(0,-1)+' mo. spend'};
 }
 return {annualizedSpend,titleLabel,allocationOrder,validMonthDay,targetPresentation,collectionProvenance,validMonthOfYear,categoryBudgetPeriod,subcategoryTotals,dateSearch,validDate,validMonth,comparisonValues,comparisonPopoverPosition,compositionTotals,portfolioMetricInfo,sentenceLabel,budgetDifference,allocationVisible,popoverPosition,linkedAccounts,syncAge,project,chart,calendarChart,dayShift,localDate,profileTimezone,range,filterTransactions,csv,money,monthShift,monthEnd,months,sortRows,sortOtherLast,categoryDetails,questionsFor,clarificationRows,subcategoryLabel,subcategories,subcategoryKey,subcategoryOptions,reportingSubcategory,matchingParts,transactionTotals,actualCents,reconciliation,browseTransactions,browsingRange,matchesChips,normalizedSearch,palette,sequentialColor,monthIndexAt,spendingColor,assetColor,stack};
})();
