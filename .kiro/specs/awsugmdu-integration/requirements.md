# Requirements — awsugmdu.in Platform Integration

## Overview

MeetupPass integrates with the AWS User Group Madurai community platform (awsugmdu.in) as its official door check-in companion. The platform exposes a public read-only REST API; MeetupPass imports meetups, awards community points, and produces a sync export that a platform admin can use to record attendance.

---

## Feature 1: Platform Meetup Sync

### US-1.1 Fetch Platform Meetups
**WHEN** an organizer views the "Import from awsugmdu.in" page or the platform API is called,  
**THE SYSTEM SHALL** retrieve the meetup list from the platform API, sanitize it (strip PII), and return it.

**Acceptance Criteria:**
- AC-1.1.1: `GET /api/platform/meetups` returns an array of sanitized meetup objects.
- AC-1.1.2: Each returned object contains only the allow-listed fields: `id`, `title`, `date`, `time`, `duration`, `type`, `status`, `maxAttendees`, `attendees` (count), `image`, `meetupUrl`, `hostPoints`, `speakerPoints`, `volunteerPoints`.
- AC-1.1.3: No `email`, `userId`, `phone`, `registeredUsers`, `attendedUsers`, `hosts`, `speakers`, or `volunteers` fields are present in any returned object or nested structure.
- AC-1.1.4: If the platform API is unreachable, the endpoint returns HTTP 502 with `{ error: "Platform API unavailable: <reason>" }`.
- AC-1.1.5: Platform API requests time out after 10 seconds.

### US-1.2 Fetch Platform Stats
**WHEN** an organizer or agent requests platform stats,  
**THE SYSTEM SHALL** return member count, meetup count, badge count, active sprint, and generation timestamp.

**Acceptance Criteria:**
- AC-1.2.1: `GET /api/platform/stats` returns `{ memberCount, badgeCount, meetupCount, activeSprint, generatedAt }`.
- AC-1.2.2: If the platform API is unreachable, the endpoint returns HTTP 502 with a clear error.

### US-1.3 Import Platform Meetup
**WHEN** an organizer imports a platform meetup by ID,  
**THE SYSTEM SHALL** create a corresponding local MeetupPass event linked to the platform meetup, without creating duplicates.

**Acceptance Criteria:**
- AC-1.3.1: `POST /api/platform/import { meetupId }` creates a local event and returns HTTP 201 with the event object.
- AC-1.3.2: The created event stores `platformMeetupId`, `type`, `image`, `meetupUrl`, and `attendeePoints` (defaulting to 10, configurable via the request body).
- AC-1.3.3: Capacity is set from the meetup's `maxAttendees`.
- AC-1.3.4: Importing the same `meetupId` a second time returns HTTP 200 with the existing event (no duplicate).
- AC-1.3.5: If `meetupId` is not found on the platform, the endpoint returns HTTP 404.
- AC-1.3.6: The imported event name is derived from the platform meetup's `title`.

---

## Feature 2: Community Points

### US-2.1 Points on Check-In
**WHEN** an attendee successfully checks in at a MeetupPass event with `attendeePoints > 0`,  
**THE SYSTEM SHALL** record the points awarded on the attendee record.

**Acceptance Criteria:**
- AC-2.1.1: On a successful check-in, the attendee record gains a `pointsAwarded` field equal to the event's `attendeePoints`.
- AC-2.1.2: `GET /api/dashboard/:eventId` response includes `totalPointsAwarded` equal to the sum of `pointsAwarded` across all checked-in attendees.
- AC-2.1.3: `pointsAwarded` is `null` (not 0) for attendees who have not checked in.
- AC-2.1.4: Points are not re-awarded on a duplicate check-in attempt.

### US-2.2 Leaderboard
**WHEN** an organizer views the leaderboard for an event,  
**THE SYSTEM SHALL** return attendees ranked by points descending, then by check-in time ascending.

**Acceptance Criteria:**
- AC-2.2.1: `GET /api/leaderboard/:eventId` returns an array of checked-in attendees sorted by `pointsAwarded` descending, then `checkedInAt` ascending.
- AC-2.2.2: Each leaderboard entry includes: `rank`, `name`, `email`, `passCode`, `checkedInAt`, `pointsAwarded`.
- AC-2.2.3: Unchecked-in attendees are excluded from the leaderboard.
- AC-2.2.4: If the event does not exist, returns HTTP 404.

---

## Feature 3: Sync Export for awsugmdu.in Admin

### US-3.1 Generate Sync File
**WHEN** an organizer requests the sync export for an event,  
**THE SYSTEM SHALL** produce a JSON file that an awsugmdu.in admin can import to update attendance and points on the platform.

