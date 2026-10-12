import test from 'node:test';
import assert from 'node:assert/strict';
import {financePolicyRuleSchema} from '../lib/finance-policy-rule-schema.ts';
await import('../public/finance-core/effective-ledger.js');
const E=globalThis.EffectiveLedger;
const part=(id,category,amountCents)=>({id,label:id,category,subcategory:id,amountCents,treatment:'ongoing'});
const fixture=()=>{
 const row={id:'saved',date:'2026-09-01',amountCents:10000,merchant:'Synthetic merchant',description:'Synthetic merchant',account:'Synthetic',category:'shopping',subcategory:'Unitemized',treatment:'ongoing',label:'Mixed receipt',note:'Saved note',review:[],evidence:'Synthetic',sourceCategory:'Shopping',sourceDetail:'',sourceConfidence:'',linkedTransfer:false,source:'Test',splits:[part('seed-food','food',1000),part('seed-rest','shopping',9000)]};
 const workspace={meta:{},categories:['shopping','food','health'].map(id=>({id,name:id,annualCents:0,budgeted:true,note:''})),transactions:[row],overrides:{},rules:[]};
 const source={metadata:{retrievedAt:'2026-10-01T00:00:00Z',period:{start:'2026-09-01',end:'2026-09-30'},warnings:[]},accounts:[],transactions:[{id:'exact-source',date:row.date,amount:100,merchant:row.merchant,account:row.account,reportingCategory:'Shopping',sourceDetailedCategory:'',sourceCategory:'',sourceConfidence:'',hasTransferLink:false,flags:[],classificationBasis:'Synthetic',kind:'expense_payment',ongoingTreatment:'unresolved'}]};
 const rule={id:'receipt',sourceKeys:['exact-source'],onDate:row.date,amountCents:10000,merchantPattern:'^Synthetic merchant$',direction:'outflow',category:'shopping',subcategory:'Mixed receipt',priority:100,scope:'merchant',note:'Verified receipt',splits:[part('food','food',1000),part('health','health',5000),part('shopping','shopping',4000)]};
 return {workspace,original:structuredClone(workspace),source,rule,aliases:new Map([['exact-source','saved']])};
};
const build=f=>E.build(f.workspace,f.source,f.aliases,f.original,{rules:[f.rule]});
test('receipt rule rejects missing identity guards, duplicate allocations, mismatched totals and signs',()=>{
 const {rule}=fixture();assert.equal(financePolicyRuleSchema.safeParse(rule).success,true);
 for(const edit of [r=>delete r.sourceKeys,r=>delete r.onDate,r=>delete r.amountCents,r=>r.onDate='2026-02-30',r=>r.splits[0].id=r.splits[1].id,r=>r.splits[0].amountCents++,r=>{r.splits[0].amountCents=-1000;r.splits[1].amountCents+=2000;}]){const r=structuredClone(rule);edit(r);assert.equal(financePolicyRuleSchema.safeParse(r).success,false);}
});
test('exact receipt replaces only seed allocations and never duplicates payments or changes source',()=>{
 const f=fixture(),before=JSON.stringify([f.workspace,f.source]),m=build(f);assert.equal(m.rows.length,1);assert.deepEqual(m.rows[0].splits,f.rule.splits);assert.equal(E.aggregate(m.parts.filter(E.included)).totalCents,10000);assert.equal(m.rows[0].amountCents,10000);assert.equal(m.rows[0].sourceId,'exact-source');assert.ok(!m.rows[0].review.some(x=>x.startsWith('Historical split retained')));assert.equal(JSON.stringify([f.workspace,f.source]),before);
 const refreshed=structuredClone(f.source);refreshed.metadata.retrievedAt='2026-10-08T00:00:00Z';f.source=refreshed;assert.deepEqual(build(f).rows[0].splits,f.rule.splits);
});
test('source amount, date and identity changes do not inherit receipt-specific allocations',()=>{
 for(const change of [f=>f.source.transactions[0].amount=101,f=>f.source.transactions[0].date='2026-09-02',f=>{f.source.transactions[0].id='future';f.aliases=new Map([['future','saved']]);}]){const f=fixture();change(f);const m=build(f);assert.deepEqual(m.rows[0].splits,f.original.transactions[0].splits);assert.deepEqual(m.rows[0].appliedPolicyRules,[]);if(f.source.transactions[0].amount===101)assert.equal(m.rows[0].splitConflict,true);}
});
test('direct saved split edits and explicit item overrides survive policy and source refresh',()=>{
 for(const direct of [true,false]){const f=fixture(),parts=[part('owner','health',10000)];if(direct)f.workspace.transactions[0].splits=parts;else f.workspace.overrides.saved={splits:parts,splitBasisCents:10000};assert.deepEqual(build(f).rows[0].splits,parts);}
});
test('storage field order does not turn an unchanged seeded split into a manual edit',()=>{
 const f=fixture();f.workspace.transactions[0].splits=f.workspace.transactions[0].splits.map(p=>Object.fromEntries(Object.entries(p).reverse()));
 const m=build(f);assert.deepEqual(m.rows[0].splits,f.rule.splits);assert.ok(!m.rows[0].review.some(x=>x.startsWith('Historical split retained')));
 f.workspace.transactions[0].splits[0].amountCents+=100;f.workspace.transactions[0].splits[1].amountCents-=100;assert.deepEqual(build(f).rows[0].splits,f.workspace.transactions[0].splits);
});
