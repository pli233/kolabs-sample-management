# Skill: Repo Workflow

Use this for non-trivial repo work, commits, merges, pushes, and release prep.

## Default Flow

1. Check status: `git status --short --branch`.
2. Branch from `main` for focused work.
3. Keep changes scoped to the request and preserve unrelated user changes.
4. Verify with the smallest meaningful test set, then broaden when risk is high.
5. Commit with a conventional message and the required co-author trailer.
6. Merge with `--no-ff` when integrating a feature branch into `main`.
7. Push only when the user explicitly asks.

## Required Commit Trailer

```text
Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
```

## Common Verification Commands

- `make lint`
- `cd frontend && npm test`
- `cd frontend && npm run bdd`
- `make test-backend`
- `make build`

## Dirty Tree Rule

Never revert or overwrite unrelated changes. If an unrelated untracked directory
exists, leave it alone unless the user asks to clean it.
