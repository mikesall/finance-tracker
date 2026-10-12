import {json} from "@/lib/finance-http";
export const dynamic="force-dynamic";
export async function GET(){return json({availability:{available:false},requests:[]});}
export async function POST(){return json({error:"Request routing is not enabled in this template."},410);}
