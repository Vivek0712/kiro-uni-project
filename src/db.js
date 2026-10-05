/**
 * db.js — JSON file persistence layer for MeetupPass
 * All reads/writes go through here. Files live in ./data/.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.MEETUPPASS_DATA_DIR || join(__dirname, '..', 'data');

// ── helpers ─────────────────────────────────────────────────────────────────

/**
 * Ensure the data directory exists.
 */
async function ensureDataDir() {
  if (!existsSync(DATA_DIR)) {
    await mkdir(DATA_DIR, { recursive: true });
  }
}

/**
 * Read a JSON file from the data directory.
 * Returns an empty array if the file does not exist.
 * @param {string} filename
 * @returns {Promise<Array>}
 */
async function readJSON(filename) {
  await ensureDataDir();
  const filePath = join(DATA_DIR, filename);
  try {
    const raw = await readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

/**
 * Write data to a JSON file in the data directory.
 * @param {string} filename
 * @param {Array|Object} data
 */
async function writeJSON(filename, data) {
  await ensureDataDir();
  const filePath = join(DATA_DIR, filename);
  await writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
}

/**
 * Generate a short unique ID with a prefix.
 * @param {string} prefix  e.g. "evt" → "evt_a3f9b2"
 * @returns {string}
 */
function generateId(prefix) {
  return `${prefix}_${randomBytes(6).toString('hex')}`;
}

/**
 * Generate an 8-character uppercase alphanumeric pass code.
 * @returns {string}
 */
export function generatePassCode() {
  return randomBytes(6).toString('base64url').toUpperCase().replace(/[^A-Z0-9]/g, '0').slice(0, 8);
}

// ── Events ───────────────────────────────────────────────────────────────────

const EVENTS_FILE = 'events.json';

/**
 * Return all events, sorted by date descending.
 * @returns {Promise<Event[]>}
 */
export async function getEvents() {
  const events = await readJSON(EVENTS_FILE);
  return events.sort((a, b) => new Date(b.date) - new Date(a.date));
}

/**
 * Find a single event by ID.
 * @param {string} id
 * @returns {Promise<Event|null>}
 */
export async function getEvent(id) {
  const events = await readJSON(EVENTS_FILE);
  return events.find(e => e.id === id) || null;
}

/**
 * Find a single event by platformMeetupId.
 * Used by the import endpoint to detect duplicates.
 * @param {string} platformMeetupId
 * @returns {Promise<Event|null>}
 */
export async function getEventByPlatformId(platformMeetupId) {
  const events = await readJSON(EVENTS_FILE);
  return events.find(e => e.platformMeetupId === platformMeetupId) || null;
}

/**
 * Create a new event.
 * Supports optional platform-linked fields: platformMeetupId, type, image, meetupUrl, attendeePoints.
 *
 * @param {{
 *   name: string,
 *   date: string,
 *   venue: string,
 *   capacity: number,
 *   platformMeetupId?: string,
 *   type?: string,
 *   image?: string,
 *   meetupUrl?: string,
 *   attendeePoints?: number
 * }} data
 * @returns {Promise<Event>}
 */
export async function createEvent(data) {
  const events = await readJSON(EVENTS_FILE);
  const event = {
    id: generateId('evt'),
    name: data.name,
    date: data.date,
    venue: data.venue,
    capacity: Number(data.capacity),
    createdAt: new Date().toISOString(),
    // Optional platform-linked fields (only set if provided)
    ...(data.platformMeetupId !== undefined && { platformMeetupId: data.platformMeetupId }),
    ...(data.type !== undefined && { type: data.type }),
    ...(data.image !== undefined && { image: data.image }),
    ...(data.meetupUrl !== undefined && { meetupUrl: data.meetupUrl }),
    // attendeePoints defaults to 10 if this is a platform-linked event, 0 otherwise
    attendeePoints: data.attendeePoints !== undefined
      ? Number(data.attendeePoints)
      : (data.platformMeetupId ? 10 : 0),
  };
  events.push(event);
  await writeJSON(EVENTS_FILE, events);
  return event;
}

// ── Attendees ────────────────────────────────────────────────────────────────

const ATTENDEES_FILE = 'attendees.json';

/**
 * Return all attendees, optionally filtered by eventId.
 * @param {string} [eventId]
 * @returns {Promise<Attendee[]>}
 */
export async function getAttendees(eventId) {
  const attendees = await readJSON(ATTENDEES_FILE);
  if (eventId) return attendees.filter(a => a.eventId === eventId);
  return attendees;
}

/**
 * Find an attendee by pass code.
 * @param {string} passCode
 * @returns {Promise<Attendee|null>}
 */
export async function getAttendeeByPassCode(passCode) {
  const attendees = await readJSON(ATTENDEES_FILE);
  return attendees.find(a => a.passCode === passCode.toUpperCase()) || null;
}

/**
 * Find an attendee by email + eventId (for duplicate RSVP check).
 * @param {string} email
 * @param {string} eventId
 * @returns {Promise<Attendee|null>}
 */
export async function getAttendeeByEmail(email, eventId) {
  const attendees = await readJSON(ATTENDEES_FILE);
  return attendees.find(a => a.email.toLowerCase() === email.toLowerCase() && a.eventId === eventId) || null;
}

/**
 * Create a new RSVP attendee record.
 * @param {{ eventId: string, name: string, email: string }} data
 * @returns {Promise<Attendee>}
 */
export async function createAttendee(data) {
  const attendees = await readJSON(ATTENDEES_FILE);
  const attendee = {
    id: generateId('att'),
    eventId: data.eventId,
    name: data.name,
    email: data.email,
    passCode: generatePassCode(),
    rsvpAt: new Date().toISOString(),
    checkedIn: false,
    checkedInAt: null,
    pointsAwarded: null,
  };
  attendees.push(attendee);
  await writeJSON(ATTENDEES_FILE, attendees);
  return attendee;
}

/**
 * Mark an attendee as checked in and record points awarded from the event.
 * Points are set from the event's attendeePoints field (default 0).
 *
 * @param {string} passCode
 * @returns {Promise<Attendee|null>}
 */
export async function checkInAttendee(passCode) {
  const attendees = await readJSON(ATTENDEES_FILE);
  const idx = attendees.findIndex(a => a.passCode === passCode.toUpperCase());
  if (idx === -1) return null;

  attendees[idx].checkedIn = true;
  attendees[idx].checkedInAt = new Date().toISOString();

  // Look up the event to get attendeePoints (read directly to avoid circular deps)
  const events = await readJSON(EVENTS_FILE);
  const event = events.find(e => e.id === attendees[idx].eventId);
  const pts = event && event.attendeePoints ? Number(event.attendeePoints) : 0;
  attendees[idx].pointsAwarded = pts > 0 ? pts : null;

  await writeJSON(ATTENDEES_FILE, attendees);
  return attendees[idx];
}

/**
 * Override the attendees file entirely (used by seed script).
 * @param {Attendee[]} attendees
 */
export async function setAttendees(attendees) {
  await writeJSON(ATTENDEES_FILE, attendees);
}

/**
 * Override the events file entirely (used by seed script).
 * @param {Event[]} events
 */
export async function setEvents(events) {
  await writeJSON(EVENTS_FILE, events);
}
