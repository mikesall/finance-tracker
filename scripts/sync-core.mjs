import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {verifyRelease,readManifest,verifyFile,safePath,digest} from './core-release.mjs';
const source=path.resolve(fileURLToPath(new URL('..',import.meta.url))),args=process.argv.slice(2);
if(args.filter(a=>a==='--target').length!==1||args.filter(a=>a==='--expected-manifest-sha').length>1||args.some((a,i)=>!['--target','--apply','--expected-manifest-sha'].includes(a)&&!['--target','--expected-manifest-sha'].includes(args[i-1])))throw Error('Usage: node scripts/sync-core.mjs --target PATH [--expected-manifest-sha SHA256] [--apply]');
const input=args[args.indexOf('--target')+1];if(!input||input.startsWith('--'))throw Error('A target directory is required.');
const target=fs.realpathSync(input);if(target===fs.realpathSync(source))throw Error('Source and target must be separate directories.');
if(args.includes('--expected-manifest-sha')){const expected=args[args.indexOf('--expected-manifest-sha')+1];if(!/^[a-f0-9]{64}$/.test(expected||'')||digest(fs.readFileSync(path.join(source,'CORE_RELEASE.json')))!==expected)throw Error('Release manifest does not match the reviewed pin.');}
const next=verifyRelease(source),manifestPath=path.join(target,'CORE_RELEASE.json'),previous=fs.existsSync(manifestPath)?readManifest(target):null;
if(previous){
 for(const f of previous.files)verifyFile(target,f);
 const old=new Set(previous.files.map(f=>f.path));
 for(const f of next.files){const p=safePath(target,f.path);if(!old.has(f.path)&&fs.existsSync(p))throw Error(`Untracked target core file: ${f.path}`);}
}else{for(const f of next.files)verifyFile(target,f);}
const oldMap=new Map((previous?.files||[]).map(f=>[f.path,f])),newMap=new Map(next.files.map(f=>[f.path,f]));
const changed=next.files.filter(f=>oldMap.get(f.path)?.sha256!==f.sha256),removed=(previous?.files||[]).filter(f=>!newMap.has(f.path));
console.log(JSON.stringify({mode:args.includes('--apply')?'apply':'dry-run',release:next.version,changed:changed.map(f=>f.path),removed:removed.map(f=>f.path),adoptingIdenticalCore:!previous},null,2));
if(args.includes('--apply')){
 const backupRoot=path.join(target,'.core-backups');if(fs.existsSync(backupRoot)&&fs.lstatSync(backupRoot).isSymbolicLink())throw Error('Backup directory must not be a symlink.');
 const backup=path.join(backupRoot,Date.now()+'-'+crypto.randomBytes(6).toString('hex'));fs.mkdirSync(backup,{recursive:true});
 for(const f of [...changed,...removed]){const p=safePath(target,f.path);if(fs.existsSync(p)){const b=path.join(backup,f.path);fs.mkdirSync(path.dirname(b),{recursive:true});fs.copyFileSync(p,b);}}
 if(previous)fs.copyFileSync(manifestPath,path.join(backup,'CORE_RELEASE.json'));
 console.log('Private local backup: '+backup);
 for(const f of changed){const dest=safePath(target,f.path);fs.mkdirSync(path.dirname(dest),{recursive:true});const temp=dest+'.core-update-'+crypto.randomBytes(6).toString('hex');fs.copyFileSync(safePath(source,f.path),temp);fs.renameSync(temp,dest);}
 for(const f of removed)fs.unlinkSync(safePath(target,f.path));
 const tempManifest=manifestPath+'.update-'+crypto.randomBytes(6).toString('hex');fs.copyFileSync(path.join(source,'CORE_RELEASE.json'),tempManifest);fs.renameSync(tempManifest,manifestPath);
 console.log('Core updated. Validate the private deployment before publication.');
}
