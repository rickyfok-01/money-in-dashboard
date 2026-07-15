"use strict";
function renderPendTagging(content){
  // Inherits the standard filter bar from the page masthead (Snapshot,
  // Compare A/B, Scheme multi-select, Month from/to, Mode toggle).
  if(state.mode==="compare") return renderPendTaggingCompare(content);
  if(state.mode==="trend")   return renderPendTaggingTrend(content);
  return renderPendTaggingCurrent(content);
}

/* Build the (scheme × period × snap) row set for a single snapshot.
   Returns a map keyed by "scheme|ym" -> { scheme, trustee, ym, a, b, rec }. */
function pendSchemeRows(snap, schemeSet){
  const map=new Map();
  const trusteeSet=new Set(state.trustees);
  DATA.rows.forEach(r=>{
    if(r.s!==snap) return;
    if(!schemeSet.has(r.sc)) return;
    if(!trusteeSet.has(r.tr)) return;
    if(r.ym<state.mfrom || r.ym>state.mto) return;
    const k=r.sc+"|"+r.ym;
    let m=map.get(k);
    if(!m){m={scheme:r.sc,trustee:r.tr,ym:r.ym,a:0,b:0,rec:0};map.set(k,m);}
    m.a += r.a||0; m.b += r.b||0; m.rec += r.bill||0;
  });
  return map;
}

function pendAllPeriods(){
  return DATA.months.filter(ym=>ym>=state.mfrom && ym<=state.mto);
}

/* ---- Current view: 3 trend tiles + bar chart of pending by scheme + the
   two-snapshot comparison table. The "Latest" snapshot is the active
   `state.snap`; for a single-snapshot view the "Earlier" group is the same
   snapshot (so the table still shows the full Latest · Earlier column pair
   with identical values, matching the spec's two-snapshot comparison
   framing). */
function renderPendTaggingCurrent(content){
  const snap=state.snap;
  const schemeSet=new Set(state.schemes);
  const periods=pendAllPeriods();
  const rows=pendSchemeRows(snap,schemeSet);
  // per-scheme aggregation for the chart (across all visible periods)
  const perScheme=new Map();
  rows.forEach(r=>{
    let m=perScheme.get(r.scheme);
    if(!m){m={scheme:r.scheme,trustee:r.trustee,a:0,b:0};perScheme.set(r.scheme,m);}
    m.a+=r.a; m.b+=r.b;
  });
  const schArr=[...perScheme.values()].sort((a,b)=>b.b-a.b);

  // 3-tile strip · A / B / % Pending
  const totalA=schArr.reduce((s,x)=>s+x.a,0);
  const totalB=schArr.reduce((s,x)=>s+x.b,0);
  const pctP=totalA?totalB/totalA*100:0;
  const tt=tone(pctP);

  const strip=el("div","pend-strip");
  strip.innerHTML=
    `<div class="pend-tile"><div class="pend-lab">ERs Submitted (A)</div>
       <div class="pend-val mono">${I9(totalA)}</div>
       <div class="pend-foot">${state.schemes.length>=DATA.schemes.length?"all schemes":state.schemes.length+" of "+DATA.schemes.length+" schemes"}</div></div>
     <div class="pend-tile"><div class="pend-lab">Pending Tagging (B)</div>
       <div class="pend-val mono pend-b-emph">${I9(totalB)}</div>
       <div class="pend-foot">${totalA?`${pctP.toFixed(1)}% of submitted`:'—'}</div></div>
     <div class="pend-tile"><div class="pend-lab">% Pending (B / A)</div>
       <div class="pend-val mono">${totalA?pctP.toFixed(1)+"%":"—"}</div>
       <div class="pend-foot"><span class="pend-dot" style="background:${toneHex(tt)}"></span>${tt} · ≤30% green, ≤50% yellow, &gt;50% red</div></div>`;
  content.appendChild(strip);

  // chart grid: pending by scheme (top 12) + trend strip over months
  const cg=el("div","grid g2");
  content.appendChild(cg);

  const top12=schArr.slice(0,12);
  const cBar=card(cg,"Pending Tagging (B) by scheme","Top 12 by B · current snapshot",
    null,[{c:NEG,t:"Pending (B)"}]);
  newBar(cBar.canvas,{labels:top12.map(a=>a.scheme),indexAxis:"y",
    datasets:[{data:top12.map(a=>a.b),backgroundColor:top12.map(()=>NEG),
      maxBarThickness:18,borderRadius:3}]});

  // trend chart of A & B across the visible months (single-snapshot scope)
  const monthAgg=ym=>{
    let a=0,b=0;
    rows.forEach(r=>{ if(r.ym===ym){ a+=r.a; b+=r.b; } });
    return {a,b};
  };
  const aSer=periods.map(m=>monthAgg(m).a);
  const bSer=periods.map(m=>monthAgg(m).b);
  const cTrend=card(cg,"ERs Submitted (A) & Pending (B) over months","Snapshot "+state.snap);
  newLine(cTrend.canvas,{labels:periods.map(R9),legend:true,datasets:[
    {label:"A — Submitted",data:aSer,borderColor:"#d97706",backgroundColor:"rgba(217,119,6,.12)",fill:true},
    {label:"B — Pending",   data:bSer,borderColor:NEG,backgroundColor:"rgba(227,73,72,.10)",fill:true},
  ]});

  // Detail table — Contribution Pend Tagging by Scheme (full Latest + Earlier)
  // "Latest" = active snapshot (state.snap). "Earlier" = the snapshot immediately
  // before Latest in DATA.snapshots. Falls back to mirroring Latest when no
  // earlier snapshot exists, so the two-snapshot layout is always preserved.
  const idx=DATA.snapshots.indexOf(snap);
  const snapA=idx>0 ? DATA.snapshots[idx-1] : snap;
  const snapB=snap;
  const rowsA=pendSchemeRows(snapA,schemeSet);
  content.appendChild(el("div","section-cap",
    `<h2>Contribution Pend Tagging by Scheme</h2>
     <p>ER-submitted (A) and Pending-Tagging (B) per (scheme × period). Latest uses snapshot <b>${snapB}</b>; Earlier uses snapshot <b>${snapA}</b>.</p>`));
  const tableHost=el("div");content.appendChild(tableHost);
  renderPendTable(tableHost,{snapA,snapB,periods,rows,rowsA,schemeSet});
}

