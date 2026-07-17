const LINE_REPLY_API_URL = "https://api.line.me/v2/bot/message/reply";
const QUICK_ACK_REPLY = "我收到訊息了，馬上幫你處理 ✨";
const QUICK_QUESTION_ACK_REPLY = "我收到問題了，馬上幫你查一下 ✨";
const LONG_TASK_REPLY = "我收到任務了，正在處理中 🛠️\n\n任務編號：{display_task_id}\n\n完成後我會再通知你。";
const PROJECT = "菲比 LINE 智能助理_02";
const WORKER_NAME = "pline-v2-0-test-line-gateway-r2c3b";
const WORKER_VERSION = "V3.4.10";
const DEFAULT_ENVIRONMENT = "test";
const DEFAULT_TASK_NAMESPACE = "default";
const PENDING_QUEUE_LIMIT = 200;
const EXECUTOR_OFFLINE_AFTER_MS = 600_000;
const OPERATION_FINGERPRINT_TTL_SECONDS = 5 * 60;
const N8N_AGENT_ACK_TIMEOUT_MS = 5_000;
const N8N_AGENT_WEBHOOK_TIMEOUT_MS = 25_000;
const N8N_AGENT_PIPELINE_TIMEOUT_MS = 35_000;
const LINE_PUSH_TIMEOUT_MS = 10_000;
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

function truthy(value) {
  return /^(1|true|yes|on)$/i.test(String(value || "").trim());
}

function boundedPositiveInteger(value, fallback, minimum, maximum) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.trunc(parsed), minimum), maximum);
}

function n8nAgentAckTimeoutMs(env = {}) {
  return boundedPositiveInteger(env.PLINE_N8N_AGENT_ACK_TIMEOUT_MS, N8N_AGENT_ACK_TIMEOUT_MS, 1_000, 15_000);
}

function n8nAgentWebhookTimeoutMs(env = {}) {
  return boundedPositiveInteger(env.PLINE_N8N_AGENT_WEBHOOK_TIMEOUT_MS, N8N_AGENT_WEBHOOK_TIMEOUT_MS, 1_000, 60_000);
}

function n8nAgentPipelineTimeoutMs(env = {}) {
  return boundedPositiveInteger(env.PLINE_N8N_AGENT_PIPELINE_TIMEOUT_MS, N8N_AGENT_PIPELINE_TIMEOUT_MS, 5_000, 70_000);
}

function linePushTimeoutMs(env = {}) {
  return boundedPositiveInteger(env.PLINE_LINE_PUSH_TIMEOUT_MS, LINE_PUSH_TIMEOUT_MS, 1_000, 30_000);
}

async function fetchWithTimeout(url, init = {}, timeoutMs = 0, label = "fetch") {
  if (!timeoutMs || timeoutMs <= 0) return fetch(url, init);
  const controller = new AbortController();
  let timeoutId;
  let didTimeout = false;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      didTimeout = true;
      controller.abort();
      reject(new Error(`${label}_timeout_after_${timeoutMs}ms`));
    }, timeoutMs);
  });
  try {
    return await Promise.race([fetch(url, { ...init, signal: controller.signal }), timeout]);
  } catch (error) {
    if (didTimeout || controller.signal.aborted) throw new Error(`${label}_timeout_after_${timeoutMs}ms`);
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function withTimeout(operation, timeoutMs = 0, label = "operation") {
  if (!timeoutMs || timeoutMs <= 0) return operation();
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`${label}_timeout_after_${timeoutMs}ms`)), timeoutMs);
  });
  try {
    return await Promise.race([Promise.resolve().then(operation), timeout]);
  } finally {
    clearTimeout(timeoutId);
  }
}

function n8nAgentEnabled(env = {}) {
  return runtimeEnvironment(env) === "test" && truthy(env.PLINE_N8N_AGENT_ENABLED);
}

function n8nAgentWebhookUrl(env = {}) {
  return String(env.PLINE_N8N_AGENT_WEBHOOK_URL || env.N8N_AGENT_WEBHOOK_URL || "").trim();
}

