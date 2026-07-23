"use strict";
const chartRegistry=[];
function clearCharts(){for(const c of chartRegistry){try{c.destroy();}catch(e){}}chartRegistry.length=0;}
function cvColor(){return cssVar("--ink-2");}
function setupChartDefaults(){
  if(!window.Chart)return;
  Chart.defaults.font.family="'IBM Plex Sans', system-ui, sans-serif";
  Chart.defaults.font.size=11.5;
  Chart.defaults.color=cssVar("--ink-2");
}
function baseOpts(extra={}){
  const grid=cssVar("--hairline"), tick=cssVar("--muted"), ink=cssVar("--ink");
  const o={
    responsive:true, maintainAspectRatio:false,
    interaction:{mode:"nearest",intersect:false},
    plugins:{
      legend:{display:false,
        labels:{boxWidth:10,boxHeight:10,font:{size:11},padding:12,color:ink}},
      tooltip:{backgroundColor:"#15110b",titleColor:"#fcfcfb",bodyColor:"#e7e2d6",
        titleFont:{weight:"600",size:11},bodyFont:{family:"'IBM Plex Mono'",size:11},
        padding:10,cornerRadius:8,boxPadding:4,displayColors:true,borderColor:"rgba(255,255,255,.08)",borderWidth:1,
        callbacks:{}},
    },
    scales:{
      x:{grid:{display:false},border:{color:cssVar("--rule")},ticks:{color:tick,maxRotation:0,autoSkipPadding:14}},
      y:{grid:{color:grid},border:{display:false},ticks:{color:tick}},
    },
    animation:{duration:420,easing:"easeOutQuart"},
  };
  return deepMerge(o,extra);
}
function deepMerge(a,b){if(Array.isArray(b))return b;if(b&&typeof b==="object"){for(const k in b){a[k]=deepMerge(a[k]===undefined?{}:a[k],b[k]);}return a;}return b===undefined?a:b;}

function newBar(canvas, {labels,datasets,indexAxis="y",stacked=false,horizontal=true,legend=false,valueFmt=fmt,pctScale=false,target=null}){
  if(!window.Chart){canvas.parentElement.innerHTML='<div class="chart-empty">Charts need internet (Chart.js CDN).</div>';return null;}
  const opts=baseOpts({
    indexAxis,
    scales:{
      x:{grid:{color:cssVar("--hairline")},border:{display:false},ticks:{color:cssVar("--muted"),callback:pctScale?v=>(v*100)+"%":v=>fmt(v)},stacked},
      y:{grid:{display:false},border:{color:cssVar("--rule")},ticks:{color:cssVar("--ink-2"),autoSkip:false},stacked},
    },
    plugins:{
      legend:{display:legend,position:"bottom"},
      tooltip:{callbacks:{label:ctx=>` ${ctx.dataset.label||""}: ${pctScale?pct(ctx.parsed[indexAxis==="y"?"x":"y"]):fmt(ctx.parsed[indexAxis==="y"?"x":"y"])}`}},
    },
  });
  if(target!=null){
    opts.plugins.annotation={}; // placeholder; we draw target via a dataset line instead below
  }
  const ch=new Chart(canvas,{type:"bar",data:{labels,datasets},options:opts});
  chartRegistry.push(ch);return ch;
}
function newLine(canvas,{labels,datasets,legend=true,pctScale=false,fill=false,target=null}){
  if(!window.Chart){canvas.parentElement.innerHTML='<div class="chart-empty">Charts need internet (Chart.js CDN).</div>';return null;}
  const opts=baseOpts({
    scales:{
      x:{grid:{display:false},border:{color:cssVar("--rule")},ticks:{color:cssVar("--muted")}},
      y:{grid:{color:cssVar("--hairline")},border:{display:false},ticks:{color:cssVar("--muted"),callback:pctScale?v=>(v*100).toFixed(0)+"%":v=>fmt(v)}},
    },
    plugins:{
      legend:{display:legend,position:"bottom"},
      tooltip:{mode:"index",intersect:false,callbacks:{label:ctx=>` ${ctx.dataset.label}: ${pctScale?pct(ctx.parsed.y):fmt(ctx.parsed.y)}`}},
    },
  });
  if(target!=null){
    datasets=[...datasets,{label:"target",data:labels.map(()=>target),borderColor:cssVar("--rule"),borderDash:[4,4],pointRadius:0,borderWidth:1.5,fill:false}];
  }
  const ch=new Chart(canvas,{type:"line",data:{labels,datasets:
    datasets.map(d=>Object.assign({borderWidth:2,tension:.32,pointRadius:2.5,pointHoverRadius:5,fill},d))},
    options:opts});
  chartRegistry.push(ch);return ch;
}
function newDoughnut(canvas,{labels,data,colors}){
  if(!window.Chart){canvas.parentElement.innerHTML='<div class="chart-empty">Charts need internet.</div>';return null;}
  const ch=new Chart(canvas,{type:"doughnut",data:{labels,datasets:[{data,backgroundColor:colors,borderColor:cssVar("--surface"),borderWidth:2}]},
    options:baseOpts({cutout:"62%",scales:false,plugins:{
      legend:{display:true,position:"right",labels:{boxWidth:10,boxHeight:10,padding:9,color:cssVar("--ink-2")}},
      tooltip:{callbacks:{label:ctx=>` ${ctx.label}: ${fmt(ctx.parsed)} (${pct(ctx.parsed/ctx.dataset.data.reduce((s,v)=>s+v,0))})`}},
    }})});
  chartRegistry.push(ch);return ch;
}

/* sparkline as inline SVG */
function sparkline(values,{w=78,h=20,color=cssVar("--c1")}={}){
  const vs=values.map(v=>+v||0);const max=Math.max(...vs,1),min=Math.min(...vs,0);
  const span=(max-min)||1;const pts=vs.map((v,i)=>`${(i/(vs.length-1||1))*w},${h-((v-min)/span)*h}`).join(" ");
  const a=values.reduce((s,v)=>s+(+v||0),0);
  return `<svg class="spark" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true">
    <polyline points="${pts}" fill="none" stroke="${color}" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/>
    <circle cx="${w}" cy="${h-((vs[vs.length-1]-min)/span)*h}" r="2" fill="${color}"/></svg>`;
}

/* heatmap builder (scheme × month) */
function heatmap(container,{rowKeys,colKeys,values,onClick,rowLabel,colShort}){
  const max=Math.max(...values.flat().map(v=>v.bill||0),1);
  const cellColor=v=>{if(!v)return cssVar("--surface-3");const t=(v.bill||0)/max;
    // map t (0..1) across SEQ steps 0..6
    const i=Math.min(SEQ.length-1,Math.floor(t*(SEQ.length-1))+ (t>0?1:0));return SEQ[Math.max(1,i)];};
  const head=c=>colShort?colShort(c):c;
  let h=`<div class="heatmap" style="grid-template-columns:54px repeat(${colKeys.length},1fr)">`;
  h+=`<div class="hm-cell lab"></div>`;
  for(const c of colKeys)h+=`<div class="hm-head">${head(c)}</div>`;
  for(let ri=0;ri<rowKeys.length;ri++){
    const rk=rowKeys[ri];
    h+=`<div class="hm-cell lab" title="${rowLabel?rowLabel(rk):rk}">${rk}</div>`;
    for(let ci=0;ci<colKeys.length;ci++){
      const v=values[ri][ci];const col=cellColor(v);const show=v&&v.bill>0?"show":"";
      h+=`<div class="hm-cell ${show}" style="background:${col}" data-sc="${rk}" data-ym="${colKeys[ci]}" title="${rk} · ${colKeys[ci]} · bills ${v?v.bill:0}">${v?v.bill:""}</div>`;
    }
  }
  h+=`</div>`;
  container.innerHTML=h;
  if(onClick)container.querySelectorAll(".hm-cell:not(.lab)").forEach(c=>c.addEventListener("click",()=>onClick(c.dataset.sc)));
}

/* Submission status by month · 100% stacked status bar.
   Each cell shows the lifecycle-status mix of bills for that (scheme, month),
   grouped into 4 buckets:
     Red    (Outstanding) = OPEN
     Yellow (Submitted)   = PARTIAL_SUBMIT, SUBMITTED, APPROVED
     Green  (Paid)        = PARTIAL_PAID, FULLY_PAID
     Grey   (Other)       = CLOSED, OVERPAID, REFUND_OVERPAID, WAIVED
   The bar is 100% stacked (fills the cell uniformly so the visual emphasis is
   the *mix*, not the *size*); the absolute bill total sits below the bar. */