function renderPendTaggingCompare(content){
  // Two-snapshot comparison: a separate table panel + Δ KPI strip.
  const schemeSet=new Set(state.schemes);
  const periods=pendAllPeriods();
  const rowsA=pendSchemeRows(state.snapA,schemeSet);
  const rowsB=pendSchemeRows(state.snapB,schemeSet);

  // combined "built" set: union of (scheme × period) keys
  const built=[];
  const seen=new Set();
  [...rowsA.keys(),...rowsB.keys()].forEach(k=>{
    if(seen.has(k))return; seen.add(k);
    const [scheme,ym]=k.split("|");
    const a=rowsA.get(k)||{scheme,ym,a:0,b:0,trustee:rowsB.get(k).trustee};
    const b=rowsB.get(k)||{scheme,ym,a:0,b:0,trustee:a.trustee};
    if(a.a===0&&a.b===0&&b.a===0&&b.b===0)return;  // SPEC §2.2 skip all-zero
    built.push({scheme,trustee:a.trustee||b.trustee,ym,eo:a,lo:b});
  });
  // sort by scheme then period for stability
  built.sort((x,y)=> x.scheme===y.scheme ? x.ym.localeCompare(y.ym) : x.scheme.localeCompare(y.scheme));

  const sumA=built.reduce((s,r)=>({a:s.a+r.eo.a,b:s.b+r.eo.b}),{a:0,b:0});
  const sumB=built.reduce((s,r)=>({a:s.a+r.lo.a,b:s.b+r.lo.b}),{a:0,b:0});
  const pctA=sumA.a?sumA.b/sumA.a*100:0;
  const pctB=sumB.a?sumB.b/sumB.a*100:0;
  const dpct=pctB-pctA;

  // KPI strip · Δ between snapshots
  const strip=el("div","pend-strip");
  const dt=(v,isPct)=> (v>0?"+":v<0?"−":"") + (isPct?Math.abs(v).toFixed(1)+" pp":I9(Math.abs(v)));
  const dcls=v=>v>0?"up":v<0?"dn":"flat";
  strip.innerHTML=
    `<div class="pend-tile"><div class="pend-lab">Δ ERs Submitted (A)</div>
       <div class="pend-val mono">${dt(sumB.a-sumA.a)}</div>
       <div class="pend-foot ${dcls(sumB.a-sumA.a)}">${state.snapA} → ${state.snapB}</div></div>
     <div class="pend-tile"><div class="pend-lab">Δ Pending Tagging (B)</div>
       <div class="pend-val mono pend-b-emph">${dt(sumB.b-sumA.b)}</div>
       <div class="pend-foot ${dcls(sumB.b-sumA.b)}">${state.snapA} → ${state.snapB}</div></div>
     <div class="pend-tile"><div class="pend-lab">Δ % Pending (B / A)</div>
       <div class="pend-val mono">${dt(dpct,true)}</div>
       <div class="pend-foot ${dcls(dpct)}">${state.snapA} → ${state.snapB}</div></div>`;
  content.appendChild(strip);

  // chart grid: Δ pending by scheme (top 12)
  const cg=el("div","grid g2");content.appendChild(cg);
  const bySc=new Map();
  built.forEach(r=>{
    let m=bySc.get(r.scheme);
    if(!m){m={scheme:r.scheme,dB:r.lo.b-r.eo.b};bySc.set(r.scheme,m);}
    else m.dB += r.lo.b-r.eo.b;
  });
  const scArr=[...bySc.values()].sort((a,b)=>Math.abs(b.dB)-Math.abs(a.dB)).slice(0,12);
  const cDlt=card(cg,"Δ Pending (B) by scheme",`${state.snapB} − ${state.snapA}`,null,KEY_DELTA);
  newBar(cDlt.canvas,{labels:scArr.map(a=>a.scheme),indexAxis:"y",
    datasets:[{data:scArr.map(a=>a.dB),backgroundColor:scArr.map(a=>a.dB>=0?NEG:POS),
      maxBarThickness:18,borderRadius:3}]});

  // trend lines: A & B across snapshots
  const snaps=DATA.snapshots;
  const aSer=snaps.map(s=>{
    const m=pendSchemeRows(s,schemeSet);
    let a=0,b=0; m.forEach(r=>{a+=r.a;b+=r.b;}); return a;
  });
  const bSer=snaps.map(s=>{
    const m=pendSchemeRows(s,schemeSet);
    let a=0,b=0; m.forEach(r=>{a+=r.a;b+=r.b;}); return b;
  });
  const cTrend=card(cg,"A & B over snapshots","A and B totals across the loaded snapshots",
    null,[{c:"#d97706",t:"A — Submitted"},{c:NEG,t:"B — Pending"}]);
  newLine(cTrend.canvas,{labels:snaps.map(s=>s.slice(4,6)+"-"+s.slice(6,8)),legend:true,datasets:[
    {label:"A — Submitted",data:aSer,borderColor:"#d97706",backgroundColor:"rgba(217,119,6,.12)",fill:true},
    {label:"B — Pending",   data:bSer,borderColor:NEG,backgroundColor:"rgba(227,73,72,.10)",fill:true},
  ]});

  content.appendChild(el("div","section-cap",
    `<h2>Contribution Pend Tagging by Scheme</h2>
     <p>Two-snapshot comparison · Earlier (${state.snapA}) → Latest (${state.snapB}).</p>`));
  const tableHost=el("div");content.appendChild(tableHost);
  renderPendTableCompare(tableHost,{built,periods,schemeSet,snapA:state.snapA,snapB:state.snapB});
}

