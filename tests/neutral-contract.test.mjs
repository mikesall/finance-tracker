import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
import {nativeSnapshotSchema} from '../finance-core/schemas/finance-native-schema.ts';
import {workspaceSchema,encodeWorkspace,decodeWorkspace} from '../finance-core/schemas/workspace-schema.ts';
import {reportingPolicySchema} from '../finance-core/schemas/finance-reporting-policy-schema.ts';
import {snapshotWriteSchema,snapshotView} from '../finance-core/schemas/finance-snapshot-schema.ts';
import {neutralFixture,manualBalance,manualPolicy} from './fixtures/neutral-profile.mjs';
const ctx={TextEncoder,Intl,Date,Map,Set};vm.createContext(ctx);for(const name of ['effective-ledger','read-only-model','portfolio-model'])vm.runInContext(fs.readFileSync(new URL('../public/finance-core/'+name+'.js',import.meta.url),'utf8'),ctx);
const E=ctx.EffectiveLedger,M=ctx.FinanceReadModel,P=ctx.PortfolioModel,plain=x=>JSON.parse(JSON.stringify(x));
test('independent neutral wire records roundtrip with every optional personal feature absent',async()=>{
 const {snapshot:s,workspace:w,policy:p}=neutralFixture();assert.deepEqual(nativeSnapshotSchema.parse(s),s);assert.deepEqual(workspaceSchema.parse(w),w);assert.deepEqual(reportingPolicySchema.parse(p),p);assert.deepEqual(await decodeWorkspace(await encodeWorkspace(w)),w);assert.deepEqual(snapshotWriteSchema.parse({expectedRevision:0,snapshot:s}).snapshot,s);assert.ok(snapshotView(s));
 const model=E.build(w,s,new Map(),null,p);assert.deepEqual(Object.keys(model).filter(k=>/transition|housing|venmo|car/i.test(k)),[]);assert.equal(P.build(s,p).metrics.netWorth,10000);
});
test('arbitrary unclassified IDs and declared source state apply the same rule, preserving exact item and receipt priority',()=>{
 const {snapshot:s,workspace:w,policy:p}=neutralFixture(),id=s.transactions[0].id;p.rules=[{id:'workshop',scope:'unidentified_only',merchantPattern:'^Example workshop$',priority:1,category:'services',subcategory:'Classes'}];
 const declared=E.build(w,s,new Map(),null,p);assert.equal(declared.rows[0].category,'services');
 delete s.transactions[0].classificationState;p.unclassifiedCategoryIds=['uncategorized'];assert.equal(E.build(w,s,new Map(),null,p).rows[0].category,declared.rows[0].category);
 w.transactions=[E.persistableBase(E.build(w,s).rows[0])];const original=structuredClone(w);w.overrides[id]={category:'business',splits:[{id:'receipt',category:'business',subcategory:'Materials',amountCents:1000,treatment:'one_time',label:'Exact receipt'}]};const row=E.build(w,s,new Map(),original,p).rows[0];assert.equal(row.category,'business');assert.equal(row.splits[0].category,'business');assert.equal(row.amountCents,1000);
 w.overrides={};w.transactions[0].category='business';assert.equal(E.build(w,s,new Map(),original,p).rows[0].category,'business');
});
test('generic discontinued debt and signed refund reconcile without personal diagnostics',()=>{
 const {snapshot:s,workspace:w,policy:p}=neutralFixture();s.transactions[0].kind='debt_payment';s.transactions[0].ongoingTreatment='excluded_discontinued';s.transactions.push({...s.transactions[0],id:'txn_'+'3'.repeat(24),amount:-2,cashFlowAmount:2});s.metadata.transactionCount=2;s.spending.monthly[0].classifiedExpensePayments=8;s.spending.monthly[0].discontinuedPayments=8;nativeSnapshotSchema.parse(s);
 const m=E.build(w,s,new Map(),null,p);assert.equal(E.aggregate(m.parts.filter(x=>E.included(x))).totalCents,800);assert.equal(m.parts.filter(x=>E.included(x,'ongoing')).length,0);assert.ok(m.rows.every(r=>r.treatment==='discontinued'));
});
test('optional recurring records carry cadence, evidence and status without approving budgets',()=>{
 const {snapshot:s,workspace:w,policy:p}=neutralFixture(),cost={id:'class',label:'Group class',amountCents:2500,currency:'USD',cadence:'monthly',status:'estimate',basis:'Fictional observed recurrence'};s.spending.confirmedPlanningAssumptions={recurringCosts:[cost]};w.recurringCosts=[{...cost,amountCents:3000}];p.recurringCosts=[cost];nativeSnapshotSchema.parse(s);workspaceSchema.parse(w);reportingPolicySchema.parse(p);const model=E.build(w,s,new Map(),null,p);assert.equal(model.recurringCosts.length,1);assert.equal(model.recurringCosts[0].amountCents,3000);assert.equal(model.categories.reduce((n,c)=>n+c.annualCents,0),0);assert.equal(p.approvedBudgets,undefined);
});
test('business exclusion has a truthful policy reason in export; absent reason has a generic default',()=>{
 const {snapshot:s,workspace:w,policy:p}=neutralFixture();s.transactions[0].reportingCategory='Business';p.spendingExclusions={categoryIds:['business'],authority:'Fictional owner',reason:'Reimbursable business payment',confirmedAt:p.issuedAt};reportingPolicySchema.parse(p);const project=()=>M.project(E.build(w,s,new Map(),null,p),w,{snapshot:s},p);let q=project(),csv=M.csv(q,M.browseTransactions(q));assert.match(csv,/Reimbursable business payment/);assert.doesNotMatch(csv,/Income-tax flow/);assert.equal(M.transactionTotals(q,M.browseTransactions(q)).actualCents,0);delete p.spendingExclusions.reason;q=project();assert.match(M.csv(q,M.browseTransactions(q)),/Excluded by category policy/);
});
test('cash-only owner has known net worth without manual records or portfolio policy',()=>{const {snapshot:s}=neutralFixture();for(const policy of [undefined,{}, {portfolioReporting:{...manualPolicy([]),netWorth:undefined}}]){const m=P.build(s,policy);assert.equal(m.metrics.netWorth,10000);assert.equal(m.netTableTotal,10000);assert.equal(m.metrics.totalLiabilities,0);assert.equal(m.netTableReconciles,true);}});
test('selected non-property assets and signed liabilities reconcile exactly once; unselected references stay separate',()=>{
 const {snapshot:s,policy:p}=neutralFixture();s.portfolio.manualBalances=[manualBalance('equipment',50),manualBalance('tuition_balance',-20),manualBalance('unverified_receivable',900,{status:'unverified'})];p.portfolioReporting=manualPolicy(['equipment','tuition_balance']);nativeSnapshotSchema.parse(s);reportingPolicySchema.parse(p);const before=JSON.stringify([s,p]),m=P.build(s,p);assert.equal(m.metrics.netWorth,13000);assert.equal(m.metrics.totalAssets,15000);assert.equal(m.metrics.totalLiabilities,2000);assert.equal(m.netTableTotal,13000);assert.equal(P.display(m).netRows.reduce((n,r)=>n+r.valueCents,0),13000);assert.equal(JSON.stringify([s,p]),before);
 p.portfolioReporting.netWorth.manualBalanceIds=['equipment'];assert.equal(P.build(s,p).metrics.netWorth,15000);
 s.portfolio.manualBalances.push(manualBalance('linked_reference',100,{linkedAccountId:s.accounts[0].id}));p.portfolioReporting.netWorth.manualBalanceIds.push('linked_reference');assert.equal(P.build(s,p).metrics.netWorth,15000);assert.equal(P.build(s,p).manualInclusion.at(-1).status,'already_in_linked_scope');
});
test('unverified, missing and unknown selected evidence cannot silently become zero or known assets',()=>{
 const {snapshot:s,policy:p}=neutralFixture();s.portfolio.manualBalances=[manualBalance('claim',50,{status:'unverified'}),manualBalance('unknown',null)];for(const id of ['claim','unknown','missing']){p.portfolioReporting=manualPolicy([id]);const m=P.build(s,p);assert.equal(m.metrics.netWorth,null);assert.equal(m.netTableTotal,null);}p.portfolioReporting=manualPolicy([]);assert.equal(P.build(s,p).metrics.netWorth,10000);
 s.portfolio.manualBalances=[manualBalance('debt',20,{kind:'liability'})];assert.equal(nativeSnapshotSchema.safeParse(s).success,false);s.portfolio.manualBalances=[manualBalance('asset',10),manualBalance('asset',20)];assert.equal(nativeSnapshotSchema.safeParse(s).success,false);p.portfolioReporting=manualPolicy(['asset','asset']);assert.equal(reportingPolicySchema.safeParse(p).success,false);
});
test('generic portfolio help and caption make no absent asset or household assertions',()=>{
 const {snapshot:s,policy:p}=neutralFixture(),m=P.build(s,p),help=JSON.stringify(M.portfolioMetricInfo(m));assert.doesNotMatch(help,/home|mortgage|TIPS|Venmo|redemption/i);const script=fs.readFileSync(new URL('../public/finance-core/read-only-dashboard.js',import.meta.url),'utf8');assert.doesNotMatch(script,/Credit includes TIPS|excluding home/);assert.match(script,/compositionCaption/);
});
