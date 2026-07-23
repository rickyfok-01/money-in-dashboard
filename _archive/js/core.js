"use strict";
/* ============================================================
   Money In Monitoring — single-file dashboard for MPF contribution bill
   & submit-channel statistics across daily DB snapshots. See docs/ for the
   per-tab spec this implements.
   ============================================================ */
const CAT = ["#2a78d6","#1baf7a","#eda100","#008300","#4a3aa7","#e34948","#e87ba4","#eb6834"];
const SEQ = ["#eaf2fd","#cde2fb","#86b6ef","#3987e5","#2a78d6","#1c5cab","#0d366b"];
const NEG = "#e34948", POS = "#2a78d6", MID = "#e3ddd0";
const CH_COLORS = {DDE:CAT[0],BATCH:CAT[1],PORTAL:CAT[2],BULKUPLOAD:CAT[3],OTHER:CAT[7]};
/* Status identity palette — 10 distinct, semantically grouped, STABLE across every chart.
   (There are 10 statuses but only 8 categorical hues, so an index-based CAT[i%8] mapping
   collides — REFUND_OVERPAID≡OPEN, WAIVED≡PARTIAL_SUBMIT — and reorders per chart. This
   fixed map makes each status the same color everywhere.) */
const STATUS_COLORS={
  OPEN:"#94a3b8", PARTIAL_SUBMIT:"#6da7ec", SUBMITTED:"#2a78d6", APPROVED:"#eda100",
  PARTIAL_PAID:"#1baf7a", FULLY_PAID:"#008300", CLOSED:"#334155",
  OVERPAID:"#d95926", REFUND_OVERPAID:"#e87ba4", WAIVED:"#4a3aa7"
};
const statusColor=s=>STATUS_COLORS[s]||CAT[DATA.statuses.indexOf(s)%8];
/* reusable color keys for diverging charts */
const KEY_MED  =[{c:POS,t:"at/above median"},{c:NEG,t:"below median"}];
const KEY_FULL =[{c:POS,t:"≥ 100%"},{c:NEG,t:"< 100%"}];
const KEY_DELTA=[{c:POS,t:"increase (B > A)"},{c:NEG,t:"decrease (B < A)"}];

const cssVar = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const $ = (s,r=document)=>r.querySelector(s);
const el = (t,c,h)=>{const e=document.createElement(t); if(c)e.className=c; if(h!=null)e.innerHTML=h; return e;};

/* ---- formatting ---- */
const fmt = n => (n==null||isNaN(n))?"—":Number(n).toLocaleString("en-US");
const pct = (x,d=1)=> (x==null||isNaN(x))?"—":(x*100).toFixed(d)+"%";
const pp  = (x,d=1)=> (x==null||isNaN(x))?"—":(x>=0?"+":"")+(x*100).toFixed(d)+"pp";
const signed = n => (n==null||isNaN(n))?"—":(n>=0?"+":"")+Number(n).toLocaleString("en-US");
const ontimeRate = a => a.total ? a.ontime/a.total : null;
const coverage   = a => a.bill  ? a.total/a.bill  : null;

/* ---- Contribution Pend Tagging helpers (per SPEC §3.5, §3.7–§3.9, §6) ---- */
// I9 — integer with thousands separator, no decimals.
const I9 = n => (n==null||isNaN(n))?"—":Math.round(Number(n)).toLocaleString("en-US");
// z9 — (num/denom)*100 as percent with one decimal; "—" when denom is 0.
const z9 = (num,denom) => (!denom||isNaN(num))?"—":(num/denom*100).toFixed(1)+"%";
// R9 — "2026-05" -> "May 26"
const MONTHS=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const R9 = ym => { const [y,m]=String(ym).split("-"); return (MONTHS[+m-1]||"?")+" "+String(y).slice(2); };
// tone — green/yellow/red per SPEC §2.3 (≤30 green, ≤50 yellow, else red)
const tone = p => p<=30?"green":p<=50?"yellow":"red";
const toneHex = t => t==="green"?"#16a34a":t==="yellow"?"#f59e0b":"#ef4444";
const toneVar = t => t==="green"?"var(--color-success,#16a34a)"
                  :t==="yellow"?"var(--color-warning,#f59e0b)"
                  :"var(--color-destructive,#ef4444)";

