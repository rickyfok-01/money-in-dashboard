"use strict";
let __scopeMode=null;              /* last mode the snapshot group was rendered for */
let __snapControls=[];             /* snapshot <select>s (rebuilt on mode change) */
let __staticScopeControls=[];      /* scheme/trustee pickers + month selects (built once) */

function scopeSelect(value,onChange){
  const sel=el("select","scope-sel scope-data");
  DATA.snapshots.forEach(s=>{const o=el("option");o.value=s;o.textContent=s;if(s===value)o.selected=true;sel.appendChild(o);});
  sel.addEventListener("change",()=>onChange(sel.value));
  return sel;
}

/* Snapshot segment: one select (Current/Trend) or the Earlier/Latest A·B pair (Compare). */
function renderSnapshotGroup(){
  const host=$("#scopeSnap"); if(!host) return;
  host.innerHTML=""; const noScope=$("#scopeBar").classList.contains("is-nospace");
  if(state.mode==="compare"){
    const aSel=scopeSelect(state.snapA,v=>{state.snapA=v;render();});
    const bSel=scopeSelect(state.snapB,v=>{state.snapB=v;render();});
    host.append(el("span","lab","Earlier"),aSel,el("span","lab","Latest"),bSel);
    __snapControls=[aSel,bSel];
  }else{
    const sel=scopeSelect(state.snap,v=>{state.snap=v;render();});
    host.append(el("span","lab","Snapshot"),sel);
    __snapControls=[sel];
  }
  if(noScope) __snapControls.forEach(c=>c.disabled=true);
  __scopeMode=state.mode;
}

function buildScopeBar(){
  const bar=$("#scopeBar"); if(!bar) return;
  bar.innerHTML="";

  /* snapshot group (rebuilt on mode change) */
  const snapGrp=el("div","scope-grp"); snapGrp.id="scopeSnap"; bar.appendChild(snapGrp);
  renderSnapshotGroup();

  /* scheme picker — the primary entity, multi-select */
  const schemePicker=new MultiPicker({
    label:"Scheme", items:DATA.schemes,
    getName:c=>(DATA.names&&DATA.names.scheme&&DATA.names.scheme[c])||c,
    getValues:()=>state.schemes, setValues:a=>{state.schemes=a;}, onChange:()=>render()
  });
  bar.appendChild(schemePicker.root); window.__schemePicker=schemePicker;

  /* trustee picker */
  const trusteePicker=new MultiPicker({
    label:"Trustee", items:DATA.trustees,
    getName:c=>(DATA.names&&DATA.names.trustee&&DATA.names.trustee[c])||c,
    getValues:()=>state.trustees, setValues:a=>{state.trustees=a;}, onChange:()=>render()
  });
  bar.appendChild(trusteePicker.root); window.__trusteePicker=trusteePicker;

  /* month range (From–To, clamped to keep from ≤ to) */
  const fSel=el("select","scope-sel scope-data");
  const tSel=el("select","scope-sel scope-data");
  DATA.months.forEach(m=>{
    const o1=el("option");o1.value=m;o1.textContent=R9(m);if(m===state.mfrom)o1.selected=true;fSel.appendChild(o1);
    const o2=el("option");o2.value=m;o2.textContent=R9(m);if(m===state.mto)o2.selected=true;tSel.appendChild(o2);
  });
  fSel.addEventListener("change",()=>{state.mfrom=fSel.value;if(state.mfrom>state.mto){state.mto=state.mfrom;tSel.value=state.mfrom;}render();});
  tSel.addEventListener("change",()=>{state.mto=tSel.value;if(state.mto<state.mfrom){state.mfrom=state.mto;fSel.value=state.mfrom;}render();});
  const mGrp=el("div","scope-grp"); mGrp.append(el("span","lab","From"),fSel,el("span","lab","To"),tSel);
  bar.appendChild(mGrp);

  /* by-toggle (Money Allocation) — group by trustee / scheme, dimmed on other tabs */
  const byGrp=el("div","scope-grp"); byGrp.id="scopeAllocBy";
  const byLab=el("span","lab","Group");
  const byMode=el("div","scope-mode");
  for(const o of [{k:"tr",t:"Trustee"},{k:"sc",t:"Scheme"}]){
    const b=el("button"); b.type="button"; b.dataset.by=o.k; b.textContent=o.t;
    b.addEventListener("click",()=>{ if(b.disabled)return; window.__allocBy=o.k; render(); });
    byMode.appendChild(b);
  }
  byGrp.append(byLab,byMode); bar.appendChild(byGrp);

  __staticScopeControls=[schemePicker,trusteePicker,fSel,tSel];

  /* mode toggle (Current | Compare | Trend) — pushed to the right */
  bar.appendChild(el("div","scope-spacer"));
  const modeGrp=el("div","scope-mode"); modeGrp.id="scopeMode";
  for(const m of [{k:"current",t:"Current"},{k:"compare",t:"Compare"},{k:"trend",t:"Trend"}]){
    const b=el("button"); b.type="button"; b.dataset.m=m.k; b.textContent=m.t;
    b.addEventListener("click",()=>{ if(b.disabled)return; state.mode=m.k; document.body.dataset.mode=m.k; render(); });
    modeGrp.appendChild(b);
  }
  bar.appendChild(modeGrp);
}

