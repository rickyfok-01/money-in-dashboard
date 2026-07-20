"use strict";
/* ============================================================
   DDA Dimensions (#28) — Direct-Debit (Authorize) 30-day mandates
   broken down by scheme / trustee / account-type.

   A custom dimension renderer (mirrors renderChannel's Current /
   Compare / Trend split), pointed at the DD access helpers. DATA.dda30
   is snapshot-level (no `ym`), so Trend runs across DATA.dda30.snapshots,
   NOT across contribution months.

   REUSES globals (all defined in modules that load BEFORE this one —
   do NOT redeclare):
     dda30For(snap)   js/tabs-summary-v2.js:29  — dda30 rows for one snap,
                              scoped by the global scheme + trustee pickers
     sumAO(arr,key)   js/tabs-summary-v2.js:35  — Σ of one measure over rows
     ddTone(v)        js/tabs-dd-overview.js:27 — rate tone band (≥.98 g / ≥.95 y / else r)
   Also reuses: el, card, buildTable, newBar, newLine, newDoughnut,
     pct, fmt, signed, pp, cssVar, POS, NEG, CAT, KEY_DELTA, state, DATA,
     render, syncSchemes (core.js / charts.js / app.js).
   ============================================================ */

/* tab-internal dimension toggle — default Scheme. This is LOCAL state (it is
   NOT the global #scopeAllocBy); the deliberate duplication of the DDI twin's
   toggle keeps this module conflict-free for the parallel build. The Reviewer
   may DRY both into tabs-dd-overview.js later (non-blocking). */
let __ddaDim = "sc";          /* "sc" Scheme | "tr" Trustee | "at" Account type */
const DDA_DIM_OPTIONS = [
  {k:"sc", label:"Scheme"},
  {k:"tr", label:"Trustee"},
  {k:"at", label:"Account type"},
];

/* outcome identity — matches DD Overview's DDA donut order + colours
   (Active·Inactive·Rejected·Suspend), so identity reads the same everywhere. */
const DDA_MIX_KEYS   = ["active","inactive","rejected","suspend"];
const DDA_MIX_LABELS = ["Active","Inactive","Rejected","Suspend"];
const DDA_MIX_COLORS = ["#1baf7a","#94a3b8","#ef4444","#f59e0b"];

/* ddTone → hex. Reuses ddTone's thresholds (single source of truth) but maps
   to an inline colour so the rate cell/bar is tinted without depending on a
   new styles.css rule (the table is table.data, not table.alloc, so the
   existing scoped .tone-g/y/r rules do not reach it). */
function ddaToneHex(v){
  const c = ddTone(v);
  return c==="tone-g" ? "#16a34a" : c==="tone-y" ? "#f59e0b" : c==="tone-r" ? "#ef4444" : "";
}

/* human label for the active dimension */
function ddaDimLabel(){
  const o = DDA_DIM_OPTIONS.find(x=>x.k===__ddaDim);
  return o ? o.label : "Scheme";
}
/* keyFn for the active dimension */
function ddaDimKeyFn(){
  return __ddaDim==="sc" ? r=>r.sc : __ddaDim==="tr" ? r=>r.tr : r=>r.at;
}

/* local aggregator — groups dda30 rows for ONE snapshot by a key fn, sums the
   DDA measures, and derives the metrics as a ratio of sums (never a mean of
   per-row ratios). Returns rows sorted by total desc. */
function ddaDimAgg(rows, keyFn){
  const map = new Map();
  for(const r of rows){
    const k = keyFn(r); if(!k) continue;             /* skip blank account types etc. */
    let a = map.get(k);
    if(!a){ a = {k,total:0,submitted_pig:0,submitted_bank:0,active:0,inactive:0,rejected:0,suspend:0};
            map.set(k,a); }
    a.total         += r.total         || 0;
    a.submitted_pig += r.submitted_pig || 0;
    a.submitted_bank+= r.submitted_bank|| 0;
    a.active        += r.active        || 0;
    a.inactive      += r.inactive      || 0;
    a.rejected      += r.rejected      || 0;
    a.suspend       += r.suspend       || 0;
  }
  const arr = [...map.values()];
  for(const a of arr){
    a.activeRate   = a.total>0 ? a.active   / a.total : null;
    a.inactiveShare= a.total>0 ? a.inactive / a.total : null;
    a.rejectedShare= a.total>0 ? a.rejected / a.total : null;
    a.suspendShare = a.total>0 ? a.suspend  / a.total : null;
  }
  arr.sort((x,y)=> (y.total-x.total) || (x.k<y.k?-1:x.k>y.k?1:0));
  return arr;
}

