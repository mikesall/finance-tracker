import { z } from "zod";
const text=z.string().min(1).max(4000);
const id=z.string().min(1).max(200).regex(/^[a-zA-Z0-9_:-]+$/);

// One exact, owner-authorized taxonomy mapping per original allocation key.
export const financeAllocationMappingsSchema=z.array(z.object({
 fromCategory:id,sourceSubcategories:z.array(text).min(1).max(100),
 category:id,subcategory:text,authority:text,
 effectiveAt:z.string().datetime({offset:true}).optional(),
}).strict()).max(100).superRefine((rules,ctx)=>{
 const seen=new Set<string>();
 for(const rule of rules)for(const subcategory of rule.sourceSubcategories){
  const key=JSON.stringify([rule.fromCategory,subcategory]);
  if(seen.has(key))ctx.addIssue({code:"custom",message:"Ambiguous allocation taxonomy mapping."});
  seen.add(key);
 }
});
