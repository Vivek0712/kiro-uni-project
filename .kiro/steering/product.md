# Product Steering — MeetupPass

## Vision
MeetupPass is a lightweight, zero-dependency event check-in web application built for AWS User Group Madurai meetups. It replaces spreadsheets and manual attendance tracking with a fast, browser-based workflow.

## Target Users
- **Organizers** – create events, monitor attendance live, export CSV reports.
- **Attendees** – RSVP online, receive a unique pass code shown as a QR code.
- **Check-in Staff** – scan or type pass codes at the door; see instant accept/reject feedback.

## Core Value Propositions
1. No app install required – runs entirely in the browser.
2. Real-time dashboard with capacity bar and recent check-in feed.
3. Duplicate check-in prevention with clear error messages.
4. One-click CSV export for post-event analytics.

## Non-Goals (v1)
- Payment processing or ticketing.
- Multi-organizer / role-based access control.
- Email/SMS notifications.
- Persistent cloud database (JSON file storage is intentional for simplicity).
- Writing data back to the awsugmdu.in platform (read-only integration).

## Privacy Rule — Platform Integration (MANDATORY)

The awsugmdu.in platform API responses contain PII: emails, phone-like data, and user IDs embedded in `hosts`, `speakers`, `volunteers`, `registeredUsers`, and `attendedUsers` fields.

**The system MUST:**
1. Pass every platform API response through `sanitizeMeetup()` in `src/platform.js` before any storage, logging, rendering, or API response.
2. Keep only these fields from platform meetup objects: `id`, `title`, `date`, `time`, `duration`, `type`, `status`, `maxAttendees`, `attendees` (count), `image`, `meetupUrl`, `hostPoints`, `speakerPoints`, `volunteerPoints`.
3. Never store, log, render, commit, or return: `email`, `userId`, `phone`, `registeredUsers`, `attendedUsers`, `hosts`, `speakers`, `volunteers`, or any unlisted field.
4. Apply this rule in both the HTTP API layer and the MCP server layer.

This rule exists to protect community members' personal information. Violations must be caught by the `privacy-guard` hook and the property-based sanitizer test.

## Success Metrics
- RSVP → check-in flow completed in < 30 seconds per attendee.
- Dashboard refreshes within 5 seconds of a new check-in.
- Zero duplicate check-ins accepted.
