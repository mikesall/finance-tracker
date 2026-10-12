import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
export const roots=['public/finance-core/','finance-core/schemas/','finance-core/ui/'];
export const digest=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
export function safePath(root,relative){
 if(typeof relative!=='string'||relative.includes('\\')||relative.startsWith('/')||relative.split('/').some(p=>!p||p==='.'||p==='..')||!roots.some(r=>relative.startsWith(r)))throw Error('Invalid core path.');
 const target=path.join(root,relative);let current=root;
 for(const part of relative.split('/')){current=path.join(current,part);if(fs.existsSync(current)&&fs.lstatSync(current).isSymbolicLink())throw Error('Symlinks are not permitted in core paths.');}
 return target;
}
export function readManifest(root){
 const manifestPath=path.join(root,'CORE_RELEASE.json');
 if(fs.lstatSync(manifestPath).isSymbolicLink())throw Error('Manifest must not be a symlink.');
 const m=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
 if(m.schemaVersion!==1||typeof m.version!=='string'||!Array.isArray(m.files)||!m.files.length)throw Error('Invalid core manifest.');
 const seen=new Set();for(const f of m.files){safePath(root,f.path);if(seen.has(f.path)||!/^[a-f0-9]{64}$/.test(f.sha256)||!Number.isSafeInteger(f.bytes)||f.bytes<0)throw Error('Invalid core manifest entry.');seen.add(f.path);}
 return m;
}
export function verifyFile(root,f){const file=safePath(root,f.path);if(!fs.existsSync(file)||!fs.lstatSync(file).isFile())throw Error(`Missing core file: ${f.path}`);const bytes=fs.readFileSync(file);if(bytes.length!==f.bytes||digest(bytes)!==f.sha256)throw Error(`Modified core file: ${f.path}`);}
export function listCore(root){const files=[];function walk(relative){const full=path.join(root,relative);if(fs.lstatSync(full).isSymbolicLink())throw Error('Core symlink rejected.');if(fs.statSync(full).isDirectory()){for(const name of fs.readdirSync(full).sort())walk(relative+name+(fs.statSync(path.join(full,name)).isDirectory()?'/':''));}else files.push(relative);}
 for(const dir of roots)walk(dir);return files.sort();}
export function verifyRelease(root){const m=readManifest(root);for(const f of m.files)verifyFile(root,f);if(JSON.stringify(listCore(root))!==JSON.stringify(m.files.map(f=>f.path).sort()))throw Error('Manifest does not exactly cover the canonical core.');return m;}
