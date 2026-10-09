import assert from "node:assert/strict";
import { test } from "node:test";
import { agentToolAnnotations, isReadOnlyAgentTool } from "./agent-tool-policy.ts";
import { createChatToolApproval } from "./drivers/chat-tool-approval.ts";

test("memory reads are reviewed reads and durable writes never gain read permission", () => {
  assert.equal(isReadOnlyAgentTool("memory_read"), true);
  assert.equal(agentToolAnnotations("memory_read").readOnlyHint, true);
  for (const name of ["memory_update", "memory_log", "memory_read_and_write", "MEMORY_READ"]) {
    assert.equal(isReadOnlyAgentTool(name), false);
    assert.equal(agentToolAnnotations(name), undefined);
  }
});

test("the memory write approval gate honors denial and approval", async () => {
  let pending;
  const gate = createChatToolApproval({
    signal: new AbortController().signal,
    open: (ask) => { pending = ask; }, resolved: () => {},
    openQuestion: () => {}, resolvedQuestion: () => {},
  });
  try {
    const denied = gate.ask("agents_memory_update", "Remember a preference");
    gate.answer(pending.id, "deny");
    assert.equal(await denied, false);
    const allowed = gate.ask("agents_memory_update", "Remember an approved preference");
    gate.answer(pending.id, "allow");
    assert.equal(await allowed, true);
  } finally { gate.close(); }
});