function periodOrSummaryRequest(text = "") {
  return /(?:本月|這個月|當月|本年|今年|今天|今日|昨天|明天|上週|本週|這週|統計|摘要|總結|報表|列表|列出|查看|查詢|搜尋|幾筆|多少)/i.test(text);
}

function codexOnlyRequest(text = "") {
  return executionMode(text) === "long"
    || /(?:附件|檔案|本機|專案|Git|git|commit|push|部署|Worker|n8n|分析|整理|修改檔案|建立檔案|刪除檔案)/.test(text);
}

function singleAccountingRecord(text = "") {
  return /(?:帳務|記帳|支出|收入|花費|消費|付款|元)/.test(text)
    && /\d+(?:\.\d+)?\s*元/.test(text)
    && !periodOrSummaryRequest(text)
    && !codexOnlyRequest(text);
}

function n8nAgentRouteCategory(event = {}, env = {}) {
  if (!n8nAgentEnabled(env)) return null;
  const text = String(event.message?.text || "").trim();
  if (!text || codexOnlyRequest(text) || periodOrSummaryRequest(text)) return null;
  if (singleAccountingRecord(text)) return "accounting_single_record";
  const operation = operationFingerprintParts(text);
  if (operation && ["idea_save", "idea_update", "idea_delete"].includes(operation.operation)) return `idea_${operation.operation.replace("idea_", "")}`;
  if (/^(新增|建立|安排|幫我排|記一下|提醒).*(?:日曆|行程|會議|約|提醒)/.test(text)) return "calendar_single_record";
  return null;
}

