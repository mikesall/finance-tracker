import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const root=new URL('..',import.meta.url);
const shell=fs.readFileSync(new URL('finance-core/ui/ledger-shell.html',root),'utf8');
const manifest=JSON.parse(fs.readFileSync(new URL('CORE_RELEASE.json',root),'utf8'));
// This endpoint intentionally renders the deployment's private profile adapter.
// Backend APIs are data interfaces, not shell assets, and remain private.
const privateAdapters=new Map([['/finance-profile.js','Owner-specific presentation and classification adapter']]);
function dependencies(html){
 const result=new Set(),attrs={script:['src'],link:['href'],img:['src','srcset'],source:['src','srcset'],audio:['src'],video:['src','poster'],iframe:['src'],object:['data'],embed:['src'],input:['src']};
 const add=value=>{if(!value||value.startsWith('#')||value.startsWith('data:'))return;const url=new URL(value,'https://template.invalid/');assert.equal(url.origin,'https://template.invalid','External shell dependencies require an explicit reviewed integration');result.add(url.pathname);};
 for(const [,tag,body] of html.matchAll(/<([a-z][a-z0-9:-]*)\b([^>]*)>/gi)){
  const watched=attrs[tag.toLowerCase()];if(!watched)continue;
  for(const [,name,double,single,unquoted] of body.matchAll(/\b([a-z][a-z0-9:-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/gi))if(watched.includes(name.toLowerCase())){
   const value=double??single??unquoted;
   if(name.toLowerCase()==='srcset'&&!value.startsWith('data:'))value.split(',').forEach(part=>add(part.trim().split(/\s+/)[0]));else add(value);
  }
 }
 for(const [,,value] of html.matchAll(/\burl\(\s*(["']?)(.*?)\1\s*\)/gi))add(value);
 for(const [,,value] of html.matchAll(/@import\s+(["'])(.*?)\1/gi))add(value);
 return [...result].sort();
}
function verify(html,files){const shared=new Set(files.map(f=>f.path));for(const url of dependencies(html))assert.ok(shared.has('public'+url)||privateAdapters.has(url),'Unpinned shell dependency: '+url);}
test('every loaded shell dependency is shared or the intentional private profile adapter',()=>{verify(shell,manifest.files);const urls=dependencies(shell);assert.ok(urls.includes('/pulse.svg'));assert.ok(urls.includes('/dashboard-requests.js'));assert.deepEqual(urls.filter(url=>privateAdapters.has(url)),['/finance-profile.js']);});
test('omitting either generic shell asset from the shared manifest fails coverage',()=>{for(const path of ['public/pulse.svg','public/dashboard-requests.js'])assert.throws(()=>verify(shell,manifest.files.filter(f=>f.path!==path)),/Unpinned shell dependency/);});
test('new unpinned scripts, styles, CSS resources and private adapters fail coverage',()=>{for(const extra of ['<script src="/extra.js"></script>','<script src=/extra.js></script>','<link rel="stylesheet" href="/extra.css">','<style>.example{background:url("/extra.svg")}</style>','<script src="/another-private-adapter.js"></script>'])assert.throws(()=>verify(shell+extra,manifest.files),/Unpinned shell dependency/);assert.throws(()=>verify(shell+'<script src="https://example.invalid/extra.js"></script>',manifest.files),/External shell dependencies/);});