/* dimension toggle UI — reuses the existing .alloc-toggle pill (already
   styled), so the tab renders standalone without any styles.css change. */
function ddaDimToggle(parent){
  const wrap = el("div","dda-dim-bar");
  wrap.style.cssText = "display:flex;align-items:center;gap:10px;margin:2px 2px 14px;flex-wrap:wrap";
  wrap.innerHTML = `<span class="dda-dim-label" style="font-size:.7rem;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);font-weight:600">Group by</span>` +
    `<div class="alloc-toggle" role="group" aria-label="DDA dimension">` +
    DDA_DIM_OPTIONS.map(o=>`<button type="button" data-dim="${o.k}" class="${__ddaDim===o.k?"on":""}">${o.label}</button>`).join("") +
    `</div>`;
  parent.appendChild(wrap);
  wrap.querySelectorAll("button[data-dim]").forEach(b=>{
    b.addEventListener("click", ()=>{ __ddaDim = b.dataset.dim; render(); });
  });
}

/* ============================================================
   MAIN RENDER — dispatch on state.mode
   ============================================================ */
function renderDDADim(content){
  /* missing-data guard (mirrors renderDDOverview) */
  if(!DATA.dda30 || !DATA.dda30.rows || !DATA.dda30.rows.length){
    content.appendChild(el("div","pend-empty","No DDA data."));
    return;
  }
  if(state.mode==="compare") return DDADimCompare(content);
  if(state.mode==="trend")   return DDADimTrend(content);
  DDADimCurrent(content);
}

/* ---- Current mode ---- */
function DDADimCurrent(content){
  ddaDimToggle(content);
  const arr = ddaDimAgg(dda30For(state.snap), ddaDimKeyFn());
  if(!arr.length){ content.appendChild(el("div","pend-empty","No DDA rows under the current filter.")); return; }

  const cg = el("div","grid g2"); content.appendChild(cg);

  /* A. outcome mix per dim — stacked horizontal bar, categorical identity */
  const cA = card(cg, `DDA outcome mix per ${ddaDimLabel()}`, "Active · Inactive · Rejected · Suspend");
  newBar(cA.canvas,{ labels:arr.map(a=>a.k), indexAxis:"y", stacked:true, legend:true,
    datasets:DDA_MIX_KEYS.map((mk,i)=>({ label:DDA_MIX_LABELS[i], data:arr.map(a=>a[mk]),
      backgroundColor:DDA_MIX_COLORS[i], stack:"s" })) });

  /* B. active rate by dim — horizontal bar, tone-coloured vs ddTone bands */
  const cB = card(cg, `Active rate by ${ddaDimLabel()}`, "Σactive / Σtotal · tone ≥98% / ≥95%");
  newBar(cB.canvas,{ labels:arr.map(a=>a.k), indexAxis:"y", pctScale:true,
    datasets:[{ data:arr.map(a=>a.activeRate||0),
      backgroundColor:arr.map(a=>ddaToneHex(a.activeRate)), maxBarThickness:16, borderRadius:3 }] });

  /* C. overall outcome mix — donut (part-to-whole) */
  const tot = arr.reduce((o,a)=>{o.active+=a.active;o.inactive+=a.inactive;o.rejected+=a.rejected;o.suspend+=a.suspend;return o;},
    {active:0,inactive:0,rejected:0,suspend:0});
  const cC = card(cg, "Overall DDA outcome mix", "Part-to-whole");
  newDoughnut(cC.canvas,{ labels:DDA_MIX_LABELS, data:[tot.active,tot.inactive,tot.rejected,tot.suspend], colors:DDA_MIX_COLORS });

  /* table — the relief channel (identity never colour-alone) */
  content.appendChild(el("div","section-cap",`<h2>DDA — data</h2>`));
  const host = el("div"); content.appendChild(host);
  buildTable(host,{ columns:[
    {key:"k",            label:ddaDimLabel().toUpperCase(), align:"left", cls:()=>(__ddaDim==="sc"?"sc":"")},
    {key:"total",        label:"Total",      fmt:v=>fmt(v)},
    {key:"active",       label:"Active",     fmt:v=>fmt(v)},
    {key:"activeRate",   label:"Active %",   fmt:v=>`<span style="color:${ddaToneHex(v)}">${pct(v)}</span>`},
    {key:"inactive",     label:"Inactive",   fmt:v=>fmt(v)},
    {key:"rejected",     label:"Rejected",   fmt:v=>fmt(v)},
    {key:"suspend",      label:"Suspend",    fmt:v=>fmt(v)},
    {key:"submitted_bank",label:"Subm. bank",fmt:v=>fmt(v)},
  ], rows:arr, defaultSort:"total",
    onRowClick: __ddaDim==="sc" ? (r=>{ state.schemes=[r.k]; syncSchemes(); render(); }) : null });
}

