"use strict";
/* ============================================================
   Summary V2 — compact 3-category overview (no scroll)
   Categories: Contribution Bill, Contribution Payment, Direct Debit
   ============================================================ */

/* ---- helpers ---- */
function aoRowsFor(snap, {mfrom, mto}={}){
  if(!DATA.aoAging) return [];
  mfrom = mfrom || state.mfrom; mto = mto || state.mto;
  return DATA.aoAging.rows.filter(r =>
    r.s === snap && schemeOn(r) && trusteeOn(r));
}
function ddiAgingFor(snap){
  if(!DATA.ddiAging) return [];
  return DATA.ddiAging.rows.filter(r =>
    r.s === snap && schemeOn(r) && trusteeOn(r));
}
function ddi30For(snap){
  if(!DATA.ddi30) return [];
  return DATA.ddi30.rows.filter(r =>
    r.s === snap && schemeOn(r) && trusteeOn(r));
}
function ddaAgingFor(snap){
  if(!DATA.ddaAging) return [];
  return DATA.ddaAging.rows.filter(r =>
    r.s === snap && schemeOn(r) && trusteeOn(r));
}
function dda30For(snap){
  if(!DATA.dda30) return [];
  return DATA.dda30.rows.filter(r =>
    r.s === snap && schemeOn(r) && trusteeOn(r));
}
function sum(arr, key){ return arr.reduce((s,r)=>s+(r[key]||0),0); }
function sumAO(arr, key){ return arr.reduce((s,r)=>s+(r[key]||0),0); }

/* ---- KPI pill (compact, no chart) ---- */
function kpiPill(label, value, delta, deltaFmt){
  const dCls = delta==null?"kpf":(delta>0?"kpu":delta<0?"kpd":"kpf");
  const dTxt = delta==null?"":(deltaFmt==="pp"?pp(delta):signed(delta));
  return `<div class="sv-kpi"><div class="svk-lab">${label}</div>
    <div class="svk-val">${value}</div>
    <div class="svk-mom ${dCls}">${dTxt}</div></div>`;
}

/* ---- mini bar (single bar, colored segments) ---- */
function miniBar(values, colors, total, opts){
  if(!total) total = values.reduce((s,v)=>s+v,0);
  const h = (opts&&opts.h)||8;
  const segs = values.map((v,i)=>{
    const pct = total>0 ? (v/total*100) : 0;
    if(pct<0.5) return "";
    return `<span style="flex:${v} 1 0;background:${colors[i]};min-width:2px" title="${v} (${pct.toFixed(1)}%)"></span>`;
  }).join("");
  return `<div class="sv-mini-bar" style="height:${h}px">${segs}</div>`;
}

/* ---- category card ---- */
function catCard(title, rows){
  const c = el("div","sv-card");
  c.innerHTML = `<div class="svc-title">${title}</div>${rows.map(r=>`<div class="svc-row">${r}</div>`).join("")}`;
  return c;
}
function catRow(label, value, cls){
  return `<span class="svc-lab">${label}</span><span class="svc-val ${cls||""}">${value}</span>`;
}

/* ---- bucket bar (for bottom row) ---- */
function bucketCard(title, keys, data, colors){
  const total = data.reduce((s,v)=>s+v,0);
  const segs = keys.map((k,i)=>{
    const v = data[i];
    const pct = total>0 ? (v/total*100) : 0;
    return `<div class="sv-buck-seg" style="flex:${v} 1 0;background:${colors[i]};min-width:${pct>0?'6':'0'}px" title="${k}: ${fmt(v)} (${pct.toFixed(1)}%)">
      ${pct>=8?`<span class="sv-buck-lab">${k}</span>`:""}</div>`;
  }).join("");
  return `<div class="sv-buck-card"><div class="svb-title">${title}</div>
    <div class="sv-buck-bar">${segs}<div class="sv-buck-tot">${fmt(total)}</div></div></div>`;
}

/* ============================================================
   MAIN RENDER
   ============================================================ */
function renderSummaryV2(content){
  if(state.mode==="compare") return renderSV2Compare(content);
  if(state.mode==="trend")   return renderSV2Trend(content);
  renderSV2Current(content);
}

