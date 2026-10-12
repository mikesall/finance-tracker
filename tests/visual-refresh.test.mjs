import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const context={Intl,Date,Map,Set};vm.createContext(context);
vm.runInContext(readFileSync(new URL('./fixtures/synthetic-profile.js',import.meta.url),'utf8'),context);
for(const file of ['read-only-model','portfolio-model'])vm.runInContext(readFileSync(new URL('../public/finance-core/'+file+'.js',import.meta.url),'utf8'),context);
const M=context.FinanceReadModel;
test('gradient samples both sides of the requested cyan stop, with exact endpoints for any count',()=>{
 assert.deepEqual(Array.from({length:5},(_,i)=>M.sequentialColor(i,5)),['#0456de','#0298ef','#00d8fe','#07ece3','#0dffc7']);
 assert.equal(M.sequentialColor(4952,10001),'#00d8ff');
 for(const count of [2,3,8,17]){assert.equal(M.sequentialColor(0,count),'#0456de');assert.equal(M.sequentialColor(count-1,count),'#0dffc7');}
 assert.equal(M.sequentialColor(0,1),'#0456de');
});
test('annualized metric includes exactly 91 days and keeps missing coverage unknown',()=>{
 let from,to;const p={end:'2026-09-30',covers:start=>start==='2026-07-02',spend:(start,end)=>{from=start;to=end;return 123456;}};
 assert.equal(M.annualizedSpend(p),493824);assert.equal(from,'2026-07-02');assert.equal(to,'2026-09-30');
 assert.equal(M.annualizedSpend({...p,covers:()=>false}),null);assert.equal(M.annualizedSpend({...p,spend:()=>0}),0);assert.equal(M.annualizedSpend({...p,spend:()=>-1200}),-4800);
});
test('pie families and children descend by current allocation, with stable ties and no mutation',()=>{
 const pf={families:[{id:'cash',valueCents:200},{id:'real_assets',valueCents:300},{id:'equity',valueCents:500},{id:'debt',valueCents:300},{id:'unclassified',valueCents:null}],allocation:[{id:'cash',valueCents:200},{id:'domestic_stock',valueCents:100},{id:'global_stock',valueCents:400},{id:'property_fund',valueCents:300},{id:'bonds',valueCents:150},{id:'credit',valueCents:150},{id:'unclassified',valueCents:null}]},before=JSON.stringify(pf),ordered=M.allocationOrder(pf);
 assert.deepEqual(Array.from(ordered.families,f=>f.id),['equity','real_assets','debt','cash','unclassified']);
 assert.deepEqual(Array.from(ordered.allocation,c=>c.id),['global_stock','domestic_stock','property_fund','bonds','credit','cash','unclassified']);assert.equal(JSON.stringify(pf),before);
});
test('presentation titles use title case while retaining units and acronyms',()=>{
 for(const [before,after] of [['12 mo. spend','12 Mo. Spend'],['3 mo. spend, annualized','3 Mo. Spend, Annualized'],['Budget by category','Budget by Category'],['Actual vs. target','Actual vs. Target'],['Total net worth','Total Net Worth'],['USD amount','USD Amount']])assert.equal(M.titleLabel(before),after);
});
