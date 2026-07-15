"use strict";
function renderChannel(content){
  const rows=rowsFor(state.snap);
  const all=totals({...groupBy(rows,()=>0).get(0)});
  if(state.mode==="compare"){
    return renderChannelCompare(content);
  }
  if(state.mode==="trend"){
    return renderChannelTrend(content);
  }
  const cg=el("div","grid g2");content.appendChild(cg);
  // channel share per month (stacked %)
  const months=DATA.months;
  const chKeys=["dde","batch","portal","bulk","other"];
  const cA=card(cg,"Channel share per month","100% stacked · DDE·BATCH·PORTAL·BULK·OTHER");
  const datasetsA=chKeys.map((ck,i)=>({label:["DDE","BATCH","PORTAL","BULK","OTHER"][i],
    data:months.map(ym=>{const a=totals({...groupBy(rows.filter(r=>r.ym===ym),()=>0).get(0)});return a.chSum?a[ck]/a.chSum:0;}),
    backgroundColor:[CH_COLORS.DDE,CH_COLORS.BATCH,CH_COLORS.PORTAL,CH_COLORS.BULKUPLOAD,CH_COLORS.OTHER],stack:"s"}));
  newBar(cA.canvas,{labels:months,datasets:datasetsA,stacked:true,indexAxis:"x",pctScale:false,legend:true});

  // channel totals
  const cB=card(cg,"Channel totals","Submit counts");
  newBar(cB.canvas,{labels:["DDE","BATCH","PORTAL","BULK","OTHER"],
    datasets:[{data:chKeys.map(k=>all[k]),backgroundColor:["DDE","BATCH","PORTAL","BULK","OTHER"].map(k=>CH_COLORS[k]),maxBarThickness:40,borderRadius:4}]});

  // channel usage per scheme (top 10)
  const schArr=ranked(groupBy(rows,r=>r.sc),{sortBy:"bill",topN:10,capOther:"Other schemes"}).filter(a=>a.bill);
  const cC=card(cg,"Channel mix per scheme","Top 10 + Other");
  newBar(cC.canvas,{labels:schArr.map(a=>a.k),indexAxis:"y",stacked:true,
    datasets:chKeys.map((ck,i)=>({label:["DDE","BATCH","PORTAL","BULK","OTHER"][i],data:schArr.map(a=>a[ck]),
      backgroundColor:[CH_COLORS.DDE,CH_COLORS.BATCH,CH_COLORS.PORTAL,CH_COLORS.BULKUPLOAD,CH_COLORS.OTHER],stack:"s"})),legend:true});

  // overall part-to-whole donut
  const cD=card(cg,"Overall channel mix","Part-to-whole");
  newDoughnut(cD.canvas,{labels:["DDE","BATCH","PORTAL","BULK","OTHER"],data:chKeys.map(k=>all[k]),
    colors:["DDE","BATCH","PORTAL","BULK","OTHER"].map(k=>CH_COLORS[k])});

  // table
  content.appendChild(el("div","section-cap",`<h2>Channel — data</h2>`));
  const host=el("div");content.appendChild(host);
  const trows=["DDE","BATCH","PORTAL","BULK","OTHER"].map((name,i)=>({k:name,count:all[chKeys[i]],share:all.chSum?all[chKeys[i]]/all.chSum:0}));
  buildTable(host,{columns:[
    {key:"k",label:"CHANNEL",align:"left"},
    {key:"count",label:"Submit count",fmt:v=>fmt(v)},
    {key:"share",label:"Share %",fmt:v=>pct(v)},
  ],rows:trows,totalRow:c=>c.key==="k"?"TOTAL":c.key==="share"?"100.0%":fmt(all.chSum)});
}
function renderChannelCompare(content){
  const cg=el("div","grid g2");content.appendChild(cg);
  const A=totals({...groupBy(rowsFor(state.snapA),()=>0).get(0)});
  const B=totals({...groupBy(rowsFor(state.snapB),()=>0).get(0)});
  const chKeys=["dde","batch","portal","bulk","other"];const names=["DDE","BATCH","PORTAL","BULK","OTHER"];
  const cA=card(cg,`Δ channel share (pp) · ${state.snapB}−${state.snapA}`,"B − A",null,KEY_DELTA);
  const dPP=chKeys.map((k,i)=>{const sa=A.chSum?A[k]/A.chSum:0,sb=B.chSum?B[k]/B.chSum:0;return sb-sa;});
  newBar(cA.canvas,{labels:names,datasets:[{data:dPP,backgroundColor:dPP.map(v=>v>=0?POS:NEG),borderRadius:4,maxBarThickness:40}],pctScale:true});
  const cB=card(cg,"Channel counts · A vs B",`${state.snapA} vs ${state.snapB}`);
  newBar(cB.canvas,{labels:names,datasets:[
    {label:`A ${state.snapA}`,data:chKeys.map(k=>A[k]),backgroundColor:cssVar("--muted"),borderRadius:3},
    {label:`B ${state.snapB}`,data:chKeys.map(k=>B[k]),backgroundColor:POS,borderRadius:3}],legend:true,indexAxis:"x"});
  content.appendChild(el("div","note",`Share shift per channel between the two snapshots. Positive (blue) = channel gained share.`));
  // table
  content.appendChild(el("div","section-cap",`<h2>Channel — A vs B</h2>`));
  const host=el("div");content.appendChild(host);
  buildTable(host,{columns:[
    {key:"k",label:"CHANNEL",align:"left"},
    {key:"cA",label:`Count · ${state.snapA}`,fmt:v=>fmt(v)},
    {key:"cB",label:`Count · ${state.snapB}`,fmt:v=>fmt(v)},
    {key:"dC",label:"Δ Count",fmt:v=>`<span class="${v>0?"delta-up":v<0?"delta-dn":"delta-flat"}">${signed(v)}</span>`},
    {key:"sA",label:`Share · ${state.snapA}`,fmt:v=>pct(v)},
    {key:"sB",label:`Share · ${state.snapB}`,fmt:v=>pct(v)},
    {key:"dS",label:"Δ Share",fmt:v=>`<span class="${v>0?"delta-up":v<0?"delta-dn":"delta-flat"}">${pp(v)}</span>`},
  ],rows:names.map((n,i)=>({k:n,cA:A[chKeys[i]],cB:B[chKeys[i]],dC:B[chKeys[i]]-A[chKeys[i]],sA:A.chSum?A[chKeys[i]]/A.chSum:0,sB:B.chSum?B[chKeys[i]]/B.chSum:0,dS:(B.chSum?B[chKeys[i]]/B.chSum:0)-(A.chSum?A[chKeys[i]]/A.chSum:0)}))});
}
function renderChannelTrend(content){
  const cg=el("div","grid g2");content.appendChild(cg);
  const rows=rowsFor(state.snap);
  const chKeys=["dde","batch","portal","bulk","other"];const names=["DDE","BATCH","PORTAL","BULK","OTHER"];
  const cA=card(cg,"Channel share over months","100% stacked");
  newBar(cA.canvas,{labels:DATA.months,datasets:chKeys.map((ck,i)=>({label:names[i],
    data:DATA.months.map(ym=>{const a=totals({...groupBy(rows.filter(r=>r.ym===ym),()=>0).get(0)});return a.chSum?a[ck]/a.chSum:0;}),
    backgroundColor:[CH_COLORS.DDE,CH_COLORS.BATCH,CH_COLORS.PORTAL,CH_COLORS.BULKUPLOAD,CH_COLORS.OTHER],stack:"s"})),
    stacked:true,indexAxis:"x",legend:true});
  const cB=card(cg,"Channel counts over months","Multi-line");
  newLine(cB.canvas,{labels:DATA.months,datasets:chKeys.map((ck,i)=>({label:names[i],
    data:DATA.months.map(ym=>{const a=totals({...groupBy(rows.filter(r=>r.ym===ym),()=>0).get(0)});return a[ck];}),
    borderColor:[CH_COLORS.DDE,CH_COLORS.BATCH,CH_COLORS.PORTAL,CH_COLORS.BULKUPLOAD,CH_COLORS.OTHER],
    pointBackgroundColor:[CH_COLORS.DDE,CH_COLORS.BATCH,CH_COLORS.PORTAL,CH_COLORS.BULKUPLOAD,CH_COLORS.OTHER]})),legend:true});
  // table months
  content.appendChild(el("div","section-cap",`<h2>Channel — monthly</h2>`));
  const host=el("div");content.appendChild(host);
  const mm=DATA.months.map(ym=>{const a=totals({...groupBy(rows.filter(r=>r.ym===ym),()=>0).get(0)});return {ym,...a};});
  buildTable(host,{columns:[
    {key:"ym",label:"Month",align:"left"},
    ...names.map((n,i)=>({key:chKeys[i],label:n,fmt:v=>fmt(v)})),
    {key:"chSum",label:"Total",fmt:v=>fmt(v)},
  ],rows:mm});
}

