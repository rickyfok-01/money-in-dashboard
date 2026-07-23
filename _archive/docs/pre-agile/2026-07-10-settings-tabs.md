# Settings Tabs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the Settings page into a real tabbed view with one section visible at a time, and hide the global filter toolbar while Settings is open.

**Architecture:** Keep the existing single-file dashboard layout, but split the Settings renderer into a tab strip plus one active section panel. Reuse the current settings content and theme tokens, while making the active section switch instantly instead of scrolling through a long page.

**Tech Stack:** HTML, vanilla JavaScript, CSS custom properties

---

### Task 1: Hide the global toolbar on Settings

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Update the Settings-aware render path**

```js
const toolbar = $("#toolbar");
if (toolbar) toolbar.hidden = t.id === "settings";
```

- [ ] **Step 2: Verify the toolbar still appears on non-Settings tabs**

Run: `rg -n "toolbar.hidden = t.id === \"settings\"" index.html`
Expected: one match inside the main render flow.

### Task 2: Convert Settings into a real tabbed panel

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Add tab metadata and a section renderer**

```js
const SETTINGS_TABS = [
  { id: "settings-display", label: "Display" },
  { id: "settings-navigation", label: "Navigation" },
  { id: "settings-theme", label: "Theme" },
  { id: "settings-dataset", label: "Dataset" },
  { id: "settings-about", label: "About" },
];
```

- [ ] **Step 2: Render only the active Settings section**

```js
function renderSettings(content) {
  const tabsEl = el("div", "settings-tabs");
  const panel = el("div", "settings-panel");
  content.appendChild(tabsEl);
  content.appendChild(panel);
  renderSettingsSection(panel, state.settingsSub);
}
```

- [ ] **Step 3: Make the active section switch without scrolling**

```js
btn.addEventListener("click", () => {
  state.settingsSub = t.id;
  render();
});
```

- [ ] **Step 4: Verify the section swap still preserves theme actions and reset buttons**

Run: open `index.html`, go to Settings, click each tab.
Expected: only the selected section is visible; Theme tiles and buttons still work.

### Task 3: Restyle the tab strip to match the theme cards

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Replace the segmented-control look with tile-style buttons**

```css
#tab-settings .settings-tabs {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 10px;
}
```

- [ ] **Step 2: Give active tabs the same accent treatment as selected theme tiles**

```css
#tab-settings .settings-tabs button.on {
  border-color: var(--accent);
  box-shadow: 0 0 0 1px var(--accent);
}
```

- [ ] **Step 3: Verify the tab strip reads as part of the existing theme system**

Run: open Settings in each theme.
Expected: tab styling inherits the active theme colors and remains readable.
