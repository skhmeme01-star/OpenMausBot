import { createServer } from "node:http";
import { writeFileSync } from "node:fs";
import { expect, it } from "vitest";
import { launchVerificationServer, runControlOmb } from "../scripts/control-omb.ts";

it("adds, tests, edits and chats with an isolated Custom LLM without exposing secrets", async () => {
  const requests: Array<{ model: string; messages: unknown[] }> = [];
  const authHeaders: Array<string | undefined> = [];
  const upstream = createServer(async (req, res) => {
    authHeaders.push(req.headers.authorization);
    res.setHeader("content-type", "application/json");
    if (req.url === "/v1/models") return res.end(JSON.stringify({ data: [{ id: "fixture-chat" }, { id: "text-embedding-small" }] }));
    let body = "";
    for await (const chunk of req) body += chunk;
    const request = JSON.parse(body);
    requests.push(request);
    if (request.stream) {
      res.setHeader("content-type", "text/event-stream");
      res.end(`data: ${JSON.stringify({ choices: [{ index: 0, delta: { content: "Custom fixture answered." }, finish_reason: "stop" }] })}\n\ndata: [DONE]\n\n`);
    } else res.end(JSON.stringify({ choices: [{ message: { role: "assistant", content: "OK" } }] }));
  });
  await new Promise<void>(resolve => upstream.listen(0, "127.0.0.1", resolve));
  const address = upstream.address();
  if (!address || typeof address === "string") throw new Error("No fixture port");
  const fixture = await launchVerificationServer().catch(async error => {
    upstream.closeAllConnections();
    await new Promise<void>(resolve => upstream.close(() => resolve()));
    throw error;
  });
  const evidence: unknown[] = [{ fixture: fixture.info }];
  const api = async (method: string, path: string, body?: unknown, status = 200) => {
    const response = await fetch(`${fixture.info.url}${path}`, { method, headers: { "content-type": "application/json", origin: fixture.info.url }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const result = await response.json();
    expect(response.status, JSON.stringify(result)).toBe(status);
    evidence.push({ method, path, status: response.status, result });
    return result;
  };
  const control = async (args: string[]) => {
    const result = await runControlOmb([...args, "--url", fixture.info.url]) as any;
    evidence.push({ command: args, result });
    return result;
  };
  try {
    const settings = { displayName: "Fixture LLM", baseUrl: `http://127.0.0.1:${address.port}/v1`, model: "fixture-chat", fetchModels: true, tools: false };
    await api("POST", "/api/instances/custom-llms", { ...settings, baseUrl: "http://example.com/v1" }, 400);
    const { instanceId } = await api("POST", "/api/instances/custom-llms", settings, 201);
    expect((await api("POST", `/api/instances/custom-llms/${instanceId}/test`, settings)).ok).toBe(true);
    await api("POST", `/api/instances/${instanceId}/refresh-models`, {});
    const { instances } = await api("GET", "/api/instances");
    const engine = instances.find((item: any) => item.instanceId === instanceId);
    expect(engine.models.options.map((item: any) => item.id)).toEqual(["fixture-chat"]);
    const { bot } = await control(["new-bot", "--name", "Custom fixture"]);
    await control(["send", "--bot", bot.id, "--task", bot.activeTaskId, "--text", "Fixture initial turn"]);
    expect((await control(["wait", "--bot", bot.id, "--task", bot.activeTaskId, "--timeout", "20"])).status).toBe("settled");
    await control(["set-model", "--bot", bot.id, "--instance", instanceId, "--model", "fixture-chat"]);
    await control(["send", "--bot", bot.id, "--task", bot.activeTaskId, "--text", "Hello custom engine"]);
    expect((await control(["wait", "--bot", bot.id, "--task", bot.activeTaskId, "--timeout", "20"])).status).toBe("settled");
    const messages = await control(["messages", "--bot", bot.id, "--task", bot.activeTaskId, "--limit", "20"]);
    expect(JSON.stringify(messages)).toContain("Custom fixture answered.");
    expect(authHeaders.every(value => value === undefined)).toBe(true);
    await api("PUT", `/api/instances/custom-llms/${instanceId}`, { ...settings, key: "synthetic-custom-secret" });
    const details = await api("GET", `/api/instances/custom-llms/${instanceId}`);
    expect(details.configured).toBe(true);
    expect(JSON.stringify(details)).not.toContain("synthetic-custom-secret");
    await api("PUT", `/api/instances/custom-llms/${instanceId}`, { ...settings, displayName: "Edited", fetchModels: false });
    expect((await api("GET", `/api/instances/custom-llms/${instanceId}`)).configured).toBe(true);
    await api("PUT", `/api/instances/custom-llms/${instanceId}`, { ...settings, baseUrl: `http://localhost:${address.port}/v1` });
    expect((await api("GET", `/api/instances/custom-llms/${instanceId}`)).configured).toBe(false);
    expect(requests.some(request => request.model === "fixture-chat" && JSON.stringify(request.messages).includes("Fixture initial turn"))).toBe(true);
  } finally {
    const evidencePath = `${fixture.info.logPath}.custom-llm.json`;
    writeFileSync(evidencePath, JSON.stringify(evidence, null, 2));
    console.log(JSON.stringify({ evidencePath, logPath: fixture.info.logPath }));
    await fixture.stop();
    upstream.closeAllConnections();
    await new Promise<void>(resolve => upstream.close(() => resolve()));
  }
}, 120_000);
