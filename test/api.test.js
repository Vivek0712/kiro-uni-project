/**
 * api.test.js — API integration tests for MeetupPass.
 * Uses node:test + node:assert/strict (Node 20+ built-ins).
 * Spins up the real HTTP server on an ephemeral port; uses a temp
 * data dir (MEETUPPASS_DATA_DIR) so ./data demo data is never touched.
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { unlink, rm } from 'node:fs/promises';
import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Point db.js at a throwaway dir before it is loaded.
const DATA_DIR = mkdtempSync(join(tmpdir(), 'meetuppass-test-'));
process.env.MEETUPPASS_DATA_DIR = DATA_DIR;
const { handleRequest } = await import('../src/routes.js');

// ── Test server helpers ───────────────────────────────────────────────────────

let server;
let base;

/** Start a test HTTP server on a random free port. */
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

/** Stop the test server. */
async function stopServer() {
  return new Promise((resolve) => server.close(resolve));
}

/** Thin fetch wrapper — returns { status, body } */
async function req(method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${base}${path}`, opts);
  const text = await res.text();
  let parsed;
  try { parsed = JSON.parse(text); } catch { parsed = text; }
  return { status: res.status, body: parsed, headers: res.headers };
}

/** Delete test data files, ignoring missing files. */
async function cleanTestData() {
  const files = ['test-events.json', 'test-attendees.json', 'events.json', 'attendees.json'];
  for (const f of files) {
    const p = join(DATA_DIR, f);
    if (existsSync(p)) await unlink(p).catch(() => {});
  }
}

// ── Suite setup / teardown ────────────────────────────────────────────────────

before(async () => {
  await cleanTestData();
  await startServer();
});

after(async () => {
  await stopServer();
  await rm(DATA_DIR, { recursive: true, force: true });
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/events', () => {
  it('creates an event and returns 201 with an id', async () => {
    const { status, body } = await req('POST', '/api/events', {
      name: 'Test Event',
      date: '2026-11-01',
      venue: 'Test Venue',
      capacity: 50,
    });
    assert.equal(status, 201);
    assert.ok(body.id, 'response should have an id');
    assert.equal(body.name, 'Test Event');
    assert.equal(Number(body.capacity), 50);
  });

  it('returns 400 when a required field is missing', async () => {
    const { status, body } = await req('POST', '/api/events', {
      name: 'Incomplete Event',
      date: '2026-11-01',
      // venue missing
      capacity: 30,
    });
    assert.equal(status, 400);
    assert.ok(body.error, 'response should contain an error message');
  });
});

describe('GET /api/events', () => {
  it('returns an array', async () => {
    const { status, body } = await req('GET', '/api/events');
    assert.equal(status, 200);
    assert.ok(Array.isArray(body), 'body should be an array');
  });
});

// ── RSVP & Check-in suite — shares one event across subtests ─────────────────

describe('RSVP and Check-In flow', () => {
  let eventId;
  let passCode;

  before(async () => {
    const { body } = await req('POST', '/api/events', {
      name: 'Flow Test Event',
      date: '2026-12-01',
      venue: 'Flow Venue',
      capacity: 10,
    });
    eventId = body.id;
  });

  describe('POST /api/rsvp', () => {
    it('creates an attendee and returns 201 with a passCode', async () => {
      const { status, body } = await req('POST', '/api/rsvp', {
        eventId,
        name: 'Alice Test',
        email: 'alice@test.com',
      });
      assert.equal(status, 201);
      assert.ok(body.passCode, 'response should have a passCode');
      assert.equal(body.passCode.length, 8, 'passCode should be 8 characters');
      assert.ok(body.attendeeId, 'response should have an attendeeId');
      passCode = body.passCode;
    });

    it('returns 409 on duplicate email for same event', async () => {
      const { status, body } = await req('POST', '/api/rsvp', {
        eventId,
        name: 'Alice Duplicate',
        email: 'alice@test.com',
      });
      assert.equal(status, 409);
      assert.match(body.error, /already registered/i);
    });

    it('returns 404 for a non-existent eventId', async () => {
      const { status, body } = await req('POST', '/api/rsvp', {
        eventId: 'evt_nonexistent',
        name: 'Ghost',
        email: 'ghost@test.com',
      });
      assert.equal(status, 404);
      assert.ok(body.error);
    });

    it('returns 400 when required fields are missing', async () => {
      const { status } = await req('POST', '/api/rsvp', { eventId });
      assert.equal(status, 400);
    });
  });

  describe('POST /api/checkin', () => {
    it('checks in a valid attendee and returns 200 with checked_in=true', async () => {
      assert.ok(passCode, 'passCode should be set by prior RSVP test');
      const { status, body } = await req('POST', '/api/checkin', { passCode });
      assert.equal(status, 200);
      assert.equal(body.success, true);
      assert.ok(body.attendee.name);
      assert.ok(body.attendee.checkedInAt);
    });

    it('returns 409 when the same code is used again', async () => {
      const { status, body } = await req('POST', '/api/checkin', { passCode });
      assert.equal(status, 409);
      assert.match(body.error, /already checked in/i);
      assert.ok(body.checkedInAt, 'should include original checkedInAt');
    });

    it('returns 404 for an unknown pass code', async () => {
      const { status, body } = await req('POST', '/api/checkin', { passCode: 'XXXXXXXX' });
      assert.equal(status, 404);
      assert.match(body.error, /not found/i);
    });

    it('returns 400 when passCode field is absent', async () => {
      const { status } = await req('POST', '/api/checkin', {});
      assert.equal(status, 400);
    });
  });

  describe('GET /api/dashboard/:eventId', () => {
    it('returns a stats object with all required fields', async () => {
      const { status, body } = await req('GET', `/api/dashboard/${eventId}`);
      assert.equal(status, 200);
      assert.ok(typeof body.totalRsvp === 'number', 'totalRsvp should be a number');
      assert.ok(typeof body.totalCheckedIn === 'number', 'totalCheckedIn should be a number');
      assert.ok(typeof body.remaining === 'number', 'remaining should be a number');
      assert.ok(Array.isArray(body.recentCheckIns), 'recentCheckIns should be an array');
      assert.ok(body.event, 'body should include the event object');
    });

    it('reflects the check-in performed above (totalCheckedIn >= 1)', async () => {
      const { body } = await req('GET', `/api/dashboard/${eventId}`);
      assert.ok(body.totalCheckedIn >= 1, 'at least one attendee should be checked in');
    });

    it('returns 404 for an unknown eventId', async () => {
      const { status } = await req('GET', '/api/dashboard/evt_nope');
      assert.equal(status, 404);
    });
  });

  describe('GET /api/export/:eventId', () => {
    it('responds with Content-Type text/csv', async () => {
      const res = await fetch(`${base}/api/export/${eventId}`);
      assert.equal(res.status, 200);
      assert.match(res.headers.get('content-type') || '', /text\/csv/);
    });

    it('CSV includes the header row and at least one data row', async () => {
      const res = await fetch(`${base}/api/export/${eventId}`);
      const text = await res.text();
      const lines = text.trim().split('\n');
      assert.ok(lines[0].includes('name'), 'first line should be a header with "name"');
      assert.ok(lines[0].includes('passCode'), 'header should include "passCode"');
      assert.ok(lines.length >= 2, 'CSV should have at least one data row');
    });
  });
});