/* ---- Current mode ---- */
function renderSV2Current(content){
  const rows  = rowsFor(state.snap);
  const pym   = DATA.pym.rows.filter(r=>r.s===state.snap && schemeOn(r) && trusteeOn(r) && r.ym>=state.mfrom && r.ym<=state.mto);
  const ao    = aoRowsFor(state.snap);
  const ddiAg = ddiAgingFor(state.snap);
  const ddi30 = ddi30For(state.snap);
  const ddaAg = ddaAgingFor(state.snap);
  const dda30 = dda30For(state.snap);

  const all  = totals({...groupBy(rows,()=>0).get(0)});
  const pymT = {pay: sum(pym,"pay"), avail: sum(pym,"avail")};
  const allocPct = (pymT.pay+pymT.avail)>0 ? pymT.pay/(pymT.pay+pymT.avail) : 0;

  /* ---- aging data (needed by both chart row and cards) ---- */
  const aoTot = {total: sumAO(ao,"total"), d00_06: sumAO(ao,"d00_06"), d07_14: sumAO(ao,"d07_14"),
    d15_21: sumAO(ao,"d15_21"), d22_30: sumAO(ao,"d22_30"), d31: sumAO(ao,"d31")};
  const aoKeys = ["0-6d","7-14d","15-21d","22-30d","31d+"];
  const aoVals = [aoTot.d00_06, aoTot.d07_14, aoTot.d15_21, aoTot.d22_30, aoTot.d31];
  const aoColors = ["#16a34a","#f59e0b","#f97316","#ef4444","#991b1b"];
  const ddiT = {total: sumAO(ddiAg,"total"), d00_06: sumAO(ddiAg,"d00_06"), d07_14: sumAO(ddiAg,"d07_14"),
    d15_21: sumAO(ddiAg,"d15_21"), d22_30: sumAO(ddiAg,"d22_30"), d31: sumAO(ddiAg,"d31")};
  const ddiVals = [ddiT.d00_06, ddiT.d07_14, ddiT.d15_21, ddiT.d22_30, ddiT.d31];
  const ddaT = {total: sumAO(ddaAg,"total"), d00_06: sumAO(ddaAg,"d00_06"), d07_14: sumAO(ddaAg,"d07_14"),
    d15_21: sumAO(ddaAg,"d15_21"), d22_30: sumAO(ddaAg,"d22_30"), d31: sumAO(ddaAg,"d31")};
  const ddaVals = [ddaT.d00_06, ddaT.d07_14, ddaT.d15_21, ddaT.d22_30, ddaT.d31];
  const ddi30Sum = {total: sumAO(ddi30,"total"), ok: sumAO(ddi30,"success"), rej: sumAO(ddi30,"rejected")};
  const dda30Sum = {total: sumAO(dda30,"total"), act: sumAO(dda30,"active"), rej: sumAO(dda30,"rejected")};

  /* ---- KPI rib ---- */
  const rib = el("div","sv-rib");
  rib.innerHTML =
    kpiPill("Bills", fmt(all.bill)) +
    kpiPill("On-time", pct(all.ontimePct)) +
    kpiPill("Coverage", pct(all.coverage)) +
    kpiPill("Pay AMT", "$"+fmt(Math.round(pymT.pay))) +
    kpiPill("Avail AMT", "$"+fmt(Math.round(pymT.avail))) +
    kpiPill("ALLOC%", pct(allocPct));
  content.appendChild(rib);

  /* ---- Chart row (eye-catching) ---- */
  const chRow = el("div","sv-chart-row"); content.appendChild(chRow);

  // Chart 1: Channel mix doughnut
  const chKeys = ["dde","batch","portal","bulk","other"];
  const chVals = chKeys.map(k=>all[k]||0);
  const chColors = ["#2a78d6","#1baf7a","#eda100","#008300","#eb6834"];
  const chLabels = ["DDE","BATCH","PORTAL","BULK","OTHER"];
  const chCard = el("div","sv-chart-card");
  chCard.innerHTML = `<div class="sv-chart-title">Channel mix</div><div class="chart-wrap"><canvas></canvas></div>`;
  chRow.appendChild(chCard);
  requestAnimationFrame(()=>{
    const cv = $("canvas", chCard);
    if(cv) newDoughnut(cv, {labels:chLabels, data:chVals, colors:chColors});
  });

  // Chart 2: Aging comparison (grouped bar — AO / DDI / DDA side by side)
  const agLabels = ["0-6d","7-14d","15-21d","22-30d","31d+"];
  const agColors = ["#16a34a","#f59e0b","#f97316","#ef4444","#991b1b"];
  const agCard = el("div","sv-chart-card");
  agCard.innerHTML = `<div class="sv-chart-title">Aging (AO · DDI · DDA)</div><div class="chart-wrap"><canvas></canvas></div>`;
  chRow.appendChild(agCard);
  requestAnimationFrame(()=>{
    const cv = $("canvas", agCard);
    if(cv && window.Chart) newBar(cv, {
      labels: agLabels,
      datasets: [
        {label:"AO", data:aoVals, backgroundColor:agColors.map(c=>c+"80")},
        {label:"DDI", data:ddiVals, backgroundColor:agColors.map(c=>c+"B0")},
        {label:"DDA", data:ddaVals, backgroundColor:agColors},
      ],
      indexAxis: "x", horizontal: false, stacked: false, legend: true,
    });
  });

  /* ---- 3 category cards ---- */
  const cardRow = el("div","sv-card-row");
  content.appendChild(cardRow);

  // Card 1: Contribution Bill
  const chSum = chVals.reduce((s,v)=>s+v,0);
  cardRow.appendChild(catCard("Contribution Bill",[
    catRow("Bills", fmt(all.bill)),
    catRow("On-time", pct(all.ontimePct)+" · "+fmt(all.ontime)+"/"+fmt(all.total)),
    catRow("Coverage", pct(all.coverage)),
    `<div class="svc-mbar">${miniBar(chVals, chColors, chSum)}</div>
     <div class="svc-mlab">DDE ${fmt(chVals[0])} · BATCH ${fmt(chVals[1])} · PORTAL ${fmt(chVals[2])} · BULK ${fmt(chVals[3])} · OTHER ${fmt(chVals[4])}</div>`
  ]));

  // Card 2: Contribution Payment
  cardRow.appendChild(catCard("Contribution Payment",[
    catRow("Pay AMT", "$"+fmt(Math.round(pymT.pay))),
    catRow("Avail AMT", "$"+fmt(Math.round(pymT.avail))),
    catRow("ALLOC%", pct(allocPct), allocPct>=0.98?"tone-g":allocPct>=0.95?"tone-y":"tone-r"),
    `<div class="svc-mlab" style="margin-top:2px">AO aging</div>
     <div class="svc-mbar">${miniBar(aoVals, aoColors, aoTot.total)}</div>
     <div class="svc-mlab">${aoKeys.map((k,i)=>`${k} ${fmt(aoVals[i])}`).join(" · ")}</div>`
  ]));

  // Card 3: Direct Debit
  cardRow.appendChild(catCard("Direct Debit",[
    catRow("DDI 30d", fmt(ddi30Sum.total)+" req · "+fmt(ddi30Sum.ok)+" active · "+fmt(ddi30Sum.rej)+" rej"),
    catRow("DDA 30d", fmt(dda30Sum.total)+" req · "+fmt(dda30Sum.act)+" active · "+fmt(dda30Sum.rej)+" rej"),
    `<div class="svc-mlab">DDI aging</div>
     <div class="svc-mbar">${miniBar(ddiVals, aoColors, ddiT.total)}</div>
     <div class="svc-mlab">${aoKeys.map((k,i)=>`${k} ${fmt(ddiVals[i])}`).join(" · ")}</div>`,
    `<div class="svc-mlab" style="margin-top:1px">DDA aging</div>
     <div class="svc-mbar">${miniBar(ddaVals, aoColors, ddaT.total)}</div>
     <div class="svc-mlab">${aoKeys.map((k,i)=>`${k} ${fmt(ddaVals[i])}`).join(" · ")}</div>`
  ]));

  /* ---- Bottom bucket bar row ---- */
  const buckRow = el("div","sv-buck-row");
  content.appendChild(buckRow);

  // Status mix
  const stArr = ranked(groupBy(rows,r=>r.st),{order:DATA.statuses});
  const stKeys = stArr.map(a=>a.k);
  const stVals = stArr.map(a=>a.bill);
  const stCols = stArr.map(a=>statusColor(a.k));
  buckRow.appendChild(bucketCard("Status mix", stKeys, stVals, stCols));

  // AO Aging
  buckRow.appendChild(bucketCard("AO aging", aoKeys, aoVals, aoColors));

  // DDI Aging
  buckRow.appendChild(bucketCard("DDI aging", aoKeys, ddiVals, aoColors));

  // DDA Aging
  buckRow.appendChild(bucketCard("DDA aging", aoKeys, ddaVals, aoColors));
}

