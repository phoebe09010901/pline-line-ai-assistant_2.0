import assert from "node:assert/strict";
import worker, { idempotencyKeyForEvent, writeN8nAgentTask } from "../src/index.js";

class MemoryKV {
  constructor() {
    this.store = new Map();
  }

  async get(key, type) {
    const value = this.store.get(key);
    if (value === undefined) return null;
    return type === "json" ? JSON.parse(value) : value;
  }

  async put(key, value) {
    this.store.set(key, String(value));
  }

  async delete(key) {
    this.store.delete(key);
  }

  entriesWithPrefix(prefix) {
    return [...this.store.entries()].filter(([key]) => key.startsWith(prefix));
  }
}

class HangingPipelineDebugKV extends MemoryKV {
  async put(key, value) {
    if (String(key).startsWith("pipeline-debug/")) return new Promise(() => {});
    return super.put(key, value);
  }
}

async function nextTick() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

function buildEvent(overrides = {}) {
  return {
    type: "message",
    webhookEventId: "evt-n8n-schedule-001",
    replyToken: "reply-token-001",
    source: { type: "user", userId: "Uadmin" },
    message: { type: "text", id: "msg-001", text: "記帳 Cloudflare 56 元" },
    ...overrides,
  };
}

function buildEnv(kv) {
  return {
    CODEX_INBOX: kv,
    PLINE_ENVIRONMENT: "test",
    CODEX_TASK_NAMESPACE: "default",
    PLINE_ADMIN_LINE_USER_IDS: "Uadmin",
    PLINE_N8N_AGENT_ENABLED: "true",
    PLINE_N8N_AGENT_WEBHOOK_URL: "https://n8n.example.test/webhook",
    LINE_CHANNEL_ACCESS_TOKEN: "test-token",
  };
}

async function testWriteCreatesScheduledPhase() {
  const kv = new MemoryKV();
  const env = buildEnv(kv);
  const event = buildEvent();
  const result = await writeN8nAgentTask(event, env, new Request("https://worker.example.test/callback", { method: "POST" }));
  const idempotency = await idempotencyKeyForEvent(event, env);
  const task = await kv.get(`processing/${result.task.task_id}.json`, "json");
  const execution = await kv.get(`executions/${idempotency.idempotency_hash}`, "json");

  assert.equal(result.n8n_agent, true);
  assert.equal(task.status, "processing");
  assert.equal(task.executor_type, "n8n_agent");
  assert.equal(task.route_category, "accounting_single_record");
  assert.equal(task.n8n_pipeline_phase, "pipeline_started");
  assert.ok(task.pipeline_schedule_intent_at, "processing task must include pipeline_schedule_intent_at immediately after write");
  assert.ok(task.pipeline_scheduled_at, "processing task must include pipeline_scheduled_at immediately after write");
  assert.ok(task.pipeline_started_at, "processing task must include pipeline_started_at immediately after write");
  assert.equal(execution.phase, "pipeline_started");
  assert.equal(execution.pipeline_schedule_intent_at, task.pipeline_schedule_intent_at);
  assert.equal(execution.pipeline_scheduled_at, task.pipeline_scheduled_at);
  assert.equal(execution.pipeline_started_at, task.pipeline_started_at);
  await nextTick();
  const debug = await kv.get(`pipeline-debug/${idempotency.idempotency_hash}`, "json");
  assert.equal(debug.phase, "task_created");
  assert.equal(debug.pipeline_schedule_intent_at, task.pipeline_schedule_intent_at);
  assert.equal(debug.pipeline_started_at, task.pipeline_started_at);
}

