# Phoenix edition Phase 3: scheduler verification

2026-10-09. Apache 2.0; LICENSE/NOTICE unchanged. No push or PR, and no live
app/data access. Existing uncommitted Phase 2 changes were preserved.

Verdicts below mean **satisfied by code inspection**, not server acceptance.
The required isolated fixture could not start. No concrete implementation gap
against this brief was found, so no scheduler or application code was changed.

| Requirement | Verdict | Evidence (current worktree file:line) | Fix |
| --- | --- | --- | --- |
| Wake assigned bot with cron/interval prompt | Satisfied by inspection | `server/routines.ts:1431` starts an immediate tick plus a 10-second timer; `:1470` selects enabled due jobs and advances occurrences; `:1590` creates the execution task; `:1609` persists before dispatch; `:1632` passes bot ID, execution prompt and trigger to startTurn. `server/index.ts:11385` forwards to the ordinary headless dispatcher. `shared/routine-schedule.ts:36` uses paused Croner as a calendar calculator. | None |
| Persist and re-arm after restart | Satisfied by inspection | `server/routines.ts:799` reloads definitions/cursors and receipts from routines.json; `:879` fails interrupted running/waiting receipts without replaying them; `:1952` atomically saves definitions and run history with mode 0600. `server/index.ts:25654` starts the manager on boot. Queued work drains through `server/routines.ts:1530`. Existing restart fixture: `server/routines-startup.test.ts:11`; cron reload/pause tests: `server/routines.test.ts:281`, `:413`. | None |
| Approval policy for unsupervised work | Satisfied by inspection | Execution tasks inherit the bot's policy and allow rules (`server/store.ts:2827`, `:2842`); task projection respects thread-only grants (`server/store.ts:2663`). Dispatch computes supported approval mode, falling back to Ask (`server/index.ts:4045`, `:10820`). Custom LLM tool calls use Full Access or the explicit approval gate (`server/drivers/openai-chat.ts:742`); unanswered approval expiry is handled by `server/drivers/chat-tool-approval.ts`. Routine approval events become visible waiting receipts (`server/routines.ts:1671`). Proposals themselves require confirmation unless an existing grant permits automatic application (`server/routine-requests.ts:1242`). | None |
| Per-job logs, enable/disable, visible failures | Satisfied by inspection | Definition updates preserve/modify enabled and cancel queued work on pause (`server/routines.ts:1095`, `:1132`). Receipts carry routineId, status, output/error; runtime events settle them (`:1650`) and persistence retains active receipts while pruning terminal history (`:1952`). GET/PATCH routes expose logs and edits (`server/index.ts:19273`, `:19315`); failures notify (`:11409`). Scoped log links and error display already exist (`src/components/routines/RoutineList.tsx:39`, `src/components/routines/RoutineLogs.tsx:23`, `:39`). | None |
| Custom LLM bot support | Satisfied by inspection; combined runtime acceptance pending | Custom connections register the openai-compat driver (`server/routes/custom-llms.ts:79`). Routine execution defaults to maus and uses the same dispatcher (`server/routines.ts:1632`, `server/index.ts:11385`), which selects the projected bot's registry instance (`server/index.ts:9689`). Fresh tasks follow bot model selection (`server/store.ts:2841`, `:2671`); the selected adapter receives the turn (`server/index.ts:10813`). No built-in-only scheduler filter was found. | None |

## Scope and behavior

Scheduling has up to one tick's ordinary latency, not hard real-time delivery.
Busy targets defer work. Default overlap skips occurrences; queue mode retains
one scheduled run. Offline occurrences over 12 hours late become visible missed
receipts (`server/routines.ts:1491`). Interrupted runs fail on restart rather
than repeating possible side effects. These are existing policies, not gaps
against the brief. Approval policy comes from the assigned bot/task; this brief
does not require a separate per-job permission configuration. An Ask run can
wait for a person; Full Access is an explicit standing grant.

## Executed validation

- Read `docs/verification/README.md` and the routines recipe. Attempted
  `node --experimental-strip-types scripts/control-omb.ts launch`: failed
  before startup with missing `croner`. No server URL, transcript, or workflow
  result was produced; no live endpoint was used.
- `TMPDIR=/tmp node --test --test-isolation=none electron/routine-wake.node-test.mjs`:
  **3 passed**, including toggle persistence in a disposable directory. The
  first attempt used the inherited read-only temp directory and failed with
  EROFS; rerunning with the writable `/tmp` fixed the environment issue.
- `node --experimental-strip-types --test --test-isolation=none server/phoenix-memory-policy.node-test.mjs`:
  **2 passed**. These existing Phase 2 checks exercise approval allow/deny and
  classification only; they do not establish scheduled-run acceptance.
- Attempted `pnpm exec vitest run server/routines.test.ts server/routines-startup.test.ts server/routine-cron.e2e.test.ts server/routine-results.e2e.test.ts server/routine-requests.test.ts server/custom-llm.e2e.test.ts shared/routine-schedule.test.ts`:
  blocked because pnpm is unavailable on PATH; no Vitest tests executed.
- `pnpm exec tsc -b`, `pnpm exec tsc -p tsconfig.server.json`, and
  `pnpm exec oxlint --deny-warnings .` were blocked by missing pnpm. Invoking
  the available TypeScript compiler directly at
  `/opt/hatch/skills/spaces/ts-runtime/dist/space-ts-deps/node_modules/typescript/lib/tsc.js`
  with `-b` and `-p tsconfig.server.json` also failed: missing Node and
  Vite type definitions. No strict typing or lint pass is claimed.
- No TS/JS files were touched in Phase 3, so touched-code syntax checking is
  inapplicable. `git diff --check` passed after writing this report.

After restoring locked dependencies, run the targeted Vitest command above,
the typecheck and deny-warnings lint, and the official isolated routines
recipe. Existing Custom LLM chat tests and scheduler fixtures are separate;
they do not yet provide executed evidence of a scheduled Custom LLM turn.
Renderer behavior and real-provider execution remain unverified here.

Phase 3 files changed: `docs/phoenix-phase3-report.md` only.
