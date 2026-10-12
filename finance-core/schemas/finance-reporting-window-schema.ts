import {z} from 'zod';

const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s=>!Number.isNaN(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s);
export const financeTimezoneSchema=z.string().min(1).max(100).refine(zone=>{try{if(/^[+-]/.test(zone))return false;new Intl.DateTimeFormat('en-US',{timeZone:zone});return true;}catch{return false;}},'A valid named timezone is required.');
export function financeCalendarBounds(cutoff:string){
 const valid=date.parse(cutoff),endExclusive=new Date(Date.parse(valid+'T12:00:00Z')+86400000).toISOString().slice(0,10),anchor=endExclusive.slice(0,7)+'-01';
 const shift=(months:number)=>{const d=new Date(anchor+'T12:00:00Z');d.setUTCMonth(d.getUTCMonth()+months);return d.toISOString().slice(0,10);};
 const partialMonth=endExclusive===anchor?null:valid.slice(0,7);
 return {cutoff,endExclusive,anchor,browsingStart:shift(-18),chartStart:shift(-12),partialMonth,partialThrough:partialMonth?valid:null};
}
export const financeBrowsingWindowSchema=z.object({kind:z.literal('18_completed_calendar_months_plus_partial_current'),timezone:financeTimezoneSchema,start:date,end:date,completeCalendarMonths:z.literal(18),partialMonth:z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).nullable(),partialThrough:date.nullable(),independentOfMetricsWindow:z.literal(true),retainFirstMonthStart:z.literal(true)}).strict().superRefine((w,ctx)=>{
 if(!date.safeParse(w.end).success)return;
 const expected=financeCalendarBounds(w.end);
 if(w.start!==expected.browsingStart||w.partialMonth!==expected.partialMonth||w.partialThrough!==expected.partialThrough)ctx.addIssue({code:'custom',message:'Browsing window must contain 18 complete calendar months plus a partial month only when the cutoff is not month-end.'});
});
// Optional for legacy snapshots. It changes reporting windows, never source rows
// or approved budgets. Calendar-chart coverage uses the full collection envelope.
export const financeReportingWindowSchema=z.object({
 kind:z.literal('rolling_52_weeks'),
 timezone:financeTimezoneSchema,
 cutoff:date,
}).strict().refine(w=>new Date(w.cutoff+'T12:00:00Z').getUTCDay()===0,'Reporting cutoff must be a completed Sunday.');