/* ---- state ---- */
const state = {
  snap: DATA.latest,
  snapA: DATA.snapshots[Math.max(0,DATA.snapshots.length-2)],
  snapB: DATA.latest,
  schemes: [...DATA.schemes],   /* multi-select: which schemes are in scope (all by default) */
  trustees: [...DATA.trustees], /* multi-select: which trustees are in scope (all by default) */
  at: "",                       /* account type filter (empty = all) */
  mfrom: DATA.months[0],
  mto: DATA.months[DATA.months.length-1],
  mode: "current",
  tab: "summary",
  sortKey: null, sortDir: -1,
  drill: null,
  settingsSub: "settings-theme",   /* which settings sub-section is active */
};

/* ---- row filtering ---- */
const schemeOn   = r => state.schemes.includes(r.sc);   /* multi-select membership */
const trusteeOn  = r => state.trustees.includes(r.tr);  /* multi-select membership */
const atOn       = r => !state.at || r.at === state.at;   /* account-type filter */
function rowsFor(snap, {mfrom=state.mfrom, mto=state.mto}={}){
  return DATA.rows.filter(r =>
    r.s === snap &&
    schemeOn(r) &&
    trusteeOn(r) &&
    atOn(r) &&
    r.ym >= mfrom && r.ym <= mto);
}
const inMonths = r => r.ym>=state.mfrom && r.ym<=state.mto;
const allSchemesSelected = () => state.schemes.length>=DATA.schemes.length;

/* ---- aggregation ---- */
function blank(){return{bill:0,total:0,ontime:0,dde:0,batch:0,portal:0,bulk:0,other:0,a:0,b:0,n:0};}
function add(a,r){a.bill+=r.bill;a.total+=r.total;a.ontime+=r.ontime;a.dde+=r.dde;a.batch+=r.batch;a.portal+=r.portal;a.bulk+=r.bulk;a.other+=r.other;a.a+=r.a||0;a.b+=r.b||0;a.n++;}
function groupBy(rows, keyFn){
  const m=new Map();
  for(const r of rows){const k=keyFn(r);let a=m.get(k);if(!a){a=blank();m.set(k,a);}add(a,r);}
  return m;
}
function totals(a){a.ontimePct=ontimeRate(a);a.coverage=coverage(a);a.chSum=a.dde+a.batch+a.portal+a.bulk+a.other;return a;}
/* ranked list from a groupBy map: [{k,...metrics,...derived}] */
function ranked(map, {order, sortBy="bill", topN=0, capOther=null}={}){
  let arr=[];
  for(const [k,a] of map){const x=totals({...a});x.k=k;arr.push(x);}
  if(order){arr.sort((a,b)=>order.indexOf(a.k)-order.indexOf(b.k));}
  else arr.sort((a,b)=>b[sortBy]-a[sortBy]);
  if(topN && arr.length>topN){
    const head=arr.slice(0,topN), tail=arr.slice(topN);
    const o=blank(); for(const t of tail){add(o,t);} totals(o); o.k=capOther||("Other ("+tail.length+")"); o._other=true;
    arr=[...head,o];
  }
  return arr;
}
/* months × key matrix */
function monthKeySeries(rows, keyFn, keys){
  const m=new Map();
  for(const r of rows){const k=keyFn(r);if(!m.has(k))m.set(k,new Map());const mm=m.get(k);let a=mm.get(r.ym);if(!a){a=blank();mm.set(r.ym,a);}add(a,r);}
  return keys.map(k=>{const mm=m.get(k)||new Map();return DATA.months.map(ym=>{const a=mm.get(ym)||blank();return totals(a);});});
}

/* ============================================================
   CHART LAYER
   ============================================================ */
