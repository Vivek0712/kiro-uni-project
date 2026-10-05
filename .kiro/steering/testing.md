---
inclusion: always
---
# Testing Steering — MeetupPass

## Philosophy
Every public API endpoint must have at least one passing test. Tests are the source of truth for API contracts.

## Test Runner
- Use **`node:test`** (built-in, Node 20+) — no Jest, Mocha, or other frameworks.
- Use **`node:assert/strict`** for assertions.
- Use the built-in `fetch` (Node 18+) to make real HTTP calls against a test server instance.

## Test File Location
- All tests live in `test/`.
- Entry point: `test/api.test.js`.
- Test data files: `data/test-*.json` — created before tests, deleted after.

## Test Structure
```js
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
```

## Coverage Requirements
| Endpoint | Scenarios to cover |
|---|---|
| POST /api/events | creates event, returns 201 with id |
| GET /api/events | returns array |
| POST /api/rsvp | creates attendee, returns pass code |
| POST /api/rsvp | duplicate email → 409 |
| POST /api/checkin | valid code → 200 checked_in=true |
| POST /api/checkin | already checked in → 409 |
| POST /api/checkin | unknown code → 404 |
| GET /api/dashboard/:eventId | returns stats object |

## Running Tests
```bash
npm test
```

Tests must exit with code 0 on a clean run. Fix failures before committing.

## Test Isolation
- Each test suite creates its own event via the API.
- Point `MEETUPPASS_DATA_DIR` at a temp dir before importing `src/` so tests never touch `./data`; remove it in `after()`.
- Never depend on data created by `npm run seed`.
