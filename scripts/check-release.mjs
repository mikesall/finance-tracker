import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
import {verifyRelease} from './core-release.mjs';
const root=path.resolve(fileURLToPath(new URL('..',import.meta.url)));const m=verifyRelease(root);
const hosting=JSON.parse(fs.readFileSync(path.join(root,'.openai/hosting.json'),'utf8'));
if(JSON.stringify(hosting)!==JSON.stringify({d1:'DB',r2:null,capabilities:['mcp']}))throw Error('Release hosting configuration must be unbound.');
const seed=JSON.parse(fs.readFileSync(path.join(root,'profile/empty-workspace.json'),'utf8'));
if(seed.transactions.length||seed.rules.length||seed.housingPlan.length||seed.budgetHistory.length||Object.keys(seed.overrides).length||seed.categories.some(c=>c.annualCents||c.budgeted))throw Error('Release profile is not empty.');
const skip=new Set(['node_modules','dist','.git','.wrangler','.sites-runtime','.vinext','.next','.core-backups']);let files=0;
function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){if(skip.has(e.name)||e.name.endsWith('.tsbuildinfo')||e.name==='next-env.d.ts')continue;const full=path.join(dir,e.name),rel=path.relative(root,full);if(e.isSymbolicLink())throw Error('Release symlink: '+rel);if(e.isDirectory()){if(['private-data','private-profile','local-deployment','verification'].includes(e.name))throw Error('Private directory in release: '+rel);walk(full);}else{
 if(e.name==='CORE_UPSTREAM.json'||e.name.startsWith('.env')||/\.(sqlite|db|zip|log)$/.test(e.name))throw Error('Private/generated file in release: '+rel);
 if(e.name.endsWith('.sh')&&!(fs.statSync(full).mode&0o100))throw Error('Shell helper must be executable: '+rel);
 const text=fs.readFileSync(full,'utf8');if(/(?:appgprj_|appgdep_|libfile_)[a-f0-9]{20,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|(?:ghp_|github_pat_)[A-Za-z0-9_]{20,}|Bearer\s+[A-Za-z0-9._-]{24,}/.test(text))throw Error('Potential identity or secret in release: '+rel);files++;
 }}}
walk(root);console.log(JSON.stringify({ok:true,release:m.version,coreFiles:m.files.length,sourceFiles:files,emptyProfile:true,unboundHosting:true}));
