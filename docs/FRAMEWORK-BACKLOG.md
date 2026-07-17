# FRAMEWORK-BACKLOG — agile-framework friction (iter-0 patch queue)

> Process-Review findings about `AGILE.md` / the `.claude/agents/*` roles / the plan
> template — **not** app code. Accumulated per iteration; resolved in a dedicated
> **iter-0 patch** (the framework is edited in place, never mid-iteration). Sourced
> from phase-4 Process Review; raised here so a fresh session that reads `STATUS.md`
> first discovers it. Linked from `docs/STATUS.md` (Current iteration section).

## iter-02 (2026-07-17) — 4 frictions, iteration cleared to close

1. **Analyst done-condition too weak.** Analyst checked "every template section
   complete" but not "the plan file is on disk + reported back to the lead," so the
   plan shipped as **untracked** and broke `git mv` at close (see #4).
   **Fix (iter-0 patch):** tighten `.claude/agents/analyst.md` done-condition to
   require the plan file written to disk AND a report-back message that names the path.

2. **Plan specified helper redefinition over reuse.** Plan §2.3 said "define locally
   so the module is self-contained" without verifying the helpers
   (`ddi30For`/`ddiAgingFor`/`dda30For`/`ddaAgingFor`/`sumAO`) already exist as globals
   from tab 25 — the engineer correctly reused them instead.
   **Fix (iter-0 patch):** add to `docs/superpowers/plans/_template.md` §2.3: *"verify
   the helper doesn't already exist as a global; default to reuse, not redefinition."*

3. **Stray pre-framework plan lingers in `plans/`.** `docs/superpowers/plans/2026-07-10-settings-tabs.md`
   predates the framework and violates `AGILE.md §7` ("`plans/` holds only WIP + template").
   **Fix (iter-0 patch):** `git mv`/delete it; add a Doc-keeper close-check that
   `docs/superpowers/plans/` holds only `_template.md` + at most one live plan.

4. **Untracked plan breaks `git mv` at close.** Because the Analyst never `git add`ed
   the plan, Doc-keeper's `git mv` to `archive/.../handoff.md` was refused (worked
   around this close with plain `mv`).
   **Fix (iter-0 patch):** clarify `AGILE.md §7` that the Analyst `git add`s the plan
   at completion so Close can `git mv`.
