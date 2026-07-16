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

  /* ---- 3 category cards ---- */
  const cardRow = el("div","sv-card-row");
  content.appendChild(cardRow);

  // Card 1: Contribution Bill
  const chKeys = ["dde","batch","portal","bulk","other"];
  const chVals = chKeys.map(k=>all[k]||0);
  const chColors = ["#2a78d6","#1baf7a","#eda100","#008300","#eb6834"];
  const chSum = chVals.reduce((s,v)=>s+v,0);
  cardRow.appendChild(catCard("Contribution Bill",[
    catRow("Bills", fmt(all.bill)),
    catRow("On-time", pct(all.ontimePct)+" · "+fmt(all.ontime)+"/"+fmt(all.total)),
    catRow("Coverage", pct(all.coverage)),
    `<div class="svc-mbar">${miniBar(chVals, chColors, chSum)}</div>
     <div class="svc-mlab">DDE ${fmt(chVals[0])} · BATCH ${fmt(chVals[1])} · PORTAL ${fmt(chVals[2])} · BULK ${fmt(chVals[3])} · OTHER ${fmt(chVals[4])}</div>`
  ]));

  // Card 2: Contribution Payment
  const aoTot = {total: sumAO(ao,"total"), d00_06: sumAO(ao,"d00_06"), d07_14: sumAO(ao,"d07_14"),
    d15_21: sumAO(ao,"d15_21"), d22_30: sumAO(ao,"d22_30"), d31: sumAO(ao,"d31")};
  const aoKeys = ["0-6d","7-14d","15-21d","22-30d","31d+"];
  const aoVals = [aoTot.d00_06, aoTot.d07_14, aoTot.d15_21, aoTot.d22_30, aoTot.d31];
  const aoColors = ["#16a34a","#f59e0b","#f97316","#ef4444","#991b1b"];
  cardRow.appendChild(catCard("Contribution Payment",[
    catRow("Pay AMT", "$"+fmt(Math.round(pymT.pay))),
    catRow("Avail AMT", "$"+fmt(Math.round(pymT.avail))),
    catRow("ALLOC%", pct(allocPct), allocPct>=0.98?"tone-g":allocPct>=0.95?"tone-y":"tone-r"),
    `<div class="svc-mlab" style="margin-top:2px">AO aging</div>
     <div class="svc-mbar">${miniBar(aoVals, aoColors, aoTot.total)}</div>
     <div class="svc-mlab">${aoKeys.map((k,i)=>`${k} ${fmt(aoVals[i])}`).join(" · ")}</div>`
  ]));

  // Card 3: Direct Debit
  const ddiT = {total: sumAO(ddiAg,"total"), d00_06: sumAO(ddiAg,"d00_06"), d07_14: sumAO(ddiAg,"d07_14"),
    d15_21: sumAO(ddiAg,"d15_21"), d22_30: sumAO(ddiAg,"d22_30"), d31: sumAO(ddiAg,"d31")};
  const ddiVals = [ddiT.d00_06, ddiT.d07_14, ddiT.d15_21, ddiT.d22_30, ddiT.d31];
  const ddaT = {total: sumAO(ddaAg,"total"), d00_06: sumAO(ddaAg,"d00_06"), d07_14: sumAO(ddaAg,"d07_14"),
    d15_21: sumAO(ddaAg,"d15_21"), d22_30: sumAO(ddaAg,"d22_30"), d31: sumAO(ddaAg,"d31")};
  const ddaVals = [ddaT.d00_06, ddaT.d07_14, ddaT.d15_21, ddaT.d22_30, ddaT.d31];

  const ddi30Sum = {total: sumAO(ddi30,"total"), ok: sumAO(ddi30,"success"), rej: sumAO(ddi30,"rejected")};
  const dda30Sum = {total: sumAO(dda30,"total"), act: sumAO(dda30,"active"), rej: sumAO(dda30,"rejected")};

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

  const A = totals({...groupBy(rowsA,()=>0).get(0)});
  const B = totals({...groupBy(rowsB,()=>0).get(0)});
  const pymTA = {pay: sum(pymA,"pay"), avail: sum(pymA,"avail")};
  const pymTB = {pay: sum(pymB,"pay"), avail: sum(pymB,"avail")};
  const allocA = (pymTA.pay+pymTA.avail)>0 ? pymTA.pay/(pymTA.pay+pymTA.avail) : 0;
  const allocB = (pymTB.pay+pymTB.avail)>0 ? pymTB.pay/(pymTB.pay+pymTB.avail) : 0;

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

  // Compare table for detail
  const chKeys = ["bill","total","ontime","dde","batch","portal","bulk","other"];
  const cols = [
    {key:"k", label:"Metric", align:"left"},
    {key:"a", label:state.snapA, fmt:v=>fmt(v)},
    {key:"b", label:state.snapB, fmt:v=>fmt(v)},
    {key:"d", label:"Δ", fmt:v=>`<span class="${v>0?"delta-up":v<0?"delta-dn":"delta-flat"}">${signed(v)}</span>`},
  ];
  const catRows = [
    ...chKeys.map(k=>({k, a:A[k], b:B[k], d:(B[k]||0)-(A[k]||0)})),
    {k:"pay_amt", a:pymTA.pay, b:pymTB.pay, d:pymTB.pay-pymTA.pay},
    {k:"avail_amt", a:pymTA.avail, b:pymTB.avail, d:pymTB.avail-pymTA.avail},
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

  const monthlyB  = DATA.months.map(ym => totals({...groupBy(rows.filter(r=>r.ym===ym),()=>0).get(0)}));
  const monthlyP  = DATA.months.map(ym => {
    const p = pym.filter(r=>r.ym===ym);
    const pay = sum(p,"pay"), avail = sum(p,"avail");
    return {pay, avail, alloc: (pay+avail)>0?pay/(pay+avail):0};
  });

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

  content.appendChild(el("div","sv-note",`Trend across 6 months · snapshot ${state.snap}.`));
}