function renderPendTaggingTrend(content){
  // Trend mode: A and B lines per scheme across months, plus a top-schemes
  // table that uses the latest month as the "current" anchor.
  const schemeSet=new Set(state.schemes);
  const periods=pendAllPeriods();

  // KPI strip · totals over the 6-month window
  let totA=0,totB=0;
  const perSchMonth=new Map();  // scheme -> {a:[], b:[]}
  const perSchTot=new Map();
  const trusteeSet=new Set(state.trustees);
  DATA.rows.forEach(r=>{
    if(!schemeSet.has(r.sc)) return;
    if(!trusteeSet.has(r.tr)) return;
    if(r.ym<state.mfrom || r.ym>state.mto) return;
    let m=perSchMonth.get(r.sc);
    if(!m){m={a:new Array(periods.length).fill(0),b:new Array(periods.length).fill(0),trustee:r.tr};
      perSchMonth.set(r.sc,m);}
    let tot=perSchTot.get(r.sc);
    if(!tot){tot={a:0,b:0,trustee:r.tr};perSchTot.set(r.sc,tot);}
    const i=periods.indexOf(r.ym);
    if(i>=0){m.a[i]+=r.a||0; m.b[i]+=r.b||0;}
    tot.a+=r.a||0; tot.b+=r.b||0;
    totA+=r.a||0; totB+=r.b||0;
  });
  const pctP=totA?totB/totA*100:0;
  const tt=tone(pctP);
  const strip=el("div","pend-strip");
  strip.innerHTML=
    `<div class="pend-tile"><div class="pend-lab">Total A (${periods.length}mo)</div>
       <div class="pend-val mono">${I9(totA)}</div>
       <div class="pend-foot">across ${schemeSet.size} schemes</div></div>
     <div class="pend-tile"><div class="pend-lab">Total B (${periods.length}mo)</div>
       <div class="pend-val mono pend-b-emph">${I9(totB)}</div>
       <div class="pend-foot">${pctP.toFixed(1)}% of submitted</div></div>
     <div class="pend-tile"><div class="pend-lab">% Pending (B / A)</div>
       <div class="pend-val mono">${pctP.toFixed(1)}%</div>
       <div class="pend-foot"><span class="pend-dot" style="background:${toneHex(tt)}"></span>${tt} tone</div></div>`;
  content.appendChild(strip);

  // chart: A and B over months, top 6 schemes by total B
  const top=[...perSchTot.entries()].sort((a,b)=>b[1].b-a[1].b).slice(0,6);
  const palette=["#2a78d6","#1baf7a","#eda100","#008300","#4a3aa7","#e34948"];
  const cg=el("div","grid g2");
  content.appendChild(cg);
  const cTrend=card(cg,"Pending Tagging (B) over months","Top 6 schemes by total B",
    null, top.map(([sc],i)=>({c:palette[i%6],t:sc})));
  const datasets=top.map(([sc],i)=>({
    label:sc,
    data:(perSchMonth.get(sc)||{b:[]}).b,
    borderColor:palette[i%6], backgroundColor:palette[i%6]+"22",
    pointBackgroundColor:palette[i%6], fill:false
  }));
  newLine(cTrend.canvas,{labels:periods.map(R9),legend:true,datasets});

  // second chart: % Pending over months for the same top 6
  const cPct=card(cg,"% Pending (B / A) over months","Top 6 schemes · target line at 50%",
    null,[{c:"#16a34a",t:"≤30% green"},{c:"#f59e0b",t:"≤50% yellow"},{c:"#ef4444",t:">50% red"}]);
  const pctDS=top.map(([sc],i)=>{
    const m=perSchMonth.get(sc)||{a:[],b:[]};
    return {label:sc,data:m.a.map((a,j)=>a?m.b[j]/a*100:0),
      borderColor:palette[i%6], pointBackgroundColor:palette[i%6], backgroundColor:palette[i%6]+"18", fill:false};
  });
  newLine(cPct.canvas,{labels:periods.map(R9),legend:true,datasets:pctDS,pctScale:true,target:50});

  content.appendChild(el("div","section-cap",
    `<h2>Contribution Pend Tagging by Scheme</h2>
     <p>Latest month as the anchor; Earlier = the month prior. Two-snapshot layout preserved.</p>`));
  const tableHost=el("div");content.appendChild(tableHost);
  // Use the last visible month as "Latest", the prior one as "Earlier".
  const lastIdx=periods.length-1;
  if(lastIdx<=0){
    tableHost.innerHTML=`<div class="pend-empty">Not enough months for a two-snapshot view.</div>`;
    return;
  }
  const snapA=periods[lastIdx-1], snapB=periods[lastIdx];
  // Build a synthetic single-snapshot "row map" per (scheme,ym) from
  // the data rows of the matching snapshot, then call the standard
  // single-snapshot renderer.
  function mapFor(ym){
    const m=new Map();
    DATA.rows.forEach(r=>{
      if(r.s!==state.snap)return;
      if(!schemeSet.has(r.sc))return;
      if(!trusteeSet.has(r.tr))return;
      if(r.ym!==ym)return;
      const k=r.sc+"|"+r.ym;
      let x=m.get(k);
      if(!x){x={scheme:r.sc,trustee:r.tr,ym:r.ym,a:0,b:0};m.set(k,x);}
      x.a+=r.a||0; x.b+=r.b||0;
    });
    return m;
  }
  // Build a single combined row set (just for the period(s) in question)
  const combined=new Map();
  function absorb(src,kind){
    src.forEach(v=>{
      const k=v.scheme+"|"+v.ym;
      let cur=combined.get(k);
      if(!cur){cur={scheme:v.scheme,trustee:v.trustee,ym:v.ym};combined.set(k,cur);}
      cur[kind+"A"]=v.a; cur[kind+"B"]=v.b;
    });
  }
  absorb(mapFor(snapA),"e"); absorb(mapFor(snapB),"l");
  // Re-key the rows the table renderer expects: eo / lo objects.
  const built=[...combined.values()].map(r=>({
    scheme:r.scheme,trustee:r.trustee,ym:r.ym,
    eo:{a:r.eA||0,b:r.eB||0},
    lo:{a:r.lA||0,b:r.lB||0}
  })).filter(r=>!(r.eo.a===0&&r.eo.b===0&&r.lo.a===0&&r.lo.b===0))
    .sort((x,y)=> x.scheme===y.scheme ? x.ym.localeCompare(y.ym) : x.scheme.localeCompare(y.scheme));
  renderPendTableCompare(tableHost,{built,periods:[snapA,snapB],schemeSet,snapA,snapB});
}

