---
name: "build-meetup-checkin-app"
description: "Build a community meetup check-in web app from scratch: event creation, RSVP with QR pass codes, door check-in, and live attendance dashboard. Use when you want to create a new event check-in app or adapt MeetupPass for your own community group."
license: "MIT"
metadata:
  author: "AWS User Group Madurai"
  version: "1.0.0"
---

# Build a Meetup Check-In App

## Overview

This skill guides you through building a lightweight, zero-runtime-dependency event check-in web application using Node.js 20+ built-in modules. The architecture is deliberately minimal: `node:http` for the server, `node:fs/promises` for JSON file persistence, and `node:crypto` for unique QR pass codes. No Express, no database, no bundler.

The result is a fully working app with four pages (event list, RSVP/pass, check-in desk, live dashboard) and a seven-endpoint REST API — deployable anywhere Node.js 20 runs.

## Prerequisites Checklist

- [ ] Node.js 20+ installed (`node --version` shows `v20.x.x` or higher)
- [ ] A project directory created and `package.json` initialised (`npm init -y`)
- [ ] `"type": "module"` added to `package.json` (enables ES module syntax)
- [ ] `"engines": { "node": ">=20.0.0" }` added to `package.json`

## Tech Constraints (follow these throughout)

- **No Express or third-party server frameworks** — use `node:http` only
- **No runtime npm dependencies** — every `require`/`import` must be a Node.js built-in or a local file
- **No database** — persist to `./data/events.json` and `./data/attendees.json` via `node:fs/promises`
- **No build step** — plain ES modules, served as-is
- **No WebSockets** — dashboard auto-refresh via `setInterval` polling every 5 seconds
- **QR codes** — render client-side via `qrcode.js` loaded from CDN (no npm package)

## Step-by-Step Guide

### 1. Create the Persistence Layer (`src/db.js`)

This module owns all JSON read/write operations. Key rules:
- Read the whole file on every request (acceptable at meetup scale — ≤ 200 attendees)
- Write with `fs.writeFile` (atomic enough for single-process use)
- Support `process.env.MEETUPPASS_DATA_DIR` override so tests can point to a temp directory

```js
// src/db.js
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.MEETUPPASS_DATA_DIR || join(__dirname, '..', 'data');

async function ensureDataDir() {
  if (!existsSync(DATA_DIR)) await mkdir(DATA_DIR, { recursive: true });
}

async function readJSON(filename) {
  await ensureDataDir();
  try {
    return JSON.parse(await readFile(join(DATA_DIR, filename), 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

async function writeJSON(filename, data) {
  await ensureDataDir();
  await writeFile(join(DATA_DIR, filename), JSON.stringify(data, null, 2), 'utf8');
}

// Pass code: 8-char uppercase alphanumeric, collision-resistant at ≤200 attendees
export function generatePassCode() {
  return randomBytes(6).toString('base64url')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '0')
    .slice(0, 8);
}
```

Implement `getEvents`, `createEvent`, `getAttendees`, `createAttendee`, `getAttendeeByEmail`, `getAttendeeByPassCode`, `checkInAttendee` — all `async`, all reading/writing through `readJSON`/`writeJSON`.

### 2. Implement API Route Handlers (`src/routes.js`)

Export a single `handleRequest(req, res)` function. Route dispatch pattern:

```js
export async function handleRequest(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname;
  const method = req.method.toUpperCase();

  // CORS (for local dev)
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  try {
    if (path === '/api/events' && method === 'GET')  return await handleGetEvents(req, res);
    if (path === '/api/events' && method === 'POST') return await handleCreateEvent(req, res);
    // ... more routes
    if (method === 'GET') return await serveStatic(res, path);
    json(res, 404, { error: 'Not found' });
  } catch (err) {
    json(res, 500, { error: 'Internal server error' });
  }
}
```

**Required endpoints:**

| Method | Path | Status | Body |
|--------|------|--------|------|
| GET | `/api/events` | 200 | `Event[]` |
| POST | `/api/events` | 201 | `Event` |
| GET | `/api/events/:id` | 200/404 | `Event` |
| POST | `/api/rsvp` | 201/400/404/409 | `{ passCode, attendeeId }` |
| POST | `/api/checkin` | 200/400/404/409 | `{ success, attendee }` |
| GET | `/api/dashboard/:eventId` | 200/404 | `{ event, totalRsvp, totalCheckedIn, remaining, recentCheckIns }` |
| GET | `/api/export/:eventId` | 200/404 | CSV `text/csv` |