function buildBillVolumeBars(container, rows, months){
  // bucket definition (per user spec)
  const BUCKETS = [
    {k:"out",   label:"Outstanding",  cls:"s-out",   sts:["OPEN"]},
    {k:"sub",   label:"Submitted",    cls:"s-sub",   sts:["PARTIAL_SUBMIT","SUBMITTED","APPROVED"]},
    {k:"paid",  label:"Paid",         cls:"s-paid",  sts:["PARTIAL_PAID","FULLY_PAID"]},
    {k:"other", label:"Other",        cls:"s-other", sts:["CLOSED","OVERPAID","REFUND_OVERPAID","WAIVED"]},
  ];
  // (scheme × month) → bucket counts. Also bucket-level totals across all schemes/months.
  const cell = {};                   // cell[sc][ym][bucket] = count
  const cellTot = {};                // cellTot[sc][ym] = total bills
  rows.forEach(r=>{
    const sc=r.sc, ym=r.ym, b=r.bill||0;
    if(!cell[sc]) cell[sc]={};
    if(!cell[sc][ym]) cell[sc][ym]={out:0,sub:0,paid:0,other:0};
    if(!cellTot[sc]) cellTot[sc]={};
    cellTot[sc][ym]=(cellTot[sc][ym]||0)+b;
    const bk=BUCKETS.find(x=>x.sts.includes(r.st));
    cell[sc][ym][bk.k]+=b;
  });
  // row order: schemes sorted by total bills (desc)
  const schemeTotals={};
  Object.keys(cellTot).forEach(sc=>{
    schemeTotals[sc]=Object.values(cellTot[sc]).reduce((a,b)=>a+b,0);
  });
  const schemes=Object.keys(schemeTotals).sort((a,b)=>schemeTotals[b]-schemeTotals[a]);

  // build table
  const wrap=el("div","bv-wrap");
  const tbl=el("table","bv");
  const headRow=months.map(m=>`<th>${R9(m)}</th>`).join("");
  tbl.innerHTML=`
    <colgroup>
      <col class="c-scheme">${months.map(()=>`<col class="c-month">`).join("")}<col class="c-tot">
    </colgroup>
    <thead>
      <tr>
        <th class="c-scheme-th l">Scheme</th>
        ${headRow}
        <th class="c-tot-th">Total</th>
      </tr>
    </thead>
    <tbody></tbody>
    <tfoot></tfoot>`;
  container.innerHTML="";
  container.appendChild(wrap);
  wrap.appendChild(tbl);

  const tbody=tbl.querySelector("tbody");
  const tfoot=tbl.querySelector("tfoot");

  // clickable legend — filters table to one bucket (click again or another to reset)
  const leg=el("div","bv-legend");
  let activeFilter=null;
  const renderLegend=()=>{
    leg.innerHTML=BUCKETS.map(b=>{
      const sel=activeFilter===b.k;
      return `<span class="bv-leg-item${sel?' bv-leg-sel':''}" data-k="${b.k}" title="${b.sts.join(' / ')}">
        <i class="${b.cls}"></i><b>${b.label}</b>${sel?' ✕':''}</span>`;
    }).join("");
    leg.querySelectorAll(".bv-leg-item").forEach(el=>{
      el.addEventListener("click",()=>{
        const k=el.dataset.k;
        activeFilter=activeFilter===k?null:k;
        renderLegend();
        drawTable();
      });
    });
  };
  wrap.insertBefore(leg, tbl);
  renderLegend();

  // draw (or redraw) tbody + tfoot
  const drawTable=()=>{
    // --- tbody ---
    tbody.innerHTML="";
    schemes.forEach(sc=>{
      const tr=document.createElement("tr");
      let tot=0, filterTot=0;
      let cells=`<td class="c-scheme" data-sc="${sc}"><span class="sc-link" title="Filter by ${sc}">${sc}</span></td>`;
      months.forEach(ym=>{
        const ck=cell[sc][ym]||{out:0,sub:0,paid:0,other:0};
        const sum=cellTot[sc][ym]||0;
        tot+=sum;
        filterTot+=activeFilter?(ck[activeFilter]||0):sum;
        const segs=BUCKETS.map(b=>{
          if(activeFilter&&b.k!==activeFilter) return "";
          const v=ck[b.k]||0;
          const pct=sum>0?(v/sum)*100:0;
          return pct>0?`<span class="${b.cls} bv-seg" data-k="${b.k}" style="width:${pct.toFixed(2)}%" title="${b.label}: ${fmt(v)} (${pct.toFixed(1)}%)"></span>`:"";
        }).join("");
        const titleTxt=BUCKETS.map(b=>`${b.label}: ${fmt(ck[b.k]||0)}`).join(" · ");
        const label=activeFilter
          ?`${fmt(ck[activeFilter]||0)} / ${fmt(sum)}`
          :fmt(sum);
        cells+=`<td title="${sc} · ${ym} · ${fmt(sum)} bills${titleTxt?'\n'+titleTxt:''}">
          <div class="bv-cell">
            <div class="bv-bar">${segs||'<span class="s-other" style="width:100%" title="No bills"></span>'}</div>
            <div class="bv-pct">${label}</div>
          </div>
        </td>`;
      });
      const totLabel=activeFilter?`${fmt(filterTot)} / ${fmt(tot)}`:fmt(tot);
      cells+=`<td>${totLabel}</td>`;
      tr.innerHTML=cells;
      tr.querySelector(".sc-link")?.addEventListener("click",()=>{state.schemes=[sc];syncSchemes();render();});
      tbody.appendChild(tr);
    });

    // --- tfoot ---
    let footRow=`<td class="l">Total bills</td>`;
    const footBucketTotals={out:0,sub:0,paid:0,other:0};
    months.forEach(ym=>{
      schemes.forEach(sc=>{
        const ck=cell[sc][ym]||{out:0,sub:0,paid:0,other:0};
        footBucketTotals.out+=ck.out; footBucketTotals.sub+=ck.sub;
        footBucketTotals.paid+=ck.paid; footBucketTotals.other+=ck.other;
      });
      const mTot=footBucketTotals.out+footBucketTotals.sub+footBucketTotals.paid+footBucketTotals.other;
      const mFiltered=activeFilter?footBucketTotals[activeFilter]:mTot;
      footRow+=`<td>${activeFilter?fmt(mFiltered)+' / '+fmt(mTot):fmt(mTot)}</td>`;
      footBucketTotals.out=0; footBucketTotals.sub=0; footBucketTotals.paid=0; footBucketTotals.other=0;
    });
    const grandTot=Object.values(schemeTotals).reduce((s,v)=>s+v,0);
    const grandFiltered=activeFilter
      ?Object.values(cell).reduce((s,scObj)=>
          Object.values(scObj).reduce((t,ymObj)=>t+(ymObj[activeFilter]||0),0),0)
      :grandTot;
    footRow+=`<td>${activeFilter?fmt(grandFiltered)+' / '+fmt(grandTot):fmt(grandTot)}</td>`;
    tfoot.innerHTML=`<tr>${footRow}</tr>`;

    // re-attach scheme click
    tbody.querySelectorAll("td.c-scheme").forEach(td=>{
      td.onclick=()=>{state.schemes=[td.dataset.sc];syncSchemes();go("scheme-scorecard");};
    });

    // re-attach segment click (filter by status bucket)
    tbody.querySelectorAll(".bv-seg").forEach(seg=>{
      seg.style.cursor="pointer";
      seg.addEventListener("click",e=>{
        e.stopPropagation();
        const k=seg.dataset.k;
        activeFilter=activeFilter===k?null:k;
        renderLegend();
        drawTable();
      });
    });
  };
  drawTable();
}

/* Submission channel by month · STACKED ↔ GROUPED animated bar chart.
   One bar per contribution-period month, split into 5 channels (DDE / BATCH /
   PORTAL / BULK / OTHER). A segmented toggle above the chart morphs the layout
   between STACKED (segments stacked vertically inside one bar per month) and
   GROUPED (channels placed side-by-side as thin bars per month). Math
   replicates d3.stack(): stacked uses a running cumulative sum across channels
   per month; grouped anchors each sub-bar to the same baseline (0) but
   distributes each month's slot across the 5 channels. No D3 dependency —
   implementation is plain SVG with requestAnimationFrame easing. */

/* Contribution submission by account type — pivot table.
   Rows  = account type keys (r.at)
   Cols  = months (r.ym)
   Each cell: count + % of that account type's total across all visible months.
   Toggle switches between Cols=month / Cols=account-type.
   Default: columns = month, rows = account type. */
