import {readLookback,writeLookback} from '@/lib/finance-lookback';
import {json,readBody,failure} from '@/lib/finance-http';
export const dynamic='force-dynamic';
// Same existing owner-private Sites boundary as snapshot read/write.
export async function GET(){try{return json(await readLookback());}catch(e){return failure(e);}}
export async function PUT(req:Request){try{return json(await writeLookback(await readBody(req)));}catch(e){return failure(e);}}
