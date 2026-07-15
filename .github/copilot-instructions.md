# Copilot Repository Instructions

Follow these instructions when working anywhere in this repository.

## Main Goal

- Preserve the current CRM experience, UI language, and shared component structure.
- Prefer small, local changes over broad rewrites.
- Avoid layout drift unless the task explicitly requires a visual change.

## UI Rules

- Reuse existing shared EJS partials and UI patterns whenever possible.
- Keep typography, colors, shadows, spacing, and border radius aligned with the current theme.
- Use the existing Tailwind/CSS pipeline and design tokens instead of introducing ad hoc styles.
- If a UI change affects multiple pages, update the shared component instead of duplicating logic.
- Verify that mobile and desktop layouts remain consistent after UI changes.

## Code Rules

- Follow the existing CommonJS, Express, EJS, and Mongoose conventions already used in the codebase.
- Keep controller, route, model, and utility responsibilities separated.
- Prefer minimal, readable changes that match the surrounding code.
- Do not rename or reorganize files unless there is a clear reason.
- If a `.js` or `.ejs` file grows too large, extract smaller pieces into separate helpers, partials, modules, or includes.
- When splitting files, keep each piece centered on one concern, keep related pieces near each other, use descriptive names that reflect the workflow or UI area, and keep the parent file readable as a map of the feature.
- Keep entry files thin and delegate repeated or complex logic to reusable files.

## Validation Rules

- Run the smallest useful check for the touched area after changing code.
- For UI changes, verify relevant screens in desktop and mobile views.
- Update the visual regression checklist when layout behavior or reusable UI patterns change.

## Collaboration Rules

- Keep changes scoped to a single concern per PR.
- Assume PR-based workflow and avoid introducing unrelated edits.
- For shared UI, routes, models, and controllers, prefer review-friendly incremental changes.

## CI and Gates

- Assume tests and build checks are required before merge.
- If UI structure changes, include visual regression checklist impact and automation notes.
- Do not treat a change as complete if required checks would fail.

## Security Rules

- Never add secrets or credentials to source files, templates, tests, or logs.
- Prefer safe defaults and validate external inputs before persistence.

## Do Not

- Do not introduce a new UI system without updating the shared theme approach.
- Do not hardcode one-off styling in multiple views when a shared partial or class can be used.
- Do not keep unrelated logic or markup in a single oversized file when it can be split cleanly.
- Do not change unrelated features while working on a specific task.

## Reference Files

- Root instructions: `AGENTS.md`
- Shared UI notes: `docs/ui-visual-regression-checklist.md`
- Shared page header: `views/partials/ui/page-header.ejs`
- Shared flash message: `views/partials/ui/flash-message.ejs`
- Governance checklist: `docs/engineering-governance.md`