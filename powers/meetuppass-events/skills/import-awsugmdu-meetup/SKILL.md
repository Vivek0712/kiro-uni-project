---
name: "import-awsugmdu-meetup"
description: "Import a meetup from the awsugmdu.in community platform into MeetupPass for door check-in. Use when you want to link a platform meetup to a local MeetupPass event and start tracking attendance with community points."
license: "MIT"
metadata:
  author: "AWS User Group Madurai"
  version: "1.0.0"
---

# Import an awsugmdu.in Meetup into MeetupPass

## Overview

This skill connects MeetupPass to the AWS User Group Madurai community platform at https://www.awsugmdu.in. It walks through fetching platform meetups, importing one as a local event, and configuring community points.

## Prerequisites

- MeetupPass server running (`npm start` at http://localhost:3000)
- The `awsugmdu` MCP server configured in `.kiro/settings/mcp.json` (already bundled with this power)

## Privacy Rule (non-negotiable)

The awsugmdu.in API returns PII (emails, user IDs) in `hosts`, `speakers`, `volunteers`, `registeredUsers`, and `attendedUsers`. **All of these fields are stripped by `sanitizeMeetup()` in `src/platform.js` before any data is stored, returned, or rendered.** Never bypass this sanitizer.

## Step 1: List available platform meetups

Use the awsugmdu MCP tool to discover meetups:

```
@awsugmdu list_platform_meetups
```

Or filter by status:
```
@awsugmdu list_platform_meetups {"status": "upcoming"}
```

Each result contains only safe fields: `id`, `title`, `date`, `time`, `type`, `status`, `maxAttendees`, `attendees`, `image`, `meetupUrl`, `hostPoints`, `speakerPoints`, `volunteerPoints`.

## Step 2: Check platform stats (optional)

```
@awsugmdu get_platform_stats
```

Returns: `memberCount`, `meetupCount`, `badgeCount`, `activeSprint`, `generatedAt`.

## Step 3: Import the meetup via the UI

1. Navigate to http://localhost:3000/platform.html
2. Find the meetup you want
3. Click **Import** — MeetupPass creates a local event linked to the platform meetup
4. The event will have `platformMeetupId`, `attendeePoints` (default 10), and `meetupUrl` set

Importing the same meetup twice is safe — it returns the existing event (idempotent).

## Step 4: Import via API (alternative)

```bash
curl -s -X POST http://localhost:3000/api/platform/import \
  -H "Content-Type: application/json" \
  -d '{"meetupId": "<platform-meetup-id>", "attendeePoints": 15}'
```

Response (201 on first import, 200 if already imported):
```json
{
  "id": "evt_abc123",
  "name": "AWS UG Madurai – October Circles",
  "platformMeetupId": "<platform-meetup-id>",
  "attendeePoints": 15,
  ...
}
```

## Step 5: Run check-in

Attendees check in at http://localhost:3000/checkin.html?eventId=\<event-id\>

On successful check-in, `pointsAwarded` is set to the event's `attendeePoints` on the attendee record.

## Step 6: Export sync file for platform admin

After the event, download the sync file so the awsugmdu.in admin can record attendance and award points:

```bash
curl -s http://localhost:3000/api/platform/sync/<event-id> | jq .
```

Or click **⬇ Sync File** on the dashboard.

The sync file shape:
```json
{
  "platformMeetupId": "<id>",
  "generatedAt": "2026-10-15T12:00:00.000Z",
  "checkedIn": [
    { "email": "...", "name": "...", "passCode": "...", "checkedInAt": "...", "pointsAwarded": 15 }
  ],
  "totals": { "checkedIn": 22, "totalPoints": 330 }
}
```

## Troubleshooting

### Platform API unreachable
- Check `AWSUGMDU_API_BASE` env var (default: `https://2q4zt5zl9e.execute-api.us-east-1.amazonaws.com/dev`)
- Endpoints: `GET /meetups`, `GET /stats`
- No auth required (public API)

### Meetup not found after import
- Verify the meetup `id` matches exactly (platform IDs are case-sensitive)
- Use `@awsugmdu list_platform_meetups` to confirm the ID

### Points not awarded
- Check the event has `attendeePoints > 0` (set at import time, default 10)
- Only successful first check-ins award points; duplicates are rejected

## Key Files

| File | Purpose |
|------|---------|
| `src/platform.js` | Platform API client + `sanitizeMeetup()` |
| `src/routes.js` | `/api/platform/*` endpoints |
| `public/platform.html` | Import UI |
| `public/dashboard.html` | Points tile, leaderboard, sync button |
| `mcp/awsugmdu-mcp-server.js` | MCP server for agent access |
| `scripts/platform-status.js` | Quick CLI status check |
