# Tech Steering — MeetupPass

## Runtime
- **Node.js 20+** — use built-in modules wherever possible.
- No build step; plain ES modules with `"type": "module"` is acceptable but CommonJS is the default for Node compatibility.

## Backend
- `node:http` for the HTTP server — no Express or other frameworks.
- `node:fs/promises` for JSON file persistence in `./data/`.
- `node:crypto` for generating unique pass codes (`crypto.randomBytes`).
- `node:path` and `node:url` for path resolution.
- Server listens on `process.env.PORT || 3000`.

## Frontend
- Plain HTML5, CSS3, and vanilla JS — no React, Vue, or bundlers.
- QR codes rendered client-side using the `qrcode.js` library loaded from a CDN (unpkg or jsDelivr). No npm dependency.
- Auto-refresh dashboard via `setInterval` polling every 5 seconds (no WebSockets needed for v1).
- CSS custom properties for theming; responsive grid layout.

## Data Persistence
- Single JSON file per collection: `data/events.json`, `data/attendees.json`.
- Reads happen on each request (acceptable at meetup scale).
- Writes use atomic-style pattern: read → mutate → write with `fs.writeFile`.

## Testing
- `node:test` (built-in test runner, Node 20+).
- `node:assert` for assertions.
- Tests spin up the real HTTP server on an ephemeral port and use `fetch` (built-in Node 18+).
- No mocks for the file system; tests point `MEETUPPASS_DATA_DIR` at a temp dir so `./data` is never touched.

## Code Style
- 2-space indentation.
- `const`/`let` only; no `var`.
- Async/await throughout; no callback hell.
- JSDoc comments on all exported functions.
