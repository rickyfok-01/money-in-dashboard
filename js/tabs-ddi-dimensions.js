"use strict";
/* ============================================================
   DDI Dimensions (#27) — DDI 30-day requests broken down by a chosen
   dimension (scheme / trustee / account-type). The L2 "dimensions" view
   under the DD Overview (#26). Implemented as a custom Current/Compare/
   Trend renderer modeled on renderChannel (js/tabs-detail.js:2), pointed
   at the DD access helpers.

   DATA.ddi30  {snapshots, rows} — snapshot-level (NO ym; no month axis).
     row = {s, tr, sc, at, date, total, submitted, success, rejected}
   Measures summed: total / submitted / success / rejected.
   Headline rate = successRate = Σsuccess / Σtotal  (ratio of sums).

   REUSES globals (defined in modules that load before this one — do NOT
   redeclare):
     ddi30For(snap)     js/tabs-summary-v2.js:19  — rows for snap, scoped by
                                                     the global scheme + trustee pickers
     sumAO(arr,key)     js/tabs-summary-v2.js:35  — Σ of one measure over a row list
     ddTone(v)          js/tabs-dd-overview.js:27  — ≥.98 "tone-g" · ≥.95 "tone-y" · else "tone-r"
     el/$/fmt/pct/signed/pp/state/DATA/POS/NEG/CAT js/core.js
     newBar/newLine/newDoughnut/buildTable          js/charts.js
     card(parent,title,hint,cap,key)→{el,canvas}   js/tabs-summary.js:140

   NOTE on grouping: core.js's groupBy()/add() accumulator is bill-measure
   specific (it sums bill/ontime/dde/…, which DD rows lack → it would NaN-
   poison and never sums success/submitted/rejected). So this tab ships its
   OWN local ~15-line aggregator (ddiDimAgg) — the deliberate duplication the
   plan sanctions for conflict-free parallel build. DRY is deferred to the
   Reviewer. sumAO() is still reused per group, so no measure math is copied.

   styles.css: the toggle row + the table rate-cell tone are namespaced
   `ddi-dim-*` and emit the existing `tone-g/y/r` tokens; the integration
   step wires the matching CSS (plan §4). Smoke = 0 errors regardless.
   ============================================================ */

/* module-level dimension toggle state — default Scheme ("sc") */
let __ddiDim = "sc";
const DDI_DIM_KEYFN = { sc:r=>r.sc, tr:r=>r.tr, at:r=>r.at };
const DDI_DIM_LABEL = { sc:"Scheme", tr:"Trustee", at:"Account type" };

/* DDI outcome identity (mirrors DD Overview): Success · Rejected · Pending */
const DDI_DIM_OUT_COLORS = ["#1baf7a","#ef4444","#94a3b8"];
/* rate-bar colour by ddTone band (higher is better): good / warn / poor */
const DDI_DIM_RATE_HEX   = { "tone-g":"#16a34a", "tone-y":"#f59e0b", "tone-r":"#ef4444" };
const ddiRateColor = v => DDI_DIM_RATE_HEX[ddTone(v)] || "#ef4444";

/* ---- local dimension toggle (3 buttons: Scheme / Trustee / Account type) ----
   Active button wears `.on` (codebase convention); namespace `ddi-dim-*` is
   styled by the integration step. Clicking mutates __ddiDim and re-renders. */
function ddiDimToggle(parent){
  const opts = [["sc","Scheme"],["tr","Trustee"],["at","Account type"]];
  const row = el("div","ddi-dim-toggle");
  row.setAttribute("role","group");
  row.setAttribute("aria-label","Group DDI by");
  row.innerHTML = `<span class="ddi-dim-lab">Group by</span>` +
    opts.map(([k,lbl])=>`<button type="button" class="ddi-dim-btn${k===__ddiDim?" on":""}" data-dim="${k}">${lbl}</button>`).join("");
  parent.appendChild(row);
  row.querySelectorAll(".ddi-dim-btn").forEach(b=>b.addEventListener("click",()=>{
    if(__ddiDim===b.dataset.dim) return;
    __ddiDim = b.dataset.dim;
    render();
  }));
}

/* ---- local aggregator ----
   rows + keyFn → [{k,total,submitted,success,rejected,pending,
                    successRate,rejectedShare,pendingShare}], sorted by total desc.
   Rates are ratio-of-sums (null when total=0 → rendered "—"). */