/* ---- Compare mode ---- */
function renderSV2Compare(content){
  const rowsA = rowsFor(state.snapA);
  const rowsB = rowsFor(state.snapB);
  const pymA = DATA.pym.rows.filter(r=>r.s===state.snapA && schemeOn(r) && trusteeOn(r) && r.ym>=state.mfrom && r.ym<=state.mto);
  const pymB = DATA.pym.rows.filter(r=>r.s===state.snapB && schemeOn(r) && trusteeOn(r) && r.ym>=state.mfrom && r.ym<=state.mto);
  const ddiAgA = ddiAgingFor(state.snapA), ddiAgB = ddiAgingFor(state.snapB);
  const ddaAgA = ddaAgingFor(state.snapA), ddaAgB = ddaAgingFor(state.snapB);
  const ddi30A = ddi30For(state.snapA), ddi30B = ddi30For(state.snapB);
  const dda30A = dda30For(state.snapA), dda30B = dda30For(state.snapB);

  const A = totals({...groupBy(rowsA,()=>0).get(0)});
  const B = totals({...groupBy(rowsB,()=>0).get(0)});
  const pymTA = {pay: sum(pymA,"pay"), avail: sum(pymA,"avail")};
  const pymTB = {pay: sum(pymB,"pay"), avail: sum(pymB,"avail")};
  const allocA = (pymTA.pay+pymTA.avail)>0 ? pymTA.pay/(pymTA.pay+pymTA.avail) : 0;
  const allocB = (pymTB.pay+pymTB.avail)>0 ? pymTB.pay/(pymTB.pay+pymTB.avail) : 0;

  // DD aggregates
  const ddiA = {total: sumAO(ddi30A,"total"), ok: sumAO(ddi30A,"success"), rej: sumAO(ddi30A,"rejected")};
  const ddiB = {total: sumAO(ddi30B,"total"), ok: sumAO(ddi30B,"success"), rej: sumAO(ddi30B,"rejected")};
  const ddaA = {total: sumAO(dda30A,"total"), act: sumAO(dda30A,"active"), rej: sumAO(dda30A,"rejected")};
  const ddaB = {total: sumAO(dda30B,"total"), act: sumAO(dda30B,"active"), rej: sumAO(dda30B,"rejected")};
  // aging totals
  const aoA = {d00_06: sumAO(ddiAgA,"d00_06"), d07_14: sumAO(ddiAgA,"d07_14"), d15_21: sumAO(ddiAgA,"d15_21"), d22_30: sumAO(ddiAgA,"d22_30"), d31: sumAO(ddiAgA,"d31")};
  const aoB = {d00_06: sumAO(ddiAgB,"d00_06"), d07_14: sumAO(ddiAgB,"d07_14"), d15_21: sumAO(ddiAgB,"d15_21"), d22_30: sumAO(ddiAgB,"d22_30"), d31: sumAO(ddiAgB,"d31")};
  const ddiAgTotA = [aoA.d00_06, aoA.d07_14, aoA.d15_21, aoA.d22_30, aoA.d31];
  const ddiAgTotB = [aoB.d00_06, aoB.d07_14, aoB.d15_21, aoB.d22_30, aoB.d31];
  const ddaAgTotA = [sumAO(ddaAgA,"d00_06"), sumAO(ddaAgA,"d07_14"), sumAO(ddaAgA,"d15_21"), sumAO(ddaAgA,"d22_30"), sumAO(ddaAgA,"d31")];
  const ddaAgTotB = [sumAO(ddaAgB,"d00_06"), sumAO(ddaAgB,"d07_14"), sumAO(ddaAgB,"d15_21"), sumAO(ddaAgB,"d22_30"), sumAO(ddaAgB,"d31")];

  const rib = el("div","sv-rib");
  rib.innerHTML =
    kpiPill("Bills", fmt(B.bill), B.bill-A.bill) +
    kpiPill("On-time", pct(B.ontimePct), (B.ontimePct||0)-(A.ontimePct||0), "pp") +
    kpiPill("Coverage", pct(B.coverage), (B.coverage||0)-(A.coverage||0), "pp") +
    kpiPill("Pay", "$"+fmt(Math.round(pymTB.pay)), Math.round(pymTB.pay-pymTA.pay)) +
    kpiPill("Avail", "$"+fmt(Math.round(pymTB.avail)), Math.round(pymTB.avail-pymTA.avail)) +
    kpiPill("ALLOC%", pct(allocB), allocB-allocA, "pp");
  content.appendChild(rib);

  content.appendChild(el("div","sv-note",`Comparing ${state.snapA} → ${state.snapB}. Deltas are B − A.`));

  // Compare chart row — channel mix bar A vs B
  const compChRow = el("div","sv-comp-chart-row"); content.appendChild(compChRow);
  const chLabels = ["DDE","BATCH","PORTAL","BULK","OTHER"];
  const chKeys = ["dde","batch","portal","bulk","other"];
  const chValsA = chKeys.map(k=>A[k]||0), chValsB = chKeys.map(k=>B[k]||0);
  const chColors = ["#2a78d6","#1baf7a","#eda100","#008300","#eb6834"];

  const c1 = card(compChRow,"Channel mix · A vs B","",null);
  requestAnimationFrame(()=>{
    if(window.Chart) newBar(c1.canvas,{labels:chLabels,datasets:[
      {label:state.snapA, data:chValsA, backgroundColor:chColors.map(c=>c+"80")},
      {label:state.snapB, data:chValsB, backgroundColor:chColors},
    ], indexAxis:"x", horizontal:false, stacked:false, legend:true});
  });

  // Aging comparison
  const agLabels = ["0-6d","7-14d","15-21d","22-30d","31d+"];
  const agColors = ["#16a34a","#f59e0b","#f97316","#ef4444","#991b1b"];
  const c2 = card(compChRow,"DDI aging · A vs B","",null);
  requestAnimationFrame(()=>{
    if(window.Chart) newBar(c2.canvas,{labels:agLabels,datasets:[
      {label:state.snapA+" DDI", data:ddiAgTotA, backgroundColor:agColors.map(c=>c+"80")},
      {label:state.snapB+" DDI", data:ddiAgTotB, backgroundColor:agColors},
    ], indexAxis:"x", horizontal:false, stacked:false, legend:true});
  });

  // Compare table for detail — includes DD metrics
  const billKeys = ["bill","total","ontime","dde","batch","portal","bulk","other"];
  const cols = [
    {key:"k", label:"Metric", align:"left"},
    {key:"a", label:state.snapA, fmt:v=>fmt(v)},
    {key:"b", label:state.snapB, fmt:v=>fmt(v)},
    {key:"d", label:"Δ", fmt:v=>`<span class="${v>0?"delta-up":v<0?"delta-dn":"delta-flat"}">${signed(v)}</span>`},
  ];
  const catRows = [
    ...billKeys.map(k=>({k, a:A[k], b:B[k], d:(B[k]||0)-(A[k]||0)})),
    {k:"pay_amt", a:pymTA.pay, b:pymTB.pay, d:pymTB.pay-pymTA.pay},
    {k:"avail_amt", a:pymTA.avail, b:pymTB.avail, d:pymTB.avail-pymTA.avail},
    {k:"ddi_req", a:ddiA.total, b:ddiB.total, d:ddiB.total-ddiA.total},
    {k:"ddi_active", a:ddiA.ok, b:ddiB.ok, d:ddiB.ok-ddiA.ok},
    {k:"ddi_rej", a:ddiA.rej, b:ddiB.rej, d:ddiB.rej-ddiA.rej},
    {k:"dda_req", a:ddaA.total, b:ddaB.total, d:ddaB.total-ddaA.total},
    {k:"dda_active", a:ddaA.act, b:ddaB.act, d:ddaB.act-ddaA.act},
    {k:"dda_rej", a:ddaA.rej, b:ddaB.rej, d:ddaB.rej-ddaA.rej},
  ];
  const tHost = el("div","sv-tbl"); content.appendChild(tHost);
  buildTable(tHost,{columns:cols,rows:catRows,sortable:false});
}