/* ---- Compare mode ---- */
function DDADimCompare(content){
  ddaDimToggle(content);
  const keyFn = ddaDimKeyFn();
  const A = ddaDimAgg(dda30For(state.snapA), keyFn);
  const B = ddaDimAgg(dda30For(state.snapB), keyFn);
  const mapA = new Map(A.map(a=>[a.k,a])), mapB = new Map(B.map(b=>[b.k,b]));
  const keys = [...new Set([...mapA.keys(),...mapB.keys()])];
  /* union per dim with B−A deltas; drop dims with no volume in either snapshot */
  const d = keys.map(k=>{
    const a=mapA.get(k), b=mapB.get(k);
    const tA=a?a.total:0, tB=b?b.total:0;
    const rA=a?a.activeRate:null, rB=b?b.activeRate:null;
    return { k, tA, tB, rA, rB,
      dt: tB-tA,
      dRate: (rB==null?0:rB)-(rA==null?0:rA),
      has: (a&&a.total)||(b&&b.total) };
  }).filter(r=>r.has)
    .sort((x,y)=> Math.abs(y.dRate)-Math.abs(x.dRate) || ((y.tB+y.tA)-(x.tB+x.tA)));

  const cg = el("div","grid g2"); content.appendChild(cg);

  /* Δ active rate (pp) per dim — diverging bar */
  const cA = card(cg, `Δ active rate (pp) by ${ddaDimLabel()} · ${state.snapB}−${state.snapA}`,
    "B − A · diverging", null, KEY_DELTA);
  newBar(cA.canvas,{ labels:d.map(r=>r.k), indexAxis:"y", pctScale:true,
    datasets:[{ data:d.map(r=>r.dRate), backgroundColor:d.map(r=>r.dRate>=0?POS:NEG),
      maxBarThickness:18, borderRadius:3 }] });

  /* totals A vs B — grouped horizontal bar */
  const cB = card(cg, `DDA total · A vs B`, `${state.snapA} vs ${state.snapB}`);
  newBar(cB.canvas,{ labels:d.map(r=>r.k), indexAxis:"y",
    datasets:[
      {label:`A ${state.snapA}`, data:d.map(r=>r.tA), backgroundColor:cssVar("--muted"), borderRadius:3},
      {label:`B ${state.snapB}`, data:d.map(r=>r.tB), backgroundColor:POS, borderRadius:3}],
    legend:true });

  content.appendChild(el("div","note",
    `Comparing ${state.snapA} → ${state.snapB}. Deltas are B − A. Active-rate Δ is in percentage points.`));

  /* table — A | B | Δ */
  content.appendChild(el("div","section-cap",`<h2>DDA — A vs B</h2>`));
  const host = el("div"); content.appendChild(host);
  buildTable(host,{ columns:[
    {key:"k", label:ddaDimLabel().toUpperCase(), align:"left", cls:()=>(__ddaDim==="sc"?"sc":"")},
    {key:"tA", label:`Total · ${state.snapA}`, fmt:v=>fmt(v)},
    {key:"tB", label:`Total · ${state.snapB}`, fmt:v=>fmt(v)},
    {key:"dt", label:"Δ Total", fmt:v=>`<span class="${v>0?"delta-up":v<0?"delta-dn":"delta-flat"}">${signed(v)}</span>`},
    {key:"rA", label:`Active · ${state.snapA}`, fmt:v=>pct(v)},
    {key:"rB", label:`Active · ${state.snapB}`, fmt:v=>pct(v)},
    {key:"dRate", label:"Δ Active", sortVal:v=>v,
      fmt:v=>`<span class="${v>0?"delta-up":v<0?"delta-dn":"delta-flat"}">${pp(v)}</span>`},
  ], rows:d, defaultSort:"dRate",
    onRowClick: __ddaDim==="sc" ? (r=>{ state.schemes=[r.k]; syncSchemes(); render(); }) : null });
}

