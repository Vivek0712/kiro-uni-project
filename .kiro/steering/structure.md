# Structure Steering — MeetupPass

## Directory Layout

```
meetuppass/
├── .kiro/
│   ├── steering/          # Kiro steering documents (always included)
│   │   ├── product.md
│   │   ├── tech.md
│   │   ├── structure.md
│   │   └── testing.md
│   ├── specs/
│   │   └── meetup-checkin/
│   │       ├── requirements.md   # EARS-format user stories
│   │       ├── design.md         # Architecture + data model + API
│   │       └── tasks.md          # Implementation checklist
│   ├── hooks/             # Agent automation hooks
│   │   ├── kironomics.json       # DO NOT MODIFY
│   │   ├── test-on-save.json
│   │   ├── readme-sync.json
│   │   └── secret-scan.json
│   ├── settings/
│   │   └── mcp.json       # MCP server configuration
│   └── agents/
│       └── reviewer.json  # Custom reviewer agent
├── src/
│   ├── server.js          # HTTP server entry point
│   ├── routes.js          # Route handlers
│   └── db.js              # JSON file persistence layer
├── public/
│   ├── index.html         # Event list + create event
│   ├── rsvp.html          # RSVP form + QR pass display
│   ├── checkin.html       # Check-in desk
│   ├── dashboard.html     # Live dashboard
│   ├── style.css          # Shared styles
│   └── app.js             # Shared client-side utilities
├── scripts/
│   └── seed.js            # Seed demo event + ~20 attendees
├── test/
│   └── api.test.js        # node:test API tests
├── data/
│   └── .gitkeep           # Keeps data/ in git; JSON files are ignored
├── .gitignore
├── package.json
└── README.md
```

## Naming Conventions
- Files: `kebab-case.js`
- Functions/variables: `camelCase`
- Constants: `UPPER_SNAKE_CASE`
- HTML IDs/classes: `kebab-case`

## Import Order (within JS files)
1. Node built-ins (`node:http`, `node:fs/promises`, …)
2. Local modules (`./db.js`, `./routes.js`)
3. No third-party imports in server-side code

## Public Asset Serving
Static files in `./public/` are served by the built-in file server in `src/routes.js` — no separate static middleware.