/* ---- Table renderers (per SPEC §3) ---- */
// Standard two-column-group table (Latest · Earlier) where both groups are
// computed from independent row maps.
function renderPendTable(host,{snapA,snapB,periods,rows,rowsA,schemeSet}){
  // "Current" view: Latest is the active snapshot, Earlier is the previous
  // snapshot (rowsA supplied independently). When Earlier is the same snapshot
  // as Latest (no earlier snapshot available) we mirror Latest into Earlier.
  const aRows=rowsA || (snapA===snapB ? rows : pendSchemeRows(snapA,schemeSet));
  const lRows=rows;
  // Build the (scheme × period) row set in the natural sort order.
  const built=[];
  const seen=new Set();
  [...lRows.keys(),...aRows.keys()].forEach(k=>{
    if(seen.has(k))return; seen.add(k);
    const [scheme,ym]=k.split("|");
    const a=aRows.get(k)||{a:0,b:0,trustee:lRows.get(k).trustee};
    const l=lRows.get(k)||{a:0,b:0,trustee:a.trustee};
    if(a.a===0&&a.b===0&&l.a===0&&l.b===0)return;
    built.push({scheme,trustee:a.trustee||l.trustee,ym,eo:a,lo:l});
  });
  built.sort((x,y)=> x.scheme===y.scheme ? x.ym.localeCompare(y.ym) : x.scheme.localeCompare(y.scheme));
  if(!built.length){
    host.innerHTML=`<div class="pend-empty">No rows match the current filter.</div>`;
    return;
  }
  const isSingle=snapA===snapB;
  drawPendTable(host,{built,latestLabel:`${snapB} · ${R9(periods[periods.length-1]||"")}`,earlierLabel:isSingle?"same as Latest":`${snapA} · ${R9(periods[0]||"")}`,showGroupColors:!isSingle});
}

function renderPendTableCompare(host,{built,periods,schemeSet,snapA,snapB}){
  if(!built.length){
    host.innerHTML=`<div class="pend-empty">No rows match the current filter.</div>`;
    return;
  }
  const last=periods[periods.length-1]||"";
  const first=periods[0]||"";
  const aSnapLabel=snapA?`${snapA} · ${R9(first)}`:R9(first);
  const bSnapLabel=snapB?`${snapB} · ${R9(last)}`:R9(last);
  drawPendTable(host,{built,latestLabel:bSnapLabel,earlierLabel:aSnapLabel,showGroupColors:true});
}

