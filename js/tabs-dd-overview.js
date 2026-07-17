"use strict";
/* ============================================================
   DD Overview — Direct Debit pipeline (DDI + DDA), one page.
   Pattern B compact overview (mirrors Summary V2 density).

   DATA keys (all snapshot-level — no ym):
     DATA.ddi30     {snapshots, rows}  — DDI 30-day (req/success/rejected)
     DATA.ddiAging  {snapshots, rows}  — DDI aging buckets (0-6d … 31d+)
     DATA.dda30     {snapshots, rows}  — DDA 30-day (active/inactive/rej/suspend)
     DATA.ddaAging  {snapshots, rows}  — DDA aging buckets

   REUSES globals (defined in tabs-summary-v2.js, which loads before this
   module — do NOT redeclare): ddi30For / ddiAgingFor / dda30For / ddaAgingFor
   / sumAO. Also reuses el, card, buildTable, newBar, newDoughnut, newLine,
   pct, fmt, signed, pp, state, DATA, $ (all from core.js / charts.js).
   ============================================================ */

/* aging buckets — keys → labels → green→red ramp (shared with Summary V2) */
const DD_AGING_KEYS   = ["d00_06","d07_14","d15_21","d22_30","d31"];
const DD_AGING_LABELS = ["0-6d","7-14d","15-21d","22-30d","31d+"];
const DD_AGING_COLORS = ["#16a34a","#f59e0b","#f97316","#ef4444","#991b1b"];
/* 30-day status identity (Total / Success-or-Active / Rejected) */
const DD_30_COLORS = ["#2a78d6","#1baf7a","#ef4444"];

/* tone band for "higher is better" DD rates — mirrors ALLOC% (≥98 g / ≥95 y).
   Not applied to 31d+ share (lower is better — ddTone would mislabel it). */
function ddTone(v){
  if(v==null||isNaN(v)) return "";
  return v>=0.98?"tone-g":v>=0.95?"tone-y":"tone-r";
}

/* KPI pill — value carries an optional tone class; delta coloured up/dn/flat.
   deltaFmt "pp" → percentage points (rates); otherwise signed integer (counts).
   neutralDelta → render the delta in a neutral/faded tone (kpf = --muted), with no
   good/bad implication. Use for lower-is-better metrics like the 31d+ backlog, where
   directional green/red would mislabel a *growing* (worse) backlog as "good". */
function ddoPill(label, value, {delta, deltaFmt, tone, neutralDelta}={}){
  const dCls = delta==null?"":(neutralDelta?"kpf":(delta>0?"kpu":delta<0?"kpd":"kpf"));
  const dTxt = delta==null?"":(deltaFmt==="pp"?pp(delta):signed(delta));
  return `<div class="ddo-kpi"><div class="ddok-lab">${label}</div>
    <div class="ddok-val ${tone||""}">${value}</div>${dTxt?`<div class="ddok-mom ${dCls}">${dTxt}</div>`:""}</div>`;
}

/* compact chart card (title + 150px canvas) — returns the canvas element */
function ddoChartCard(parent, title){
  const c = el("div","ddo-chart-card");
  c.innerHTML = `<div class="ddo-chart-title">${title}</div><div class="chart-wrap"><canvas></canvas></div>`;
  parent.appendChild(c);
  return $("canvas", c);
}

/* ratio-of-sums metrics for one snapshot — the single source of truth every
   mode reads. Rates are null when the denominator is 0 (rendered as "—"). */
function ddMetrics(snap){
  const ddi30 = ddi30For(snap), dda30 = dda30For(snap);
  const ddiAg = ddiAgingFor(snap), ddaAg = ddaAgingFor(snap);
  const ddiReq = sumAO(ddi30,"total"),   ddiOk = sumAO(ddi30,"success"),  ddiRej = sumAO(ddi30,"rejected");
  const ddaReq = sumAO(dda30,"total"),   ddaAct = sumAO(dda30,"active"),  ddaRej = sumAO(dda30,"rejected");
  const ddiAgTot = sumAO(ddiAg,"total"), ddaAgTot = sumAO(ddaAg,"total");
  return {
    ddiReq, ddiOk, ddiRej, ddaReq, ddaAct, ddaRej,
    ddiSuccess: ddiReq>0 ? ddiOk/ddiReq : null,
    ddaActive:  ddaReq>0 ? ddaAct/ddaReq : null,
    ddi31Share: ddiAgTot>0 ? sumAO(ddiAg,"d31")/ddiAgTot : null,
    dda31Share: ddaAgTot>0 ? sumAO(ddaAg,"d31")/ddaAgTot : null,
    ddiOther:   Math.max(0, ddiReq - ddiOk - ddiRej),   /* pending/in-progress */
    ddaInactive:sumAO(dda30,"inactive"), ddaSuspend: sumAO(dda30,"suspend"),
    ddiBuckets: DD_AGING_KEYS.map(k=>sumAO(ddiAg,k)),
    ddaBuckets: DD_AGING_KEYS.map(k=>sumAO(ddaAg,k)),
  };
}

