# Custom LLM — isolated fixture

Status: implemented recipe, full server/renderer verification pending. Do not
interpret this document as an acceptance record.

Follow [the verification guide](README.md). This recipe uses its
`launchVerificationServer` and `runControlOmb` helpers, a disposable data
folder/home and a loopback OpenAI-compatible stub. It never calls Ollama,
Antigravity, a paid provider or the user's running harness.

After installing the locked workspace dependencies:

```sh
node --experimental-strip-types server/routes/custom-llms.node-test.mjs
pnpm exec vitest run server/drivers/openai-compat.test.ts server/drivers/openai-chat.test.ts server/custom-llm.e2e.test.ts
pnpm exec tsc -b
pnpm exec tsc -p tsconfig.server.json
pnpm exec oxlint --deny-warnings .
```

The route contract checks validate URL/env/model inputs, write-only secrets,
secret retention on same-endpoint edits and removal on endpoint changes,
provider locks, busy-instance refusal, hosted refusal, and bounded probe errors.
They mock HTTP transport and do not prove the chat/server workflow.

The server fixture adds a keyless Custom LLM through the real HTTP API, tests
chat completions, refreshes and filters `/models`, switches an existing fixture
conversation from the fake engine to it, sends a message and records `wait` and `messages` through the shared
control surface. It checks that keyless requests omit Authorization, that
saved keys never appear in settings responses, and that editing the host
clears a saved key. It prints the retained evidence and server log paths and
stops only the server and stub it owns.

Renderer acceptance remains a separate check: in an isolated app, open
Settings → Engines → Add / edit Custom LLM, choose each preset, save a
fixture connection and test it, then select that engine in an existing bot's
model picker between turns. Confirm the draft survives unrelated engine
refreshes and saved credentials are never repopulated in the password input.
This has not been verified by the UI-less server fixture.

## Workspace attempt (2026-10-09)

- Four isolated route contract checks passed with Node's test runner.
- TypeScript syntax transpilation of the changed TS/TSX files passed. This
  is not a semantic typecheck.
- `git diff --check` passed.
- Offline pnpm installation could reuse cached packages but stopped at a
  missing `@clack/prompts@1.7.0` tarball. Registry access returned `EPERM`.
- Fixture launch stopped before server startup: missing `croner`.
- Vitest startup failed: missing `vite`.
- `tsc -b` could not complete: missing Node/Vite types; the locked TypeScript
  6 compiler also reports upstream's deprecated `baseUrl` option.
- `oxlint` was unavailable. No lint or build pass is claimed.

No live app data was accessed, no remote was added, and nothing was pushed.
