# Repository Instructions

These instructions apply to the whole repository for future AI assistants and collaborators.

## Project Goals

- Preserve the current CRM experience and visual language.
- Prefer small, local changes over broad rewrites.
- Do not change layouts, spacing, or component structure unless the task requires it.

## UI and Theme Rules

- Reuse existing shared EJS partials and UI patterns whenever possible.
- Keep typography, colors, shadows, spacing, and border radius aligned with the existing theme.
- Use the current Tailwind/CSS pipeline and design tokens instead of introducing ad hoc styles.
- Avoid page-level visual drift between desktop and mobile.
- If a UI change affects multiple pages, update the shared component instead of duplicating logic.

## Code Rules

- Follow the existing CommonJS, Express, EJS, and Mongoose style already used in the codebase.
- Keep controller, route, model, and utility responsibilities separated.
- Prefer minimal, readable changes that match the surrounding code.
- Do not rename or reorganize files unless there is a clear reason.
- If a `.js` or `.ejs` file starts getting large, split it into smaller files, partials, or helpers instead of keeping everything in one place.
- When splitting, group code by one clear concern, keep related files adjacent, use behavior-based names, and keep the top-level composer thin and easy to scan.
- Keep main files thin by importing, rendering, or requiring smaller reusable pieces.
- Keep root controller files thin and use feature subdirectories for helper controller modules, for example `controllers/lead/` for lead-specific helpers and workflow handlers.
- When moving controller helpers into a subdirectory, keep the entrypoint at the root and move only the supporting logic into the feature folder.

## Validation Rules

- Run the smallest useful check for the touched area after changing code.
- For UI changes, verify relevant screens in desktop and mobile views.
- Update the visual regression checklist when layout behavior or reusable UI patterns change.
- Keep the shared checklist in `docs/ui-visual-regression-checklist.md` aligned with UI updates.

## Collaboration Rules

- Use pull requests for all feature or refactor work; avoid direct pushes to the main branch.
- Keep PR scope small and focused; do not mix unrelated changes in one PR.
- Require at least one reviewer for controller, route, model, and shared UI changes.
- Use the repository PR template and fill test and UI impact sections before requesting review.

## CI and Quality Gates

- Treat CI checks as required: tests must pass before merge.
- Keep a minimal build and test workflow for every PR.
- Add visual regression automation for key routes and viewports when introducing reusable UI changes.
- Do not merge if required checks fail.

## Security and Dependencies

- Run dependency and secret checks in CI for pull requests.
- Do not commit secrets, tokens, or credentials in code, templates, or logs.

## Architecture Notes

- Record significant architecture or workflow decisions in `docs/engineering-governance.md`.
- Prefer updating existing decision notes over scattering one-off guidance in code comments.

## Do Not

- Do not introduce new UI systems without updating the shared theme approach.
- Do not hardcode one-off styling in multiple views when a shared partial or class can be used.
- Do not let a single `.js` or `.ejs` file become a dump for unrelated logic or markup.
- Do not change unrelated features while working on a specific task.

## Helpful References

- Contributing guide: `CONTRIBUTING.md`
- Shared UI notes: `docs/ui-visual-regression-checklist.md`
- Shared page header: `views/partials/ui/page-header.ejs`
- Shared flash message: `views/partials/ui/flash-message.ejs`
- Governance checklist: `docs/engineering-governance.md`