function drawPendTable(host,{built,latestLabel,earlierLabel,showGroupColors}){
  // Group by scheme; compute rowspan for the first cell of each scheme.
  const groups=[];
  built.forEach(r=>{
    const last=groups[groups.length-1];
    if(last && last.scheme===r.scheme) last.rows.push(r);
    else groups.push({scheme:r.scheme,rows:[r]});
  });
  // Per-scheme "first-row A" base for progress bar (Latest group + Earlier group)
  groups.forEach(g=>{
    g.baseLatest=g.rows[0].lo.a||0;
    g.baseEarlier=g.rows[0].eo.a||0;
    g.trustee=g.rows[0].trustee;
  });

  // Build table
  const wrap=el("div","pend-table-wrap");
  const tbl=el("table","pend");
  tbl.innerHTML=`
    <colgroup>
      <col class="c-scheme"><col class="c-period">
      <col class="c-num"><col class="c-num"><col class="c-num">
      <col class="c-num"><col class="c-num"><col class="c-num">
    </colgroup>
    <thead>
      <tr>
        <th class="c-scheme-th l grp-head" rowspan="2">Scheme</th>
        <th class="c-period-th l grp-head" rowspan="2">Contribution period</th>
        <th class="grp-head grp-latest" colspan="3">Latest · ${latestLabel}</th>
        <th class="grp-head grp-earlier" colspan="3">Earlier · ${earlierLabel}</th>
      </tr>
      <tr>
        <th class="grp-latest l">ER submitted (A)</th>
        <th class="grp-latest">Pending (B)</th>
        <th class="grp-latest">% Pending</th>
        <th class="grp-earlier l">ER submitted (A)</th>
        <th class="grp-earlier">Pending (B)</th>
        <th class="grp-earlier">% Pending</th>
      </tr>
    </thead>
    <tbody></tbody>
    <tfoot></tfoot>`;
  host.innerHTML="";
  host.appendChild(wrap);
  wrap.appendChild(tbl);
  const tbody=tbl.querySelector("tbody");
  const tfoot=tbl.querySelector("tfoot");

  // Render body — one tr per (scheme × period) row
  groups.forEach(g=>{
    g.rows.forEach((r,idx)=>{
      const tr=document.createElement("tr");
      const schemeHTML=idx===0
        ? `<td class="scheme-cell" rowspan="${g.rows.length}">
             <span class="scheme-name">${g.scheme}</span>
             <span class="trustee-name">${g.trustee||""}</span>
           </td>` : "";
      tr.innerHTML=
        schemeHTML +
        `<td class="period-cell">${R9(r.ym)}</td>` +
        pendACell(r.lo.a,g.baseLatest) +
        pendBCell(r.lo.b) +
        pendPctCell(r.lo.b,r.lo.a) +
        pendACell(r.eo.a,g.baseEarlier) +
        pendBCell(r.eo.b) +
        pendPctCell(r.eo.b,r.eo.a);
      tbody.appendChild(tr);
    });
  });

  // Footer total row
  const totA=built.reduce((s,r)=>({a:s.a+r.lo.a,b:s.b+r.lo.b}),{a:0,b:0});
  const totE=built.reduce((s,r)=>({a:s.a+r.eo.a,b:s.b+r.eo.b}),{a:0,b:0});
  const pctA=totA.a?totA.b/totA.a*100:0;
  const pctE=totE.a?totE.b/totE.a*100:0;
  const tA=tone(pctA), tE=tone(pctE);
  tfoot.innerHTML=
    `<tr>
       <td class="l">Total</td>
       <td class="l">${built.length} rows</td>
       ${pendTotalACell(totA.a)} ${pendTotalBCell(totA.b)} ${pendTotalPctCell(pctA,tA)}
       ${pendTotalACell(totE.a)} ${pendTotalBCell(totE.b)} ${pendTotalPctCell(pctE,tE)}
     </tr>`;
  void showGroupColors;  // (kept for parity; group shading is always applied)
}

function pendACell(value,base){
  const pctNum=base?Math.max(0,Math.min(100,value/base*100)):0;
  return `<td><div class="pend-a">
    <span class="pend-a-text"><span>${I9(value)}</span><span class="pend-a-pct">${base?pctNum.toFixed(1)+"%":"—"}</span></span>
    <span class="pend-a-bar"><i style="width:${pctNum.toFixed(1)}%"></i></span>
  </div></td>`;
}
function pendBCell(value){
  return `<td class="pend-b">${I9(value)}</td>`;
}
function pendPctCell(b,a){
  if(!a) return `<td><div class="pend-pct"><span>—</span></div></td>`;
  const pct=b/a*100;
  const tt=tone(pct);
  return `<td><div class="pend-pct">
    <span class="pend-dot" style="background:${toneHex(tt)}"></span>
    <span>${pct.toFixed(1)}%</span>
  </div></td>`;
}
function pendTotalACell(a){ return `<td>${I9(a)}</td>`; }
function pendTotalBCell(b){ return `<td class="pend-b">${I9(b)}</td>`; }
function pendTotalPctCell(pct,tt){
  if(!pct&&pct!==0) return `<td><div class="pend-pct"><span>—</span></div></td>`;
  if(!isFinite(pct)) return `<td><div class="pend-pct"><span>—</span></div></td>`;
  return `<td><div class="pend-pct">
    <span class="pend-dot" style="background:${toneHex(tt)}"></span>
    <span>${pct.toFixed(1)}%</span>
  </div></td>`;
}

/* ============================================================
   Money Allocation (Overview tab) — SPEC_money_allocation_by_scheme.md
   Payment allocation driven by DATA.pym (con-pym-6mon-*.csv):
   PAY_AMT / AVAIL_AMOUNT per (scheme × month × snapshot).
   ALLOC% = Pay ÷ (Pay + Avail). Matrix-only anatomy: a control bar
   — snapshot selector(s) + Scheme ⇄ Trustee toggle on the LEFT, a
   Current/Compare switch on the RIGHT — above a single matrix table.
   The on-tab Current/Compare switch IS this tab's mode control (the
   global Compare/Trend toggle is hidden here; Trend was removed).
   Compare shows two snapshot selectors (default latest & latest−1)
   and adds pre ALLOC% + change % columns after each ALLOC%.
   ============================================================ */
