# meetuppass-events — Kiro Power

A [Kiro](https://kiro.dev) power that helps you **build and operate community meetup check-in apps**. Distilled from [MeetupPass](../../README.md), a production-style event check-in app built for AWS User Group Madurai.

## What This Power Does

Installing this power gives Kiro two skills:

| Skill | When it activates |
|-------|------------------|
| **build-meetup-checkin-app** | When you ask Kiro to build, scaffold, or create a new check-in app from scratch |
| **run-meetup-checkin-app** | When you ask Kiro to start, test, seed, export, or troubleshoot an existing check-in app |

It also enables the **`fetch` MCP server** so Kiro can look up CDN documentation (e.g. `qrcode.js`) inline while helping you build.

## Install

### From this repository (local path)

```bash
kiro-cli powers install ./powers/meetuppass-events
```

### From a GitHub repository (once published)

Open Kiro Powers UI → Add Custom Power → GitHub Repository → enter the repo URL.

## Uninstall

```bash
kiro-cli powers uninstall meetuppass-events
```

## What You Get

After installing, tell Kiro:

- *"Build me a meetup check-in app for [Your Group Name]"* → activates `build-meetup-checkin-app`
- *"Start the server and seed demo data"* → activates `run-meetup-checkin-app`
- *"Export the attendee CSV for tonight's event"* → activates `run-meetup-checkin-app`

## Power Contents

```
powers/meetuppass-events/
├── plugin.json                                     # Agent Plugins v1.0.0 manifest
├── mcp.json                                        # fetch MCP server (uvx mcp-server-fetch)
├── skills/
│   ├── build-meetup-checkin-app/
│   │   ├── SKILL.md                                # Build guide: server, DB, API, frontend, tests
│   │   └── references/
│   │       └── steering-templates.md              # Copy-paste Kiro steering docs
│   └── run-meetup-checkin-app/
│       └── SKILL.md                               # Operations: start, seed, test, export, debug
└── README.md                                      # This file
```

## Tech Stack Enforced by This Power

- **Node.js 20+** — zero runtime npm dependencies
- `node:http` server (no Express)
- `node:fs/promises` JSON persistence
- `node:crypto` for pass codes
- `node:test` + `node:assert/strict` for tests
- `qrcode.js` via CDN (no npm package)

## License

MIT — AWS User Group Madurai
