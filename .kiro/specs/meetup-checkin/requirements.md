# Requirements — MeetupPass

## Feature 1: Event Management

### US-1.1 Create Event
**WHEN** an organizer submits the create-event form with a name, date, venue, and capacity,  
**THE SYSTEM SHALL** create a new event, assign it a unique ID, and redirect to the event detail page.

**Acceptance Criteria:**
- AC-1.1.1: Event ID is a UUID-like unique string.
- AC-1.1.2: All four fields (name, date, venue, capacity) are required; submitting with any missing field returns HTTP 400.
- AC-1.1.3: Capacity must be a positive integer ≥ 1.
- AC-1.1.4: The event appears in GET /api/events immediately after creation.

### US-1.2 List Events
**WHEN** a user navigates to the home page,  
**THE SYSTEM SHALL** display all events ordered by date descending.

**Acceptance Criteria:**
- AC-1.2.1: GET /api/events returns a JSON array.
- AC-1.2.2: Each event object includes id, name, date, venue, and capacity.

---

## Feature 2: RSVP & Pass Code

### US-2.1 Attendee RSVP
**WHEN** an attendee submits the RSVP form with their name and email for a specific event,  
**THE SYSTEM SHALL** create an attendee record, generate a unique 8-character alphanumeric pass code, and return it.

**Acceptance Criteria:**
- AC-2.1.1: Pass code is 8 characters, uppercase alphanumeric.
- AC-2.1.2: POST /api/rsvp returns HTTP 201 with `{ passCode, attendeeId }`.
- AC-2.1.3: Submitting the same email for the same event a second time returns HTTP 409 with `{ error: "Already registered" }`.
- AC-2.1.4: RSVP for a non-existent event returns HTTP 404.

### US-2.2 QR Code Display
**WHEN** the RSVP is successful,  
**THE SYSTEM SHALL** render the pass code as a QR code in the browser alongside the short alphanumeric code.

**Acceptance Criteria:**
- AC-2.2.1: QR code encodes the pass code string.
- AC-2.2.2: The short code is displayed in a large, readable font below the QR code.
- AC-2.2.3: A "Download Pass" button allows saving the QR code as a PNG.

---

## Feature 3: Check-In

### US-3.1 Valid Check-In
**WHEN** a check-in staff member enters or scans a valid pass code,  
**THE SYSTEM SHALL** mark the attendee as checked in and display their name and event.

**Acceptance Criteria:**
- AC-3.1.1: POST /api/checkin with a valid, unused pass code returns HTTP 200 with `{ success: true, attendee: { name, email } }`.
- AC-3.1.2: The attendee's `checkedIn` field is set to `true` and `checkedInAt` is set to the current ISO timestamp.

### US-3.2 Duplicate Check-In Prevention
**WHEN** a check-in staff member enters a pass code that has already been used,  
**THE SYSTEM SHALL** reject the check-in with a clear error message.

**Acceptance Criteria:**
- AC-3.2.1: POST /api/checkin for an already-checked-in attendee returns HTTP 409 with `{ error: "Already checked in", checkedInAt }`.
- AC-3.2.2: The UI displays the rejection in red with the original check-in time.

### US-3.3 Unknown Code Rejection
**WHEN** a check-in staff member enters an unrecognised pass code,  
**THE SYSTEM SHALL** reject the check-in with a "not found" message.

**Acceptance Criteria:**
- AC-3.3.1: POST /api/checkin with an unknown code returns HTTP 404 with `{ error: "Pass code not found" }`.

---

## Feature 4: Live Dashboard

### US-4.1 Attendance Statistics
**WHEN** an organizer views the dashboard for an event,  
**THE SYSTEM SHALL** display total RSVPs, total checked-in count, remaining capacity, and a progress bar.

**Acceptance Criteria:**
- AC-4.1.1: GET /api/dashboard/:eventId returns `{ event, totalRsvp, totalCheckedIn, remaining, recentCheckIns }`.
- AC-4.1.2: `recentCheckIns` contains the 10 most recent check-ins ordered by `checkedInAt` descending.
- AC-4.1.3: The dashboard auto-refreshes every 5 seconds without a full page reload.

---

## Feature 5: CSV Export

### US-5.1 Export Attendees
**WHEN** an organizer clicks "Export CSV" on the dashboard,  
**THE SYSTEM SHALL** download a CSV file with all attendee records for that event.

**Acceptance Criteria:**
- AC-5.1.1: GET /api/export/:eventId responds with `Content-Type: text/csv`.
- AC-5.1.2: The CSV includes headers: `name, email, passCode, rsvpAt, checkedIn, checkedInAt`.
- AC-5.1.3: All attendees for the event are included, whether checked in or not.
