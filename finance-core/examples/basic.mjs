// Entirely fictional data; no connector, account access or bank action.
globalThis.FinanceProfile={title:'Example ledger',categorySlugs:{food:'food'},spendingColorOrder:['food'],assetColorOrder:[],familyClasses:{},familyDefinitions:[{id:'unclassified',label:'Unclassified'}]};
await import('../../public/finance-core/effective-ledger.js');
const workspace={meta:{},categories:[{id:'food',name:'Food',annualCents:0,note:'',budgeted:false}],transactions:[],overrides:{},rules:[]};
const snapshot={metadata:{retrievedAt:'2026-01-05T00:00:00Z',period:{start:'2025-01-06',end:'2026-01-04'},warnings:[]},accounts:[{label:'Example checking'}],transactions:[{id:'example-payment',date:'2026-01-03',amount:25,merchant:'Example cafe',account:'Example checking',reportingCategory:'Food',kind:'expense_payment',ongoingTreatment:'unassessed',flags:[],sourceDetailedCategory:'Dining'}]};
const model=EffectiveLedger.build(workspace,snapshot);
console.log(JSON.stringify(EffectiveLedger.aggregate(model.parts.filter(EffectiveLedger.included))));