/* ---- on-time performance (custom) ---- */
function renderOntime(content){
  if(state.mode==="trend"){const cg=el("div","grid g2");content.appendChild(cg);return renderGroupedTrend(content,cg,{keyFn:r=>r.sc,keyLabel:"Scheme",trendTop:8},ranked(groupBy(rowsFor(state.snap),r=>r.sc)));}
  const rows=rowsFor(state.snap);
  const med=medianRate(rows);
  if(state.mode==="compare"){
    const A=groupBy(rowsFor(state.snapA),r=>r.sc),B=groupBy(rowsFor(state.snapB),r=>r.sc);
    const keys=[...new Set([...A.keys(),...B.keys()])];
    const d=keys.map(k=>({k,a:totals({...(A.get(k)||blank())}),b:totals({...(B.get(k)||blank())})}))
      .map(x=>({k:x.k,x,dRate:(x.b.ontimePct||0)-(x.a.ontimePct||0)}))
      .filter(r=>(r.x.a.total||r.x.b.total))
      .sort((a,b)=>b.dRate-a.dRate);
    const cg=el("div","grid g1");content.appendChild(cg);
    const cA=card(cg,`Δ on-time rate (pp) by scheme · ${state.snapB}−${state.snapA}`,"Sorted: most improved first",null,KEY_DELTA);
    newBar(cA.canvas,{labels:d.map(r=>r.k),datasets:[{data:d.map(r=>r.dRate),backgroundColor:d.map(r=>r.dRate>=0?POS:NEG),maxBarThickness:20,borderRadius:3}],indexAxis:"y",pctScale:true});
    content.appendChild(el("div","section-cap",`<h2>On-time rate — A vs B</h2>`));
    const host=el("div");content.appendChild(host);
    buildTable(host,{columns:[
      {key:"k",label:"SCHEME",align:"left",cls:()=>"sc"},
      {key:"rA",label:`On-time · ${state.snapA}`,fmt:v=>pct(v)},
      {key:"rB",label:`On-time · ${state.snapB}`,fmt:v=>pct(v)},
      {key:"d",label:"Δ Rate",fmt:v=>`<span class="${v>0?"delta-up":v<0?"delta-dn":"delta-flat"}">${pp(v)}</span>`},
      {key:"bA",label:`Bills · ${state.snapA}`,fmt:v=>fmt(v)},
      {key:"bB",label:`Bills · ${state.snapB}`,fmt:v=>fmt(v)},
    ],rows:d.map(r=>({k:r.k,rA:r.x.a.ontimePct,rB:r.x.b.ontimePct,d:r.dRate,bA:r.x.a.bill,bB:r.x.b.bill})),
      onRowClick:r=>{state.schemes=[r.k];syncSchemes();render();}});
    return;
  }
  const cg=el("div","grid g2");content.appendChild(cg);
  const arr=ranked(groupBy(rows,r=>r.sc),{sortBy:"bill"}).filter(a=>a.total>0);
  const byRate=[...arr].sort((a,b)=>(b.ontimePct||0)-(a.ontimePct||0));
  const cA=card(cg,"On-time rate by scheme (ranked)","vs median "+pct(med,0),null,KEY_MED);
  newBar(cA.canvas,{labels:byRate.map(a=>a.k),indexAxis:"y",pctScale:true,
    datasets:[{data:byRate.map(a=>a.ontimePct),backgroundColor:byRate.map(a=>(a.ontimePct>=med?POS:NEG)),maxBarThickness:16,borderRadius:3}]});

  // scatter bills vs rate
  const cB=card(cg,"Volume vs timeliness","Each dot = scheme · x=bills, y=on-time%",null,KEY_MED);
  const sc=window.Chart?new Chart(cB.canvas,{type:"scatter",
    data:{datasets:[{label:"scheme",data:arr.map(a=>({x:a.bill,y:a.ontimePct,sc:a.k})),
      backgroundColor:arr.map(a=>(a.ontimePct>=med?POS:NEG)),pointRadius:4,pointHoverRadius:6}]},
    options:baseOpts({scales:{x:{title:{display:true,text:"Bills"},grid:{color:cssVar("--hairline")},ticks:{callback:v=>fmt(v)}},
      y:{min:0,max:1,title:{display:true,text:"On-time %"},grid:{color:cssVar("--hairline")},ticks:{callback:v=>(v*100).toFixed(0)+"%"}}},
      plugins:{tooltip:{callbacks:{label:ctx=>{const d=ctx.raw;return` ${d.sc}: ${fmt(d.x)} bills · ${pct(d.y)}`}}}}})}):null;
  if(sc)chartRegistry.push(sc);

  // table
  content.appendChild(el("div","section-cap",`<h2>On-time performance — data</h2><p>Median on-time rate: <b>${pct(med)}</b>. Status chip rates each scheme vs the median.</p>`));
  const host=el("div");content.appendChild(host);
  const ranked2=[...arr].sort((a,b)=>(b.ontimePct||0)-(a.ontimePct||0));
  buildTable(host,{columns:[
    {key:"k",label:"SCHEME",align:"left",cls:()=>"sc"},
    {key:"bill",label:"Bills",fmt:v=>fmt(v)},
    {key:"total",label:"Submitted",fmt:v=>fmt(v)},
    {key:"ontime",label:"On-time",fmt:v=>fmt(v)},
    {key:"ontimePct",label:"On-time %",fmt:v=>pct(v)},
    {key:"rank",label:"Rank",fmt:v=>v},
    {key:"vs",label:"vs median",fmt:(v,r)=>{const d=(r.ontimePct||0)-med;const c=d>=0.05?"good":d<=-0.05?"crit":"serious";
      const ic=d>=0.05?"▲":d<=-0.05?"▼":"■";return `<span class="badge ${c}">${ic} ${pp(d)}</span>`;}},
  ],rows:ranked2.map((a,i)=>({...a,rank:i+1})),
    onRowClick:r=>{state.schemes=[r.k];syncSchemes();render();}});
}

