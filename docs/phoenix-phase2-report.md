# Phoenix edition Phase 2 report

This is an Apache 2.0 extension of OpenMausBot. LICENSE and NOTICE are unchanged.
Nothing was pushed, no PR was created, and no live home or bot data was accessed.

## Survey

- `server/thread-events.ts` reads bounded per-thread normalized events and native
  protocol logs for the inspector. It is transcript/event inspection, rather
  than a curated memory store.
- `server/workspace.ts` already implements per-bot, cross-thread `MEMORY.md`,
  dated append/replace/remove/supersede operations, expiration, budgets, archives,
  atomic private writes, secret scrubbing, topic files, daily logs and search.
  Its previous location was `workspaces/<botId>/`, not the requested bot folder.
- `server/skill-learn.ts` turns learn requests into skill-authoring instructions
  and reuses `skills_list` / `skill_manage` with their existing review lifecycle.
  Skills are reusable procedures; durable memory is curated facts.
- `docs/memory.md` already documents cross-thread memory, the full bot-settings
  editor, optimistic conflict protection, undo journal, recall and model upkeep.
  The brief's original claim that durable memory was wholly missing was stale.
- `server/index.ts` assembles Memory context sections for previews and direct
  turns and calls the same `memorySystemPrompt` for rooms. This common seam feeds
  engine-independent context; Phase 1's Custom LLM uses that same turn context.
- Built-in `memory_update` already exists in the agents catalog and is not a
  reviewed read. Existing Claude/Codex engine permissions and Custom LLM tool
  approval gate govern writes; Full Access is an explicit standing grant.
  Custom LLM MCP execution previously asked for all ordinary tool calls, even
  reads, so a narrowly trusted free `memory_read` needed an explicit exception.

## Built

- Durable memory lives at `DATA_DIR/bots/<botId>/MEMORY.md` (normally
  `~/.openmausbot/bots/<botId>/MEMORY.md`), alongside `memory/` and the existing
  SOUL mirror. Working files and skills remain on the existing bot desk.
- Reads fall back to legacy memory without creating folders. A managed write
  or workspace launch moves legacy memory when the canonical destination is
  absent, preserving working files and SOUL. Existing canonical files win;
  conflicting legacy files remain on disk. Migration refuses linked folders
  and linked source documents. Bot deletion already removes the bot folder;
  team backups already use the common memory writers. Recall, upkeep, search,
  Cloud lending review and folder opening now use the memory-directory seam.
- Added public curated POST updates to the existing bot-memory route, including
  dated append, exact unique corrections, optional hash conflicts, secret
  scrubbing and journal entries for both index and archive changes. Existing
  GET and conflict-aware whole-file PUT remain available behind settings auth.
- Added own-bot `memory_read` using the active internal capability. Kept
  `memory_update` as the separate approval-gated write. Both are hidden when
  memory is disabled. Custom LLM read exemption checks actual built-in server
  provenance; a custom server named agents or read-only annotations cannot
  waive approval. Updated the tool-catalog golden fixtures.
- Common prompt injection clearly delimits `<long-term-memory>` and reinforces
  durable facts, dates, corrections, no transcripts and no credentials.
- Reused Bot Settings → Memory for viewing/editing, conflict detection and undo.
  It receives the canonical folder from the existing overview API; no second
  editor was introduced. No renderer behavior was verified in this environment.
- Added API fixture tests and extended migration, assembled direct/room context,
  proxy, approval classification and Custom LLM MCP provenance tests. Updated
  existing filesystem expectations for the new memory location.

## Validation

Passed:

- `node --experimental-strip-types --test --test-isolation=none server/phoenix-memory-policy.node-test.mjs`
  — 2 tests: reviewed memory read/write classification and real approval gate
  allow/deny behavior. These modules do not access bot data.
- TypeScript `transpileModule` syntax check on all 26 changed/new TypeScript and
  JavaScript files — zero syntax diagnostics. This is not a strict typecheck.
- `git diff --check` — clean.

Blocked by the incomplete local dependency installation:

