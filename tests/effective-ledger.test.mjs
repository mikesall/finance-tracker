import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';
await import('../public/finance-core/effective-ledger.js');const E=globalThis.EffectiveLedger;
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const sourceId=id=>'txn_'+createHash('sha256').update(id).digest('hex').slice(0,24);
const category=id=>({id,name:id,annualCents:0,note:'',budgeted:true});
const row=(id,extras={})=>({id,date:'2026-09-02',amountCents:10000,merchant:'Synthetic vendor',description:'Synthetic',account:'Synthetic account',category:'services',subcategory:'',treatment:'ongoing',label:'Synthetic vendor',note:'',review:[],evidence:'Synthetic',sourceCategory:'services',sourceDetail:'',sourceConfidence:'',linkedTransfer:false,source:'Synthetic fixture',splits:[],...extras});
const source=(id,extras={})=>({id:sourceId(id),date:'2026-09-02',merchant:'Synthetic vendor',account:'Synthetic account',amount:100,reportingCategory:'Services',kind:'expense_payment',ongoingTreatment:'unassessed',flags:[],classificationBasis:'Validated fixture',sourceCategory:'services',sourceDetailedCategory:null,sourceConfidence:'high',hasTransferLink:false,...extras});
const split=[{id:'p1',label:'Food',category:'food',subcategory:'',amountCents:3000,treatment:'ongoing'},{id:'p2',label:'Shopping',category:'shopping',subcategory:'',amountCents:7000,treatment:'one_time'}];
const workspace=()=>({meta:{coverageStart:'2026-01-01',coverageEnd:'2026-09-30'},transactions:[row('old1'),row('old2',{splits:structuredClone(split)}),row('retained',{date:'2026-02-02'})],categories:['services','ai','food','shopping','other','housing'].map(category),overrides:{old1:{category:'food',note:'Keep my edit'}},rules:[{id:'r1',merchant:'Synthetic vendor',category:'ai',subcategory:'User rule'}],audit:[],budgetHistory:[]});
const native=transactions=>({metadata:{period:{start:'2026-09-01',end:'2026-09-30'},retrievedAt:'2026-10-01T00:00:00Z',sourceFreshness:'Unverified',warnings:[]},accounts:[],transactions});
const aliases=new Map(['old1','old2','retained'].map(id=>[sourceId(id),id]));
test('two refreshes admit new records once, retain edits and raw source, apply precedence, preserve history',()=>{
 const w=workspace(),original=structuredClone(w);original.overrides={};original.rules=[];const wh=hash(w);
 const first=native([source('old1'),source('old2'),source('new1')]);const before=hash(first);
 const a=E.build(w,first,aliases,original),retry=E.build(w,first,aliases,original);assert.deepEqual(a,retry);assert.equal(hash(w),wh);assert.equal(hash(first),before);
 assert.equal(a.rows.find(t=>t.id==='old1').category,'food');assert.equal(a.rows.find(t=>t.id===sourceId('new1')).category,'ai');assert.deepEqual(a.rows.find(t=>t.id==='old2').splits,split);
 assert.equal(a.rows.find(t=>t.id==='retained').sourceState,'not_in_current_snapshot');
 const second=native([source('old1'),source('old2'),source('new1'),source('new2')]);const b=E.build(w,second,aliases,original);
 assert.equal(new Set(b.rows.map(t=>t.id)).size,b.rows.length);assert.equal(b.rows.length,a.rows.length+1);assert.equal(b.rows.find(t=>t.id==='old1').note,'Keep my edit');assert.equal(hash(w),wh);assert.equal(b.economicSpendingCents,null);assert.equal(b.ongoingBaselineCents,null);
 const parts=b.parts.filter(p=>p.sourceState==='current'&&E.included(p));const totals=E.aggregate(parts);
 assert.equal(totals.totalCents,Object.values(totals.byCategory).reduce((a,b)=>a+b,0));assert.equal(totals.totalCents,Object.values(totals.byMonth).reduce((a,b)=>a+b,0));assert.equal(totals.totalCents,40000);
});
test('changed split amounts remain intact and totals use current unallocated amount exactly once',()=>{
 const w=workspace(),old=structuredClone(w),n=native([source('old2',{amount:110})]);const v=E.build(w,n,aliases,old);const t=v.rows.find(t=>t.id==='old2');assert.equal(t.splitConflict,true);assert.deepEqual(t.splits,split);assert.deepEqual(w,old);
 const parts=v.parts.filter(p=>p.sourceState==='current');assert.equal(parts.length,1);assert.equal(parts[0].amountCents,11000);assert.equal(parts[0].category,'other');assert.equal(E.included(parts[0]),true);assert.equal(E.included(parts[0],'ongoing'),false);
});
test('saved repair tied to current amount survives refresh while a subsequent amount change conflicts again',()=>{
 const w=workspace();w.overrides.old2={splits:[{...split[0],amountCents:4000},split[1]],splitBasisCents:11000};const n=native([source('old2',{amount:110})]);const a=E.build(w,n,aliases,workspace());assert.equal(a.rows.find(t=>t.id==='old2').splitConflict,false);
 const b=E.build(w,native([source('old2',{amount:120})]),aliases,workspace());assert.equal(b.rows.find(t=>t.id==='old2').splitConflict,true);assert.equal(w.overrides.old2.splits[0].amountCents,4000);
});
test('fresh IDs can be edited durably without mutating the snapshot; category merges survive future data',()=>{
 const w=workspace(),n=native([source('new')]);let a=E.build(w,n,aliases,w);const t=a.rows.find(t=>t.sourceId===sourceId('new'));w.transactions.push(E.persistableBase(t));w.overrides[t.id]={category:'shopping',note:'My new item'};
 a=E.build(w,n,aliases,workspace());assert.equal(a.rows.filter(r=>r.sourceId===t.sourceId).length,1);assert.equal(a.rows.find(r=>r.id===t.id).category,'shopping');assert.equal(n.transactions[0].reportingCategory,'Services');
 w.rules=[];w.categories=w.categories.filter(c=>c.id!=='services');w.sourceCategoryMappings={services:'shopping'};a=E.build(w,native([source('future')]),aliases,workspace());assert.equal(a.rows.find(r=>r.sourceId===sourceId('future')).category,'shopping');
});
test('Example tax service recurrence and nutrition mapping stay flagged without deleting retained decisions',()=>{
 const w=workspace();w.transactions.push(row('example-service',{merchant:'Example tax service',category:'housing',treatment:'one_time'}));const original=structuredClone(w);const map=new Map([...aliases,[sourceId('example-service'),'example-service']]);const a=E.build(w,native([source('example-service',{merchant:'Example tax service',reportingCategory:'Housing'}),source('old2')]),map,original,{issuedAt:'2026-10-10T00:00:00Z',categoryAliases:{},categoryNames:{},plans:[],rules:[{id:'recurrence-unknown',merchantPattern:'^Example tax service$',direction:'any',category:'housing',subcategory:'Property tax',treatment:'unassessed',priority:1,scope:'merchant',note:'Example tax service recurrence is unresolved'}]});
 assert.equal(a.rows.find(t=>t.id==='example-service').treatment,'unassessed');assert.equal(w.transactions.at(-1).treatment,'one_time');assert.match(a.rows.find(t=>t.id==='example-service').review.join(' '),/recurrence is unresolved/);assert.match(a.rows.find(t=>t.id==='old2').review.join(' '),/exact mixed-order receipt mapping/);assert.deepEqual(a.rows.find(t=>t.id==='old2').splits,split);
});
test('direct base edits and exact merchant rules have explicit priority; source category is never overwritten',()=>{
 const original=workspace(),w=structuredClone(original);w.transactions[0].category='shopping';w.overrides={};const n=native([source('old1')]);const a=E.build(w,n,aliases,original);assert.equal(a.rows.find(t=>t.id==='old1').category,'shopping');assert.equal(n.transactions[0].reportingCategory,'Services');
 const caseDiff=E.build(w,native([source('new',{merchant:'synthetic vendor'})]),aliases,original);assert.equal(caseDiff.rows.find(t=>t.sourceId===sourceId('new')).category,'services');
});
test('audited reporting subcategory survives provider detail drift below direct item authority',()=>{const w=workspace();w.rules=[];const n=native([source('new-transfer',{reportingCategory:'Transfers',sourceDetailedCategory:'transfers_savings_transfer_out',reportingSubcategory:'Transfers account transfer out',kind:'excluded_transfer_or_card_repayment',ongoingTreatment:'excluded_nonspending'})]);const a=E.build(w,n,aliases,w),t=a.rows.find(r=>r.sourceId===sourceId('new-transfer'));assert.equal(t.subcategory,'Transfers account transfer out');assert.equal(t.sourceDetail,'transfers_savings_transfer_out');assert.equal(E.included(t),false);w.overrides[t.id]={subcategory:'Owner corrected subcategory'};assert.equal(E.build(w,n,aliases,w).rows.find(r=>r.id===t.id).subcategory,'Owner corrected subcategory');});
