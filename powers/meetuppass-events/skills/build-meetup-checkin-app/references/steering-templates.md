# Kiro Steering Templates for Meetup Check-In Apps

Copy these into `.kiro/steering/` in your project and customise the bracketed values.

---

## product.md

```markdown
# Product Steering — [Your App Name]

## Vision
[Your App Name] is a lightweight, zero-dependency event check-in web application built for [Your Group Name]. It replaces spreadsheets and manual attendance tracking with a fast, browser-based workflow.

## Target Users
- **Organizers** – create events, monitor attendance live, export CSV reports.
- **Attendees** – RSVP online, receive a unique pass code shown as a QR code.
- **Check-in Staff** – scan or type pass codes at the door; see instant accept/reject feedback.

## Core Value Propositions
1. No app install required – runs entirely in the browser.
2. Real-time dashboard with capacity bar and recent check-in feed.
3. Duplicate check-in prevention with clear error messages.
4. One-click CSV export for post-event analytics.

## Non-Goals (v1)
- Payment processing or ticketing.
- Multi-organizer / role-based access control.
- Email/SMS notifications.
- Persistent cloud database (JSON file storage is intentional for simplicity).

## Success Metrics
- RSVP → check-in flow completed in < 30 seconds per attendee.
- Dashboard refreshes within 5 seconds of a new check-in.
- Zero duplicate check-ins accepted.
```

---

## tech.md

```markdown
# Tech Steering — [Your App Name]

## Runtime
- **Node.js 20+** — use built-in modules wherever possible.
- No build step; plain ES modules with `"type": "module"`.

## Backend
- `node:http` for the HTTP server — no Express or other frameworks.
- `node:fs/promises` for JSON file persistence in `./data/`.
- `node:crypto` for generating unique pass codes (`crypto.randomBytes`).
- Server listens on `process.env.PORT || 3000`.

## Frontend
- Plain HTML5, CSS3, and vanilla JS — no React, Vue, or bundlers.
- QR codes rendered client-side using `qrcode.js` from CDN (no npm dependency).
- Auto-refresh dashboard via `setInterval` polling every 5 seconds.

## Testing
- `node:test` (built-in) + `node:assert/strict`.
- Tests spin up the real HTTP server on an ephemeral port and use `fetch`.
- Use `MEETUPPASS_DATA_DIR` env var to point tests at a temp dir.

## Code Style
- 2-space indentation.
- `const`/`let` only; no `var`.
- Async/await throughout.
```

---

## structure.md

```markdown
# Structure Steering — [Your App Name]

## Directory Layout
[app]/
├── .kiro/
│   ├── steering/          # product.md · tech.md · structure.md · testing.md
│   ├── specs/[app]/       # requirements.md · design.md · tasks.md
│   ├── hooks/             # automation hooks
│   ├── settings/mcp.json  # MCP server config
│   └── agents/            # custom agents
├── src/
│   ├── server.js
│   ├── routes.js
│   └── db.js
├── public/
│   ├── index.html
│   ├── rsvp.html
│   ├── checkin.html
│   ├── dashboard.html
│   ├── style.css
│   └── app.js
├── scripts/seed.js
├── test/api.test.js
├── data/.gitkeep
└── package.json

## Naming Conventions
- Files: kebab-case.js
- Functions/variables: camelCase
- Constants: UPPER_SNAKE_CASE
- HTML IDs/classes: kebab-case
```

---

## testing.md

```markdown
---
inclusion: always
---
# Testing Steering — [Your App Name]

## Philosophy
Every public API endpoint must have at least one passing test.

## Test Runner
- `node:test` (built-in, Node 20+) + `node:assert/strict`
- Real HTTP calls via built-in `fetch` (Node 18+)
- No Jest, Mocha, or other frameworks

## Test Isolation
- Set `MEETUPPASS_DATA_DIR` to a `mkdtemp` temp dir BEFORE importing `src/`
- Clean up in `after()` with `rm(DATA_DIR, { recursive: true, force: true })`

## Running Tests
```bash
npm test
```
Must exit with code 0 on a clean run.
```