function buildAccountTypeTable(container, rows, months){
  // Build a flat lookup: "at\x01ym" → bill count, using the same pipeline as
  // monthKeySeries() so numbers match the Account Type page exactly.
  const cellMap = new Map();
  const rowTotals = {};
  rows.forEach(r=>{
    const at = r.at, ym = r.ym;
    if(!at || !ym || !r.bill) return;
    rowTotals[at] = (rowTotals[at]||0) + r.bill;
    cellMap.set(at+"\x01"+ym, (cellMap.get(at+"\x01"+ym)||0) + r.bill);
  });
  const getCell  = (at,ym)=> cellMap.get(at+"\x01"+ym)||0;
  const allTypes = Object.keys(rowTotals).sort();
  const grand    = Object.values(rowTotals).reduce((s,v)=>s+v, 0);

  let colMode  = "month"; // "month" | "type"
  let sortDesc = true;

  const redraw = ()=>{
    const isByMonth = colMode === "month";
    const colKeys = isByMonth ? months  : allTypes;
    const rowKeys = isByMonth ? allTypes : months;

    const sortedRows = [...rowKeys].sort((a,b)=>{
      const va = colKeys.reduce((s,ck)=>s+getCell(a,ck),0);
      const vb = colKeys.reduce((s,ck)=>s+getCell(b,ck),0);
      return sortDesc ? vb-va : va-vb;
    });

    let html = `<div class="att-wrap">
  <div class="att-hint">Sorts rows by count · Toggle <b>Columns</b> to switch orientation</div>
  <div class="att-scroll"><table class="data att-table">
    <thead><tr>
      <th class="att-th att-rowhead">${isByMonth?"Account type":"Month"}</th>`;
    colKeys.forEach(ck=>{
      const colTotal = sortedRows.reduce((s,rk)=>s+getCell(rk,ck),0);
      const colPct   = grand>0 ? (colTotal/grand*100).toFixed(1)+"%" : "—";
      html += `<th class="att-th">${isByMonth?R9(ck):ck}<div class="att-ctot">${colPct} of total</div></th>`;
    });
    html += `<th class="att-th att-total">Total<div class="att-ctot">100%</div></th></tr></thead><tbody>`;

    sortedRows.forEach(rk=>{
      const rt    = colKeys.reduce((s,ck)=>s+getCell(rk,ck),0);
      const rtPct = grand>0 ? (rt/grand*100).toFixed(1)+"%" : "0.0%";
      html += `<tr><td class="att-rowhead">${isByMonth?rk:R9(rk)}</td>`;
      colKeys.forEach(ck=>{
        const cnt = getCell(rk,ck);
        const pct = rt>0 ? (cnt/rt*100).toFixed(1) : "0.0";
        html += `<td class="att-cell"><span class="att-count">${fmt(cnt)}</span><span class="att-pct">${pct}%</span></td>`;
      });
      html += `<td class="att-cell att-total"><span class="att-count">${fmt(rt)}</span><span class="att-pct att-total-pct">${rtPct}</span></td></tr>`;
    });
    html += `</tbody></table></div></div>`;

    host.innerHTML = html;
  };

  container.innerHTML = `<div class="att-card">
    <div class="card-title">
      <h3>Submission by account type</h3>
      <div class="seg" role="group" aria-label="Pivot orientation">
        <button type="button" data-atcol="month" class="on">Cols: month</button>
        <button type="button" data-atcol="type">Cols: type</button>
      </div>
    </div>
    <div class="att-host"></div>
  </div>`;
  const host     = container.querySelector(".att-host");
  const btnMonth = container.querySelector('[data-atcol="month"]');
  const btnType  = container.querySelector('[data-atcol="type"]');

  const syncBtns = ()=>{
    btnMonth.classList.toggle("on", colMode==="month");
    btnType .classList.toggle("on", colMode==="type");
  };

  btnMonth.addEventListener("click", ()=>{ colMode="month";  syncBtns(); redraw(); });
  btnType .addEventListener("click", ()=>{ colMode="type";   syncBtns(); redraw(); });

  // click row-header cell in thead → toggle sort
  host.addEventListener("click", e=>{
    const th = e.target.closest(".att-th:not(.att-total)");
    if(!th) return;
    sortDesc = !sortDesc;
    redraw();
  });

  redraw();
}

