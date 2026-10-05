# Platform Integration Steering — MeetupPass × awsugmdu.in

## Overview

MeetupPass is the official door check-in companion for the AWS User Group Madurai community platform at https://www.awsugmdu.in. The platform exposes a public read-only REST API; MeetupPass reads from it to import meetups and display stats. No platform write operations are ever performed.

## Platform API

- **Base URL:** `https://2q4zt5zl9e.execute-api.us-east-1.amazonaws.com/dev` (default)
- **Override via:** `AWSUGMDU_API_BASE` environment variable
- **Auth:** None required (public)
- **Timeout:** 10 seconds for all requests
- **Key endpoints:**
  - `GET /meetups` → array of meetup objects
  - `GET /stats` → community statistics

## PII Sanitization — MANDATORY RULE

Platform API responses contain Personally Identifiable Information (PII):
- `hosts[]`, `speakers[]`, `volunteers[]` — contain user objects with emails/phone/userId
- `registeredUsers[]`, `attendedUsers[]` — arrays of user objects with PII

**EVERY platform API response MUST pass through `sanitizeMeetup()` in `src/platform.js` before:**
- Being stored in `data/events.json`
- Being returned from any API endpoint
- Being passed to any MCP tool caller
- Being logged or rendered

### Allow-List (only these fields survive)

```
id, title, date, time, duration, type, status,
maxAttendees, attendees, image, meetupUrl,
hostPoints, speakerPoints, volunteerPoints
```

### Blocked (examples — not exhaustive; anything NOT on the allow-list is blocked)

```
email, phone, userId, registeredUsers, attendedUsers,
hosts, speakers, volunteers, bio, profileImage,
linkedinUrl, twitterHandle, ...
```

## src/platform.js — Module Contract

This is the ONLY module that may call the platform API. All callers go through it.

```js
// Pure function — always returns the same output for the same input
export function sanitizeMeetup(meetup) { ... }

// Network call — uses global fetch with AbortController timeout
export async function fetchPlatformMeetups() { ... }
export async function fetchPlatformStats() { ... }
```

**Implementation rules:**
1. Use `AbortController` with `setTimeout(controller.abort, 10000)` for the 10-second timeout.
2. If `fetch` throws (network error, timeout), throw an error with message `"Platform API unavailable: <reason>"`.
3. `sanitizeMeetup()` must be called on every item returned from `fetchPlatformMeetups()`.
4. `fetchPlatformStats()` returns the stats object as-is (no PII in stats).

## Points System

- Each event has an `attendeePoints` field (default: 10, configurable at import/create).
- On successful check-in, `pointsAwarded` is set on the attendee record to the event's `attendeePoints`.
- `pointsAwarded` is `null` for attendees who have not checked in (not 0 — absence of value is meaningful).
- The sync export (`GET /api/platform/sync/:eventId`) lets a platform admin record attendance and award points on awsugmdu.in's store.

## Testing Rules (Platform Integration)

- Tests MUST NOT call the real platform API.
- Use `AWSUGMDU_API_BASE` env var pointing at a local mock HTTP server.
- The mock server should return static JSON that mimics real platform responses, including PII fields, so sanitizer tests can verify stripping.

## MCP Server (`mcp/awsugmdu-mcp-server.js`)

- Zero npm dependencies — only Node.js built-ins.
- Communicates via newline-delimited JSON-RPC 2.0 on `process.stdin`/`process.stdout`.
- Uses `src/platform.js` for all data fetching — inherits sanitization automatically.
- Logs diagnostics to `process.stderr` only, never to `process.stdout`.
- Implements: `initialize`, `tools/list`, `tools/call`.
- Ignores `notifications/initialized` and other notification messages gracefully.

## Privacy Guard Hook

`.kiro/hooks/privacy-guard.json` fires on every edit to `src/*.js` or `mcp/*.js` and runs:

```bash
! grep -rE "[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}" \
    data/ docs/ src/ \
    --include="*.json" --include="*.js" --include="*.md" \
    --exclude-dir=node_modules --exclude-dir=.git \
  | grep -v "@example\.com\|@example\.org\|@test\.com\|@domain\.\|placeholder" \
  || (echo "🚨 PRIVACY VIOLATION: Real email found in repo" && exit 1)
```

If any non-example-domain email is found, the command exits 1 and the hook fails loudly.
