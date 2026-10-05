/**
 * properties.test.js — Property-based tests for MeetupPass.
 *
 * Uses node:test + fast-check (numRuns >= 100 per property).
 * Spins up the real HTTP server on an ephemeral port; uses a temp data dir
 * (MEETUPPASS_DATA_DIR) so ./data demo data is never touched.
 *
 * Feature: meetup-checkin
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { rm } from 'node:fs/promises';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import fc from 'fast-check';

// ── Temp data dir isolation ───────────────────────────────────────────────────
// MUST be set before any import of src/ modules.
const DATA_DIR = mkdtempSync(join(tmpdir(), 'meetuppass-props-'));
process.env.MEETUPPASS_DATA_DIR = DATA_DIR;

// Dynamically import routes AFTER setting env (same pattern as api.test.js).
const { handleRequest } = await import('../src/routes.js');

// ── Test server helpers ───────────────────────────────────────────────────────

let server;
let base;

async function startServer() {
  return new Promise((resolve) => {
    server = createServer(async (req, res) => {
      await handleRequest(req, res);
    });
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      base = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
}

async function stopServer() {
  return new Promise((resolve) => server.close(resolve));
}

/** Thin fetch wrapper — returns { status, body } */
async function api(method, path, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(`${base}${path}`, opts);
  const text = await res.text();
  let parsed;
  try { parsed = JSON.parse(text); } catch { parsed = text; }
  return { status: res.status, body: parsed };
}

/** Create a fresh event via the API; returns the event object. */
async function createEvent(capacity = 200) {
  const { status, body } = await api('POST', '/api/events', {
    name: `Prop Test Event ${Date.now()}`,
    date: '2026-12-01',
    venue: 'Test Venue',
    capacity,
  });
  assert.equal(status, 201);
  return body;
}

/** RSVP a single attendee; returns { passCode, attendeeId }. */
async function rsvp(eventId, name, email) {
  const { status, body } = await api('POST', '/api/rsvp', { eventId, name, email });
  assert.equal(status, 201, `RSVP failed for ${email}: ${JSON.stringify(body)}`);
  return body;
}

// ── Arbitraries ───────────────────────────────────────────────────────────────

/**
 * A safe name: no null bytes, stripped of characters that cause HTTP/JSON grief,
 * length 1-40 chars.
 */
const safeName = fc.string({ minLength: 1, maxLength: 40 })
  .map(s => s.replace(/[\x00-\x1f]/g, '').trim() || 'A')
  .filter(s => s.length >= 1);

/**
 * A local email part (avoids control chars, ≥1 char each side of @).
 */
const safeEmail = fc.tuple(
  fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789'.split('')), { minLength: 1, maxLength: 12 }),
  fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')), { minLength: 2, maxLength: 8 }),
  fc.constantFrom('com', 'org', 'net', 'io')
).map(([local, domain, tld]) => `${local}@${domain}.${tld}`);

/**
 * A name that may contain commas and double-quotes (for CSV round-trip tests).
 * Keeps length bounded, no newlines/control chars.
 */
const csvRiskyName = fc.string({ minLength: 1, maxLength: 30 })
  .map(s => s
    .replace(/[\x00-\x1f\r\n]/g, '')
    .replace(/[^\x20-\x7E]/g, '')
    .trim() || 'A'
  )
  .filter(s => s.length >= 1);

// ── Suite ─────────────────────────────────────────────────────────────────────

before(startServer);
after(async () => {
  await stopServer();
  await rm(DATA_DIR, { recursive: true, force: true });
});