/* Refresh scope-bar availability + labels for the active tab. Called from render(). */
function updateScopeBar(){
  const t=currentTab();
  /* mode buttons: enable per tab.modes, dim the rest */
  const modeHost=$("#scopeMode");
  if(modeHost) modeHost.querySelectorAll("button").forEach(b=>{
    const on=t.modes.includes(b.dataset.m);
    b.classList.toggle("on", on && state.mode===b.dataset.m);
    b.classList.toggle("dim", !on);
    b.disabled=!on;
  });
  /* data-scope controls: dim entirely on no-dataset tabs (Settings/Theme) */
  const noScope=!!t.noScope;
  const bar=$("#scopeBar"); if(bar) bar.classList.toggle("is-nospace", noScope);
  for(const c of [...__staticScopeControls, ...__snapControls]){
    if(c instanceof MultiPicker) c.disable(noScope);
    else if(c && "disabled" in c) c.disabled=noScope;
  }
  /* sync picker state — drill-through may have changed the selection */
  if(window.__schemePicker) window.__schemePicker.refresh();
  if(window.__trusteePicker) window.__trusteePicker.refresh();
  /* rebuild the snapshot segment when the mode changes shape (single vs A/B) */
  if(state.mode!==__scopeMode) renderSnapshotGroup();
  /* by-toggle: only active on money-allocation tab */
  const byHost=$("#scopeAllocBy");
  if(byHost){
    const isAlloc=t.id==="money-allocation";
    byHost.querySelectorAll("button").forEach(b=>{
      const on=isAlloc && window.__allocBy===b.dataset.by;
      b.classList.toggle("on",on);
      b.classList.toggle("dim",!isAlloc);
      b.disabled=!isAlloc;
    });
    byHost.style.opacity=isAlloc?"":"0.4";
  }
}

/* ============================================================
   TAB REGISTRY
   ============================================================ */
