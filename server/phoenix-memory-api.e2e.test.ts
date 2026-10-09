// Phoenix edition: exercise durable updates only in the official disposable fixture.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";
import { launchVerificationServer, runControlOmb } from "../scripts/control-omb.ts";

it("appends dated facts, corrects stale claims, rejects conflicts and scrubs credentials", async () => {
  const fixture = await launchVerificationServer();
  try {
    const { bot } = await runControlOmb(["new-bot", "--name", "Phoenix memory"], {
      env: { OPENMAUSBOT_URL: fixture.info.url },
    }) as { bot: { id: string } };
    const api = async (method: string, body?: unknown) => {
      const response = await fetch(`${fixture.info.url}/api/bots/${bot.id}/memory`, {
        method, headers: { "content-type": "application/json", origin: fixture.info.url },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      return { status: response.status, body: await response.json() as { text: string; hash: string } };
    };
    const first = await api("POST", { action: "append", text: "The person prefers tea." });
    expect(first.status).toBe(200);
    expect(first.body.text).toMatch(/- \d{4}-\d{2}-\d{2} · The person prefers tea\./);
    const corrected = await api("POST", { action: "replace", oldText: "The person prefers tea.", text: "The person prefers coffee.", expectedHash: first.body.hash });
    expect(corrected.status).toBe(200);
    expect(corrected.body.text).not.toContain("prefers tea");
    expect(corrected.body.text).toContain("prefers coffee");
    expect((await api("POST", { action: "append", text: "Stale edit", expectedHash: first.body.hash })).status).toBe(409);
    expect((await api("POST", { action: "append", text: "password: fixture-secret-only" })).status).toBe(200);
    const saved = readFileSync(join(fixture.info.dataDir, "bots", bot.id, "MEMORY.md"), "utf8");
    expect(saved).toContain("prefers coffee");
    expect(saved).not.toContain("fixture-secret-only");
    expect((await api("GET")).body.text).toBe(saved);
    expect((await api("POST", { action: "replace", oldText: "missing", text: "Wrong replacement" })).status).toBe(409);
  } finally { await fixture.close(); }
}, 120_000);