/* ---- funnel & coverage (custom) ---- */
function renderFunnel(content){
  const rows=rowsFor(state.snap);
  if(state.mode==="compare"){return renderFunnelCompare(content);}
  if(state.mode==="trend"){return renderFunnelTrend(content);}
  const all=totals({...groupBy(rows,()=>0).get(0)});
  const cg=el("div","grid g2");content.appendChild(cg);
  // funnel: ordinal bars
  const stages=[{k:"Billed",v:all.bill,c:SEQ[2]},{k:"Submitted",v:all.total,c:SEQ[4]},{k:"On-time",v:all.ontime,c:SEQ[6]}];
  const cA=card(cg,"Submit funnel","Billed → Submitted → On-time · ordinal ramp");
  newBar(cA.canvas,{labels:stages.map(s=>s.k),indexAxis:"x",
    datasets:[{data:stages.map(s=>s.v),backgroundColor:stages.map(s=>s.c),maxBarThickness:70,borderRadius:4}]});
  // coverage per scheme diverging vs 1.0
  const schArr=ranked(groupBy(rows,r=>r.sc),{sortBy:"bill"}).filter(a=>a.bill);
  const cB=card(cg,"Coverage by scheme","submitted / billed · target 100%",null,KEY_FULL);
  newBar(cB.canvas,{labels:schArr.map(a=>a.k),indexAxis:"y",pctScale:true,
    datasets:[{data:schArr.map(a=>a.coverage),backgroundColor:schArr.map(a=>(a.coverage>=1?POS:NEG)),maxBarThickness:16,borderRadius:3}]});
  // per month stacked: billed vs submitted-late vs on-time
  const cC=card(cg,"Per-month composition","billed vs submitted-not-on-time vs on-time");
  const months=DATA.months;
  const lateData=months.map(ym=>{const a=totals({...groupBy(rows.filter(r=>r.ym===ym),()=>0).get(0)});return Math.max(0,a.total-a.ontime);});
  const ontimeData=months.map(ym=>{const a=totals({...groupBy(rows.filter(r=>r.ym===ym),()=>0).get(0)});return a.ontime;});
  const unsentData=months.map(ym=>{const a=totals({...groupBy(rows.filter(r=>r.ym===ym),()=>0).get(0)});return Math.max(0,a.bill-a.total);});
  newBar(cC.canvas,{labels:months,datasets:[
    {label:"On-time",data:ontimeData,backgroundColor:CAT[1],stack:"s"},
    {label:"Submitted, late",data:lateData,backgroundColor:CAT[3],stack:"s"},
    {label:"Not submitted",data:unsentData,backgroundColor:cssVar("--muted"),stack:"s"}],stacked:true,indexAxis:"x",legend:true});
  // table
  content.appendChild(el("div","section-cap",`<h2>Funnel & coverage — data</h2>`));
  const host=el("div");content.appendChild(host);
  buildTable(host,{columns:[
    {key:"k",label:"SCHEME",align:"left",cls:()=>"sc"},
    {key:"bill",label:"Bills",fmt:v=>fmt(v)},
    {key:"total",label:"Submitted",fmt:v=>fmt(v)},
    {key:"cov",label:"Coverage %",fmt:v=>pct(v)},
    {key:"ontime",label:"On-time",fmt:v=>fmt(v)},
    {key:"otr",label:"On-time / submitted %",fmt:v=>pct(v)},
    {key:"otb",label:"On-time / billed %",fmt:v=>pct(v)},
  ],rows:schArr.map(a=>({k:a.k,bill:a.bill,total:a.total,cov:a.coverage,ontime:a.ontime,otr:a.total?a.ontime/a.total:0,otb:a.bill?a.ontime/a.bill:0})),
    onRowClick:r=>{state.schemes=[r.k];syncSchemes();render();},
    totalRow:c=>c.key==="k"?"TOTAL":c.key==="cov"?pct(all.coverage):c.key==="otr"?pct(all.total?all.ontime/all.total:0):c.key==="otb"?pct(all.bill?all.ontime/all.bill:0):fmt(all[c.key])});
}
function renderFunnelCompare(content){
  const cg=el("div","grid g1");content.appendChild(cg);
  const A=totals({...groupBy(rowsFor(state.snapA),()=>0).get(0)});
  const B=totals({...groupBy(rowsFor(state.snapB),()=>0).get(0)});
  const cA=card(cg,`Funnel A vs B · ${state.snapA} / ${state.snapB}`,"Grouped by stage");
  newBar(cA.canvas,{labels:["Billed","Submitted","On-time"],indexAxis:"x",
    datasets:[{label:`A ${state.snapA}`,data:[A.bill,A.total,A.ontime],backgroundColor:cssVar("--muted"),borderRadius:3},
              {label:`B ${state.snapB}`,data:[B.bill,B.total,B.ontime],backgroundColor:POS,borderRadius:3}],legend:true});
  content.appendChild(el("div","note",`B − A:  bills ${signed(B.bill-A.bill)} · submits ${signed(B.total-A.total)} · on-time ${signed(B.ontime-A.ontime)}. Coverage shifted ${pp((B.coverage||0)-(A.coverage||0))}.`));
}
function renderFunnelTrend(content){
  const cg=el("div","grid g2");content.appendChild(cg);
  const rows=rowsFor(state.snap);
  const cA=card(cg,"Funnel stages over months","Bills / Submitted / On-time");
  newLine(cA.canvas,{labels:DATA.months,datasets:[
    {label:"Bills",data:DATA.months.map(ym=>totals({...groupBy(rows.filter(r=>r.ym===ym),()=>0).get(0)}).bill),borderColor:SEQ[4],pointBackgroundColor:SEQ[4]},
    {label:"Submitted",data:DATA.months.map(ym=>totals({...groupBy(rows.filter(r=>r.ym===ym),()=>0).get(0)}).total),borderColor:CAT[1],pointBackgroundColor:CAT[1]},
    {label:"On-time",data:DATA.months.map(ym=>totals({...groupBy(rows.filter(r=>r.ym===ym),()=>0).get(0)}).ontime),borderColor:CAT[6],pointBackgroundColor:CAT[6]}],legend:true});
  const cB=card(cg,"Coverage & on-time rate over months","ratios");
  newLine(cB.canvas,{labels:DATA.months,datasets:[
    {label:"Coverage",data:DATA.months.map(ym=>totals({...groupBy(rows.filter(r=>r.ym===ym),()=>0).get(0)}).coverage),borderColor:CAT[0],pointBackgroundColor:CAT[0]},
    {label:"On-time rate",data:DATA.months.map(ym=>totals({...groupBy(rows.filter(r=>r.ym===ym),()=>0).get(0)}).ontimePct),borderColor:CAT[1],pointBackgroundColor:CAT[1]}],legend:true,pctScale:true});
  content.appendChild(el("div","section-cap",`<h2>Monthly summary</h2>`));
  const host=el("div");content.appendChild(host);
  buildTable(host,{columns:[
    {key:"ym",label:"Month",align:"left"},
    {key:"bill",label:"Bills",fmt:v=>fmt(v)},
    {key:"total",label:"Submitted",fmt:v=>fmt(v)},
    {key:"ontime",label:"On-time",fmt:v=>fmt(v)},
    {key:"cov",label:"Coverage %",fmt:v=>pct(v)},
    {key:"otr",label:"On-time %",fmt:v=>pct(v)},
  ],rows:DATA.months.map(ym=>{const a=totals({...groupBy(rows.filter(r=>r.ym===ym),()=>0).get(0)});return{ym,bill:a.bill,total:a.total,ontime:a.ontime,cov:a.coverage,otr:a.ontimePct};})});
}

