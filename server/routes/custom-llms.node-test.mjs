import assert from "node:assert/strict";
import { test } from "node:test";
import { createCustomLlmRoutes, customLlmSchema } from "./custom-llms.ts";
import { PASS } from "./table.ts";

function fixture() {
  let instances = {};
  let busy = false;
  let hosted = false;
  let locked = false;
  const handler = createCustomLlmRoutes({
    instances: () => structuredClone(instances),
    persist: async (_id, map) => { instances = map; },
    busy: () => busy,
    hosted: () => hosted,
    exclusive: work => locked ? null : work(),
  });
  return {
    instances: () => instances,
    busy: value => { busy = value; },
    hosted: value => { hosted = value; },
    locked: value => { locked = value; },
    async request(method, path, body, contentType = "application/json") {
      let result;
      const output = await handler({ method, path,
        req: { headers: { "content-type": contentType } },
        res: { setHeader() {} }, readBody: async () => body,
        json: (_res, status, data) => { result = { status, data }; },
      });
      return result ?? output;
    },
  };
}
const settings = { displayName: "Fixture", baseUrl: "http://127.0.0.1:8045/v1", model: "llama3.2" };

test("custom connection schema validates URLs, model IDs and env references", () => {
  for (const url of ["http://localhost:11434/v1", "http://127.0.0.1:8045/v1", "http://[::1]:8080/v1", "https://example.com/v1"]) {
    assert.equal(customLlmSchema.safeParse({ ...settings, baseUrl: url }).success, true);
  }
  for (const url of ["not-a-url", "http://example.com/v1", "https://key@example.com/v1", "https://example.com/v1?key=secret", "file:///tmp/x"]) {
    assert.equal(customLlmSchema.safeParse({ ...settings, baseUrl: url }).success, false);
  }
  assert.equal(customLlmSchema.safeParse({ ...settings, model: "" }).success, false);
  assert.equal(customLlmSchema.safeParse({ ...settings, apiKeyEnv: "invalid name" }).success, false);
});

test("saved connections isolate credentials, return write-only flags and preserve secrets only on the same endpoint", async () => {
  const f = fixture();
  const created = await f.request("POST", "/api/instances/custom-llms", { ...settings, key: "synthetic-secret" });
  assert.equal(created.status, 201);
  const id = created.data.instanceId;
  const path = `/api/instances/custom-llms/${id}`;
  const entry = f.instances()[id];
  assert.equal(entry.driver, "openai-compat");
  assert.equal(entry.config.allowAnonymous, true);
  assert.notEqual(entry.config.apiKeyEnv, "OPENAI_COMPAT_API_KEY");
  assert.equal(entry.config.provider, "");
  const read = await f.request("GET", path);
  assert.equal(read.data.configured, true);
  assert.equal(JSON.stringify(read).includes("synthetic-secret"), false);
  await f.request("PUT", path, { ...settings, displayName: "Edited", fetchModels: false });
  assert.equal(f.instances()[id].config.key, "synthetic-secret");
  assert.equal(f.instances()[id].config.fetchModels, false);
  await f.request("PUT", path, { ...settings, baseUrl: "https://example.com/v1" });
  assert.equal(f.instances()[id].config.key, "");
  assert.equal(f.instances()[id].config.allowAnonymous, false);
});

test("busy, locked and hosted engines refuse changes; foreign routes pass through", async () => {
  const f = fixture();
  assert.equal(await f.request("GET", "/api/bots"), PASS);
  assert.equal((await f.request("POST", "/api/instances/custom-llms", settings, "text/plain")).status, 415);
  f.locked(true);
  assert.equal((await f.request("POST", "/api/instances/custom-llms", settings)).status, 409);
  f.locked(false);
  f.busy(true);
  assert.equal((await f.request("POST", "/api/instances/custom-llms", settings)).status, 409);
  f.hosted(true);
  assert.equal((await f.request("POST", "/api/instances/custom-llms", settings)).status, 403);
  assert.deepEqual(f.instances(), {});
});

test("connection probes use the model and redact provider failures", async () => {
  const f = fixture();
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (_url, options) => {
      assert.equal(options.redirect, "error");
      assert.equal(options.headers.authorization, undefined);
      assert.equal(JSON.parse(options.body).model, settings.model);
      return new Response(JSON.stringify({ choices: [{ message: { content: "OK" } }] }));
    };
    assert.equal((await f.request("POST", "/api/instances/custom-llms/test", settings)).data.ok, true);
    globalThis.fetch = async () => new Response("synthetic-secret", { status: 401 });
    const refused = await f.request("POST", "/api/instances/custom-llms/test", { ...settings, key: "synthetic-secret" });
    assert.equal(refused.data.ok, false);
    assert.equal(JSON.stringify(refused).includes("synthetic-secret"), false);
  } finally { globalThis.fetch = originalFetch; }
});