export function routeDecisionForEvent(event = {}, env = {}) {
  const category = n8nAgentRouteCategory(event, env);
  if (!category) return { executor: "codex", category: null, reason: n8nAgentEnabled(env) ? "codex_required" : "n8n_agent_disabled" };
  return { executor: "n8n_agent", category, reason: "test_n8n_agent_route" };
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
  if (!queuedKeys.length) {
    await env.CODEX_INBOX.delete(queueKey);
    return {
      keys: [],
      updated_at: taipeiNow(),
      environment: runtimeEnvironment(env),
      task_namespace: taskNamespace(env),
    };
  }
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
    await putTracked(key, JSON.stringify(task));
    await enqueuePendingTask(env, key);
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

export async function writeN8nAgentTask(event, env, request = null) {
  const route = routeDecisionForEvent(event, env);
  if (route.executor !== "n8n_agent") return writeInboxTask(event, env, request);
  const webhookUrl = n8nAgentWebhookUrl(env);
  if (!webhookUrl) throw new Error("PLINE_N8N_AGENT_WEBHOOK_URL is missing");
  const lineEventId = typeof event.webhookEventId === "string" && event.webhookEventId
    ? event.webhookEventId
    : typeof event.replyToken === "string" ? event.replyToken : `event-${Date.now()}`;
  const idempotency = await idempotencyKeyForEvent(event, env);
  const id = taskIdFromIdempotency(idempotency.idempotency_hash) || taskId(event, lineEventId);
  const displayId = displayTaskId();
  const createdAt = taipeiNow();
  const dispatchStartedAt = createdAt;
  const auth = resolveRole(event, env);
  const key = `processing/${id}.json`;
  const seenKey = `events/${idempotency.idempotency_hash}`;
  const idempotencyIndexKey = `idempotency/${idempotency.idempotency_hash}`;
  if (!env.CODEX_INBOX) throw new Error("CODEX_INBOX binding is missing");
  const existingIdempotency = await env.CODEX_INBOX.get(idempotencyIndexKey, "json").catch(() => null);
  if (existingIdempotency) {
    return {
      duplicate: true,
      duplicate_task_id: existingIdempotency.task_id || id,
      duplicate_status: existingIdempotency.status || "unknown",
      webhook_redelivery: isWebhookRedelivery(event),
      ack_user_message: "我剛剛已經收到這則訊息了，會以同一筆任務接著處理，不會重複建立。",
    };
  }
  const operation = await operationFingerprintForTask(event, env);
  const routedOperationType = route.category?.startsWith("idea_")
    ? operation?.operation || route.category
    : route.category;
  const userId = sourceUserId(event);
  const task = {
    task_id: id,
    display_task_id: displayId,
    idempotency_key: idempotency.idempotency_key,
    idempotency_hash: idempotency.idempotency_hash,
    idempotency_basis: idempotency.idempotency_basis,
    operation_fingerprint: operation?.operation_fingerprint || null,
    operation_type: routedOperationType,
    operation_target: operation?.target || event.message.text,
    execution_mode: "quick",
    executor_type: "n8n_agent",
    route_category: route.category,
    route_reason: route.reason,
    ack_user_message: QUICK_ACK_REPLY,
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
    status: "processing",
    received_at: createdAt,
    task_created_at: createdAt,
    gateway_ack_at: null,
    n8n_dispatch_started_at: dispatchStartedAt,
    attempts: 1,
    claimed_at: createdAt,
    claimed_by: "n8n_agent",
    project: projectName(env),
    version: WORKER_VERSION,
  };
  const writtenKeys = [];
  const putTracked = async (writeKey, value, options) => {
    writtenKeys.push(writeKey);
    await env.CODEX_INBOX.put(writeKey, value, options);
  };
  try {
    await putTracked(`executions/${idempotency.idempotency_hash}`, JSON.stringify({
      task_id: id,
      idempotency_hash: idempotency.idempotency_hash,
      status: "processing",
      executor_type: "n8n_agent",
      started_at: createdAt,
      dispatch_started_at: dispatchStartedAt,
      phase: "created",
    }));
    await putTracked(key, JSON.stringify(task));
    await putTracked(seenKey, id);
    await putTracked(idempotencyIndexKey, JSON.stringify({ task_id: id, status: "processing", executor_type: "n8n_agent", created_at: createdAt }));
  } catch (error) {
    await Promise.allSettled(writtenKeys.map((writtenKey) => env.CODEX_INBOX.delete(writtenKey)));
    console.error("n8n_agent_task_write_failed_cleaned_up", {
      idempotency_hash: idempotency.idempotency_hash,
      task_id: id,
      summary: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
  return { duplicate: false, n8n_agent: true, task, webhook_url: webhookUrl };
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

async function replyToLine(event, env, taskOrText, options = {}) {
  if (!env.LINE_CHANNEL_ACCESS_TOKEN) throw new Error("LINE_CHANNEL_ACCESS_TOKEN binding is missing");
  const text = typeof taskOrText === "string"
    ? taskOrText
    : taskOrText?.ack_user_message || ackUserMessage(event.message.text, taskOrText?.execution_mode, taskOrText?.display_task_id);
  const response = await fetchWithTimeout(LINE_REPLY_API_URL, {
    method: "POST",
    headers: { authorization: `Bearer ${env.LINE_CHANNEL_ACCESS_TOKEN}`, "content-type": "application/json" },
    body: JSON.stringify({ replyToken: event.replyToken, messages: [{ type: "text", text }] }),
  }, options.timeoutMs || 0, options.timeoutLabel || "line_reply");
  if (!response.ok) console.error("line_reply_failed", { status: response.status });
  return { ok: response.ok, status: response.status, sent_at: taipeiNow() };
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

function hasWaitUntil(ctx) {
  return typeof ctx?.waitUntil === "function";
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
  const response = await fetchWithTimeout("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: { authorization: `Bearer ${env.LINE_CHANNEL_ACCESS_TOKEN}`, "content-type": "application/json" },
    body: JSON.stringify({ to: task.user_id, messages: [{ type: "text", text }] }),
  }, linePushTimeoutMs(env), "line_push");
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

function n8nFinalMessage(responseBody) {
  if (!responseBody || typeof responseBody !== "object") return "";
  for (const key of ["final_user_message", "replyText", "reply_text", "message", "text"]) {
    const value = responseBody[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

async function dispatchN8nAgentTask(task, env = {}, webhookUrl = "") {
  if (!env.CODEX_INBOX) return;
  const processingKey = `processing/${task.task_id}.json`;
  const completedKey = `completed/${task.task_id}.json`;
  const failedKey = `failed/${task.task_id}.json`;
  const executionKey = `executions/${task.idempotency_hash || task.task_id}`;
  const dispatchStartedAt = task.n8n_dispatch_started_at || taipeiNow();
  task.n8n_dispatch_started_at = dispatchStartedAt;
  try {
    const fetchStartedAt = taipeiNow();
    await markN8nAgentPhase(task, env, "n8n_fetch_started", {
      n8n_fetch_started_at: fetchStartedAt,
      n8n_http_status: null,
      n8n_response_has_final: false,
    });
    const response = await fetchWithTimeout(webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        task_id: task.task_id,
        idempotency_hash: task.idempotency_hash,
        route_category: task.route_category,
        text: task.original_text,
        line_event_id: task.line_event_id,
        line_message_id: task.line_message_id,
        source_user_id: task.source_user_id || task.user_id || null,
        source_user_fingerprint: task.source_user_fingerprint || null,
        environment: task.environment,
        task_namespace: task.task_namespace,
      }),
    }, n8nAgentWebhookTimeoutMs(env), "n8n_agent_webhook");
    const responseText = await response.text();
    let responseBody = null;
    try { responseBody = responseText ? JSON.parse(responseText) : null; } catch { responseBody = null; }
    const finalMessage = response.ok ? n8nFinalMessage(responseBody) : "";
    const completedAt = taipeiNow();
    const completed = response.ok && Boolean(finalMessage);
    task.status = completed ? "completed" : "failed";
    task.completed_at = completed ? completedAt : null;
    task.failed_at = completed ? null : completedAt;
    task.n8n_http_status = response.status;
    task.n8n_response_has_final = Boolean(finalMessage);
    task.n8n_fetch_completed_at = completedAt;
    task.result_status = completed ? "completed" : "failed";
    task.technical_summary = completed
      ? `Routed to n8n_agent. category=${task.route_category}; http_status=${response.status}; final_message=${finalMessage ? "returned" : "not_returned"}.`
      : `n8n_agent route failed or did not return final message. category=${task.route_category}; http_status=${response.status}; final_message=${finalMessage ? "returned" : "not_returned"}.`;
    if (finalMessage) {
      task.final_user_message = finalMessage.slice(0, 5_000);
      const push = await pushLineText(task.task_id, task.final_user_message, env, "final");
      const pushBody = await push.json().catch(() => ({}));
      task.final_push_status = pushBody.ok ? "sent" : "failed";
      task.final_push_http_status = pushBody.status || push.status;
      task.final_push_at = taipeiNow();
      task.final_push_idempotency_key = `final/${task.idempotency_hash || task.task_id}`;
    } else {
      task.final_push_status = "not_returned_by_n8n";
      task.final_push_http_status = null;
    }
    await env.CODEX_INBOX.put(completed ? completedKey : failedKey, JSON.stringify(task));
    await env.CODEX_INBOX.delete(processingKey).catch(() => {});
    await env.CODEX_INBOX.put(executionKey, JSON.stringify({
      task_id: task.task_id,
      idempotency_hash: task.idempotency_hash || null,
      status: task.status,
      executor_type: "n8n_agent",
      updated_at: completedAt,
      phase: completed ? "completed" : "failed",
      dispatch_started_at: task.n8n_dispatch_started_at || null,
      ack_started_at: task.ack_started_at || null,
      gateway_ack_at: task.gateway_ack_at || null,
      n8n_fetch_started_at: task.n8n_fetch_started_at || null,
      n8n_fetch_completed_at: task.n8n_fetch_completed_at || null,
      n8n_http_status: response.status,
      n8n_response_has_final: Boolean(finalMessage),
    }));
    await env.CODEX_INBOX.put(`idempotency/${task.idempotency_hash}`, JSON.stringify({
      task_id: task.task_id,
      status: task.status,
      executor_type: "n8n_agent",
      updated_at: completedAt,
    }));
  } catch (error) {
    const failedAt = taipeiNow();
    task.status = "failed";
    task.failed_at = failedAt;
    task.result_status = "failed";
    task.error_summary = String(error?.message || error).slice(0, 500);
    task.n8n_error = task.error_summary;
    task.n8n_http_status = null;
    task.n8n_response_has_final = false;
    task.final_push_status = "dispatch_failed";
    await env.CODEX_INBOX.put(failedKey, JSON.stringify(task)).catch(() => {});
    await env.CODEX_INBOX.delete(processingKey).catch(() => {});
    await env.CODEX_INBOX.put(executionKey, JSON.stringify({
      task_id: task.task_id,
      idempotency_hash: task.idempotency_hash || null,
      status: "failed",
      executor_type: "n8n_agent",
      updated_at: failedAt,
      phase: "failed",
      dispatch_started_at: task.n8n_dispatch_started_at || null,
      ack_started_at: task.ack_started_at || null,
      gateway_ack_at: task.gateway_ack_at || null,
      n8n_fetch_started_at: task.n8n_fetch_started_at || null,
      error_summary: task.error_summary,
    })).catch(() => {});
    await env.CODEX_INBOX.put(`idempotency/${task.idempotency_hash}`, JSON.stringify({
      task_id: task.task_id,
      status: "failed",
      executor_type: "n8n_agent",
      updated_at: failedAt,
    })).catch(() => {});
  }
}

async function markN8nAgentTaskFailed(task, env = {}, error, stage = "n8n_agent_failed") {
  if (!env.CODEX_INBOX || !task?.task_id) return;
  const failedAt = taipeiNow();
  const processingKey = `processing/${task.task_id}.json`;
  const failedKey = `failed/${task.task_id}.json`;
  const executionKey = `executions/${task.idempotency_hash || task.task_id}`;
  const summary = String(error?.message || error || stage).slice(0, 500);
  task.status = "failed";
  task.failed_at = failedAt;
  task.result_status = "failed";
  task.error_stage = stage;
  task.error_summary = summary;
  task.n8n_error = summary;
  task.n8n_pipeline_phase = "failed";
  if (!task.gateway_ack_at) task.ack_failed_at = failedAt;
  if (task.n8n_http_status === undefined) task.n8n_http_status = null;
  if (task.n8n_response_has_final === undefined) task.n8n_response_has_final = false;
  if (!task.final_push_status) task.final_push_status = "not_sent_due_to_error";
  await env.CODEX_INBOX.put(failedKey, JSON.stringify(task)).catch(() => {});
  await env.CODEX_INBOX.delete(processingKey).catch(() => {});
  await env.CODEX_INBOX.put(executionKey, JSON.stringify({
    task_id: task.task_id,
    idempotency_hash: task.idempotency_hash || null,
    status: "failed",
    executor_type: "n8n_agent",
    updated_at: failedAt,
    phase: "failed",
    dispatch_started_at: task.n8n_dispatch_started_at || null,
    ack_started_at: task.ack_started_at || null,
    ack_failed_at: task.ack_failed_at || null,
    gateway_ack_at: task.gateway_ack_at || null,
    n8n_fetch_started_at: task.n8n_fetch_started_at || null,
    n8n_http_status: task.n8n_http_status ?? null,
    error_stage: stage,
    error_summary: summary,
  })).catch(() => {});
  if (task.idempotency_hash) {
    await env.CODEX_INBOX.put(`idempotency/${task.idempotency_hash}`, JSON.stringify({
      task_id: task.task_id,
      status: "failed",
      executor_type: "n8n_agent",
      updated_at: failedAt,
      error_stage: stage,
    })).catch(() => {});
  }
}

async function markN8nAgentPhase(task, env = {}, phase = "processing", fields = {}) {
  if (!env.CODEX_INBOX || !task?.task_id) return;
  const dispatchStartedAt = task.n8n_dispatch_started_at || taipeiNow();
  const processingKey = `processing/${task.task_id}.json`;
  const executionKey = `executions/${task.idempotency_hash || task.task_id}`;
  task.n8n_dispatch_started_at = dispatchStartedAt;
  task.n8n_pipeline_phase = phase;
  Object.assign(task, fields);
  await env.CODEX_INBOX.put(processingKey, JSON.stringify(task));
  await env.CODEX_INBOX.put(executionKey, JSON.stringify({
    task_id: task.task_id,
    idempotency_hash: task.idempotency_hash || null,
    status: "processing",
    executor_type: "n8n_agent",
    started_at: dispatchStartedAt,
    dispatch_started_at: dispatchStartedAt,
    phase,
    pipeline_scheduled_at: task.pipeline_scheduled_at || null,
    pipeline_started_at: task.pipeline_started_at || null,
    ack_started_at: task.ack_started_at || null,
    gateway_ack_at: task.gateway_ack_at || null,
    n8n_fetch_started_at: task.n8n_fetch_started_at || null,
    n8n_http_status: task.n8n_http_status ?? null,
  }));
}

async function runN8nAgentPipeline(event, result, env = {}) {
  let ackSent = false;
  try {
    await withTimeout(async () => {
      const pipelineStartedAt = taipeiNow();
      await markN8nAgentPhase(result.task, env, "pipeline_started", { pipeline_started_at: pipelineStartedAt });
      const ackStartedAt = taipeiNow();
      await markN8nAgentPhase(result.task, env, "ack_started", { ack_started_at: ackStartedAt });
      const ack = await replyToLine(event, env, result.task, {
        timeoutMs: n8nAgentAckTimeoutMs(env),
        timeoutLabel: "line_ack",
      });
      if (!ack.ok) throw new Error(`line_ack_failed_status_${ack.status}`);
      ackSent = true;
      result.task.gateway_ack_at = ack.sent_at;
      result.task.ack_http_status = ack.status;
      await markN8nAgentPhase(result.task, env, "ack_sent", {
        gateway_ack_at: ack.sent_at,
        ack_http_status: ack.status,
      });
      await dispatchN8nAgentTask(result.task, env, result.webhook_url);
    }, n8nAgentPipelineTimeoutMs(env), "n8n_agent_pipeline");
  } catch (n8nError) {
    await markN8nAgentTaskFailed(result.task, env, n8nError, ackSent ? "n8n_agent_after_ack" : "n8n_agent_before_ack");
    console.error("n8n_agent_task_failed", {
      stage: ackSent ? "n8n_agent_after_ack" : "n8n_agent_before_ack",
      task_id: result.task.task_id,
      summary: n8nError instanceof Error ? n8nError.message : String(n8nError),
    });
  }
}

async function scheduleN8nAgentPipeline(event, result, env = {}, ctx) {
  const scheduledAt = taipeiNow();
  await markN8nAgentPhase(result.task, env, "pipeline_scheduled", { pipeline_scheduled_at: scheduledAt });
  if (hasWaitUntil(ctx)) {
    try {
      ctx.waitUntil(runN8nAgentPipeline(event, result, env));
      return { scheduled: true, mode: "wait_until", scheduled_at: scheduledAt };
    } catch (error) {
      await markN8nAgentTaskFailed(result.task, env, error, "n8n_agent_schedule_failed");
      return { scheduled: false, mode: "wait_until_failed", scheduled_at: scheduledAt };
    }
  }
  await runN8nAgentPipeline(event, result, env);
  return { scheduled: false, mode: "awaited_no_wait_until", scheduled_at: scheduledAt };
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
        const result = routeDecisionForEvent(event, env).executor === "n8n_agent"
          ? await writeN8nAgentTask(event, env, request)
          : await writeInboxTask(event, env, request);
        if (result.duplicate_operation && result.ack_user_message) {
          await replyToLine(event, env, result.ack_user_message);
        } else if (result.duplicate && result.ack_user_message && !result.webhook_redelivery) {
          await replyToLine(event, env, result.ack_user_message);
        } else if (result.n8n_agent) {
          await scheduleN8nAgentPipeline(event, result, env, ctx);
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