function buildChannelStackGroup(container, rows, months){
  const CHANNELS = [
    {k:"dde",    label:"DDE",   color:CH_COLORS.DDE},
    {k:"batch",  label:"BATCH", color:CH_COLORS.BATCH},
    {k:"portal", label:"PORTAL",color:CH_COLORS.PORTAL},
    {k:"bulk",   label:"BULK",  color:CH_COLORS.BULKUPLOAD},
    {k:"other",  label:"OTHER", color:CH_COLORS.OTHER},
  ];
  // per-month counts: data[ym] = [DDE, BATCH, PORTAL, BULK, OTHER]
  const data = months.map(ym=>{
    const a = totals({...groupBy(rows.filter(r=>r.ym===ym),()=>0).get(0)});
    return CHANNELS.map(c=>a[c.k]||0);
  });
  const monthTotals = data.map(arr=>arr.reduce((s,v)=>s+v,0));
  const maxStack = Math.max(...monthTotals, 1);
  const yMax = maxStack;                              // absolute submission count

  container.innerHTML = "";
  const card = el("div","card span2 csg-card");
  card.innerHTML = `
    <div class="card-title">
      <h3>Submission channel by month</h3>
      <div class="seg" role="group" aria-label="Layout">
        <button type="button" data-mode="stacked" class="on">Stacked</button>
        <button type="button" data-mode="grouped">Grouped</button>
      </div>
    </div>
    <div class="ckey">${CHANNELS.map(c=>`<span class="ckey-i"><i style="background:${c.color}"></i>${c.label}</span>`).join("")}</div>
    <div class="csg-host"></div>
    <div class="caption">Click <b>Stacked</b> for monthly totals, <b>Grouped</b> to compare channels. Hover a segment for exact counts.</div>`;
  container.appendChild(card);

  const host = $(".csg-host", card);
  const W = 1100, H = 320;
  const M = {t:18, r:18, b:32, l:54};
  const innerW = W - M.l - M.r;
  const innerH = H - M.t - M.b;
  const yScale = v => M.t + innerH - (v/yMax)*innerH;

  // x slot per month (used in both modes)
  const n = months.length;
  const slotW = innerW / Math.max(n,1);
  const barGap = Math.min(10, slotW*0.18);
  const barW_stacked = Math.max(8, slotW - barGap);
  const barW_grouped = Math.max(4, (slotW - barGap) / CHANNELS.length - 1.5);

  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns,"svg");
  svg.setAttribute("viewBox",`0 0 ${W} ${H}`);
  svg.setAttribute("preserveAspectRatio","xMidYMid meet");
  svg.setAttribute("class","csg-svg");
  host.appendChild(svg);

  // gridlines + y-axis ticks (5 ticks)
  const yTicks = 5;
  for(let i=0;i<=yTicks;i++){
    const v = (yMax*i)/yTicks;
    const y = yScale(v);
    svg.insertAdjacentHTML("beforeend",
      `<line x1="${M.l}" y1="${y}" x2="${M.l+innerW}" y2="${y}" stroke="var(--hairline)" stroke-width="1"/>
       <text x="${M.l-8}" y="${y+4}" text-anchor="end" font-size="11" fill="var(--muted)" font-family="var(--mono)">${fmt(Math.round(v))}</text>`);
  }
  // x baseline
  svg.insertAdjacentHTML("beforeend",
    `<line x1="${M.l}" y1="${M.t+innerH}" x2="${M.l+innerW}" y2="${M.t+innerH}" stroke="var(--rule)" stroke-width="1"/>`);

  // x labels
  months.forEach((m,i)=>{
    const cx = M.l + slotW*i + slotW/2;
    svg.insertAdjacentHTML("beforeend",
      `<text x="${cx}" y="${M.t+innerH+18}" text-anchor="middle" font-size="11" fill="var(--muted)" font-family="var(--mono)">${R9(m)}</text>`);
  });

  // build bar elements per (month, channel). Each bar keeps a small dataset
  // describing both layout positions so the tween can interpolate between them.
  const bars = []; // {mIdx, cIdx, el, from, to}
  const tooltip = el("div","csg-tip");
  host.appendChild(tooltip);

  const showTip = (e, txt)=>{
    tooltip.innerHTML = txt;
    const r = host.getBoundingClientRect();
    tooltip.style.left = (e.clientX - r.left + 12) + "px";
    tooltip.style.top  = (e.clientY - r.top  + 12) + "px";
    tooltip.classList.add("on");
  };
  const hideTip = ()=>tooltip.classList.remove("on");

  months.forEach((m, mi)=>{
    const slotX = M.l + slotW*mi + barGap/2;
    let stackY = M.t + innerH;     // running top for stacked mode
    CHANNELS.forEach((ch, ci)=>{
      const v = data[mi][ci];
      const stackedH = (v/yMax)*innerH;
      const stackedY = stackY - stackedH;
      stackY = stackedY;

      const groupedX = slotX + ci*(barW_grouped+1.5);
      const groupedY = M.t + innerH - stackedH;
      const groupedH = stackedH;

      const rect = document.createElementNS(ns,"rect");
      rect.setAttribute("x", slotX);
      rect.setAttribute("y", M.t + innerH);
      rect.setAttribute("width", barW_stacked);
      rect.setAttribute("height", 0);
      rect.setAttribute("fill", ch.color);
      rect.setAttribute("rx", 2);
      rect.setAttribute("ry", 2);
      svg.appendChild(rect);

      const sum = monthTotals[mi];
      const pct = sum>0 ? (v/sum*100) : 0;
      rect.addEventListener("mousemove", e=>showTip(e,
        `<b>${months[mi]}</b> · ${ch.label}: <b>${fmt(v)}</b> submissions <span class="csg-pct">(${pct.toFixed(1)}% of month)</span>`));
      rect.addEventListener("mouseleave", hideTip);

      // ── Labels ──
      // stacked: % of month, drawn inside the segment when the bar is tall
      // enough to fit the text; only shown in stacked mode.
      const stackLabel = document.createElementNS(ns,"text");
      stackLabel.setAttribute("text-anchor","middle");
      stackLabel.setAttribute("font-size","10.5");
      stackLabel.setAttribute("font-family","var(--mono)");
      stackLabel.setAttribute("font-weight","600");
      stackLabel.setAttribute("fill","#fcfcfb");
      stackLabel.setAttribute("paint-order","stroke");
      stackLabel.setAttribute("stroke","rgba(21,17,11,.55)");
      stackLabel.setAttribute("stroke-width","2.5");
      stackLabel.setAttribute("stroke-linejoin","round");
      stackLabel.setAttribute("class","csg-lab csg-lab-stack");
      // hide unless segment is tall enough (~14px) and pct > 4% (avoid clutter)
      const showStackLab = pct >= 4 && stackedH >= 14;
      stackLabel.textContent = showStackLab ? (pct>=10 ? pct.toFixed(0)+"%" : pct.toFixed(1)+"%") : "";
      svg.appendChild(stackLabel);

      // grouped: raw count drawn just above each sub-bar; only shown in grouped mode
      const groupLabel = document.createElementNS(ns,"text");
      groupLabel.setAttribute("text-anchor","middle");
      groupLabel.setAttribute("font-size","10.5");
      groupLabel.setAttribute("font-family","var(--mono)");
      groupLabel.setAttribute("font-weight","600");
      groupLabel.setAttribute("fill","var(--ink-2)");
      groupLabel.setAttribute("class","csg-lab csg-lab-group");
      groupLabel.textContent = v>0 ? fmt(v) : "";
      svg.appendChild(groupLabel);

      bars.push({
        el: rect,
        sLab: stackLabel, gLab: groupLabel,
        // stacked position
        sx: slotX, sy: stackedY, sw: barW_stacked, sh: stackedH,
        // grouped position
        gx: groupedX, gy: groupedY, gw: barW_grouped, gh: groupedH,
        ci, mi, v
      });
    });
  });

  // animation: interpolate every bar between its current and target layout.
  // bars carry stacked coords (sx,sy,sw,sh) and grouped coords (gx,gy,gw,gh).
  // labels follow each bar; their opacity cross-fades with the layout switch.
  let mode = "stacked";
  let anim = null;
  const ease = t => t<.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2,3)/2;   // cubic-in-out
  const pickTarget = (b, m)=> m==="stacked"
    ? {x:b.sx, y:b.sy, w:b.sw, h:b.sh}
    : {x:b.gx, y:b.gy, w:b.gw, h:b.gh};
  const tweenTo = (target, ms=380)=>{
    if(anim) cancelAnimationFrame(anim);
    const start = performance.now();
    const from = bars.map(b=>{
      const x = +b.el.getAttribute("x");
      const y = +b.el.getAttribute("y");
      const w = +b.el.getAttribute("width");
      const h = +b.el.getAttribute("height");
      return {x,y,w,h};
    });
    const targets = bars.map(b=>pickTarget(b, target));
    const stackOp = target==="stacked" ? 1 : 0;
    const groupOp = target==="grouped" ? 1 : 0;
    const step = now=>{
      const t = Math.min(1, (now-start)/ms);
      const k = ease(t);
      bars.forEach((b,i)=>{
        const f = from[i], tgt = targets[i];
        const x = f.x + (tgt.x - f.x)*k;
        const y = f.y + (tgt.y - f.y)*k;
        const w = f.w + (tgt.w - f.w)*k;
        const h = f.h + (tgt.h - f.h)*k;
        b.el.setAttribute("x", x);
        b.el.setAttribute("y", y);
        b.el.setAttribute("width", w);
        b.el.setAttribute("height", Math.max(0,h));

        // stacked % label — sits in the middle of the segment
        if(b.sLab.textContent){
          b.sLab.setAttribute("x", x + w/2);
          b.sLab.setAttribute("y", y + Math.max(h/2, 6) + 3.5);
          b.sLab.setAttribute("opacity", stackOp);
        } else {
          b.sLab.setAttribute("opacity", 0);
        }
        // grouped count label — sits just above the top of the sub-bar
        if(b.gLab.textContent){
          b.gLab.setAttribute("x", x + w/2);
          b.gLab.setAttribute("y", Math.max(M.t, y - 4));
          b.gLab.setAttribute("opacity", groupOp);
        } else {
          b.gLab.setAttribute("opacity", 0);
        }
      });
      if(t<1) anim = requestAnimationFrame(step);
      else anim = null;
    };
    anim = requestAnimationFrame(step);
  };

  // initial render → stacked
  requestAnimationFrame(()=>{
    bars.forEach(b=>{
      b.el.setAttribute("x", b.sx);
      b.el.setAttribute("y", b.sy);
      b.el.setAttribute("width", b.sw);
      b.el.setAttribute("height", b.sh);
      b.sLab.setAttribute("x", b.sx + b.sw/2);
      b.sLab.setAttribute("y", b.sy + Math.max(b.sh/2, 6) + 3.5);
      b.sLab.setAttribute("opacity", b.sLab.textContent ? 1 : 0);
      b.gLab.setAttribute("opacity", 0);
    });
  });

  // wire toggle
  card.querySelectorAll(".seg button").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const m = btn.dataset.mode;
      if(m===mode) return;
      card.querySelectorAll(".seg button").forEach(b=>b.classList.toggle("on", b===btn));
      mode = m;
      tweenTo(mode);
    });
  });
}

/* ============================================================
   TABLE LAYER
   ============================================================ */
function buildTable(container,{columns,rows,sortable=true,defaultSort,onRowClick,totalRow}){
  let sortKey=defaultSort||columns[0].key, sortDir=-1;
  const body=()=>{let rr=[...rows];
    if(sortable){const col=columns.find(c=>c.key===sortKey);
      if(col){rr.sort((a,b)=>{const x=col.sortVal?col.sortVal(a[sortKey],a):a[sortKey];const y=col.sortVal?col.sortVal(b[sortKey],b):b[sortKey];
        const sx=typeof x==="number"?x:String(x);const sy=typeof y==="number"?y:String(y);
        return (sx<sy?-1:sx>sy?1:0)*sortDir;});}}
    return rr;
  };
  const draw=()=>{
    let h=`<table class="data"><thead><tr>`;
    for(const c of columns){const cls=(c.align==="left"?"l":"")+(sortable&&c.sortable!==false?" sortable":"");
      const arr=(sortable&&c.sortable!==false&&c.key===sortKey)?(sortDir<0?' <span class="arr">▼</span>':' <span class="arr">▲</span>'):"";
      h+=`<th class="${cls}" data-k="${c.key}">${c.label}${arr}</th>`;}
    h+="</tr></thead><tbody>";
    for(const r of body()){
      const sel=!allSchemesSelected()&&columns.some(c=>c.key==="sc")&&state.schemes.includes(r.sc)?" sel":"";
      h+=`<tr${sel}>`;
      for(const c of columns){const val=r[c.key];const txt=c.fmt?c.fmt(val,r):val;
        const cls=(c.align==="left"?"l":"")+(c.cls?(" "+c.cls(r,val)):"");
        h+=`<td class="${cls.trim()}"${c.attrs?c.attrs(r,val):""}>${txt==null||txt===""?"—":txt}</td>`;}
      h+="</tr>";
    }
    if(totalRow){h+=`<tr class="totals">`;for(const c of columns){h+=`<td class="${c.align==="left"?"l":""}">${totalRow(c)||""}</td>`;}h+="</tr>";}
    h+="</tbody></table>";
    container.innerHTML=`<div class="tbl-wrap">${h}</div>`;
    if(sortable)container.querySelectorAll("th.sortable").forEach(th=>th.addEventListener("click",()=>{
      const k=th.dataset.k; if(sortKey===k)sortDir=-sortDir; else{sortKey=k;sortDir=-1;} draw();
    }));
    if(onRowClick)container.querySelectorAll("tbody tr").forEach(tr=>tr.addEventListener("click",e=>{
      const idx=[...tr.parentElement.children].indexOf(tr);onRowClick(body()[idx],e);
    }));
  };
  draw();
}