const TABS=[
  {id:"summary",n:"00",title:"Summary",sub:"Overview — KPIs and clickable charts that drill into the detail tabs.",modes:["current","compare","trend"],
    cap:"Summary",render:renderSummary},
  {id:"pend-tagging",n:"01",title:"Contribution Pend Tagging",sub:"Overview — ER-submitted (A) vs Pending-Tagging (B) per (scheme × period). Two-snapshot comparison.",modes:["current","compare","trend"],
    render:renderPendTagging},
  {id:"money-allocation",n:"02",title:"Money Allocation",sub:"Payment allocation: Pay AMT / Avail AMT / ALLOC% per (scheme × month) or (trustee × month). Compare adds pre ALLOC% + change %.",modes:["current","compare"],
    render:renderMoneyAllocation},
  {id:"scheme-scorecard",n:"03",title:"Scheme Scorecard",sub:"Per-scheme master table — the scheme-centric view. Click a scheme to focus the dashboard.",modes:["current","compare","trend"],
    render:c=>renderGrouped(c,{keyFn:r=>r.sc,keyLabel:"Scheme",kIsScheme:true,trendTop:8,spark:true,
      extraCurrent:(content,cg,arr)=>{
        const rows=rowsFor(state.snap);
        const cC=card(cg,"Coverage per scheme","submitted / billed",null,KEY_FULL);
        const sc2=ranked(groupBy(rows,r=>r.sc),{sortBy:"bill"});
        newBar(cC.canvas,{labels:sc2.map(a=>a.k),indexAxis:"y",pctScale:true,datasets:[{data:sc2.map(a=>a.coverage),backgroundColor:sc2.map(a=>(a.coverage>=1?POS:NEG)),maxBarThickness:16,borderRadius:3}]});
      }})},
  {id:"status-lifecycle",n:"04",title:"Status Lifecycle",sub:"Bills across the AV_STATUS_CODE lifecycle — shown as a lifecycle, not alphabetically.",modes:["current","compare","trend"],
    render:c=>{
      const cfg={keyFn:r=>r.st,keyLabel:"Status",order:DATA.statuses};
      renderGrouped(c,{...cfg,grid:"g2",extraCurrent:(content,cg,arr)=>{
        const rows=rowsFor(state.snap);
        const cM=card(cg,"Status mix per month","Stacked by lifecycle");
        const present=DATA.statuses.filter(s=>rows.some(r=>r.st===s));
        const ch=window.Chart?new Chart(cM.canvas,{type:"bar",
          data:{labels:DATA.months,datasets:present.map((s,i)=>({label:s,
            data:DATA.months.map(ym=>{const a=groupBy(rows.filter(r=>r.ym===ym&&r.st===s),()=>0).get(0);return a?a.bill:0;}),
            backgroundColor:statusColor(s),stack:"s"}))},
          options:baseOpts({indexAxis:"x",scales:{x:{stacked:true,grid:{display:false}},y:{stacked:true,grid:{color:cssVar("--hairline")},ticks:{callback:v=>fmt(v)}}},plugins:{legend:{display:true,position:"bottom"}}})}):null;
        if(ch)chartRegistry.push(ch);
        // forward-path funnel
        const all=totals({...groupBy(rows,()=>0).get(0)});
        const fwd=[["OPEN",all],["SUBMITTED",(()=>{const m=groupBy(rows.filter(r=>["PARTIAL_SUBMIT","SUBMITTED"].includes(r.st)),()=>0).get(0);return totals(m?{...m}:blank());})()],
          ["APPROVED",totals({...(groupBy(rows.filter(r=>r.st==="APPROVED"),()=>0).get(0)||blank())})],
          ["PAID",(()=>{const m=groupBy(rows.filter(r=>["PARTIAL_PAID","FULLY_PAID"].includes(r.st)),()=>0).get(0);return totals(m?{...m}:blank());})()],
          ["CLOSED",totals({...(groupBy(rows.filter(r=>r.st==="CLOSED"),()=>0).get(0)||blank())})]];
        const cF=card(cg,"Forward-path funnel","OPEN → SUBMITTED → APPROVED → PAID → CLOSED · ordinal");
        newBar(cF.canvas,{labels:fwd.map(f=>f[0]),indexAxis:"x",datasets:[{data:fwd.map(f=>f[1].bill),backgroundColor:fwd.map((_,i)=>SEQ[Math.min(SEQ.length-1,2+i)]),maxBarThickness:54,borderRadius:4}]});
      }});
    }},
  {id:"trustee",n:"05",title:"Trustee",sub:"Per-trustee roll-up across the 12 TR_CODE trustees.",modes:["current","compare","trend"],
    render:c=>renderGrouped(c,{keyFn:r=>r.tr,keyLabel:"Trustee",trendTop:8})},
  {id:"contribution-mode",n:"06",title:"Contribution Mode",sub:"AV_BILL_CONTR_MODE — REGULAR vs LUMP_SUM vs SURCHARGE.",modes:["current","compare","trend"],
    render:c=>renderGrouped(c,{keyFn:r=>r.bm,keyLabel:"Mode",order:DATA.modes,grid:"g3"})},
  {id:"frequency",n:"07",title:"Frequency",sub:"AV_FREQ_TYPE — contribution frequencies. Blank shown as (unset).",modes:["current","compare","trend"],
    render:c=>renderGrouped(c,{keyFn:r=>r.fq,keyLabel:"Frequency"})},
  {id:"account-type",n:"08",title:"Account Type",sub:"SHORT_CODE — member account types (TVC/SVC/REE/CEE/PAH/SEP).",modes:["current","compare","trend"],
    render:c=>renderGrouped(c,{keyFn:r=>r.at,keyLabel:"Account type",grid:"g2"})},
  {id:"submit-channel",n:"09",title:"Submit Channel",sub:"The core of Query 2 — DDE/BATCH/PORTAL/BULK/OTHER submit-channel mix.",modes:["current","compare","trend"],
    render:renderChannel},
  {id:"ontime-performance",n:"10",title:"On-time Performance",sub:"On-time submit rate, ranked across schemes, read against the dataset median.",modes:["current","compare","trend"],
    render:renderOntime},
  {id:"submit-funnel-coverage",n:"11",title:"Submit Funnel & Coverage",sub:"Billed → Submitted → On-time funnel and the submit-coverage ratio.",modes:["current","compare","trend"],
    render:renderFunnel},
  {id:"monthly-trend",n:"12",title:"Monthly Trend",sub:"Every metric across the 6 contribution months. Compare overlays A vs B.",modes:["trend","compare"],
    render:renderTrendTab},
  {id:"snapshot-comparison",n:"13",title:"Snapshot Comparison",sub:"Pick two snapshot dates and see how every metric moved across the dataset.",modes:["compare"],
    render:renderComparison},
  {id:"status-channel",n:"14",title:"Status × Channel",sub:"Does the submit channel shift by bill status? Channel mix per lifecycle status.",modes:["current","compare"],
    render:c=>renderCross(c,{rowKey:r=>r.st,rowLabel:"Status",rowOrder:DATA.statuses,colKind:"channel",colLabel:"Channel"})},
  {id:"trustee-channel",n:"15",title:"Trustee × Channel",sub:"Which submit channels each trustee relies on — channel mix per trustee.",modes:["current","compare"],
    render:c=>renderCross(c,{rowKey:r=>r.tr,rowLabel:"Trustee",colKind:"channel",colLabel:"Channel"})},
  {id:"frequency-status",n:"16",title:"Frequency × Status",sub:"How contribution frequency maps to lifecycle outcomes.",modes:["current","compare"],
    render:c=>renderCross(c,{rowKey:r=>r.fq,rowLabel:"Frequency",colKind:"dim",colKey:r=>r.st,colOrder:DATA.statuses,colLabel:"Status"})},
  {id:"payment-outcome",n:"17",title:"Payment Outcome",sub:"Among paid bills — FULLY_PAID / PARTIAL_PAID / OVERPAID / REFUND_OVERPAID / WAIVED.",modes:["current","compare"],
    render:renderPaymentOutcome},
  {id:"backlog",n:"18",title:"Backlog & Pending",sub:"Work-in-progress: OPEN / PARTIAL_SUBMIT / SUBMITTED / APPROVED (not yet paid).",modes:["current","compare"],
    render:renderBacklog},
  {id:"completion",n:"19",title:"Completion Rate",sub:"Share of bills reaching a terminal state (CLOSED/FULLY_PAID/WAIVED/REFUND), ranked.",modes:["current","compare"],
    render:renderCompletion},
  {id:"outliers",n:"20",title:"Outliers & Exceptions",sub:"Schemes deviating >1σ from the peer mean on on-time rate or coverage — a watchlist.",modes:["current"],
    render:renderOutliers},
  {id:"volume-tiers",n:"21",title:"Volume Tiers",sub:"Schemes bucketed into XS…XL tiers by bill volume — does scale predict quality?",modes:["current"],
    render:renderVolumeTiers},
  {id:"trustee-portfolio",n:"22",title:"Trustee Portfolio",sub:"Per trustee: scheme count, bills, and how concentrated each portfolio is.",modes:["current"],
    render:renderTrusteePortfolio},
  {id:"settings",n:"23",title:"Settings",sub:"App preferences — display, navigation, and dataset info. Choices persist in localStorage.",modes:["current"],noScope:true,
    render:renderSettings},
  {id:"theme",n:"24",title:"Theme",sub:"Choose a visual theme for the dashboard.",modes:["current"],noScope:true,
    render:renderTheme},
  {id:"summary-v2",n:"25",title:"Summary V2",sub:"Compact 3-category overview — Contribution Bill, Payment, Direct Debit — all in one page.",modes:["current","compare","trend"],
    cap:"Summary V2",render:renderSummaryV2},
  {id:"dd-overview",n:"26",title:"DD Overview",sub:"Direct Debit pipeline — DDI+DDA 30-day + aging KPIs, one page.",modes:["current","compare","trend"],
    cap:"DD Overview",render:renderDDOverview},
];

