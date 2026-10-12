import test from 'node:test';import assert from 'node:assert/strict';
import {financeAllocationMappingsSchema} from '../lib/finance-allocation-mapping-schema.ts';
await import('./fixtures/synthetic-profile.js');await import('../public/finance-core/effective-ledger.js');await import('../public/finance-core/read-only-model.js');
const E=globalThis.EffectiveLedger,M=globalThis.FinanceReadModel;
const mapping={fromCategory:'shopping',sourceSubcategories:['Books & news','Old entertainment'],category:'entertainment',subcategory:'Books & news',authority:'Synthetic explicit owner taxonomy instruction'};
const row=(id,category,subcategory,amountCents)=>({id,date:'2026-09-01',merchant:'Synthetic '+id,description:'Synthetic',account:'Synthetic',category,subcategory,amountCents,treatment:'ongoing',label:'Synthetic '+id,note:'Keep note',review:[],evidence:'Synthetic',sourceCategory:category,sourceDetail:'',sourceConfidence:'',linkedTransfer:false,source:'Test',splits:[]});
function fixture(){
 const mixed=row('mixed','shopping','Mixed receipt',10000);mixed.splits=[{id:'book',label:'Exact book',category:'shopping',subcategory:'Books & news',amountCents:4000,treatment:'ongoing'},{id:'food',label:'Exact food',category:'food',subcategory:'Groceries',amountCents:6000,treatment:'ongoing'}];
 const w={meta:{coverageStart:'2025-10-01',coverageEnd:'2026-09-30'},categories:['shopping','entertainment','food','health'].map(id=>({id,name:id,annualCents:0,budgeted:true,note:''})),transactions:[mixed,row('book','shopping','Books & news',2000),row('refund','shopping','Books & news',-500),row('tech','shopping','Tech services',3000)],overrides:{},rules:[]};
 return {w,original:structuredClone(w),policy:{rules:[],categoryAliases:{},categoryNames:{shopping:'Shopping',entertainment:'Entertainment'},allocationMappings:[mapping]}};
}
test('owner taxonomy mappings move exact whole and split allocations without changing receipts or source data',()=>{
 const {w,original,policy}=fixture(),before=JSON.stringify(w),model=E.build(w,null,new Map(),original,policy);
 assert.equal(model.conflictCount,0);assert.deepEqual(model.rows[0].splits.map(p=>[p.id,p.category,p.amountCents,p.treatment]),[['book','entertainment',4000,'ongoing'],['food','food',6000,'ongoing']]);
 assert.equal(model.rows.find(t=>t.id==='tech').category,'shopping');assert.equal(model.rows.find(t=>t.id==='refund').category,'entertainment');assert.equal(E.aggregate(model.parts.filter(E.included)).totalCents,14500);assert.equal(JSON.stringify(w),before);
 for(const t of model.rows){const source=w.transactions.find(x=>x.id===t.id);for(const field of ['id','date','merchant','amountCents','note','label','treatment'])assert.deepEqual(t[field],source[field]);}
});
test('manual item decisions and unrelated mixed-service categories survive taxonomy mapping and refresh',()=>{
 const {w,original,policy}=fixture();w.overrides.book={category:'health',subcategory:'Owner choice'};w.overrides.mixed={splits:[{id:'owner',label:'Owner choice',category:'food',subcategory:'Groceries',amountCents:10000,treatment:'ongoing'}]};
 for(let pass=0;pass<2;pass++){const model=E.build(w,null,new Map(),original,policy);assert.equal(model.rows.find(t=>t.id==='book').category,'health');assert.deepEqual(model.rows.find(t=>t.id==='mixed').splits,w.overrides.mixed.splits);assert.equal(model.rows.find(t=>t.id==='tech').subcategory,'Tech services');w.transactions.push(row('new'+pass,'shopping','Books & news',100));}
 assert.equal(E.build(w,null,new Map(),original,policy).rows.find(t=>t.id==='new0').category,'entertainment');
});
test('taxonomy categories reconcile through filters, CSV, sidebars and chart colors',()=>{
 const {w,original,policy}=fixture(),source={snapshot:{metadata:{period:{start:'2025-10-01',end:'2026-09-30'},retrievedAt:'2026-10-10T00:00:00Z',transactionCoverage:{is_complete_for_query:true}},transactions:[]}};
 const model=E.build(w,null,new Map(),original,policy);model.rows.forEach(t=>t.sourceState='current');const p=M.project(model,w,source,policy);
 const selected=new Set(['entertainment']),options={selected},rows=M.filterTransactions(p,options);assert.equal(rows.length,3);assert.equal(M.transactionTotals(p,rows,options).actualCents,5500);assert.equal(M.categoryDetails(p,'entertainment').totalCents,5500);assert.equal(M.categoryDetails(p,'entertainment').merchants.reduce((n,r)=>n+r.amount,0),5500);assert.ok(M.reconciliation(p).every(c=>c.subcategories.every(s=>s.reconciles)));assert.match(M.csv(p,rows,options),/Entertainment/);
 assert.equal(M.chart(p,selected).reduce((n,m)=>n+m.spend,0),5500);assert.notEqual(M.spendingColor('entertainment'),M.spendingColor('shopping'));assert.equal(M.stack([{id:'entertainment',name:'Entertainment',spend:5500}]).segments[0].color,M.spendingColor('entertainment'));
});
test('taxonomy schema rejects duplicate source keys, empty authority and unexpected fields',()=>{
 assert.equal(financeAllocationMappingsSchema.safeParse([mapping]).success,true);
 for(const rules of [[mapping,mapping],[{...mapping,sourceSubcategories:[]}],[{...mapping,authority:''}],[{...mapping,amountCents:10}]])assert.equal(financeAllocationMappingsSchema.safeParse(rules).success,false);
});
test('owner-declared category supports aliases and exact split moves without editing workspace categories',()=>{
 const {w,original,policy}=fixture();w.categories.push({id:'ai',name:'AI',annualCents:0,budgeted:true,note:''});original.categories=structuredClone(w.categories);
 w.transactions.push(row('ai','ai','OpenAI',20000),{...row('device','shopping','Tech services',50000),treatment:'one_time'});original.transactions=structuredClone(w.transactions);
 policy.categoryNames.technology='Technology';policy.categoryAliases.ai='technology';policy.allocationMappings.push({fromCategory:'shopping',sourceSubcategories:['Tech services'],category:'technology',subcategory:'Tech services',authority:'Synthetic owner instruction'},{fromCategory:'technology',sourceSubcategories:['OpenAI'],category:'technology',subcategory:'AI',authority:'Synthetic owner instruction'});
 const before=JSON.stringify(w),model=E.build(w,null,new Map(),original,policy);assert.equal(model.categories.filter(c=>c.id==='technology').length,1);assert.ok(!model.categories.some(c=>c.id==='ai'));assert.equal(model.rows.find(t=>t.id==='ai').category,'technology');assert.equal(model.rows.find(t=>t.id==='ai').subcategory,'AI');const device=model.rows.find(t=>t.id==='device');assert.equal(device.category,'technology');assert.equal(device.treatment,'one_time');assert.equal(E.included(E.partsFor(device)[0],'ongoing'),false);assert.equal(JSON.stringify(w),before);
});
test('subcategory capitalization stays consistent across groups, filters, budgets, CSV and detail labels',()=>{
 const {w,original,policy}=fixture();w.transactions=[row('medical','health','one-time medical',26000)];original.transactions=structuredClone(w.transactions);policy.approvedBudgets=[{category:'health',subcategory:null,annualCents:0,status:'approved'},{category:'health',subcategory:'one-time medical',annualCents:0,status:'approved'}];policy.budgetProposal={subcategoryGroups:[{category:'health',name:'one-time medical',sourceSubcategories:['one-time medical']}],categoryBudgets:[]};
 const model=E.build(w,null,new Map(),original,policy);model.rows.forEach(t=>t.sourceState='current');const source={snapshot:{metadata:{period:{start:'2025-10-01',end:'2026-09-30'},retrievedAt:'2026-10-10T00:00:00Z',transactionCoverage:{is_complete_for_query:true}}}},p=M.project(model,w,source,policy),t=model.rows[0];assert.equal(M.subcategories(t,p),'One-time medical');assert.equal(M.subcategories(t),'One-time medical');assert.equal(p.categories.find(c=>c.id==='health').subcategories[0].name,'One-time medical');assert.equal(M.subcategoryOptions(p,new Set(['health']))[0].name,'One-time medical');assert.match(M.csv(p,[t]),/One-time medical/);assert.ok(M.reconciliation(p).every(c=>c.subcategories.every(s=>s.reconciles)));assert.equal(w.transactions[0].subcategory,'one-time medical');
});
