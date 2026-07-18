# Real Estate CRM

Internal CRM for lead management, assignment, follow-up, and admin role control.

## Tech Stack

- Node.js
- Express (CommonJS)
- EJS
- Mongoose
- Tailwind CSS

## Getting Started

1. Install dependencies:
   `npm ci`
2. Start development server:
   `npm run dev`
3. Build CSS assets:
   `npm run build`

## Scripts

- `npm run dev` - run app with nodemon
- `npm run start` - run app with node
- `npm run build` - build CSS assets
- `node --test tests/*.test.js` - run test files

## Docker

### Production-style (App only)

1. Configure `.env.production` with at least:
   - `NODE_ENV=production`
   - `PORT=3000`
   - `MONGO_URI=...` (external MongoDB connection string)
   - `SESSION_SECRET=...` (minimum 32 characters; 64+ recommended)
   - `SESSION_COOKIE_SECURE=false` for an internal HTTP canary, then `true` for HTTPS
   - Optional: `SESSION_STORE_MONGO_URI=...` to use a separate session database
   - Optional: `SESSION_COLLECTION=sessions`
2. Start:
   `npm run docker:up`
3. Stop:
   `npm run docker:down`

### Local Docker (App + Mongo)

1. Start with local Mongo service:
   `npm run docker:up:local`
2. Stop local stack:
   `npm run docker:down:local`

### Docker Scripts

- `npm run docker:build` - build image manually
- `npm run docker:up` - start production compose stack
- `npm run docker:down` - stop production compose stack
- `npm run docker:up:local` - start app with local Mongo overlay
- `npm run docker:down:local` - stop local Mongo overlay stack

Authentication sessions are encrypted and stored in MongoDB for 12 hours. The
MongoDB TTL index removes expired sessions. Keep `SESSION_SECRET` stable across
container restarts; rotating it intentionally signs every user out.

## Contributing

Before opening a PR, read [CONTRIBUTING.md](CONTRIBUTING.md).

Key references:

- [AGENTS.md](AGENTS.md)
- [.github/copilot-instructions.md](.github/copilot-instructions.md)
- [.github/pull_request_template.md](.github/pull_request_template.md)
- [docs/engineering-governance.md](docs/engineering-governance.md)
- [docs/ui-visual-regression-checklist.md](docs/ui-visual-regression-checklist.md)
