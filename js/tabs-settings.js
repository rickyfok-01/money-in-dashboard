"use strict";
const SETTINGS_KEYS = {
  animations:   "moneyin.display.animations",       // "1" / "0"
  landing:      "moneyin.landing.tab",              // tab id
  theme:        "moneyin.display.theme",             // theme id
};
function getPref(key, fallback){
  try { const v=localStorage.getItem(key); return v==null ? fallback : v; }
  catch(_) { return fallback; }
}
function setPref(key, val){
  try { localStorage.setItem(key, val); } catch(_) {}
}
function clearAllPrefs(){
  try {
    const ks=[];
    for(let i=0;i<localStorage.length;i++){
      const k=localStorage.key(i);
      if(k && k.startsWith("moneyin.")) ks.push(k);
    }
    ks.forEach(k=>localStorage.removeItem(k));
  } catch(_) {}
}

/* Theme catalogue — id must match body[data-theme="..."] selectors above. */
const ALL_THEMES = [
  { id:"default",     label:"Default",          sub:"Editorial paper",
    swatches:["#f4f2ec","#fcfcfb","#15110b","#2a78d6"] },
  { id:"bmw-m",       label:"Dark mode",         sub:"Motorsport canvas",
    swatches:["#000000","#1a1a1a","#ffffff","#1c69d4"] },
  { id:"apple",       label:"Apple",             sub:"Photography-first",
    swatches:["#ffffff","#ffffff","#1d1d1f","#0066cc"] },
  { id:"elevenlabs",  label:"Light · ElevenLabs",sub:"Voice-AI editorial",
    swatches:["#f5f5f5","#ffffff","#0c0a09","#292524"] },
];

/* Apply a theme by id: set the body attr (CSS does the rest), persist, and
   re-render so Chart.js picks up the new cssVar() values. */
function applyTheme(id){
  document.body.dataset.theme = id;
  setPref(SETTINGS_KEYS.theme, id);
  render();         // full re-render → charts re-read cssVar colours
}

function renderTheme(content){
  const activeTheme = document.body.dataset.theme || "default";
  content.appendChild(el("div","section-cap",
    `<div class="sc-label">Appearance</div><h2>Theme</h2>
     <p style="color:var(--muted);font-size:.88rem;margin:-6px 0 14px">Choose a visual style — the palette and surface tones apply instantly across the entire dashboard.</p>`));
  const tGrid = el("div","theme-grid"); content.appendChild(tGrid);
  ALL_THEMES.forEach(t=>{
    const tile = document.createElement("div");
    tile.className = "theme-tile" + (t.id===activeTheme?" selected":"");
    tile.dataset.themeId = t.id;
    tile.innerHTML =
      `<div class="theme-swatches">
         ${t.swatches.map((s,i)=>`<span class="theme-swatch" style="background:${s}" title="${i===0?"Page":i===1?"Surface":i===2?"Ink":"Accent"}: ${s}"></span>`).join("")}
         <span class="theme-swatch-label">${t.swatches.map((_,i)=>["P","S","I","A"][i]).join(" ")}</span>
       </div>
       <div class="theme-tile-name">${t.label}</div>
       <div class="theme-tile-sub">${t.sub}</div>
       <div class="theme-tile-check">&#10003; Active</div>`;
    tile.addEventListener("click", ()=> applyTheme(t.id));
    tGrid.appendChild(tile);
  });
}

const SETTINGS_TABS = [
  { id:"settings-display",    label:"Display",    sub:"Layout & motion" },
  { id:"settings-navigation", label:"Navigation", sub:"Sidebar behavior" },
  { id:"settings-theme",      label:"Theme",      sub:"Palette & surface" },
  { id:"settings-dataset",    label:"Dataset",    sub:"Source summary" },
  { id:"settings-about",      label:"About",      sub:"Version & notes" },
];

/* Apply the stored theme from localStorage (called in init, before first paint
   so there is no flash of unstyled default). Accepts ?theme= as an override. */
