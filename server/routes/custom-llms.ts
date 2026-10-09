// Custom connections reuse the OpenAI-compatible provider and the existing
// write-only, permission-restricted provider configuration store.
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { InstanceConfigMap } from "../contracts.ts";
import { PASS, type RouteHandler } from "./table.ts";

export const customLlmSchema = z.object({
  displayName: z.string().trim().min(1).max(80).refine(value => !/\p{Cc}/u.test(value)),
  baseUrl: z.string().trim().url().max(2048).refine(value => {
    let url: URL;
    try { url = new URL(value); } catch { return false; }
    return !url.username && !url.password && !url.search && !url.hash &&
      (url.protocol === "https:" || (url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)));
  }),
  model: z.string().trim().min(1).max(200).refine(value => !/\p{Cc}/u.test(value)),
  apiKeyEnv: z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/).max(200).optional(),
  key: z.string().max(8192).optional(),
  fetchModels: z.boolean().default(true),
  tools: z.boolean().default(true),
}).strict();

interface Deps {
  instances(): InstanceConfigMap;
  persist(id: string, instances: InstanceConfigMap): Promise<void>;
  exclusive<T>(work: () => Promise<T>): Promise<T> | null;
  busy(id: string): boolean;
  hosted(): boolean;
}

export function createCustomLlmRoutes(deps: Deps): RouteHandler {
  return async ({ req, res, path, method, json, readBody }) => {
    const match = /^\/api\/instances\/custom-llms(?:\/(custom-llm-[\w-]+))?(\/test)?$/.exec(path);
    if (!match) return PASS;
    if (deps.hosted()) return json(res, 403, { error: "Custom engines are managed by the workspace host." });
    const id = match[1];
    const instances = deps.instances();
    const entry = id ? instances[id] : undefined;
    if (id && (!entry || entry.driver !== "openai-compat")) return json(res, 404, { error: "Custom LLM not found." });
    const saved = (entry?.config ?? {}) as Record<string, unknown>;
    if (method === "GET" && id && !match[2]) {
      res.setHeader("cache-control", "no-store");
      return json(res, 200, { displayName: entry!.displayName, baseUrl: saved.url, model: saved.model,
        apiKeyEnv: saved.apiKeyEnv, configured: Boolean(saved.key), fetchModels: saved.fetchModels !== false, tools: saved.tools !== false });
    }
    if (method !== "POST" && method !== "PUT") return PASS;
    if (!String(req.headers["content-type"] ?? "").toLowerCase().startsWith("application/json")) return json(res, 415, { error: "content-type must be application/json" });
    const parsed = customLlmSchema.safeParse(await readBody(req, 16384));
    if (!parsed.success) return json(res, 400, { error: "Enter a name, model ID and HTTPS or loopback HTTP base URL; credentials in URLs are not allowed." });
    const body = parsed.data;
    const instanceId = id ?? `custom-llm-${randomUUID()}`;
    const url = body.baseUrl.replace(/\/+$/, "");
    // An omitted key preserves a saved secret only on the same endpoint.
    // Changing hosts must never forward the old host's credential.
    const connectionKey = (config: Record<string, unknown>) => body.key ?? (config.url === url && typeof config.key === "string" ? config.key : "");
    const key = connectionKey(saved);
    const apiKeyEnv = body.apiKeyEnv ?? `OMB_CUSTOM_${instanceId.replaceAll("-", "_").toUpperCase()}_KEY`;
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname);
    if (match[2]) {
      try {
        const resolvedKey = key || process.env[apiKeyEnv] || "";
        if (!resolvedKey && !local) return json(res, 200, { ok: false, message: "Set an API key or server environment variable." });
        const response = await fetch(`${url}/chat/completions`, { method: "POST", redirect: "error",
          headers: { "content-type": "application/json", ...(resolvedKey ? { authorization: `Bearer ${resolvedKey}` } : {}) },
          body: JSON.stringify({ model: body.model, messages: [{ role: "user", content: "Reply OK." }], max_tokens: 8, stream: false }),
          signal: AbortSignal.timeout(8000) });
        // Never echo provider errors: they may contain request credentials.
        const result = response.ok ? await response.json() as { choices?: unknown[] } : null;
        const valid = Array.isArray(result?.choices) && result.choices.length > 0;
        return json(res, 200, { ok: valid, message: valid ? "Connection answered." : response.ok ? "Endpoint did not return a chat completion." : `Connection returned HTTP ${response.status}.` });
      } catch { return json(res, 200, { ok: false, message: "Connection failed or timed out." }); }
    }
    if ((method === "PUT") !== Boolean(id)) return json(res, 400, { error: "Use POST to add or PUT to edit a custom engine." });
    const answered = deps.exclusive(async () => {
      if (deps.busy(instanceId)) return json(res, 409, { error: "Wait for bots using this engine to finish." });
      const current = deps.instances();
      if (id && current[id]?.driver !== "openai-compat") return json(res, 404, { error: "Custom LLM not found." });
      const currentKey = connectionKey((current[instanceId]?.config ?? {}) as Record<string, unknown>);
      current[instanceId] = { driver: "openai-compat", displayName: body.displayName, access: "api",
        config: { url, model: body.model, apiKeyEnv, key: currentKey, fetchModels: body.fetchModels, tools: body.tools,
          customLlm: true, allowAnonymous: local, provider: "" } };
      await deps.persist(instanceId, current);
      return json(res, id ? 200 : 201, { instanceId });
    });
    if (!answered) return json(res, 409, { error: "provider settings are already being updated" });
    return answered;
  };
}
