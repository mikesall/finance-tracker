import {getChatGPTUser} from "@/app/chatgpt-auth";
import {refreshContract} from "@/lib/finance-refresh-contract";
import {readSnapshot,readStatus,writeSnapshot,SnapshotError} from "@/lib/finance-snapshots";
import {verifyFinanceSetup} from "@/lib/finance-setup-verification";
import {readReportingPolicy,writeReportingPolicy} from "@/lib/finance-reporting-policy";
import {readCategorizationState} from "@/lib/finance-categorization-audit";
import {readEffectiveSummary} from "@/lib/finance-effective-summary";
import {initializeWorkspace} from "@/lib/finance-workspace";
import {json,readBody,failure} from "@/lib/finance-http";
export const dynamic="force-dynamic";
const empty={type:"object",properties:{},additionalProperties:false};
const readTool=(name:string,description:string)=>({name,description,inputSchema:empty,annotations:{readOnlyHint:true}});
const tools=[
 {name:"initialize_finance_workspace",description:"Create an empty workspace for the signed-in owner during explicitly requested private dashboard setup. Reuses any existing workspace without replacing data or edits.",inputSchema:empty,annotations:{readOnlyHint:false,destructiveHint:false,idempotentHint:true}},
 readTool("get_finance_refresh_contract","Read this private instance's source, schema, consent, import and refresh contract. Does not grant Finances access."),
 readTool("read_finance_snapshot","Read the stored snapshot for this owner-private instance."),
 readTool("get_finance_refresh_status","Read collection/coverage freshness and revision without amounts."),
 readTool("read_finance_reporting_policy","Read this owner's separate reporting policy and budget proposal or approvals."),
 readTool("read_finance_categorization_state","Read this signed-in owner's saved workspace rules and override counts."),
 readTool("verify_finance_setup","Verify every returned linked/manual account, asset and liability has a reconciled disposition and imported manual balances are selected in net worth. Missing inventory fails setup verification."),
 readTool("read_finance_effective_summary","Reconcile imported source with this owner's policy and saved workspace."),
 {name:"write_finance_snapshot",description:"Save an explicitly authorized native financial snapshot to this owner's private Site. Does not read Finances, change banks, or edit reporting policy/workspace. Read contract/revision first and independently read back.",inputSchema:{type:"object",properties:{expectedRevision:{type:"integer",minimum:0},snapshot:refreshContract.snapshotSchema},required:["expectedRevision","snapshot"],additionalProperties:false},annotations:{readOnlyHint:false,destructiveHint:false,idempotentHint:true}},
 {name:"write_finance_reporting_policy",description:"Save an explicitly authorized separate policy, with proposed budgets distinguished from owner-approved budgets/targets. Not part of routine source refresh. Preserve existing owner edits and read back.",inputSchema:{type:"object",properties:{expectedRevision:{type:"integer",minimum:0},policy:refreshContract.policySchema},required:["expectedRevision","policy"],additionalProperties:false},annotations:{readOnlyHint:false,destructiveHint:false,idempotentHint:true}},
];
export async function POST(req:Request){try{const body=await readBody(req),id=body.id??null,result=(value:unknown)=>json({jsonrpc:"2.0",id,result:value});
 if(body.method==="server/discover")return result({resultType:"complete",supportedVersions:["2026-07-28"],capabilities:{tools:{}}});
 if(body.method==="initialize")return result({protocolVersion:"2025-03-26",capabilities:{tools:{}},serverInfo:{name:"Finance Tracker",version:"0.1.0"}});
 if(body.method==="notifications/initialized")return new Response(null,{status:202});
 if(body.method==="tools/list")return result({tools});
 if(body.method!=="tools/call")return json({jsonrpc:"2.0",id,error:{code:-32601,message:"Method not found"}});
 const user=await getChatGPTUser();if(!user)return json({error:"Signed-in Site MCP identity required."},401);
 try{let value:unknown;switch(body.params?.name){
 case "initialize_finance_workspace":value=await initializeWorkspace(user.userId);break;
 case "get_finance_refresh_contract":value=refreshContract;break;
 case "verify_finance_setup":value=await verifyFinanceSetup();break;
 case "read_finance_snapshot":value=await readSnapshot();break;
 case "get_finance_refresh_status":value=await readStatus();break;
 case "read_finance_reporting_policy":value=await readReportingPolicy();break;
 case "read_finance_categorization_state":value=await readCategorizationState(user.userId);break;
 case "read_finance_effective_summary":value=await readEffectiveSummary(user.userId);break;
 case "write_finance_snapshot":value=await writeSnapshot(body.params.arguments);break;
 case "write_finance_reporting_policy":value=await writeReportingPolicy(body.params.arguments);break;
 default:throw new SnapshotError("Unknown tool.");}
 return result({content:[{type:"text",text:JSON.stringify(value)}],isError:false});
 }catch(e){return result({content:[{type:"text",text:e instanceof SnapshotError?e.message:"Private storage is unavailable; read status before retrying."}],isError:true});}
 }catch(e){return failure(e);}}
