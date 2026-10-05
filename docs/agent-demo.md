# Event-Ops Agent — Live Demo

The `event-ops` custom agent queries the awsugmdu.in community platform through the
project's own MCP server (`mcp/awsugmdu-mcp-server.js`). All platform data is
PII-sanitized at the `src/platform.js` boundary before the agent ever sees it — no
emails, user IDs, or user arrays appear below.

## Command

```bash
kiro-cli chat --agent event-ops --no-interactive \
  --trust-tools=fs_read,@awsugmdu \
  "Using the awsugmdu MCP tools, list the 3 most recent platform meetups and the platform member count."
```

## Real output

The agent called `@awsugmdu/get_platform_stats` and `@awsugmdu/list_platform_meetups`,
then answered:

> Platform member count: 748 (total community: 29 meetups, 5 badges).
>
> 3 most recent meetups (by date):
>
> - Build Full Stack Application on AWS Blocks — 2026-08-02 · circles · completed (29/100)
> - Build Your Portfolio — 2026-07-30 · circles · completed (13/50)
> - Live Resume Review and Q&A — 2026-07-28 · circles · completed (11/50)

Each meetup line shows `title — date · type · status (attendees/maxAttendees)` — exactly
the fields on the sanitizer allow-list. No PII fields are present.