/* ============================================================
   KPI tiles
   ============================================================ */
function kpiTile({label,value,sub,delta,deltaFmt="signed",chartId=null,chartData=null}){
  const dcls=delta==null?"flat":(delta>0?"up":delta<0?"dn":"flat");
  const dtxt=delta==null?"":(deltaFmt==="pp"?pp(delta):(deltaFmt==="pct"?pct(delta):signed(delta)));
  const arrow=delta==null?"":(delta>0?"↑":delta<0?"↓":"→");
  const chartEl=chartId?`<div class="kpi-chart" id="${chartId}"></div>`:"";
  return `<div class="kpi"><div class="k-label">${label}</div>
    <div class="k-val">${value}</div>
    ${delta!=null?`<div class="k-mom ${dcls}"><span class="mom-arrow">${arrow}</span>${dtxt}</div>`:""}
    ${sub?`<div class="k-sub">${sub}</div>`:""}
    ${chartEl}</div>`;
}

/* Mini KPI line chart (actual vs target) */
function renderKpiChart(canvasId,{labels,actual,target,actualColor="#0D7D80",targetColor="#B0B0B0"}){
  const el=document.getElementById(canvasId);
  if(!el)return;
  const canvas=document.createElement("canvas");
  el.appendChild(canvas);
  if(!window.Chart){el.innerHTML='<div class="chart-empty">Charts need internet.</div>';return;}
  new Chart(canvas,{
    type:"line",
    data:{
      labels,
      datasets:[
        {label:"Target",data:target,borderColor:targetColor,borderWidth:1.5,borderDash:[3,2],
          pointRadius:0,tension:.4,fill:false},
        {label:"Actual",data:actual,borderColor:actualColor,borderWidth:2,
          pointRadius:2,pointBackgroundColor:actualColor,tension:.4,fill:false}
      ]
    },
    options:{
      responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:false},tooltip:{enabled:true,mode:"index",intersect:false}},
      scales:{
        x:{display:false},y:{display:false}
      },
      animation:{duration:400}
    }
  });
}

/* ---- Summary KPI: per-account-type tile with sparkline ---- */
function kpiAtTile({at, cur, prev, months6, curLabel}){
  const chartId="kpi-chart-"+at.toLowerCase();
  const delta=prev!=null?(cur-prev):null;
  const tile=kpiTile({
    label:at,
    value:fmt(cur),
    delta:delta,
    deltaFmt:"signed",
    chartId:chartId
  });
  const wrapper=document.createElement("div");
  wrapper.innerHTML=tile;
  const kpiEl=wrapper.firstElementChild;

  if(window.Chart&&months6.length){
    const vals6=months6.map(m=>{
      const a=totals({...groupBy(window.__summaryRows.filter(r=>r.at===at&&r.ym===m),()=>0).get(0)});
      return a.total||0;
    });
    const avgV=vals6.length>0?vals6.reduce((s,v)=>s+v,0)/vals6.length:0;
    const targetData=months6.map(()=>Math.round(avgV));
    requestAnimationFrame(()=>{
      renderKpiChart(chartId,{labels:months6.map(m=>m.slice(2)),actual:vals6,target:targetData});
    });
  }

  kpiEl.style.cursor="pointer";
  const isActive=state.at===at;
  if(isActive) kpiEl.classList.add("kpi-active");
  kpiEl.addEventListener("click",()=>{
    state.at=isActive?"":at;
    const atHost=document.getElementById("fAt");
    if(atHost){
      atHost.querySelectorAll("button").forEach(x=>x.classList.toggle("on",x.dataset.at===state.at));
    }
    render();
  });
  kpiEl.addEventListener("mouseenter",()=>{ kpiEl.classList.add("kpi-hover"); });
  kpiEl.addEventListener("mouseleave",()=>{ kpiEl.classList.remove("kpi-hover"); });

  return kpiEl;
}

/* ---- Summary Zone 2 left 40%: channel × last 3 months table with inline bars ---- */
function buildChannel3MonthTable(container, rows, months3){
  const CHANNELS=[
    {k:"dde",    label:"DDE"},
    {k:"batch",  label:"BATCH"},
    {k:"portal", label:"PORTAL"},
    {k:"bulk",   label:"BULK"},
    {k:"other",  label:"OTHER"}
  ];
  const data=months3.map(ym=>{
    const a=totals({...groupBy(rows.filter(r=>r.ym===ym),()=>0).get(0)});
    return CHANNELS.map(c=>a[c.k]||0);
  });
  // Compute column totals (per month) for percentage calculation
  const colTotals=months3.map((_,mi)=>data[mi].reduce((s,v)=>s+v,0));
  const maxVal=Math.max(...colTotals,1);
  const grandTotals=CHANNELS.map((c,ci)=>data.reduce((s,v)=>s+v[ci],0));
  const grandTotal=grandTotals.reduce((s,v)=>s+v,0);

  container.innerHTML=`<div class="card" style="padding:14px">
    <div class="card-title"><h3>Submit channel · last 3 months</h3></div>
    <div class="att-scroll"><table class="data att-table" style="width:100%">
      <thead>
        <tr>
          <th class="att-th att-rowhead" style="text-align:center">Channel</th>
          ${months3.map(m=>`<th class="att-th" style="text-align:center">${R9(m)}</th>`).join("")}
          <th class="att-th att-total" style="text-align:center">Total</th>
        </tr>
      </thead>
      <tbody></tbody>
    </table></div>
  </div>`;
  const tbody=container.querySelector("tbody");
  CHANNELS.forEach((ch,ci)=>{
    const tr=document.createElement("tr");
    let cells=`<td class="att-rowhead" style="text-align:center">${ch.label}</td>`;
    months3.forEach((m,mi)=>{
      const v=data[mi][ci];
      const pct=colTotals[mi]>0?(v/colTotals[mi]*100).toFixed(1):"0.0";
      cells+=`<td class="att-cell" style="text-align:center">
        <div style="display:flex;flex-direction:column;align-items:center;gap:2px;justify-content:center">
          <span style="font-family:var(--mono);font-size:.78rem">${fmt(v)}</span>
          <div style="width:60px;height:6px;background:var(--hairline);border-radius:3px;overflow:hidden">
            <div style="width:${pct}%;height:100%;background:${CH_COLORS[ch.label]||CAT[0]};border-radius:3px"></div>
          </div>
          <span style="font-family:var(--mono);font-size:.68rem;color:var(--ink-2)">${pct}%</span>
        </div>
      </td>`;
    });
    const grandPct=grandTotal>0?(grandTotals[ci]/grandTotal*100).toFixed(1):"0.0";
    cells+=`<td class="att-total att-cell" style="text-align:center">
      <div style="display:flex;flex-direction:column;align-items:center;gap:2px">
        <span class="att-count">${fmt(grandTotals[ci])}</span>
        <span style="font-family:var(--mono);font-size:.72rem;color:var(--ink-2)">${grandPct}%</span>
      </div>
    </td>`;
    tr.innerHTML=cells;
    tbody.appendChild(tr);
  });
}

/* ---- Summary Zone 1 footer: Contribution Mode — single horizontal stacked bar ----
   Counts SUBMITTED bills per contribution mode (REGULAR / LUMP_SUM / SURCHARGE)
   — i.e. only rows where r.total > 0 (TOTAL_SUBMIT_COUNT > 0). The bar reflects
   the mode mix of bills that have actually been submitted, not the raw bill
   count, so an unsubmitted REGULAR bill does not push the share upward.
   Each segment is colored from CAT, labeled with "number · %", and a small
   legend underneath names the modes and their colors. */