/* ---- monthly trend tab ---- */
function renderTrendTab(content){
  const rowsA=rowsFor(state.snapA), rowsB=rowsFor(state.snapB);
  const compare=state.mode==="compare" && state.snapA!==state.snapB;
  const cg=el("div","grid g2");content.appendChild(cg);

  // multi-line bills/submits/ontime, A solid / B dashed if compare
  const metric=(rows,fn)=>DATA.months.map(ym=>fn(totals({...groupBy(rows.filter(r=>r.ym===ym),()=>0).get(0)})));
  const rows=compare?rowsB:rowsFor(state.snap);
  const cA=card(cg,compare?`Bills over months · A vs B`:`Bills / Submits / On-time over months`,compare?`${state.snapA} (solid) vs ${state.snapB} (dashed)`:"3 metrics");
  if(compare){
    newLine(cA.canvas,{labels:DATA.months,datasets:[
      {label:`Bills A`,data:metric(rowsA,a=>a.bill),borderColor:SEQ[4]},
      {label:`Bills B`,data:metric(rowsB,a=>a.bill),borderColor:SEQ[4],borderDash:[5,3]},
      {label:`Submits A`,data:metric(rowsA,a=>a.total),borderColor:CAT[1]},
      {label:`Submits B`,data:metric(rowsB,a=>a.total),borderColor:CAT[1],borderDash:[5,3]},
      {label:`On-time A`,data:metric(rowsA,a=>a.ontime),borderColor:CAT[6]},
      {label:`On-time B`,data:metric(rowsB,a=>a.ontime),borderColor:CAT[6],borderDash:[5,3]}],legend:true});
  } else {
    newLine(cA.canvas,{labels:DATA.months,datasets:[
      {label:"Bills",data:metric(rows,a=>a.bill),borderColor:SEQ[4]},
      {label:"Submitted",data:metric(rows,a=>a.total),borderColor:CAT[1]},
      {label:"On-time",data:metric(rows,a=>a.ontime),borderColor:CAT[6]}],legend:true});
  }

  // status mix stacked over months
  const cB=card(cg,"Status mix over months","Stacked area by lifecycle");
  const stArr=DATA.statuses.filter(s=>rows.some(r=>r.st===s));
  const ch=window.Chart?new Chart(cB.canvas,{type:"bar",
    data:{labels:DATA.months,datasets:stArr.map((s,i)=>({label:s,
      data:DATA.months.map(ym=>{const a=groupBy(rows.filter(r=>r.ym===ym&&r.st===s),()=>0).get(0);return a?a.bill:0;}),
      backgroundColor:statusColor(s),stack:"s"}))},
    options:baseOpts({indexAxis:"x",scales:{x:{stacked:true,grid:{display:false}},y:{stacked:true,grid:{color:cssVar("--hairline")},ticks:{callback:v=>fmt(v)}}},
      plugins:{legend:{display:true,position:"bottom"}}})}):null;
  if(ch)chartRegistry.push(ch);

  // on-time rate line + target
  const med=medianRate(rows);
  const cC=card(cg,"On-time rate over months","vs dataset median "+pct(med,0));
  const rateDS=[{label:"On-time rate",data:metric(rows,a=>a.ontimePct),borderColor:POS,pointBackgroundColor:POS,backgroundColor:POS+"18",fill:true}];
  if(compare)rateDS.push({label:`A ${state.snapA}`,data:metric(rowsA,a=>a.ontimePct),borderColor:cssVar("--muted"),borderDash:[5,3]});
  newLine(cC.canvas,{labels:DATA.months,datasets:rateDS,legend:!!compare,pctScale:true,target:med});

  // coverage line
  const cD=card(cg,"Coverage over months","submitted / billed");
  newLine(cD.canvas,{labels:DATA.months,datasets:[{label:"Coverage",data:metric(rows,a=>a.coverage),borderColor:CAT[0],pointBackgroundColor:CAT[0]}],legend:false,pctScale:true,target:1});

  // table
  content.appendChild(el("div","section-cap",`<h2>Monthly summary${compare?` · ${state.snapB}`:""}</h2>`));
  const host=el("div");content.appendChild(host);
  buildTable(host,{columns:[
    {key:"ym",label:"Month",align:"left"},
    {key:"bill",label:"Bills",fmt:v=>fmt(v)},
    {key:"total",label:"Submits",fmt:v=>fmt(v)},
    {key:"ontime",label:"On-time",fmt:v=>fmt(v)},
    {key:"otr",label:"On-time %",fmt:v=>pct(v)},
    {key:"cov",label:"Coverage %",fmt:v=>pct(v)},
  ],rows:DATA.months.map(ym=>{const a=totals({...groupBy(rows.filter(r=>r.ym===ym),()=>0).get(0)});return{ym,bill:a.bill,total:a.total,ontime:a.ontime,otr:a.ontimePct,cov:a.coverage};})});
}

