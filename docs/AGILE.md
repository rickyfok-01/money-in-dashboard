# AGILE — iteration playbook

How this dashboard is built one iteration at a time. The **superpowers plugin**
(`superpowers@claude-plugins-official`, already enabled in `.claude/settings.json`)
is the backbone: an iteration is a **superpowers plan** run by a **4-role
subagent team**. This doc is the glue that maps the team to the plugin.

> Read `docs/STATUS.md` first to learn *which* iteration is current. This file
> tells you *how* an iteration runs.

---

## 1. The system at a glance

| File | Role | Lifecycle |
|---|---|---|
| `docs/STATUS.md` | current-state pointer (≤60 lines): which iter, next free tab | edited in place every close |
| `docs/ROADMAP.md` | sequenced backlog: 3 areas × 3 levels → iterations | edited as priorities shift |
| `docs/ITERATION-LOG.md` | append-only history, one row per iteration | append-only (never edit past rows) |
| `docs/superpowers/plans/_template.md` | the iteration-plan template | edited in place (rarely) |
| `docs/superpowers/plans/{date}-iter-NN-*.md` | the **one** current WIP plan | created → `git mv` to archive at close |
| `docs/archive/iter-NN-{slug}/` | closed iteration: handoff + STATUS snapshot + notes | write-once history |
| `.claude/agents/{analyst,engineer,reviewer,doc-keeper}.md` | the 4 role subagents | edited in place (rarely) |
| `docs/00-architecture.md`, `AGENTS.md`, `CLAUDE.md` | durable foundation + traps | edited in place (never archived) |

---

## 2. Iteration lifecycle — 4 phases, 4 subagents

One iteration = the plan at `docs/superpowers/plans/{date}-iter-NN-{slug}.md`,
run end to end by these roles. The **lead** is the driving session (ideally a
fresh context per iteration — see §4). Spawn each role with the `Agent` tool and
hand off via `SendMessage`; the handoff artifact is named in the table.

| # | Phase | Subagent (`.claude/agents/`) | Superpowers skill | Input | Output (handoff artifact) | Done when |
|---|---|---|---|---|---|---|
| 1 | **Define** | `analyst` | `superpowers:brainstorming` → `superpowers:writing-plans` | ROADMAP row N + DATA row shapes (`scripts/build_data.py`) | the iteration plan, filled from `_template.md` | every template section complete; line refs grep-verifiable; DATA keys + reference tab cited |
| 2 | **Build** | `engineer` | `superpowers:subagent-driven-development` (or `superpowers:executing-plans`); `superpowers:test-driven-development` where a unit is testable | the iteration plan | code: `js/tabs-*.js`, `js/app.js` (`TABS`@~131, `NAV_GROUPS`@~246), `index.html` script tag, `styles.css`, `docs/NN-*.md` | jsdom smoke 0 errors; all plan acceptance boxes ticked |
| 3 | **Verify** | `reviewer` | `superpowers:requesting-code-review` + repo `code-review` skill; `superpowers:verification-before-completion` | the diff + plan's acceptance criteria | review findings (correctness + reuse/efficiency) | 0 blocking findings, or each addressed via a follow-up (engineer runs `superpowers:receiving-code-review`) |
| 4 | **Close** | `doc-keeper` | `superpowers:finishing-a-development-branch` + procedural | shipped plan + diff + `STATUS.md` | `docs/archive/iter-NN-{slug}/`, `ITERATION-LOG` row, `STATUS` refresh | archive checklist (template §10) complete; `STATUS` ≤60 lines |

Loop on blocking findings: Reviewer → `SendMessage(engineer, findings)` → Engineer
fixes → back to Reviewer until sign-off, then Doc-keeper.

---

## 3. The team (spawning the roles)

```
Agent(subagent_type:"analyst",    name:"analyst")     # phase 1
Agent(subagent_type:"engineer",   name:"engineer")    # phase 2
Agent(subagent_type:"reviewer",   name:"reviewer")    # phase 3
Agent(subagent_type:"doc-keeper", name:"doc-keeper")  # phase 4
```

Each subagent file (`.claude/agents/*.md`) states the superpowers skill it wraps,
the bounded read-set it starts from, and its done-condition. The lead orchestrates
sequence; it does **not** write code itself (except iter-0 — see §7).

---

## 4. Zero-context protocol (bounded read-set — never grows)

Every iteration plan opens with a **`START HERE`** header fixing the read-set to
exactly five things, in order:

1. `docs/STATUS.md` — current-iter pointer + next free tab #
2. the plan itself
3. `docs/00-architecture.md` — data model, design system, shared features
4. `AGENTS.md §Critical gotchas` — D3 load-bearing, dead global mode toggle, eval scope, gitignore cruft, sequential numbering
5. one reference tab: `docs/{NN}-{name}.md` + its `js/tabs-{name}.js`