async function testDebugSeedCannotBlockTaskCreation() {
  const kv = new HangingPipelineDebugKV();
  const env = buildEnv(kv);
  const event = buildEvent({ webhookEventId: "evt-debug-hang-001" });
  const result = await Promise.race([
    writeN8nAgentTask(event, env, new Request("https://worker.example.test/callback", { method: "POST" })),
    new Promise((_, reject) => setTimeout(() => reject(new Error("write_n8n_agent_task_timeout")), 500)),
  ]);
  const idempotency = await idempotencyKeyForEvent(event, env);
  const task = await kv.get(`processing/${result.task.task_id}.json`, "json");
  const execution = await kv.get(`executions/${idempotency.idempotency_hash}`, "json");

  assert.equal(result.n8n_agent, true);
  assert.equal(task.n8n_pipeline_phase, "pipeline_started");
  assert.ok(task.pipeline_schedule_intent_at);
  assert.ok(task.pipeline_started_at);
  assert.equal(execution.pipeline_schedule_intent_at, task.pipeline_schedule_intent_at);
}

async function testWriteWithCtxSchedulesBeforeReturn() {
  const kv = new MemoryKV();
  const env = buildEnv(kv);
  const waitUntilPromises = [];
  let releaseLineAck;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const target = String(url);
    if (target.includes("/v2/bot/message/reply")) {
      return new Promise((resolve) => {
        releaseLineAck = () => resolve(new Response("{}", { status: 200 }));
      });
    }
    if (target.includes("n8n.example.test")) {
      return new Response(JSON.stringify({ final_user_message: "我記好了。" }), { status: 202 });
    }
    if (target.includes("/v2/bot/message/push")) {
      return new Response("{}", { status: 200 });
    }
    throw new Error(`unexpected_fetch:${target}`);
  };

  try {
    const result = await writeN8nAgentTask(
      buildEvent({ webhookEventId: "evt-write-ctx-001" }),
      env,
      new Request("https://worker.example.test/callback", { method: "POST" }),
      { waitUntil(promise) { waitUntilPromises.push(promise); } },
    );
    const task = await kv.get(`processing/${result.task.task_id}.json`, "json");
    const execution = await kv.get(`executions/${task.idempotency_hash}`, "json");

    assert.equal(result.n8n_agent_scheduled_in_write, true);
    assert.ok(task.schedule_handler_entry_at, "writeN8nAgentTask with ctx must enter schedule handler before return");
    assert.ok(task.waituntil_call_at, "writeN8nAgentTask with ctx must write waituntil_call_at before return");
    assert.ok(task.waituntil_registered_at, "writeN8nAgentTask with ctx must write waituntil_registered_at before return");
    assert.equal(execution.schedule_handler_entry_at, task.schedule_handler_entry_at);
    assert.equal(execution.waituntil_call_at, task.waituntil_call_at);
    assert.equal(execution.waituntil_registered_at, task.waituntil_registered_at);

    for (let attempt = 0; attempt < 20 && !releaseLineAck; attempt += 1) await nextTick();
    assert.equal(typeof releaseLineAck, "function");
    releaseLineAck();
    await Promise.all(waitUntilPromises);
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function testLinePostSchedulesBeforeBackgroundAckCompletes() {
  const kv = new MemoryKV();
  const env = buildEnv(kv);
  const waitUntilPromises = [];
  let releaseLineAck;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const target = String(url);
    if (target.includes("/v2/bot/message/reply")) {
      return new Promise((resolve) => {
        releaseLineAck = () => resolve(new Response("{}", { status: 200 }));
      });
    }
    if (target.includes("n8n.example.test")) {
      return new Response(JSON.stringify({ final_user_message: "我記好了。" }), { status: 202 });
    }
    if (target.includes("/v2/bot/message/push")) {
      return new Response("{}", { status: 200 });
    }
    throw new Error(`unexpected_fetch:${target}`);
  };

  try {
    const response = await worker.fetch(new Request("https://worker.example.test/callback", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ events: [buildEvent()] }),
    }), env, {
      waitUntil(promise) {
        waitUntilPromises.push(promise);
      },
    });

    assert.equal(response.status, 200);
    const processingEntries = kv.entriesWithPrefix("processing/");
    assert.equal(processingEntries.length, 1);
    const task = JSON.parse(processingEntries[0][1]);
    const execution = await kv.get(`executions/${task.idempotency_hash}`, "json");
    const debugKey = `pipeline-debug/${task.idempotency_hash}`;
    assert.notEqual(task.n8n_pipeline_phase, "pipeline_scheduled");
    assert.ok(task.pipeline_scheduled_at, "LINE POST n8n_agent route must schedule before ACK/background completion");
    assert.ok(task.pipeline_started_at, "LINE POST n8n_agent route must write pipeline_started before waitUntil background work");
    assert.notEqual(execution.phase, "pipeline_scheduled");
    assert.equal(execution.pipeline_scheduled_at, task.pipeline_scheduled_at);
    assert.equal(execution.pipeline_started_at, task.pipeline_started_at);
    assert.ok(task.schedule_handler_entry_at, "n8n_agent route must write schedule_handler_entry_at into task");
    assert.ok(task.waituntil_call_at, "n8n_agent route must write waituntil_call_at into task");
    assert.ok(task.waituntil_registered_at, "n8n_agent route must write waituntil_registered_at into task");
    assert.equal(execution.schedule_handler_entry_at, task.schedule_handler_entry_at);
    assert.equal(execution.waituntil_call_at, task.waituntil_call_at);
    assert.equal(execution.waituntil_registered_at, task.waituntil_registered_at);
    for (let attempt = 0; attempt < 20 && !releaseLineAck; attempt += 1) {
      await nextTick();
    }
    assert.equal(typeof releaseLineAck, "function");
    const taskAfterEntry = await kv.get(`processing/${task.task_id}.json`, "json");
    const debugAfterEntry = await kv.get(debugKey, "json");
    assert.ok(taskAfterEntry.pipeline_entry_at, "n8n_agent pipeline must write pipeline_entry_at into task");
    assert.equal(debugAfterEntry.version, "V3.4.17");
    assert.ok(debugAfterEntry.pipeline_entry_at, "n8n_agent pipeline must write independent pipeline_entry_at debug key");
    const debugJson = JSON.stringify(debugAfterEntry);
    assert.equal(debugJson.includes("test-token"), false);
    assert.equal(debugJson.includes("reply-token-001"), false);
    assert.equal(debugJson.includes("Uadmin"), false);
    assert.equal(debugJson.includes("userId"), false);

    releaseLineAck();
    await Promise.all(waitUntilPromises);
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function testWaitUntilErrorDiagnosticIsSanitized() {
  const kv = new MemoryKV();
  const env = buildEnv(kv);
  const sensitiveUserId = `U${"0123456789abcdef0123456789abcdef"}`;
  env.PLINE_ADMIN_LINE_USER_IDS = sensitiveUserId;
  const response = await worker.fetch(new Request("https://worker.example.test/callback", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ events: [buildEvent({ webhookEventId: "evt-waituntil-error-001", source: { type: "user", userId: sensitiveUserId } })] }),
  }), env, {
    waitUntil() {
      throw new Error(`Bearer abc.def.ghi token=secret123 user ${sensitiveUserId}`);
    },
  });

  assert.equal(response.status, 200);
  const debugEntries = kv.entriesWithPrefix("pipeline-debug/");
  assert.equal(debugEntries.length, 1);
  const debug = JSON.parse(debugEntries[0][1]);
  assert.ok(debug.pipeline_schedule_error, "waitUntil sync failure must write pipeline_schedule_error");
  const errorJson = JSON.stringify(debug.pipeline_schedule_error);
  assert.equal(errorJson.includes("abc.def.ghi"), false);
  assert.equal(errorJson.includes("secret123"), false);
  assert.equal(errorJson.includes(sensitiveUserId), false);
}

await testWriteCreatesScheduledPhase();
await testDebugSeedCannotBlockTaskCreation();
await testWriteWithCtxSchedulesBeforeReturn();
await testLinePostSchedulesBeforeBackgroundAckCompletes();
await testWaitUntilErrorDiagnosticIsSanitized();
console.log("n8n-agent-schedule.test.mjs: PASS");
