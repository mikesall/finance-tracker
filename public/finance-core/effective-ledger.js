'use strict';
// Pure read model: source snapshots and saved workspaces are never modified.
globalThis.EffectiveLedger = (() => {
  const copy=x=>JSON.parse(JSON.stringify(x));
  // Storage/schema validation may reorder object fields without an item edit.
  const canonical=x=>Array.isArray(x)?x.map(canonical):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,canonical(x[k])])):x;
  const same=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
  const expenseKinds=new Set(globalThis.FinanceProfile?.sourceExpenseKinds||['expense_payment','debt_payment']);
  const categoryIdsDefault={'Bills & utilities':'utilities','Entertainment':'entertainment','Financial':'fees','Food':'food','Gifts & donations':'gifts','Health & personal care':'health','Housing':'housing','Income':'income','Income taxes':'tax','Other / needs review':'other','Services':'services','Shopping':'shopping','Transfers':'transfers','Transportation':'transport','Travel':'travel'};
  function sourceTreatment(t){
    const custom=globalThis.FinanceProfile?.sourceTreatment?.(t);if(custom!==undefined)return custom;
    if(t.kind==='excluded_income')return 'income';
    if(t.kind==='excluded_transfer_or_card_repayment')return 'transfer';
    if(t.kind.startsWith('unresolved'))return 'unresolved';
    if(t.ongoingTreatment==='excluded_confirmed_historical_one_off')return 'one_time';
    if(t.ongoingTreatment==='excluded_discontinued')return 'discontinued';
    if(t.reportingCategory==='Income taxes')return 'tax';
    return t.ongoingTreatment==='unresolved'?'unresolved':'unassessed';
  }
  function categoryId(t,w,categories,policy){
    const categoryIds={...categoryIdsDefault,...(globalThis.FinanceProfile?.sourceCategoryIds||{})};
    const label=String(t.reportingCategory||'').trim().toLowerCase(),known=Object.keys(categoryIds).find(name=>name.toLowerCase()===label);
    const canonical=categoryIds[known]||'source_'+Array.from(new TextEncoder().encode(t.reportingCategory)).map(c=>c.toString(16).padStart(2,'0')).join('').slice(0,160);
    const mapped=w.sourceCategoryMappings?.[canonical]||policy?.categoryAliases?.[canonical]||canonical;
    if(categories.some(c=>c.id===mapped))return mapped;
    // Native reports may use an owner-renamed label. Resolve against the same
    // effective names used by current rows and filters before creating a bucket.
    const named=categories.find(c=>{const id=w.sourceCategoryMappings?.[c.id]||policy?.categoryAliases?.[c.id]||c.id;return c.name.trim().toLowerCase()===label||(w.categoryNameOverrides?.[id]||policy?.categoryNames?.[id]||c.name).trim().toLowerCase()===label;});if(named)return named.id;
    // Unknown reporting categories stay visible and do not invent a budget.
    const id='source_'+Array.from(new TextEncoder().encode(t.reportingCategory)).map(c=>c.toString(16).padStart(2,'0')).join('').slice(0,160);
    if(!categories.some(c=>c.id===id))categories.push({id,name:t.reportingCategory||'Unclassified source',annualCents:0,budgeted:false,note:'Reporting category from the current private source; no allowance approved.'});
    return id;
  }
  function sourceBase(t,w,categories,id=t.id,policy=null){
    const defaults=globalThis.FinanceProfile?.incomeTaxDefaults,assessment=defaults?t.taxAssessment:null;
    const tax=assessment?.confidence==='high'&&['income','property','sales'].includes(assessment.kind)?assessment:defaults&&(assessment||t.reportingCategory==='Income taxes')?{kind:'ambiguous',confidence:'unknown',basis:assessment?.basis||'Income-tax identity is not established by a category label alone.'}:null;
    const label=tax?.kind==='income'?'Income taxes':tax?.kind==='property'?'Home':tax?.kind==='ambiguous'?'Other / needs review':null,classified=label?{...t,reportingCategory:label}:t;
    return {
    id,date:t.date,amountCents:Math.round(t.amount*100),merchant:t.merchant,description:t.merchant,account:t.account,
    ...(t.classificationState?{classificationState:t.classificationState}:{}),category:categoryId(classified,w,categories,policy),subcategory:t.reportingSubcategory||(t.sourceDetailedCategory||'').replaceAll('_',' '),treatment:tax?.kind==='income'?'tax':sourceTreatment(classified),...(tax?{taxAssessment:copy(tax),taxNeedsClarification:tax.kind==='ambiguous'}:{}),label:t.merchant,note:'',review:[...t.flags],evidence:t.classificationBasis,
    sourceCategory:t.sourceCategory,sourceDetail:t.sourceDetailedCategory||'',sourceConfidence:t.sourceConfidence,linkedTransfer:t.hasTransferLink,source:'ChatGPT Finances snapshot',splits:[],
  };}
  function partsFor(t){
    if(t.splitConflict)return [{...t,category:t.conflictCategory,subcategory:'Unallocated · split needs review',treatment:'unresolved',partId:'conflict',splits:[],parentAmountCents:t.amountCents,label:t.label+' · split conflict',paymentEligible:t.sourcePaymentEligible}];
    return t.splits?.length?t.splits.map(p=>({...t,...p,id:t.id,partId:p.id,parentAmountCents:t.amountCents,label:p.label||t.label,paymentEligible:!['transfer','income','outside','unresolved'].includes(p.treatment)})):[{...t,partId:'whole',parentAmountCents:t.amountCents,paymentEligible:t.paymentEligible??!['transfer','income','outside','unresolved'].includes(t.treatment)}];
  }
  function included(p,mode='personal'){if(p.spendingExclusionCategories?.includes(p.category))return false;return mode==='ongoing'?p.treatment==='ongoing':!!p.paymentEligible;}
  /** @param {any} w @param {any} n @param {Map<string,string>} aliases @param {any} original @param {any} policy */
  function build(w,n,aliases=new Map(),original=null,policy=null){
    const categories=copy(w.categories),originalById=new Map((original?.transactions||[]).map(t=>[t.id,t])),stored=new Map(w.transactions.map(t=>[t.id,t]));
    // Owner policy can introduce a reporting category without editing the
    // stored workspace. Explicit names establish these category identities.
    for(const [id,name] of Object.entries(policy?.categoryNames||{}))if(!categories.some(c=>c.id===id))categories.push({id,name,annualCents:0,budgeted:false,note:'Owner-defined reporting category; approved components determine its budget.'});
    const sourceBySavedId=new Map();
    for(const t of n?.transactions||[]){const id=stored.has(t.id)?t.id:aliases.get(t.id)||t.id;if(sourceBySavedId.has(id))throw Error('Source IDs resolve to the same saved record.');sourceBySavedId.set(id,t);}
    const ids=new Set([...stored.keys(),...sourceBySavedId.keys()]);
    const rows=[];
    const clarifyText=value=>(policy?.displayReplacements||[]).reduce((text,r)=>text.replace(new RegExp(r.pattern,'gi'),()=>r.replacement),value||'');
    const policyRules=[...(policy?.rules||[])].sort((a,b)=>a.priority-b.priority);
    const matches=(pattern,value)=>!pattern||new RegExp(pattern,'i').test(value||'');
    const profile=globalThis.FinanceProfile||{},profileContext=profile.prepareClassification?.({w,n,policy,matches})||{};
    for(const id of ids){
      const saved=stored.get(id),source=sourceBySavedId.get(id),initial=originalById.get(id),o=w.overrides[id]||{};
      const base=source?sourceBase(source,w,categories,id,policy):copy(saved);
      const preserved={};
      if(!source&&saved&&initial&&!same(saved.label,initial.label))preserved.label=saved.label;
      if(source&&saved){
        base.subcategory=saved.subcategory||base.subcategory;
        if(!original)for(const key of ['label','note','category','subcategory','treatment','splits'])preserved[key]=copy(saved[key]);
        // Direct historical edits (including category merges) remain item-specific.
        for(const key of ['label','note','category','subcategory','treatment','splits'])if(initial&&!same(saved[key],initial[key]))preserved[key]=copy(saved[key]);
        // Existing item allocations and historical exclusions are retained with provenance.
        if(saved.splits?.length)preserved.splits=copy(saved.splits);
        if(['one_time','discontinued','outside'].includes(saved.treatment)&&!Object.hasOwn(preserved,'treatment'))preserved.treatment=saved.treatment;
        if(saved.label!==saved.merchant)preserved.label=saved.label;
        if(saved.note)preserved.note=saved.note;
        // The saved seed does not establish recurrence or exact receipt mapping.
      }
      const rule=[...w.rules].reverse().find(r=>r.merchant===base.merchant);
      const policyPatch={},policyNotes=[],appliedRules=[];let categoryPolicyAt=policy?.issuedAt;
      const details=[saved?.label,saved?.subcategory,saved?.evidence,base.description,base.sourceDetail].join(' ');
      const unresolvedIds=policy?.unclassifiedCategoryIds||w.unclassifiedCategoryIds||profile.unclassifiedCategoryIds||[];
      const unclassified=t=>t?.classificationState==='unclassified'||(t?.classificationState!=='classified'&&unresolvedIds.includes(t?.category));
      const sourceUnclassified=source?.classificationState==='unclassified'||(source?.classificationState!=='classified'&&unclassified(base));
      const identified=!!(saved?.splits?.length||o.category||o.splits?.length||saved&&((!unclassified(saved))||['one_time','discontinued'].includes(saved.treatment)));
      for(const r of policyRules){
        if(r.sourceKeys&&!r.sourceKeys.includes(id)&&!r.sourceKeys.includes(source?.id))continue;
        if(r.onDate&&base.date!==r.onDate)continue;
        if(r.fromDate&&base.date<r.fromDate)continue;
        if(r.amountCents!==undefined&&base.amountCents!==r.amountCents)continue;
        if(!matches(r.merchantPattern,base.merchant)||!matches(r.accountPattern,base.account)||!matches(r.detailPattern,details)||(r.direction==='outflow'&&base.amountCents<=0)||(r.direction==='inflow'&&base.amountCents>=0))continue;
        if(r.scope==='unidentified_only'&&(identified||source&&!sourceUnclassified)){
          if(saved){preserved.category=saved.category;preserved.subcategory=saved.subcategory;}continue;
        }
        if(profile.allowClassificationRule?.({rule:r,base,saved,policy,context:profileContext})===false)continue;
        Object.assign(policyPatch,{category:r.category,subcategory:r.subcategory,...(r.treatment?{treatment:r.treatment}:{}),...(r.label?{label:r.label}:{})});
        categoryPolicyAt=r.effectiveAt||policy?.issuedAt;
        if(r.splits)policyPatch.splits=copy(r.splits);
        if(r.status)policyPatch.reportingStatus=r.status;
        policyNotes.push(r.note);appliedRules.push(r.id);
      }
      profile.customizeClassification?.({policy,base,saved,o,policyPatch,preserved,policyNotes,appliedRules,matches,context:profileContext});
      if(policyPatch.category&&saved&&initial&&same(saved.category,initial.category))delete preserved.category;
      if(policyPatch.subcategory&&saved&&initial&&same(saved.subcategory,initial.subcategory))delete preserved.subcategory;
      if(policyPatch.treatment&&saved&&initial&&same(saved.treatment,initial.treatment))delete preserved.treatment;
      if(policyPatch.label&&saved&&initial&&same(saved.label,initial.label))delete preserved.label;
      // Verified exact receipt allocations supersede the unchanged seed split.
      // Direct item edits and explicit override splits continue to win.
      if(policyPatch.splits&&saved&&initial&&same(saved.splits,initial.splits))delete preserved.splits;
      // Compare classification decisions, not the time a budget-only policy
      // revision was saved. Unknown dates never prove a manual rule is newer.
      const at=value=>typeof value==='string'?Date.parse(value):NaN;
      const manualAt=at(rule?.createdAt),policyAt=at(categoryPolicyAt);
      const manualRule=rule?{category:rule.category,subcategory:rule.subcategory||base.subcategory}:{};
      const ruleAfterPolicy=Number.isFinite(manualAt)&&Number.isFinite(policyAt)&&manualAt>policyAt;
      const mapped=id=>w.sourceCategoryMappings?.[id]||policy?.categoryAliases?.[id]||id;
      const mappingFor=part=>policy?.allocationMappings?.find(r=>r.fromCategory===mapped(part.category)&&r.sourceSubcategories.includes(part.subcategory));
      const policyMapping=mappingFor({...base,...policyPatch}),mappingAt=at(policyMapping?.effectiveAt);
      // A newer taxonomy decision also wins when an older merchant rule would
      // otherwise divert the original allocation outside the mapping's key.
      const mappingBeatsManual=!!rule&&Number.isFinite(mappingAt)&&(!Number.isFinite(manualAt)||manualAt<=mappingAt);
      const mappedDefault=mappingBeatsManual?{category:mapped(policyMapping.category),subcategory:policyMapping.subcategory}:{};
      const itemClassified=['category','subcategory'].some(key=>Object.hasOwn(preserved,key)||Object.hasOwn(o,key));
      const manualControls=!!rule&&(!policyPatch.category||ruleAfterPolicy)&&!itemClassified&&!mappingBeatsManual;
      const t={...base,...(ruleAfterPolicy?policyPatch:manualRule),...(ruleAfterPolicy?manualRule:policyPatch),...mappedDefault,...preserved,...copy(o)};
      t.category=mapped(t.category);t.splits=(t.splits||[]).map(p=>({...p,category:mapped(p.category)}));
      // Apply a taxonomy mapping once. Versioned mappings respect a genuinely
      // newer merchant choice; legacy undated mappings keep old behavior.
      // Direct item/split precedence and immutable source amounts are retained.
      const regroup=(part,whole=false)=>{const r=mappingFor(part);if(!r)return part;if(whole&&manualControls&&Number.isFinite(at(r.effectiveAt))&&manualAt>at(r.effectiveAt))return part;return {...part,category:mapped(r.category),subcategory:r.subcategory};};
      const regrouped=mappingBeatsManual&&!itemClassified?t:regroup(t,true);t.category=regrouped.category;t.subcategory=regrouped.subcategory;t.splits=t.splits.map(part=>regroup(part));
      t.label=clarifyText(t.label);t.subcategory=clarifyText(t.subcategory);t.splits=t.splits.map(part=>({...part,label:clarifyText(part.label),subcategory:clarifyText(part.subcategory)}));
      t.appliedPolicyRules=appliedRules;t.policyNotes=policyNotes;
      t.id=id;t.amountCents=base.amountCents;t.date=base.date;t.sourceId=source?.id||null;t.sourceState=source?'current':n?'not_in_current_snapshot':'saved';
      t.sourcePaymentEligible=source?expenseKinds.has(source.kind):!['income','transfer','outside','unresolved'].includes(t.treatment);
      t.paymentEligible=!['income','transfer','outside','unresolved'].includes(t.treatment);
      t.spendingExclusionCategories=[...(policy?.spendingExclusions?.categoryIds||[])];
      if(profile.incomeTaxDefaults&&(policy?.incomeTaxTreatment||'exclude')==='exclude')t.spendingExclusionCategories.push(mapped(profile.incomeTaxDefaults.incomeCategoryId));
      if(t.taxNeedsClarification&&t.category!==mapped(base.category)&&(Object.hasOwn(o,'category')||Object.hasOwn(preserved,'category')||appliedRules.length||rule))t.taxNeedsClarification=false;
      t.classificationOrigin=Object.keys(o).length?'Saved item correction':Object.keys(preserved).length?'Preserved historical item decision':appliedRules.length?'Owner-confirmed reporting policy':rule?'Saved exact-merchant rule':source?'Validated source reporting classification':'Saved historical classification';
      t.edited=!!Object.keys(o).length;t.ruleApplied=!!rule;
      const warnings=policyNotes.filter(note=>/unresolved|estimate|disputed|pending|moving|not confirmed/i.test(note));
      if(source&&saved&&saved.amountCents!==base.amountCents)warnings.push('Source amount changed. Saved notes and allocations are retained.');
      if(source&&saved&&saved.date!==base.date)warnings.push('Source posting date changed; saved item corrections are retained.');
      if(source&&saved?.splits?.length&&initial&&same(saved.splits,initial.splits)&&!o.splits&&!policyPatch.splits)warnings.push('Historical split retained for review; its exact mixed-order receipt mapping is not established.');
      if(source&&['one_time','discontinued','outside'].includes(preserved.treatment)&&preserved.treatment!==base.treatment)warnings.push('Saved historical treatment differs from source classification; review the item-level evidence.');
      t.splitConflict=!!t.splits?.length&&(t.splits.reduce((a,p)=>a+p.amountCents,0)!==t.amountCents||t.splits.some(p=>!categories.some(c=>c.id===p.category)||(p.amountCents&&Math.sign(p.amountCents)!==Math.sign(t.amountCents))));
      if(t.splitConflict){warnings.push('Saved split no longer matches the current source amount/category. Allocations are retained unchanged; the current payment is shown unallocated until repaired.');const fallback=categories.find(c=>unresolvedIds.includes(c.id))||categories[0];t.conflictCategory=fallback.id;}
      if(source&&['unassessed','unresolved'].includes(t.treatment))warnings.push('Ongoing/economic treatment is unassessed; a payment is not a validated ongoing expense.');
      if(t.sourceState==='not_in_current_snapshot')warnings.push('Saved history: absent from the latest source window/result. Retained for reference, excluded from current-source totals.');
      const resolvedMembership=policyPatch.treatment==='transfer'||policyPatch.treatment==='income';
      const unresolvedFlags=(source?.flags||[]).filter(f=>!(resolvedMembership&&f==='membership_unresolved'));
      const savedReview=(o.reviewed?[]:(o.review||saved?.review||base.review||[])).filter(f=>!(resolvedMembership&&/membership_unresolved|personal.*business|investment.*movement|purpose.*unknown/i.test(f)));
      t.review=[...new Set([...savedReview,...unresolvedFlags,...warnings])];
      t.savedSourceAmountCents=saved?.amountCents??null;
      rows.push(t);
    }
    const grouped=new Map();
    for(const c of categories){const id=w.sourceCategoryMappings?.[c.id]||policy?.categoryAliases?.[c.id]||c.id,name=w.categoryNameOverrides?.[id]||policy?.categoryNames?.[id]||c.name;const current=grouped.get(id);if(current){current.annualCents+=c.annualCents;current.note+=' '+c.note;}else grouped.set(id,{...c,id,name});}
    const effectiveCategories=[...grouped.values()].map(c=>({...c,annualCents:w.budgetGroupOverrides?.[c.id]??c.annualCents,note:clarifyText(c.note)}));
    const parts=rows.flatMap(partsFor);
    const warningResolutions=policyRules.filter(r=>r.resolvedSourceWarning&&rows.some(t=>t.appliedPolicyRules.includes(r.id))&&rows.filter(t=>t.appliedPolicyRules.includes(r.id)).every(t=>t.treatment===r.treatment));
    const sourceWarnings=(n?.metadata.warnings||[]).map(note=>clarifyText(warningResolutions.find(r=>matches(r.resolvedSourceWarning.pattern,note))?.resolvedSourceWarning.replacement||note));
    const meta=n?{...w.meta,asOf:n.metadata.retrievedAt.slice(0,10),queriedAt:n.metadata.retrievedAt,coverageStart:n.metadata.period.start,coverageEnd:n.metadata.period.end,baselineStart:n.metadata.period.start,baselineEnd:n.metadata.period.end,sourceFreshness:n.metadata.sourceFreshness,coverageComplete:false,sourceFile:'Connected ChatGPT Finances snapshot',sourceCount:n.transactions.length,accounts:n.accounts.map(a=>a.label),limitations:[...sourceWarnings,'All-account completeness and economic/ongoing spending remain unresolved. Saved history outside the current source result is retained separately.']}:{...w.meta};
    const result={rows,parts,categories:effectiveCategories,...(profile.incomeTaxDefaults?{defaultSpendingExclusionCategories:(policy?.incomeTaxTreatment||'exclude')==='exclude'?[w.sourceCategoryMappings?.[profile.incomeTaxDefaults.incomeCategoryId]||policy?.categoryAliases?.[profile.incomeTaxDefaults.incomeCategoryId]||profile.incomeTaxDefaults.incomeCategoryId]:[]}:{}),...((policy?.recurringCosts||w.recurringCosts)?{recurringCosts:[...new Map([...(policy?.recurringCosts||[]),...(w.recurringCosts||[])].map(r=>[r.id,copy(r)])).values()]}:{}),meta,sourceCount:n?.transactions.length??0,conflictCount:rows.filter(t=>t.splitConflict).length,economicSpendingCents:n?null:undefined,ongoingBaselineCents:n?null:undefined,policy,...(profile.classificationDiagnostics?.(rows,profileContext)||{}),sourceWarnings,pendingRefundCount:rows.filter(t=>t.sourceState==='current'&&t.reportingStatus==='refund_pending'&&t.amountCents>0).length,pendingRefundCents:rows.filter(t=>t.sourceState==='current'&&t.reportingStatus==='refund_pending'&&t.amountCents>0).reduce((a,t)=>a+t.amountCents,0),ongoingExcluded:rows.filter(t=>['one_time','discontinued','transfer','income','outside'].includes(t.treatment))};
    return profile.finalizeLedger?.({result,w,policy,clarifyText})||result;
  }
  function aggregate(parts){
    const byCategory={},byMonth={};let totalCents=0;
    for(const p of parts){totalCents+=p.amountCents;byCategory[p.category]=(byCategory[p.category]||0)+p.amountCents;const m=p.date.slice(0,7);byMonth[m]=(byMonth[m]||0)+p.amountCents;}
    return {totalCents,byCategory,byMonth};
  }
  function persistableBase(t){const out={};for(const k of ['id','date','amountCents','merchant','description','account','category','subcategory','treatment','label','note','review','evidence','sourceCategory','sourceDetail','sourceConfidence','linkedTransfer','source','splits'])out[k]=copy(t[k]);if(t.classificationState)out.classificationState=t.classificationState;out.splits=[];return out;}
  /** @param {any} w @param {any} n @param {any} envelope @param {Map<string,string>} aliases @param {any} original @param {any} policy */
  function buildLookback(w,n,envelope,aliases=new Map(),original=null,policy=null){
    const context=envelope?.lookback;if(!n||!context)return null;
    const sourceIds=new Set(n.transactions.map(t=>t.id)),unique=new Map(),overlaps=[];
    for(const t of context.transactions||[]){if(sourceIds.has(t.id)){overlaps.push(t.id);continue;}if(!unique.has(t.id))unique.set(t.id,t);}
    // Reuse current source for the same rule context, but expose only supplemental
    // rows. Never merge these rows into the main model or editable workspace.
    const combined=build(w,{...n,transactions:[...n.transactions,...unique.values()]},aliases,original,policy);
    const rows=combined.rows.filter(t=>unique.has(t.sourceId));
    return {context,revision:envelope.revision,digest:envelope.digest,rows,parts:rows.flatMap(partsFor),categories:combined.categories,sourceOverlaps:overlaps.length};
  }
  return {build,buildLookback,partsFor,included,aggregate,persistableBase};
})();
