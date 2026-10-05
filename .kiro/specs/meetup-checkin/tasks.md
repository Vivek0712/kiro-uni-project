# Tasks — MeetupPass Implementation Checklist

## Phase 1: Project Scaffolding
- [x] Create `package.json` with scripts: start, seed, test
- [x] Create `.gitignore` (node_modules, data/*.json, keep .gitkeep)
- [x] Create `data/.gitkeep`
- [x] Create `.kiro/steering/product.md`
- [x] Create `.kiro/steering/tech.md`
- [x] Create `.kiro/steering/structure.md`
- [x] Create `.kiro/steering/testing.md` (inclusion: always)

## Phase 2: Kiro Metadata
- [x] Create `.kiro/specs/meetup-checkin/requirements.md`
- [x] Create `.kiro/specs/meetup-checkin/design.md`
- [x] Create `.kiro/specs/meetup-checkin/tasks.md`
- [x] Create `.kiro/hooks/test-on-save.json`
- [x] Create `.kiro/hooks/readme-sync.json`
- [x] Create `.kiro/hooks/secret-scan.json`
- [x] Create `.kiro/settings/mcp.json`
- [x] Create `.kiro/agents/reviewer.json`

## Phase 3: Backend
- [x] Implement `src/db.js` — JSON file read/write helpers
- [x] Implement `src/routes.js` — all API route handlers
- [x] Implement `src/server.js` — HTTP server, static file serving

## Phase 4: Frontend
- [x] Create `public/style.css` — shared styles, CSS variables, responsive layout
- [x] Create `public/app.js` — shared client utilities (toast, fetch helpers)
- [x] Create `public/index.html` — event list + create event form
- [x] Create `public/rsvp.html` — RSVP form + QR pass display
- [x] Create `public/checkin.html` — check-in desk
- [x] Create `public/dashboard.html` — live dashboard + CSV export

## Phase 5: Scripts & Tests
- [x] Create `scripts/seed.js` — demo event + 22 attendees, ~1/3 pre-checked in
- [x] Create `test/api.test.js` — 16 API endpoint tests, all passing

## Phase 6: Documentation
- [x] Create `README.md` with Quick Start, API table, Built with Kiro section

## Phase 7: Verification
- [x] `npm install` — no errors (zero runtime dependencies)
- [x] `npm run seed` — creates data/events.json + data/attendees.json, prints confirmation
- [x] `npm test` — 16/16 tests pass (exit code 0)
- [x] `npm start` → server responds HTTP 200 on http://localhost:3000

## Phase 8: Property-Based Testing (fast-check)
- [x] Add `fast-check` as devDependency in `package.json`
- [x] Update `package.json` `test` script to run both `test/api.test.js` and `test/properties.test.js`
- [x] Create `test/properties.test.js` with `numRuns >= 100` per property, same temp-dir isolation as `test/api.test.js`
  - [x] Property 1: Pass code format + uniqueness (`/^[A-Z0-9]{8}$/`, all distinct) — see design.md § Property 1
  - [x] Property 2: RSVP → Check-In round trip marks exactly that attendee — see design.md § Property 2
  - [x] Property 3: Check-in idempotency — second check-in → 409, state unchanged — see design.md § Property 3
  - [x] Property 4: Dashboard invariants (`totalCheckedIn ≤ totalRsvp ≤ capacity`) — see design.md § Property 4
  - [x] Property 5: Unknown pass codes → 404, state unchanged — see design.md § Property 5
  - [x] Property 6: CSV export has exactly one row per attendee and round-trips names/emails with commas and quotes — see design.md § Property 6
