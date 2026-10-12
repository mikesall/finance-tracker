import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function models(profile) {
 const ctx={TextEncoder,Intl,Date,...(profile?{FinanceProfile:profile}:{})};vm.createContext(ctx);
 for(const name of ['effective-ledger','read-only-model','portfolio-model'])vm.runInContext(fs.readFileSync(new URL('../public/finance-core/'+name+'.js',import.meta.url),'utf8'),ctx);
 return ctx;
}
function ledger(ctx) {
 const workspace={meta:{},categories:['education','food','shopping','other'].map(id=>({id,name:id})),transactions:[],overrides:{},rules:[]};
 const snapshot={metadata:{retrievedAt:'2026-10-05T12:00:00Z',period:{start:'2025-09-01',end:'2026-10-04'},warnings:[],transactionCoverage:{is_complete_for_query:true},transactionPagesComplete:true},accounts:[],transactions:[{id:'example',date:'2026-09-30',amount:12,merchant:'Example service',account:'Example account',reportingCategory:'Education',kind:'expense_payment',ongoingTreatment:'unassessed',flags:[]}]};
 return {workspace,snapshot,project:()=>ctx.FinanceReadModel.project(ctx.EffectiveLedger.build(workspace,snapshot),workspace,{snapshot},{})};
}
test('neutral and second profiles apply matching Education-to-Shopping and Education-to-Food rules equally',()=>{
 for(const profile of [undefined,{title:'Fictional second profile',timezone:'Asia/Tokyo'}]) {
  const ctx=models(profile),{workspace,snapshot}=ledger(ctx),before=JSON.stringify({workspace,snapshot});
  for(const category of ['shopping','food']) {
   const policy={rules:[{id:'explicit-example-rule',scope:'identified_detail',merchantPattern:'Example',priority:1,category,subcategory:'Chosen detail'}]};
   const row=ctx.EffectiveLedger.build(workspace,snapshot,new Map(),null,policy).rows[0];
   assert.equal(row.category,category);assert.equal(row.appliedPolicyRules[0],'explicit-example-rule');
  }
  assert.equal(JSON.stringify({workspace,snapshot}),before);
 }
});
test('a profile rule veto is explicit and cannot override a saved direct item decision',()=>{
 const ctx=models({allowClassificationRule:({rule})=>rule.id!=='veto-this'}),{workspace,snapshot}=ledger(ctx);
 const policy={rules:[{id:'veto-this',scope:'identified_detail',priority:1,category:'shopping',subcategory:'Example'}]};
 assert.equal(ctx.EffectiveLedger.build(workspace,snapshot,new Map(),null,policy).rows[0].category,'education');
 workspace.overrides.example={category:'food'};assert.equal(ctx.EffectiveLedger.build(workspace,snapshot,new Map(),null,policy).rows[0].category,'food');
});
test('calendar bars honor two profile timezones at both sides of a month boundary',()=>{
 const cases=[['Asia/Tokyo','2026-10-01T00:30:00Z','2026-10'],['America/New_York','2026-10-01T00:30:00Z','2026-09'],['Asia/Tokyo','2026-09-30T15:00:00Z','2026-10'],['America/New_York','2026-09-30T15:00:00Z','2026-09']];
 for(const [timezone,at,month] of cases) {
  const ctx=models({timezone}),p=ledger(ctx).project(),chart=ctx.FinanceReadModel.calendarChart(p,new Set(['education']),at);
  assert.equal(chart.at(-1).month,month);assert.equal(chart.at(-1).partial,true);assert.equal(chart.length,13);
  assert.equal(chart.filter(x=>x.partial).length,1);assert.equal(p.metrics.spend12,1200);
 }
});
test('profile calendar dates remain correct around spring and fall DST and default to UTC',()=>{
 const ctx=models({timezone:'America/New_York'}),M=ctx.FinanceReadModel;
 for(const at of ['2026-03-08T06:59:59Z','2026-03-08T07:00:00Z'])assert.equal(M.localDate(at),'2026-03-08');
 for(const at of ['2026-11-01T05:59:59Z','2026-11-01T06:00:00Z'])assert.equal(M.localDate(at),'2026-11-01');
 assert.equal(M.localDate('2026-11-01T03:59:59Z'),'2026-10-31');assert.equal(M.localDate('2026-11-01T04:00:00Z'),'2026-11-01');
 for(const profile of [undefined,{}, {timezone:'invalid/place'}, {timezone:'+09:00'}]) {
  const neutral=models(profile),p=ledger(neutral).project();assert.equal(neutral.FinanceReadModel.profileTimezone(),'UTC');
  assert.equal(neutral.FinanceReadModel.calendarChart(p,new Set(['education']),'2026-10-01T00:30:00Z').at(-1).month,'2026-10');
 }
});
test('explicit mixed and unclassified family targets survive without an owner policy',()=>{
 const rows=[{id:'balanced_example',valueCents:2500,targetPercent:25},{id:'unknown_example',valueCents:7500,targetPercent:75}];
 const profile={familyClasses:{mixed_multi_asset:['balanced_example']},familyDefinitions:[{id:'mixed_multi_asset',label:'Example mixed'},{id:'unclassified',label:'Example unclassified'}]};
 const P=models(profile).PortfolioModel,result=P.allocationFamilies(rows,10000);
 assert.equal(result[0].targetPercent,25);assert.equal(result[1].targetPercent,75);assert.equal(result.reduce((s,f)=>s+f.targetPercent,0),100);
 const derived=models().PortfolioModel.allocationFamilies(rows,10000);assert.deepEqual(Array.from(derived,f=>f.id),['mixed_multi_asset','unclassified']);assert.equal(derived.reduce((n,f)=>n+f.targetPercent,0),100);
 const optedOut=models({...profile,familyTargetPolicy:{unassignedFamilyIds:['mixed_multi_asset']}}).PortfolioModel.allocationFamilies(rows,10000);
 assert.equal(optedOut[0].targetPercent,null);assert.equal(optedOut[1].targetPercent,75);
 rows[0].targetPercent=null;assert.equal(P.allocationFamilies(rows,10000)[0].targetPercent,null);
});
