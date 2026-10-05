# MeetupPass 🎟

**Event check-in made simple — built for AWS User Group Madurai.**

MeetupPass is a lightweight, zero-dependency web app that replaces spreadsheets and manual attendance tracking for community meetups. Organizers create events, attendees RSVP and receive a unique QR-code pass, and check-in staff scan or type the code at the door.

> **Kiro University 2026 Final Project** — this repo demonstrates every major Kiro feature end-to-end.

---

## Screenshot

```
┌──────────────────────────────────────────────────────┐
│  MeetupPass  |  Events  |  Check-In  |  Dashboard    │
├──────────────────────────────────────────────────────┤
│  🎟 Your MeetupPass                                  │
│  AWS User Group Madurai – October Meetup 2026        │
│  ┌─────────────────┐                                 │
│  │  ▉▉▉ QR CODE ▉▉▉│  Pass Code: A1B2C3D4           │
│  └─────────────────┘                                 │
│  [ ⬇ Download Pass ]  [ ← Back to Events ]          │
└──────────────────────────────────────────────────────┘
```

*(Replace with an actual screenshot for your demo video)*

---

## Quick Start

```bash
# Prerequisites: Node.js 20+
git clone <repo-url>
cd kiro-uni-project
npm install          # no runtime dependencies — installs nothing
npm run seed         # creates data/events.json + data/attendees.json with demo data
npm start            # → http://localhost:3000
npm test             # runs all API tests with node:test
```

**Pages:**

| URL | Description |
|-----|-------------|
| `http://localhost:3000/` | Event list + create-event form |
| `http://localhost:3000/rsvp.html?eventId=<id>` | Attendee RSVP + QR pass |
| `http://localhost:3000/checkin.html?eventId=<id>` | Check-in desk |
| `http://localhost:3000/dashboard.html?eventId=<id>` | Live dashboard + CSV export |

---

## API Reference

| Method | Path | Description | Request Body | Response |
|--------|------|-------------|--------------|----------|
| `GET`  | `/api/events` | List all events | — | `Event[]` 200 |
| `POST` | `/api/events` | Create an event | `{ name, date, venue, capacity }` | `Event` 201 |
| `GET`  | `/api/events/:id` | Get single event | — | `Event` 200 |
| `POST` | `/api/rsvp` | RSVP for an event | `{ eventId, name, email }` | `{ passCode, attendeeId }` 201 |
| `POST` | `/api/checkin` | Check in an attendee | `{ passCode }` | `{ success, attendee }` 200 |
| `GET`  | `/api/dashboard/:eventId` | Live stats | — | `{ event, totalRsvp, totalCheckedIn, remaining, recentCheckIns }` 200 |
| `GET`  | `/api/export/:eventId` | Download CSV | — | `text/csv` 200 |

**Error shape:** all errors return `{ "error": "<message>" }` with the appropriate HTTP status code (400, 404, 409, 500).

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
  "checkedInAt": null
}
```

---

## Stack

- **Runtime:** Node.js 20+ — zero npm runtime dependencies
- **Server:** `node:http` — no Express
- **Persistence:** `node:fs/promises` — JSON files in `./data/`
- **Pass codes:** `node:crypto` — `randomBytes(6).toString('base64url')`
- **QR codes:** [qrcode.js](https://github.com/davidshimjs/qrcodejs) via CDN (client-side only)
- **Frontend:** Vanilla HTML5 / CSS3 / ES modules — no framework, no bundler
- **Tests:** `node:test` + `node:assert/strict`

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
| `.kiro/specs/meetup-checkin/design.md` | Architecture overview, Mermaid sequence diagram, data model, full API table — served as the contract for `src/routes.js` |
| `.kiro/specs/meetup-checkin/tasks.md` | Phase-by-phase implementation checklist — Kiro ticked items off as each file was completed |

The specs prevented scope creep and gave Kiro a concrete definition of "done".

### 3. Agent Hooks
*Automated actions triggered by file saves or git events.*

| File | Trigger | Action |
|------|---------|--------|
| `.kiro/hooks/test-on-save.json` | Any `src/*.js` file saved | Runs `npm test` immediately — regressions are caught before the developer moves on |
| `.kiro/hooks/readme-sync.json` | `src/routes.js` saved | Prompts Kiro to update the API Reference table in `README.md` to stay in sync |
| `.kiro/hooks/secret-scan.json` | Pre-git-commit | Greps staged files for hardcoded API keys, passwords, and tokens — warns if any are found |

These hooks demonstrate Kiro's ability to enforce team conventions automatically.

### 4. MCP (Model Context Protocol)
*External tools connected directly into Kiro's context.*

| File | Server | Use |
|------|--------|-----|
| `.kiro/settings/mcp.json` | `awslabs.aws-documentation-mcp-server@latest` (via `uvx`) | Lets Kiro search official AWS docs in-context — ready for the next step of deploying MeetupPass to AWS |
| `.kiro/settings/mcp.json` | `mcp-server-fetch` (via `uvx`) | Lets Kiro read any public URL (library docs, CDN pages) without leaving the editor |

MCP lets Kiro consult live documentation instead of relying on potentially stale training data.

### 5. Custom Agent
*A purpose-built agent with domain-specific review instructions.*

| File | Role |
|------|------|
| `.kiro/agents/reviewer.json` | **Reviewer agent** — a senior Node.js engineer persona that reviews changes against the tech steering, spec ACs, API contract, test coverage and a security checklist, returning `APPROVED / NEEDS CHANGES / BLOCKED` with file:line comments. Run it with `kiro-cli chat --agent reviewer`. |

### 6. Vibe / Chat Mode
The whole build was driven from a single natural-language prompt in `kiro-cli chat`: Kiro turned it into steering docs, a spec and a task list, then implemented the tasks. When the first session was throttled mid-build, `kiro-cli chat --resume` picked up the same conversation and finished the remaining tasks.

### 7. Autopilot / Autonomous Mode
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
│   ├── steering/          # product.md · tech.md · structure.md · testing.md
│   ├── specs/meetup-checkin/   # requirements.md · design.md · tasks.md
│   ├── hooks/             # test-on-save · readme-sync · secret-scan
│   ├── settings/mcp.json  # AWS docs + fetch MCP servers
│   └── agents/reviewer.json
├── src/
│   ├── server.js          # node:http entry point
│   ├── routes.js          # API route handlers + static file serving
│   └── db.js              # JSON file persistence layer
├── public/
│   ├── index.html         # Event list + create form
│   ├── rsvp.html          # RSVP form + QR pass
│   ├── checkin.html       # Check-in desk
│   ├── dashboard.html     # Live dashboard + CSV export
│   ├── style.css          # Shared styles (CSS custom properties)
│   └── app.js             # Shared client utilities
├── scripts/seed.js        # Demo event + 22 attendees, ~1/3 checked in
├── test/api.test.js       # node:test integration tests
├── data/.gitkeep          # JSON files ignored; directory kept in git
└── package.json           # type: module; scripts: start, seed, test
```

---

## License

MIT — AWS User Group Madurai
