// Copy this generic checker alongside core-release.mjs into a private build.
// The private CORE_UPSTREAM.json is written only after a release is reviewed.
import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
import {verifyRelease,digest} from './core-release.mjs';
const root=path.resolve(fileURLToPath(new URL('..',import.meta.url))),pin=JSON.parse(fs.readFileSync(path.join(root,'CORE_UPSTREAM.json'),'utf8'));
if(pin.schemaVersion!==1||!/^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(pin.repository)||!/^[a-f0-9]{40}$/.test(pin.commit)||!/^[a-f0-9]{64}$/.test(pin.manifestSha256))throw Error('Invalid private upstream pin.');
if(digest(fs.readFileSync(path.join(root,'CORE_RELEASE.json')))!==pin.manifestSha256)throw Error('Core manifest differs from the reviewed upstream pin.');
const release=verifyRelease(root);if(release.version!==pin.version)throw Error('Core version differs from upstream pin.');
console.log(JSON.stringify({ok:true,version:release.version,coreFiles:release.files.length,verifiedPinnedCore:true}));
