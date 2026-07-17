# Archive — closed iterations

History of completed iterations. Each has a folder `iter-{NN}-{slug}/` containing:

- `handoff.md` — the executed superpowers plan (`git mv`'d from `docs/superpowers/plans/`)
- `STATUS-snapshot-{YYYYMMDD}.md` — `docs/STATUS.md` **copied** at close (point-in-time state)
- `spec-{NN}-*.md` / `SPEC-*.md` — any superseded tab specs (`git mv`'d in)
- `notes.md` — design rationale / review findings (optional)

## Rules (`docs/AGILE.md §7`)

- **Living docs** (`00-architecture.md`, `ROADMAP.md`, `ITERATION-LOG.md`,
  `AGILE.md`, `README.md`, `AGENTS.md`, `CLAUDE.md`) are **never archived** —
  edited in place.
- **STATUS** is overwrite-by-design; a dated **copy** is snapshotted here at each
  close (not moved — moving it would defeat its leanness).
- This index is the **only linearly-growing** agile doc, and it is **never** in the
  zero-context read-set (`docs/AGILE.md §4`).

## Index

| Iter | Date | Domain / Level | Tabs shipped | Handoff | Archived specs |
|---|---|---|---|---|---|
| 00 | 2026-07-17 | meta (agile system) | none | `iter-00-agile/handoff.md` | — |
| 01 | 2026-07-17 | Bill audit (L1/L2/L3 + hygiene) | none | iter-01-bill-audit/handoff.md | — |
| 02 | 2026-07-17 | DD L1 (Direct Debit Overview) | #26 | `iter-02-dd-overview/handoff.md` | — |