/* ============================================================
   MAIN RENDER
   ============================================================ */
function renderDDOverview(content){
  /* missing-data guard — all four DD datasets empty/missing */
  if([DATA.ddi30,DATA.ddiAging,DATA.dda30,DATA.ddaAging]
      .every(k=>!k||!k.rows||!k.rows.length)){
    content.appendChild(el("div","pend-empty","No Direct Debit data."));
    return;
  }
  if(state.mode==="compare") return DDOverviewCompare(content);
  if(state.mode==="trend")   return DDOverviewTrend(content);
  DDOverviewCurrent(content);
}

/* ---- Current mode ---- */
function DDOverviewCurrent(content){
  const m = ddMetrics(state.snap);

  const rib = el("div","ddo-rib");
  rib.innerHTML =
    ddoPill("DDI req",      fmt(m.ddiReq)) +
    ddoPill("DDI success",  pct(m.ddiSuccess), {tone:ddTone(m.ddiSuccess)}) +
    ddoPill("DDA req",      fmt(m.ddaReq)) +
    ddoPill("DDA active",   pct(m.ddaActive),  {tone:ddTone(m.ddaActive)}) +
    ddoPill("DDI 31d+",     pct(m.ddi31Share)) +
    ddoPill("DDA 31d+",     pct(m.dda31Share));
  content.appendChild(rib);

  const grid = el("div","ddo-chart-row"); content.appendChild(grid);

  const c1 = ddoChartCard(grid, `DDI 30-day · ${state.snap}`);
  requestAnimationFrame(()=>{ if(window.Chart) newDoughnut(c1, {labels:["Success","Rejected","Pending"],
    data:[m.ddiOk, m.ddiRej, m.ddiOther], colors:["#1baf7a","#ef4444","#94a3b8"]}); });

  const c2 = ddoChartCard(grid, `DDA 30-day · ${state.snap}`);
  requestAnimationFrame(()=>{ if(window.Chart) newDoughnut(c2, {labels:["Active","Inactive","Rejected","Suspend"],
    data:[m.ddaAct, m.ddaInactive, m.ddaRej, m.ddaSuspend], colors:["#1baf7a","#94a3b8","#ef4444","#f59e0b"]}); });

  const c3 = ddoChartCard(grid, `DDI aging · ${state.snap}`);
  requestAnimationFrame(()=>{ if(window.Chart) newBar(c3, {labels:DD_AGING_LABELS,
    datasets:[{label:"DDI", data:m.ddiBuckets, backgroundColor:DD_AGING_COLORS}],
    indexAxis:"x", horizontal:false, stacked:true, legend:false}); });

  const c4 = ddoChartCard(grid, `DDA aging · ${state.snap}`);
  requestAnimationFrame(()=>{ if(window.Chart) newBar(c4, {labels:DD_AGING_LABELS,
    datasets:[{label:"DDA", data:m.ddaBuckets, backgroundColor:DD_AGING_COLORS}],
    indexAxis:"x", horizontal:false, stacked:true, legend:false}); });

  DDReliefTable(content, state.snap);
}

