import {z} from 'zod';
import {nativeTransactionSchema} from './finance-native-schema.ts';
const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s=>!Number.isNaN(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s);
const month=z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
const timestamp=z.string().datetime({offset:true});
const text=z.string().max(4000);
export function lookbackPeriod(displayStart:string){const end=new Date(displayStart+'T00:00:00Z');end.setUTCDate(0);const start=new Date(displayStart+'T00:00:00Z');start.setUTCMonth(start.getUTCMonth()-2);return {start:start.toISOString().slice(0,10),end:end.toISOString().slice(0,10)};}
export const financeLookbackSchema=z.object({
 schemaVersion:z.literal(1),contextId:z.string().min(1).max(120).regex(/^[a-zA-Z0-9_.:-]+$/),collectedAt:timestamp,sourceAsOf:timestamp.nullable(),sourceFreshness:text,currency:z.literal('USD'),
 period:z.object({start:date,end:date}).strict(),
 coverage:z.object({queryComplete:z.boolean(),accountIds:z.array(z.string().regex(/^acct_[a-f0-9]{24}$/)).max(1000),months:z.array(z.object({month,complete:z.boolean()}).strict()).length(2),issues:z.array(text).max(100)}).strict(),
 transactions:z.array(nativeTransactionSchema).max(10000),
}).strict().superRefine((s,ctx)=>{
 const error=(message:string)=>ctx.addIssue({code:'custom',message});
 if(Date.parse(s.collectedAt)>Date.now()+300000)error('Collection timestamp is in the future.');
 if(s.sourceAsOf&&Date.parse(s.sourceAsOf)>Date.parse(s.collectedAt)+300000)error('Source timestamp is after collection.');
 if(Number.isNaN(Date.parse(s.period.start))||Number.isNaN(Date.parse(s.period.end))){error('Invalid context dates.');return;}
 const next=new Date(s.period.end+'T00:00:00Z');next.setUTCDate(next.getUTCDate()+1);const expected=lookbackPeriod(next.toISOString().slice(0,10));
 if(!s.period.start.endsWith('-01')||next.getUTCDate()!==1||expected.start!==s.period.start||expected.end!==s.period.end)error('Lookback must span exactly two complete calendar months.');
 const expectedMonths=[s.period.start.slice(0,7),s.period.end.slice(0,7)];
 if(new Set(s.coverage.months.map(m=>m.month)).size!==2||s.coverage.months.some(m=>!expectedMonths.includes(m.month)))error('Coverage must identify each lookback month exactly once.');
 if(!s.coverage.queryComplete&&s.coverage.months.some(m=>m.complete))error('Incomplete query cannot mark a month complete.');
 if(new Set(s.coverage.accountIds).size!==s.coverage.accountIds.length)error('Duplicate queried account.');
 if(new Set(s.transactions.map(t=>t.id)).size!==s.transactions.length)error('Duplicate transaction ID.');
 if(s.transactions.some(t=>t.date<s.period.start||t.date>s.period.end||Math.abs(t.amount+t.cashFlowAmount)>.001))error('Context transaction date or sign is inconsistent.');
 if(s.transactions.some(t=>!s.coverage.accountIds.includes(t.accountId)))error('Transaction account is outside queried scope.');
});
export const lookbackWriteSchema=z.object({expectedRevision:z.number().int().nonnegative(),expectedSourceRevision:z.number().int().positive(),expectedSourceDigest:z.string().regex(/^[a-f0-9]{64}$/),lookback:financeLookbackSchema}).strict();
