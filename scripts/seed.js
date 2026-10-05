/**
 * seed.js — Populates ./data/ with realistic demo data.
 *
 * Creates:
 *  1. A standard MeetupPass event (no platform link)
 *  2. A platform-linked event (fake platformMeetupId, example.com emails)
 *     with attendeePoints=10 — ~1/3 attendees checked in with points
 *
 * Usage:  node scripts/seed.js
 *         npm run seed
 */
import { createEvent, createAttendee, checkInAttendee, getAttendees, setEvents, setAttendees } from '../src/db.js';

// ── Demo data ────────────────────────────────────────────────────────────────

const STANDARD_EVENT = {
  name: 'AWS User Group Madurai – October Meetup 2026',
  date: '2026-10-15',
  venue: 'TIDEL Park, Tower-I, 4th Floor, Madurai',
  capacity: 60,
  attendeePoints: 0,
};

/** Fake platform-linked meetup (using example.com emails; no real PII) */
const PLATFORM_EVENT = {
  name: 'AWS UG Madurai – Circles: Serverless Deep Dive',
  date: '2026-11-20',
  venue: 'AWS User Group Madurai Hub',
  capacity: 50,
  platformMeetupId: 'demo-platform-meetup-001',
  type: 'circles',
  image: 'https://www.awsugmdu.in/images/meetup-poster-demo.jpg',
  meetupUrl: 'https://www.awsugmdu.in/meetups/demo-platform-meetup-001',
  attendeePoints: 10,
};

const STANDARD_ATTENDEES = [
  { name: 'Arun Kumar',       email: 'arun.kumar@example.com'       },
  { name: 'Priya Rajan',      email: 'priya.rajan@example.com'      },
  { name: 'Karthik Selvam',   email: 'karthik.selvam@example.com'   },
  { name: 'Deepa Nair',       email: 'deepa.nair@example.com'       },
  { name: 'Suresh Pandian',   email: 'suresh.pandian@example.com'   },
  { name: 'Meena Lakshmi',    email: 'meena.lakshmi@example.com'    },
  { name: 'Vijay Anand',      email: 'vijay.anand@example.com'      },
  { name: 'Kavitha Moorthy',  email: 'kavitha.moorthy@example.com'  },
  { name: 'Ramesh Babu',      email: 'ramesh.babu@example.com'      },
  { name: 'Shalini Devi',     email: 'shalini.devi@example.com'     },
  { name: 'Murugan Raj',      email: 'murugan.raj@example.com'      },
];

const PLATFORM_ATTENDEES = [
  { name: 'Anitha Krishnan',  email: 'anitha.krishnan@example.com'  },
  { name: 'Bala Subramanian', email: 'bala.subramanian@example.com' },
  { name: 'Geetha Venkat',    email: 'geetha.venkat@example.com'    },
  { name: 'Senthil Kumar',    email: 'senthil.kumar@example.com'    },
  { name: 'Lavanya Sivam',    email: 'lavanya.sivam@example.com'    },
  { name: 'Dinesh Prabhu',    email: 'dinesh.prabhu@example.com'    },
  { name: 'Rani Sundaram',    email: 'rani.sundaram@example.com'    },
  { name: 'Manoj Pillai',     email: 'manoj.pillai@example.com'     },
  { name: 'Saranya Gopal',    email: 'saranya.gopal@example.com'    },
  { name: 'Ezhil Arasu',      email: 'ezhil.arasu@example.com'      },
  { name: 'Nithya Shankar',   email: 'nithya.shankar@example.com'   },
];

// ── Seed logic ───────────────────────────────────────────────────────────────

async function seed() {
  console.log('🌱  Seeding MeetupPass demo data…\n');

  // Wipe existing data so seed is idempotent
  await setEvents([]);
  await setAttendees([]);

  // ── Event 1: Standard event (no platform link) ───────────────────────────
  const event1 = await createEvent(STANDARD_EVENT);
  console.log(`✅  Event 1 created: "${event1.name}"`);
  console.log(`    ID       : ${event1.id}`);
  console.log(`    Date     : ${event1.date}`);
  console.log(`    Venue    : ${event1.venue}\n`);

  const created1 = [];
  for (const a of STANDARD_ATTENDEES) {
    const attendee = await createAttendee({ eventId: event1.id, ...a });
    created1.push(attendee);
    process.stdout.write(`  + ${attendee.name.padEnd(22)} → ${attendee.passCode}\n`);
  }
  const checkIn1 = Math.ceil(STANDARD_ATTENDEES.length / 3);
  console.log(`\n🎟  Checking in first ${checkIn1} attendees for Event 1…`);
  for (let i = 0; i < checkIn1; i++) {
    await checkInAttendee(created1[i].passCode);
    process.stdout.write(`  ✓ ${created1[i].name}\n`);
  }

  // ── Event 2: Platform-linked event with points ───────────────────────────
  console.log('');
  const event2 = await createEvent(PLATFORM_EVENT);
  console.log(`✅  Event 2 created (platform-linked): "${event2.name}"`);
  console.log(`    ID              : ${event2.id}`);
  console.log(`    platformMeetupId: ${event2.platformMeetupId}`);
  console.log(`    attendeePoints  : ${event2.attendeePoints}\n`);

  const created2 = [];
  for (const a of PLATFORM_ATTENDEES) {
    const attendee = await createAttendee({ eventId: event2.id, ...a });
    created2.push(attendee);
    process.stdout.write(`  + ${attendee.name.padEnd(22)} → ${attendee.passCode}\n`);
  }
  const checkIn2 = Math.ceil(PLATFORM_ATTENDEES.length / 3);
  console.log(`\n🎟  Checking in first ${checkIn2} attendees for Event 2 (+${event2.attendeePoints} pts each)…`);
  for (let i = 0; i < checkIn2; i++) {
    const updated = await checkInAttendee(created2[i].passCode);
    process.stdout.write(`  ✓ ${updated.name} (+${updated.pointsAwarded ?? 0} pts)\n`);
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  const all1 = await getAttendees(event1.id);
  const all2 = await getAttendees(event2.id);
  const pts = all2.filter(a => a.checkedIn).reduce((s, a) => s + (a.pointsAwarded || 0), 0);

  console.log('\n─────────────────────────────────────────────────────');
  console.log(`  Event 1 (standard)         : ${all1.filter(a => a.checkedIn).length}/${all1.length} checked in`);
  console.log(`  Event 2 (platform-linked)  : ${all2.filter(a => a.checkedIn).length}/${all2.length} checked in, ${pts} pts awarded`);
  console.log('─────────────────────────────────────────────────────');
  console.log('\n🚀  Seed complete! Run `npm start` and open http://localhost:3000\n');
  console.log('   Platform import page → http://localhost:3000/platform.html\n');
}

seed().catch(err => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
