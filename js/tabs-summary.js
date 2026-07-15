"use strict";
function renderGrouped(content,cfg){
  const rows=rowsFor(state.snap);
  const map=groupBy(rows,cfg.keyFn);
  const order=cfg.order||null;
  let arr=ranked(map,{order,sortBy:"bill",topN:cfg.topN||0,capOther:cfg.capOther});

  // charts
  const cg=el("div","grid "+(cfg.grid||"g2"));
  content.appendChild(cg);

  if(state.mode==="compare"){
    renderGroupedCompare(content,cg,cfg,arr);
  } else if(state.mode==="trend"){
    renderGroupedTrend(content,cg,cfg,arr);
  } else {
    renderGroupedCurrent(content,cg,cfg,arr);
  }

  // table
  content.appendChild(el("div","section-cap",`<h2>${cfg.keyLabel} — data</h2>`));
  const tblHost=el("div");content.appendChild(tblHost);
  const cols=[
    {key:"k",label:cfg.keyLabel.toUpperCase(),align:"left",cls:()=>cfg.kIsScheme?"sc":""},
    {key:"bill",label:"Bills",fmt:v=>fmt(v)},
    {key:"total",label:"Submitted",fmt:v=>fmt(v)},
    {key:"ontime",label:"On-time",fmt:v=>fmt(v)},
    {key:"ontimePct",label:"On-time %",fmt:v=>pct(v)},
    {key:"coverage",label:"Coverage %",fmt:v=>pct(v)},
    {key:"dde",label:"DDE",fmt:v=>fmt(v)},
    {key:"batch",label:"BATCH",fmt:v=>fmt(v)},
    {key:"portal",label:"PORTAL",fmt:v=>fmt(v)},
    {key:"bulk",label:"BULK",fmt:v=>fmt(v)},
    {key:"other",label:"OTHER",fmt:v=>fmt(v)},
  ];
  const tot={...blank()};for(const a of arr)add(tot,a);totals(tot);
  const trows=arr.map(a=>({...a}));
  if(cfg.spark){
    const sByK=monthKeySeries(rows,cfg.keyFn,arr.map(a=>a.k));
    arr.forEach((a,i)=>{trows[i].spark=sparkline(sByK[i].map(x=>x.bill));});
    cols.push({key:"spark",label:"6-mo bills",align:"left"});
  }
  buildTable(tblHost,{columns:cols,rows:trows,defaultSort:"bill",
    onRowClick:cfg.kIsScheme?(r)=>{state.schemes=[r.k];syncSchemes();render();}:null,
    totalRow:c=>c.key==="k"?"TOTAL":(c.key==="ontimePct"?pct(tot.ontimePct):c.key==="coverage"?pct(tot.coverage):fmt(tot[c.key]))});
}
function renderGroupedCurrent(content,cg,cfg,arr){
  // chart A: bills by key (sequential emphasis)
  const top=arr.slice();const colors=arr.map((a,i)=>SEQ[Math.min(SEQ.length-1, 2+(i===0?0:1))]);
  // emphasis: top bar strongest, rest lighter
  const emph=arr.map((a,i)=> i===0?SEQ[4]:SEQ[2]);
  const cA=card(cg,`Bills by ${cfg.keyLabel}`,"Sorted high → low");
  newBar(cA.canvas,{labels:arr.map(a=>a.k),datasets:[{data:arr.map(a=>a.bill),backgroundColor:emph,borderRadius:4,maxBarThickness:26}]});

  // chart B: channel mix stacked
  const cB=card(cg,`Submit-channel mix by ${cfg.keyLabel}`,"Share of channel submits");
  const chKeys=["dde","batch","portal","bulk","other"];
  newBar(cB.canvas,{labels:arr.map(a=>a.k),
    datasets:chKeys.map((ck,i)=>({label:["DDE","BATCH","PORTAL","BULK","OTHER"][i],data:arr.map(a=>a[ck]),
      backgroundColor:[CH_COLORS.DDE,CH_COLORS.BATCH,CH_COLORS.PORTAL,CH_COLORS.BULKUPLOAD,CH_COLORS.OTHER],stack:"s"})),
    stacked:true,legend:true});
  if(cfg.extraCurrent)cfg.extraCurrent(content,cg,arr);
}
function renderGroupedCompare(content,cg,cfg,arr){
  const A=groupBy(rowsFor(state.snapA),cfg.keyFn);
  const B=groupBy(rowsFor(state.snapB),cfg.keyFn);
  const keys=[...new Set([...A.keys(),...B.keys()])].filter(k=>!cfg.order||cfg.order.includes(k)||true);
  // keep same ordering as current arr
  const order=arr.map(a=>a.k);
  const rows2=order.map(k=>{
    const a=totals({...(A.get(k)||blank())}),b=totals({...(B.get(k)||blank())});
    return {k,a,b,dB:b.bill-a.bill,dRate:(b.ontimePct??0)-(a.ontimePct??0),dCov:(b.coverage??0)-(a.coverage??0)};
  }).filter(r=>r.a.bill||r.b.bill).sort((x,y)=>Math.abs(y.dB)-Math.abs(x.dB));

  const cA=card(cg,`Δ Bills by ${cfg.keyLabel}  ·  ${state.snapB}−${state.snapA}`,"Diverging from 0",null,KEY_DELTA);
  newBar(cA.canvas,{labels:rows2.map(r=>r.k),datasets:[{data:rows2.map(r=>r.dB),
    backgroundColor:rows2.map(r=>r.dB>=0?POS:NEG),borderRadius:4,maxBarThickness:26}]});

  const cB=card(cg,`Δ On-time rate (pp) by ${cfg.keyLabel}`,"B − A, percentage points",null,KEY_DELTA);
  newBar(cB.canvas,{labels:rows2.map(r=>r.k),datasets:[{data:rows2.map(r=>r.dRate),
    backgroundColor:rows2.map(r=>r.dRate>=0?POS:NEG),borderRadius:4,maxBarThickness:26}]});

  // replace table section
  content.appendChild(el("div","section-cap",`<h2>${cfg.keyLabel} — A vs B</h2>`));
  const host=el("div");content.appendChild(host);
  const trows=rows2.map(r=>({k:r.k,billA:r.a.bill,billB:r.b.bill,dB:r.dB,rateA:r.a.ontimePct,rateB:r.b.ontimePct,dRate:r.dRate,covA:r.a.coverage,covB:r.b.coverage,dCov:r.dCov}));
  buildTable(host,{columns:[
    {key:"k",label:cfg.keyLabel.toUpperCase(),align:"left"},
    {key:"billA",label:`Bills · ${state.snapA}`,fmt:v=>fmt(v)},
    {key:"billB",label:`Bills · ${state.snapB}`,fmt:v=>fmt(v)},
    {key:"dB",label:"Δ Bills",fmt:v=>`<span class="${v>0?"delta-up":v<0?"delta-dn":"delta-flat"}">${signed(v)}</span>`},
    {key:"rateA",label:`On-time · ${state.snapA}`,fmt:v=>pct(v)},
    {key:"rateB",label:`On-time · ${state.snapB}`,fmt:v=>pct(v)},
    {key:"dRate",label:"Δ Rate",fmt:v=>`<span class="${v>0?"delta-up":v<0?"delta-dn":"delta-flat"}">${pp(v)}</span>`},
    {key:"covA",label:`Cov · ${state.snapA}`,fmt:v=>pct(v)},
    {key:"covB",label:`Cov · ${state.snapB}`,fmt:v=>pct(v)},
    {key:"dCov",label:"Δ Cov",fmt:v=>`<span class="${v>0?"delta-up":v<0?"delta-dn":"delta-flat"}">${pp(v)}</span>`},
  ],rows:trows,defaultSort:"dB"});
}
function renderGroupedTrend(content,cg,cfg,arr){
  const rows=rowsFor(state.snap);
  const topN=arr.filter(a=>!a._other).slice(0,cfg.trendTop||6).map(a=>a.k);
  const rest=arr.filter(a=>!a._other).slice(cfg.trendTop||6);
  const series=monthKeySeries(rows,cfg.keyFn,topN);
  // build "Other" line by summing the tail across months (only when a tail exists)
  let datasets;
  if(rest.length){
    const tailSeries=monthKeySeries(rows,cfg.keyFn,rest.map(a=>a.k));
    const otherLine=DATA.months.map((_,i)=>{const o=blank();for(const ts of tailSeries)add(o,ts[i]);return totals(o).bill;});
    datasets=topN.map((k,i)=>({label:k,data:series[i].map(a=>a.bill),borderColor:CAT[i%8],
      backgroundColor:CAT[i%8]+"22",pointBackgroundColor:CAT[i%8]}));
    datasets.push({label:"Other ("+rest.length+")",data:otherLine,borderColor:cssVar("--muted"),backgroundColor:"#0000",pointBackgroundColor:cssVar("--muted"),borderDash:[5,3]});
  } else {
    datasets=topN.map((k,i)=>({label:k,data:series[i].map(a=>a.bill),borderColor:CAT[i%8],backgroundColor:CAT[i%8]+"22",pointBackgroundColor:CAT[i%8]}));
  }
  const cA=card(cg,`Bills by ${cfg.keyLabel} over months`,`Top ${topN.length}${rest.length?" + Other":""}`);
  newLine(cA.canvas,{labels:DATA.months,datasets,legend:true});

  // on-time rate trend per key (top N)
  const rateDS=topN.slice(0,topN.length-(rest.length?1:0)).map((k,i)=>({label:k,data:series[i].map(a=>a.ontimePct),borderColor:CAT[i%8],pointBackgroundColor:CAT[i%8]}));
  const cB=card(cg,`On-time rate by ${cfg.keyLabel} over months`,`Top ${topN.length}`);
  newLine(cB.canvas,{labels:DATA.months,datasets:rateDS,legend:true,pctScale:true,target:medianRate(rowsFor(state.snap))});

  // month summary table
  content.appendChild(el("div","section-cap",`<h2>Monthly summary</h2>`));
  const host=el("div");content.appendChild(host);
  const mm=DATA.months.map(ym=>{const a=totals({...groupBy(rows.filter(r=>r.ym===ym),()=>0).get(0)});a.ym=ym;return a;});
  buildTable(host,{columns:[
    {key:"ym",label:"Month",align:"left"},
    {key:"bill",label:"Bills",fmt:v=>fmt(v)},
    {key:"total",label:"Submitted",fmt:v=>fmt(v)},
    {key:"ontime",label:"On-time",fmt:v=>fmt(v)},
    {key:"ontimePct",label:"On-time %",fmt:v=>pct(v)},
    {key:"coverage",label:"Coverage %",fmt:v=>pct(v)},
  ],rows:mm});
}
function medianRate(rows){const a=totals({...groupBy(rows,()=>0).get(0)});return a.ontimePct;}

