/**
 * seed.js — Populates ./data/ with a realistic demo event and ~20 attendees.
 * About one third of the attendees are pre-checked in.
 *
 * Usage:  node scripts/seed.js
 *         npm run seed
 */
import { createEvent, createAttendee, checkInAttendee, getAttendees, setEvents, setAttendees } from '../src/db.js';
import { randomBytes } from 'node:crypto';

// ── Demo data ────────────────────────────────────────────────────────────────

const EVENT = {
  name: 'AWS User Group Madurai – October Meetup 2026',
  date: '2026-10-15',
  venue: 'TIDEL Park, Tower-I, 4th Floor, Madurai',
  capacity: 60,
};

const ATTENDEES = [
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

  // Create the demo event
  const event = await createEvent(EVENT);
  console.log(`✅  Event created: "${event.name}"`);
  console.log(`    ID       : ${event.id}`);
  console.log(`    Date     : ${event.date}`);
  console.log(`    Venue    : ${event.venue}`);
  console.log(`    Capacity : ${event.capacity}\n`);

  // Create attendees
  const created = [];
  for (const a of ATTENDEES) {
    const attendee = await createAttendee({ eventId: event.id, ...a });
    created.push(attendee);
    process.stdout.write(`  + ${attendee.name.padEnd(22)} → ${attendee.passCode}\n`);
  }

  // Check in roughly the first third (~7 of 22)
  const checkInCount = Math.ceil(ATTENDEES.length / 3);
  console.log(`\n🎟  Checking in first ${checkInCount} attendees…\n`);
  for (let i = 0; i < checkInCount; i++) {
    const updated = await checkInAttendee(created[i].passCode);
    process.stdout.write(`  ✓ ${updated.name}\n`);
  }

  // Print summary
  const all = await getAttendees(event.id);
  const checkedIn = all.filter(a => a.checkedIn).length;

  console.log('\n─────────────────────────────────────────');
  console.log(`  Total RSVPs  : ${all.length}`);
  console.log(`  Checked in   : ${checkedIn}`);
  console.log(`  Not yet in   : ${all.length - checkedIn}`);
  console.log(`  Capacity     : ${event.capacity}`);
  console.log('─────────────────────────────────────────');
  console.log('\n🚀  Seed complete! Run `npm start` and open http://localhost:3000\n');
}

seed().catch(err => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
