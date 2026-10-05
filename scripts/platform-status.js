/**
 * platform-status.js — Prints platform stats and the next/most recent meetup.
 * Output is sanitized (no PII). Used as the agentSpawn hook for the event-ops agent.
 *
 * Usage:  node scripts/platform-status.js
 */
import { fetchPlatformStats, fetchPlatformMeetups } from '../src/platform.js';

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  awsugmdu.in Platform Status');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // Fetch stats and meetups in parallel
  let stats, meetups;
  try {
    [stats, meetups] = await Promise.all([
      fetchPlatformStats(),
      fetchPlatformMeetups(),
    ]);
  } catch (err) {
    console.error(`\n  ⚠  Platform API unavailable: ${err.message}`);
    console.error('     Set AWSUGMDU_API_BASE to override the base URL.');
    process.exit(1);
  }

  // Print community stats
  console.log(`\n  👥 Members  : ${stats.memberCount ?? '—'}`);
  console.log(`  🎯 Meetups  : ${stats.meetupCount ?? '—'}`);
  console.log(`  🏆 Badges   : ${stats.badgeCount ?? '—'}`);
  if (stats.activeSprint) {
    console.log(`  🏃 Sprint   : ${stats.activeSprint}`);
  }
  if (stats.generatedAt) {
    console.log(`  🕒 As of    : ${stats.generatedAt}`);
  }

  // Find next upcoming meetup (or fall back to most recent completed)
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = meetups
    .filter(m => m.status === 'upcoming' || m.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date));

  const completed = meetups
    .filter(m => m.status === 'completed' || m.date < today)
    .sort((a, b) => b.date.localeCompare(a.date));

  const featured = upcoming[0] || completed[0];

  if (featured) {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    const label = upcoming[0] ? '  📅 NEXT MEETUP' : '  📅 MOST RECENT MEETUP';
    console.log(label);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`  Title    : ${featured.title}`);
    console.log(`  Date     : ${featured.date}${featured.time ? ' @ ' + featured.time : ''}`);
    console.log(`  Type     : ${featured.type ?? '—'}`);
    console.log(`  Status   : ${featured.status ?? '—'}`);
    console.log(`  Capacity : ${featured.maxAttendees ?? '—'}${featured.attendees ? ' (' + featured.attendees + ' registered)' : ''}`);
    if (featured.meetupUrl) {
      console.log(`  URL      : ${featured.meetupUrl}`);
    }
    if (featured.hostPoints) {
      console.log(`  Points   : host ${featured.hostPoints} | speaker ${featured.speakerPoints} | volunteer ${featured.volunteerPoints}`);
    }
  } else {
    console.log('\n  No meetups found.');
  }

  console.log('\n  Total meetups fetched: ' + meetups.length);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
