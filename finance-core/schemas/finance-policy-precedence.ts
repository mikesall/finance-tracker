// Classification authority belongs to an individual rule/mapping. Budget-only
// policy versions must not change its precedence against saved merchant rules.
const time=(value:unknown)=>typeof value==="string"?Date.parse(value):NaN;
const canonical=(value:any):any=>Array.isArray(value)?value.map(canonical):value&&typeof value==="object"?Object.fromEntries(Object.keys(value).filter(key=>!["effectiveAt","note","authority"].includes(key)).sort().map(key=>[key,canonical(value[key])])):value;
export const classificationEqual=(a:any,b:any)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
export function stampPolicyPrecedence(previous:any,next:any,now:string){
 const stamp=(item:any,old:any)=>{
  if(old&&classificationEqual(item,old)){
   // Preserve existing authority dates. A one-time legacy backfill may supply
   // a known historical date; otherwise retain the original global fallback.
   const at=old.effectiveAt||(Number.isFinite(time(item.effectiveAt))&&time(item.effectiveAt)<=time(now)?item.effectiveAt:previous?.issuedAt);
   return {...item,...(at?{effectiveAt:at}:{})};
  }
  return {...item,effectiveAt:now};
 };
 const rules=next.rules.map((item:any)=>stamp(item,previous?.rules?.find((old:any)=>old.id===item.id)));
 const key=(item:any)=>JSON.stringify([item.fromCategory,[...item.sourceSubcategories].sort()]);
 return {...next,rules,...(next.allocationMappings?{allocationMappings:next.allocationMappings.map((item:any)=>stamp(item,previous?.allocationMappings?.find((old:any)=>key(old)===key(item))))}:{})};
}