/* ---- snapshot comparison tab ---- */
function renderComparison(content){
  const A=rowsFor(state.snapA),B=rowsFor(state.snapB);
  const cg=el("div","grid g2");content.appendChild(cg);
  // Δ bills per scheme diverging
  const Am=groupBy(A,r=>r.sc),Bm=groupBy(B,r=>r.sc);
  const keys=[...new Set([...Am.keys(),...Bm.keys()])];
  const d=keys.map(k=>{const a=totals({...(Am.get(k)||blank())}),b=totals({...(Bm.get(k)||blank())});
    return {k,a,b,dB:b.bill-a.bill,dRate:(b.ontimePct||0)-(a.ontimePct||0),dCov:(b.coverage||0)-(a.coverage||0)};})
    .filter(r=>r.a.bill||r.b.bill).sort((x,y)=>y.dB-x.dB);
  const cA=card(cg,`Δ Bills by scheme · ${state.snapB}−${state.snapA}`,"Diverging from 0",null,KEY_DELTA);
  newBar(cA.canvas,{labels:d.map(r=>r.k),datasets:[{data:d.map(r=>r.dB),backgroundColor:d.map(r=>r.dB>=0?POS:NEG),maxBarThickness:18,borderRadius:3}],indexAxis:"y"});
  const cB=card(cg,`Δ On-time rate (pp) by scheme`,"B − A",null,KEY_DELTA);
  newBar(cB.canvas,{labels:d.map(r=>r.k),datasets:[{data:d.map(r=>r.dRate),backgroundColor:d.map(r=>r.dRate>=0?POS:NEG),maxBarThickness:18,borderRadius:3}],indexAxis:"y",pctScale:true});

  // KPI delta tiles
  const tA=totals({...groupBy(A,()=>0).get(0)}),tB=totals({...groupBy(B,()=>0).get(0)});
  const kpis=el("div","kpis");
  kpis.innerHTML=
    kpiTile({label:`Δ Bills (${state.snapB})`,value:fmt(tB.bill),delta:tB.bill-tA.bill})+
    kpiTile({label:`Δ Submits`,value:fmt(tB.total),delta:tB.total-tA.total})+
    kpiTile({label:`Δ On-time rate`,value:pct(tB.ontimePct),delta:(tB.ontimePct||0)-(tA.ontimePct||0),deltaFmt:"pp"})+
    kpiTile({label:`Δ Coverage`,value:pct(tB.coverage),delta:(tB.coverage||0)-(tA.coverage||0),deltaFmt:"pp"})+
    kpiTile({label:`Δ On-time (count)`,value:fmt(tB.ontime),delta:tB.ontime-tA.ontime})+
    kpiTile({label:`Schemes in B`,value:new Set(B.map(r=>r.sc)).size,delta:new Set(B.map(r=>r.sc)).size-new Set(A.map(r=>r.sc)).size});
  content.insertBefore(kpis, cg); // KPIs above the charts

  // table
  content.appendChild(el("div","section-cap",`<h2>Snapshot comparison — per scheme</h2><p>Δ = ${state.snapB} − ${state.snapA}. Sign chips only; values stay in ink.</p>`));
  const host=el("div");content.appendChild(host);
  buildTable(host,{columns:[
    {key:"k",label:"SCHEME",align:"left",cls:()=>"sc"},
    {key:"bA",label:`Bills · ${state.snapA}`,fmt:v=>fmt(v)},
    {key:"bB",label:`Bills · ${state.snapB}`,fmt:v=>fmt(v)},
    {key:"dB",label:"Δ Bills",fmt:v=>`<span class="${v>0?"delta-up":v<0?"delta-dn":"delta-flat"}">${signed(v)}</span>`},
    {key:"rA",label:`On-time · ${state.snapA}`,fmt:v=>pct(v)},
    {key:"rB",label:`On-time · ${state.snapB}`,fmt:v=>pct(v)},
    {key:"dR",label:"Δ Rate",fmt:v=>`<span class="${v>0?"delta-up":v<0?"delta-dn":"delta-flat"}">${pp(v)}</span>`},
    {key:"cA",label:`Cov · ${state.snapA}`,fmt:v=>pct(v)},
    {key:"cB",label:`Cov · ${state.snapB}`,fmt:v=>pct(v)},
    {key:"dC",label:"Δ Cov",fmt:v=>`<span class="${v>0?"delta-up":v<0?"delta-dn":"delta-flat"}">${pp(v)}</span>`},
  ],rows:d.map(r=>({k:r.k,bA:r.a.bill,bB:r.b.bill,dB:r.dB,rA:r.a.ontimePct,rB:r.b.ontimePct,dR:r.dRate,cA:r.a.coverage,cB:r.b.coverage,dC:r.dCov})),
    onRowClick:r=>{state.schemes=[r.k];syncSchemes();render();}});
}

/* ============================================================
   CROSS-TAB (row × col)  — Status×Channel, Trustee×Channel, Frequency×Status
   ============================================================ */
function renderCross(content,cfg){
  const rows=rowsFor(state.snap);
  const rk=cfg.rowKey;
  const rowKeys=(cfg.rowOrder||[...new Set(rows.map(rk))].filter(Boolean).sort());
  const isChannel=cfg.colKind==="channel";
  const colKeys=isChannel?["DDE","BATCH","PORTAL","BULK","OTHER"]:(cfg.colOrder||[]);
  const colMeas={DDE:"dde",BATCH:"batch",PORTAL:"portal",BULK:"bulk",OTHER:"other"};
  const colColor=c=>STATUS_COLORS[c]||({DDE:CH_COLORS.DDE,BATCH:CH_COLORS.BATCH,PORTAL:CH_COLORS.PORTAL,BULK:CH_COLORS.BULKUPLOAD,OTHER:CH_COLORS.OTHER}[c])||CAT[colKeys.indexOf(c)%8];
  const rowAgg=groupBy(rows,rk);
  let cellMap=null;
  if(!isChannel) cellMap=groupBy(rows,r=>rk(r)+""+cfg.colKey(r));
  const cellVal=(R,C)=> isChannel?((rowAgg.get(R)||{})[colMeas[C]]||0):((cellMap.get(R+""+C)||{}).bill||0);

  if(state.mode==="compare") return renderCrossCompare(content,cfg,rowKeys,isChannel);

  const cg=el("div","grid g2");content.appendChild(cg);
  const cA=card(cg,`${cfg.colLabel} mix per ${cfg.rowLabel}`,"Stacked");
  newBar(cA.canvas,{labels:rowKeys,indexAxis:"y",stacked:true,
    datasets:colKeys.map(C=>({label:C,data:rowKeys.map(R=>cellVal(R,C)),backgroundColor:colColor(C),stack:"s"})),legend:true});

  const hmVals=rowKeys.map(R=>colKeys.map(C=>({bill:cellVal(R,C)})));
  const hmCard=el("div","card span2");
  hmCard.innerHTML=`<div class="card-title"><h3>${cfg.rowLabel} × ${cfg.colLabel} — bills</h3><span class="hint">darker = more</span></div><div class="hm"></div>`;
  cg.appendChild(hmCard);
  heatmap($(".hm",hmCard),{rowKeys,colKeys,values:hmVals});

  content.appendChild(el("div","section-cap",`<h2>${cfg.rowLabel} × ${cfg.colLabel} — data</h2>`));
  const host=el("div");content.appendChild(host);
  const cols=[{key:"k",label:cfg.rowLabel.toUpperCase(),align:"left"}];
  for(const C of colKeys) cols.push({key:C,label:C,fmt:v=>fmt(v)});
  cols.push({key:"total",label:"Total",fmt:v=>fmt(v)});
  const trows=rowKeys.map(R=>{const o={k:R,total:colKeys.reduce((s,C)=>s+cellVal(R,C),0)};for(const C of colKeys)o[C]=cellVal(R,C);return o;});
  buildTable(host,{columns:cols,rows:trows,defaultSort:"total"});
}
function renderCrossCompare(content,cfg,rowKeys,isChannel){
  const rowsA=rowsFor(state.snapA),rowsB=rowsFor(state.snapB);
  const rk=cfg.rowKey;
  const totalAgg=rows=>{const m=groupBy(rows,rk);const o={};for(const R of rowKeys){const a=m.get(R)||blank();o[R]=isChannel?(a.dde+a.batch+a.portal+a.bulk+a.other):a.bill;}return o;};
  const A=totalAgg(rowsA),B=totalAgg(rowsB);
  const cg=el("div","grid g1");content.appendChild(cg);
  const cA=card(cg,`Δ total per ${cfg.rowLabel} · ${state.snapB}−${state.snapA}`,"Diverging from 0",null,KEY_DELTA);
  newBar(cA.canvas,{labels:rowKeys,indexAxis:"y",
    datasets:[{data:rowKeys.map(R=>(B[R]||0)-(A[R]||0)),backgroundColor:rowKeys.map(R=>((B[R]||0)-(A[R]||0))>=0?POS:NEG),maxBarThickness:22,borderRadius:3}]});
  content.appendChild(el("div","section-cap",`<h2>${cfg.rowLabel} — A vs B (totals)</h2>`));
  const host=el("div");content.appendChild(host);
  buildTable(host,{columns:[
    {key:"k",label:cfg.rowLabel.toUpperCase(),align:"left"},
    {key:"a",label:`Total · ${state.snapA}`,fmt:v=>fmt(v)},
    {key:"b",label:`Total · ${state.snapB}`,fmt:v=>fmt(v)},
    {key:"d",label:"Δ",fmt:v=>`<span class="${v>0?"delta-up":v<0?"delta-dn":"delta-flat"}">${signed(v)}</span>`},
  ],rows:rowKeys.map(R=>({k:R,a:A[R]||0,b:B[R]||0,d:(B[R]||0)-(A[R]||0)})),defaultSort:"d"});
}