function ddiDimAgg(rows, keyFn){
  const buckets = new Map();
  for(const r of rows){
    const k = keyFn(r);
    let sub = buckets.get(k);
    if(!sub){ sub=[]; buckets.set(k, sub); }
    sub.push(r);
  }
  const out = [];
  for(const [k, sub] of buckets){
    const total=sumAO(sub,"total"), success=sumAO(sub,"success"),
          submitted=sumAO(sub,"submitted"), rejected=sumAO(sub,"rejected");
    const pending = Math.max(0, total - success - rejected);
    out.push({
      k, total, submitted, success, rejected, pending,
      successRate:   total>0 ? success/total  : null,
      rejectedShare: total>0 ? rejected/total : null,
      pendingShare:  total>0 ? pending/total  : null,
    });
  }
  out.sort((a,b)=> (b.total-a.total) || (a.k<b.k?-1:a.k>b.k?1:0));
  return out;
}

/* ============================================================
   MAIN RENDER
   ============================================================ */
function renderDDIDim(content){
  if(!DATA.ddi30 || !DATA.ddi30.rows || !DATA.ddi30.rows.length){
    content.appendChild(el("div","pend-empty","No DDI data."));
    return;
  }
  ddiDimToggle(content);
  if(state.mode==="compare") return DDIDimCompare(content);
  if(state.mode==="trend")   return DDIDimTrend(content);
  DDIDimCurrent(content);
}

/* ---- Current mode ---- */
function DDIDimCurrent(content){
  const keyFn = DDI_DIM_KEYFN[__ddiDim];
  const dimLabel = DDI_DIM_LABEL[__ddiDim];
  const arr = ddiDimAgg(ddi30For(state.snap), keyFn).filter(a=>a.total>0);

  /* overall outcome totals (exact — straight from the snapshot rows) */
  const all = ddi30For(state.snap);
  const oTotal=sumAO(all,"total"), oSuccess=sumAO(all,"success"),
        oRej=sumAO(all,"rejected"), oPending=Math.max(0,oTotal-oSuccess-oRej);

  const cg = el("div","grid g2"); content.appendChild(cg);

  /* A. outcome mix per dim — stacked bar (Success · Rejected · Pending) */
  const cA = card(cg, `DDI outcome mix per ${dimLabel}`, `Success · Rejected · Pending · ${state.snap}`);
  newBar(cA.canvas,{labels:arr.map(a=>a.k), indexAxis:"y", stacked:true, legend:true,
    datasets:[
      {label:"Success",  data:arr.map(a=>a.success),  backgroundColor:DDI_DIM_OUT_COLORS[0], stack:"s"},
      {label:"Rejected", data:arr.map(a=>a.rejected), backgroundColor:DDI_DIM_OUT_COLORS[1], stack:"s"},
      {label:"Pending",  data:arr.map(a=>a.pending),  backgroundColor:DDI_DIM_OUT_COLORS[2], stack:"s"},
    ]});

  /* B. success rate per dim — horizontal bar, coloured by ddTone band */
  const cB = card(cg, `Success rate by ${dimLabel}`, `Σsuccess / Σtotal · tone by ddTone band`);
  newBar(cB.canvas,{labels:arr.map(a=>a.k), indexAxis:"y", pctScale:true,
    datasets:[{label:"Success %", data:arr.map(a=>a.successRate||0),
      backgroundColor:arr.map(a=>ddiRateColor(a.successRate)), maxBarThickness:16, borderRadius:3}]});

  /* C. overall outcome mix — donut (part-to-whole) */
  const cC = card(cg, "Overall DDI outcome", `Part-to-whole · ${state.snap}`);
  newDoughnut(cC.canvas,{labels:["Success","Rejected","Pending"],
    data:[oSuccess,oRej,oPending], colors:DDI_DIM_OUT_COLORS});

  /* table — the relief channel; rate cell wears the ddTone class */
  content.appendChild(el("div","section-cap",
    `<h2>DDI by ${dimLabel} — data</h2><p>Success% = Σsuccess / Σtotal. Rate cell tone: ≥98% green · ≥95% amber · else red.</p>`));
  const host = el("div","ddi-dim-table"); content.appendChild(host);
  const onRow = __ddiDim==="sc"
    ? (r=>{ state.schemes=[r.k]; if(window.syncSchemes) syncSchemes(); render(); })
    : null;
  buildTable(host,{columns:[
    {key:"k",            label:dimLabel.toUpperCase(), align:"left", cls:()=>__ddiDim==="sc"?"sc":""},
    {key:"total",        label:"Total",     fmt:v=>fmt(v)},
    {key:"success",      label:"Success",   fmt:v=>fmt(v)},
    {key:"successRate",  label:"Success %", fmt:v=>pct(v), cls:(_r,v)=>ddTone(v)},
    {key:"rejected",     label:"Rejected",  fmt:v=>fmt(v)},
    {key:"rejectedShare",label:"Rej %",     fmt:v=>pct(v)},
    {key:"submitted",    label:"Submitted", fmt:v=>fmt(v)},
    {key:"pending",      label:"Pending",   fmt:v=>fmt(v)},
    {key:"pendingShare", label:"Pend %",    fmt:v=>pct(v)},
  ],rows:arr,
    totalRow:c=>c.key==="k"?"TOTAL":c.key==="successRate"?pct(oTotal?oSuccess/oTotal:0)
      :c.key==="rejectedShare"?pct(oTotal?oRej/oTotal:0):c.key==="pendingShare"?pct(oTotal?oPending/oTotal:0)
      :c.key==="total"?fmt(oTotal):c.key==="success"?fmt(oSuccess):c.key==="rejected"?fmt(oRej)
      :c.key==="submitted"?fmt(sumAO(all,"submitted")):c.key==="pending"?fmt(oPending):"",
    onRowClick:onRow});
}

