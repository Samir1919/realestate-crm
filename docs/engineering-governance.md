# Engineering Governance Checklist

Use this checklist to keep quality and collaboration standards consistent.

## 1) Branch and PR Policy

- [ ] Use feature branches for all code changes.
- [ ] Open PRs for merge; avoid direct pushes to main.
- [ ] Keep PR scope focused to one concern.
- [ ] Use PR template and fill testing + UI impact sections.

## 2) Required Checks (CI)

- [ ] Run tests on every PR.
- [ ] Run build step on every PR.
- [ ] Run dependency/security checks on every PR.
- [ ] Block merge when required checks fail.

## 3) Review Policy

- [ ] Require at least one reviewer.
- [ ] Require review for shared UI, routes, controllers, models, and permissions logic.
- [ ] Resolve review comments before merge.

## 4) UI Governance

- [ ] Follow `docs/ui-visual-regression-checklist.md` for visual changes.
- [ ] Add visual regression snapshots for reusable UI updates.
- [ ] Verify desktop and mobile before merge.

## 5) Security and Secrets

- [ ] Do not commit secrets, credentials, or tokens.
- [ ] Validate and sanitize external inputs.
- [ ] Prefer minimal privileges for environment credentials.

## 6) Architecture Decisions

- [ ] Record significant decisions and tradeoffs in this file.
- [ ] Add date, decision, reason, and impact.

- 2026-07-13: Kept root controller files thin and moved helper controller modules into feature subdirectories such as `controllers/lead/`.
	- Reason: Makes the controllers directory easier for humans to scan and keeps request entrypoints separate from helper logic.
	- Impact: Future controller refactors should follow the same feature-folder split pattern instead of leaving mixed helper files at the root.

### Decision Log Template

- Date:
- Decision:
- Reason:
- Impact:
