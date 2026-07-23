# iter-00 — Agile system (superpowers backbone) — handoff

> Closed 2026-07-17. Archived from the iteration-driving plan. This is the
> as-built record of iteration 0 — the framework, not app code.

**Goal:** establish the agile framework on the superpowers plugin as backbone, so
any fresh Claude Code session can read a bounded set, pick the next iteration off
the roadmap, and run it to "shipped + archived."

**Architecture:** no app changes. The framework = docs (playbook, roadmap, history
infra, iteration-plan template) + `.claude/agents/` role subagents that wrap
superpowers skills. Iterations are superpowers plans; the 4 roles
(Analyst → Engineer → Reviewer → Doc-keeper) run each one.

**Tech Stack:** markdown docs + YAML-frontmatter agent definitions. Superpowers
plugin v6.1.1 (`superpowers@claude-plugins-official`).

---

## Shipped (the deliverables)

- [x] `docs/AGILE.md` — playbook: 4-phase lifecycle, skill map, zero-context
      protocol, parallel-build guidance, archive rules, doc hygiene, bootstrap note.
- [x] `docs/ROADMAP.md` — 8-iteration backlog (Bill audit, DD L1/L2/L3, Payment
      L2/L3, polish) with DATA keys, tab patterns, reference tabs.
- [x] `docs/superpowers/plans/_template.md` — iteration-plan template (superpowers
      plan skeleton + dashboard Data-contract / Tab-pattern / Files-to-touch /
      START-HERE read-set / Archive checklist).
- [x] `docs/ITERATION-LOG.md` — append-only log (seeded with this iter-00 row).
- [x] `docs/archive/README.md` — archive index + rules.
- [x] `.claude/agents/analyst.md`, `engineer.md`, `reviewer.md`, `doc-keeper.md`.
- [x] `docs/STATUS.md` — refactored to lean live (≤60 lines) + current-iter pointer.
- [x] `docs/README.md` — amended with an Agile-workflow section.

## Team → superpowers skill map
| Role | Skill(s) |
|---|---|
| Analyst | `brainstorming` → `writing-plans` |
| Engineer | `subagent-driven-development` / `executing-plans` (+ `test-driven-development`) |
| Reviewer | `requesting-code-review` + repo `code-review`; `verification-before-completion` |
| Doc-keeper | `finishing-a-development-branch` + procedural archive/log |

Parallel builds (≥2 tabs): `dispatching-parallel-agents` (+ `using-git-worktrees`
if files conflict) or the `Workflow` tool.

## Bootstrap note
`AGILE.md` + the subagents are iter-0 deliverables, so iter-0 was written by the
main session directly (not by the team it defines). **iter-01 is the first full
4-subagent run**; its Reviewer additionally audits `AGILE.md` itself.

## Verify
- artifacts present + cross-links resolve; `STATUS.md` ≤60 lines.
- `git diff --stat` = `docs/` + `.claude/` only (no app code).
- zero-context simulation: a fresh agent given only `STATUS.md` reports the current
  iteration (iter-01), next free tab (26), the bounded read-set, and the executing
  skill (`subagent-driven-development`).

## Status
Shipped. Next: iter-01 (Bill audit) — pending, plan not yet written.
