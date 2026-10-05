/**
 * platform.js — Integration layer for the awsugmdu.in community platform API.
 *
 * This is the ONLY module that may call the platform API. All callers go
 * through here. PII sanitization is applied at this boundary — no caller
 * downstream ever sees emails, phone numbers, user IDs, or user arrays.
 *
 * Environment variable:
 *   AWSUGMDU_API_BASE  — overrides the default platform API base URL.
 *                        Used in tests to point at a local mock server.
 */

const DEFAULT_API_BASE = 'https://2q4zt5zl9e.execute-api.us-east-1.amazonaws.com/dev';
const TIMEOUT_MS = 10_000;

/**
 * The exact set of fields that may survive from a raw platform meetup object.
 * Any key not in this set is stripped. This is the privacy boundary.
 * @type {Set<string>}
 */
const ALLOWED_MEETUP_KEYS = new Set([
  'id',
  'title',
  'date',
  'time',
  'duration',
  'type',
  'status',
  'maxAttendees',
  'attendees',
  'image',
  'meetupUrl',
  'hostPoints',
  'speakerPoints',
  'volunteerPoints',
]);

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Pure allow-list sanitizer — returns a new object containing only the
 * fields in ALLOWED_MEETUP_KEYS. All other keys are stripped.
 *
 * This is a pure function: it produces the same output for the same input
 * and has no side effects. It is intentionally simple so property-based tests
 * can verify it exhaustively.
 *
 * @param {Object} meetup  Raw meetup object from the platform API (or any object).
 * @returns {Object}        Sanitized object with only the allowed keys.
 */
export function sanitizeMeetup(meetup) {
  if (!meetup || typeof meetup !== 'object' || Array.isArray(meetup)) {
    return {};
  }
  const result = {};
  for (const key of ALLOWED_MEETUP_KEYS) {
    if (Object.prototype.hasOwnProperty.call(meetup, key)) {
      result[key] = meetup[key];
    }
  }
  return result;
}

/**
 * Fetch the list of meetups from the awsugmdu.in platform API.
 * Applies sanitizeMeetup() to every item before returning.
 *
 * @returns {Promise<Object[]>}  Array of sanitized meetup objects.
 * @throws {Error}  "Platform API unavailable: <reason>" on any network failure.
 */
export async function fetchPlatformMeetups() {
  const base = process.env.AWSUGMDU_API_BASE || DEFAULT_API_BASE;
  const url = `${base}/meetups`;

  const data = await platformFetch(url);
  const meetups = data.meetups || data;
  if (!Array.isArray(meetups)) {
    throw new Error('Platform API unavailable: unexpected response shape (expected meetups array)');
  }
  return meetups.map(sanitizeMeetup);
}

/**
 * Fetch community statistics from the awsugmdu.in platform API.
 * Stats contain no PII so they are returned as-is.
 *
 * @returns {Promise<Object>}  Stats object: { memberCount, badgeCount, meetupCount, activeSprint, generatedAt }
 * @throws {Error}  "Platform API unavailable: <reason>" on any network failure.
 */
export async function fetchPlatformStats() {
  const base = process.env.AWSUGMDU_API_BASE || DEFAULT_API_BASE;
  const url = `${base}/stats`;
  return platformFetch(url);
}

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Fetch a URL with a 10-second timeout.
 * All platform HTTP calls funnel through here.
 *
 * @param {string} url
 * @returns {Promise<any>}  Parsed JSON response body.
 * @throws {Error}  "Platform API unavailable: <reason>" on timeout or network failure.
 */
async function platformFetch(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText}`);
    }
    return res.json();
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') {
      throw new Error('Platform API unavailable: request timed out after 10s');
    }
    throw new Error(`Platform API unavailable: ${err.message}`);
  }
}
