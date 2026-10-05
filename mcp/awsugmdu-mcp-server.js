/**
 * awsugmdu-mcp-server.js — Zero-dependency stdio MCP server for awsugmdu.in
 *
 * Protocol: JSON-RPC 2.0, newline-delimited, over process.stdin / process.stdout
 * Diagnostics: process.stderr only (never stdout — that would corrupt the JSON-RPC stream)
 *
 * Tools exposed (all PII-sanitized via src/platform.js):
 *   list_platform_meetups  — list meetups with optional status/type filters
 *   get_platform_meetup    — get single meetup by id
 *   get_platform_stats     — community statistics
 *
 * Usage:
 *   node mcp/awsugmdu-mcp-server.js
 *   AWSUGMDU_API_BASE=http://localhost:9999 node mcp/awsugmdu-mcp-server.js
 */

import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Resolve src/ relative to this file (mcp/awsugmdu-mcp-server.js → ../src/platform.js)
const __dirname = dirname(fileURLToPath(import.meta.url));
const { fetchPlatformMeetups, fetchPlatformStats } = await import(
  join(__dirname, '..', 'src', 'platform.js')
);

const SERVER_NAME    = 'awsugmdu';
const SERVER_VERSION = '1.0.0';

// ── Tool definitions ─────────────────────────────────────────────────────────

const TOOLS = [
  {
    name: 'list_platform_meetups',
    description:
      'List meetups from the awsugmdu.in community platform. ' +
      'Accepts optional filters: status (e.g. "completed", "upcoming") and type. ' +
      'Returns sanitized meetup objects — no PII (emails, user IDs, etc.).',
    inputSchema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          description: 'Filter by meetup status, e.g. "completed" or "upcoming".',
        },
        type: {
          type: 'string',
          description: 'Filter by meetup type, e.g. "circles".',
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'get_platform_meetup',
    description:
      'Get a single meetup from the awsugmdu.in platform by its ID. ' +
      'Returns sanitized meetup object — no PII.',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'The platform meetup ID.',
        },
      },
      required: ['id'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_platform_stats',
    description:
      'Get community statistics from awsugmdu.in: member count, badge count, ' +
      'meetup count, active sprint, and generation timestamp.',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
  },
];

// ── JSON-RPC helpers ──────────────────────────────────────────────────────────

function makeResult(id, result) {
  return JSON.stringify({ jsonrpc: '2.0', id, result });
}

function makeError(id, code, message) {
  return JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } });
}

function send(line) {
  process.stdout.write(line + '\n');
}

function log(...args) {
  process.stderr.write('[awsugmdu-mcp] ' + args.join(' ') + '\n');
}

// ── Request handlers ──────────────────────────────────────────────────────────

async function handleInitialize(id, params) {
  send(makeResult(id, {
    protocolVersion: '2024-11-05',
    capabilities: { tools: {} },
    serverInfo: { name: SERVER_NAME, version: SERVER_VERSION },
  }));
}

function handleToolsList(id) {
  send(makeResult(id, { tools: TOOLS }));
}

async function handleToolsCall(id, params) {
  const { name, arguments: args = {} } = params;

  try {
    switch (name) {
      case 'list_platform_meetups': {
        let meetups = await fetchPlatformMeetups();
        if (args.status) {
          meetups = meetups.filter(m => m.status === args.status);
        }
        if (args.type) {
          meetups = meetups.filter(m => m.type === args.type);
        }
        send(makeResult(id, {
          content: [{ type: 'text', text: JSON.stringify(meetups, null, 2) }],
        }));
        break;
      }

      case 'get_platform_meetup': {
        if (!args.id) {
          send(makeError(id, -32602, 'id is required'));
          return;
        }
        const meetups = await fetchPlatformMeetups();
        const meetup = meetups.find(m => m.id === args.id);
        if (!meetup) {
          send(makeResult(id, {
            content: [{ type: 'text', text: `No meetup found with id "${args.id}"` }],
            isError: true,
          }));
          return;
        }
        send(makeResult(id, {
          content: [{ type: 'text', text: JSON.stringify(meetup, null, 2) }],
        }));
        break;
      }

      case 'get_platform_stats': {
        const stats = await fetchPlatformStats();
        send(makeResult(id, {
          content: [{ type: 'text', text: JSON.stringify(stats, null, 2) }],
        }));
        break;
      }

      default:
        send(makeError(id, -32601, `Unknown tool: ${name}`));
    }
  } catch (err) {
    log('Tool error:', err.message);
    send(makeResult(id, {
      content: [{ type: 'text', text: `Error: ${err.message}` }],
      isError: true,
    }));
  }
}

// ── Main message loop ─────────────────────────────────────────────────────────

log(`Starting ${SERVER_NAME} MCP server v${SERVER_VERSION}`);

const rl = createInterface({ input: process.stdin, terminal: false });

rl.on('line', async (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;

  let msg;
  try {
    msg = JSON.parse(trimmed);
  } catch {
    log('Failed to parse JSON:', trimmed.slice(0, 120));
    return;
  }

  const { id, method, params = {} } = msg;

  // Notifications have no id — ignore gracefully
  if (id === undefined || id === null) {
    log('Ignoring notification:', method);
    return;
  }

  log('Request:', method, 'id=', id);

  try {
    if (method === 'initialize')  { await handleInitialize(id, params); return; }
    if (method === 'tools/list')  { handleToolsList(id); return; }
    if (method === 'tools/call')  { await handleToolsCall(id, params); return; }

    // Unknown method
    send(makeError(id, -32601, `Method not found: ${method}`));
  } catch (err) {
    log('Unhandled error:', err.message);
    send(makeError(id, -32603, 'Internal error'));
  }
});

rl.on('close', () => {
  log('stdin closed, exiting');
  process.exit(0);
});
