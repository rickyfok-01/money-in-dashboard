# Iteration log — money-in-dashboard

> **Append-only.** One entry per iteration, oldest → newest. A fresh session reads
> the **last** row to corroborate `docs/STATUS.md`. **Never edit a past row** — if a
> shipped iteration needs a correction, open a new follow-up iteration.

---

## iter-00 — 2026-07-17 — Agile system (superpowers backbone)
- **Goal:** establish the agile framework on the superpowers plugin as backbone —
  roadmap, iteration-plan template, archive mechanism, zero-context handoff
  protocol, 4-role subagent team, STATUS refactor. No app code.
- **Shipped:**
  - `docs/AGILE.md` — the playbook (4-phase lifecycle, zero-context protocol, archive rules)
  - `docs/ROADMAP.md` — 8-iteration backlog (3 areas × 3 levels)
  - `docs/superpowers/plans/_template.md` — the iteration-plan template
  - `docs/ITERATION-LOG.md` + `docs/archive/README.md` — history infrastructure
  - `.claude/agents/{analyst,engineer,reviewer,doc-keeper}.md` — the team
  - `docs/STATUS.md` — refactored to lean live (≤60 lines) + current-iter pointer
  - `docs/README.md` — amended with agile-doc pointers
- **Files touched:** `docs/` + `.claude/` only. No `js/`, `index.html`, `data.js`, `styles.css`.
- **DATA:** n/a (docs only).
- **Verify:** artifact well-formedness + zero-context simulation (a fresh agent
  given only `STATUS.md` correctly reports the current iteration, next free tab #,
  the bounded read-set, and the executing superpowers skill).
- **Handoff:** `docs/archive/iter-00-agile/handoff.md`
- **Status:** shipped.
