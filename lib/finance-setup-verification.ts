import {readEffectiveSummary} from "./finance-effective-summary";
export async function verifyFinanceSetup(userId?:string){const summary=await readEffectiveSummary(userId);return summary.available?summary.setupVerification:{ok:false,coverageComplete:false,issues:[summary.reason],verificationScope:["source_inventory","portfolio_presentation","budget_comparison_scope"]};}