/* ============================================================
   ROUTER + WIRING
   ============================================================ */
function currentTab(){return TABS.find(t=>t.id===state.tab);}
function go(tabId,drill){
  state.tab=tabId; if(drill)state.drill=drill;
  // clamp mode to tab's allowed modes
  const t=TABS.find(x=>x.id===tabId);
  if(t&&!t.modes.includes(state.mode))state.mode=t.modes[0];
  document.body.dataset.mode=state.mode;
  renderNav();render();
  window.scrollTo(0,0);
}
function render(){
  clearCharts();
  const t=currentTab();
  $("#pageTitle").textContent=t.title;
  $("#pageSub").textContent=t.sub;
  $("#modePill").textContent=({current:"Current view",compare:`Compare · ${state.snapA} → ${state.snapB}`,trend:"Trend over months"})[state.mode];
  const content=$("#content");content.innerHTML="";
  // refresh the global scope bar (mode-button availability, dimming, picker labels)
  updateScopeBar();
  t.render(content);
  content.querySelectorAll(".card").forEach((c,i)=>c.style.animationDelay=(i*40)+"ms");
}
/* ---- nav groups ----
   Each nav group header is clickable and collapses the items underneath it.
   The "Overview" group is locked open (data-locked="1") so the three landing
   tabs (Summary / Contribution Pend Tagging / Money Allocation) are always one click away.
   Every other group starts collapsed on first load, and remembers its
   collapsed state in localStorage afterwards (so the user's choices
   survive across sessions). */
