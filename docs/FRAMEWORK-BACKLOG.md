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

## iter-03 (2026-07-17) — 4 frictions, iteration cleared to close

5. **Spec-length contract (~25 lines) vs reality.** Both specs overshot the contract
   (DDI: 54 lines, DDA: 45 lines) despite plan §6 specifying "~25-line per-tab spec."
   The Analyst wrote comprehensive specs (Purpose·Data·Drives·Measures·Charts·Table·Modes·Notes)
   that captured the domain fully but broke the §8 "doc hygiene" cap.
   **Fix (iter-0 patch):** clarify `AGILE.md §8` that the ~25-line target is a *guideline*;
   specs up to ~50 lines are acceptable for complex tabs. If a spec exceeds ~50 lines,
   it should be split into a lean `docs/NN-*.md` (the live spec) + a detailed
   `docs/SPEC-*.md` (archived post-shipping).

6. **Latent data-guard parity gap.** DDA's `ddaDimAgg` skips blank keys (`if(!k) continue`);
   DDI's `ddiDimAgg` doesn't. Non-observable today (zero blanks in data), but a framework
   gap: no shared DD aggregator contract defining blank-handling behavior.
   **Fix (iter-0 patch):** add to `_template.md §2.4` (Derived metrics) a note: *"If grouping
   by a field with blank values (e.g., account type), document whether blank keys are skipped
   or aggregated as 'Unknown' — default to skip for consistency."*

7. **No playbook guidance for mid-loop agent death.** Two engineer agents died on a 429
   usage-limit after the Reviewer routed non-blocking fixes via `receiving-code-review`.
   The lead applied the three literal-value fixes directly (verified correct) because the
   agents were dead, not idle. `AGILE.md §3` says "the lead does not write code itself"
   but lacks an exception for "agent died mid-loop."
   **Fix (iter-0 patch):** add to `AGILE.md §3` (The team): *"If a subagent dies mid-loop
   (e.g., rate limit, crash), the lead may apply mechanical fixes (literal values with
   exact targets, no logic) directly to unblock the iteration. This is an exception to
   'lead does not write code itself' and should be rare."*

8. **Stale pre-agile plan still in `plans/`.** `docs/superpowers/plans/2026-07-10-settings-tabs.md`
   persists (already flagged in iter-02 #3, not yet cleaned). This violates `AGILE.md §7`.
   **Fix (iter-0 patch):** same as iter-02 #3 — `git mv` to `docs/archive/pre-agile/` and add
   a Doc-keeper close-check that `plans/` holds only `_template.md` + the live plan.