/* ---- Compare mode ---- */
function DDOverviewCompare(content){
  const A = ddMetrics(state.snapA), B = ddMetrics(state.snapB);

  const rib = el("div","ddo-rib");
  rib.innerHTML =
    ddoPill("DDI req",     fmt(B.ddiReq),     {delta:B.ddiReq-A.ddiReq}) +
    ddoPill("DDI success", pct(B.ddiSuccess), {delta:(B.ddiSuccess||0)-(A.ddiSuccess||0), deltaFmt:"pp", tone:ddTone(B.ddiSuccess)}) +
    ddoPill("DDA req",     fmt(B.ddaReq),     {delta:B.ddaReq-A.ddaReq}) +
    ddoPill("DDA active",  pct(B.ddaActive),  {delta:(B.ddaActive||0)-(A.ddaActive||0), deltaFmt:"pp", tone:ddTone(B.ddaActive)}) +
    ddoPill("DDI 31d+",    pct(B.ddi31Share), {delta:(B.ddi31Share||0)-(A.ddi31Share||0), deltaFmt:"pp", neutralDelta:true}) +
    ddoPill("DDA 31d+",    pct(B.dda31Share), {delta:(B.dda31Share||0)-(A.dda31Share||0), deltaFmt:"pp", neutralDelta:true});
  content.appendChild(rib);

  content.appendChild(el("div","ddo-note",
    `Comparing ${state.snapA} → ${state.snapB}. Deltas are B − A.`));

  const grid = el("div","ddo-chart-row"); content.appendChild(grid);

  const c1 = ddoChartCard(grid, "DDI 30-day · A vs B");
  requestAnimationFrame(()=>{ if(window.Chart) newBar(c1, {labels:["Total","Success","Rejected"],datasets:[
    {label:state.snapA, data:[A.ddiReq,A.ddiOk,A.ddiRej], backgroundColor:DD_30_COLORS.map(c=>c+"80")},
    {label:state.snapB, data:[B.ddiReq,B.ddiOk,B.ddiRej], backgroundColor:DD_30_COLORS}],
    indexAxis:"x", horizontal:false, stacked:false, legend:true}); });

  const c2 = ddoChartCard(grid, "DDA 30-day · A vs B");
  requestAnimationFrame(()=>{ if(window.Chart) newBar(c2, {labels:["Total","Active","Rejected"],datasets:[
    {label:state.snapA, data:[A.ddaReq,A.ddaAct,A.ddaRej], backgroundColor:DD_30_COLORS.map(c=>c+"80")},
    {label:state.snapB, data:[B.ddaReq,B.ddaAct,B.ddaRej], backgroundColor:DD_30_COLORS}],
    indexAxis:"x", horizontal:false, stacked:false, legend:true}); });

  const c3 = ddoChartCard(grid, "DDI aging · A vs B");
  requestAnimationFrame(()=>{ if(window.Chart) newBar(c3, {labels:DD_AGING_LABELS,datasets:[
    {label:state.snapA, data:A.ddiBuckets, backgroundColor:DD_AGING_COLORS.map(c=>c+"80")},
    {label:state.snapB, data:B.ddiBuckets, backgroundColor:DD_AGING_COLORS}],
    indexAxis:"x", horizontal:false, stacked:false, legend:true}); });

  const c4 = ddoChartCard(grid, "DDA aging · A vs B");
  requestAnimationFrame(()=>{ if(window.Chart) newBar(c4, {labels:DD_AGING_LABELS,datasets:[
    {label:state.snapA, data:A.ddaBuckets, backgroundColor:DD_AGING_COLORS.map(c=>c+"80")},
    {label:state.snapB, data:B.ddaBuckets, backgroundColor:DD_AGING_COLORS}],
    indexAxis:"x", horizontal:false, stacked:false, legend:true}); });

  DDCompareTable(content, A, B);
}

/* ---- Trend mode ----
   DD data is snapshot-level (no month dimension), so each dataset is trended
   across its OWN snapshots list. A dataset with <2 snapshots gets the
   pend-empty guard instead of a broken/empty chart (ddiAging is the thin one). */
function ddTrendCard(parent, title, snapshots, draw, emptyMsg){
  if(!snapshots || snapshots.length < 2){
    parent.appendChild(el("div","ddo-chart-card ddo-empty",
      `<div class="ddo-chart-title">${title}</div><div class="pend-empty">${emptyMsg}</div>`));
    return;
  }
  const cv = ddoChartCard(parent, title);
  requestAnimationFrame(()=>{ if(window.Chart) draw(cv, snapshots); });
}