/* ---- Compare mode ----
   Δ success rate (pp) per dim diverging bar + A-vs-B table. */
function DDIDimCompare(content){
  const keyFn = DDI_DIM_KEYFN[__ddiDim];
  const dimLabel = DDI_DIM_LABEL[__ddiDim];
  const A = ddiDimAgg(ddi30For(state.snapA), keyFn);
  const B = ddiDimAgg(ddi30For(state.snapB), keyFn);
  const Am = new Map(A.map(a=>[a.k,a])), Bm = new Map(B.map(a=>[a.k,a]));
  const keys = [...new Set([...Am.keys(),...Bm.keys()])];
  const d = keys.map(k=>{
      const a=Am.get(k)||{total:0,success:0,submitted:0,successRate:null};
      const b=Bm.get(k)||{total:0,success:0,submitted:0,successRate:null};
      return {k, a, b, dRate:(b.successRate||0)-(a.successRate||0)};
    })
    .filter(r=>r.a.total||r.b.total)
    .sort((x,y)=>y.dRate-x.dRate);

  const cg = el("div","grid g2"); content.appendChild(cg);

  /* A. Δ success rate (pp) per dim — diverging (POS/NEG) */
  const cA = card(cg, `Δ success rate (pp) by ${dimLabel} · ${state.snapB}−${state.snapA}`,
    "Sorted: most improved first", null, KEY_DELTA);
  newBar(cA.canvas,{labels:d.map(r=>r.k), indexAxis:"y", pctScale:true,
    datasets:[{data:d.map(r=>r.dRate), backgroundColor:d.map(r=>r.dRate>=0?POS:NEG),
      maxBarThickness:18, borderRadius:3}]});

  /* B. total requests per dim — A vs B grouped */
  const cB = card(cg, `Total requests by ${dimLabel}`, `${state.snapA} vs ${state.snapB}`);
  newBar(cB.canvas,{labels:d.map(r=>r.k), indexAxis:"x",
    datasets:[
      {label:`A ${state.snapA}`, data:d.map(r=>r.a.total), backgroundColor:cssVar("--muted"), borderRadius:3},
      {label:`B ${state.snapB}`, data:d.map(r=>r.b.total), backgroundColor:POS, borderRadius:3}],
    legend:true});

  content.appendChild(el("div","note",
    `Comparing ${state.snapA} → ${state.snapB}. Deltas are B − A. Positive (blue) = the dimension's success rate gained.`));

  /* table — A | B | Δ */
  content.appendChild(el("div","section-cap",`<h2>DDI by ${dimLabel} — A vs B</h2>`));
  const host = el("div","ddi-dim-table"); content.appendChild(host);
  const onRow = __ddiDim==="sc"
    ? (r=>{ state.schemes=[r.k]; if(window.syncSchemes) syncSchemes(); render(); })
    : null;
  buildTable(host,{columns:[
    {key:"k",   label:dimLabel.toUpperCase(), align:"left", cls:()=>__ddiDim==="sc"?"sc":""},
    {key:"rA",  label:`Success% · ${state.snapA}`, fmt:v=>pct(v)},
    {key:"rB",  label:`Success% · ${state.snapB}`, fmt:v=>pct(v)},
    {key:"dRate",label:"Δ Rate", fmt:v=>`<span class="${v>0?"delta-up":v<0?"delta-dn":"delta-flat"}">${pp(v)}</span>`},
    {key:"tA",  label:`Total · ${state.snapA}`, fmt:v=>fmt(v)},
    {key:"tB",  label:`Total · ${state.snapB}`, fmt:v=>fmt(v)},
  ],rows:d.map(r=>({k:r.k, rA:r.a.successRate, rB:r.b.successRate, dRate:r.dRate, tA:r.a.total, tB:r.b.total})),
    onRowClick:onRow});
}

