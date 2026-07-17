const LINE_REPLY_API_URL = "https://api.line.me/v2/bot/message/reply";
const QUICK_ACK_REPLY = "我收到訊息了，馬上幫你處理 ✨";
const QUICK_QUESTION_ACK_REPLY = "我收到問題了，馬上幫你查一下 ✨";
const LONG_TASK_REPLY = "我收到任務了，正在處理中 🛠️\n\n任務編號：{display_task_id}\n\n完成後我會再通知你。";
const PROJECT = "菲比 LINE 智能助理_02";
const WORKER_NAME = "pline-v2-0-test-line-gateway-r2c3b";
const WORKER_VERSION = "V3.4.2";
const DEFAULT_ENVIRONMENT = "test";
const DEFAULT_TASK_NAMESPACE = "default";
const PENDING_QUEUE_LIMIT = 200;
const EXECUTOR_OFFLINE_AFTER_MS = 600_000;
const OPERATION_FINGERPRINT_TTL_SECONDS = 5 * 60;
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

async function sha256Hex(text) {
  const bytes = new TextEncoder().encode(String(text));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function shortFingerprint(value) {
  if (!value) return null;
  return (await sha256Hex(value)).slice(0, 12);
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

function sourceUserId(event = {}) {
  return typeof event.source?.userId === "string" ? event.source.userId : "";
}

function sourceType(event = {}) {
  return typeof event.source?.type === "string" ? event.source.type : "unknown";
}

function lineMessageId(event = {}) {
  return typeof event.message?.id === "string" ? event.message.id : "";
}

function isWebhookRedelivery(event = {}) {
  return event.deliveryContext?.isRedelivery === true;
}

function allowlistValues(value = "") {
  return String(value).split(/[,\s]+/u).map((item) => item.trim()).filter(Boolean);
}

function runtimeEnvironment(env = {}) {
  return env.PLINE_ENVIRONMENT || env.CODEX_EXECUTOR_ENVIRONMENT || env.CODEX_ENVIRONMENT || DEFAULT_ENVIRONMENT;
}

function taskNamespace(env = {}) {
  return env.CODEX_TASK_NAMESPACE || env.PLINE_TASK_NAMESPACE || DEFAULT_TASK_NAMESPACE;
}

function scopedRuntimeKey(prefix, env = {}) {
  return `${prefix}:${runtimeEnvironment(env)}:${taskNamespace(env)}`;
}

function pendingQueueKey(env = {}) {
  return env.CODEX_PENDING_QUEUE_KEY || scopedRuntimeKey("queues/pending", env);
}

function executorStatusKey(env = {}) {
  return env.CODEX_EXECUTOR_STATUS_KEY || scopedRuntimeKey("executor-status", env);
}

function projectName(env = {}) {
  return env.PLINE_PROJECT_NAME || PROJECT;
}

function workerName(env = {}) {
  return env.PLINE_WORKER_NAME || WORKER_NAME;
}

export function resolveRole(event = {}, env = {}) {
  const userId = sourceUserId(event);
  const adminIds = allowlistValues(env.PLINE_ADMIN_LINE_USER_IDS || env.ADMIN_LINE_USER_IDS || "");
  const allowedIds = allowlistValues(env.PLINE_ALLOWED_LINE_USER_IDS || env.ALLOWED_LINE_USER_IDS || "");
  if (!userId) return { role: "unknown", authorization_result: "deny_missing_user_id" };
  if (adminIds.includes(userId)) return { role: "admin", authorization_result: "allow_admin" };
  if (allowedIds.includes(userId)) return { role: "allowed_user", authorization_result: "deny_allowed_user_private_disabled" };
  return { role: "guest", authorization_result: "deny_not_in_admin_allowlist" };
}

export function isAuthorizedForPrivateTask(auth = {}) {
  return auth.role === "admin";
}

function unauthorizedReply() {
  return "我目前只接受已授權的管理者使用私人助理功能。這則訊息我不會記錄或處理。";
}

export async function idempotencyKeyForEvent(event = {}, env = {}) {
  const userId = sourceUserId(event) || "unknown-user";
  const messageId = lineMessageId(event);
  const webhookEventId = typeof event.webhookEventId === "string" ? event.webhookEventId : "";
  const runtime = runtimeEnvironment(env);
  const namespace = taskNamespace(env);
  const basis = messageId
    ? `${runtime}:${namespace}:line:${userId}:${messageId}`
    : `${runtime}:${namespace}:line:webhook:${webhookEventId || "unknown-event"}`;
  return {
    idempotency_key: basis,
    idempotency_hash: (await sha256Hex(basis)).slice(0, 32),
    idempotency_basis: messageId ? "environment_channel_source_user_id_line_message_id" : "environment_webhook_event_id",
  };
}

function taskIdFromIdempotency(idempotencyHash) {
  return `task-${idempotencyHash}`;
}

function normalizeText(text = "") {
  return String(text).trim().replace(/\s+/g, " ").toLowerCase();
}

export function operationFingerprintParts(text = "") {
  const normalized = normalizeText(text);
  let operation = null;
  let target = normalized;
  if (/^(記一下|幫我記下|幫我記|記下|新增想法|保存想法|備忘)/.test(normalized)) {
    operation = "idea_save";
    target = normalized.replace(/^(記一下|幫我記下|幫我記|記下|新增想法|保存想法|備忘)[，,：:\\s]*/u, "").trim();
  } else if (/^(刪除|移除)/.test(normalized)) {
    operation = "idea_delete";
  } else if (/^(修改|更改|改成|更新)/.test(normalized)) {
    operation = "idea_update";
  } else if (/(部署|發送|寫入|建立檔案|修改檔案|刪除檔案)/.test(normalized)) {
    operation = "side_effect";
  }
  return operation ? { operation, target: target || normalized } : null;
}

export async function operationFingerprintForTask(event = {}, env = {}) {
  const parts = operationFingerprintParts(event.message?.text || "");
  if (!parts) return null;
  const userId = sourceUserId(event) || "unknown-user";
  const basis = `${runtimeEnvironment(env)}:${taskNamespace(env)}:line:${userId}:${parts.operation}:${parts.target}`;
  return {
    ...parts,
    operation_fingerprint: (await sha256Hex(basis)).slice(0, 32),
  };
}

function executorOfflineAfterMs(env = {}) {
  const value = Number(env.CODEX_EXECUTOR_OFFLINE_AFTER_MS || EXECUTOR_OFFLINE_AFTER_MS);
  return Number.isFinite(value) && value > 0 ? value : EXECUTOR_OFFLINE_AFTER_MS;
}

function parseExecutorStatus(raw, checkedAtMs = Date.now(), offlineAfterMs = EXECUTOR_OFFLINE_AFTER_MS) {
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
  const stale = ageMs === null || ageMs > offlineAfterMs;
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
  const offlineAfterMs = executorOfflineAfterMs(env);
  if (!env.CODEX_INBOX) return parseExecutorStatus(null, checkedAtMs, offlineAfterMs);
  try {
    const raw = await env.CODEX_INBOX.get(executorStatusKey(env), "json");
    return parseExecutorStatus(raw, checkedAtMs, offlineAfterMs);
  } catch (error) {
    console.error("executor_status_read_failed", { summary: error instanceof Error ? error.message : String(error) });
    return { ...parseExecutorStatus(null, checkedAtMs, offlineAfterMs), read_error: true };
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

async function enqueuePendingTask(env = {}, pendingKey) {
  if (!env.CODEX_INBOX || !pendingKey) return null;
  let queuedKeys = [];
  const queueKey = pendingQueueKey(env);
  const raw = await env.CODEX_INBOX.get(queueKey, "json").catch(() => null);
  if (Array.isArray(raw)) queuedKeys = raw;
  else if (Array.isArray(raw?.keys)) queuedKeys = raw.keys;
  queuedKeys = queuedKeys.filter((key) => typeof key === "string" && key !== pendingKey);
  queuedKeys.push(pendingKey);
  if (queuedKeys.length > PENDING_QUEUE_LIMIT) queuedKeys = queuedKeys.slice(-PENDING_QUEUE_LIMIT);
  const payload = {
    keys: queuedKeys,
    updated_at: taipeiNow(),
    environment: runtimeEnvironment(env),
    task_namespace: taskNamespace(env),
  };
  await env.CODEX_INBOX.put(queueKey, JSON.stringify(payload));
  return payload;
}

async function removePendingTaskFromQueue(env = {}, pendingKey) {
  if (!env.CODEX_INBOX || !pendingKey) return null;
  const queueKey = pendingQueueKey(env);
  const raw = await env.CODEX_INBOX.get(queueKey, "json").catch(() => null);
  const keys = Array.isArray(raw) ? raw : Array.isArray(raw?.keys) ? raw.keys : null;
  if (!keys) return null;
  const queuedKeys = keys.filter((key) => typeof key === "string" && key !== pendingKey);
  if (queuedKeys.length === keys.length) return raw;
  const payload = {
    keys: queuedKeys,
    updated_at: taipeiNow(),
    environment: runtimeEnvironment(env),
    task_namespace: taskNamespace(env),
  };
  await env.CODEX_INBOX.put(queueKey, JSON.stringify(payload));
  return payload;
}

export async function writeInboxTask(event, env, request = null) {
  const lineEventId = typeof event.webhookEventId === "string" && event.webhookEventId
    ? event.webhookEventId
    : typeof event.replyToken === "string" ? event.replyToken : `event-${Date.now()}`;
  const idempotency = await idempotencyKeyForEvent(event, env);
  const id = taskIdFromIdempotency(idempotency.idempotency_hash) || taskId(event, lineEventId);
  const mode = executionMode(event.message.text);
  const displayId = displayTaskId();
  const createdAt = taipeiNow();
  const auth = resolveRole(event, env);
  const executorStatus = await readExecutorStatus(env);
  const queuedWhileOffline = !executorStatus.online;
  const plannedWake = wakePlan(env, request, queuedWhileOffline, createdAt);
  const key = `pending/${id}.json`;
  const seenKey = `events/${idempotency.idempotency_hash}`;
  const idempotencyIndexKey = `idempotency/${idempotency.idempotency_hash}`;
  if (!env.CODEX_INBOX) throw new Error("CODEX_INBOX binding is missing");
  const existingIdempotency = await env.CODEX_INBOX.get(idempotencyIndexKey, "json").catch(() => null);
  if (existingIdempotency) {
    const duplicateTaskId = existingIdempotency.task_id || id;
    const duplicatePendingKey = `pending/${duplicateTaskId}.json`;
    const existingPending = await env.CODEX_INBOX.get(duplicatePendingKey, "json").catch(() => null);
    if (existingPending) await enqueuePendingTask(env, duplicatePendingKey);
    return {
      duplicate: true,
      duplicate_task_id: duplicateTaskId,
      duplicate_status: existingIdempotency.status || existingPending?.status || "unknown",
      webhook_redelivery: isWebhookRedelivery(event),
      ack_user_message: "我剛剛已經收到這則訊息了，會以同一筆任務接著處理，不會重複建立。",
    };
  }
  const operation = await operationFingerprintForTask(event, env);
  const operationKey = operation ? `operation-fingerprints/${operation.operation_fingerprint}` : null;
  const userId = sourceUserId(event);
  const duplicateOperation = operationKey && env.CODEX_INBOX
    ? await env.CODEX_INBOX.get(operationKey, "json").catch(() => null)
    : null;
  if (duplicateOperation) {
    await env.CODEX_INBOX.put(seenKey, id);
    await env.CODEX_INBOX.put(idempotencyIndexKey, JSON.stringify({
      task_id: duplicateOperation.task_id || null,
      status: "duplicate_operation_blocked",
      created_at: createdAt,
    }));
    return {
      duplicate: true,
      duplicate_operation: true,
      duplicate_task_id: duplicateOperation.task_id || null,
      duplicate_status: duplicateOperation.status || "processing",
      ack_user_message: duplicateOperation.status === "completed"
        ? "我剛剛已經記過同一個內容了，這次不會再重複新增。"
        : "我剛剛已經收到同一個內容，正在處理中，這次不會再重複新增。",
    };
  }
  const task = {
    task_id: id,
    display_task_id: displayId,
    idempotency_key: idempotency.idempotency_key,
    idempotency_hash: idempotency.idempotency_hash,
    idempotency_basis: idempotency.idempotency_basis,
    operation_fingerprint: operation?.operation_fingerprint || null,
    operation_type: operation?.operation || null,
    operation_target: operation?.target || null,
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
    webhook_event_id: lineEventId,
    line_message_id: lineMessageId(event) || null,
    text: event.message.text,
    original_text: event.message.text,
    ...(userId ? { user_id: userId, source_user_id: userId } : {}),
    source_user_fingerprint: await shortFingerprint(userId),
    source_type: sourceType(event),
    reply_token_fingerprint: await shortFingerprint(event.replyToken || ""),
    environment: runtimeEnvironment(env),
    task_namespace: taskNamespace(env),
    resolved_role: auth.role,
    authorization_result: auth.authorization_result,
    authorization_checked_at: createdAt,
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
    project: projectName(env),
    version: WORKER_VERSION,
  };

  const writtenKeys = [];
  const putTracked = async (writeKey, value, options) => {
    writtenKeys.push(writeKey);
    await env.CODEX_INBOX.put(writeKey, value, options);
  };
  try {
    await putTracked(seenKey, id);
    await putTracked(idempotencyIndexKey, JSON.stringify({ task_id: id, status: "pending", created_at: createdAt }));
    if (operationKey) {
      await putTracked(operationKey, JSON.stringify({
        task_id: id,
        status: "processing",
        operation_type: operation.operation,
        created_at: createdAt,
      }), { expirationTtl: OPERATION_FINGERPRINT_TTL_SECONDS });
    }
    await putTracked(key, JSON.stringify(task));
    await enqueuePendingTask(env, key);
  } catch (error) {
    await Promise.allSettled(writtenKeys.map((writtenKey) => env.CODEX_INBOX.delete(writtenKey)));
    await removePendingTaskFromQueue(env, key).catch(() => null);
    console.error("inbox_task_write_failed_cleaned_up", {
      idempotency_hash: idempotency.idempotency_hash,
      task_id: id,
      summary: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
  return { duplicate: false, task };
}

async function recordAuthEvent(event, env, auth, idempotency) {
  if (!env.CODEX_INBOX) return;
  const checkedAt = taipeiNow();
  const userId = sourceUserId(event);
  await env.CODEX_INBOX.put(`auth-events/${idempotency.idempotency_hash}`, JSON.stringify({
    environment: runtimeEnvironment(env),
    task_namespace: taskNamespace(env),
    channel: "line",
    source_user_id: userId || null,
    source_user_fingerprint: await shortFingerprint(userId),
    source_type: sourceType(event),
    line_event_id: typeof event.webhookEventId === "string" ? event.webhookEventId : null,
    line_message_id: lineMessageId(event) || null,
    idempotency_hash: idempotency.idempotency_hash,
    resolved_role: auth.role,
    authorization_result: auth.authorization_result,
    authorization_checked_at: checkedAt,
  }), { expirationTtl: 60 * 60 * 24 * 30 });
}

async function replyToLine(event, env, taskOrText) {
  if (!env.LINE_CHANNEL_ACCESS_TOKEN) throw new Error("LINE_CHANNEL_ACCESS_TOKEN binding is missing");
  const text = typeof taskOrText === "string"
    ? taskOrText
    : taskOrText?.ack_user_message || ackUserMessage(event.message.text, taskOrText?.execution_mode, taskOrText?.display_task_id);
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
        project: projectName(env),
        environment: runtimeEnvironment(env),
        task_namespace: taskNamespace(env),
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

function taskCreationFailedReply() {
  return "我目前暫時無法把這則訊息排進處理佇列，這次還沒有開始處理。請你稍後再傳一次。";
}

async function pushLineText(taskId, text, env, pushType = "final") {
  const task = taskId && env.CODEX_INBOX
    ? (await env.CODEX_INBOX.get(`completed/${taskId}.json`, "json"))
      || (await env.CODEX_INBOX.get(`processing/${taskId}.json`, "json"))
      || (await env.CODEX_INBOX.get(`failed/${taskId}.json`, "json"))
    : null;
  if (!task?.user_id || typeof text !== "string" || !text.trim()) return json({ ok: false, error: "missing_task_target" }, 400);
  if (!env.LINE_CHANNEL_ACCESS_TOKEN) return json({ ok: false, error: "missing_runtime_binding" }, 500);
  const pushBasis = task.idempotency_hash || task.task_id || taskId;
  const pushKey = `push-idempotency/${pushType}/${pushBasis}`;
  const existingPush = pushType === "final" ? await env.CODEX_INBOX.get(pushKey, "json").catch(() => null) : null;
  if (existingPush?.status === "sent") return json({ ok: true, duplicate: true, status: existingPush.http_status || 200 });
  const response = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: { authorization: `Bearer ${env.LINE_CHANNEL_ACCESS_TOKEN}`, "content-type": "application/json" },
    body: JSON.stringify({ to: task.user_id, messages: [{ type: "text", text }] }),
  });
  if (pushType === "final" && response.ok) {
    await env.CODEX_INBOX.put(pushKey, JSON.stringify({
      task_id: task.task_id || taskId,
      idempotency_hash: task.idempotency_hash || null,
      status: "sent",
      http_status: response.status,
      pushed_at: taipeiNow(),
    }), { expirationTtl: 60 * 60 * 24 * 30 });
  }
  return json({ ok: response.ok, status: response.status });
}

export default {
  async fetch(request, env, ctx) {
    if (request.method === "GET") {
      return json({
        ok: true,
        worker: workerName(env),
        version: WORKER_VERSION,
        environment: runtimeEnvironment(env),
        task_namespace: taskNamespace(env),
      });
    }
    if (request.method === "POST" && new URL(request.url).pathname === "/internal/final-push") {
      let body;
      try { body = await request.json(); } catch { return json({ ok: false, error: "invalid_json" }, 400); }
      return pushLineText(body?.task_id, body?.text, env, "final");
    }
    if (request.method === "POST" && new URL(request.url).pathname === "/internal/progress-push") {
      let body;
      try { body = await request.json(); } catch { return json({ ok: false, error: "invalid_json" }, 400); }
      return pushLineText(body?.task_id, body?.text, env, "progress");
    }
    if (request.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
    let payload;
    try { payload = await request.json(); } catch { return json({ ok: true }); }
    for (const event of Array.isArray(payload.events) ? payload.events : []) {
      if (event?.type !== "message" || event?.message?.type !== "text" || typeof event.replyToken !== "string") continue;
      try {
        const idempotency = await idempotencyKeyForEvent(event, env);
        const auth = resolveRole(event, env);
        if (!isAuthorizedForPrivateTask(auth)) {
          const existingAuthEvent = env.CODEX_INBOX
            ? await env.CODEX_INBOX.get(`auth-events/${idempotency.idempotency_hash}`, "json").catch(() => null)
            : null;
          if (existingAuthEvent) continue;
          await recordAuthEvent(event, env, auth, idempotency);
          await replyToLine(event, env, unauthorizedReply());
          continue;
        }
        const result = await writeInboxTask(event, env, request);
        if (result.duplicate_operation && result.ack_user_message) {
          await replyToLine(event, env, result.ack_user_message);
        } else if (result.duplicate && result.ack_user_message && !result.webhook_redelivery) {
          await replyToLine(event, env, result.ack_user_message);
        } else if (!result.duplicate) {
          if (result.task.wake_status !== "scheduled") {
            console.log("monitor_wake_skipped", { reason: result.task.wake_skip_reason || "wake_not_scheduled" });
          } else {
            wakeMonitorSoon(result.task, env, ctx, request);
          }
          await replyToLine(event, env, result.task);
        }
      } catch (error) {
        console.error("inbox_task_failed", { status: "error", summary: error instanceof Error ? error.message : String(error) });
        await replyToLine(event, env, taskCreationFailedReply()).catch((replyError) => {
          console.error("line_reply_failed_after_inbox_error", { status: "error", summary: replyError instanceof Error ? replyError.message : String(replyError) });
        });
      }
    }
    return json({ ok: true });
  },
};