function DDOverviewTrend(content){
  const m = ddMetrics(state.snap);   /* KPI rib = selected snapshot's values */

  const rib = el("div","ddo-rib");
  rib.innerHTML =
    ddoPill("DDI req",     fmt(m.ddiReq)) +
    ddoPill("DDI success", pct(m.ddiSuccess), {tone:ddTone(m.ddiSuccess)}) +
    ddoPill("DDA req",     fmt(m.ddaReq)) +
    ddoPill("DDA active",  pct(m.ddaActive),  {tone:ddTone(m.ddaActive)}) +
    ddoPill("DDI 31d+",    pct(m.ddi31Share)) +
    ddoPill("DDA 31d+",    pct(m.dda31Share));
  content.appendChild(rib);

  content.appendChild(el("div","ddo-note",
    "Trend is across snapshot dates — DD data has no month dimension."));

  const grid = el("div","ddo-chart-row"); content.appendChild(grid);

  /* DDI 30-day line */
  ddTrendCard(grid, "DDI 30-day trend", DATA.ddi30&&DATA.ddi30.snapshots, (cv,snaps)=>{
    newLine(cv,{labels:snaps,datasets:[
      {label:"Total",    data:snaps.map(s=>sumAO(ddi30For(s),"total")),    borderColor:DD_30_COLORS[0]},
      {label:"Success",  data:snaps.map(s=>sumAO(ddi30For(s),"success")),  borderColor:DD_30_COLORS[1]},
      {label:"Rejected", data:snaps.map(s=>sumAO(ddi30For(s),"rejected")), borderColor:DD_30_COLORS[2]},
    ],legend:true});
  }, "Not enough snapshots yet for DDI 30-day trend.");

  /* DDA 30-day line */
  ddTrendCard(grid, "DDA 30-day trend", DATA.dda30&&DATA.dda30.snapshots, (cv,snaps)=>{
    newLine(cv,{labels:snaps,datasets:[
      {label:"Total",    data:snaps.map(s=>sumAO(dda30For(s),"total")),    borderColor:DD_30_COLORS[0]},
      {label:"Active",   data:snaps.map(s=>sumAO(dda30For(s),"active")),   borderColor:DD_30_COLORS[1]},
      {label:"Rejected", data:snaps.map(s=>sumAO(dda30For(s),"rejected")), borderColor:DD_30_COLORS[2]},
    ],legend:true});
  }, "Not enough snapshots yet for DDA 30-day trend.");

  /* DDI aging stacked bar across snapshots */
  ddTrendCard(grid, "DDI aging trend", DATA.ddiAging&&DATA.ddiAging.snapshots, (cv,snaps)=>{
    newBar(cv,{labels:snaps,datasets:DD_AGING_KEYS.map((k,i)=>({
      label:DD_AGING_LABELS[i],
      data:snaps.map(s=>sumAO(ddiAgingFor(s),k)),
      backgroundColor:DD_AGING_COLORS[i]
    })),indexAxis:"x", horizontal:false, stacked:true, legend:true});
  }, "Not enough snapshots yet for DDI aging trend.");

  /* DDA aging stacked bar across snapshots */
  ddTrendCard(grid, "DDA aging trend", DATA.ddaAging&&DATA.ddaAging.snapshots, (cv,snaps)=>{
    newBar(cv,{labels:snaps,datasets:DD_AGING_KEYS.map((k,i)=>({
      label:DD_AGING_LABELS[i],
      data:snaps.map(s=>sumAO(ddaAgingFor(s),k)),
      backgroundColor:DD_AGING_COLORS[i]
    })),indexAxis:"x", horizontal:false, stacked:true, legend:true});
  }, "Not enough snapshots yet for DDA aging trend.");

  DDTrendTable(content);
}

/* ============================================================
   RELIEF TABLES (the contrast channel — per the design system, the table
   carries identity so chart colour is never the sole channel)
   ============================================================ */