// ─────────────────────────────────────────────────────────────────────────────
// Property 1: Pass code format + uniqueness
// Feature: meetup-checkin, Property 1: Pass codes are 8-char A-Z0-9 and unique
// ─────────────────────────────────────────────────────────────────────────────
describe('Property 1: pass code format and uniqueness', () => {
  it('all passCodes are /^[A-Z0-9]{8}$/ and pairwise distinct', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate 2-8 unique emails for a single event
        fc.uniqueArray(safeEmail, { minLength: 2, maxLength: 8 }),
        async (emails) => {
          const event = await createEvent(200);
          const codes = [];
          for (let i = 0; i < emails.length; i++) {
            const { passCode } = await rsvp(event.id, `Attendee${i}`, emails[i]);
            codes.push(passCode);
          }
          // Format check
          for (const code of codes) {
            assert.match(code, /^[A-Z0-9]{8}$/, `passCode "${code}" does not match /^[A-Z0-9]{8}$/`);
          }
          // Uniqueness check
          const unique = new Set(codes);
          assert.equal(unique.size, codes.length, `Duplicate pass codes found: ${codes}`);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Property 2: RSVP → Check-In round trip
// Feature: meetup-checkin, Property 2: RSVP then check-in marks exactly that attendee
// ─────────────────────────────────────────────────────────────────────────────
describe('Property 2: RSVP → check-in round trip', () => {
  it('check-in marks the correct attendee checkedIn=true and no other attendee', async () => {
    await fc.assert(
      fc.asyncProperty(
        // 1-5 other attendees + 1 target attendee
        fc.uniqueArray(safeEmail, { minLength: 2, maxLength: 6 }),
        fc.integer({ min: 0, max: 4 }), // index of target attendee
        async (emails, targetIdx) => {
          const idx = targetIdx % emails.length;
          const event = await createEvent(200);

          // RSVP all
          const attendees = [];
          for (let i = 0; i < emails.length; i++) {
            const result = await rsvp(event.id, `User ${i}`, emails[i]);
            attendees.push(result);
          }

          const target = attendees[idx];
          const { status, body } = await api('POST', '/api/checkin', { passCode: target.passCode });

          assert.equal(status, 200, `check-in returned ${status}: ${JSON.stringify(body)}`);
          assert.equal(body.success, true);
          assert.ok(body.attendee.checkedInAt, 'checkedInAt should be set');

          // Read dashboard to verify counts
          const { body: dash } = await api('GET', `/api/dashboard/${event.id}`);
          assert.equal(dash.totalCheckedIn, 1, 'exactly 1 attendee should be checked in');
          assert.equal(dash.totalRsvp, emails.length);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Property 3: Check-in idempotency — second check-in → 409, state unchanged
// Feature: meetup-checkin, Property 3: Duplicate check-in is rejected without side-effects
// ─────────────────────────────────────────────────────────────────────────────
describe('Property 3: check-in idempotency', () => {
  it('second check-in returns 409 and leaves state unchanged', async () => {
    await fc.assert(
      fc.asyncProperty(safeEmail, async (email) => {
        const event = await createEvent(200);
        const { passCode } = await rsvp(event.id, 'Idem User', email);

        // First check-in — must succeed
        const first = await api('POST', '/api/checkin', { passCode });
        assert.equal(first.status, 200, `First check-in failed: ${JSON.stringify(first.body)}`);
        const firstCheckedInAt = first.body.attendee.checkedInAt;

        // Second check-in — must be 409
        const second = await api('POST', '/api/checkin', { passCode });
        assert.equal(second.status, 409, `Expected 409 on second check-in, got ${second.status}`);
        assert.match(second.body.error, /already checked in/i);

        // checkedInAt must NOT change
        assert.equal(second.body.checkedInAt, firstCheckedInAt, 'checkedInAt changed on second attempt');

        // Dashboard still shows exactly 1 checked in
        const { body: dash } = await api('GET', `/api/dashboard/${event.id}`);
        assert.equal(dash.totalCheckedIn, 1);
      }),
      { numRuns: 100 }
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Property 4: Dashboard invariants — totalCheckedIn ≤ totalRsvp ≤ capacity
// Feature: meetup-checkin, Property 4: Dashboard counts are always internally consistent
// ─────────────────────────────────────────────────────────────────────────────
describe('Property 4: dashboard invariants', () => {
  it('0 ≤ totalCheckedIn ≤ totalRsvp ≤ capacity and remaining = capacity - totalCheckedIn', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 2, max: 8 }), // number of RSVPs
        fc.integer({ min: 0, max: 7 }), // number to check in (clamped to rsvpCount)
        async (rsvpCount, checkInCount) => {
          const capacity = rsvpCount + 5; // ensure capacity ≥ rsvpCount
          const toCheckIn = Math.min(checkInCount, rsvpCount);
          const event = await createEvent(capacity);

          // RSVP rsvpCount unique attendees
          const codes = [];
          for (let i = 0; i < rsvpCount; i++) {
            const email = `inv${i}${Date.now()}${Math.random().toString(36).slice(2)}@example.com`;
            const { passCode } = await rsvp(event.id, `Inv${i}`, email);
            codes.push(passCode);
          }

          // Check in `toCheckIn` of them
          for (let i = 0; i < toCheckIn; i++) {
            await api('POST', '/api/checkin', { passCode: codes[i] });
          }

          const { status, body: dash } = await api('GET', `/api/dashboard/${event.id}`);
          assert.equal(status, 200);

          assert.ok(dash.totalCheckedIn >= 0, 'totalCheckedIn must be ≥ 0');
          assert.ok(dash.totalCheckedIn <= dash.totalRsvp, 'totalCheckedIn must be ≤ totalRsvp');
          assert.ok(dash.totalRsvp <= capacity, 'totalRsvp must be ≤ capacity');
          assert.ok(dash.remaining >= 0, 'remaining must be ≥ 0');
          assert.equal(dash.remaining, capacity - dash.totalCheckedIn, 'remaining must equal capacity - totalCheckedIn');
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Property 5: Unknown pass codes → 404, state unchanged
// Feature: meetup-checkin, Property 5: Invalid codes are rejected without side-effects
// ─────────────────────────────────────────────────────────────────────────────
describe('Property 5: unknown pass codes never change state', () => {
  it('unknown passCode → 404 and attendee list is unchanged', async () => {
    await fc.assert(
      fc.asyncProperty(
        // A pass code that won't match real ones: use a fixed prefix + random suffix
        fc.stringOf(fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split('')), { minLength: 8, maxLength: 8 }),
        safeEmail,
        async (badCode, email) => {
          const event = await createEvent(200);
          const { passCode: realCode } = await rsvp(event.id, 'State User', email);

          // Attempt check-in with the random code (skip if it accidentally equals realCode)
          if (badCode === realCode) return;

          const { status, body } = await api('POST', '/api/checkin', { passCode: badCode });
          assert.equal(status, 404, `Expected 404 for unknown code "${badCode}", got ${status}: ${JSON.stringify(body)}`);

          // Dashboard: the real attendee must NOT be checked in
          const { body: dash } = await api('GET', `/api/dashboard/${event.id}`);
          assert.equal(dash.totalCheckedIn, 0, 'Unknown code check-in must not change state');
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Property 6: CSV export fidelity — one row per attendee, round-trips names/emails
// Feature: meetup-checkin, Property 6: CSV correctly encodes all name/email values
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parse a single RFC-4180 CSV line into field values.
 * Handles quoted fields (including "" for embedded quotes) and unquoted fields.
 */
function parseCsvLine(line) {
  const fields = [];
  let i = 0;
  while (i < line.length) {
    if (line[i] === '"') {
      // Quoted field
      let field = '';
      i++; // skip opening quote
      while (i < line.length) {
        if (line[i] === '"') {
          if (line[i + 1] === '"') {
            field += '"';
            i += 2;
          } else {
            i++; // skip closing quote
            break;
          }
        } else {
          field += line[i++];
        }
      }
      fields.push(field);
      if (line[i] === ',') i++; // skip comma separator
    } else {
      // Unquoted field — read until comma or end
      const end = line.indexOf(',', i);
      if (end === -1) {
        fields.push(line.slice(i));
        break;
      }
      fields.push(line.slice(i, end));
      i = end + 1;
    }
  }
  return fields;
}

describe('Property 6: CSV export fidelity', () => {
  it('CSV has exactly one row per attendee and round-trips names/emails with commas and quotes', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uniqueArray(
          fc.record({ name: csvRiskyName, email: safeEmail }),
          {
            minLength: 1,
            maxLength: 6,
            selector: r => r.email, // uniqueness by email
          }
        ),
        async (attendeeData) => {
          const event = await createEvent(200);

          // RSVP all attendees
          for (const { name, email } of attendeeData) {
            await rsvp(event.id, name, email);
          }

          // Fetch CSV
          const res = await fetch(`${base}/api/export/${event.id}`);
          assert.equal(res.status, 200);
          assert.match(res.headers.get('content-type') || '', /text\/csv/i);

          const csvText = await res.text();
          const lines = csvText.trim().split('\n');

          // Header + one row per attendee
          assert.equal(
            lines.length,
            attendeeData.length + 1,
            `Expected ${attendeeData.length + 1} lines (1 header + ${attendeeData.length} data), got ${lines.length}`
          );

          // Header must contain expected columns
          const header = lines[0];
          assert.ok(header.includes('name'), 'header must include "name"');
          assert.ok(header.includes('email'), 'header must include "email"');

          // Parse header to find name/email column indices
          const headerFields = header.split(',');
          const nameIdx = headerFields.indexOf('name');
          const emailIdx = headerFields.indexOf('email');
          assert.ok(nameIdx >= 0, 'name column not found in header');
          assert.ok(emailIdx >= 0, 'email column not found in header');

          // Build lookup of original names/emails by email key
          const origByEmail = new Map(attendeeData.map(a => [a.email, a]));

          // Verify each data row
          for (let i = 1; i < lines.length; i++) {
            const fields = parseCsvLine(lines[i]);
            const csvName = fields[nameIdx];
            const csvEmail = fields[emailIdx];

            // email round-trips exactly
            const orig = origByEmail.get(csvEmail);
            assert.ok(orig !== undefined, `Unexpected email in CSV: "${csvEmail}"`);
            // name round-trips exactly
            assert.equal(csvName, orig.name, `Name mismatch for ${csvEmail}: expected "${orig.name}", got "${csvName}"`);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