const allocOf=(pay,avail)=>{const p=Number(pay)||0,a=Number(avail)||0;return (p+a)>0?p/(p+a):null;};
const allocTone=pct=>pct==null?null:(pct>=98?"green":pct>=95?"yellow":"red");
const money=v=>{if(v==null||isNaN(v))return "—";const a=Math.abs(Number(v)),s=Number(v)<0?"−":"";if(a>=1e9)return s+"$"+(a/1e9).toFixed(2)+"B";if(a>=1e6)return s+"$"+(a/1e6).toFixed(1)+"M";if(a>=1e3)return s+"$"+(a/1e3).toFixed(1)+"K";return s+"$"+Math.round(a);};
function pymSnap(snap){return (DATA.pym&&DATA.pym.snapshots.includes(snap))?snap:(DATA.pym.snapshots[DATA.pym.snapshots.length-1]||snap);}
function pymFilter(snap){const ss=new Set(state.schemes),ts=new Set(state.trustees);return DATA.pym.rows.filter(r=>r.s===snap&&r.ym>=state.mfrom&&r.ym<=state.mto&&ss.has(r.sc)&&ts.has(r.tr));}
function pymAggregate(snap,by){ /* by: "sc" | "tr" */
  const months=DATA.pym.months.filter(m=>m>=state.mfrom&&m<=state.mto);
  const keyOf=by==="tr"?(r=>r.tr):(r=>r.sc);
  const map=new Map();
  for(const r of pymFilter(snap)){const k=keyOf(r);if(!k)continue;let g=map.get(k);if(!g){g={k,months:{}};map.set(k,g);}if(by==="sc"&&!g.tr)g.tr=r.tr;const m=g.months[r.ym]||(g.months[r.ym]={pay:0,avail:0});m.pay+=r.pay;m.avail+=r.avail;}
  const rows=[];
  for(const g of map.values()){const tot={pay:0,avail:0};for(const ym of months){const m=g.months[ym]||{pay:0,avail:0};tot.pay+=m.pay;tot.avail+=m.avail;}rows.push({k:g.k,tr:g.tr||"",months:g.months,tot});}
  return {months,rows};
}
function allocCells(m,strong){
  const pay=m.pay||0,av=m.avail||0,a=allocOf(pay,av),t=allocTone(a==null?null:a*100);
  const dot=t?`<span class="pend-dot" style="background:${toneHex(t)}"></span>`:"";
  const sc=strong?" strong":"";
  return `<td class="num${sc}">${money(pay)}</td><td class="num${sc}">${money(av)}</td><td class="num${sc}"><span class="alloc-pct">${dot}${a==null?"—":(a*100).toFixed(1)+"%"}</span></td>`;
}
function drawAllocTable(host,{agg,by}){
  const months=agg.months,rows=[...agg.rows].sort((a,b)=>b.tot.pay-a.tot.pay);
  if(!rows.length){host.innerHTML=`<div class="pend-empty">No payment rows under the current filter.</div>`;return;}
  const gtot={months:{}};
  months.forEach(ym=>gtot.months[ym]={pay:0,avail:0});
  rows.forEach(r=>{months.forEach(ym=>{const m=r.months[ym]||{pay:0,avail:0};gtot.months[ym].pay+=m.pay;gtot.months[ym].avail+=m.avail;});});
  const grpHead=months.map(ym=>`<th colspan="3" class="grp-head">${R9(ym)}</th>`).join("");
  const subHead=months.map(()=>`<th>Pay</th><th>Avail</th><th>Alloc%</th>`).join("");
  const body=rows.map(r=>{
    const lbl=`<td class="l label-cell"><span class="lbl-code mono">${r.k}</span></td>`;
    return `<tr>${lbl}${months.map(ym=>allocCells(r.months[ym]||{pay:0,avail:0})).join("")}</tr>`;
  }).join("");
  const foot=`<tr><td class="l">Grand total</td>${months.map(ym=>allocCells(gtot.months[ym],true)).join("")}</tr>`;
  host.innerHTML=`<div class="alloc-table-wrap"><table class="alloc"><thead><tr><th rowspan="2" class="l label-th">${by==="sc"?"Scheme":"Trustee"}</th>${grpHead}</tr><tr>${subHead}</tr></thead><tbody>${body}</tbody><tfoot>${foot}</tfoot></table></div>`;
}
/* Compare view (on-tab switch): per (allocator × month) Pay/Avail/ALLOC% for
   snapshot B, plus pre ALLOC% (snapshot A) and change % (B − A) after ALLOC%. */
