import { getChatGPTUser, chatGPTSignInPath } from "./chatgpt-auth";
import {shell} from "@/profile/render-shell";
import {readSnapshot} from "@/lib/finance-snapshots";
import {readReportingPolicy} from "@/lib/finance-reporting-policy";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.redirect(new URL(chatGPTSignInPath("/"), req.url),302);
  const source=await readSnapshot(),policy=await readReportingPolicy();
  const empty=`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Personal ledger</title><body style="font:16px/1.6 system-ui;max-width:720px;padding:64px 24px;margin:auto"><h1>Your private finance dashboard</h1><p>No financial data has been imported. Amounts, budgets and asset allocations are unavailable until you authorize an import from your own connected Finances.</p><p>Ask your dot to follow this instance's <a href="/api/finance/contract">setup and refresh contract</a>, initialize your empty workspace, verify source access, import the authorized scope, and read it back. This template does not inherit anyone else's accounts or preferences.</p></body></html>`;
  const proposed=policy.policy?.budgetProposal?.status==='proposed'&&!policy.policy?.approvedBudgets?.length;
  const proposedTargets=policy.policy?.portfolioReporting?.targetProvenance?.status==='proposed';
  const notices=[proposed?'Budget amounts are proposed planning estimates from your history, not confirmed allowances. Review assumptions with your dot before approving them.':'',proposedTargets?'Portfolio target percentages are provisional suggestions for review, not your approved allocation. Ask your dot to review the stated horizon, liquidity and risk assumptions or refine the targets.':''].filter(Boolean).map(text=>`<p role="note" style="margin:16px 0;padding:12px;border:1px solid #ddd;border-radius:8px">${text}</p>`).join('');
  const content=source.snapshot?shell.replace('<section id="active-view"',notices+'<section id="active-view"'):empty;
  return new Response(content,{headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff","Referrer-Policy":"no-referrer","Content-Security-Policy":"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'"}});
}