/* ---- Trend mode ---- */
function renderSV2Trend(content){
  const rows  = rowsFor(state.snap);
  const pym   = DATA.pym.rows.filter(r=>r.s===state.snap && schemeOn(r) && trusteeOn(r) && r.ym>=state.mfrom && r.ym<=state.mto);
  const all   = totals({...groupBy(rows,()=>0).get(0)});
  const pymT  = {pay: sum(pym,"pay"), avail: sum(pym,"avail")};
  const allocPct = (pymT.pay+pymT.avail)>0 ? pymT.pay/(pymT.pay+pymT.avail) : 0;
  const ddiAg = ddiAgingFor(state.snap);
  const ddi30 = ddi30For(state.snap);
  const ddaAg = ddaAgingFor(state.snap);
  const dda30 = dda30For(state.snap);

  const monthlyB  = DATA.months.map(ym => totals({...groupBy(rows.filter(r=>r.ym===ym),()=>0).get(0)}));
  const monthlyP  = DATA.months.map(ym => {
    const p = pym.filter(r=>r.ym===ym);
    const pay = sum(p,"pay"), avail = sum(p,"avail");
    return {pay, avail, alloc: (pay+avail)>0?pay/(pay+avail):0};
  });

  // DD aggregates (snapshot-level, no monthly trend)
  const ddi30Sum = {total: sumAO(ddi30,"total"), ok: sumAO(ddi30,"success"), rej: sumAO(ddi30,"rejected")};
  const dda30Sum = {total: sumAO(dda30,"total"), act: sumAO(dda30,"active"), rej: sumAO(dda30,"rejected")};
  const ddiTot = {total: sumAO(ddiAg,"total"), d00_06: sumAO(ddiAg,"d00_06"), d07_14: sumAO(ddiAg,"d07_14"),
    d15_21: sumAO(ddiAg,"d15_21"), d22_30: sumAO(ddiAg,"d22_30"), d31: sumAO(ddiAg,"d31")};
  const ddaTot = {total: sumAO(ddaAg,"total"), d00_06: sumAO(ddaAg,"d00_06"), d07_14: sumAO(ddaAg,"d07_14"),
    d15_21: sumAO(ddaAg,"d15_21"), d22_30: sumAO(ddaAg,"d22_30"), d31: sumAO(ddaAg,"d31")};

  const rib = el("div","sv-rib");
  rib.innerHTML =
    kpiPill("Bills (6mo)", fmt(all.bill)) +
    kpiPill("On-time", pct(all.ontimePct)) +
    kpiPill("Coverage", pct(all.coverage)) +
    kpiPill("Pay total", "$"+fmt(Math.round(pymT.pay))) +
    kpiPill("Avail total", "$"+fmt(Math.round(pymT.avail))) +
    kpiPill("ALLOC%", pct(allocPct));
  content.appendChild(rib);

  const cg = el("div","grid g2"); content.appendChild(cg);

  const cA = card(cg,"Bills / Submits / On-time","6-month trend",null,KEY_MED);
  newLine(cA.canvas,{labels:DATA.months,datasets:[
    {label:"Bills",data:monthlyB.map(r=>r.bill),borderColor:SEQ[4]},
    {label:"Submitted",data:monthlyB.map(r=>r.total),borderColor:CAT[1]},
    {label:"On-time",data:monthlyB.map(r=>r.ontime),borderColor:CAT[6]}],legend:true});

  const cB = card(cg,"Pay AMT / Avail AMT / ALLOC%","6-month trend");
  newLine(cB.canvas,{labels:DATA.months,datasets:[
    {label:"Pay AMT",data:monthlyP.map(r=>r.pay),borderColor:POS},
    {label:"Avail AMT",data:monthlyP.map(r=>r.avail),borderColor:NEG},
    {label:"ALLOC%",data:monthlyP.map(r=>r.alloc || 0),borderColor:CAT[0],
      yAxisID:"y1"}],legend:true});

  // Direct Debit snapshot card (supplementary — data has no monthly dimension)
  const ddWrap = el("div","sv-dd-trend"); content.appendChild(ddWrap);
  const ddHost = el("div","sv-dd-host"); ddWrap.appendChild(ddHost);
  ddHost.innerHTML = `
    <div class="sv-dd-inner">
      <div class="sv-dd-col">
        <div class="sv-chart-title">DDI 30-day · ${state.snap}</div>
        <div class="sv-dd-stats">${fmt(ddi30Sum.total)} req · ${fmt(ddi30Sum.ok)} active · ${fmt(ddi30Sum.rej)} rej</div>
        <div class="chart-wrap" style="height:130px"><canvas id="sv2-trend-ddi-doughnut"></canvas></div>
      </div>
      <div class="sv-dd-col">
        <div class="sv-chart-title">DDA 30-day · ${state.snap}</div>
        <div class="sv-dd-stats">${fmt(dda30Sum.total)} req · ${fmt(dda30Sum.act)} active · ${fmt(dda30Sum.rej)} rej</div>
        <div class="chart-wrap" style="height:130px"><canvas id="sv2-trend-dda-doughnut"></canvas></div>
      </div>
      <div class="sv-dd-col">
        <div class="sv-chart-title">DDI aging · ${state.snap}</div>
        <div class="chart-wrap" style="height:130px"><canvas id="sv2-trend-ddi-aging"></canvas></div>
      </div>
      <div class="sv-dd-col">
        <div class="sv-chart-title">DDA aging · ${state.snap}</div>
        <div class="chart-wrap" style="height:130px"><canvas id="sv2-trend-dda-aging"></canvas></div>
      </div>
    </div>`;
  requestAnimationFrame(()=>{
    const agColors = ["#16a34a","#f59e0b","#f97316","#ef4444","#991b1b"];
    const agLabels = ["0-6d","7-14d","15-21d","22-30d","31d+"];
    const c1 = document.getElementById("sv2-trend-ddi-doughnut");
    if(c1 && window.Chart) newDoughnut(c1, {
      labels:["Active","Rejected"],
      data:[ddi30Sum.ok, ddi30Sum.rej],
      colors:["#1baf7a","#ef4444"]
    });
    const c2 = document.getElementById("sv2-trend-dda-doughnut");
    if(c2 && window.Chart) newDoughnut(c2, {
      labels:["Active","Rejected"],
      data:[dda30Sum.act, dda30Sum.rej],
      colors:["#1baf7a","#ef4444"]
    });
    const c3 = document.getElementById("sv2-trend-ddi-aging");
    if(c3 && window.Chart) newBar(c3, {
      labels:agLabels, datasets:[{data:[ddiTot.d00_06,ddiTot.d07_14,ddiTot.d15_21,ddiTot.d22_30,ddiTot.d31],
        backgroundColor:agColors}], indexAxis:"x", horizontal:false, stacked:true, legend:false
    });
    const c4 = document.getElementById("sv2-trend-dda-aging");
    if(c4 && window.Chart) newBar(c4, {
      labels:agLabels, datasets:[{data:[ddaTot.d00_06,ddaTot.d07_14,ddaTot.d15_21,ddaTot.d22_30,ddaTot.d31],
        backgroundColor:agColors}], indexAxis:"x", horizontal:false, stacked:true, legend:false
    });
  });

  content.appendChild(el("div","sv-note",`Trend across 6 months · snapshot ${state.snap}. DD data is snapshot-level (no monthly trend).`));
}