function buildModeStackedBar(container, rows){
  const submitted = rows.filter(r => (r.total||0) > 0);
  const counts = new Map(DATA.modes.map(m=>[m,0]));
  submitted.forEach(r=>{ if(counts.has(r.bm)) counts.set(r.bm, (counts.get(r.bm)||0) + (r.total||0)); });
  const total = [...counts.values()].reduce((a,b)=>a+b, 0);
  const palette = {REGULAR:CAT[0], LUMP_SUM:CAT[2], SURCHARGE:CAT[5]};

  container.innerHTML=`
    <div class="mode-bar-card">
      <div class="card-title">
        <h3>Contribution mode</h3>
        <span class="hint">submitted bills only · ${I9(total)} submitted · snapshot ${state.snap}</span>
      </div>
      <div class="mode-bar" role="img" aria-label="Contribution mode breakdown">
        ${DATA.modes.map((m,i)=>{
          const v=counts.get(m)||0;
          const pct=total?(v/total*100):0;
          const col=palette[m]||CAT[i%8];
          // suppress labels inside tiny segments (<9%) so text doesn't clip
          const innerLabel = pct>=9
            ? `<span class="seg-num">${I9(v)}</span><span class="seg-pct">${pct.toFixed(1)}%</span>`
            : '';
          return `<div class="mode-bar-seg" style="flex:${v||0} 1 0;background:${col}" title="${m}: ${I9(v)} (${pct.toFixed(1)}%)">${innerLabel}</div>`;
        }).join("")}
      </div>
      <div class="mode-bar-legend">
        ${DATA.modes.map((m,i)=>{
          const v=counts.get(m)||0;
          const pct=total?(v/total*100):0;
          const col=palette[m]||CAT[i%8];
          return `<span><i style="background:${col}"></i>${m} · ${I9(v)} (${pct.toFixed(1)}%)</span>`;
        }).join("")}
      </div>
    </div>`;
}

/* ---- shared status buckets (canonical source for every chart that groups
   the 10 statuses into 4 semantic categories). Used by:
     - buildStatusByMonthWithTrustee (Zone 3, grouped by trustee/scheme)
     - buildStatusStackedByMonth    (Zone 2 right, monthly aggregate)         */
const STATUS_BUCKETS=[
  {k:"out",   label:"Outstanding", color:"#e34948", sts:["OPEN"]},
  {k:"sub",   label:"Submitted",   color:"#eda100", sts:["PARTIAL_SUBMIT","SUBMITTED","APPROVED"]},
  {k:"paid",  label:"Paid",        color:"#1baf7a", sts:["PARTIAL_PAID","FULLY_PAID"]},
  {k:"other", label:"Other",       color:"#94a3b8", sts:["CLOSED","OVERPAID","REFUND_OVERPAID","WAIVED"]},
];
/* helper: map a raw status to its bucket key, or null if it doesn't fit any */
const statusToBucket = s => {
  const b = STATUS_BUCKETS.find(b => b.sts.includes(s));
  return b ? b.k : null;
};

/* ---- Summary Zone 2 right 60%: D3 stacked ↔ grouped bar chart of bills by status per month ----
   x = contribution month (DATA.months), y = total bill count. A STACKED ↔ GROUPED
   toggle in the card title morphs the layout, following Mike Bostock's
   "Stacked-to-Grouped Bars" Observable example:
     - stacked : segments stack vertically inside one bar per month (y-scale
                 domain = max monthly sum)
     - grouped : bars share the same baseline, split into 4 thin sub-bars per
                 month (y-scale domain = max single bucket in any month)
   The bucket palette (Outstanding / Submitted / Paid / Other) and clickable
   legend mirror the existing "Submission status by month grouped by trustee"
   chart so visual identity stays consistent across the dashboard. */