/* ---- 15 Payment Outcome ---- */
function renderPaymentOutcome(content){
  const OUT=["FULLY_PAID","PARTIAL_PAID","OVERPAID","REFUND_OVERPAID","WAIVED"];
  const rows=rowsFor(state.snap);
  const paid=rows.filter(r=>OUT.includes(r.st));
  const cg=el("div","grid g2");content.appendChild(cg);
  const byS=groupBy(paid,r=>r.st);
  const cA=card(cg,"Payment outcome mix","Share of paid-outcome bills");
  newDoughnut(cA.canvas,{labels:OUT,data:OUT.map(s=>(byS.get(s)||{}).bill||0),colors:OUT.map(s=>statusColor(s))});
  const cB=card(cg,"Paid outcome over months","Stacked by outcome");
  newBar(cB.canvas,{labels:DATA.months,indexAxis:"x",stacked:true,
    datasets:OUT.map((s,i)=>({label:s,data:DATA.months.map(ym=>(groupBy(paid.filter(r=>r.ym===ym&&r.st===s),()=>0).get(0)||{}).bill||0),backgroundColor:statusColor(s),stack:"s"})),legend:true});
  content.appendChild(el("div","section-cap",`<h2>Payment outcome by scheme</h2>`));
  const host=el("div");content.appendChild(host);
  const perSch={};
  for(const r of paid){(perSch[r.sc]||(perSch[r.sc]={}))[r.st]=(perSch[r.sc][r.st]||0)+r.bill;}
  const schKeys=Object.keys(perSch).sort((a,b)=>(Object.values(perSch[b]).reduce((s,v)=>s+v,0))-(Object.values(perSch[a]).reduce((s,v)=>s+v,0)));
  const cols=[{key:"k",label:"SCHEME",align:"left",cls:()=>"sc"},...OUT.map(s=>({key:s,label:s,fmt:v=>fmt(v)})),{key:"total",label:"Paid total",fmt:v=>fmt(v)}];
  const trows=schKeys.map(sc=>{const o={k:sc};let t=0;for(const s of OUT){o[s]=perSch[sc][s]||0;t+=o[s];}o.total=t;return o;});
  buildTable(host,{columns:cols,rows:trows,defaultSort:"total",onRowClick:r=>{state.schemes=[r.k];syncSchemes();render();}});
}

/* ---- 16 Backlog & Pending ---- */
function renderBacklog(content){
  const PEND=["OPEN","PARTIAL_SUBMIT","SUBMITTED","APPROVED"];
  const rows=rowsFor(state.snap);
  const pend=rows.filter(r=>PEND.includes(r.st));
  const cg=el("div","grid g2");content.appendChild(cg);
  const cA=card(cg,"Pending bills by scheme","Backlog ranking");
  const schArr=ranked(groupBy(pend,r=>r.sc),{sortBy:"bill",topN:15,capOther:"Other"});
  newBar(cA.canvas,{labels:schArr.map(a=>a.k),indexAxis:"y",datasets:[{data:schArr.map(a=>a.bill),backgroundColor:schArr.map((_,i)=>i===0?SEQ[4]:SEQ[3]),maxBarThickness:20,borderRadius:3}]});
  const cB=card(cg,"Backlog composition","By pending status");
  newBar(cB.canvas,{labels:PEND,indexAxis:"x",datasets:[{data:PEND.map(s=>(groupBy(pend.filter(r=>r.st===s),()=>0).get(0)||{}).bill||0),backgroundColor:PEND.map(s=>statusColor(s)),maxBarThickness:54,borderRadius:4}]});
  const cC=card(cg,"Backlog over months","Pending bills per month");
  newLine(cC.canvas,{labels:DATA.months,datasets:[{label:"Pending",data:DATA.months.map(ym=>(groupBy(pend.filter(r=>r.ym===ym),()=>0).get(0)||{}).bill||0),borderColor:POS,pointBackgroundColor:POS}]});
  content.appendChild(el("div","section-cap",`<h2>Backlog by scheme</h2><p>Pending = OPEN + PARTIAL_SUBMIT + SUBMITTED + APPROVED (not yet paid).</p>`));
  const host=el("div");content.appendChild(host);
  const perSch={};for(const r of pend){(perSch[r.sc]||(perSch[r.sc]={}))[r.st]=(perSch[r.sc][r.st]||0)+r.bill;}
  const schKeys=Object.keys(perSch).sort((a,b)=>sum(perSch[b])-sum(perSch[a]));
  function sum(o){return PEND.reduce((s,k)=>s+(o[k]||0),0);}
  buildTable(host,{columns:[{key:"k",label:"SCHEME",align:"left",cls:()=>"sc"},...PEND.map(s=>({key:s,label:s,fmt:v=>fmt(v)})),{key:"total",label:"Pending",fmt:v=>fmt(v)}],
    rows:schKeys.map(sc=>{const o={k:sc};let t=0;for(const s of PEND){o[s]=perSch[sc][s]||0;t+=o[s];}o.total=t;return o;}),
    defaultSort:"total",onRowClick:r=>{state.schemes=[r.k];syncSchemes();render();}});
}