/* helper: make a card with canvas. key = optional [{c:color,t:label},...] color key */
function card(parent,title,hint,cap,key){
  const c=el("div","card");
  const keyHtml=key&&key.length?`<div class="ckey">${key.map(k=>`<span class="ckey-i"><i style="background:${k.c}"></i>${k.t}</span>`).join("")}</div>`:"";
  c.innerHTML=`<div class="card-title"><h3>${title}</h3>${hint?`<span class="hint">${hint}</span>`:""}</div>
    ${keyHtml}
    <div class="chart-wrap"><canvas></canvas></div>${cap?`<div class="caption">${cap}</div>`:""}`;
  parent.appendChild(c);
  return {el:c,canvas:$("canvas",c)};
}

/* ============================================================
   TAB RENDERERS
   ============================================================ */
function renderSummary(content){
  const rows=rowsFor(state.snap);
  const all=totals({...groupBy(rows,()=>0).get(0)});
  const schemesActive=new Set(rows.map(r=>r.sc)).size;
  const trusteesActive=new Set(rows.map(r=>r.tr)).size;

  if(state.mode==="compare"){
    return renderSummaryCompare(content);
  }
  if(state.mode==="trend"){
    return renderSummaryTrend(content);
  }

  // Zone 1 — Per-account-type KPI tiles
  const allVisible=DATA.months.filter(ym=>ym>=state.mfrom&&ym<=state.mto);
  const curMonth=allVisible[allVisible.length-1]||"";
  const prevMonth=allVisible.length>=2?allVisible[allVisible.length-2]:null;
  const last6=allVisible.slice(-6);

  const AT_LIST=["REE","CEE","SEP","TVC","SVC","PAH"];
  const atData={};
  AT_LIST.forEach(at=>{
    const curRows=rows.filter(r=>r.at===at&&r.ym===curMonth);
    const prevRows=prevMonth?rows.filter(r=>r.at===at&&r.ym===prevMonth):[];
    const c=totals({...groupBy(curRows,()=>0).get(0)});
    const p=prevRows.length?totals({...groupBy(prevRows,()=>0).get(0)}):null;
    atData[at]={
      cur:c.total||0,
      prev:p?p.total:null,
      last6: last6.map(ym=>totals({...groupBy(rows.filter(r=>r.at===at&&r.ym===ym),()=>0).get(0)}).total||0)
    };
  });
  // Expose filtered rows globally so kpiAtTile tooltip can re-compute
  window.__summaryRows=rows;

  const zone1=el("div","zone");
  const kpis=el("div","kpis"); kpis.classList.add("at-row");
  AT_LIST.forEach(at=>{
    const tile=kpiAtTile({at, cur:atData[at].cur, prev:atData[at].prev,
      months6:last6, curLabel:curMonth});
    if(state.at && state.at!==at) tile.classList.add("kpi-dim");
    kpis.appendChild(tile);
  });
  zone1.appendChild(kpis);
  content.appendChild(zone1);

  // Zone 1b — Contribution Mode single horizontal stacked bar
  const modeStrip=el("div");
  modeStrip.style.margin="-12px 0 24px 0";
  buildModeStackedBar(modeStrip, rows);
  content.appendChild(modeStrip);

  // Zone 2 — Channel table (40%) + Mode×Freq table (60%)
  const last3=allVisible.slice(-3);
  const zone2=el("div","zone");
  const duo=el("div","duo-wrap"); zone2.appendChild(duo);
  const left40=el("div"); left40.style.flex="0 0 40%";
  const right60=el("div"); right60.style.flex="0 0 60%";
  duo.appendChild(left40); duo.appendChild(right60);
  buildChannel3MonthTable(left40, rows, last3);
  buildStatusStackedByMonth(right60, rows);
  content.appendChild(zone2);

  // Zone 3 — Status by month grouped by trustee + remaining charts
  const zone3=el("div","zone");
  content.appendChild(zone3);

  if(allVisible.length){
    zone3.appendChild(el("div","section-cap",
      `<div class="sc-label">Status breakdown</div>
       <h2>Submission status by month</h2>`));
    const bvHost=el("div"); zone3.appendChild(bvHost);
    buildStatusByMonthWithTrustee(bvHost, rows, allVisible);
  }

  const cg=el("div","grid g2");zone3.appendChild(cg);

  // scheme × month heatmap
  const schemes=ranked(groupBy(rows,r=>r.sc),{sortBy:"bill"}).map(a=>a.k);
  const hmVals=schemes.map(sc=>DATA.months.map(ym=>{const a=groupBy(rows.filter(r=>r.sc===sc&&r.ym===ym),()=>0).get(0);return a?{bill:a.bill}:null;}));
  const hmCard=el("div","card span2");
  hmCard.innerHTML=`<div class="card-title"><h3>Bills · scheme × month</h3><span class="hint">click a row to open the scheme</span></div><div id="hm" style="padding:4px 2px"></div><div class="caption">Darker = more bills (sequential blue). Empty cell = no bills that month.</div>`;
  cg.appendChild(hmCard);
  heatmap($("#hm",hmCard),{rowKeys:schemes,colKeys:DATA.months,values:hmVals,colShort:c=>c.slice(2),onClick:sc=>{state.schemes=[sc];syncSchemes();go("scheme-scorecard");}});

  // status mix stacked
  const stArr=ranked(groupBy(rows,r=>r.st),{order:DATA.statuses});
  const cStatus=card(cg,"Bills by status","Lifecycle order");
  newBar(cStatus.canvas,{labels:stArr.map(a=>a.k),indexAxis:"y",stacked:false,
    datasets:[{data:stArr.map(a=>a.bill),backgroundColor:stArr.map(a=>statusColor(a.k)),maxBarThickness:24}]});
  cStatus.el.style.cursor="pointer";

  // channel mix
  const chSum=["dde","batch","portal","bulk","other"].map(k=>all[k]);
  const cCh=card(cg,"Submit-channel mix","DDE·BATCH·PORTAL·BULK·OTHER");
  newBar(cCh.canvas,{labels:["DDE","BATCH","PORTAL","BULK","OTHER"],
    datasets:[{data:chSum,backgroundColor:["DDE","BATCH","PORTAL","BULK","OTHER"].map(k=>CH_COLORS[k]),maxBarThickness:40,borderRadius:4}]});

  // top schemes table
  zone3.appendChild(el("div","section-cap",
    `<div class="sc-label">Scheme rankings</div>
     <h2>Top schemes</h2>
     <p>Click a scheme code to focus the dashboard on it.</p>`));
  const host=el("div");zone3.appendChild(host);
  const schArr=ranked(groupBy(rows,r=>r.sc),{sortBy:"bill"});
  buildTable(host,{columns:[
    {key:"k",label:"SCHEME",align:"left",cls:()=>"sc"},
    {key:"bill",label:"Bills",fmt:v=>fmt(v)},
    {key:"total",label:"Submitted",fmt:v=>fmt(v)},
    {key:"ontimePct",label:"On-time %",fmt:v=>pct(v)},
    {key:"coverage",label:"Coverage %",fmt:v=>pct(v)},
  ],rows:schArr.map(a=>({k:a.k,bill:a.bill,total:a.total,ontimePct:a.ontimePct,coverage:a.coverage})),
    onRowClick:r=>{state.schemes=[r.k];syncSchemes();go("scheme-scorecard");}});
}
function renderSummaryCompare(content){
  const rowsA=rowsFor(state.snapA);
  const rowsB=rowsFor(state.snapB);
  const A=totals({...groupBy(rowsA,()=>0).get(0)});
  const B=totals({...groupBy(rowsB,()=>0).get(0)});
  const schemesA=new Set(rowsA.map(r=>r.sc)).size;
  const schemesB=new Set(rowsB.map(r=>r.sc)).size;
  const trusteesA=new Set(rowsA.map(r=>r.tr)).size;
  const trusteesB=new Set(rowsB.map(r=>r.tr)).size;
  const monthlyA=DATA.months.map(ym=>totals({...groupBy(rowsA.filter(r=>r.ym===ym),()=>0).get(0)}));
  const monthlyB=DATA.months.map(ym=>totals({...groupBy(rowsB.filter(r=>r.ym===ym),()=>0).get(0)}));
  const months=DATA.months.map(m=>m.slice(5));
  const avgBill=monthlyB.length>0?monthlyB.reduce((s,r)=>s+r.bill,0)/monthlyB.length:0;
  const targetData=monthlyB.map(()=>Math.round(avgBill));
  const kpis=el("div","kpis");
  kpis.innerHTML=
    kpiTile({label:`Total bills · ${state.snapB}`,value:fmt(B.bill),delta:B.bill-A.bill,chartId:"kpi-chart-bills",sub:"this snapshot"})+
    kpiTile({label:`Submits · ${state.snapB}`,value:fmt(B.total),delta:B.total-A.total,chartId:"kpi-chart-submits",sub:"this snapshot"})+
    kpiTile({label:`On-time rate · ${state.snapB}`,value:pct(B.ontimePct),delta:(B.ontimePct||0)-(A.ontimePct||0),deltaFmt:"pp",chartId:"kpi-chart-ontime",sub:"bills on-time"})+
    kpiTile({label:`Coverage · ${state.snapB}`,value:pct(B.coverage),delta:(B.coverage||0)-(A.coverage||0),deltaFmt:"pp",chartId:"kpi-chart-coverage",sub:"employers actioned"})+
    kpiTile({label:`Active schemes`,value:schemesB,delta:schemesB-schemesA,chartId:"kpi-chart-schemes",sub:"schemes with data"})+
    kpiTile({label:`Trustees`,value:trusteesB,chartId:"kpi-chart-trustees",sub:"approved trustees"});
  content.appendChild(kpis);
  requestAnimationFrame(()=>{
    renderKpiChart("kpi-chart-bills",{labels:months,actual:monthlyB.map(r=>r.bill),target:targetData});
    renderKpiChart("kpi-chart-submits",{labels:months,actual:monthlyB.map(r=>r.total),target:targetData});
    renderKpiChart("kpi-chart-ontime",{labels:months,actual:monthlyB.map(r=>r.ontimePct||0),target:monthlyB.map(()=>B.ontimePct||0)});
    renderKpiChart("kpi-chart-coverage",{labels:months,actual:monthlyB.map(r=>r.coverage||0),target:monthlyB.map(()=>B.coverage||0)});
    renderKpiChart("kpi-chart-schemes",{labels:months,actual:monthlyB.map(()=>schemesB),target:monthlyB.map(()=>schemesB)});
    renderKpiChart("kpi-chart-trustees",{labels:months,actual:monthlyB.map(()=>trusteesB),target:monthlyB.map(()=>trusteesB)});
  });
  content.appendChild(el("div","note",`Comparing snapshot <b>${state.snapA}</b> → <b>${state.snapB}</b>. Deltas are B − A. Use the dedicated <b>Snapshot Comparison</b> tab for the full per-scheme breakdown.`));
}