function buildStatusStackedByMonth(container, rows){
  /* aggregate r.bill into (ym, bucket) cells */
  const months = DATA.months;
  const counts = {};                       // counts[ym][bucketK] = number
  months.forEach(ym=>{ counts[ym] = {out:0,sub:0,paid:0,other:0}; });
  rows.forEach(r=>{
    const bk = statusToBucket(r.st);
    if(!bk || !counts[r.ym]) return;
    counts[r.ym][bk] += r.bill || 0;
  });

  /* d3.stack input shape: one object per x-category (month), with one
     numeric field per series (bucket). */
  const stackInput = months.map(ym => ({ym, ...counts[ym]}));
  const stackKeys  = STATUS_BUCKETS.map(b => b.k);
  const layers     = d3.stack().keys(stackKeys)(stackInput);
  const stackedSeries = STATUS_BUCKETS.map((b, i) => ({
    k: b.k, label: b.label, color: b.color, series: layers[i],
  }));
  const y1Max = d3.max(stackedSeries, s => d3.max(s.series, d => d[1])) || 1;
  const y0Max = Math.max(
    ...months.flatMap(ym => STATUS_BUCKETS.map(b => counts[ym]?.[b.k] || 0)),
    1
  );
  /* total label value per month (used in stacked mode only) */
  const stackTop = months.map(ym => STATUS_BUCKETS.reduce((s,b)=>s + (counts[ym]?.[b.k]||0), 0));

  /* DOM scaffold — keep the existing .card chrome so it sits flush with the
     Channel 3-month table on the left. The .seg toggle uses the same styling
     as the existing "Submission channel by month" chart for visual parity. */
  container.innerHTML = `
    <div class="card" style="padding:14px">
      <div class="card-title">
        <h3>Bills by status · monthly</h3>
        <div class="seg" role="group" aria-label="Layout">
          <button type="button" data-bsm-mode="stacked" class="on">Stacked</button>
          <button type="button" data-bsm-mode="grouped">Grouped</button>
        </div>
      </div>
      <div id="bsm-legend" class="bv-legend" style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:4px">
        ${STATUS_BUCKETS.map(b => `<span class="bv-leg-item" data-k="${b.k}" style="font-size:.72rem;cursor:pointer" title="${b.sts.join(', ')}"><i style="display:inline-block;width:10px;height:10px;background:${b.color};border-radius:2px;margin-right:3px"></i><b>${b.label}</b></span>`).join("")}
      </div>
      <div class="bsm-host" style="width:100%;position:relative">
        <svg id="bsm-svg" style="display:block;width:100%;height:280px"></svg>
      </div>
    </div>`;

  const svg        = d3.select(container.querySelector("#bsm-svg"));
  const host       = container.querySelector(".bsm-host");
  const legendHost = container.querySelector("#bsm-legend");
  let activeFilter = null;
  let mode         = "stacked";      // "stacked" | "grouped"

  const dims = {W: 0, H: 280, M: {top: 14, right: 12, bottom: 28, left: 48}};
  const measure = () => {
    const r = host.getBoundingClientRect();
    dims.W = Math.max(320, Math.floor(r.width));
  };

  const init = () => {
    measure();
    const {W, H, M} = dims;
    const innerW = W - M.left - M.right;
    const innerH = H - M.top - M.bottom;
    svg.attr("viewBox", `0 0 ${W} ${H}`).attr("preserveAspectRatio","none")
       .attr("width", W).attr("height", H);
    svg.selectAll("*").remove();

    const g = svg.append("g").attr("transform", `translate(${M.left},${M.top})`);

    /* x scale — months, one band per month. In stacked mode rects fill the band,
       in grouped mode the band is split across the 4 buckets. */
    const x = d3.scaleBand().domain(months).range([0, innerW]).padding(0.18);
    const nBuckets = STATUS_BUCKETS.length;
    const subGap = 1.5;
    const bandW  = x.bandwidth();
    const subW   = Math.max(4, (bandW - subGap * (nBuckets - 1)) / nBuckets);

    /* axes (placeholder y-scale — domain set per mode by transitionTo) */
    const xAxis = g.append("g").attr("class","bsm-x-axis")
      .attr("transform", `translate(0,${innerH})`)
      .call(d3.axisBottom(x).tickFormat(R9))
      .call(s=>s.selectAll("text").attr("font-family","var(--mono)").attr("font-size","10px").attr("fill","var(--ink-2)"))
      .call(s=>s.selectAll("line,path").attr("stroke","var(--rule)"));

    const yScale = d3.scaleLinear().range([innerH, 0]);
    const yAxis  = g.append("g").attr("class","bsm-y-axis")
      .call(s=>s.selectAll("text").attr("font-family","var(--mono)").attr("font-size","10px").attr("fill","var(--ink-2)"))
      .call(s=>s.selectAll("line,path").attr("stroke","var(--hairline)"));

    /* gridlines — redraw on every mode change because y-scale domain shifts */
    const grid = g.append("g").attr("class","bsm-grid");

    /* Rects: one group per bucket, one rect per (bucket, month) */
    const rectGroups = g.selectAll("g.layer")
      .data(stackedSeries, d => d.k)
      .join("g")
        .attr("class","layer")
        .attr("fill", d => d.color)
        .style("opacity", d => activeFilter && activeFilter!==d.k ? 0.18 : 1);

    /* Rects: one group per bucket, one rect per (bucket, month).
       IMPORTANT: do NOT chain .append("title") into the rects selection —
       .append() returns the new children, not the rects, so `rects` must be
       captured before any child append.
       Also set explicit fill on each rect (not relying on group inheritance)
       so layers that lose their parent fill (e.g. after a Re-init) still
       render. */
    const rects = rectGroups.selectAll("rect")
      .data(d => d.series.map((s,i)=>({
        ym: months[i], layer: d, bucketIdx: stackedSeries.indexOf(d),
        y0: s[0], y1: s[1]
      })))
      .join("rect")
        .attr("rx", 2)
        .attr("fill", d => d.layer.color)
        .style("stroke","none");

    rects.append("title")
      .text(d => `${d.ym} · ${d.layer.label}: ${fmt(d.y1 - d.y0)} bills`);

    /* "total" label per month (stacked mode only). */
    const totalLabels = g.append("g").attr("class","bsm-totals")
      .selectAll("text")
      .data(months.map((ym,i)=>({ym, total: stackTop[i], cx: (x(ym) ?? 0) + bandW/2})))
      .join("text")
        .attr("text-anchor","middle")
        .attr("font-family","var(--mono)")
        .attr("font-size","10px")
        .attr("fill","var(--ink-2)")
        .text(d => d.total ? fmt(d.total) : "");

    /* stash layout params so transitionTo can read them without recomputing */
    svg.node().__bsm = {x, xAxis, yScale, yAxis, grid, innerW, innerH, rects, totalLabels, bandW, subW, subGap};

    /* Set initial geometry on every rect (stacked layout) so the chart is
       visible even if transitionTo is called later with a different mode.
       Each rect sits at its band start (x), stack top (y), with band width
       and stack-segment height. yScale is configured to match. This is the
       authoritative initial draw — transitionTo is the toggle path, not
       the initial-render path. */
    yScale.domain([0, y1Max * 1.05]).nice();
    rects
      .attr("x", d => x(d.ym) ?? 0)
      .attr("width", bandW)
      .attr("y", d => yScale(d.y1))
      .attr("height", d => Math.max(0, yScale(d.y0) - yScale(d.y1)));

    /* Position totals above each bar in stacked mode (they fade out in
       grouped mode via transitionTo's opacity handling). */
    totalLabels
      .attr("x", d => d.cx)
      .attr("y", (d, i) => yScale(stackTop[i]) - 4);

    /* y-axis ticks + gridlines for the stacked domain (reference furniture;
       not animated, redrawn on every mode change inside transitionTo). */
    yAxis.call(d3.axisLeft(yScale).ticks(5).tickFormat(d => fmt(d)))
      .call(s => s.selectAll("text").attr("font-family","var(--mono)").attr("font-size","10px").attr("fill","var(--ink-2)"))
      .call(s => s.selectAll("line,path").attr("stroke","var(--hairline)"));
    grid.selectAll("line")
      .data(yScale.ticks(5))
      .join("line")
        .attr("x1", 0).attr("x2", innerW)
        .attr("y1", d => yScale(d)).attr("y2", d => yScale(d))
        .attr("stroke","var(--hairline)").attr("stroke-dasharray","2 3");

    /* If the user previously switched to grouped, jump straight to that
       layout (no animation) so we don't flash stacked on every Re-init
       (e.g. from the resize observer). */
    if(mode !== "stacked"){
      transitionTo(mode, /*animate*/ false);
    }
  };

  /* Compute target attributes for each rect and total label.
     Returns a flat array of {el, ...attrs} entries — one per rect and one per
     total label — so transitionTo can iterate without DOM-element-keyed object
     lookups (which proved fragile). */
  const targetsFor = (m) => {
    const {x, yScale, rects, totalLabels, bandW, subW, subGap, innerH} = svg.node().__bsm;
    const yDomainMax = m === "stacked" ? y1Max : y0Max;
    yScale.domain([0, yDomainMax * 1.05]).nice();

    const out = [];
    rects.each(function(d){
      const ymX = x(d.ym);
      const el = this;
      if(m === "stacked"){
        out.push({el, x: ymX, y: yScale(d.y1), w: bandW, h: Math.max(0, yScale(d.y0) - yScale(d.y1))});
      } else {
        const h = Math.max(0, yScale(0) - yScale(d.y1 - d.y0));
        out.push({el, x: ymX + d.bucketIdx * (subW + subGap), y: yScale(0) - h, w: subW, h});
      }
    });
    totalLabels.each(function(d){
      const el = this;
      if(m === "stacked"){
        out.push({el, x: d.cx, y: yScale(stackTop[months.indexOf(d.ym)]) - 4, opacity: 1});
      } else {
        out.push({el, x: d.cx, y: yScale(0) + 12, opacity: 0});
      }
    });
    return out;
  };

  /* transitionTo — animate rects + totals between stacked and grouped layouts.
     Bostock's example uses two chained transitions (x/width first, then y/height)
     so sub-bars fly into position before resizing vertically — we replicate
     that sequencing for a smooth, legible morph. */
  const transitionTo = (target, animate = true) => {
    const layout = svg.node().__bsm;
    if(!layout) return;
    const {yAxis, grid, innerW} = layout;
    const targets = targetsFor(target);

    /* redraw y-axis ticks + gridlines for the new domain (no animation here —
       these are reference furniture, not the marks we want to draw attention to) */
    yAxis.call(d3.axisLeft(layout.yScale).ticks(5).tickFormat(d=>fmt(d)))
      .call(s=>s.selectAll("text").attr("font-family","var(--mono)").attr("font-size","10px").attr("fill","var(--ink-2)"))
      .call(s=>s.selectAll("line,path").attr("stroke","var(--hairline)"));
    grid.selectAll("line").remove();
    grid.selectAll("line")
      .data(layout.yScale.ticks(5))
      .join("line")
        .attr("x1", 0).attr("x2", innerW)
        .attr("y1", d=>layout.yScale(d)).attr("y2", d=>layout.yScale(d))
        .attr("stroke","var(--hairline)").attr("stroke-dasharray","2 3");

    /* Apply attr changes to each rect and total label.
       - animate=true: use d3 transitions (x/width → y/height/opacity, like
         Bostock's stacked-to-grouped example — sub-bars first fly horizontally,
         then resize vertically / fade).
       - animate=false: snap straight to target (used on first paint).        */
    targets.forEach(t => {
      if(!t || !t.el) return;                  // defensive: skip any undefined entry
      const s = d3.select(t.el);
      if(!animate){
        for(const k in t) if(k !== "el") s.attr(k, t[k]);
      } else {
        const hasOpacity = "opacity" in t;
        s.transition().duration(500).delay((d,i)=>i*10)
          .attr("x", t.x).attr("width", t.w)
          .selection()
          .transition().duration(500)
            .attr("y", t.y).attr("height", t.h)
            .attr("opacity", hasOpacity ? t.opacity : 1);
      }
    });
  };

  init();

  /* legend click-to-highlight — mirrors the bv-legend pattern in Zone 3 */
  legendHost.querySelectorAll(".bv-leg-item").forEach(item => {
    item.addEventListener("click", () => {
      const k = item.dataset.k;
      activeFilter = activeFilter === k ? null : k;
      legendHost.querySelectorAll(".bv-leg-item").forEach(el => {
        el.classList.toggle("bv-leg-sel", el.dataset.k === activeFilter);
      });
      d3.select(host).selectAll("g.layer")
        .style("opacity", d => activeFilter && activeFilter!==d.k ? 0.18 : 1);
    });
  });

  /* STACKED ↔ GROUPED toggle — mirrors buildChannelStackGroup */
  const segBtns = container.querySelectorAll("[data-bsm-mode]");
  segBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      const m = btn.dataset.bsmMode;
      if(m === mode) return;
      segBtns.forEach(b => b.classList.toggle("on", b === btn));
      mode = m;
      transitionTo(mode, true);
    });
  });

  /* re-render on container resize (debounced via rAF). Width changes affect
     scales/positions, so we re-init the chart geometry; the toggle state
     (mode) is preserved so the user doesn't lose their selection. */
  let raf = 0;
  let resizeTimer = 0;
  const ro = new ResizeObserver(() => {
    cancelAnimationFrame(raf);
    clearTimeout(resizeTimer);
    raf = requestAnimationFrame(() => {
      resizeTimer = setTimeout(() => {
        measure();
        init();                       // re-applies current `mode` via transitionTo
      }, 60);
    });
  });
  ro.observe(host);
}