/* ---- 17 Completion Rate ---- */
function renderCompletion(content){
  const TERM=["CLOSED","FULLY_PAID","WAIVED","REFUND_OVERPAID"];
  const rows=rowsFor(state.snap);
  const arr=ranked(groupBy(rows,r=>r.sc),{sortBy:"bill"}).filter(a=>a.bill).map(a=>{
    a.completed=(groupBy(rows.filter(r=>r.sc===a.k&&TERM.includes(r.st)),()=>0).get(0)||{}).bill||0;
    a.compRate=a.bill?a.completed/a.bill:null;return a;});
  const rates=arr.map(a=>a.compRate||0).sort((a,b)=>a-b);
  const med=rates.length?rates[Math.floor(rates.length/2)]:0;
  const by=[...arr].sort((a,b)=>(b.compRate||0)-(a.compRate||0));
  const cg=el("div","grid g2");content.appendChild(cg);
  const cA=card(cg,"Completion rate by scheme (ranked)","terminal / total · median "+pct(med,0),null,KEY_MED);
  newBar(cA.canvas,{labels:by.map(a=>a.k),indexAxis:"y",pctScale:true,
    datasets:[{data:by.map(a=>a.compRate),backgroundColor:by.map(a=>(a.compRate>=med?POS:NEG)),maxBarThickness:16,borderRadius:3}]});
  const cB=card(cg,"Completion vs coverage","x=coverage, y=completion, dot=scheme",null,KEY_MED);
  const sc=window.Chart?new Chart(cB.canvas,{type:"scatter",
    data:{datasets:[{data:arr.map(a=>({x:a.coverage,y:a.compRate,sc:a.k})),backgroundColor:arr.map(a=>(a.compRate>=med?POS:NEG)),pointRadius:4,pointHoverRadius:6}]},
    options:baseOpts({scales:{x:{min:0,max:1,title:{display:true,text:"Coverage"},grid:{color:cssVar("--hairline")},ticks:{callback:v=>(v*100).toFixed(0)+"%"}},
      y:{min:0,max:1,title:{display:true,text:"Completion"},grid:{color:cssVar("--hairline")},ticks:{callback:v=>(v*100).toFixed(0)+"%"}}},
      plugins:{tooltip:{callbacks:{label:ctx=>{const d=ctx.raw;return` ${d.sc}: cov ${pct(d.x)} · comp ${pct(d.y)}`}}}}})}):null;
  if(sc)chartRegistry.push(sc);
  content.appendChild(el("div","section-cap",`<h2>Completion — data</h2><p>Completion = (CLOSED+FULLY_PAID+WAIVED+REFUND_OVERPAID) / bills. Median: <b>${pct(med)}</b>.</p>`));
  const host=el("div");content.appendChild(host);
  buildTable(host,{columns:[
    {key:"k",label:"SCHEME",align:"left",cls:()=>"sc"},
    {key:"bill",label:"Bills",fmt:v=>fmt(v)},
    {key:"completed",label:"Completed",fmt:v=>fmt(v)},
    {key:"compRate",label:"Completion %",fmt:v=>pct(v)},
    {key:"vs",label:"vs median",fmt:(v,r)=>{const d=(r.compRate||0)-med;const c=d>=0.05?"good":d<=-0.05?"crit":"serious";const ic=d>=0.05?"▲":d<=-0.05?"▼":"■";return `<span class="badge ${c}">${ic} ${pp(d)}</span>`;}},
  ],rows:by.map((a,i)=>({...a,rank:i+1})),onRowClick:r=>{state.schemes=[r.k];syncSchemes();render();}});
}

/* ---- 18 Outliers & Exceptions ---- */
function renderOutliers(content){
  const rows=rowsFor(state.snap);
  const arr=ranked(groupBy(rows,r=>r.sc),{sortBy:"bill"}).filter(a=>a.bill>=50);
  const stats=vals=>{const n=vals.length||1;const m=vals.reduce((s,v)=>s+v,0)/n;const sd=Math.sqrt(vals.reduce((s,v)=>s+(v-m)**2,0)/n)||0.0001;return{m,sd};};
  const ot=stats(arr.map(a=>a.ontimePct||0)), cv=stats(arr.map(a=>a.coverage||0));
  const flagged=arr.map(a=>({...a,otZ:ot.sd?((a.ontimePct||0)-ot.m)/ot.sd:0,cvZ:cv.sd?((a.coverage||0)-cv.m)/cv.sd:0,maxZ:0}))
    .map(a=>{a.maxZ=Math.max(Math.abs(a.otZ),Math.abs(a.cvZ));return a;})
    .filter(a=>a.maxZ>1).sort((x,y)=>y.maxZ-x.maxZ);
  const cg=el("div","grid g2");content.appendChild(cg);
  const cA=card(cg,"Exception schemes (|z|>1)","Ranked by deviation from peer mean",null,[{c:SEQ[4],t:"1–2σ"},{c:NEG,t:">2σ"}]);
  newBar(cA.canvas,{labels:flagged.map(a=>a.k),indexAxis:"y",
    datasets:[{data:flagged.map(a=>a.maxZ),backgroundColor:flagged.map(a=>a.maxZ>2?NEG:SEQ[4]),maxBarThickness:18,borderRadius:3}]});
  const cB=card(cg,"On-time rate vs mean","Lines = ±1σ band",null,[{c:NEG,t:"outlier (>1σ)"},{c:cssVar("--muted"),t:"normal"}]);
  const all=ranked(groupBy(rows,r=>r.sc),{sortBy:"bill"}).filter(a=>a.bill>=50);
  const sc=window.Chart?new Chart(cB.canvas,{type:"scatter",
    data:{datasets:[{data:all.map(a=>({x:a.bill,y:a.ontimePct,sc:a.k})),backgroundColor:all.map(a=>flagged.some(f=>f.k===a.k)?NEG:cssVar("--muted")),pointRadius:all.map(a=>flagged.some(f=>f.k===a.k)?5:3),pointHoverRadius:6}]},
    options:baseOpts({scales:{x:{title:{display:true,text:"Bills"},grid:{color:cssVar("--hairline")},ticks:{callback:v=>fmt(v)}},
      y:{min:0,max:1,title:{display:true,text:"On-time %"},grid:{color:cssVar("--hairline")},ticks:{callback:v=>(v*100).toFixed(0)+"%"}}},
      plugins:{tooltip:{callbacks:{label:ctx=>{const d=ctx.raw;return` ${d.sc}: ${fmt(d.x)} bills · ${pct(d.y)}`}}}}})}):null;
  if(sc)chartRegistry.push(sc);
  content.appendChild(el("div","section-cap",`<h2>Exception watchlist</h2><p>Schemes (≥50 bills) deviating &gt;1σ from the peer mean on on-time rate or coverage. Red = &gt;2σ.</p>`));
  const host=el("div");content.appendChild(host);
  buildTable(host,{columns:[
    {key:"k",label:"SCHEME",align:"left",cls:()=>"sc"},
    {key:"bill",label:"Bills",fmt:v=>fmt(v)},
    {key:"ontimePct",label:"On-time %",fmt:v=>pct(v)},
    {key:"otZ",label:"OT z-score",fmt:v=>(v>=0?"+":"")+v.toFixed(2)},
    {key:"coverage",label:"Coverage %",fmt:v=>pct(v)},
    {key:"cvZ",label:"Cov z-score",fmt:v=>(v>=0?"+":"")+v.toFixed(2)},
    {key:"flag",label:"Flag",fmt:(v,r)=>{const f=Math.abs(r.otZ)>Math.abs(r.cvZ)?("on-time "+(r.otZ<0?"low":"high")):("coverage "+(r.cvZ<0?"low":"high"));const c=r.maxZ>2?"crit":"serious";return `<span class="badge ${c}">${f}</span>`;}},
  ],rows:flagged,onRowClick:r=>{state.schemes=[r.k];syncSchemes();render();}});
}

