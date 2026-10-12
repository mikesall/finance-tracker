import {eq} from "drizzle-orm";
import {getDb} from "@/db";
import {workspaces} from "@/db/schema";
import {encodeWorkspace,decodeWorkspace} from "./workspace-schema";
import empty from "../profile/empty-workspace.json";
export async function initializeWorkspace(userId:string){
 const db=getDb();await db.insert(workspaces).values({userId,data:await encodeWorkspace(empty),revision:0,updatedAt:new Date().toISOString()}).onConflictDoNothing();
 const [row]=await db.select().from(workspaces).where(eq(workspaces.userId,userId));
 return {workspace:await decodeWorkspace(row.data),revision:row.revision,updatedAt:row.updatedAt};
}
