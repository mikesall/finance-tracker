import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function context(question,status='open',id='saved-question'){
 const ctx={TextEncoder,Intl,Date,Map,Set};vm.createContext(ctx);
 vm.runInContext(fs.readFileSync(new URL('../public/finance-core/read-only-model.js',import.meta.url),'utf8'),ctx);
 const saved={id,status,question,sourceKeys:['source-tax']},t={id:'local-tax',sourceId:'source-tax',taxNeedsClarification:true};
 const p={policy:{clarifications:[saved]},native:{metadata:{retrievedAt:'2026-01-01T00:00:00Z'}}};
 return {M:ctx.FinanceReadModel,p,t,saved};
}

for(const [kind,question] of [
 ['date','Was this income tax payment made in April or June?'],
 ['duplicate','Was this income tax payment a duplicate or the original?'],
 ['refund destination','Was this income tax refund sent to checking or savings?'],
 ['receipt type','What type of receipt supports this income tax payment?'],
 ['receipt kind','What kind of receipt do you have for this tax payment?'],
 ['refund account type','What type of account did this tax refund go into?'],
 ['multiple tax types with an unrelated action','Was this income tax or property tax payment made in April or June?']
])for(const status of ['open','resolved'])test(`${status} ${kind} question does not resolve tax purpose`,()=>{
 const {M,p,t,saved}=context(question,status),before=JSON.stringify([p,t]);
 const all=M.questionsFor(p,t),open=M.questionsFor(p,t,true);
 assert.deepEqual(Array.from(all,q=>q.id),[saved.id,'tax-type:local-tax']);
 assert.deepEqual(Array.from(open,q=>q.id),status==='open'?[saved.id,'tax-type:local-tax']:['tax-type:local-tax']);
 assert.equal(t.taxNeedsClarification,true);assert.equal(JSON.stringify([p,t]),before);
});

for(const question of [
 'Was this personal income tax or property tax?',
 'Was this payment for income tax or another government payment?',
 'What type of tax was this payment for?',
 'Which kind of tax is this?',
 'What did this payment cover: property tax, a tax-preparation service, or another obligation?'
])test(`genuine purpose question deduplicates through source ID: ${question}`,()=>{
 for(const status of ['open','resolved']){
  const {M,p,t,saved}=context(question,status),before=JSON.stringify([p,t]);
  assert.deepEqual(Array.from(M.questionsFor(p,t),q=>q.id),[saved.id]);
  assert.equal(M.questionsFor(p,t,true).length,status==='open'?1:0);
  assert.equal(t.taxNeedsClarification,true);assert.equal(JSON.stringify([p,t]),before);
 }
});

test('canonical grouped purpose ID deduplicates without interpreting its wording',()=>{
 const {M,p,t}=context('Please clarify this grouped obligation.','open','tax-type:group');
 assert.deepEqual(Array.from(M.questionsFor(p,t,true),q=>q.id),['tax-type:group']);
});
