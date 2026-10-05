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

## Success Metrics
- RSVP → check-in flow completed in < 30 seconds per attendee.
- Dashboard refreshes within 5 seconds of a new check-in.
- Zero duplicate check-ins accepted.