/* Current — per-scheme roll-up for one snapshot */
function DDReliefTable(content, snap){
  const byScheme = new Map();
  const ensure = sc => { if(!byScheme.has(sc)) byScheme.set(sc,
    {sc,ddiReq:0,ddiOk:0,ddiRej:0,ddaReq:0,ddaAct:0,ddaRej:0,ddi31:0,dda31:0}); return byScheme.get(sc); };
  for(const r of ddi30For(snap))   { const a=ensure(r.sc); a.ddiReq+=r.total||0;   a.ddiOk+=r.success||0;  a.ddiRej+=r.rejected||0; }
  for(const r of dda30For(snap))   { const a=ensure(r.sc); a.ddaReq+=r.total||0;   a.ddaAct+=r.active||0;  a.ddaRej+=r.rejected||0; }
  for(const r of ddiAgingFor(snap)){ const a=ensure(r.sc); a.ddi31+=r.d31||0; }
  for(const r of ddaAgingFor(snap)){ const a=ensure(r.sc); a.dda31+=r.d31||0; }

  for(const a of byScheme.values()){
    a.ddiSuccess = a.ddiReq>0 ? a.ddiOk/a.ddiReq : null;
    a.ddaActive  = a.ddaReq>0 ? a.ddaAct/a.ddaReq : null;
  }
  const rows = [...byScheme.values()]
    .sort((a,b)=> ((b.ddiReq+b.ddaReq)-(a.ddiReq+a.ddaReq)) || (a.sc<b.sc?-1:a.sc>b.sc?1:0));

  const cols = [
    {key:"sc",        label:"Scheme",       align:"left", cls:()=>"sc"},
    {key:"ddiReq",    label:"DDI req",      fmt:v=>fmt(v)},
    {key:"ddiSuccess",label:"DDI success%", fmt:v=>pct(v)},
    {key:"ddiRej",    label:"DDI rej",      fmt:v=>fmt(v)},
    {key:"ddaReq",    label:"DDA req",      fmt:v=>fmt(v)},
    {key:"ddaActive", label:"DDA active%",  fmt:v=>pct(v)},
    {key:"ddaRej",    label:"DDA rej",      fmt:v=>fmt(v)},
    {key:"ddi31",     label:"DDI 31d+",     fmt:v=>fmt(v)},
    {key:"dda31",     label:"DDA 31d+",     fmt:v=>fmt(v)},
  ];
  const host = el("div","ddo-tbl"); content.appendChild(host);
  buildTable(host,{columns:cols,rows,defaultSort:"ddiReq",
    onRowClick:r=>{ state.schemes=[r.sc]; if(window.syncSchemes) syncSchemes(); render(); }});
}

/* Compare — Metric | A | B | Δ */
function DDCompareTable(content, A, B){
  const rows = [
    {k:"DDI req",        a:A.ddiReq,     b:B.ddiReq},
    {k:"DDI success%",   a:A.ddiSuccess, b:B.ddiSuccess, rate:true},
    {k:"DDI rejected",   a:A.ddiRej,     b:B.ddiRej},
    {k:"DDA req",        a:A.ddaReq,     b:B.ddaReq},
    {k:"DDA active%",    a:A.ddaActive,  b:B.ddaActive,  rate:true},
    {k:"DDA rejected",   a:A.ddaRej,     b:B.ddaRej},
    {k:"DDI 31d+ share", a:A.ddi31Share, b:B.ddi31Share, rate:true},
    {k:"DDA 31d+ share", a:A.dda31Share, b:B.dda31Share, rate:true},
  ];
  rows.forEach(r=>{ r.d=(r.b||0)-(r.a||0); });
  const cols = [
    {key:"k", label:"Metric", align:"left"},
    {key:"a", label:state.snapA, fmt:(v,r)=> r.rate?pct(v):fmt(v)},
    {key:"b", label:state.snapB, fmt:(v,r)=> r.rate?pct(v):fmt(v)},
    {key:"d", label:"Δ", fmt:(v,r)=>{ const cls=r.d>0?"delta-up":r.d<0?"delta-dn":"delta-flat";
      return `<span class="${cls}">${r.rate?pp(r.d):signed(r.d)}</span>`; }, sortVal:v=>v},
  ];
  const host = el("div","ddo-tbl"); content.appendChild(host);
  buildTable(host,{columns:cols,rows,sortable:false});
}

/* Trend — one row per snapshot (union of all DD snapshot sets) */
function DDTrendTable(content){
  const snaps = [...new Set([
    ...((DATA.ddi30&&DATA.ddi30.snapshots)||[]),
    ...((DATA.ddiAging&&DATA.ddiAging.snapshots)||[]),
    ...((DATA.dda30&&DATA.dda30.snapshots)||[]),
    ...((DATA.ddaAging&&DATA.ddaAging.snapshots)||[]),
  ])].sort();
  const rows = snaps.map(s=>{ const m=ddMetrics(s); m.snap=s; return m; });
  const cols = [
    {key:"snap",       label:"Snapshot",   align:"left"},
    {key:"ddiReq",     label:"DDI req",    fmt:v=>fmt(v)},
    {key:"ddiSuccess", label:"DDI success%",fmt:v=>pct(v)},
    {key:"ddaReq",     label:"DDA req",    fmt:v=>fmt(v)},
    {key:"ddaActive",  label:"DDA active%",fmt:v=>pct(v)},
    {key:"ddi31Share", label:"DDI 31d+",   fmt:v=>pct(v)},
    {key:"dda31Share", label:"DDA 31d+",   fmt:v=>pct(v)},
  ];
  const host = el("div","ddo-tbl"); content.appendChild(host);
  buildTable(host,{columns:cols,rows,sortable:false});
}