- Required `node --experimental-strip-types scripts/control-omb.ts launch`
  failed before starting the isolated server: missing `croner`. No server
  workflow or conversation outcome is claimed verified.
- Vitest failed at startup: missing `vite`. API, context, migration, proxy,
  UI and MCP provenance tests are committed but were not executed.
- `tsc -b` failed on missing `node` and `vite/client` type definitions;
  `tsc -p tsconfig.server.json` failed on missing Node definitions.
- `oxlint --deny-warnings` could not start: the local oxlint executable/package
  is absent. Lint cleanliness and full strict typing remain unverified.

After dependencies are restored, run the required typecheck/lint and targeted
Vitest files, including `server/phoenix-memory-api.e2e.test.ts`,
`server/memory-room-prompt.e2e.test.ts`, `server/memory-routes.test.ts`,
`server/workspace.test.ts`, `server/workspace-links.test.ts`,
`server/memory-store.test.ts`, `server/memory-journal.test.ts`,
`server/memory-upkeep.test.ts`, `server/memory-entries.test.ts`,
`server/recall.test.ts`, `server/team-backup.test.ts`,
`server/cloud-lending-memory.e2e.test.ts`, `server/openai-tools.e2e.test.ts`,
`server/drivers/agents-proxy.test.ts`, `server/drivers/chat-mcp-tools.test.ts`,
`server/agent-tool-policy.test.ts` and the catalog golden tests. All server
verification must retain the official disposable fixture and explicit URL.

## Phase 3 findings

`shared/package-format.ts` validates package routine definitions, including
cron schedules. Actual execution exists independently in `server/routines.ts`:
`RoutineManager` reloads persisted definitions and runs, calculates occurrences
through `shared/routine-schedule.ts` / Croner, ticks every 10 seconds, persists
receipts before dispatch, and invokes `startTurn` or `startGoal`. Startup wiring
in `server/index.ts` constructs and starts it. Restart recovery settles stale
running jobs and recomputes occurrences; overlap, offline catch-up, restrictions,
timeouts, manual and webhook triggers are implemented. `routine-requests.ts`
handles confirmed changes and run approvals. The frontend already has routines
List/Calendar surfaces; Electron also has routine wake handling. Existing cron,
startup, continuity, delegation and UI fixture tests document these behaviors.

There is no evidence that Phase 3 needs a new scheduler. Its proposed core
requirements are already represented. Phase 3 should verify the existing
scheduler against Phoenix's desired workflow and identify any concrete product
or policy difference before changing code. Routine execution was surveyed,
not newly verified or modified during Phase 2.

## Files touched

- `docs/memory.md`
- `server/agent-tool-policy.test.ts`
- `server/agent-tool-policy.ts`
- `server/cloud-lending-memory.e2e.test.ts`
- `server/drivers/agents-call.ts`
- `server/drivers/agents-catalog-goldens/direct-full.tools-list.json`
- `server/drivers/agents-catalog-goldens/room-full.tools-list.json`
- `server/drivers/agents-catalog.ts`
- `server/drivers/agents-proxy.test.ts`
- `server/drivers/chat-mcp-tools.test.ts`
- `server/drivers/chat-mcp-tools.ts`
- `server/index.ts`
- `server/memory-entries.test.ts`
- `server/memory-journal.test.ts`
- `server/memory-room-prompt.e2e.test.ts`
- `server/memory-routes.test.ts`
- `server/memory-store.test.ts`
- `server/memory-store.ts`
- `server/memory-upkeep.test.ts`
- `server/memory-upkeep.ts`
- `server/openai-tools.e2e.test.ts`
- `server/recall.ts`
- `server/routes/bot-memory.ts`
- `server/team-backup.test.ts`
- `server/workspace-links.test.ts`
- `server/workspace.test.ts`
- `server/workspace.ts`
- `docs/phoenix-phase2-report.md`
- `server/phoenix-memory-api.e2e.test.ts`
- `server/phoenix-memory-policy.node-test.mjs`
