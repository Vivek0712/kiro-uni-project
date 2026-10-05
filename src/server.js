/**
 * server.js — Entry point for the MeetupPass HTTP server.
 * Starts a plain node:http server and delegates to routes.js.
 */
import { createServer } from 'node:http';
import { handleRequest } from './routes.js';

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

const server = createServer(async (req, res) => {
  await handleRequest(req, res);
});

server.listen(PORT, HOST, () => {
  console.log(`🎟  MeetupPass running at http://localhost:${PORT}`);
  console.log(`   Home      → http://localhost:${PORT}/`);
  console.log(`   Check-In  → http://localhost:${PORT}/checkin.html`);
  console.log(`   Dashboard → http://localhost:${PORT}/dashboard.html`);
});

server.on('error', (err) => {
  console.error('Server error:', err.message);
  process.exit(1);
});

// Export for testing (allows test to import and get the server instance)
export { server, PORT };