const NAV_KEY_PREFIX = "moneyin.nav.group.";
const NAV_GROUPS = [
  {key:"overview",  label:"Overview",      locked:true,  ids:["summary","summary-v2","pend-tagging","money-allocation"]},
  {key:"dimensions",label:"Dimensions",    locked:false, ids:["scheme-scorecard","status-lifecycle","trustee","contribution-mode","frequency","account-type","submit-channel"]},
  {key:"xanalysis", label:"Cross-analysis",locked:false, ids:["status-channel","trustee-channel","frequency-status"]},
  {key:"perf",      label:"Performance",   locked:false, ids:["ontime-performance","completion","submit-funnel-coverage"]},
  {key:"outcomes",  label:"Outcomes & ops",locked:false,ids:["payment-outcome","backlog","outliers","volume-tiers","trustee-portfolio"]},
  {key:"overtime",  label:"Over time",     locked:false, ids:["monthly-trend","snapshot-comparison"]},
  {key:"direct-debit",label:"Direct Debit",locked:false, ids:["dd-overview"]},
  {key:"settings",  label:"Settings",      locked:true,  ids:["settings"]},
];
function navGroupCollapsed(key){
  try { return localStorage.getItem(NAV_KEY_PREFIX+key)==="1"; }
  catch(_) { return false; }
}
function setNavGroupCollapsed(key, collapsed){
  try { localStorage.setItem(NAV_KEY_PREFIX+key, collapsed?"1":"0"); }
  catch(_) {}
}

function renderNav(){
  const nav=$("#nav");nav.innerHTML="";
  for(const g of NAV_GROUPS){
    const head=el("div","nav-group");
    head.dataset.locked = g.locked ? "1" : "0";
    head.setAttribute("role", g.locked ? "presentation" : "button");
    head.setAttribute("tabindex", g.locked ? "-1" : "0");
    head.setAttribute("aria-expanded", g.locked || !navGroupCollapsed(g.key) ? "true" : "false");
    head.dataset.collapsed = g.locked ? "0" : (navGroupCollapsed(g.key) ? "1" : "0");
    head.innerHTML = `<span>${g.label}</span><span class="chev" aria-hidden="true">▾</span>`;
    if(!g.locked){
      const toggle=()=>{
        const next = head.dataset.collapsed !== "1";
        head.dataset.collapsed = next ? "1" : "0";
        head.setAttribute("aria-expanded", next ? "false" : "true");
        setNavGroupCollapsed(g.key, next);
        // Only hide/un-hide items that belong to this group.
        // Walk DOM siblings until the next .nav-group or .nav-foot.
        let sibling = head.nextElementSibling;
        while(sibling && !sibling.classList.contains("nav-group") && !sibling.classList.contains("nav-foot")){
          if(sibling.classList.contains("nav-item")){
            sibling.classList.toggle("hidden", next);
          }
          sibling = sibling.nextElementSibling;
        }
      };
      head.addEventListener("click", toggle);
      head.addEventListener("keydown", e=>{
        if(e.key==="Enter"||e.key===" "){e.preventDefault();toggle();}
      });
    }
    nav.appendChild(head);
    const isGroupCollapsed = !g.locked && navGroupCollapsed(g.key);
    for(const id of g.ids){
      const t=TABS.find(x=>x.id===id);
      if(!t){ continue; }
      const it=el("div","nav-item"+(id===state.tab?" active":"")+(isGroupCollapsed?" hidden":""));
      it.innerHTML=`<span class="num">${t.n}</span><span class="lbl">${t.title}</span>`;
      it.addEventListener("click",()=>{
        if(id==="settings"){
          state.settingsSub = "settings-theme";
        }
        go(id);
      });nav.appendChild(it);
    }
  }
}
function syncSchemes(){ if(window.__schemePicker) window.__schemePicker.refresh(); }

