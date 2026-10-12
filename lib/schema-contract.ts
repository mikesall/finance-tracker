import type { ZodTypeAny } from "zod";
// A read-only structural guide. Canonical Zod validation also enforces semantic
// date, coverage, count, identity and reconciliation refinements at write time.
export function describeSchema(schema:ZodTypeAny):Record<string,unknown>{
 const d=schema._def as any,type=d.typeName;
 if(type==="ZodEffects")return describeSchema(d.schema);
 if(type==="ZodOptional"||type==="ZodDefault")return describeSchema(d.innerType);
 if(type==="ZodNullable")return {anyOf:[describeSchema(d.innerType),{type:"null"}]};
 if(type==="ZodObject"){const shape=d.shape(),properties:Record<string,unknown>={};for(const [key,value] of Object.entries(shape))properties[key]=describeSchema(value as ZodTypeAny);return {type:"object",properties,required:Object.entries(shape).filter(([,value])=>!(value as ZodTypeAny).isOptional()).map(([key])=>key),additionalProperties:d.unknownKeys!=="strict"};}
 if(type==="ZodArray")return {type:"array",items:describeSchema(d.type),...(d.minLength?{minItems:d.minLength.value}:{}),...(d.maxLength?{maxItems:d.maxLength.value}:{})};
 if(type==="ZodRecord")return {type:"object",propertyNames:describeSchema(d.keyType),additionalProperties:describeSchema(d.valueType)};
 if(type==="ZodUnion")return {anyOf:d.options.map(describeSchema)};
 if(type==="ZodLiteral")return {const:d.value};
 if(type==="ZodEnum")return {type:"string",enum:d.values};
 if(type==="ZodString"){const result:Record<string,unknown>={type:"string"};for(const c of d.checks||[]){if(c.kind==='min')result.minLength=c.value;if(c.kind==='max')result.maxLength=c.value;if(c.kind==='regex')result.pattern=c.regex.source;if(c.kind==='datetime')result.format='date-time';if(c.kind==='url')result.format='uri';}return result;}
 if(type==="ZodNumber"){const result:Record<string,unknown>={type:d.checks?.some((x:any)=>x.kind==="int")?"integer":"number"};for(const c of d.checks||[]){if(c.kind==='min')result[c.inclusive?'minimum':'exclusiveMinimum']=c.value;if(c.kind==='max')result[c.inclusive?'maximum':'exclusiveMaximum']=c.value;}return result;}
 if(type==="ZodBoolean")return {type:"boolean"};
 if(type==="ZodNull")return {type:"null"};
 return {};
}
