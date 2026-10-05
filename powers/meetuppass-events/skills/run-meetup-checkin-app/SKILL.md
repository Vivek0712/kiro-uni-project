---
name: "run-meetup-checkin-app"
description: "Run, operate, and maintain an existing meetup check-in app: start the server, seed demo data, run tests, export attendee CSVs, and troubleshoot common runtime issues. Use when you have an existing MeetupPass-style app and want to operate it day-to-day or prepare it for a live event."
license: "MIT"
metadata:
  author: "AWS User Group Madurai"
  version: "1.0.0"
---

# Run and Operate a Meetup Check-In App

## Overview

This skill covers day-to-day operations of a MeetupPass-style check-in app: starting the server, seeding demo data, running the test suite, and performing common event-day tasks. It also covers the data model and API so you can query or manipulate records directly if needed.

## Prerequisites Checklist

- [ ] Node.js 20+ installed
- [ ] `npm install` run (creates `node_modules/` with dev deps like fast-check)
- [ ] `data/` directory exists (or will be created automatically on first write)

## Quick Start

```bash
npm run seed    # populate data/ with a demo event + 22 attendees (~1/3 checked in)
npm start       # start server → http://localhost:3000
npm test        # run all tests; must exit 0
```

## Common Operations

### Start the Server

```bash
npm start
# → MeetupPass running on http://localhost:3000
```

Override port:
```bash
PORT=8080 npm start
```

### Seed Demo Data

```bash
npm run seed
# Creates: data/events.json (1 event)
#          data/attendees.json (22 attendees, ~7 pre-checked-in)
```

Run this before demos or whenever you want a fresh dataset.

### Run Tests

```bash
npm test
# Runs test/api.test.js + test/properties.test.js
# All 22 tests must pass (exit code 0)
```

Tests use an isolated temp dir — they never touch `./data`.

### Export Attendee CSV

Navigate to the Dashboard page and click "Export CSV", or call the API directly:

```bash
curl http://localhost:3000/api/export/<eventId> -o attendees.csv
```

The CSV is RFC 4180-compliant: commas and quotes in names/emails are handled correctly.

## Pages Reference

| URL | Who uses it |
|-----|-------------|
| `http://localhost:3000/` | Organizers — create events, see all events |
| `http://localhost:3000/rsvp.html?eventId=<id>` | Attendees — RSVP and see their QR pass |
| `http://localhost:3000/checkin.html?eventId=<id>` | Check-in staff — type/scan pass code |
| `http://localhost:3000/dashboard.html?eventId=<id>` | Organizers — live stats, CSV export |

## API Quick Reference

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/events` | List all events |
| POST | `/api/events` | Create event `{ name, date, venue, capacity }` |
| POST | `/api/rsvp` | RSVP `{ eventId, name, email }` → `{ passCode, attendeeId }` |
| POST | `/api/checkin` | Check in `{ passCode }` → `{ success, attendee }` |
| GET | `/api/dashboard/:eventId` | Live stats |
| GET | `/api/export/:eventId` | Download CSV |

Error shape: always `{ "error": "<message>" }` with the right HTTP status.

## Data Model

```json
// Event (data/events.json)
{ "id": "evt_abc123", "name": "...", "date": "2026-10-15",
  "venue": "...", "capacity": 60, "createdAt": "..." }

// Attendee (data/attendees.json)
{ "id": "att_xyz789", "eventId": "evt_abc123",
  "name": "...", "email": "...", "passCode": "A1B2C3D4",
  "rsvpAt": "...", "checkedIn": false, "checkedInAt": null }
```

Pass codes are 8-character strings matching `/^[A-Z0-9]{8}$/`.

## Event-Day Checklist

- [ ] `npm run seed` on a clean machine (or just `npm start` if data already exists)
- [ ] Open `http://localhost:3000` — confirm event list loads
- [ ] Create the real event via the UI (or re-use the seeded demo event)
- [ ] Share the RSVP URL with attendees before the event
- [ ] Open `checkin.html?eventId=<id>` on the check-in laptop/tablet
- [ ] Open `dashboard.html?eventId=<id>` on the organizer screen
- [ ] After event: download CSV from dashboard for attendance records

## Troubleshooting

### Server won't start — `EADDRINUSE`
**Cause:** Port 3000 (or `$PORT`) is already in use.
**Solution:**
```bash
PORT=3001 npm start
# Or kill the existing process:
lsof -ti:3000 | xargs kill
```

### Attendee data missing after restart
**Cause:** `data/events.json` or `data/attendees.json` was deleted, or `MEETUPPASS_DATA_DIR` points to a temp dir.
**Solution:** Check that `./data/` exists and contains the JSON files. Run `npm run seed` to recreate demo data.

### Check-in returns 404 for a valid-looking pass code
**Cause:** The pass code may belong to a different event, or the RSVP was made against a test server instance.
**Solution:** Verify the attendee exists: `cat data/attendees.json | node -e "const d=require('fs').readFileSync('/dev/stdin','utf8'); console.log(JSON.parse(d).filter(a=>a.passCode==='XXXXXXXX'))"`.

### Tests fail: `Cannot find module '../src/routes.js'`
**Cause:** Running tests from the wrong directory.
**Solution:** Always run `npm test` from the project root.

### `npm test` fails with property test errors
**Cause:** A property test found a genuine bug in the API.
**Solution:** Read the fast-check counterexample in the error output — it shows the minimal input that reproduces the bug. Fix the route handler in `src/routes.js`, then re-run.

## Best Practices

- Keep `data/*.json` in `.gitignore` — never commit real attendee data.
- Run `npm test` before every deploy (the test suite covers all 7 API endpoints).
- Use the `MEETUPPASS_DATA_DIR` env var to point the server at a staging dataset without affecting production data.
- The dashboard auto-refreshes every 5 seconds — leave it open on a large screen during the event.
