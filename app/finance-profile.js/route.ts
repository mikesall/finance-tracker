import runtime from "@/profile/runtime.js?raw";
export const dynamic="force-dynamic";
// Same owner-private Sites dispatch boundary as existing static runtime assets.
export function GET(){return new Response(runtime,{headers:{"Content-Type":"text/javascript; charset=utf-8","Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});}