/* ---- Trend mode ----
   DD data is snapshot-level (no month dimension), so the trend runs across
   DATA.dda30.snapshots. A dataset with <2 snapshots gets the pend-empty
   guard instead of a broken chart (dda30 ships 5, so this is a safety net). */
function DDADimTrend(content){
  ddaDimToggle(content);
  const snaps = (DATA.dda30 && DATA.dda30.snapshots) || [];
  if(snaps.length < 2){
    content.appendChild(el("div","pend-empty","Not enough snapshots yet for a DDA trend (need ≥2)."));
    return;
  }
  /* overall metrics per snapshot (within the global scheme/trustee scope).
     One axis per chart → rate (pct) and counts are drawn as separate charts. */
  const perSnap = snaps.map(s=>{
    const rows = dda30For(s);
    const total=sumAO(rows,"total"), active=sumAO(rows,"active"),
      inactive=sumAO(rows,"inactive"), rejected=sumAO(rows,"rejected"), suspend=sumAO(rows,"suspend");
    return { snap:s, total, active, inactive, rejected, suspend,
      activeRate: total>0 ? active/total : null };
  });

  const cg = el("div","grid g2"); content.appendChild(cg);

  /* active rate across snapshots */
  const cA = card(cg, "Active rate over snapshots", "Σactive / Σtotal · snapshot axis");
  newLine(cA.canvas,{ labels:snaps, pctScale:true, legend:false, datasets:[
    {label:"Active %", data:perSnap.map(p=>p.activeRate||0), borderColor:POS, pointBackgroundColor:POS} ] });

  /* total / active / rejected counts across snapshots */
  const cB = card(cg, "DDA counts over snapshots", "Total / Active / Rejected");
  newLine(cB.canvas,{ labels:snaps, legend:true, datasets:[
    {label:"Total",    data:perSnap.map(p=>p.total),    borderColor:CAT[0], pointBackgroundColor:CAT[0]},
    {label:"Active",   data:perSnap.map(p=>p.active),   borderColor:CAT[1], pointBackgroundColor:CAT[1]},
    {label:"Rejected", data:perSnap.map(p=>p.rejected), borderColor:"#ef4444", pointBackgroundColor:"#ef4444"} ] });

  content.appendChild(el("div","note",
    "Trend is across snapshot dates — DDA data has no month dimension."));

  /* per-snapshot table */
  content.appendChild(el("div","section-cap",`<h2>DDA — per snapshot</h2>`));
  const host = el("div"); content.appendChild(host);
  buildTable(host,{ columns:[
    {key:"snap",      label:"Snapshot", align:"left"},
    {key:"total",     label:"Total",    fmt:v=>fmt(v)},
    {key:"active",    label:"Active",   fmt:v=>fmt(v)},
    {key:"activeRate",label:"Active %", fmt:v=>`<span style="color:${ddaToneHex(v)}">${pct(v)}</span>`},
    {key:"inactive",  label:"Inactive", fmt:v=>fmt(v)},
    {key:"rejected",  label:"Rejected", fmt:v=>fmt(v)},
    {key:"suspend",   label:"Suspend",  fmt:v=>fmt(v)},
  ], rows:perSnap, sortable:false });
}