**Acceptance Criteria:**
- AC-3.1.1: `GET /api/platform/sync/:eventId` returns JSON with Content-Type `application/json`.
- AC-3.1.2: The response shape is `{ platformMeetupId, generatedAt, checkedIn: [{ email, name, passCode, checkedInAt, pointsAwarded }], totals: { checkedIn, totalPoints } }`.
- AC-3.1.3: Only checked-in attendees are included in the `checkedIn` array.
- AC-3.1.4: If the event has no `platformMeetupId`, `platformMeetupId` is `null` in the response.
- AC-3.1.5: The system makes no write requests to the platform API.
- AC-3.1.6: If the event does not exist, returns HTTP 404.

---

## Feature 4: Platform Import UI

### US-4.1 Platform Meetups Page
**WHEN** an organizer visits `/platform.html`,  
**THE SYSTEM SHALL** display a list of platform meetups as cards with an Import button, and a platform stats banner.

**Acceptance Criteria:**
- AC-4.1.1: Each meetup card shows: poster image (or placeholder), title, date, type badge, status badge, and capacity.
- AC-4.1.2: An "Import" button on each card triggers `POST /api/platform/import`.
- AC-4.1.3: If a meetup is already imported (same `platformMeetupId` exists as a local event), the button changes to "View" and links to the dashboard.
- AC-4.1.4: A banner at the top shows `memberCount`, `meetupCount` from platform stats and links to https://www.awsugmdu.in.
- AC-4.1.5: Platform fetch errors are displayed gracefully (no uncaught exceptions).

### US-4.2 Navigation
**WHEN** a user views any page,  
**THE SYSTEM SHALL** show a "Platform" nav link that leads to `/platform.html`.

**Acceptance Criteria:**
- AC-4.2.1: All four existing pages (index.html, rsvp.html, checkin.html, dashboard.html) have a "Platform" nav link.

### US-4.3 Imported Event Badge
**WHEN** a user views the dashboard for an event imported from the platform,  
**THE SYSTEM SHALL** show an "awsugmdu.in" badge linking to the meetup's `meetupUrl`.

**Acceptance Criteria:**
- AC-4.3.1: Dashboard shows an "awsugmdu.in" badge when `event.platformMeetupId` is set.
- AC-4.3.2: The badge links to `event.meetupUrl` and opens in a new tab.

### US-4.4 Dashboard Points & Leaderboard
**WHEN** an organizer views a dashboard for an event with points configured,  
**THE SYSTEM SHALL** show a points tile and a top-5 leaderboard panel, plus a sync file download button.

**Acceptance Criteria:**
- AC-4.4.1: Dashboard shows a "Total Points Awarded" stat tile.
- AC-4.4.2: Dashboard shows a "Top Attendees" leaderboard panel with rank, name, and points.
- AC-4.4.3: A "Download sync file" button downloads `GET /api/platform/sync/:eventId`.

---

## Feature 5: MCP Server

### US-5.1 awsugmdu MCP Server
**WHEN** a Kiro agent uses the `awsugmdu` MCP server,  
**THE SYSTEM SHALL** provide tools to query platform meetups and stats with PII automatically stripped.

**Acceptance Criteria:**
- AC-5.1.1: The MCP server responds to `initialize`, `tools/list`, and `tools/call` over stdio JSON-RPC 2.0.
- AC-5.1.2: Tool `list_platform_meetups` accepts optional `status` and `type` filters and returns sanitized meetup array.
- AC-5.1.3: Tool `get_platform_meetup` accepts `id` and returns a single sanitized meetup or an error.
- AC-5.1.4: Tool `get_platform_stats` returns the platform stats object.
- AC-5.1.5: No tool ever returns `email`, `userId`, `registeredUsers`, `attendedUsers`, `hosts`, `speakers`, or `volunteers` fields.
- AC-5.1.6: The MCP server is registered in `.kiro/settings/mcp.json` as `"awsugmdu"`.

---

## Feature 6: Privacy

### US-6.1 PII Sanitization
**WHEN** the system handles platform API data,  
**THE SYSTEM SHALL** strip all PII (emails, phone numbers, user IDs) before storing, returning, logging, or rendering.

**Acceptance Criteria:**
- AC-6.1.1: `sanitizeMeetup()` in `src/platform.js` is a pure function that returns an object containing only the allow-listed keys.
- AC-6.1.2: Any key not in the allow-list is absent from the output, regardless of the input.
- AC-6.1.3: A property-based test proves the sanitizer never leaks any key outside the allow-list for arbitrary input objects.
- AC-6.1.4: The privacy guard hook (`.kiro/hooks/privacy-guard.json`) greps `data/`, `docs/`, and `src/` for real-looking email patterns (excluding `example.com` and `example.org`) and fails loudly if any are found.