/* ---- 19 Volume Tiers ---- */
function renderVolumeTiers(content){
  const rows=rowsFor(state.snap);
  const sch=ranked(groupBy(rows,r=>r.sc),{sortBy:"bill"}).filter(a=>a.bill);
  const asc=[...sch].sort((a,b)=>a.bill-b.bill);
  const q=Math.max(1,Math.ceil(asc.length/5));
  const tierOf={};asc.forEach((a,i)=>{tierOf[a.k]=Math.min(4,Math.floor(i/q));});
  const TN=["XS","S","M","L","XL"];
  const tiers=[0,1,2,3,4].map(t=>{const ts=sch.filter(a=>tierOf[a.k]===t);const o=blank();for(const a of ts)add(o,a);totals(o);o.name=TN[t];o.schemes=ts.length;o.min=ts.length?Math.min(...ts.map(x=>x.bill)):0;o.max=ts.length?Math.max(...ts.map(x=>x.bill)):0;return o;}).filter(t=>t.schemes>0);
  const cg=el("div","grid g2");content.appendChild(cg);
  const cA=card(cg,"Bills by volume tier","Schemes bucketed by 6-mo bill volume");
  newBar(cA.canvas,{labels:tiers.map(t=>t.name),indexAxis:"x",datasets:[{data:tiers.map(t=>t.bill),backgroundColor:tiers.map((_,i)=>SEQ[Math.min(SEQ.length-1,2+i)]),maxBarThickness:60,borderRadius:4}]});
  const cB=card(cg,"On-time & coverage by tier","Does scale predict quality?");
  newBar(cB.canvas,{labels:tiers.map(t=>t.name),indexAxis:"x",pctScale:true,datasets:[
    {label:"On-time %",data:tiers.map(t=>t.ontimePct),backgroundColor:POS,borderRadius:3},
    {label:"Coverage %",data:tiers.map(t=>t.coverage),backgroundColor:CAT[1],borderRadius:3}],legend:true});
  content.appendChild(el("div","section-cap",`<h2>Volume tiers — data</h2><p>Schemes split into 5 equal-count tiers by total bills (XS…XL).</p>`));
  const host=el("div");content.appendChild(host);
  buildTable(host,{columns:[
    {key:"name",label:"TIER",align:"left"},
    {key:"schemes",label:"Schemes",fmt:v=>v},
    {key:"bill",label:"Bills",fmt:v=>fmt(v)},
    {key:"range",label:"Bill range",fmt:(v,r)=>fmt(r.min)+"–"+fmt(r.max)},
    {key:"ontimePct",label:"On-time %",fmt:v=>pct(v)},
    {key:"coverage",label:"Coverage %",fmt:v=>pct(v)},
  ],rows:tiers.map(t=>({...t,range:t.min+"-"+t.max}))});
}

/* ---- 20 Trustee Portfolio ---- */
function renderTrusteePortfolio(content){
  const rows=rowsFor(state.snap);
  const trArr=ranked(groupBy(rows,r=>r.tr),{sortBy:"bill"});
  const data=trArr.map(a=>{const sub=groupBy(rows.filter(r=>r.tr===a.k),r=>r.sc);const schs=ranked(sub,{sortBy:"bill"});const top=schs[0]||{k:"-",bill:0};return {...a,schemes:schs.length,topScheme:top.k,topShare:a.bill?top.bill/a.bill:0};});
  const cg=el("div","grid g2");content.appendChild(cg);
  const cA=card(cg,"Schemes per trustee","Portfolio breadth");
  newBar(cA.canvas,{labels:data.map(a=>a.k),indexAxis:"y",datasets:[{data:data.map(a=>a.schemes),backgroundColor:SEQ[3],maxBarThickness:18,borderRadius:3}]});
  const cB=card(cg,"Top-scheme concentration per trustee","Share of bills from each trustee's #1 scheme");
  newBar(cB.canvas,{labels:data.map(a=>a.k),indexAxis:"y",pctScale:true,datasets:[{data:data.map(a=>a.topShare),backgroundColor:data.map(a=>a.topShare>=0.5?POS:SEQ[2]),maxBarThickness:18,borderRadius:3}]});
  content.appendChild(el("div","section-cap",`<h2>Trustee portfolio — data</h2><p>Concentration = share of a trustee's bills from its single largest scheme.</p>`));
  const host=el("div");content.appendChild(host);
  buildTable(host,{columns:[
    {key:"k",label:"TRUSTEE",align:"left"},
    {key:"schemes",label:"Schemes",fmt:v=>v},
    {key:"bill",label:"Bills",fmt:v=>fmt(v)},
    {key:"ontimePct",label:"On-time %",fmt:v=>pct(v)},
    {key:"coverage",label:"Coverage %",fmt:v=>pct(v)},
    {key:"topScheme",label:"Top scheme",align:"left",cls:()=>"sc",fmt:v=>v},
    {key:"topShare",label:"Concentration %",fmt:v=>pct(v)},
  ],rows:data,onRowClick:r=>{state.schemes=[r.k];syncSchemes();render();}});
}

/* ============================================================
   Settings — app preferences (display, navigation, theme, data info)
   All choices persist in localStorage under moneyin.* keys so
   the next session restores them. "Reset all preferences" wipes
   every moneyin.* key. No settings here mutate the underlying
   data — those live in scripts/build_data.py.
   Uses an in-page sub-tab strip (Display / Navigation / Theme /
   Dataset / About); each section is a scroll target.
   ============================================================ */
