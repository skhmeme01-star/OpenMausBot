import { useEffect, useState } from "react";
import { api, useStore } from "@/state/store";

const PRESETS = [
  ["Custom URL", ""],
  ["Ollama", "http://localhost:11434/v1"],
  ["llama.cpp", "http://localhost:8080/v1"],
  ["Antigravity proxy", "http://127.0.0.1:8045/v1"],
];
interface Connection {
  displayName: string;
  baseUrl: string;
  model: string;
  apiKeyEnv: string;
  fetchModels: boolean;
  tools: boolean;
}
const EMPTY: Connection = { displayName: "Custom LLM", baseUrl: "", model: "", apiKeyEnv: "", fetchModels: true, tools: true };

export function CustomLlmSettings() {
  const { state, refreshInstances } = useStore();
  const [selected, setSelected] = useState("");
  const [connection, setConnection] = useState(EMPTY);
  const [key, setKey] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    let active = true;
    setKey("");
    setMessage("");
    if (!selected) { setConnection(EMPTY); setLoading(false); return; }
    setConnection(EMPTY);
    setLoading(true);
    api(`/api/instances/custom-llms/${encodeURIComponent(selected)}`)
      .then((value: Connection) => { if (active) setConnection({ displayName: value.displayName, baseUrl: value.baseUrl, model: value.model, apiKeyEnv: value.apiKeyEnv, fetchModels: value.fetchModels, tools: value.tools }); })
      .catch(() => { if (active) setMessage("Could not load this engine."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [selected]);
  const update = <K extends keyof Connection>(field: K, value: Connection[K]) => {
    setConnection(previous => ({ ...previous, [field]: value }));
    setMessage("");
  };
  const submit = async (test: boolean) => {
    setBusy(true);
    setMessage("");
    try {
      const path = `/api/instances/custom-llms${selected ? `/${encodeURIComponent(selected)}` : ""}${test ? "/test" : ""}`;
      const result = await api(path, { method: test || !selected ? "POST" : "PUT",
        body: JSON.stringify({ ...connection, apiKeyEnv: connection.apiKeyEnv || undefined, ...(key ? { key } : {}) }) });
      if (test) setMessage(result.ok ? "Connection test passed." : result.message);
      else {
        setKey("");
        setSelected(result.instanceId);
        await refreshInstances();
        setMessage("Custom LLM saved. Select it in the bot’s model picker.");
      }
    } catch { setMessage("Could not complete the request. Check the connection settings and try again."); }
    finally { setBusy(false); }
  };
  const inputClass = "w-full rounded-lg border border-hairline/40 bg-inset px-3 py-2 text-[13px] text-ink";
  return <section className="rounded-xl border border-hairline/40 p-4">
    <button className="text-[13px] font-medium text-ink" aria-expanded={open} onClick={() => setOpen(value => !value)}>Add / edit Custom LLM</button>
    {open && <fieldset disabled={busy || loading} className="mt-3 flex flex-col gap-3 text-[13px] text-ink">
      <label>Engine<select className={inputClass} value={selected} onChange={event => setSelected(event.target.value)}>
        <option value="">Add new engine</option>
        {state.instances.filter(instance => instance.instanceId.startsWith("custom-llm-") && !instance.readOnly).map(instance => <option key={instance.instanceId} value={instance.instanceId}>{instance.displayName}</option>)}
      </select></label>
      <label>Preset<select className={inputClass} defaultValue="" onChange={event => update("baseUrl", event.target.value)}>
        {PRESETS.map(([name, url]) => <option key={name} value={url}>{name}</option>)}
      </select></label>
      <label>Name<input className={inputClass} value={connection.displayName} onChange={event => update("displayName", event.target.value)} /></label>
      <label>Base URL<input className={inputClass} value={connection.baseUrl} onChange={event => { update("baseUrl", event.target.value); setKey(""); }} placeholder="http://localhost:11434/v1" /></label>
      <label>Model ID<input className={inputClass} value={connection.model} onChange={event => update("model", event.target.value)} placeholder="llama3.2" /></label>
      <label>API key (optional; leave blank to keep the saved key)<input className={inputClass} type="password" autoComplete="new-password" value={key} onChange={event => setKey(event.target.value)} /></label>
      <label>Or server API key environment variable<input className={inputClass} value={connection.apiKeyEnv} onChange={event => update("apiKeyEnv", event.target.value)} placeholder="MY_LLM_API_KEY" /></label>
      <label><input type="checkbox" checked={connection.fetchModels} onChange={event => update("fetchModels", event.target.checked)} /> Discover models from this endpoint</label>
      <label><input type="checkbox" checked={connection.tools} onChange={event => update("tools", event.target.checked)} /> Enable agent tools (requires model support)</label>
      <p className="text-ink-secondary">Local URLs refer to the machine running the harness server. The model ID remains available if discovery fails. Changing the URL clears the saved key.</p>
      <div className="flex gap-3">
        <button className="rounded-lg bg-raised px-3 py-2 disabled:opacity-50" disabled={!connection.baseUrl || !connection.model} onClick={() => void submit(true)}>Test connection</button>
        <button className="rounded-lg bg-raised px-3 py-2 disabled:opacity-50" disabled={!connection.baseUrl || !connection.model} onClick={() => void submit(false)}>Save Custom LLM</button>
      </div>
    </fieldset>}
    {message && <p role="status" className="mt-2 text-[13px] text-ink-secondary">{message}</p>}
  </section>;
}
