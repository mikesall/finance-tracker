import { SnapshotError } from "./finance-snapshots";
export const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
export async function readBody(req:Request) {
  if (req.headers.get("origin") && req.headers.get("origin")!==new URL(req.url).origin) throw new SnapshotError("Request origin does not match.",403);
  if (!req.headers.get("content-type")?.startsWith("application/json")) throw new SnapshotError("Use application/json.",415);
  const reader=req.body?.getReader(); if(!reader) throw new SnapshotError("Missing JSON body.");
  const chunks:Uint8Array[]=[];let size=0;
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>5_500_000){await reader.cancel();throw new SnapshotError("Request exceeds 5.5 MB.",413);}chunks.push(value);}
  const bytes=new Uint8Array(size);let at=0;for(const chunk of chunks){bytes.set(chunk,at);at+=chunk.length;}
  try{return JSON.parse(new TextDecoder().decode(bytes));}catch{throw new SnapshotError("Invalid JSON.");}
}
export function failure(error:unknown){return json({error:error instanceof SnapshotError?error.message:"Private storage is unavailable. Please retry."},error instanceof SnapshotError?error.status:503);}