/* ---- sidebar show/hide toggle ----
   Collapses the left navigation into a hamburger button in the masthead.
   The visible state is reflected in [data-collapsed] on <body>; the icon
   morphs from ≡ to × via the [aria-pressed] selector. The CSS handles the
   transition; no JS animation is needed.

   Default behaviour (when the user has not yet toggled the menu):
     • Overview tab group (Summary / Contribution Pend Tagging) → expanded
     • every other tab → collapsed
   The moment the user clicks the toggle we mark the choice as "explicit"
   in localStorage and honour it for every tab afterwards, so navigating
   between tabs no longer surprises the user. */
function setupSidebarToggle(){
  const btn=$("#menuToggle");
  if(!btn)return;
  const KEY_STATE="moneyin.sidebar.collapsed";
  const KEY_USER ="moneyin.sidebar.userSet";

  const isOverview=()=>{
    const id=state.tab;
    return id==="summary" || id==="summary-v2" || id==="pend-tagging" || id==="money-allocation";
  };
  const defaultCollapsed=()=>!isOverview();
  const apply=(collapsed)=>{
    document.body.dataset.collapsed = collapsed ? "1" : "0";
    btn.setAttribute("aria-pressed", collapsed ? "true" : "false");
    btn.setAttribute("aria-label", collapsed ? "Show menu" : "Hide menu");
    btn.setAttribute("title",     collapsed ? "Show menu" : "Hide menu");
  };
  // First load — fall back to tab-based default if the user has never toggled.
  let initialCollapsed;
  try {
    if(localStorage.getItem(KEY_USER)==="1"){
      initialCollapsed = localStorage.getItem(KEY_STATE)==="1";
    } else {
      initialCollapsed = defaultCollapsed();
    }
  } catch(_) { initialCollapsed = defaultCollapsed(); }
  apply(initialCollapsed);

  const onClick=()=>{
    const next = document.body.dataset.collapsed!=="1";
    apply(next);
    try {
      localStorage.setItem(KEY_STATE, next?"1":"0");
      localStorage.setItem(KEY_USER,  "1");
    } catch(_) {}
  };
  btn.addEventListener("click", onClick);

  // When the user navigates between tabs, re-apply the default UNLESS the
  // user has already expressed an explicit preference (in which case their
  // choice is sticky across every tab).
  const syncOnTabChange=()=>{
    let userSet=false;
    try { userSet = localStorage.getItem(KEY_USER)==="1"; } catch(_) {}
    if(userSet) return;
    apply(defaultCollapsed());
  };
  // wrap the existing go() so we can react to navigation.
  const originalGo = window.go;
  window.go = function(id){
    const r = originalGo ? originalGo.apply(this, arguments) : undefined;
    if(state.tab===id) syncOnTabChange();
    return r;
  };
}

/* ---- init ---- */
function init(){
  // Apply theme before first paint — CSS vars are set on <body> immediately,
  // so the page renders in the correct theme with no flash of unstyled default.
  initTheme();
  setupChartDefaults();
  // Apply display preferences from localStorage BEFORE first paint so the
  // initial render reflects them (animation toggle flips a body data attr
  // that the .card animation rule reads; landing tab swaps state.tab).
  document.body.dataset.anim = getPref(SETTINGS_KEYS.animations, "1") === "0" ? "0" : "1";
  const landingPref = getPref(SETTINGS_KEYS.landing, "");
  if(landingPref && TABS.some(t=>t.id===landingPref)) state.tab = landingPref;
  setupSidebarToggle();
  renderNav();
  // default compare A = previous, B = latest
  state.snapA=DATA.snapshots[Math.max(0,DATA.snapshots.length-2)];
  state.snapB=DATA.latest;
  // build the global scope/filter bar once; updateScopeBar() refreshes it per render
  buildScopeBar();
  render();
}
if(document.readyState!=="loading")init();
else document.addEventListener("DOMContentLoaded",init);
