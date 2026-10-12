import {getChatGPTUser} from "@/app/chatgpt-auth";
import {readEffectiveSummary} from "@/lib/finance-effective-summary";
import {json,failure} from "@/lib/finance-http";
export const dynamic="force-dynamic";
export async function GET(){try{return json(await readEffectiveSummary((await getChatGPTUser())?.userId));}catch(e){return failure(e);}}