function drawAllocCompareTableLocal(host,{a,b,by}){
  const months=a.months;
  const mapA=new Map(a.rows.map(r=>[r.k,r])), mapB=new Map(b.rows.map(r=>[r.k,r]));
  const keys=[...new Set([...mapA.keys(),...mapB.keys()])];
  const rows=keys.map(k=>{const ra=mapA.get(k),rb=mapB.get(k);return{k,ra,rb,sp:(rb?rb.tot.pay:0)+(ra?ra.tot.pay:0)};})
    .filter(r=>r.sp>0).sort((x,y)=>y.sp-x.sp);
  if(!rows.length){host.innerHTML=`<div class="pend-empty">No payment rows under the current filter.</div>`;return;}
  const gt={A:{},B:{}};
  months.forEach(ym=>{gt.A[ym]={pay:0,avail:0};gt.B[ym]={pay:0,avail:0};});
  rows.forEach(r=>{months.forEach(ym=>{const va=(r.ra&&r.ra.months[ym])||{pay:0,avail:0};const vb=(r.rb&&r.rb.months[ym])||{pay:0,avail:0};gt.A[ym].pay+=va.pay;gt.A[ym].avail+=va.avail;gt.B[ym].pay+=vb.pay;gt.B[ym].avail+=vb.avail;});});
  const grpHead=months.map(ym=>`<th colspan="5" class="grp-head">${R9(ym)}</th>`).join("");
  const subHead=months.map(()=>`<th>Pay</th><th>Avail</th><th>Alloc%</th><th>pre ALLOC%</th><th>change %</th>`).join("");
  const cmpCells=(vb,va,strong)=>{
    const sc=strong?" strong":"";
    const aB=allocOf(vb.pay,vb.avail), aA=allocOf(va.pay,va.avail);
    const tB=allocTone(aB==null?null:aB*100);
    const ch=(aB==null||aA==null)?null:(aB-aA)*100;
    const cT=(ch==null||ch===0)?null:(ch>0?"green":"red");
    const dotB=tB?`<span class="pend-dot" style="background:${toneHex(tB)}"></span>`:"";
    const dotC=cT?`<span class="pend-dot" style="background:${toneHex(cT)}"></span>`:"";
    return `<td class="num${sc}">${money(vb.pay||0)}</td><td class="num${sc}">${money(vb.avail||0)}</td><td class="num${sc}"><span class="alloc-pct">${dotB}${aB==null?"—":(aB*100).toFixed(1)+"%"}</span></td><td class="num${sc}">${aA==null?"—":(aA*100).toFixed(1)+"%"}</td><td class="num${sc}"><span class="alloc-pct">${dotC}${ch==null?"—":(ch>0?"+":"")+ch.toFixed(2)+" pp"}</span></td>`;
  };
  const body=rows.map(r=>{
    const lbl=`<td class="l label-cell"><span class="lbl-code mono">${r.k}</span></td>`;
    return `<tr>${lbl}${months.map(ym=>cmpCells((r.rb&&r.rb.months[ym])||{pay:0,avail:0},(r.ra&&r.ra.months[ym])||{pay:0,avail:0})).join("")}</tr>`;
  }).join("");
  const foot=`<tr><td class="l">Grand total</td>${months.map(ym=>cmpCells(gt.B[ym],gt.A[ym],true)).join("")}</tr>`;
  host.innerHTML=`<div class="alloc-table-wrap"><table class="alloc"><thead><tr><th rowspan="2" class="l label-th">${by==="sc"?"Scheme":"Trustee"}</th>${grpHead}</tr><tr>${subHead}</tr></thead><tbody>${body}</tbody><tfoot>${foot}</tfoot></table></div>`;
}
/* Control-bar pieces shared by the Current & Compare renderers. */
function allocSnapField(label,value){
  const f=el("div","alloc-field");f.innerHTML=`<span class="lab">${label}</span>`;
  const sel=el("select","alloc-snap");
  DATA.pym.snapshots.forEach(s=>{const o=el("option");o.value=s;o.textContent=s;if(s===value)o.selected=true;sel.appendChild(o);});
  f.appendChild(sel);return [f,sel];
}
function allocByToggle(onChange){
  const t=el("div","alloc-toggle");
  t.innerHTML=`<button data-by="tr" class="${__allocBy==="tr"?"on":""}">By trustee</button><button data-by="sc" class="${__allocBy==="sc"?"on":""}">By scheme</button>`;
  t.querySelectorAll("button").forEach(b=>b.addEventListener("click",()=>{__allocBy=b.dataset.by;t.querySelectorAll("button").forEach(x=>x.classList.toggle("on",x===b));onChange();}));
  return t;
}
function allocViewSwitch(){
  const v=el("div","alloc-toggle alloc-view");
  v.innerHTML=`<button data-v="current" class="${__allocView==="current"?"on":""}">Current</button><button data-v="compare" class="${__allocView==="compare"?"on":""}">Compare</button>`;
  v.querySelectorAll("button").forEach(b=>b.addEventListener("click",()=>{__allocView=b.dataset.v;render();}));
  return v;
}
function renderMoneyAllocation(content){
  if(!DATA.pym||!DATA.pym.rows.length){content.appendChild(el("div","pend-empty","No payment (pym) data loaded."));return;}
  if(__allocView==="compare")return renderMoneyAllocationCompare(content);
  return renderMoneyAllocationCurrent(content);
}
let __allocBy="tr";        // matrix row grouping: "tr" (trustee) | "sc" (scheme)
let __allocSnap=null;      // Current view snapshot override; null = pymSnap(state.snap)
let __allocView="current"; // on-tab Current/Compare switch — this tab's mode control
let __allocSnapA=null, __allocSnapB=null; // Compare snapshots; default latest−1 / latest
function renderMoneyAllocationCurrent(content){
  const snap=__allocSnap||pymSnap(state.snap);
  const ctrl=el("div","alloc-ctrl");
  const left=el("div","alloc-left");
  const [field,snapSel]=allocSnapField("Snapshot",snap);
  left.appendChild(field);
  left.appendChild(allocByToggle(drawMatrix));
  ctrl.appendChild(left);ctrl.appendChild(allocViewSwitch());
  content.appendChild(ctrl);
  const tableHost=el("div");content.appendChild(tableHost);
  function drawMatrix(){const s=__allocSnap||pymSnap(state.snap);drawAllocTable(tableHost,{agg:pymAggregate(s,__allocBy),by:__allocBy});}
  snapSel.addEventListener("change",()=>{__allocSnap=snapSel.value;drawMatrix();});
  drawMatrix();
}
function renderMoneyAllocationCompare(content){
  const snaps=DATA.pym.snapshots, defB=snaps[snaps.length-1], defA=snaps[snaps.length-2]||defB;
  const ctrl=el("div","alloc-ctrl");
  const left=el("div","alloc-left");
  const [fA,selA]=allocSnapField("Snapshot A",__allocSnapA||defA);
  const [fB,selB]=allocSnapField("Snapshot B",__allocSnapB||defB);
  left.appendChild(fA);left.appendChild(fB);left.appendChild(allocByToggle(drawMatrix));
  ctrl.appendChild(left);ctrl.appendChild(allocViewSwitch());
  content.appendChild(ctrl);
  const tableHost=el("div");content.appendChild(tableHost);
  function drawMatrix(){drawAllocCompareTableLocal(tableHost,{a:pymAggregate(__allocSnapA||defA,__allocBy),b:pymAggregate(__allocSnapB||defB,__allocBy),by:__allocBy});}
  selA.addEventListener("change",()=>{__allocSnapA=selA.value;drawMatrix();});
  selB.addEventListener("change",()=>{__allocSnapB=selB.value;drawMatrix();});
  drawMatrix();
}

