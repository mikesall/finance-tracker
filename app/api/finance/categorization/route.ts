import { getChatGPTUser } from "@/app/chatgpt-auth";
import { readCategorizationState, readPrivateCategorizationSummary } from "@/lib/finance-categorization-audit";
import { json } from "@/lib/finance-http";
export const dynamic="force-dynamic";
// This endpoint is only for the confirmed owner-private Site. Sites dispatch
// validates browser/service access before requests reach this shared summary.
// No raw transactions or user identifiers are returned, and no writes occur.
export async function GET(){
  const user=await getChatGPTUser();
  return json(user?await readCategorizationState(user.userId):await readPrivateCategorizationSummary());
}
