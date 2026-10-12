import { refreshContract } from "@/lib/finance-refresh-contract";
import { json } from "@/lib/finance-http";
export const dynamic="force-dynamic";
export async function GET(){return json(refreshContract);}
