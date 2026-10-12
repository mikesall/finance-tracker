import test from 'node:test';import assert from 'node:assert/strict';import {nativeSnapshotSchema} from '../finance-core/schemas/finance-native-schema.ts';
const account='acct_'+'a'.repeat(24),coverage={version:'v1',dataset:'transactions',availability:'ready',state:'full_history',freshness:'unknown',is_complete_for_query:true,selected_pipeline:'full',warning_codes:[]};
import {nativeAdditionFixture} from './fixtures/synthetic-native-snapshot.mjs';
test('scoped additions retain separate collection, source dates and exact raw transaction fields',()=>{const f=nativeAdditionFixture(),s=nativeSnapshotSchema.parse(f);assert.deepEqual(s,f);assert.equal(s.accounts[0].balanceDate,null);assert.equal(s.transactions[0].date,'2026-10-04');assert.equal(s.transactions[0].sourceRecord.postedDatetime,'2026-10-05T00:00:00Z');delete f.metadata.sourceAdditions;delete f.transactions[0].sourceRecord;assert.ok(nativeSnapshotSchema.safeParse(f).success);});
test('addition scope rejects unknown/duplicate accounts, future dates and duplicate addition identities',()=>{for(const edit of [f=>f.metadata.sourceAdditions[0].accountIds.push(account),f=>f.metadata.sourceAdditions[0].accountIds=['acct_'+'f'.repeat(24)],f=>f.metadata.sourceAdditions.push(f.metadata.sourceAdditions[0]),f=>f.metadata.sourceAdditions[0].transactionsCollectedAt='2026-10-13T00:00:00Z',f=>f.metadata.sourceAdditions[0].sourceAsOf='2026-10-13T00:00:00Z',f=>f.metadata.sourceAdditions[0].period.end='2026-10-11']){const f=nativeAdditionFixture();edit(f);assert.equal(nativeSnapshotSchema.safeParse(f).success,false);}});
test('future weekly refresh can advance envelope while retaining truthful historical addition provenance',()=>{const f=nativeAdditionFixture();f.metadata.period.end='2026-10-11';assert.ok(nativeSnapshotSchema.safeParse(f).success);assert.equal(f.metadata.sourceAdditions[0].period.end,'2026-10-04');});

test('a second profile snapshot accepts named reporting and browsing zones with no owner planning fields',()=>{
 for(const timezone of ['Asia/Tokyo','America/New_York','UTC']) {
  const f=nativeAdditionFixture();f.metadata.reportingWindow={kind:'rolling_52_weeks',timezone,cutoff:'2026-10-04'};
  f.metadata.browsingWindow={kind:'18_completed_calendar_months_plus_partial_current',timezone,start:'2025-04-01',end:'2026-10-04',completeCalendarMonths:18,partialMonth:'2026-10',partialThrough:'2026-10-04',independentOfMetricsWindow:true,retainFirstMonthStart:true};
  f.spending.confirmedPlanningAssumptions.extensions={'example.profile':{clubMonthly:25,includesCleaning:false}};
  assert.deepEqual(nativeSnapshotSchema.parse(f),f);
  for(const key of ['reportingWindow','browsingWindow'])for(const bad of ['invalid/place','', '+09:00']){const invalid=structuredClone(f);invalid.metadata[key].timezone=bad;assert.equal(nativeSnapshotSchema.safeParse(invalid).success,false);}
 }
});
test('a completed reporting cutoff uses the snapshot reporting zone at collection midnight',()=>{
 for(const [timezone,valid] of [['Asia/Tokyo',true],['America/New_York',false]]) {
  const f=nativeAdditionFixture();delete f.metadata.sourceAdditions;f.metadata.retrievedAt='2026-10-05T00:30:00Z';f.metadata.reportingWindow={kind:'rolling_52_weeks',timezone,cutoff:'2026-10-04'};
  assert.equal(nativeSnapshotSchema.safeParse(f).success,valid);
 }
});

test('neutral snapshot adapter reads and validates a second profile through the outer contract',async()=>{
 const {snapshotView,snapshotWriteSchema}=await import('../finance-core/schemas/finance-snapshot-schema.ts');const f=nativeAdditionFixture();f.spending.confirmedPlanningAssumptions.extensions={'example.profile':{clubMonthly:25}};
 assert.deepEqual(snapshotWriteSchema.parse({expectedRevision:4,snapshot:f}).snapshot,f);assert.equal(snapshotView(f).snapshotId,'finances-20261012T033000Z');
});