function initTheme(){
  // ?theme= param wins over localStorage (for deep-linking / demo)
  const urlParam = new URLSearchParams(window.location.search).get("theme");
  const saved = urlParam || getPref(SETTINGS_KEYS.theme, "default");
  // Validate — fall back to default if unknown id
  if(!ALL_THEMES.find(t=>t.id===saved)){
    if(urlParam) setPref(SETTINGS_KEYS.theme, "default");
    document.body.dataset.theme = "default";
  } else {
    // Persist the urlParam choice so a page refresh honours it
    if(urlParam && urlParam !== saved) setPref(SETTINGS_KEYS.theme, urlParam);
    document.body.dataset.theme = saved;
  }
}

function renderSettings(content){
  const activeTheme = document.body.dataset.theme || "default";
  const activeSection = SETTINGS_TABS.some(t=>t.id===state.settingsSub) ? state.settingsSub : "settings-theme";
  if(state.settingsSub !== activeSection) state.settingsSub = activeSection;

  /* ── In-page sub-tab strip ── */
  const tabsEl = el("div","settings-tabs");
  SETTINGS_TABS.forEach(t=>{
    const btn = document.createElement("button");
    btn.innerHTML = `<span class="settings-tab-label">${t.label}</span><span class="settings-tab-sub">${t.sub}</span>`;
    btn.dataset.sid = t.id;
    if(activeSection === t.id) btn.classList.add("on");
    btn.addEventListener("click", ()=>{
      state.settingsSub = t.id;
      render();
      const tgt = $("#content");
      if(tgt && tgt.scrollIntoView) tgt.scrollIntoView({block:"start"});
    });
    tabsEl.appendChild(btn);
  });
  content.appendChild(tabsEl);

  const panel = el("div","settings-panel");
  content.appendChild(panel);

  /* ── Display ── */
  const dispId = "settings-display";
  const displaySection = el("section","settings-section");
  displaySection.dataset.sid = dispId;
  displaySection.hidden = activeSection !== dispId;
  panel.appendChild(displaySection);
  displaySection.appendChild(el("div","section-cap",
    `<div class="sc-label" id="${dispId}">Preferences</div>
     <h2>Display</h2>`));

  const dispGrid = el("div","grid g2"); displaySection.appendChild(dispGrid);

  const animOn = getPref(SETTINGS_KEYS.animations, "1") !== "0";
  const cAnim = el("div","card");
  cAnim.innerHTML = `<div class="card-title"><h3>Card fade-up animation</h3><span class="hint">On load</span></div>
    <div class="chart-wrap" style="display:block;padding:8px 4px">
      <label style="display:flex;align-items:center;gap:10px;font-size:.92rem;color:var(--ink);cursor:pointer">
        <input type="checkbox" id="setAnim" ${animOn?"checked":""} style="width:16px;height:16px;accent-color:var(--accent)">
        <span>Staggered fade-up on tab change</span>
      </label>
      <div class="caption" style="margin-top:10px">Cards rise into place when a tab renders. Disabling this also removes the chart-delay shimmer.</div>
    </div>`;
  dispGrid.appendChild(cAnim);

  const landingId = getPref(SETTINGS_KEYS.landing, "summary");
  const landingOpts = TABS.filter(t=>t.id!=="settings")
    .map(t=>`<option value="${t.id}" ${t.id===landingId?"selected":""}>${t.n} · ${t.title}</option>`).join("");
  const cLand = el("div","card");
  cLand.innerHTML = `<div class="card-title"><h3>Landing tab</h3><span class="hint">On app load</span></div>
    <div class="chart-wrap" style="display:block;padding:8px 4px">
      <select id="setLanding" style="width:100%;padding:8px 10px;border:1px solid var(--hairline);border-radius:6px;background:var(--surface);font:inherit;color:var(--ink)">
        ${landingOpts}
      </select>
      <div class="caption" style="margin-top:10px">Which tab opens when the dashboard first loads. Default: Summary (00).</div>
    </div>`;
  dispGrid.appendChild(cLand);

  /* ── Navigation ── */
  const navId = "settings-navigation";
  const navSection = el("section","settings-section");
  navSection.dataset.sid = navId;
  navSection.hidden = activeSection !== navId;
  panel.appendChild(navSection);
  navSection.appendChild(el("div","section-cap",
    `<div class="sc-label" id="${navId}">Preferences</div>
     <h2>Navigation</h2>`));
  const navGrid = el("div","grid g2"); navSection.appendChild(navGrid);

  const cResetNav = el("div","card");
  cResetNav.innerHTML = `<div class="card-title"><h3>Reset menu groups</h3><span class="hint">Expand every group</span></div>
    <div class="chart-wrap" style="display:block;padding:8px 4px">
      <button type="button" id="setResetNav"
              style="padding:8px 14px;background:var(--ink);color:#fcfcfb;border:1px solid var(--ink);border-radius:6px;font:inherit;cursor:pointer">
        Expand all groups
      </button>
      <div class="caption" style="margin-top:10px">By default, every nav group other than "Overview" starts collapsed. Click to clear all per-group collapsed flags so every group renders expanded.</div>
    </div>`;
  navGrid.appendChild(cResetNav);

  const cReset = el("div","card");
  cReset.innerHTML = `<div class="card-title"><h3>Reset all preferences</h3><span class="hint">Clears every moneyin.* key</span></div>
    <div class="chart-wrap" style="display:block;padding:8px 4px">
      <button type="button" id="setResetAll"
              style="padding:8px 14px;background:var(--surface);color:var(--ink);border:1px solid var(--rule);border-radius:6px;font:inherit;cursor:pointer">
        Reset all preferences
      </button>
      <div class="caption" style="margin-top:10px">Clears sidebar collapse state, per-group flags, animation toggle, landing tab, theme, and every other localStorage key this app writes. The page will reload to apply defaults.</div>
    </div>`;
  navGrid.appendChild(cReset);

  /* ── Theme ── */
  const themeId = "settings-theme";
  const themeSection = el("section","settings-section");
  themeSection.dataset.sid = themeId;
  themeSection.hidden = activeSection !== themeId;
  panel.appendChild(themeSection);
  themeSection.appendChild(el("div","section-cap",
    `<div class="sc-label" id="${themeId}">Preferences</div>
     <h2>Theme</h2>
     <p>The chart colour palette and data encoding stay stable across all themes.</p>`));
  const tGrid = el("div","theme-grid"); themeSection.appendChild(tGrid);
  ALL_THEMES.forEach(t=>{
    const tile = document.createElement("div");
    tile.className = "theme-tile" + (t.id===activeTheme?" selected":"");
    tile.dataset.themeId = t.id;
    tile.innerHTML =
      `<div class="theme-swatches">
         ${t.swatches.map((s,i)=>`<span class="theme-swatch" style="background:${s}" title="${i===0?"Page":i===1?"Surface":i===2?"Ink":"Accent"}: ${s}"></span>`).join("")}
         <span class="theme-swatch-label">${t.swatches.map((_,i)=>["P","S","I","A"][i]).join(" ")}</span>
       </div>
       <div class="theme-tile-name">${t.label}</div>
       <div class="theme-tile-sub">${t.sub}</div>
       <div class="theme-tile-check">&#10003; Active</div>`;
    tile.addEventListener("click", ()=> applyTheme(t.id));
    tGrid.appendChild(tile);
  });

  /* ── Dataset info (read-only) ── */
  const snapList = DATA.snapshots || [];
  const schemeList = DATA.schemes || [];
  const monthList = DATA.months || [];
  const trusteeCount = (DATA.trustees||[]).length;
  const statusCount = (DATA.statuses||[]).length;
  const infoRows = [
    ["Snapshots available", snapList.length],
    ["Latest snapshot", snapList.length ? snapList[snapList.length-1] : "—"],
    ["Schemes", schemeList.length],
    ["Trustees", trusteeCount],
    ["Statuses", statusCount],
    ["Contribution months", monthList.length + (monthList.length?`  (${monthList[0]} → ${monthList[monthList.length-1]})`:"")],
    ["Source", `<span class="mono">data/sql/contribution.sql</span> (Q2)`],
    ["Spec", `<a href="docs/README.md">docs/</a>`],
  ];
  const dataId = "settings-dataset";
  const dataSection = el("section","settings-section");
  dataSection.dataset.sid = dataId;
  dataSection.hidden = activeSection !== dataId;
  panel.appendChild(dataSection);
  dataSection.appendChild(el("div","section-cap",
    `<div class="sc-label" id="${dataId}">Dataset</div>
     <h2>Dataset</h2>`));
  const tHost = el("div"); dataSection.appendChild(tHost);
  buildTable(tHost, {
    columns: [
      {key:"k", label:"Field",   align:"left"},
      {key:"v", label:"Value",   align:"left"},
    ],
    rows: infoRows.map(([k,v])=>({k, v})),
  });

  /* ── About ── */
  const aboutId = "settings-about";
  const aboutSection = el("section","settings-section");
  aboutSection.dataset.sid = aboutId;
  aboutSection.hidden = activeSection !== aboutId;
  panel.appendChild(aboutSection);
  aboutSection.appendChild(el("div","section-cap",
    `<div class="sc-label" id="${aboutId}">About</div>
     <h2>About this dashboard</h2>`));
  const about = el("div","card");
  about.innerHTML = `<div class="card-title"><h3>Money In Monitoring</h3><span class="hint">v1</span></div>
    <div class="chart-wrap" style="display:block;padding:4px 4px 8px;line-height:1.55;color:var(--ink-2);font-size:.92rem">
      A snapshot-aware view of MPF contribution bill &amp; submit-channel statistics.
      Pick a snapshot, drill into a scheme, then toggle Compare / Trend to put any
      metric across two snapshots or six months. The data layer (<span class="mono">data.js</span>)
      is regenerated from <span class="mono">data/con-bill-6mon-*.csv</span> via
      <span class="mono">scripts/build_data.py</span> — no hand-edits.
      <br><br>
      Plans &amp; per-tab specs live in <a href="docs/README.md">docs/</a>.
    </div>`;
  aboutSection.appendChild(about);

  /* ── Wire up controls ── */
  const animEl = cAnim.querySelector("#setAnim");
  document.body.dataset.anim = animOn ? "1" : "0";
  animEl && animEl.addEventListener("change", ()=>{
    setPref(SETTINGS_KEYS.animations, animEl.checked ? "1" : "0");
    document.body.dataset.anim = animEl.checked ? "1" : "0";
  });

  const landEl = cLand.querySelector("#setLanding");
  landEl && landEl.addEventListener("change", ()=>{
    setPref(SETTINGS_KEYS.landing, landEl.value);
  });

  const resetNavEl = cResetNav.querySelector("#setResetNav");
  resetNavEl && resetNavEl.addEventListener("click", ()=>{
    try {
      const ks=[];
      for(let i=0;i<localStorage.length;i++){
        const k=localStorage.key(i);
        if(k && k.startsWith(NAV_KEY_PREFIX)) ks.push(k);
      }
      ks.forEach(k=>localStorage.removeItem(k));
    } catch(_) {}
    renderNav();
  });

  const resetAllEl = cReset.querySelector("#setResetAll");
  resetAllEl && resetAllEl.addEventListener("click", ()=>{
    clearAllPrefs();
    location.reload();
  });

  /* Highlight the active sub-tab on click — re-apply from scroll position */
  const observer = new IntersectionObserver(entries=>{
    entries.forEach(e=>{
      if(e.isIntersecting){
        tabsEl.querySelectorAll("button").forEach(b=>{
          b.classList.toggle("active", b.dataset.sid === e.target.id);
        });
      }
    });
  }, {rootMargin:"-20% 0px -70% 0px"});
  tabs.forEach(t=>{
    const el2 = document.getElementById(t.id);
    if(el2) observer.observe(el2);
  });
}

/* ============================================================
   Contribution Pend Tagging (Overview tab)
   Implements SPEC_contribution_tagging_by_scheme.md
   Reuses the global filter bar (Snapshot, Scheme, Month from/to, Mode)
   shared with renderSummary so the experience is consistent.
   ============================================================ */
