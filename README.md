# MeetupPass 🎟

**A door check-in companion for [AWS User Group Madurai](https://www.awsugmdu.in).**

MeetupPass is a lightweight, zero-dependency web app that replaces spreadsheets and manual attendance tracking for community meetups. Organizers import a meetup straight from the **awsugmdu.in community platform**, attendees RSVP and receive a unique QR-code pass, check-in staff scan or type the code at the door, and each check-in awards community points — ready to sync back to the platform admin.

The integration is **read-only** and **privacy-first**: every platform API response is passed through a strict allow-list sanitizer so emails, user IDs, and other PII never enter MeetupPass's storage, logs, API responses, or MCP tool output.

> **Kiro University 2026 Final Project** — this repo demonstrates every major Kiro feature end-to-end, including a custom MCP server, a scoped event-ops agent, a privacy-guard hook, and property-based tests over the platform integration.

---

## Screenshots

| Home — event list | RSVP pass + QR code |
|:-----------------:|:-------------------:|
| ![Home](docs/screenshots/home.png) | ![RSVP pass](docs/screenshots/rsvp-pass.png) |

| Check-in success | Duplicate check-in rejected | Live dashboard |
|:----------------:|:---------------------------:|:--------------:|
| ![Check-in success](docs/screenshots/checkin-success.png) | ![Duplicate rejected](docs/screenshots/checkin-duplicate.png) | ![Dashboard](docs/screenshots/dashboard.png) |

---

## Quick Start

```bash
# Prerequisites: Node.js 20+
git clone <repo-url>
cd kiro-uni-project
npm install          # installs fast-check dev dependency; zero runtime deps
npm run seed         # creates data/events.json + data/attendees.json with demo data
npm start            # → http://localhost:3000
npm test             # runs 55 tests (API + property-based + platform + MCP) with node:test
```

**Pages:**

| URL | Description |
|-----|-------------|
| `http://localhost:3000/` | Event list + create-event form |
| `http://localhost:3000/platform.html` | Browse & import awsugmdu.in meetups |
| `http://localhost:3000/rsvp.html?eventId=<id>` | Attendee RSVP + QR pass |
| `http://localhost:3000/checkin.html?eventId=<id>` | Check-in desk |
| `http://localhost:3000/dashboard.html?eventId=<id>` | Live dashboard + leaderboard + CSV export |

---

## API Reference

| Method | Path | Description | Request Body | Response |
|--------|------|-------------|--------------|----------|
| `GET`  | `/api/events` | List all events | — | `Event[]` 200 |
| `POST` | `/api/events` | Create an event | `{ name, date, venue, capacity }` | `Event` 201 |
| `GET`  | `/api/events/:id` | Get single event | — | `Event` 200 |
| `POST` | `/api/rsvp` | RSVP for an event | `{ eventId, name, email }` | `{ passCode, attendeeId }` 201 |
| `POST` | `/api/checkin` | Check in an attendee | `{ passCode }` | `{ success, attendee, pointsAwarded }` 200 |
| `GET`  | `/api/dashboard/:eventId` | Live stats | — | `{ event, totalRsvp, totalCheckedIn, remaining, recentCheckIns, totalPointsAwarded }` 200 |
| `GET`  | `/api/export/:eventId` | Download CSV | — | `text/csv` 200 |
| `GET`  | `/api/platform/meetups` | List sanitized awsugmdu.in meetups | — | `Meetup[]` 200 · 502 on upstream failure |
| `GET`  | `/api/platform/stats` | awsugmdu.in community stats | — | `{ memberCount, badgeCount, meetupCount, activeSprint, generatedAt }` 200 · 502 |
| `POST` | `/api/platform/import` | Import a platform meetup as a local event (idempotent) | `{ meetupId, attendeePoints? }` | `Event` 201 · existing `Event` 200 |
| `GET`  | `/api/leaderboard/:eventId` | Checked-in attendees ranked by points | — | `LeaderboardRow[]` 200 |
| `GET`  | `/api/platform/sync/:eventId` | Attendance payload for the awsugmdu.in admin | — | `{ platformMeetupId, generatedAt, checkedIn[], totals }` 200 |

**Error shape:** all errors return `{ "error": "<message>" }` with the appropriate HTTP status code (400, 404, 409, 500, 502). Platform endpoints return `502` with `{ "error": "Platform API unavailable: <reason>" }` when the upstream awsugmdu.in API is unreachable or times out (10 s).

---

## Data Model

### Event
```json
{
  "id": "evt_abc123",
  "name": "AWS User Group Madurai – October Meetup 2026",
  "date": "2026-10-15",
  "venue": "TIDEL Park, Madurai",
  "capacity": 60,
  "createdAt": "2026-10-01T10:00:00.000Z"
}
```

### Attendee
```json
{
  "id": "att_xyz789",
  "eventId": "evt_abc123",
  "name": "Arun Kumar",
  "email": "arun@example.com",
  "passCode": "P3K9WXMQ",
  "rsvpAt": "2026-10-10T14:22:00.000Z",
  "checkedIn": false,
  "checkedInAt": null,
  "pointsAwarded": null
}
```

Platform-imported events carry extra fields — `platformMeetupId`, `type`, `image`, `meetupUrl`, and `attendeePoints` (default `10`). On check-in, an attendee's `pointsAwarded` is set to the event's `attendeePoints`; it stays `null` until the attendee is checked in.

---

## awsugmdu.in Platform Integration

MeetupPass reads from the AWS User Group Madurai community platform API to let organizers import real meetups and track attendance with community points. The integration is **read-only** — MeetupPass never writes back to the platform.

### Flow

1. **Browse** — `public/platform.html` lists live platform meetups (via `GET /api/platform/meetups`) alongside a community stats banner (`GET /api/platform/stats`).
2. **Import** — one click calls `POST /api/platform/import`, which creates a local event linked by `platformMeetupId`. Re-importing the same meetup returns the existing event, so imports are **idempotent**.
3. **Check in** — attendees RSVP and check in as usual; each check-in awards the event's `attendeePoints`.
4. **Leaderboard** — the dashboard shows a "Top Attendees" panel ranked by points (`GET /api/leaderboard/:eventId`).
5. **Sync** — `GET /api/platform/sync/:eventId` produces a JSON attendance payload the awsugmdu.in admin can use to record attendance and award points on the platform.

### `src/platform.js` — the single integration boundary

This is the **only** module that calls the platform API. It:

- Reads the base URL from `AWSUGMDU_API_BASE` (defaults to the public awsugmdu.in API), so tests point it at a local mock server.
- Wraps every request in an `AbortController` with a **10-second timeout**, throwing `Platform API unavailable: <reason>` on any network/timeout failure (surfaced as HTTP `502`).
- Applies `sanitizeMeetup()` to **every** meetup object before returning it.

### Privacy — allow-list sanitizer (MANDATORY)

Raw platform responses embed PII in fields like `hosts`, `speakers`, `volunteers`, `registeredUsers`, and `attendedUsers` (emails, user IDs, phone-like data). `sanitizeMeetup()` is a pure allow-list function — it returns a new object containing **only** these keys and silently drops everything else:

```
id · title · date · time · duration · type · status ·
maxAttendees · attendees · image · meetupUrl ·
hostPoints · speakerPoints · volunteerPoints
```

Because the allow-list lives at the fetch boundary, no email, `userId`, `phone`, or user array can reach storage, logs, an API response, or an MCP tool caller. This rule is enforced three ways: the sanitizer itself, the **privacy-guard hook** (below), and **Property 7** (below), which fuzzes the sanitizer over random objects seeded with PII keys.

---

## Custom MCP Server — `mcp/awsugmdu-mcp-server.js`

A **zero-dependency** Model Context Protocol server (Node.js built-ins only) that exposes the platform to any MCP-aware agent. It speaks JSON-RPC 2.0 over newline-delimited stdio, logs diagnostics to `stderr` only (never `stdout`, which would corrupt the protocol stream), implements `initialize` / `tools/list` / `tools/call`, and ignores notifications gracefully. Every tool fetches through `src/platform.js`, so **sanitization is inherited automatically**.

| Tool | Description |
|------|-------------|
| `list_platform_meetups` | List meetups, with optional `status` / `type` filters |
| `get_platform_meetup` | Fetch a single meetup by `id` |
| `get_platform_stats` | Community stats (member count, badge count, meetup count, active sprint) |

It is registered in `.kiro/settings/mcp.json` as the `awsugmdu` server (`node mcp/awsugmdu-mcp-server.js`), and also bundled with the `meetuppass-events` power.

---

## Event-Ops Agent — `.kiro/agents/event-ops.json`

A purpose-built organizer assistant that connects to the custom MCP server. It is configured with:

- An **agent-scoped** `awsugmdu` MCP server (`node mcp/awsugmdu-mcp-server.js`).
- **Pre-approved read-only tools**: `fs_read`, `@awsugmdu/list_platform_meetups`, `@awsugmdu/get_platform_meetup`, `@awsugmdu/get_platform_stats`.
- **Resources** pointing at the integration spec and the product + platform steering docs.
- An **agentSpawn hook** that runs `node scripts/platform-status.js` to print live, sanitized platform status when the agent starts.
- A non-negotiable privacy instruction never to surface PII.

### Live demo

The agent was run non-interactively against the real platform:

```bash
kiro-cli chat --agent event-ops --no-interactive \
  --trust-tools=fs_read,@awsugmdu \
  "Using the awsugmdu MCP tools, list the 3 most recent platform meetups and the platform member count."
```

It called `@awsugmdu/get_platform_stats` and `@awsugmdu/list_platform_meetups`, then answered:

> Platform member count: 748 (total community: 29 meetups, 5 badges).
>
> 3 most recent meetups (by date):
>
> - Build Full Stack Application on AWS Blocks — 2026-08-02 · circles · completed (29/100)
> - Build Your Portfolio — 2026-07-30 · circles · completed (13/50)
> - Live Resume Review and Q&A — 2026-07-28 · circles · completed (11/50)

Each line shows `title — date · type · status (attendees/maxAttendees)` — exactly the allow-listed fields, with no PII. The full transcript and command live in [`docs/agent-demo.md`](docs/agent-demo.md).

---

## Stack

- **Runtime:** Node.js 20+ — zero npm runtime dependencies
- **Server:** `node:http` — no Express
- **Persistence:** `node:fs/promises` — JSON files in `./data/`
- **Pass codes:** `node:crypto` — `randomBytes(6).toString('base64url')`
- **QR codes:** [qrcode.js](https://github.com/davidshimjs/qrcodejs) via CDN (client-side only)
- **Frontend:** Vanilla HTML5 / CSS3 / ES modules — no framework, no bundler
- **Tests:** `node:test` + `node:assert/strict` + `fast-check` (property-based, dev only)

---

## Built with Kiro

This project was built using **[Kiro](https://kiro.dev)** — an AI-assisted development environment — and deliberately exercises every major Kiro feature. Here's exactly how each feature was used:

### 1. Steering Documents
*Persistent instructions that Kiro reads automatically on every interaction.*

| File | Purpose |
|------|---------|
| `.kiro/steering/product.md` | Defines the vision, target users, value propositions, and non-goals — keeps Kiro focused on the right problem |
| `.kiro/steering/tech.md` | Mandates Node.js 20+ built-ins, no Express, `node:http`, JSON file persistence, CDN-only QR library |
| `.kiro/steering/structure.md` | Enforces directory layout, naming conventions, import order — every generated file matches the spec |
| `.kiro/steering/testing.md` | `inclusion: always` — Kiro always knows the testing philosophy: `node:test`, real HTTP server, ephemeral port, isolated temp data dir |

Kiro used these files to guide every code-generation decision without being re-explained each time.

### 2. Spec-Driven Development
*Structured specs (requirements → design → tasks) used as a north star for implementation.*

| File | Purpose |
|------|---------|
| `.kiro/specs/meetup-checkin/requirements.md` | EARS-format user stories (US-1.1 through US-5.1) with explicit acceptance criteria — Kiro cross-checked each endpoint against these ACs |
| `.kiro/specs/meetup-checkin/design.md` | Architecture overview, Mermaid sequence diagram, data model, full API table, and a **Correctness Properties** section defining six universal properties verified by property-based tests |
| `.kiro/specs/meetup-checkin/tasks.md` | Phase-by-phase implementation checklist — Kiro ticked items off as each file was completed |

The specs prevented scope creep and gave Kiro a concrete definition of "done".

### 3. Agent Hooks
*Automated actions triggered by file saves or git events.*

| File | Trigger | Action |
|------|---------|--------|
| `.kiro/hooks/test-on-save.json` | Any `src/*.js` file saved | Runs `npm test` immediately — regressions are caught before the developer moves on |
| `.kiro/hooks/readme-sync.json` | `src/routes.js` saved | Prompts Kiro to update the API Reference table in `README.md` to stay in sync |
| `.kiro/hooks/secret-scan.json` | Pre-git-commit | Greps staged files for hardcoded API keys, passwords, and tokens — warns if any are found |
| `.kiro/hooks/privacy-guard.json` | Any `src/*.js` or `mcp/*.js` file saved | Greps `data/`, `docs/`, and `src/` for real-looking email addresses (excluding example/test domains) and **fails loudly** if any are found — a second line of defense behind the sanitizer, ensuring platform PII can never land in the repo |

These hooks demonstrate Kiro's ability to enforce team conventions automatically.

### 4. MCP (Model Context Protocol)
*External tools connected directly into Kiro's context.*

| File | Server | Use |
|------|--------|-----|
| `.kiro/settings/mcp.json` | `awslabs.aws-documentation-mcp-server@latest` (via `uvx`) | Lets Kiro search official AWS docs in-context — ready for the next step of deploying MeetupPass to AWS |
| `.kiro/settings/mcp.json` | `mcp-server-fetch` (via `uvx`) | Lets Kiro read any public URL (library docs, CDN pages) without leaving the editor |
| `.kiro/settings/mcp.json` | `awsugmdu` (this repo's `node mcp/awsugmdu-mcp-server.js`) | The project's own zero-dependency MCP server exposing PII-sanitized awsugmdu.in meetups and stats — see the [Custom MCP Server](#custom-mcp-server--mcpawsugmdu-mcp-serverjs) section above |

The reviewer agent also has its own **agent-scoped** copy of the AWS documentation MCP server, and the event-ops agent has an agent-scoped copy of the `awsugmdu` server — see section 5 below.

MCP lets Kiro consult live documentation instead of relying on potentially stale training data.

### 5. Custom Agent
*A purpose-built agent with domain-specific review instructions, scoped MCP access, and startup hooks.*

| File | Role |
|------|------|
| `.kiro/agents/reviewer.json` | **Reviewer agent** — a senior Node.js engineer persona that reviews changes against the tech steering, spec ACs, API contract, test coverage, property-based correctness properties, and a security checklist, returning `APPROVED / NEEDS CHANGES / BLOCKED` with file:line comments. Run with `kiro-cli chat --agent reviewer`. |
| `.kiro/agents/event-ops.json` | **Event-ops agent** — an organizer assistant with an agent-scoped `awsugmdu` MCP server, pre-approved read-only platform tools, spec/steering resources, and an `agentSpawn` hook that prints live sanitized platform status. Run with `kiro-cli chat --agent event-ops`. See the [Event-Ops Agent](#event-ops-agent--kiroagentsevent-opsjson) section above for the real live-demo output. |

The reviewer agent is configured with three advanced features:

**Agent-scoped MCP server:** `reviewer.json` declares its own `mcpServers` entry for `awslabs.aws-documentation-mcp-server@latest`. This means the reviewer can call `@aws-documentation` tools (search, read, fetch sections) to look up AWS SDK usage, IAM policy syntax, and service best practices inline during a review — without requiring a workspace-level MCP connection.

**Pre-approved read-only MCP tools:** The `allowedTools` list includes `@aws-documentation/search_documentation`, `@aws-documentation/read_documentation`, and `@aws-documentation/read_sections` so the reviewer can use these tools without prompting for approval on every call.

**agentSpawn hooks:** When the reviewer agent starts, two commands run automatically to prime its context:
- `git status --short` — shows which files have been modified since the last commit
- `npm test --silent 2>&1 | tail -6` — runs the full test suite and surfaces the pass/fail summary so the reviewer immediately knows the current test health

### 6. Property-Based Testing (fast-check)
*Universal correctness properties verified across hundreds of random inputs.*

The `test/properties.test.js` and `test/platform-properties.test.js` files use **[fast-check](https://fast-check.dev)** (installed as a devDependency) alongside the standard `node:test` runner to verify nine properties. The first six are defined in `.kiro/specs/meetup-checkin/design.md § Correctness Properties`; properties 7–9 cover the platform integration. Each property runs with `numRuns: 100`, using the same temp-dir isolation pattern as `test/api.test.js`.

| Property | What it verifies |
|----------|-----------------|
| **P1 — Pass code format + uniqueness** | All pass codes match `/^[A-Z0-9]{8}$/` and are pairwise distinct across any set of RSVPs |
| **P2 — RSVP → Check-In round trip** | After check-in, exactly the right attendee is marked `checkedIn: true`; no other attendee changes |
| **P3 — Check-in idempotency** | A second check-in with the same code always returns 409; `checkedInAt` is never overwritten |
| **P4 — Dashboard invariants** | `0 ≤ totalCheckedIn ≤ totalRsvp ≤ capacity` and `remaining = capacity − totalCheckedIn` for any combination of RSVPs and check-ins |
| **P5 — Unknown codes never change state** | Any unrecognised pass code returns 404 and leaves the attendee list byte-for-byte identical |
| **P6 — CSV round-trip fidelity** | The export has exactly one row per attendee and correctly RFC 4180-quotes names/emails that contain commas or double-quote characters |
| **P7 — Sanitizer allow-list completeness** | `sanitizeMeetup()` never returns a key outside the allow-list, for arbitrary input objects seeded with PII keys |
| **P8 — Points invariant** | `totalPointsAwarded = checkedIn count × attendeePoints` for any RSVP/check-in combination |
| **P9 — Import idempotency** | The same `meetupId` always imports to the same `event.id` — no duplicate events |

The full test suite runs **55 tests**: 16 API integration tests (`api.test.js`) + 6 core property tests (`properties.test.js`) + 30 platform integration/MCP tests (`platform.test.js`) + 3 platform property tests (`platform-properties.test.js`).

```bash
npm test   # → 55 pass, 0 fail
```

fast-check found no bugs in this codebase — all nine properties hold against the current implementation.

### 7. Powers (Kiro Extensions)
*Packaged skills and MCP configuration that can be shared and installed by anyone.*

**Installed power — power-builder:** The `power-builder` power (installed from the Kiro registry) provides skills for authoring new powers to the [Agent Plugins v1.0.0 specification](https://agent-plugins.org/). Its guidance was used to structure `powers/meetuppass-events/`.

**Packaged power — meetuppass-events:** This repo ships a ready-to-install Kiro power at `powers/meetuppass-events/` that packages the knowledge from this project so anyone can build or operate a community check-in app with Kiro's help.

```bash
kiro-cli powers install ./powers/meetuppass-events
```

The power contains:

| File | Purpose |
|------|---------|
| `plugin.json` | Agent Plugins v1.0.0 manifest — name, keywords, author, schema ref (v1.1.0, adds `awsugmdu` / `platform-integration` / `mcp` keywords) |
| `mcp.json` | Bundles `mcp-server-fetch` (CDN/library docs) **and** the `awsugmdu` platform MCP server (`node mcp/awsugmdu-mcp-server.js`) |
| `skills/build-meetup-checkin-app/SKILL.md` | Step-by-step guide: persistence layer, route handlers, frontend, tests, steering docs |
| `skills/build-meetup-checkin-app/references/steering-templates.md` | Copy-paste-ready `.kiro/steering/` starter files |
| `skills/run-meetup-checkin-app/SKILL.md` | Operations guide: start, seed, test, export CSV, event-day checklist, troubleshooting |
| `skills/import-awsugmdu-meetup/SKILL.md` | Guide for importing an awsugmdu.in platform meetup into MeetupPass via the `awsugmdu` MCP tools and `POST /api/platform/import`, with the privacy rule called out |

### 8. Vibe / Chat Mode
The whole build was driven from a single natural-language prompt in `kiro-cli chat`: Kiro turned it into steering docs, a spec and a task list, then implemented the tasks. When the first session was throttled mid-build, `kiro-cli chat --resume` picked up the same conversation and finished the remaining tasks.

### 9. Autopilot / Autonomous Mode
Kiro autonomously:
- Read all existing files before writing any new code
- Created `public/checkin.html`, `public/dashboard.html`, `scripts/seed.js`, `test/api.test.js`, and `README.md` without step-by-step prompting
- Ran `npm run seed` and `npm test` and verified the server responds before finishing
- Marked each task in `tasks.md` as `[x]` as it was completed

---

## Project Structure

```
meetuppass/
├── .kiro/
│   ├── steering/               # product.md · tech.md · structure.md · testing.md · platform-integration.md
│   ├── specs/
│   │   ├── meetup-checkin/     # requirements.md · design.md (+ Correctness Properties) · tasks.md
│   │   └── awsugmdu-integration/  # requirements.md · design.md · tasks.md
│   ├── hooks/                  # test-on-save · readme-sync · secret-scan · privacy-guard
│   ├── settings/mcp.json       # AWS docs + fetch + awsugmdu MCP servers
│   └── agents/                 # reviewer.json · event-ops.json
├── src/
│   ├── server.js               # node:http entry point
│   ├── routes.js               # API route handlers (incl. platform routes) + static file serving
│   ├── db.js                   # JSON file persistence layer (events + attendees + points)
│   └── platform.js             # awsugmdu.in integration boundary + sanitizeMeetup()
├── mcp/
│   └── awsugmdu-mcp-server.js  # zero-dependency JSON-RPC 2.0 stdio MCP server
├── public/
│   ├── index.html              # Event list + create form
│   ├── platform.html           # Browse & import awsugmdu.in meetups
│   ├── rsvp.html               # RSVP form + QR pass
│   ├── checkin.html            # Check-in desk
│   ├── dashboard.html          # Live dashboard + leaderboard + sync + CSV export
│   ├── style.css               # Shared styles (CSS custom properties)
│   └── app.js                  # Shared client utilities
├── powers/
│   └── meetuppass-events/      # Installable Kiro power (Agent Plugins v1.0.0, v1.1.0)
│       ├── plugin.json
│       ├── mcp.json            # fetch + awsugmdu MCP servers
│       ├── skills/
│       │   ├── build-meetup-checkin-app/SKILL.md
│       │   ├── run-meetup-checkin-app/SKILL.md
│       │   └── import-awsugmdu-meetup/SKILL.md
│       └── README.md
├── docs/
│   ├── agent-demo.md           # Real event-ops agent transcript + command
│   └── screenshots/            # home · rsvp-pass · checkin-success · checkin-duplicate · dashboard
├── scripts/
│   ├── seed.js                 # Standard event + platform-linked event with points
│   └── platform-status.js      # agentSpawn hook: prints live sanitized platform status
├── test/
│   ├── api.test.js             # 16 node:test integration tests
│   ├── properties.test.js      # 6 fast-check core property tests (100 runs each)
│   ├── platform.test.js        # 30 platform integration + MCP tests
│   └── platform-properties.test.js  # 3 fast-check platform property tests (P7–P9)
├── data/.gitkeep               # JSON files ignored; directory kept in git
└── package.json                # type: module; devDeps: fast-check; scripts: start, seed, test
```

---

## License

MIT — AWS User Group Madurai
