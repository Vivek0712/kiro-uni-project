/**
 * routes.js — HTTP route dispatcher for MeetupPass
 * Handles both API routes (/api/*) and static file serving (./public/).
 */
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  getEvents, getEvent, createEvent,
  getAttendees, getAttendeeByPassCode, getAttendeeByEmail,
  createAttendee, checkInAttendee,
} from './db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = join(__dirname, '..', 'public');

// MIME types for static file serving
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.ico':  'image/x-icon',
  '.svg':  'image/svg+xml',
};

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Send a JSON response.
 */
function json(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

/**
 * Parse the JSON request body.
 * @returns {Promise<Object>}
 */
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => {
      if (!data) return resolve({});
      try { resolve(JSON.parse(data)); }
      catch { reject(new Error('Invalid JSON')); }
    });
    req.on('error', reject);
  });
}

/**
 * Serve a static file from ./public/.
 */
async function serveStatic(res, urlPath) {
  // Default to index.html for root
  const filePath = join(PUBLIC_DIR, urlPath === '/' ? 'index.html' : urlPath);
  if (!existsSync(filePath)) {
    json(res, 404, { error: 'Not found' });
    return;
  }
  const ext = extname(filePath);
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  try {
    const content = await readFile(filePath);
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  } catch {
    json(res, 500, { error: 'Internal server error' });
  }
}

// ── API Route Handlers ───────────────────────────────────────────────────────

/** GET /api/events */
async function handleGetEvents(req, res) {
  const events = await getEvents();
  json(res, 200, events);
}

/** POST /api/events */
async function handleCreateEvent(req, res) {
  const body = await parseBody(req);
  const { name, date, venue, capacity } = body;
  if (!name || !date || !venue || !capacity) {
    return json(res, 400, { error: 'name, date, venue, and capacity are required' });
  }
  if (isNaN(Number(capacity)) || Number(capacity) < 1) {
    return json(res, 400, { error: 'capacity must be a positive integer' });
  }
  const event = await createEvent({ name, date, venue, capacity });
  json(res, 201, event);
}

/** GET /api/events/:id */
async function handleGetEvent(req, res, id) {
  const event = await getEvent(id);
  if (!event) return json(res, 404, { error: 'Event not found' });
  json(res, 200, event);
}

/** POST /api/rsvp */
async function handleRsvp(req, res) {
  const body = await parseBody(req);
  const { eventId, name, email } = body;
  if (!eventId || !name || !email) {
    return json(res, 400, { error: 'eventId, name, and email are required' });
  }
  // Validate email format simply
  if (!email.includes('@')) {
    return json(res, 400, { error: 'Invalid email address' });
  }
  const event = await getEvent(eventId);
  if (!event) return json(res, 404, { error: 'Event not found' });

  const existing = await getAttendeeByEmail(email, eventId);
  if (existing) {
    return json(res, 409, { error: 'Already registered', passCode: existing.passCode, attendeeId: existing.id });
  }
  const attendee = await createAttendee({ eventId, name, email });
  json(res, 201, { passCode: attendee.passCode, attendeeId: attendee.id, name: attendee.name, eventName: event.name });
}

/** POST /api/checkin */
async function handleCheckin(req, res) {
  const body = await parseBody(req);
  const { passCode } = body;
  if (!passCode) return json(res, 400, { error: 'passCode is required' });

  const attendee = await getAttendeeByPassCode(passCode);
  if (!attendee) return json(res, 404, { error: 'Pass code not found' });

  if (attendee.checkedIn) {
    return json(res, 409, {
      error: 'Already checked in',
      checkedInAt: attendee.checkedInAt,
      attendee: { name: attendee.name, email: attendee.email },
    });
  }

  const updated = await checkInAttendee(passCode);
  const event = await getEvent(updated.eventId);
  json(res, 200, {
    success: true,
    attendee: { name: updated.name, email: updated.email, checkedInAt: updated.checkedInAt },
    eventName: event ? event.name : '',
  });
}

