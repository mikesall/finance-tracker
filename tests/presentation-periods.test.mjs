import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const ctx={Intl,Date,Map,Set,Number,Math};vm.createContext(ctx);vm.runInContext(readFileSync(new URL('./fixtures/synthetic-profile.js',import.meta.url),'utf8'),ctx);
for(const name of ['effective-ledger','read-only-model','portfolio-model'])vm.runInContext(readFileSync(new URL('../public/finance-core/'+name+'.js',import.meta.url),'utf8'),ctx);
const M=ctx.FinanceReadModel,P=ctx.PortfolioModel;
test('yearless month/day search matches all years, accepts leap days, rejects impossible dates without guessing',()=>{
 const p=fixture();p.native.metadata.period.start='2025-04-01';const row=p.model.rows[0];p.model.rows=[{...row,id:'old',date:'2025-09-16'},{...row,id:'new',date:'2026-09-16'},{...row,id:'wrong',date:'2026-09-17'}];
 for(const q of ['Sep 16','September 16','sEP  16']){assert.deepEqual({...M.dateSearch(q)},{kind:'monthDay',value:'09-16'});assert.deepEqual(Array.from(M.browseTransactions(p,{search:q}),r=>r.id),['new','old']);}
 assert.deepEqual(Array.from(M.browseTransactions(p,{chips:[{kind:'monthDay',value:'09-16'},{kind:'month',value:'2026-09'}]}),r=>r.id),['new']);assert.equal(M.dateSearch('Feb 29').value,'02-29');for(const q of ['Sep 31','Feb 30','Sep 0','Sep 32'])assert.equal(M.dateSearch(q),null);assert.equal(M.dateSearch('Sep 2026').value,'2026-09');assert.equal(M.dateSearch('Sep 16 2026').value,'2026-09-16');
});
test('target presentation shows unassigned zero without mutating unknown classification or normalizing a bad total',()=>{const pf={report:{taxonomy:[{id:'stocks',targetPercent:80},{id:'cash',targetPercent:20},{id:'unknown',targetPercent:null}]}},before=JSON.stringify(pf);const t=M.targetPresentation(pf);assert.equal(t.total,100);assert.equal(t.value(null),0);assert.equal(t.value(20),20);assert.equal(JSON.stringify(pf),before);pf.report.taxonomy[0].targetPercent=79;assert.equal(M.targetPresentation(pf).total,null);assert.equal(M.targetPresentation({}).total,null);});
test('month-only names and unique prefixes match all available years without inventing one',()=>{
 const p=fixture();p.native.metadata.period.start='2025-04-01';const seed=p.model.rows[0];p.model.rows=[{...seed,id:'old',date:'2025-09-02',merchant:'Example market'},{...seed,id:'new',date:'2026-09-02',merchant:'Example market'},{...seed,id:'other',date:'2026-09-03',merchant:'Other store'},{...seed,id:'august',date:'2026-08-02',merchant:'Example market'}];
 for(const text of ['Se','Sep','Sept','Septem','September','sEP']){assert.deepEqual({...M.dateSearch(text)},{kind:'monthOfYear',value:'09'});assert.deepEqual(Array.from(M.browseTransactions(p,{search:text}),r=>r.id),['other','new','old']);}
 for(const text of ['Sep2026','Sep 2026','September2026'])assert.deepEqual(Array.from(M.browseTransactions(p,{search:text}),r=>r.id),['other','new']);
 assert.deepEqual(Array.from(M.browseTransactions(p,{chips:[{kind:'monthOfYear',value:'09'}],search:'example market'}),r=>r.id),['new','old']);
 assert.deepEqual(Array.from(M.browseTransactions(p,{chips:[{kind:'monthOfYear',value:'09'},{kind:'month',value:'2026-09'}],search:'Sep2,2026'}),r=>r.id),['new']);
 assert.equal(M.browseTransactions(p,{search:''}).length,4);for(const text of ['S','Ma','Ju','Septemberland','Feb29 2026','Sep31 2026','2026-13-02'])assert.equal(M.dateSearch(text),null);assert.equal(M.dateSearch('May').value,'05');assert.equal(M.dateSearch('Sep2,2026').value,'2026-09-02');
});
function fixture(end='2026-10-04'){
 const row=(id,days,amountCents,category='food')=>({id,date:M.dayShift(end,days),amountCents,category,subcategory:'Example',merchant:'Example',treatment:'ongoing',sourceState:'current',splits:[]});
 const rows=[row('year-before',-364,99999),row('year-start',-363,1000),row('half-before',-182,2000),row('half-start',-181,3000),row('quarter-before',-91,4000),row('quarter-start',-90,5000),row('refund',-1,-600),row('end',0,700),row('after',1,99999)];
 rows.push({...row('split',-10,10000),splits:[{category:'food',subcategory:'Example',amountCents:2500,treatment:'ongoing'},{category:'shopping',subcategory:'Example',amountCents:7500,treatment:'ongoing'}]});
 rows.push({...row('transfer',-10,50000),treatment:'transfer'});
 const model={rows,categories:[{id:'food',name:'Food'},{id:'shopping',name:'Shopping'}]},workspace={budgetGroupOverrides:{food:120001}},policy={approvedBudgets:[{category:'food',status:'approved',annualCents:999999},{category:'shopping',status:'approved',annualCents:240000}]},source={snapshot:{metadata:{period:{start:M.dayShift(end,-500),end},reportingWindow:{kind:'rolling_52_weeks',cutoff:end},transactionCoverage:{is_complete_for_query:true},transactionPagesComplete:true}}};
 return M.project(model,workspace,source,policy);
}
test('3M/6M/12M use inclusive 91/182/364-day windows, signed refunds and selected split allocations',()=>{
 const p=fixture(),before=JSON.stringify({rows:p.model.rows,categories:p.categories,metrics:p.metrics,workspace:p.workspace});
 const expected={'3M':15100,'6M':22100,'12M':25100};
 for(const period of ['3M','6M','12M']){const v=M.categoryBudgetPeriod(p,period);assert.equal(v.totalSpend,expected[period]);assert.equal(v.rows.reduce((sum,c)=>sum+c.spend12,0),v.totalSpend);assert.equal(v.totalBudget,360001*v.factor);assert.equal(v.rows[0].annualBudget,120001*v.factor);assert.equal(v.rows[1].spend12,7500);assert.equal((Date.parse(v.end)-Date.parse(v.start))/86400000+1,v.days);}
 assert.equal(M.categoryBudgetPeriod(p,'6M').start,'2026-04-06');assert.equal(JSON.stringify({rows:p.model.rows,categories:p.categories,metrics:p.metrics,workspace:p.workspace}),before);
 assert.equal(M.browseTransactions(p).length,10);assert.equal(p.metrics.annualBudget,360001);
});
test('period thresholds use prorated row AND total budgets without rounding comparisons',()=>{
 const p=fixture(),v=M.categoryBudgetPeriod(p,'3M'),row=v.rows[0];
 assert.equal(M.budgetDifference(row.annualBudget+1000,row.annualBudget,v.totalBudget).tone,'neutral');
 assert.equal(M.budgetDifference(row.annualBudget+2000,row.annualBudget,v.totalBudget).tone,'over');
 assert.equal(M.budgetDifference(1000,0,v.totalBudget).percent,null);
 assert.equal(M.budgetDifference(10900,10000,90000).tone,'over');
 assert.equal(M.budgetDifference(10899,10000,90000).tone,'neutral');
});
test('incomplete coverage, unavailable budgets and absent category actuals remain unknown',()=>{
 const p=fixture();p.native.metadata.transactionCoverage.is_complete_for_query=false;p.categories[0].annualBudget=null;
 const v=M.categoryBudgetPeriod(p,'6M');assert.equal(v.totalSpend,null);assert.ok(v.rows.every(c=>c.spend12===null));assert.equal(v.rows[0].annualBudget,null);
 p.native.metadata.transactionCoverage.is_complete_for_query=true;p.categories.push({id:'empty',name:'Empty',annualBudget:null,spend12:null});assert.equal(M.categoryBudgetPeriod(p,'3M').rows.at(-1).spend12,null);
 assert.equal(M.categoryBudgetPeriod(p,'bad').period,'12M');
});
test('presentation dates remain exact across DST, year boundaries and leap days',()=>{
 for(const end of ['2024-03-10','2024-11-03','2026-01-04'])for(const period of ['3M','6M','12M']){const v=M.categoryBudgetPeriod(fixture(end),period);assert.equal((Date.parse(v.end)-Date.parse(v.start))/86400000+1,v.days);assert.equal(new Date(v.start+'T12:00:00Z').getUTCDay(),1);}
});
const base=()=>({report:{taxonomy:[{id:'cash'},{id:'us_stock'}],cashAssetClassId:'cash'},depository:100,denominator:1001,allocationRoundingAdjustmentCents:1,allocation:[{id:'us_stock',label:'Stock',valueCents:900,actualPercent:900/1001*100,targetPercent:80},{id:'cash',label:'Cash',valueCents:100,actualPercent:100/1001*100,targetPercent:20},{id:'unclassified',label:'Unknown',valueCents:1,actualPercent:1/1001*100,targetPercent:null}],groups:[{assetClassId:'us_stock'}],netRows:[],metrics:{netWorth:1001}});
test('one-cent bookkeeping artifacts disappear only from presentation; a real one-cent unknown survives',()=>{
 const pf=base(),before=JSON.stringify(pf),view=P.display(pf);assert.equal(view.allocation.length,2);assert.equal(view.families.some(f=>f.id==='unclassified'),false);assert.equal(M.compositionTotals(view).valueCents,1000);assert.equal(view.denominator,1001);assert.equal(view.metrics.netWorth,1001);assert.equal(JSON.stringify(pf),before);
 pf.groups.push({assetClassId:'unclassified'});assert.ok(P.display(pf).allocation.some(c=>c.id==='unclassified'));
 pf.groups.pop();pf.allocation.at(-1).valueCents=2;assert.ok(P.display(pf).allocation.some(c=>c.id==='unclassified'));
 pf.allocation.at(-1).valueCents=null;assert.ok(P.display(pf).allocation.some(c=>c.id==='unclassified'));
});
test('Cash and Liabilities are display-only parents, preserve signed children, and do not merge noncash funds',()=>{
 const pf=base();pf.netRows=[
  {key:'bank',kind:'balance',security:'Cash',name:'Savings',valueCents:100,accounts:[]},
  {key:'cash-a',kind:'security',security:'Cash',assetClass:'Cash',valueCents:200,rows:[{isCashEquivalent:true}],accounts:[{id:'broker',name:'Brokerage',valueCents:200}]},
  {key:'cash-b',kind:'security',security:'Cash',assetClass:'Cash',valueCents:300,rows:[{securityType:'cash'}],accounts:[{id:'broker',name:'Brokerage',valueCents:300}]},
  {key:'fund',kind:'security',security:'FUND',assetClass:'Cash',valueCents:400,rows:[{isCashEquivalent:false,securityType:'etf'}],accounts:[]},
  {key:'credit',kind:'balance',security:'Liability',name:'Credit',valueCents:-50},
  {key:'loan',kind:'balance',security:'Liability',name:'Loan',valueCents:-100},
  {key:'credit-balance',kind:'balance',security:'Liability',name:'Credit balance',valueCents:10},
  {key:'manual:mortgage',kind:'manual',name:'Mortgage',valueCents:-200},
  {key:'manual:home',kind:'manual',name:'Home',valueCents:500},
  {key:'rounding',kind:'reconciliation',valueCents:1}
 ];
 const before=JSON.stringify(pf),view=P.display(pf),cash=view.netRows.find(r=>r.key==='display:cash'),liabilities=view.netRows.find(r=>r.key==='display:liabilities');
 assert.equal(cash.valueCents,600);assert.equal(cash.accounts.length,2);assert.equal(cash.accounts.find(a=>a.id==='broker').valueCents,500);assert.equal(liabilities.valueCents,-340);assert.equal(liabilities.accounts.length,4);assert.equal(cash.accounts.reduce((n,a)=>n+a.valueCents,0),cash.valueCents);assert.equal(liabilities.accounts.reduce((n,a)=>n+a.valueCents,0),liabilities.valueCents);
 assert.equal(view.netRows.length,4);assert.ok(view.netRows.some(r=>r.key==='fund'));assert.equal(view.netRows.reduce((n,r)=>n+r.valueCents,0),pf.netRows.reduce((n,r)=>n+r.valueCents,0)-1);assert.equal(JSON.stringify(pf),before);
 pf.netRows[0].valueCents=null;assert.equal(P.display(pf).netRows.find(r=>r.key==='display:cash').valueCents,null);
});
