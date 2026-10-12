import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getChatGPTUser } from "../../chatgpt-auth";
import { getDb } from "@/db";
import { workspaces } from "@/db/schema";
import { workspaceSchema, encodeWorkspace, decodeWorkspace } from "@/lib/workspace-schema";
import seed from "@/profile/empty-workspace.json";
export const dynamic="force-dynamic";
const reply=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{"Cache-Control":"private, no-store"}});
export async function GET(req:Request) {
 const user=await getChatGPTUser();if(!user)return reply({error:"Sign in to open your workspace."},401);
 if(new URL(req.url).searchParams.get("original")==="1")return reply({workspace:seed});
 const db=getDb();let [row]=await db.select().from(workspaces).where(eq(workspaces.userId,user.userId));
 if(!row){await db.insert(workspaces).values({userId:user.userId,data:await encodeWorkspace(seed),revision:0,updatedAt:new Date().toISOString()}).onConflictDoNothing();[row]=await db.select().from(workspaces).where(eq(workspaces.userId,user.userId));}
 return reply({workspace:await decodeWorkspace(row.data),revision:row.revision,updatedAt:row.updatedAt});
}
export async function PUT(req:Request){
 const user=await getChatGPTUser();if(!user)return reply({error:"Sign in before saving."},401);
 if(req.headers.get("origin")!==new URL(req.url).origin)return reply({error:"Request origin does not match."},403);
 const raw=await req.text();if(raw.length>25_000_000)return reply({error:"Workspace exceeds 25 MB."},413);
 let body;try{body=JSON.parse(raw);}catch{return reply({error:"Invalid JSON."},400);}
 const parsed=workspaceSchema.safeParse(body.workspace);
 if(!parsed.success||!Number.isSafeInteger(body.revision)||body.revision<0)return reply({error:parsed.success?"Invalid revision.":parsed.error.issues[0]?.message||"Invalid workspace."},400);
 let packed;try{packed=await encodeWorkspace(parsed.data);}catch(e){return reply({error:e instanceof Error?e.message:"Could not save workspace."},413);}
 const now=new Date().toISOString();const result=await getDb().update(workspaces).set({data:packed,revision:body.revision+1,updatedAt:now}).where(and(eq(workspaces.userId,user.userId),eq(workspaces.revision,body.revision))).returning({revision:workspaces.revision});
 if(!result.length)return reply({error:"This workspace changed in another tab. Export your draft, then reload before saving again."},409);
 return reply({revision:result[0].revision,updatedAt:now});
}