/* ---- summary: trend mode (high-level 6-month trends) ---- */
function renderSummaryTrend(content){
  const rows=rowsFor(state.snap);
  const all=totals({...groupBy(rows,()=>0).get(0)});
  const med=medianRate(rows);
  const schemesActive=new Set(rows.map(r=>r.sc)).size;
  const trusteesActive=new Set(rows.map(r=>r.tr)).size;
  const monthlyData=DATA.months.map(ym=>totals({...groupBy(rows.filter(r=>r.ym===ym),()=>0).get(0)}));
  const months=DATA.months.map(m=>m.slice(5));
  const avgBill=monthlyData.length>0?monthlyData.reduce((s,r)=>s+r.bill,0)/monthlyData.length:0;
  const targetData=monthlyData.map(()=>Math.round(avgBill));
  // KPI: 6-month totals (no snapshot delta in trend mode)
  const kpis=el("div","kpis");
  kpis.innerHTML=
    kpiTile({label:"Total bills (6 mo)",value:fmt(all.bill),chartId:"kpi-chart-bills",sub:"6-month total"})+
    kpiTile({label:"Submits (6 mo)",value:fmt(all.total),chartId:"kpi-chart-submits",sub:"6-month total"})+
    kpiTile({label:"On-time rate",value:pct(all.ontimePct),chartId:"kpi-chart-ontime",sub:"bills on-time"})+
    kpiTile({label:"Coverage",value:pct(all.coverage),chartId:"kpi-chart-coverage",sub:"employers actioned"})+
    kpiTile({label:"Active schemes",value:schemesActive,chartId:"kpi-chart-schemes",sub:"schemes with data"})+
    kpiTile({label:"Trustees",value:trusteesActive,chartId:"kpi-chart-trustees",sub:"approved trustees"});
  content.appendChild(kpis);
  requestAnimationFrame(()=>{
    renderKpiChart("kpi-chart-bills",{labels:months,actual:monthlyData.map(r=>r.bill),target:targetData});
    renderKpiChart("kpi-chart-submits",{labels:months,actual:monthlyData.map(r=>r.total),target:targetData});
    renderKpiChart("kpi-chart-ontime",{labels:months,actual:monthlyData.map(r=>r.ontimePct||0),target:monthlyData.map(()=>all.ontimePct||0)});
    renderKpiChart("kpi-chart-coverage",{labels:months,actual:monthlyData.map(r=>r.coverage||0),target:monthlyData.map(()=>all.coverage||0)});
    renderKpiChart("kpi-chart-schemes",{labels:months,actual:monthlyData.map(()=>schemesActive),target:monthlyData.map(()=>schemesActive)});
    renderKpiChart("kpi-chart-trustees",{labels:months,actual:monthlyData.map(()=>trusteesActive),target:monthlyData.map(()=>trusteesActive)});
  });

  const cg=el("div","grid g2");content.appendChild(cg);
  const monthTot=ym=>totals({...groupBy(rows.filter(r=>r.ym===ym),()=>0).get(0)});
  const series=fn=>DATA.months.map(ym=>fn(monthTot(ym)));

  const cA=card(cg,"Bills / Submits / On-time over months","Counts · snapshot "+state.snap);
  newLine(cA.canvas,{labels:DATA.months,datasets:[
    {label:"Bills",data:series(a=>a.bill),borderColor:SEQ[4]},
    {label:"Submitted",data:series(a=>a.total),borderColor:CAT[1]},
    {label:"On-time",data:series(a=>a.ontime),borderColor:CAT[6]}],legend:true});

  const present=DATA.statuses.filter(s=>rows.some(r=>r.st===s));
  const cB=card(cg,"Status mix over months","Stacked by lifecycle");
  const ch=window.Chart?new Chart(cB.canvas,{type:"bar",
    data:{labels:DATA.months,datasets:present.map((s,i)=>({label:s,
      data:DATA.months.map(ym=>{const a=groupBy(rows.filter(r=>r.ym===ym&&r.st===s),()=>0).get(0);return a?a.bill:0;}),
      backgroundColor:statusColor(s),stack:"s"}))},
    options:baseOpts({indexAxis:"x",scales:{x:{stacked:true,grid:{display:false}},y:{stacked:true,grid:{color:cssVar("--hairline")},ticks:{callback:v=>fmt(v)}}},plugins:{legend:{display:true,position:"bottom"}}})}):null;
  if(ch)chartRegistry.push(ch);

  const cC=card(cg,"On-time rate over months","vs median "+pct(med,0));
  newLine(cC.canvas,{labels:DATA.months,datasets:[{label:"On-time rate",data:series(a=>a.ontimePct),borderColor:POS,pointBackgroundColor:POS,backgroundColor:POS+"18",fill:true}],legend:false,pctScale:true,target:med});

  const cD=card(cg,"Coverage over months","submitted / billed");
  newLine(cD.canvas,{labels:DATA.months,datasets:[{label:"Coverage",data:series(a=>a.coverage),borderColor:CAT[0],pointBackgroundColor:CAT[0]}],legend:false,pctScale:true,target:1});

  content.appendChild(el("div","note",`Trend is within snapshot <b>${state.snap}</b> across the latest 6 months. For the full trend toolkit (per-key lines, A-vs-B overlay) use the dedicated <b>Monthly Trend</b> tab.`));
}

/* ---- submit channel (custom) ---- */
