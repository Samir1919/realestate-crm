# Contributing Guide

This project follows a PR-first, review-friendly workflow with strict UI consistency and small scoped changes.

## 1) Core Principles

- Preserve existing CRM UI language and layout patterns.
- Prefer small, local changes over broad rewrites.
- Keep each PR focused on one concern.
- Do not mix unrelated refactor and feature changes in one PR.

## 2) Workflow

1. Create a feature branch from `main`.
2. Implement focused changes.
3. Run relevant checks locally.
4. Open a PR using `.github/pull_request_template.md`.
5. Address review comments.
6. Merge only after required checks pass.

## 3) Coding and Structure Standards

- Follow existing CommonJS, Express, EJS, and Mongoose patterns.
- Keep controller, route, model, and utility responsibilities separate.
- Keep files readable; when a `.js` or `.ejs` file gets large, split into smaller helpers/partials/modules.
- Avoid renaming or reorganizing files unless needed for the task.

## 4) UI and View Standards

- Reuse shared partials and existing UI patterns.
- Keep spacing, typography, color usage, and component structure aligned with current theme.
- Verify desktop and mobile behavior for UI changes.
- For reusable UI updates, review `docs/ui-visual-regression-checklist.md` and update it when needed.

## 5) Validation Before PR

- Run the smallest useful test/check for touched code paths.
- Ensure build and asset pipeline still pass.
- Include a concise validation summary in PR.

## 6) CI, Review, and Ownership

- CI is required; do not merge when checks fail.
- Shared areas require reviewer attention.
- CODEOWNERS and workflow rules are defined under `.github/`.

## 7) Security and Safety

- Never commit secrets, tokens, or credentials.
- Validate and sanitize external input paths.
- Prefer least-privilege defaults in environment/config usage.

## 8) Architecture Decision Logging

When a change affects architecture, workflow, or long-term maintenance:

- Record the decision in `docs/engineering-governance.md`.
- Include date, decision, reason, and impact.

## References

- `AGENTS.md`
- `.github/copilot-instructions.md`
- `.github/pull_request_template.md`
- `docs/engineering-governance.md`
- `docs/ui-visual-regression-checklist.md`