**CSV export — RFC 4180 quoting required:**
```js
const rows = attendees.map(a => [
  `"${(a.name  || '').replace(/"/g, '""')}"`,
  `"${(a.email || '').replace(/"/g, '""')}"`,
  // ... other fields
].join(','));
```

**Error shape:** always `{ "error": "<message>" }` with appropriate status.

### 3. Create the HTTP Server (`src/server.js`)

```js
import { createServer } from 'node:http';
import { handleRequest } from './routes.js';

const PORT = process.env.PORT || 3000;
const server = createServer(async (req, res) => {
  await handleRequest(req, res);
});
server.listen(PORT, () => {
  console.log(`MeetupPass running on http://localhost:${PORT}`);
});
```

### 4. Build the Frontend (public/)

Four HTML pages, all using vanilla JS + CDN-only libraries:

| File | Purpose |
|------|---------|
| `public/index.html` | Event list + create-event form |
| `public/rsvp.html` | RSVP form; after submit shows QR pass via `qrcode.js` |
| `public/checkin.html` | Pass code input, real-time accept/reject banner |
| `public/dashboard.html` | Capacity bar, recent check-ins feed; polls every 5 s |

QR code (CDN, no npm):
```html
<script src="https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js"></script>
<div id="qrcode"></div>
<script>
  new QRCode(document.getElementById('qrcode'), {
    text: passCode,
    width: 200, height: 200,
  });
</script>
```

### 5. Write Integration Tests (`test/api.test.js`)

Use `node:test` + `node:assert/strict` — no Jest, no Mocha.

Key pattern for test isolation:
```js
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const DATA_DIR = mkdtempSync(join(tmpdir(), 'meetuppass-test-'));
process.env.MEETUPPASS_DATA_DIR = DATA_DIR;

// Dynamic import AFTER env is set, so db.js picks up the temp dir
const { handleRequest } = await import('../src/routes.js');
```

Spin up the real server on an ephemeral port; use `fetch` (Node 18+ built-in) for all HTTP calls.

### 6. Add a Seed Script (`scripts/seed.js`)

Creates one demo event and ~22 attendees (~⅓ pre-checked-in) in `./data/` for demos.

### 7. Add Kiro Steering Documents (`.kiro/steering/`)

Four steering files tell Kiro what this project is and how to maintain it:

| File | Purpose |
|------|---------|
| `product.md` | Vision, target users, non-goals |
| `tech.md` | Node.js 20+ built-ins only, no Express, no bundler |
| `structure.md` | Directory layout, naming conventions |
| `testing.md` | `inclusion: always` — testing philosophy always in context |

See `references/steering-templates.md` for copy-paste-ready starter content.

### 8. Verify

```bash
npm install      # should add 0 runtime deps
npm run seed     # creates data/events.json + data/attendees.json
npm test         # all tests must pass (exit 0)
npm start        # http://localhost:3000 responds 200
```

## Common Workflows

### Workflow: Adapting for a different community group
1. Edit `.kiro/steering/product.md` — change group name, venue defaults, capacity
2. Edit `scripts/seed.js` — update demo event name and date
3. Edit `public/index.html` — update the page title and brand color in `public/style.css`

### Workflow: Adding a new API field
1. Add the field to the relevant handler in `src/routes.js`
2. Update `src/db.js` to persist it
3. Add a test case in `test/api.test.js`
4. Update the API table in `.kiro/specs/meetup-checkin/design.md`

## Troubleshooting

### Error: `SyntaxError: Cannot use import statement in a module`
**Cause:** `package.json` is missing `"type": "module"`.
**Solution:** Add `"type": "module"` to `package.json` and restart.

### Error: `Error: listen EADDRINUSE :::3000`
**Cause:** Another process is using port 3000.
**Solution:** `PORT=3001 npm start`, or kill the other process.

### Tests fail with `ENOENT` on data files
**Cause:** `MEETUPPASS_DATA_DIR` is not set before `src/routes.js` is imported.
**Solution:** Set `process.env.MEETUPPASS_DATA_DIR` before any dynamic `import('../src/routes.js')` in tests.

## Best Practices

- Always validate required POST body fields and return 400 with a helpful `error` message.
- Return 409 (Conflict) for duplicate RSVP emails and duplicate check-ins — not 400.
- Keep all `async`/`await` — no callbacks, no `.then()` chains.
- Use 2-space indentation throughout (matches the steering doc).
- Gate test data behind `MEETUPPASS_DATA_DIR` so `npm test` never writes to `./data`.
