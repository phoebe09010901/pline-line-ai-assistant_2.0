const LINE_REPLY_API_URL = "https://api.line.me/v2/bot/message/reply";
const QUICK_ACK_REPLY = "我收到訊息了，馬上幫你處理 ✨";
const QUICK_QUESTION_ACK_REPLY = "我收到問題了，馬上幫你查一下 ✨";
const LONG_TASK_REPLY = "我收到任務了，正在處理中 🛠️\n\n任務編號：{display_task_id}\n\n完成後我會再通知你。";
const PROJECT = "菲比 LINE 智能助理_02";
const WORKER_NAME = "pline-v2-0-test-line-gateway-r2c3b";
const WORKER_VERSION = "V3.3";
const EXECUTOR_STATUS_KEY = "executor-status:test:default";
const EXECUTOR_OFFLINE_AFTER_MS = 75_000;
const LONG_TASK_HINTS = [
  "修改檔案", "整理專案", "執行程式", "部署", "computer use", "Computer Use",
  "多步驟", "長時間分析", "修正程式", "實作", "開發", "重構",
  "檢查專案", "跑測試", "驗證結果", "建立網站", "產生報告",
];

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8" } });
}

function taipeiNow() {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.filter((p) => p.type !== "literal").map((p) => [p.type, p.value]));
  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}:${values.second}+08:00`;
}

function taskId(event, lineEventId) {
  return event.webhookEventId || lineEventId;
}

function displayTaskId() {
  const timePart = Date.now().toString(36).toUpperCase().slice(-6);
  const randomPart = Math.random().toString(36).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4).padEnd(4, "0");
  return `P-${timePart}-${randomPart}`;
}

function executionMode(text) {
  return LONG_TASK_HINTS.some((hint) => text.includes(hint)) ? "long" : "quick";
}

function executorStatusKey(env = {}) {
  return env.CODEX_EXECUTOR_STATUS_KEY || EXECUTOR_STATUS_KEY;
}

function parseExecutorStatus(raw, checkedAtMs = Date.now()) {
  if (!raw || typeof raw !== "object") {
    return {
      state: "unknown",
      status: "unknown",
      stale: true,
      online: false,
      busy: false,
      last_heartbeat_at: null,
      checked_at: new Date(checkedAtMs).toISOString(),
      age_ms: null,
    };
  }
  const lastHeartbeat = typeof raw.last_heartbeat_at === "string" ? raw.last_heartbeat_at : null;
  const lastHeartbeatMs = lastHeartbeat ? Date.parse(lastHeartbeat) : Number.NaN;
  const ageMs = Number.isFinite(lastHeartbeatMs) ? checkedAtMs - lastHeartbeatMs : null;
  const stale = ageMs === null || ageMs > EXECUTOR_OFFLINE_AFTER_MS;
  const status = typeof raw.status === "string" ? raw.status : "unknown";
  const busy = status === "busy" && !stale;
  const online = (status === "online" || status === "busy") && !stale;
  const state = online ? status : stale ? "stale" : status === "offline" ? "offline" : "unknown";
  return {
    state,
    status,
    stale,
    online,
    busy,
    last_heartbeat_at: lastHeartbeat,
    checked_at: new Date(checkedAtMs).toISOString(),
    age_ms: ageMs,
    executor_id: typeof raw.executor_id === "string" ? raw.executor_id : null,
    environment: typeof raw.environment === "string" ? raw.environment : null,
    monitor_version: typeof raw.monitor_version === "string" ? raw.monitor_version : null,
    current_task_id: typeof raw.current_task_id === "string" ? raw.current_task_id : null,
  };
}

export async function readExecutorStatus(env = {}, checkedAtMs = Date.now()) {
  if (!env.CODEX_INBOX) return parseExecutorStatus(null, checkedAtMs);
  try {
    const raw = await env.CODEX_INBOX.get(executorStatusKey(env), "json");
    return parseExecutorStatus(raw, checkedAtMs);
  } catch (error) {
    console.error("executor_status_read_failed", { summary: error instanceof Error ? error.message : String(error) });
    return { ...parseExecutorStatus(null, checkedAtMs), read_error: true };
  }
}

function wakeUrl(env = {}) {
  return env.CODEX_MONITOR_WAKE_URL || env.CODEX_WAKE_URL || "";
}

function isLocalWakeUrl(url) {
  try {
    return ["localhost", "127.0.0.1", "::1"].includes(new URL(url).hostname);
  } catch {
    return false;
  }
}

export function ackUserMessage(text, mode, displayId) {
  return ackUserMessageWithExecutor(text, mode, displayId, { online: true, busy: false });
}

export function ackUserMessageWithExecutor(text, mode, displayId, executor = { online: true, busy: false }) {
  if (!executor.online) {
    if (mode === "long") {
      return `我先幫你收妥了，現在暫時還不能開始執行。\n\n任務編號：${displayId}\n\n等我恢復後會接著處理，再通知你。`;
    }
    return /[?？]/.test(text)
      ? "我先幫你收妥了。現在暫時還不能開始查詢，等我恢復後會接著處理。"
      : "我先幫你收妥了。現在暫時還不能開始處理，等我恢復後會接著處理。";
  }
  if (executor.busy) {
    if (mode === "long") {
      return `我收到任務了，會接著處理 🛠️\n\n任務編號：${displayId}\n\n有進度我會再通知你。`;
    }
    return /[?？]/.test(text) ? "我收到問題了，會接著幫你查 ✨" : "我收到訊息了，會接著幫你處理 ✨";
  }
  if (mode === "long") return LONG_TASK_REPLY.replace("{display_task_id}", displayId);
  return /[?？]/.test(text) ? QUICK_QUESTION_ACK_REPLY : QUICK_ACK_REPLY;
}

function wakePlan(env = {}, request = null, queuedWhileOffline = false, createdAt = taipeiNow()) {
  const url = wakeUrl(env);
  if (queuedWhileOffline) return { status: "not_attempted", skip_reason: "executor_offline_or_unknown", sent_at: null };
  if (!url) return { status: "skipped", skip_reason: "missing_wake_url", sent_at: null };
  if (request?.cf && isLocalWakeUrl(url)) return { status: "skipped", skip_reason: "wake_url_not_reachable_from_cloudflare", sent_at: null };
  return { status: "scheduled", skip_reason: null, sent_at: createdAt };
}

export async function writeInboxTask(event, env, request = null) {
  const lineEventId = typeof event.webhookEventId === "string" && event.webhookEventId
    ? event.webhookEventId
    : typeof event.replyToken === "string" ? event.replyToken : `event-${Date.now()}`;
  const id = taskId(event, lineEventId);
  const mode = executionMode(event.message.text);
  const displayId = displayTaskId();
  const createdAt = taipeiNow();
  const executorStatus = await readExecutorStatus(env);
  const queuedWhileOffline = !executorStatus.online;
  const plannedWake = wakePlan(env, request, queuedWhileOffline, createdAt);
  const key = `pending/${id}.json`;
  const seenKey = `events/${lineEventId}`;
  const task = {
    task_id: id,
    display_task_id: displayId,
    execution_mode: mode,
    ack_user_message: ackUserMessageWithExecutor(event.message.text, mode, displayId, executorStatus),
    wake_endpoint_configured: Boolean(wakeUrl(env)),
    wake_endpoint_env: env.CODEX_MONITOR_WAKE_URL ? "CODEX_MONITOR_WAKE_URL" : env.CODEX_WAKE_URL ? "CODEX_WAKE_URL" : null,
    wake_status: plannedWake.status,
    wake_skip_reason: plannedWake.skip_reason,
    wake_sent_at: plannedWake.sent_at,
    progress_stage: mode === "long" ? "queued" : null,
    progress_user_message: null,
    line_event_id: lineEventId,
    text: event.message.text,
    original_text: event.message.text,
    ...(typeof event.source?.userId === "string" ? { user_id: event.source.userId } : {}),
    source: "LINE",
    status: "pending",
    received_at: createdAt,
    task_created_at: createdAt,
    gateway_ack_at: createdAt,
    attempts: 0,
    queued_while_offline: queuedWhileOffline,
    queued_at: queuedWhileOffline ? createdAt : null,
    executor_status_at_enqueue: executorStatus,
    executor_last_heartbeat_at: executorStatus.last_heartbeat_at || null,
    risk_level: "unknown",
    requires_confirmation_after_offline: "unknown",
    project: PROJECT,
    version: WORKER_VERSION,
  };

  if (!env.CODEX_INBOX) throw new Error("CODEX_INBOX binding is missing");
  if (await env.CODEX_INBOX.get(seenKey)) return { duplicate: true };
  await env.CODEX_INBOX.put(seenKey, id);
  await env.CODEX_INBOX.put(key, JSON.stringify(task));
  return { duplicate: false, task };
}

async function replyToLine(event, env, task) {
  if (!env.LINE_CHANNEL_ACCESS_TOKEN) throw new Error("LINE_CHANNEL_ACCESS_TOKEN binding is missing");
  const text = task?.ack_user_message || ackUserMessage(event.message.text, task?.execution_mode, task?.display_task_id);
  const response = await fetch(LINE_REPLY_API_URL, {
    method: "POST",
    headers: { authorization: `Bearer ${env.LINE_CHANNEL_ACCESS_TOKEN}`, "content-type": "application/json" },
    body: JSON.stringify({ replyToken: event.replyToken, messages: [{ type: "text", text }] }),
  });
  if (!response.ok) console.error("line_reply_failed", { status: response.status });
}

export async function wakeMonitor(task, env = {}, request = null) {
  const url = wakeUrl(env);
  if (!url) {
    console.log("monitor_wake_skipped", { reason: "missing_wake_url" });
    return { ok: true, skipped: true, reason: "missing_wake_url" };
  }
  if (request?.cf && isLocalWakeUrl(url)) {
    console.log("monitor_wake_skipped", { reason: "wake_url_not_reachable_from_cloudflare" });
    return { ok: true, skipped: true, reason: "wake_url_not_reachable_from_cloudflare" };
  }
  const headers = { "content-type": "application/json" };
  const token = env.CODEX_MONITOR_WAKE_TOKEN || env.CODEX_WAKE_TOKEN || "";
  if (token) headers.authorization = `Bearer ${token}`;
  try {
    const sentAt = taipeiNow();
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        event: "pending_task_created",
        project: PROJECT,
        display_task_id: task?.display_task_id || null,
        at: sentAt,
      }),
    });
    return { ok: response.ok, status: response.status, sent_at: sentAt };
  } catch (error) {
    console.error("monitor_wake_failed", { summary: error instanceof Error ? error.message : String(error) });
    return { ok: false, error: "wake_failed" };
  }
}

function wakeMonitorSoon(task, env = {}, ctx, request = null) {
  const wake = wakeMonitor(task, env, request);
  if (ctx?.waitUntil) ctx.waitUntil(wake);
  else void wake;
}

async function pushLineText(taskId, text, env) {
  const task = taskId && env.CODEX_INBOX
    ? (await env.CODEX_INBOX.get(`completed/${taskId}.json`, "json"))
      || (await env.CODEX_INBOX.get(`processing/${taskId}.json`, "json"))
      || (await env.CODEX_INBOX.get(`failed/${taskId}.json`, "json"))
    : null;
  if (!task?.user_id || typeof text !== "string" || !text.trim()) return json({ ok: false, error: "missing_task_target" }, 400);
  if (!env.LINE_CHANNEL_ACCESS_TOKEN) return json({ ok: false, error: "missing_runtime_binding" }, 500);
  const response = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: { authorization: `Bearer ${env.LINE_CHANNEL_ACCESS_TOKEN}`, "content-type": "application/json" },
    body: JSON.stringify({ to: task.user_id, messages: [{ type: "text", text }] }),
  });
  return json({ ok: response.ok, status: response.status });
}

export default {
  async fetch(request, env, ctx) {
    if (request.method === "GET") return json({ ok: true, worker: WORKER_NAME, version: WORKER_VERSION });
    if (request.method === "POST" && new URL(request.url).pathname === "/internal/final-push") {
      let body;
      try { body = await request.json(); } catch { return json({ ok: false, error: "invalid_json" }, 400); }
      return pushLineText(body?.task_id, body?.text, env);
    }
    if (request.method === "POST" && new URL(request.url).pathname === "/internal/progress-push") {
      let body;
      try { body = await request.json(); } catch { return json({ ok: false, error: "invalid_json" }, 400); }
      return pushLineText(body?.task_id, body?.text, env);
    }
    if (request.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
    let payload;
    try { payload = await request.json(); } catch { return json({ ok: true }); }
    for (const event of Array.isArray(payload.events) ? payload.events : []) {
      if (event?.type !== "message" || event?.message?.type !== "text" || typeof event.replyToken !== "string") continue;
      try {
        const result = await writeInboxTask(event, env, request);
        if (!result.duplicate) {
          if (result.task.wake_status !== "scheduled") {
            console.log("monitor_wake_skipped", { reason: result.task.wake_skip_reason || "wake_not_scheduled" });
          } else {
            wakeMonitorSoon(result.task, env, ctx, request);
          }
          await replyToLine(event, env, result.task);
        }
      } catch (error) {
        console.error("inbox_task_failed", { status: "error", summary: error instanceof Error ? error.message : String(error) });
      }
    }
    return json({ ok: true });
  },
};
