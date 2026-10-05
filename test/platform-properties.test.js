/**
 * platform-properties.test.js — Property-based tests for the platform integration.
 *
 * Uses node:test + fast-check.
 * Tests Properties 7, 8, 9 from .kiro/specs/awsugmdu-integration/design.md.
 *
 * Property 7: sanitizeMeetup() never leaks any key outside the allow-list.
 * Property 8: total points = checkedIn count × attendeePoints (invariant).
 * Property 9: POST /api/platform/import is idempotent for any meetupId.
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { rm } from 'node:fs/promises';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import fc from 'fast-check';

// ── Temp data dir ─────────────────────────────────────────────────────────────
const DATA_DIR = mkdtempSync(join(tmpdir(), 'meetuppass-props-platform-'));
process.env.MEETUPPASS_DATA_DIR = DATA_DIR;

// ── Allow-list (must match src/platform.js exactly) ───────────────────────────
const ALLOWED_MEETUP_KEYS = new Set([
  'id', 'title', 'date', 'time', 'duration', 'type', 'status',
  'maxAttendees', 'attendees', 'image', 'meetupUrl',
  'hostPoints', 'speakerPoints', 'volunteerPoints',
]);

// ── Mock platform server ──────────────────────────────────────────────────────
let mockServer;
let mockBase;
let mockMeetups = [];

async function startMockServer() {
  return new Promise((resolve) => {
    mockServer = createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      if (req.url === '/meetups') {
        res.end(JSON.stringify({ meetups: mockMeetups }));
      } else if (req.url === '/stats') {
        res.end(JSON.stringify({ memberCount: 100, meetupCount: 5, badgeCount: 10, generatedAt: new Date().toISOString() }));
      } else {
        res.writeHead(404);
        res.end('{}');
      }
    });
    mockServer.listen(0, '127.0.0.1', () => {
      const { port } = mockServer.address();
      mockBase = `http://127.0.0.1:${port}`;
      process.env.AWSUGMDU_API_BASE = mockBase;
      resolve();
    });
  });
}

async function stopMockServer() {
  return new Promise(resolve => mockServer.close(resolve));
}

// ── MeetupPass test server ────────────────────────────────────────────────────
let appServer;
let appBase;

async function startAppServer() {
  const { handleRequest } = await import('../src/routes.js');
  return new Promise((resolve) => {
    appServer = createServer(async (req, res) => {
      await handleRequest(req, res);
    });
    appServer.listen(0, '127.0.0.1', () => {
      appBase = `http://127.0.0.1:${appServer.address().port}`;
      resolve();
    });
  });
}

async function stopAppServer() {
  return new Promise(resolve => appServer.close(resolve));
}

async function api(method, path, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${appBase}${path}`, opts);
  const text = await res.text();
  let parsed;
  try { parsed = JSON.parse(text); } catch { parsed = text; }
  return { status: res.status, body: parsed };
}

before(async () => {
  await startMockServer();
  await startAppServer();
});

after(async () => {
  await stopAppServer();
  await stopMockServer();
  await rm(DATA_DIR, { recursive: true, force: true });
});

// ─────────────────────────────────────────────────────────────────────────────
// Property 7: sanitizeMeetup() allow-list — no key outside the allow-list ever
// ─────────────────────────────────────────────────────────────────────────────
describe('Property 7: sanitizeMeetup allow-list completeness', () => {
  it('never returns a key outside the allow-list for arbitrary input objects', async () => {
    const { sanitizeMeetup } = await import('../src/platform.js');

    await fc.assert(
      fc.property(
        // Generate arbitrary object with up to 20 keys (including some PII-like ones)
        fc.dictionary(
          fc.oneof(
            fc.constantFrom(
              'id', 'title', 'date', 'hosts', 'speakers', 'email', 'userId',
              'registeredUsers', 'attendedUsers', 'volunteers', 'phone',
              'type', 'status', 'hostPoints', 'image', 'meetupUrl',
              'maxAttendees', 'attendees', 'duration', 'time',
              'speakerPoints', 'volunteerPoints'
            ),
            fc.string({ maxLength: 20 }),
          ),
          fc.jsonValue(),
          { maxKeys: 20 }
        ),
        (obj) => {
          const result = sanitizeMeetup(obj);
          const resultKeys = Object.keys(result);
          for (const key of resultKeys) {
            assert.ok(
              ALLOWED_MEETUP_KEYS.has(key),
              `Key "${key}" is outside the allow-list but was returned by sanitizeMeetup()`
            );
          }
          // No PII keys
          assert.equal(result.hosts, undefined);
          assert.equal(result.email, undefined);
          assert.equal(result.userId, undefined);
          assert.equal(result.registeredUsers, undefined);
          assert.equal(result.attendedUsers, undefined);
          assert.equal(result.volunteers, undefined);
          assert.equal(result.phone, undefined);
          assert.equal(result.speakers, undefined);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Property 8: Points invariant
// totalPointsAwarded = totalCheckedIn × attendeePoints
// every checked-in attendee has pointsAwarded = attendeePoints
// every non-checked-in attendee has pointsAwarded = null
// ─────────────────────────────────────────────────────────────────────────────
describe('Property 8: points invariant', () => {
  it('totalPointsAwarded = checkedIn × attendeePoints for any rsvp/check-in combination', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 6 }), // rsvpCount
        fc.integer({ min: 0, max: 5 }), // checkInCount (clamped to rsvpCount)
        fc.integer({ min: 1, max: 50 }), // attendeePoints
        async (rsvpCount, rawCheckInCount, attendeePoints) => {
          const checkInCount = Math.min(rawCheckInCount, rsvpCount);

          // Create event with given attendeePoints
          const { body: evt } = await api('POST', '/api/events', {
            name: `Points Prop Event ${Date.now()}`,
            date: '2026-12-01',
            venue: 'Test Venue',
            capacity: 100,
            attendeePoints,
          });
          const eventId = evt.id;

          // RSVP rsvpCount attendees
          const codes = [];
          for (let i = 0; i < rsvpCount; i++) {
            const email = `pp${i}${Date.now()}${Math.random().toString(36).slice(2)}@example.com`;
            const { body: rsvp } = await api('POST', '/api/rsvp', { eventId, name: `User ${i}`, email });
            codes.push(rsvp.passCode);
          }

          // Check in checkInCount of them
          for (let i = 0; i < checkInCount; i++) {
            await api('POST', '/api/checkin', { passCode: codes[i] });
          }

          // Fetch dashboard
          const { body: dash } = await api('GET', `/api/dashboard/${eventId}`);
          assert.equal(dash.totalCheckedIn, checkInCount, 'totalCheckedIn mismatch');
          assert.equal(dash.totalPointsAwarded, checkInCount * attendeePoints, 'totalPointsAwarded invariant failed');

          // Verify per-attendee records
          const { body: attendees } = await api('GET', `/api/attendees/${eventId}`);
          for (const a of attendees) {
            if (a.checkedIn) {
              assert.equal(a.pointsAwarded, attendeePoints, `checked-in attendee ${a.name} should have pointsAwarded=${attendeePoints}`);
            } else {
              assert.equal(a.pointsAwarded, null, `non-checked-in attendee ${a.name} should have pointsAwarded=null`);
            }
          }
        }
      ),
      { numRuns: 50 }
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Property 9: Import idempotency
// Calling POST /api/platform/import with the same meetupId twice always returns
// the same event.id and never creates duplicate events.
// ─────────────────────────────────────────────────────────────────────────────
describe('Property 9: import idempotency', () => {
  it('same meetupId always returns the same event.id, no duplicates', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate unique meetup IDs (short alphanumeric)
        fc.stringOf(fc.constantFrom(...'abcdefghijklmnop0123456789'.split('')), { minLength: 4, maxLength: 10 }),
        async (meetupIdSuffix) => {
          const meetupId = `prop-test-${meetupIdSuffix}`;

          // Set up mock to return a meetup with this ID
          const fakeMeetup = {
            id: meetupId,
            title: `Meetup ${meetupId}`,
            date: '2026-12-01',
            maxAttendees: 40,
            type: 'circles',
            status: 'upcoming',
          };
          mockMeetups = [fakeMeetup];

          // First import
          const first = await api('POST', '/api/platform/import', { meetupId });
          assert.ok(
            first.status === 201 || first.status === 200,
            `First import should be 201 or 200, got ${first.status}`
          );
          const firstEventId = first.body.id;

          // Second import
          const second = await api('POST', '/api/platform/import', { meetupId });
          assert.equal(second.status, 200, 'Second import should return 200');
          assert.equal(second.body.id, firstEventId, 'Second import should return the same event');

          // Verify only one event with this platformMeetupId exists
          const { body: allEvents } = await api('GET', '/api/events');
          const matches = allEvents.filter(e => e.platformMeetupId === meetupId);
          assert.equal(matches.length, 1, `Expected exactly 1 event with platformMeetupId="${meetupId}", found ${matches.length}`);
        }
      ),
      { numRuns: 30 }
    );
  });
});
