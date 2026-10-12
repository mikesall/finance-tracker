'use strict';
(()=>{
 const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const drafts=new Map();let state={availability:{available:false},requests:[]},basis=null;
 const key=context=>JSON.stringify(context),storageKey=context=>'finance-request-draft:'+key(context);
 const same=(request,context)=>{const entity=request.context?.entity;return entity?.type===context.type&&(context.type==='category'?entity.categoryId===context.categoryId:context.type==='clarification'?entity.transactionRef===context.transactionRef:true);};
 const safeLink=value=>{try{const u=new URL(value);return ['https:','codex:'].includes(u.protocol)&&!u.username&&!u.password?u.href:null;}catch{return null;}};
 function draft(context){const id=key(context);if(!drafts.has(id)){let saved;try{saved=JSON.parse(sessionStorage.getItem(storageKey(context))||'null');}catch{}drafts.set(id,saved?.context&&key(saved.context)===id?saved:{id:crypto.randomUUID(),message:'',context,basis,uncertain:false});}return drafts.get(id);}
 const persist=d=>{try{sessionStorage.setItem(storageKey(d.context),JSON.stringify(d));}catch{}};
 function statuses(context){return state.requests.filter(r=>same(r,context)).slice(0,3).map(r=>`<div class="dashboard-request-receipt"><span>${escape(r.message)}</span><b>${escape(r.status==='working'&&(!r.heartbeatAt||Date.now()-Date.parse(r.heartbeatAt)>=120000)?'Awaiting status':r.displayStatus||'Queued')}</b>${r.resolution?`<span>${escape(r.resolution)}</span>`:''}${safeLink(r.threadUrl)?`<a href="${escape(safeLink(r.threadUrl))}" target="_blank" rel="noopener noreferrer">View thread</a>`:''}</div>`).join('');}
 function markup(context){
  if(!state.availability.available||!basis)return '';
  const d=draft(context),title=context.type==='clarification'?'Add your response':context.type==='category'?'Want to change anything?':'Update targets';
  return `<section class="dashboard-request" data-request-context="${escape(key(context))}"><form class="dashboard-request-form"><label>${escape(title)}<span class="dashboard-request-input"><textarea aria-label="${escape(title)}" rows="2" maxlength="4000" required ${d.uncertain?'readonly':''}>${escape(d.message)}</textarea><button type="submit" class="dashboard-request-send" aria-label="${d.uncertain?'Check request status and retry':'Send request'}"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m3 10 14-7-5 14-2-5-7-2Zm7 2 7-9"/></svg></button></span></label>${context.type==='portfolio_targets'?'<p class="subtle">Describe the targets you want to plan toward.</p>':''}<p class="dashboard-request-feedback" role="status" aria-live="polite">${d.uncertain?'Delivery is uncertain. Check status before retrying.':''}</p></form><div class="dashboard-request-history">${statuses(context)}</div></section>`;
 }
 async function call(path,body){const response=await fetch(path,{cache:'no-store',...(body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});let value;try{value=await response.json();}catch{throw Error('The response was interrupted. Check status before retrying.');}if(!response.ok){const error=Error(value.error||'Request unavailable.');error.definite=response.status>=400&&response.status<500;throw error;}return value;}
 function accept(record,context){state.requests=[record,...state.requests.filter(r=>r.id!==record.id)];drafts.delete(key(context));try{sessionStorage.removeItem(storageKey(context));}catch{}}
 async function send(form){
  const section=form.closest('[data-request-context]'),context=JSON.parse(section.dataset.requestContext),d=draft(context),input=form.querySelector('textarea'),button=form.querySelector('button'),feedback=form.querySelector('[role="status"]');
  if(button.disabled||!state.availability.available)return;
  if(!d.uncertain){d.message=input.value.trim();d.basis=basis;if(!d.message){input.focus();return;}persist(d);}
  button.disabled=true;input.readOnly=true;feedback.textContent=d.uncertain?'Checking request status…':'Sending…';
  try{
   if(d.uncertain){const found=await call('/api/finance/dashboard-requests?id='+encodeURIComponent(d.id));const saved=found.requests?.find(r=>r.id===d.id);if(saved){accept(saved,context);section.outerHTML=markup(context);return;}}
   d.uncertain=true;persist(d);
   const {id,message,basis:at,context:entity}=d;
   const saved=await call('/api/finance/dashboard-requests',{id,message,basis:at,context:entity});
   accept(saved,context);section.outerHTML=markup(context);
  }catch(error){if(error.definite){d.uncertain=false;d.id=crypto.randomUUID();}persist(d);input.readOnly=d.uncertain;feedback.textContent=error.message+(d.uncertain?' Your request ID is retained; use Send to check its status and retry.':'');button.disabled=false;}
 }
 document.addEventListener('submit',event=>{if(event.target.matches?.('.dashboard-request-form')){event.preventDefault();void send(event.target);}});
 document.addEventListener('input',event=>{const section=event.target.closest?.('[data-request-context]');if(!section||event.target.tagName!=='TEXTAREA')return;const d=draft(JSON.parse(section.dataset.requestContext));if(!d.uncertain){d.message=event.target.value;persist(d);}});
 document.addEventListener('click',event=>{
  if(event.target.closest?.('[data-request-targets]')&&state.availability.available){const dialog=document.querySelector('#request-dialog');dialog.innerHTML='<div class="category-drawer-head"><h2 id="request-dialog-title">Update targets</h2><button class="drawer-dismiss" data-close-request aria-label="Close request"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4 4 8 8M12 4l-8 8"/></svg></button></div><div class="category-detail-body">'+markup({type:'portfolio_targets'})+'</div>';dialog.showModal();dialog.onkeydown=e=>{if(e.key!=='Tab')return;const controls=[...dialog.querySelectorAll('button,textarea,a[href]')].filter(c=>!c.disabled),first=controls[0],last=controls.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}};dialog.querySelector('textarea')?.focus();}
  if(event.target.closest?.('[data-close-request]'))document.querySelector('#request-dialog').close();
 });
 let checking=false;
 setInterval(async()=>{if(checking||document.hidden||!state.availability.available)return;checking=true;try{const latest=await call('/api/finance/dashboard-requests');state={requests:latest.requests||[],availability:latest.availability||{available:false}};}catch{}finally{checking=false;for(const section of document.querySelectorAll('[data-request-context]')){const context=JSON.parse(section.dataset.requestContext),history=section.querySelector('.dashboard-request-history');if(history)history.innerHTML=statuses(context);for(const control of section.querySelectorAll('button,textarea'))control.disabled=!state.availability.available;}for(const button of document.querySelectorAll('[data-request-targets]'))button.hidden=!state.availability.available;}},15000);
 globalThis.FinanceRequests={configure(value,nextBasis){state={requests:Array.isArray(value?.requests)?value.requests:[],availability:{...value?.availability,available:value?.availability?.available===true}};basis=nextBasis;},available:()=>state.availability.available,markup};
})();