/* ---- Trend mode ----
   DD data is snapshot-level (no month axis) → rate + total lines across
   DATA.ddi30.snapshots, per dim, plus a per-snapshot overall table.
   A dataset with <2 snapshots shows the pend-empty guard (safety net;
   ddi30 ships 5). */
function DDIDimTrend(content){
  const snaps = (DATA.ddi30 && DATA.ddi30.snapshots) || [];
  if(snaps.length < 2){
    content.appendChild(el("div","pend-empty","Not enough snapshots yet for a DDI trend."));
    return;
  }
  const keyFn = DDI_DIM_KEYFN[__ddiDim];
  const dimLabel = DDI_DIM_LABEL[__ddiDim];

  /* dim set = those present in the selected snapshot, ranked by total */
  const dims = ddiDimAgg(ddi30For(state.snap), keyFn).filter(a=>a.total>0).map(a=>a.k);
  /* pre-compute per-snapshot grouping once (avoid re-filter per dim × snap) */
  const perSnap = snaps.map(s=>{
    const m = new Map(ddiDimAgg(ddi30For(s), keyFn).map(a=>[a.k,a]));
    return {s, m};
  });
  const val = (i,k,field) => { const a=perSnap[i].m.get(k); return a?a[field]:0; };

  const cg = el("div","grid g2"); content.appendChild(cg);

  /* A. success rate over snapshots per dim (snapshot axis) */
  const cA = card(cg, `Success rate over snapshots by ${dimLabel}`, `Σsuccess / Σtotal · snapshot axis`);
  newLine(cA.canvas,{labels:snaps, pctScale:true, legend:true,
    datasets:dims.map((k,i)=>({label:k,
      data:snaps.map((_,si)=>{ const a=perSnap[si].m.get(k); return a&&a.total?a.successRate:null; }),
      borderColor:CAT[i%CAT.length], pointBackgroundColor:CAT[i%CAT.length]}))});

  /* B. total requests over snapshots per dim */
  const cB = card(cg, `Total requests over snapshots by ${dimLabel}`, `snapshot axis`);
  newLine(cB.canvas,{labels:snaps, legend:true,
    datasets:dims.map((k,i)=>({label:k,
      data:snaps.map((_,si)=>val(si,k,"total")),
      borderColor:CAT[i%CAT.length], pointBackgroundColor:CAT[i%CAT.length]}))});

  /* per-snapshot overall table (the relief channel — scoped to pickers) */
  content.appendChild(el("div","section-cap",
    `<h2>DDI by ${dimLabel} — per snapshot</h2><p>Trend is across snapshot dates — DD data has no month dimension.</p>`));
  const host = el("div","ddi-dim-table"); content.appendChild(host);
  const rows = snaps.map(s=>{
    const sub = ddi30For(s);
    const total=sumAO(sub,"total"), success=sumAO(sub,"success"), rejected=sumAO(sub,"rejected");
    return {s, total, success, rejected, submitted:sumAO(sub,"submitted"),
            successRate: total>0?success/total:null};
  });
  buildTable(host,{columns:[
    {key:"s",          label:"Snapshot", align:"left"},
    {key:"total",      label:"Total",    fmt:v=>fmt(v)},
    {key:"success",    label:"Success",  fmt:v=>fmt(v)},
    {key:"successRate",label:"Success %",fmt:v=>pct(v), cls:(_r,v)=>ddTone(v)},
    {key:"rejected",   label:"Rejected", fmt:v=>fmt(v)},
    {key:"submitted",  label:"Submitted",fmt:v=>fmt(v)},
  ],rows,sortable:false});
}