/* ============================================================
   GLOBAL SCOPE BAR — snapshot · scheme · trustee · month range · mode
   ============================================================
   The shared filter surface every tab reads through. Built once
   (buildScopeBar), then refreshed per tab in updateScopeBar(). The mode
   toggle (Current/Compare/Trend) is enabled per the tab's `modes`; the
   data-scope controls (snapshot, scheme, trustee, months) are dimmed on
   tabs that render no dataset (`noScope`). Inapplicable controls DIM — they
   never disappear — so the bar's anatomy holds steady across tabs. */

/* Multi-select dropdown: search + All/None, checkbox list. Bound to state
   through getValues/setValues so state stays the single source of truth. */
class MultiPicker{
  constructor(opts){
    this.o=opts; this.open=false;
    this.root=el("div","mp");
    this.btn=el("button","mp-btn scope-data"); this.btn.type="button";
    this.label=el("span","mp-label","");
    this.caret=el("span","mp-caret","▾");
    this.btn.append(this.label,this.caret);
    this.panel=el("div","mp-panel"); this.panel.hidden=true;
    this.root.append(this.btn,this.panel);
    this.btn.addEventListener("click",e=>{e.stopPropagation(); this.open?this.close():this.openPanel();});
    document.addEventListener("click",e=>{if(this.open&&!this.root.contains(e.target))this.close();});
    document.addEventListener("keydown",e=>{if(e.key==="Escape")this.close();});
    this._buildPanel();
    this._label();
  }
  values(){return this.o.getValues();}
  _sort(arr){const items=this.o.items;return arr.sort((a,b)=>items.indexOf(a)-items.indexOf(b));}
  _buildPanel(){
    const o=this.o; this.panel.innerHTML="";
    const search=el("input","mp-search"); search.type="text";
    search.placeholder="Search "+o.label.toLowerCase()+"…";
    const tools=el("div","mp-tools");
    const allBtn=el("button","mp-mini"); allBtn.type="button"; allBtn.textContent="All";
    const noneBtn=el("button","mp-mini"); noneBtn.type="button"; noneBtn.textContent="None";
    tools.append(allBtn,noneBtn);
    const list=el("div","mp-list"); this._rows=new Map();
    for(const code of o.items){
      const row=el("label","mp-row"); row.dataset.code=code;
      const cb=el("input"); cb.type="checkbox";
      const nm=o.getName(code);
      row.append(cb, el("span","mp-code",code));
      if(nm&&nm!==code) row.appendChild(el("span","mp-name",nm));
      cb.addEventListener("change",()=>{
        const next=new Set(this.values());
        if(cb.checked)next.add(code); else next.delete(code);
        o.setValues(this._sort([...next])); this._label();
        if(o.onChange)o.onChange();
      });
      list.appendChild(row); this._rows.set(code,{row,cb});
    }
    search.addEventListener("input",()=>{
      const q=search.value.toLowerCase();
      for(const [code,{row}] of this._rows){
        const nm=o.getName(code)||"";
        row.style.display=(!q||(code+" "+nm).toLowerCase().includes(q))?"":"none";
      }
    });
    allBtn.addEventListener("click",()=>{o.setValues([...o.items]);this.sync();this._label();if(o.onChange)o.onChange();});
    noneBtn.addEventListener("click",()=>{o.setValues([]);this.sync();this._label();if(o.onChange)o.onChange();});
    this._search=search; this.panel.append(search,tools,list); this.sync();
  }
  sync(){const cur=new Set(this.values());for(const [code,{cb}] of this._rows)cb.checked=cur.has(code);}
  _label(){
    const o=this.o, all=o.items, v=this.values(), n=v.length;
    if(n===0) this.label.textContent=o.label+": none";
    else if(n>=all.length) this.label.textContent=o.label+": all";
    else if(n===1){const c=v[0];this.label.textContent=o.label+": "+(o.getName(c)||c);}
    else this.label.textContent=`${o.label}: ${n} selected`;
  }
  openPanel(){this.open=true;this.panel.hidden=false;this.root.classList.add("open");this.sync();
    setTimeout(()=>{if(this._search)this._search.focus();},0);}
  close(){this.open=false;this.panel.hidden=true;this.root.classList.remove("open");}
  refresh(){this.sync();this._label();}              /* external state changed (drill-through) */
  disable(d){this.btn.disabled=d;}
}

/* ---- scope bar state ---- */
