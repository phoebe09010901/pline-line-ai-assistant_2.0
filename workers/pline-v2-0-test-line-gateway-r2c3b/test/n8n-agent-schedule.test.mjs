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
  assert.equal(task.n8n_pipeline_phase, "pipeline_scheduled");
  assert.ok(task.pipeline_scheduled_at, "processing task must include pipeline_scheduled_at immediately after write");
  assert.equal(execution.phase, "pipeline_scheduled");
  assert.equal(execution.pipeline_scheduled_at, task.pipeline_scheduled_at);
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
    assert.notEqual(task.n8n_pipeline_phase, "created");
    assert.ok(task.pipeline_scheduled_at, "LINE POST n8n_agent route must schedule before ACK/background completion");
    assert.notEqual(execution.phase, "created");
    assert.equal(execution.pipeline_scheduled_at, task.pipeline_scheduled_at);
    for (let attempt = 0; attempt < 20 && !releaseLineAck; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    assert.equal(typeof releaseLineAck, "function");

    releaseLineAck();
    await Promise.all(waitUntilPromises);
  } finally {
    globalThis.fetch = originalFetch;
  }
}

await testWriteCreatesScheduledPhase();
await testLinePostSchedulesBeforeBackgroundAckCompletes();
console.log("n8n-agent-schedule.test.mjs: PASS");