/* ---- Summary Zone 3: status by month grouped by trustee ---- */
function buildStatusByMonthWithTrustee(container, rows, months){
  const BUCKETS = STATUS_BUCKETS;

  const trusteeMap={};
  rows.forEach(r=>{
    if(!r.tr) return;
    if(!trusteeMap[r.tr]) trusteeMap[r.tr]={scs:{},_totals:{out:0,sub:0,paid:0,other:0}};
    const scMap=trusteeMap[r.tr].scs;
    if(!scMap[r.sc]) scMap[r.sc]={};
    if(!scMap[r.sc][r.ym]) scMap[r.sc][r.ym]={out:0,sub:0,paid:0,other:0};
    const bk=BUCKETS.find(x=>x.sts.includes(r.st));
    if(bk){
      scMap[r.sc][r.ym][bk.k]+=r.bill||0;
      trusteeMap[r.tr]._totals[bk.k]+=r.bill||0;
    }
  });

  const trustees=Object.keys(trusteeMap).sort();

  container.innerHTML=`<div class="att-card">
    <div class="card-title">
      <h3>Submission status by month · grouped by trustee</h3>
      <div class="bv-legend" id="stLegend" style="display:flex;gap:10px;flex-wrap:wrap">
        ${BUCKETS.map(bk=>`<span class="bv-leg-item" data-k="${bk.k}" style="font-size:.72rem;cursor:pointer" title="${bk.sts.join(', ')}"><i style="display:inline-block;width:10px;height:10px;background:${bk.color};border-radius:2px;margin-right:3px"></i><b>${bk.label}</b></span>`).join("")}
      </div>
    </div>
    <div class="att-scroll">
      <table class="data bv" style="width:100%">
        <colgroup><col class="c-scheme">${months.map(()=>`<col class="c-month">`).join("")}</colgroup>
        <thead>
          <tr>
            <th class="c-scheme-th">Trustee / Scheme</th>
            ${months.map(m=>`<th class="att-th" style="text-align:center">${R9(m)}</th>`).join("")}
          </tr>
        </thead>
        <tbody></tbody>
      </table>
    </div>
    <div class="st-detail" id="stDetail"></div>
  </div>`;

  const tbody=container.querySelector("tbody");
  const detailHost=container.querySelector("#stDetail");
  const legendHost=container.querySelector("#stLegend");

  // Track which trustees are "open" — all open by default
  const openTrustees=new Set(trustees);

  // Legend filter state
  let activeFilter=null;
  const renderLegend=()=>{
    legendHost.querySelectorAll(".bv-leg-item").forEach(el=>{
      el.classList.toggle("bv-leg-sel", activeFilter===el.dataset.k);
    });
  };
  legendHost.querySelectorAll(".bv-leg-item").forEach(el=>{
    el.addEventListener("click",()=>{
      const k=el.dataset.k;
      activeFilter=activeFilter===k?null:k;
      renderLegend();
      drawAll();
    });
  });

  // Click on trustee label → toggle detail table
  const toggleTrustee=tr=>{
    if(openTrustees.has(tr)){ openTrustees.delete(tr); }
    else { openTrustees.add(tr); }
    drawAll();
  };

  const drawAll=()=>{
    tbody.innerHTML="";
    trustees.forEach(tr=>{
      const scs=Object.keys(trusteeMap[tr].scs).sort();
      const tot=trusteeMap[tr]._totals;
      const filteredTot=activeFilter?(tot[activeFilter]||0):Object.values(tot).reduce((a,b)=>a+b,0);
      const titleBreakdown=BUCKETS.map(bk=>`${bk.label}: ${fmt(tot[bk.k]||0)}`).join(" · ");

      // Trustee header row
      const trHdr=document.createElement("tr");
      trHdr.className="trustee-row";
      const isOpen=openTrustees.has(tr);
      const countLabel=activeFilter?`${fmt(filteredTot)} / ${fmt(Object.values(tot).reduce((a,b)=>a+b,0))}`:fmt(filteredTot);
      trHdr.innerHTML=`<td class="att-rowhead" title="${titleBreakdown}" colspan="${months.length+1}">
        <span class="trustee-name">${tr}</span>
        <span class="trustee-count">${countLabel} bills</span>
        <span class="chevron">${isOpen?"▲":"▼"}</span>
      </td>`;
      trHdr.addEventListener("click",()=>toggleTrustee(tr));
      tbody.appendChild(trHdr);

      // Scheme rows (only visible when this trustee is open)
      if(isOpen){
        scs.forEach(sc=>{
          const tr2=document.createElement("tr");
          tr2.className="scheme-row";
          let cells=`<td class="c-scheme" title="Filter by ${sc}">${sc}</td>`;
          months.forEach(ym=>{
            const vals=trusteeMap[tr].scs[sc]&&trusteeMap[tr].scs[sc][ym]||{out:0,sub:0,paid:0,other:0};
            const scTot=Object.values(vals).reduce((a,b)=>a+b,0);
            const filteredVal=activeFilter?(vals[activeFilter]||0):scTot;
            const miniBars=BUCKETS.filter(bk=>!activeFilter||bk.k===activeFilter).map(bk=>{
              const w=scTot>0?(vals[bk.k]/scTot*60).toFixed(1):"0";
              return `<div title="${bk.label}: ${fmt(vals[bk.k])}" style="width:${w}px;height:10px;background:${bk.color};border-radius:2px;flex:none"></div>`;
            }).join("");
            const label=activeFilter?`${fmt(filteredVal)} / ${fmt(scTot)}`:fmt(scTot);
            cells+=`<td style="text-align:center"><div style="display:flex;align-items:center;justify-content:center;gap:3px;height:14px;max-width:90px;margin:0 auto">
              <div style="flex:1;display:flex;gap:1px;align-items:center">${miniBars}</div>
              <span style="font-size:.7rem;font-family:var(--mono)">${label}</span>
            </div></td>`;
          });
          tr2.innerHTML=cells;
          tr2.querySelector("td:first-child").addEventListener("click",()=>{state.schemes=[sc];syncSchemes();render();});
          tbody.appendChild(tr2);
        });
      }
    });

    // Draw or clear detail table
    if(openTrustees.size>0){
      const trows=[];
      openTrustees.forEach(openTr=>{
        Object.keys(trusteeMap[openTr].scs).sort().forEach(sc=>{
          const scTotals={};
          months.forEach(ym=>{
            const a=groupBy(rows.filter(r=>r.tr===openTr&&r.sc===sc&&r.ym===ym),()=>0).get(0);
            scTotals[ym]=a||{bill:0,total:0};
          });
          const grandB=Object.values(scTotals).reduce((s,v)=>s+(v.bill||0),0);
          const grandT=activeFilter?grandB:Object.values(scTotals).reduce((s,v)=>s+(v.total||0),0);
          const row={sc,grandB,grandT};
          months.forEach(ym=>{ row[ym]=scTotals[ym]; });
          trows.push(row);
        });
      });
      detailHost.style.display="block";
      detailHost.innerHTML=`<div class="st-detail-title">Schemes for <b>${[...openTrustees].join(", ")}</b> — click a scheme to filter · ${activeFilter?'Filtered by '+BUCKETS.find(b=>b.k===activeFilter).label:'All statuses'}</div>`;
      const tblHost=el("div"); detailHost.appendChild(tblHost);
      buildTable(tblHost,{
        columns:[
          {key:"sc",label:"Scheme",align:"left",cls:()=>"sc"},
          ...months.map(m=>({key:m,label:R9(m),align:"center",fmt:(v)=>v?fmt(activeFilter?v.bill||0:v.total||0):"—"})),
          {key:"grandB",label:"Total bills",align:"center",fmt:v=>fmt(v)},
          {key:"grandT",label:"Submitted",align:"center",fmt:v=>fmt(v)},
        ],
        rows:trows,
        onRowClick:r=>{state.schemes=[r.sc];syncSchemes();render();}
      });
    } else {
      detailHost.style.display="none";
      detailHost.innerHTML="";
    }
  };

  drawAll();
}

/* ============================================================
   GENERIC GROUPED TAB (trustee / mode / freq / acct / scheme / status)
   ============================================================ */