**Explicitly do NOT read** (context control): any `docs/archive/*`, any other
plan in `docs/superpowers/plans/`, or `ITERATION-LOG.md` beyond its last row.

This stays bounded forever because: (a) `STATUS` is size-capped; (b) only one
plan is live at a time (the rest are in `archive/`); (c) the archive index is the
only linearly-growing doc and is never in the hot path.

---

## 5. Fresh-session kickoff ritual

A new iteration starts in a fresh context. The lead does, in order:

1. Read `docs/STATUS.md` → note `current iteration` + `next free tab`.
2. Confirm the iteration's ROADMAP row; if no plan exists yet, dispatch **Analyst**
   (phase 1) to write it from `_template.md`. If a WIP plan already exists in
   `docs/superpowers/plans/`, open it and resume at the next unchecked step.
3. Run phases 2→4 (Build → Verify → Close) per §2.
4. After Doc-keeper closes: `STATUS` now points at the next iteration. Stop.

If you are ever unsure where things stand, the answer is always in `STATUS.md`
line ~3 + the last row of `ITERATION-LOG.md`. Nothing else.

---

## 6. Parallel builds (iterations with ≥2 independent tabs)

When one iteration ships ≥2 tabs that don't share files (e.g. iter-03 = DDI
Dimensions + DDA Dimensions), fan out the Build phase:

- **Superpowers-native:** `superpowers:dispatching-parallel-agents` — the Analyst
  splits the plan into per-tab sub-plans; one Engineer agent per tab. Use
  `superpowers:using-git-worktrees` if the parallel engineers would edit the same
  files (they won't for distinct tabs, but `js/app.js` `TABS`/`NAV_GROUPS` is
  shared — sequence those two edits after the parallel tab files land).
- **Deterministic alternative:** the `Workflow` tool fans out the same way and is
  preferred when the fan-out shape is fully known up front.

Single-tab iterations use the linear Agent+SendMessage spine — no fan-out.

---

## 7. Archive rules (what moves vs stays live)

| Artifact | At close | Why |
|---|---|---|
| the WIP plan `docs/superpowers/plans/{date}-iter-NN-*.md` | **`git mv`** → `docs/archive/iter-NN-{slug}/handoff.md` | `plans/` holds only WIP + template; history lives in archive |
| a superseded `docs/NN-*.md` tab spec (tab rebuilt) | **`git mv`** → `docs/archive/iter-NN-{slug}/spec-NN-*.md` | single source of truth; git history = recoverability; no two-copy drift |
| a completed `docs/SPEC-*.md` (rich overview spec) | **`git mv`** → archive | the lean `docs/NN-*.md` is the live spec; the SPEC was scaffolding |
| `docs/STATUS.md` | **copy** → `docs/archive/iter-NN-{slug}/STATUS-snapshot-{YYYYMMDD}.md` | STATUS is overwrite-by-design (its leanness is the point); the snapshot preserves the point-in-time state |
| design notes / review findings no longer actionable | **`git mv`** → `docs/archive/iter-NN-{slug}/notes.md` | out of hot path, recoverable |
| `00-architecture.md`, `ROADMAP.md`, `ITERATION-LOG.md`, `AGILE.md`, `README.md`, `AGENTS.md`, `CLAUDE.md` | **edit in place** (never archived) | durable living docs |

`docs/archive/README.md` is the linear index table of every closed iteration.

---

## 8. Doc hygiene (prevent bloat)

- `STATUS.md`: section caps — orientation ≤6 lines, run/verify ≤10, live-files ≤10,
  gotchas ≤10, git ≤5; total ≤60. Doc-keeper enforces; Reviewer checks.
- Per-tab specs `docs/NN-*.md`: stay ~25 lines (the existing contract). Anything
  bigger becomes a `SPEC-*.md`, archived after the tab ships.
- Iteration plans: ≤ ~200 lines (Analyst prunes to the template's sections).
- **One doc per concept — link, don't duplicate.** Canonical sources:
  - traps → `AGENTS.md §Critical gotchas` (STATUS/AGILE link, don't restate)
  - data model + design system → `docs/00-architecture.md`
  - tab catalogue + conventions → `CLAUDE.md`

---

## 9. Bootstrap note (iter-0 exception)

`AGILE.md` and the `.claude/agents/*` subagents are themselves iter-0 deliverables,
so iter-0 was written by the main session directly (it cannot be built by the
team it defines). **Iter-1 is the first full 4-subagent run**, and its Reviewer
additionally audits this very file ("did it actually guide a fresh agent?"). Gaps
become an iter-0 patch — `AGILE.md` is versioned and edited in place.
