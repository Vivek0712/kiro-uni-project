# Tasks — awsugmdu.in Platform Integration

## Phase 1: Steering & Spec

- [x] Create `.kiro/specs/awsugmdu-integration/requirements.md` (EARS-format)
- [x] Create `.kiro/specs/awsugmdu-integration/design.md` (Mermaid + Correctness Properties)
- [x] Create `.kiro/specs/awsugmdu-integration/tasks.md` (this file)
- [x] Update `.kiro/steering/product.md` with privacy rule
- [x] Create `.kiro/steering/platform-integration.md`

## Phase 2: Core Integration

- [x] Create `src/platform.js`
  - [x] `fetchPlatformMeetups()`
  - [x] `fetchPlatformStats()`
  - [x] `sanitizeMeetup()` pure allow-list function
  - [x] Graceful network error handling with 10-second timeout
- [x] Update `src/db.js`
  - [x] `createEvent()` accepts `platformMeetupId`, `type`, `image`, `meetupUrl`, `attendeePoints`
  - [x] `checkInAttendee()` records `pointsAwarded` from event's `attendeePoints`
  - [x] `getEventByPlatformId(platformMeetupId)` helper
- [x] Update `src/routes.js`
  - [x] `GET /api/platform/meetups`
  - [x] `GET /api/platform/stats`
  - [x] `POST /api/platform/import`
  - [x] `GET /api/leaderboard/:eventId`
  - [x] `GET /api/platform/sync/:eventId`
  - [x] Update `GET /api/dashboard/:eventId` to include `totalPointsAwarded`

## Phase 3: Frontend

- [x] Create `public/platform.html`
  - [x] Stats banner with member/meetup count and link to awsugmdu.in
  - [x] Meetup cards grid (image, title, date, type/status badges, capacity)
  - [x] Import button → `POST /api/platform/import`; idempotent "View" state
  - [x] Platform nav link in all existing HTML pages
- [x] Update `public/index.html` — add Platform nav link, awsugmdu badge on imported events
- [x] Update `public/rsvp.html` — add Platform nav link
- [x] Update `public/checkin.html` — add Platform nav link
- [x] Update `public/dashboard.html`
  - [x] Add Platform nav link
  - [x] Add `totalPointsAwarded` stat tile
  - [x] Add "Top Attendees" leaderboard panel (calls `/api/leaderboard/:eventId`)
  - [x] Add "Download sync file" button (calls `/api/platform/sync/:eventId`)
  - [x] Show awsugmdu.in badge when `event.platformMeetupId` is set

## Phase 4: MCP Server & Agent

- [x] Create `mcp/awsugmdu-mcp-server.js`
  - [x] JSON-RPC 2.0 over stdio (newline-delimited)
  - [x] Handle `initialize`, `tools/list`, `tools/call`, ignore notifications
  - [x] Tool: `list_platform_meetups` (optional status/type filter)
  - [x] Tool: `get_platform_meetup` (by id)
  - [x] Tool: `get_platform_stats`
  - [x] All tools use `sanitizeMeetup()` — no PII ever
- [x] Update `.kiro/settings/mcp.json` — add `awsugmdu` server entry
- [x] Create `.kiro/agents/event-ops.json`
  - [x] awsugmdu MCP server scoped to agent
  - [x] Pre-approved read-only tools
  - [x] Resources pointing at new spec + steering
  - [x] agentSpawn hook: `node scripts/platform-status.js`
- [x] Create `scripts/platform-status.js`
  - [x] Prints platform stats + next/most recent meetup (sanitized)

## Phase 5: Powers & Hooks

- [x] Update `powers/meetuppass-events/plugin.json` — bump version, add keywords
- [x] Update `powers/meetuppass-events/mcp.json` — add awsugmdu MCP server entry
- [x] Create `powers/meetuppass-events/skills/import-awsugmdu-meetup/SKILL.md`
- [x] Create `.kiro/hooks/privacy-guard.json`
  - [x] Trigger: FileEdited matching `src/.*\.js$|mcp/.*\.js$`
  - [x] Command: grep for email-like patterns in data/, docs/, src/ (excluding example.com/example.org)

## Phase 6: Tests

- [x] Create `test/platform.test.js`
  - [x] Unit: `sanitizeMeetup()` strips PII
  - [x] Unit: `sanitizeMeetup()` with minimal input
  - [x] Integration: `GET /api/platform/meetups` (mock platform server via AWSUGMDU_API_BASE)
  - [x] Integration: `GET /api/platform/stats`
  - [x] Integration: `POST /api/platform/import` creates event
  - [x] Integration: `POST /api/platform/import` idempotency (same meetupId → same event)
  - [x] Integration: `GET /api/leaderboard/:eventId`
  - [x] Integration: `GET /api/platform/sync/:eventId`
  - [x] Integration: points awarded on check-in
  - [x] Integration: `GET /api/dashboard/:eventId` includes `totalPointsAwarded`
  - [x] MCP: spawn server, send `initialize`, validate response
  - [x] MCP: `tools/list` returns all three tools
  - [x] MCP: `tools/call list_platform_meetups` returns sanitized data
- [x] Create `test/platform-properties.test.js`
  - [x] Property 7: sanitizer allow-list (fast-check, numRuns=100)
  - [x] Property 8: points invariant (fast-check, numRuns=100)
  - [x] Property 9: import idempotency (fast-check, numRuns=100)
- [x] Update `package.json` test script to include new test files

## Phase 7: Seed & Verify

- [x] Update `scripts/seed.js` — add platform-linked demo event with points
- [x] Run `npm test` — all tests pass
- [x] Run `npm run seed` — data/ populated with linked event
- [x] Start server, curl `/api/platform/meetups` against real platform API
- [x] Verify no email/userId keys in response
- [x] Stop server

## Phase 8: Agent Demo & README

- [x] Run event-ops agent non-interactively, save output to `docs/agent-demo.md`
- [x] Update `README.md`
  - [x] Reposition as awsugmdu.in check-in companion
  - [x] Platform integration section
  - [x] Custom MCP server section
  - [x] Event-ops agent section with real demo output
  - [x] Privacy rule
  - [x] New API rows
  - [x] Keep Built with Kiro mapping accurate