/** GET /api/dashboard/:eventId */
async function handleDashboard(req, res, eventId) {
  const event = await getEvent(eventId);
  if (!event) return json(res, 404, { error: 'Event not found' });

  const attendees = await getAttendees(eventId);
  const totalRsvp = attendees.length;
  const totalCheckedIn = attendees.filter(a => a.checkedIn).length;
  const remaining = Math.max(0, event.capacity - totalCheckedIn);

  const recentCheckIns = attendees
    .filter(a => a.checkedIn)
    .sort((a, b) => new Date(b.checkedInAt) - new Date(a.checkedInAt))
    .slice(0, 10)
    .map(a => ({ name: a.name, email: a.email, checkedInAt: a.checkedInAt }));

  json(res, 200, { event, totalRsvp, totalCheckedIn, remaining, recentCheckIns });
}

/** GET /api/attendees/:eventId */
async function handleGetAttendees(req, res, eventId) {
  const event = await getEvent(eventId);
  if (!event) return json(res, 404, { error: 'Event not found' });
  const attendees = await getAttendees(eventId);
  // Return public-safe fields
  const result = attendees.map(a => ({
    id: a.id,
    name: a.name,
    email: a.email,
    rsvpAt: a.rsvpAt,
    checkedIn: a.checkedIn,
    checkedInAt: a.checkedInAt,
  }));
  json(res, 200, result);
}

/** GET /api/export/:eventId */
async function handleExport(req, res, eventId) {
  const event = await getEvent(eventId);
  if (!event) return json(res, 404, { error: 'Event not found' });

  const attendees = await getAttendees(eventId);

  const headers = ['name', 'email', 'passCode', 'rsvpAt', 'checkedIn', 'checkedInAt'];
  const rows = attendees.map(a => [
    `"${(a.name || '').replace(/"/g, '""')}"`,
    `"${(a.email || '').replace(/"/g, '""')}"`,
    `"${a.passCode}"`,
    `"${a.rsvpAt}"`,
    a.checkedIn ? 'true' : 'false',
    `"${a.checkedInAt || ''}"`,
  ].join(','));

  const csv = [headers.join(','), ...rows].join('\n');
  const filename = `${event.name.replace(/[^a-z0-9]/gi, '_')}_attendees.csv`;

  res.writeHead(200, {
    'Content-Type': 'text/csv',
    'Content-Disposition': `attachment; filename="${filename}"`,
  });
  res.end(csv);
}

// ── Main Dispatcher ──────────────────────────────────────────────────────────

/**
 * Main request handler — routes requests to the right handler.
 * @param {import('node:http').IncomingMessage} req
 * @param {import('node:http').ServerResponse} res
 */
export async function handleRequest(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const path = url.pathname;
  const method = req.method.toUpperCase();

  // CORS headers for local development
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  try {
    // API routes
    if (path === '/api/events' && method === 'GET') return await handleGetEvents(req, res);
    if (path === '/api/events' && method === 'POST') return await handleCreateEvent(req, res);
    if (path.startsWith('/api/events/') && method === 'GET') {
      return await handleGetEvent(req, res, path.slice('/api/events/'.length));
    }
    if (path === '/api/rsvp' && method === 'POST') return await handleRsvp(req, res);
    if (path === '/api/checkin' && method === 'POST') return await handleCheckin(req, res);
    if (path.startsWith('/api/dashboard/') && method === 'GET') {
      return await handleDashboard(req, res, path.slice('/api/dashboard/'.length));
    }
    if (path.startsWith('/api/attendees/') && method === 'GET') {
      return await handleGetAttendees(req, res, path.slice('/api/attendees/'.length));
    }
    if (path.startsWith('/api/export/') && method === 'GET') {
      return await handleExport(req, res, path.slice('/api/export/'.length));
    }

    // Static files
    if (method === 'GET') return await serveStatic(res, path);

    json(res, 404, { error: 'Not found' });
  } catch (err) {
    console.error('[ERROR]', err.message);
    json(res, 500, { error: 'Internal server error' });
  }
}
