import { promises as fs } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { listIdeasForPeriod } from "./idea-tools.js";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
export const INBOX_ROOT = ROOT;
const execFileAsync = promisify(execFile);
const KV_NAMESPACE_ID = process.env.CODEX_INBOX_KV_NAMESPACE_ID || "ba842d5662f94e60bfeb4a85e9f0e36c";
const PROJECT_ROOT = path.resolve(ROOT, "..");
const DROPBOX_DIR = "/Users/phoebe/Library/CloudStorage/Dropbox/codex專案/菲比 LINE 智能助理_02/想法紀錄_TEST";
const DROPBOX_DELETED_DIR = "/Users/phoebe/Library/CloudStorage/Dropbox/codex專案/菲比 LINE 智能助理_02/想法紀錄_TEST_已刪除";
const IDEA_TOOLS = path.join(ROOT, "idea-tools.js");
const FINAL_PUSH_URL = process.env.CODEX_FINAL_PUSH_URL || "https://pline-v2-0-test-line-gateway-r2c3b.phy4175.workers.dev/internal/final-push";
const PROGRESS_PUSH_URL = process.env.CODEX_PROGRESS_PUSH_URL || "https://pline-v2-0-test-line-gateway-r2c3b.phy4175.workers.dev/internal/progress-push";
const WAKE_HOST = process.env.CODEX_WAKE_HOST || "127.0.0.1";
const WAKE_PORT = Number(process.env.CODEX_WAKE_PORT || 8793);
const WAKE_TOKEN = process.env.CODEX_WAKE_TOKEN || "";
const POLL_INTERVAL_MS = 60_000;
const HEARTBEAT_INTERVAL_MS = Number(process.env.CODEX_EXECUTOR_HEARTBEAT_INTERVAL_MS || 20_000);
const EXECUTOR_STATUS_KEY = process.env.CODEX_EXECUTOR_STATUS_KEY || "executor-status:test:default";
const EXECUTOR_ID = process.env.CODEX_EXECUTOR_ID || "home-mac-default";
const EXECUTOR_ENVIRONMENT = process.env.CODEX_EXECUTOR_ENVIRONMENT || "test";
const MONITOR_VERSION = "V3.3";
const MAX_LINE_MESSAGE_LENGTH = 5_000;
const folders = ["pending", "processing", "completed", "failed"];
const now = () => new Date().toISOString();
let localScanLock = false;
let rescanRequested = false;
let triggerScanRunning = false;
let executorRuntimeStatus = "online";
let executorCurrentTaskId = null;
let executorLastHeartbeatAt = null;
let heartbeatInFlight = false;

function isLocalAddress(address = "") {
  return ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(address);
}

function isAuthorizedWake(request) {
  if (!WAKE_TOKEN) return true;
  const bearer = request.headers.authorization?.replace(/^Bearer\s+/i, "");
  return bearer === WAKE_TOKEN || request.headers["x-codex-wake-token"] === WAKE_TOKEN;
}

export async function triggerScan(scan, source = "manual") {
  if (triggerScanRunning || localScanLock) {
    rescanRequested = true;
    return { ok: true, started: false, queued: true, source };
  }
  triggerScanRunning = true;
  let runs = 0;
  try {
    do {
      rescanRequested = false;
      await scan();
      runs += 1;
    } while (rescanRequested);
    return { ok: true, started: true, queued: false, runs, source };
  } finally {
    triggerScanRunning = false;
  }
}

export function createWakeServer(scan) {
  return createServer(async (request, response) => {
    if (!isLocalAddress(request.socket.remoteAddress)) {
      response.writeHead(403, { "content-type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({ ok: false, error: "local_only" }));
      return;
    }
    if (request.method !== "POST" || request.url !== "/wake") {
      response.writeHead(request.url === "/wake" ? 405 : 404, { "content-type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({ ok: false, error: request.url === "/wake" ? "method_not_allowed" : "not_found" }));
      return;
    }
    if (!isAuthorizedWake(request)) {
      response.writeHead(401, { "content-type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({ ok: false, error: "unauthorized" }));
      return;
    }
    const wakeReceivedAt = now();
    request.resume();
    void writeExecutorStatusSafe(executorRuntimeStatus, executorCurrentTaskId, {
      wake_received_at: wakeReceivedAt,
      last_wake_received_at: wakeReceivedAt,
    });
    void triggerScan(scan, "wake").catch((error) => console.error("wake_scan_failed", { summary: error instanceof Error ? error.message : String(error) }));
    response.writeHead(202, { "content-type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ ok: true, accepted: true }));
  });
}

export function startWakeServer(scan) {
  if (process.env.CODEX_WAKE_DISABLED === "1") return null;
  const server = createWakeServer(scan);
  server.listen(WAKE_PORT, WAKE_HOST, () => {
    console.log(`codex inbox wake listening on http://${WAKE_HOST}:${WAKE_PORT}/wake`);
  });
  server.on("error", (error) => {
    console.error("wake_server_failed", { summary: error instanceof Error ? error.message : String(error) });
  });
  return server;
}

function runCodex(args, options) {
  return new Promise((resolve, reject) => {
    const child = spawn("/opt/homebrew/bin/codex", args, {
      cwd: options.cwd,
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        PATH: process.env.PATH || "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin",
        HOME: process.env.HOME || "/Users/phoebe",
        CI: "1",
        TERM: process.env.TERM || "dumb",
      },
    });
    let stdout = "";
    let stderr = "";
    let settled = false;
    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn(value);
    };
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      setTimeout(() => child.kill("SIGKILL"), 2_000).unref();
      finish(reject, new Error(`Codex execution timed out: stdout=${stdout.trim().slice(-200)} stderr=${stderr.trim().slice(-300)}`));
    }, options.timeout);
    child.once("error", (error) => finish(reject, error));
    child.once("close", (code, signal) => {
      if (code === 0) finish(resolve, { stdout, stderr, exitCode: code, signal: null });
      else finish(reject, new Error(`Codex exited ${code ?? signal}: stdout=${stdout.trim().slice(-200)} stderr=${stderr.trim().slice(-300)}`));
    });
  });
}

async function ensureFolders() {
  for (const folder of folders) await fs.mkdir(path.join(ROOT, folder), { recursive: true });
}

async function claimOne(file) {
  const source = path.join(ROOT, "pending", file);
  const processing = path.join(ROOT, "processing", file);
  await fs.rename(source, processing);
  const task = JSON.parse(await fs.readFile(processing, "utf8"));
  task.status = "processing";
  task.claimed_at = now();
  task.attempts = Number(task.attempts || 0) + 1;
  task.claimed_by = process.env.CODEX_WORKER_ID || "codex-inbox-monitor";
  await fs.writeFile(processing, `${JSON.stringify(task, null, 2)}\n`);
  return { file, task, path: processing };
}

export async function scanOnce(handler = executeAndPush) {
  if (localScanLock) return;
  localScanLock = true;
  try {
    await ensureFolders();
    const files = (await fs.readdir(path.join(ROOT, "pending"))).filter((file) => file.endsWith(".json"));
    for (const file of files) {
      let claim;
      try { claim = await claimOne(file); } catch { continue; }
      try {
        claim.task.execution_started_at = now();
        const result = await handler(claim.task);
        claim.task.status = "completed";
        claim.task.completed_at = now();
        claim.task.technical_summary = String(result?.technical_summary || "").slice(0, 4_000);
        claim.task.final_user_message = String(result?.final_user_message || "").slice(0, MAX_LINE_MESSAGE_LENGTH);
        claim.task.progress_stage = result?.progress_stage || null;
        claim.task.progress_user_message = String(result?.progress_user_message || "").slice(0, MAX_LINE_MESSAGE_LENGTH) || null;
        claim.task.result_summary = claim.task.technical_summary.slice(0, 500);
        claim.task.result_status = result?.result_status || "completed";
        await fs.writeFile(claim.path, `${JSON.stringify(claim.task, null, 2)}\n`);
        await fs.rename(claim.path, path.join(ROOT, "completed", file));
      } catch (error) {
        claim.task.status = "failed";
        claim.task.failed_at = now();
        claim.task.error_summary = String(error?.message || error).slice(0, 500);
        claim.task.retryable = true;
        await fs.writeFile(claim.path, `${JSON.stringify(claim.task, null, 2)}\n`);
        await fs.rename(claim.path, path.join(ROOT, "failed", file));
      }
    }
  } finally {
    localScanLock = false;
  }
}

async function kvCommand(args) {
  const { stdout } = await execFileAsync("npx", ["wrangler", "kv", "key", ...args, "--namespace-id", KV_NAMESPACE_ID, "--remote"], { maxBuffer: 1024 * 1024 });
  return stdout;
}

async function kvList(prefix) {
  const output = await kvCommand(["list", "--prefix", prefix]);
  return JSON.parse(output).map((item) => item.name).filter(Boolean);
}

async function kvGet(key) {
  return (await kvCommand(["get", key])).trim();
}

async function kvGetOrNull(key) {
  try { return await kvGet(key); } catch { return null; }
}

async function kvPut(key, value) {
  await kvCommand(["put", key, value]);
}

async function kvDelete(key) {
  await kvCommand(["delete", key]);
}

const defaultKvAdapter = {
  list: kvList,
  get: kvGet,
  getOrNull: kvGetOrNull,
  put: kvPut,
  delete: kvDelete,
};
let kvAdapter = defaultKvAdapter;

export function setKvAdapterForTests(adapter = {}) {
  kvAdapter = { ...defaultKvAdapter, ...adapter };
}

export function resetKvAdapterForTests() {
  kvAdapter = defaultKvAdapter;
}

function shouldWriteExecutorStatus() {
  return process.env.CODEX_INBOX_MODE === "kv";
}

export function executorStatusPayload(status = "online", currentTaskId = null, extra = {}) {
  const heartbeatAt = now();
  return {
    executor_id: EXECUTOR_ID,
    environment: EXECUTOR_ENVIRONMENT,
    status,
    last_heartbeat_at: heartbeatAt,
    current_task_id: currentTaskId || null,
    monitor_version: MONITOR_VERSION,
    fallback_poll_ms: POLL_INTERVAL_MS,
    heartbeat_interval_ms: HEARTBEAT_INTERVAL_MS,
    ...extra,
  };
}

export async function writeExecutorStatus(status = executorRuntimeStatus, currentTaskId = executorCurrentTaskId, extra = {}) {
  if (!shouldWriteExecutorStatus()) return null;
  const payload = executorStatusPayload(status, currentTaskId, extra);
  await kvAdapter.put(EXECUTOR_STATUS_KEY, JSON.stringify(payload));
  executorLastHeartbeatAt = payload.last_heartbeat_at;
  return payload;
}

export async function writeExecutorStatusSafe(status = executorRuntimeStatus, currentTaskId = executorCurrentTaskId, extra = {}) {
  if (heartbeatInFlight) return null;
  heartbeatInFlight = true;
  try {
    return await writeExecutorStatus(status, currentTaskId, extra);
  } catch (error) {
    console.error("executor_heartbeat_failed", { summary: error instanceof Error ? error.message : String(error) });
    return null;
  } finally {
    heartbeatInFlight = false;
  }
}

async function setExecutorRuntimeStatus(status = "online", currentTaskId = null, extra = {}) {
  executorRuntimeStatus = status;
  executorCurrentTaskId = currentTaskId || null;
  return writeExecutorStatusSafe(status, executorCurrentTaskId, extra);
}

export function startExecutorHeartbeat() {
  if (!shouldWriteExecutorStatus()) return null;
  void writeExecutorStatusSafe("online", null, { started_at: now() });
  return setInterval(() => {
    void writeExecutorStatusSafe(executorRuntimeStatus, executorCurrentTaskId);
  }, HEARTBEAT_INTERVAL_MS);
}

function extractJsonObject(text) {
  const trimmed = text.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) return trimmed;
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]?.trim().startsWith("{")) return fenced[1].trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  return start >= 0 && end > start ? trimmed.slice(start, end + 1) : null;
}

export async function parseCodexResult(lastMessage, task) {
  const jsonText = extractJsonObject(lastMessage);
  if (!jsonText) throw new Error("Codex did not provide a parseable result object");
  let parsed;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error("Codex did not provide valid JSON result");
  }
  const technicalSummary = typeof parsed.technical_summary === "string" ? parsed.technical_summary.trim() : "";
  const finalUserMessage = typeof parsed.final_user_message === "string" ? parsed.final_user_message.trim() : "";
  const progressStage = typeof parsed.progress_stage === "string" ? parsed.progress_stage.trim() : "";
  const progressUserMessage = typeof parsed.progress_user_message === "string" ? parsed.progress_user_message.trim() : "";
  if (!technicalSummary) throw new Error("Codex did not provide technical_summary");
  let safeFinalUserMessage = finalUserMessage;
  try {
    validateFinalUserMessage(safeFinalUserMessage, task);
  } catch (error) {
    if (!isIdeaListRequest(task)) throw error;
    safeFinalUserMessage = await buildIdeaListUserMessage(task);
  }
  if (task?.execution_mode === "long") {
    if (!progressStage) throw new Error("Codex did not provide progress_stage");
    validateFinalUserMessage(progressUserMessage, task);
  }
  return {
    technical_summary: technicalSummary.slice(0, 4_000),
    final_user_message: safeFinalUserMessage,
    progress_stage: progressStage || null,
    progress_user_message: progressUserMessage || null,
    result_status: "completed",
  };
}

function allowsTechnicalDetails(task) {
  return /(?:技術細節|技術紀錄|工程紀錄|工程細節|debug|除錯|診斷|內部欄位|stdout|stderr|PID)/i
    .test(String(task?.original_text || ""));
}

function isIdeaListRequest(task = {}) {
  const text = String(task?.original_text || "");
  return /(?:列出|列表|查看|看|顯示).*(?:想法|則|全部|所有|來給我看)|(?:想法|則).*(?:列出|列表|查看|看|顯示)|可以列出來給我看嗎/.test(text);
}

function ideaListPeriod(task = {}) {
  const text = String(task?.original_text || "");
  if (/(?:今天|今日)/.test(text)) return { period: "day", label: "今天" };
  if (/(?:本月|這個月|當月)/.test(text)) return { period: "month", label: "本月" };
  if (/(?:今年|本年)/.test(text)) return { period: "year", label: "今年" };
  return { period: "all", label: "" };
}

function sanitizeIdeaText(text) {
  const clean = String(text || "")
    .replace(/\/(?:Users|Volumes|tmp|var|opt|private|Applications)\/[^\s]+/g, "（已省略）")
    .replace(/\bfile:\/\/[^\s]+/gi, "（已省略）")
    .replace(/(?:^|\s)(?:\.{1,2}\/|[\w.-]+\/)+[\w.-]+\.[A-Za-z0-9]{1,8}\b/g, "（已省略）")
    .replace(/\[[^\]]+\]\([^)]+\)/g, "（已省略）")
    .replace(/\b[\w.-]+\.json\b/gi, "（已省略）")
    .replace(/\b(?:Codex|monitor|Worker|Gateway|task_id|original_text|stdout|stderr|exit code|PID|error_summary|variant|TTL)\b/gi, "（已省略）")
    .replace(/\s+/g, " ")
    .trim();
  return clean.length > 160 ? `${clean.slice(0, 157)}...` : clean;
}

export async function buildIdeaListUserMessage(task = {}) {
  const { period, label } = ideaListPeriod(task);
  const ideas = await listIdeasForPeriod(period, DROPBOX_DIR);
  const scope = label ? `${label}的` : "";
  if (!ideas.length) return `我目前沒有找到${scope}已記下的想法。`;
  const items = ideas
    .map((idea) => sanitizeIdeaText(idea.text || idea.data?.original_text || ""))
    .filter(Boolean);
  if (!items.length) return "我有找到想法紀錄，但這次沒有適合直接顯示的內容。";
  const lines = [];
  for (const text of items) {
    const next = `${lines.length + 1}. ${text}`;
    const draft = `我整理好了，目前共有 ${items.length} 則想法：\n\n${[...lines, next].join("\n")}`;
    if (draft.length > 4_600) break;
    lines.push(next);
  }
  const suffix = items.length > lines.length ? `\n\n我先列出前 ${lines.length} 則，剩下的可以再分批給你。` : "";
  const message = `我整理好了，${label ? `${label}共有` : "目前共有"} ${items.length} 則想法：\n\n${lines.join("\n")}${suffix}`;
  validateFinalUserMessage(message, task);
  return message;
}

export function validateFinalUserMessage(message, task = {}) {
  if (!message) throw new Error("Codex did not provide a valid LINE final message");
  if (message.length > MAX_LINE_MESSAGE_LENGTH) throw new Error("Codex LINE final message is too long");
  const blockedPatterns = [
    /\/(?:Users|Volumes|tmp|var|opt|private|Applications)\/[^\s]+/,
    /\bfile:\/\/[^\s]+/i,
    /(?:^|\s)(?:\.{1,2}\/|[\w.-]+\/)+[\w.-]+\.[A-Za-z0-9]{1,8}\b/,
    /\[[^\]]+\]\([^)]+\)/,
    /\b(?:task_id|original_text|stdout|stderr|exit code|PID)\b/i,
    /\b(?:error_summary|variant|TTL)\b/i,
    /\b(?:authorization|bearer|access_token|refresh_token|client_secret|LINE_CHANNEL|secret|credential)\b/i,
    /\bsk-[A-Za-z0-9_-]+/,
    /\b[\w.-]+\.json\b/i,
  ];
  const internalRolePatterns = [
    /\bCodex\b/i,
    /\bmonitor\b/i,
    /\bWorker\b/i,
    /\bGateway\b/i,
    /已交給\s*Codex/i,
    /Codex\s*正在處理/i,
    /等待\s*Codex\s*回覆/i,
    /系統已將任務交給阿光/,
    /阿光已收到系統轉交的任務/,
  ];
  const safetyNarrationPatterns = [
    /本機路徑/,
    /絕對路徑/,
    /相對路徑/,
    /檔案路徑/,
    /JSON\s*檔名/i,
    /Markdown\s*連結/i,
    /工程欄位/,
    /技術欄位/,
    /內部欄位/,
    /內部資訊/,
    /內部 execution 欄位/i,
  ];
  if (blockedPatterns.some((pattern) => pattern.test(message))) {
    throw new Error("Codex did not provide a valid LINE final message");
  }
  if (!allowsTechnicalDetails(task) && internalRolePatterns.some((pattern) => pattern.test(message))) {
    throw new Error("Codex did not provide a valid LINE final message");
  }
  if (!allowsTechnicalDetails(task) && safetyNarrationPatterns.some((pattern) => pattern.test(message))) {
    throw new Error("Codex did not provide a valid LINE final message");
  }
}

export function buildFailedUserMessage(task = {}, error = null) {
  const errorText = String(error?.message || error || "");
  const originalText = String(task?.original_text || "");
  const timedOut = /timed?\s*out|timeout|逾時/i.test(errorText);
  const invalidResult = /did not provide|no execution summary|parseable|valid JSON|valid LINE final message/i.test(errorText);
  let message;
  if (timedOut) {
    message = "我處理這個任務時卡住了，這次還沒完成。任務紀錄我會保留，等一下可以再試一次。";
  } else if (invalidResult) {
    message = "我這次沒有把結果整理成功，所以先不把它當成完成。任務紀錄我會保留，等一下可以再試一次。";
  } else if (originalText.length > 40) {
    message = "我處理這個任務時遇到狀況，這次沒有完成。任務紀錄我會保留，稍後可以再試一次。";
  } else {
    message = "我目前處理時遇到問題，這次還沒完成。任務紀錄我會保留，等一下可以再試一次。";
  }
  validateFinalUserMessage(message, task);
  return message;
}

export async function applyFailedFinalPush(task, error, push = pushFinalResult) {
  task.final_user_message = isIdeaListRequest(task)
    ? await buildIdeaListUserMessage(task).catch(() => buildFailedUserMessage(task, error))
    : buildFailedUserMessage(task, error);
  task.result_status = "failed";
  const result = await push(task, { final_user_message: task.final_user_message })
    .catch((pushError) => ({ pushed: false, status: null, reason: String(pushError?.message || pushError).slice(0, 120) }));
  task.final_push_status = result.pushed ? "sent" : "failed";
  task.final_push_http_status = result.status;
  if (!result.pushed) task.final_push_error = result.reason || "push_failed";
  return task;
}

async function executeWithCodex(task) {
  const prompt = [
    "你是菲比 LINE 智能助理 V3 的 Codex 執行器。你收到的是菲比從 LINE 傳來的原始訊息。",
    `execution_mode：${task.execution_mode || "quick"}`,
    `display_task_id：${task.display_task_id || ""}`,
    `專案根目錄：${PROJECT_ROOT}`,
    `既有 Dropbox 想法資料夾：${DROPBOX_DIR}`,
    `既有 Dropbox 想法刪除資料夾：${DROPBOX_DELETED_DIR}`,
    `想法修改/刪除工具：${IDEA_TOOLS}`,
    "請自行理解需求、選擇現有工具並真正完成工作。不要做預先 regex 分類，不得掃描整個專案。不得操作 FORMAL、正式網站、付款、Gmail、Calendar 或對外發布。",
    "若原句是保存想法/備忘，直接使用既有本機工具新增一份 JSON，保留 original_text，完成後停止。",
    "若原句是列出、查看、顯示既有想法內容，請優先使用想法修改/刪除工具執行：node codex-inbox/idea-tools.js search；若菲比指定今天/本月/今年，請加 --period day/month/year。final_user_message 只列出想法內容，不顯示檔名、路徑、工具名稱或工程欄位。",
    "若原句是修改既有想法，請使用想法修改/刪除工具執行：node codex-inbox/idea-tools.js search --query <定位文字>，確認唯一目標後 node codex-inbox/idea-tools.js update --query <定位文字> --text <修改後文字>；若只有最後一筆語意，才可加 --latest。",
    "若原句是刪除既有想法，請使用想法修改/刪除工具執行：node codex-inbox/idea-tools.js search --query <定位文字>，確認唯一目標後 node codex-inbox/idea-tools.js delete --query <定位文字>；刪除必須移到既有 Dropbox 想法刪除資料夾，不可直接硬刪。",
    "local-query-api 只可用於 count/list 查詢；不要把它當成修改或刪除工具。",
    `original_text：${task.original_text}`,
    "",
    "工作完成後，請產生 technical_summary 與 final_user_message。",
    "如果 execution_mode 是 long，也必須產生 progress_stage 與 progress_user_message；progress_user_message 是自然的進度通知，由你依實際狀態撰寫，不要使用內部 task_id、PID、stdout、stderr、本機路徑或工程欄位。",
    "technical_summary 保存完整工程紀錄，可包含檔名、路徑、工具結果及診斷資訊；它只會寫入 completed task，不會推送 LINE。",
    "final_user_message 是可以直接傳送給菲比的 LINE 最終回覆。",
    "對菲比顯示的 progress_user_message 與 final_user_message，一律使用阿光同一人格，並以第一人稱「我」回報。",
    "一般 LINE 對話不得把 LINE 端、Gateway、monitor、Worker 或 Codex 描述成不同角色；除非菲比明確詢問技術細節，否則不要在對外訊息出現 Codex、monitor、Worker、Gateway 等內部名稱。",
    "對外訊息不得出現「已交給 Codex」、「Codex 正在處理」、「系統已將任務交給阿光」、「等待 Codex 回覆」或「阿光已收到系統轉交的任務」。",
    "一般 LINE 對話只說實際完成結果，不要描述你避開了哪些內部資訊，也不要出現「本機路徑」、「JSON 檔名」、「Markdown 連結」、「工程欄位」、「技術欄位」、「內部欄位」這類安全規則文字。",
    "對外訊息可自然使用「我收到任務了」、「我正在處理」、「我正在執行」、「我正在驗證結果」、「我已完成」或「我目前遇到問題」等第一人稱語氣，但不要固定成單一句型。",
    "LINE 最終回覆規則：",
    "1. 使用自然、簡單的繁體中文。",
    "2. 像助理向菲比回報，不像工程紀錄。",
    "3. 先說實際完成了什麼。",
    "4. 只保留菲比需要知道的結果。",
    "5. 可適量使用自然 emoji。",
    "6. 不顯示本機絕對路徑。",
    "7. 不顯示 Markdown 檔案連結。",
    "8. 不顯示 JSON 檔名，除非菲比明確詢問。",
    "9. 不顯示 original_text、task_id、exit code。",
    "10. 不顯示 stdout、stderr、PID 或技術欄位。",
    "11. 不顯示 Git／檔案系統內部資訊，除非菲比明確要求。",
    "12. 不要只回答『完成』。",
    "13. 不得宣稱未實際完成的工作已完成。",
    "14. 若工作失敗，使用簡單中文說明目前未完成及原因。",
    "15. 若資訊不足，直接提出一個清楚問題。",
    "16. 若涉及高風險操作，先提出確認，不得自行執行。",
    "17. final_user_message 只輸出給菲比看的 LINE 回覆，不附工程報告。",
    "18. 不要使用 Markdown 連結語法。",
    "19. 不要輸出程式碼區塊。",
    "20. 回覆應適合手機閱讀。",
    "",
    "最後請只輸出一個 JSON object，不要加 Markdown、不要加程式碼區塊、不要加其他文字。格式如下：",
    "{\"progress_stage\":\"已完成\",\"progress_user_message\":\"自然的進度通知\",\"technical_summary\":\"完整工程紀錄\",\"final_user_message\":\"適合直接推送 LINE 的繁體中文回覆\"}",
  ].join("\n");
  const outputFile = path.join("/tmp", `pline-codex-${String(task.task_id).replace(/[^A-Za-z0-9_-]/g, "_")}.last`);
  await fs.rm(outputFile, { force: true });
  const { stdout, stderr, exitCode } = await runCodex([
    "exec", "--ephemeral", "--ignore-user-config", "--sandbox", "danger-full-access", "-c", "model_reasoning_effort=low", "--cd", PROJECT_ROOT,
    "--add-dir", DROPBOX_DIR, "-o", outputFile, prompt,
  ], { cwd: PROJECT_ROOT, timeout: 120_000 });
  const lastMessage = await fs.readFile(outputFile, "utf8").catch(() => "");
  await fs.rm(outputFile, { force: true });
  if (!lastMessage.trim() || /Reading additional input from stdin/i.test(lastMessage)) {
    throw new Error(`Codex returned no execution summary: exit_code=${exitCode} stdout=${stdout.trim().slice(-200)} stderr=${stderr.trim().slice(-300)}`);
  }
  return parseCodexResult(lastMessage, task);
}

async function pushFinalResult(task, result) {
  const text = typeof result.final_user_message === "string" ? result.final_user_message.trim() : "";
  validateFinalUserMessage(text, task);
  const response = await fetch(FINAL_PUSH_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ task_id: task.task_id, text }),
  });
  const body = await response.json().catch(() => ({}));
  return { pushed: response.ok && body.ok === true, status: response.status, reason: body.error };
}

async function pushProgressResult(task, result) {
  if (task.execution_mode !== "long" || !result.progress_user_message) return null;
  validateFinalUserMessage(result.progress_user_message, task);
  const response = await fetch(PROGRESS_PUSH_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ task_id: task.task_id, text: result.progress_user_message }),
  });
  const body = await response.json().catch(() => ({}));
  return { pushed: response.ok && body.ok === true, status: response.status, reason: body.error };
}

async function pushProgressText(task, text) {
  validateFinalUserMessage(text, task);
  const response = await fetch(PROGRESS_PUSH_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ task_id: task.task_id, text }),
  });
  const body = await response.json().catch(() => ({}));
  return { pushed: response.ok && body.ok === true, status: response.status, reason: body.error };
}

export function buildRecoveryUserMessage(task = {}) {
  const text = String(task.original_text || "");
  let message;
  if (task.execution_mode === "long") {
    message = `我恢復了，現在開始處理剛剛排隊的任務。\n\n任務編號：${task.display_task_id || "未提供"}`;
  } else if (/[?？]|多少|幾|列出|查看|顯示|看/.test(text)) {
    message = "我恢復了，現在開始幫你整理剛剛排隊的查詢。";
  } else {
    message = "我恢復了，現在開始處理剛剛排隊的訊息。";
  }
  validateFinalUserMessage(message, task);
  return message;
}

async function applyQueuedRecoveryNotice(task) {
  if (!task.queued_while_offline) return null;
  const message = buildRecoveryUserMessage(task);
  task.progress_stage = "started_after_reconnect";
  task.progress_user_message = message;
  task.recovery_started_at = now();
  const result = await pushProgressText(task, message)
    .catch((error) => ({ pushed: false, status: null, reason: String(error?.message || error).slice(0, 120) }));
  task.recovery_progress_push_status = result.pushed ? "sent" : "failed";
  task.recovery_progress_push_http_status = result.status;
  if (!result.pushed) task.recovery_progress_push_error = result.reason || "recovery_progress_push_failed";
  return result;
}

async function executeAndPush(task) {
  return executeWithCodex(task);
}

export async function scanKvOnce(handler = executeAndPush) {
  if (localScanLock) return;
  localScanLock = true;
  try {
    await setExecutorRuntimeStatus(executorRuntimeStatus === "busy" ? "busy" : "online", executorCurrentTaskId, {
      last_scan_started_at: now(),
    });
    const pendingKeys = await kvAdapter.list("pending/");
    for (const pendingKey of pendingKeys) {
      const file = pendingKey.slice("pending/".length);
      const completedKey = `completed/${file}`;
      const failedKey = `failed/${file}`;
      if (await kvAdapter.getOrNull(completedKey) || await kvAdapter.getOrNull(failedKey)) {
        await kvAdapter.delete(pendingKey).catch(() => {});
        continue;
      }
      const task = JSON.parse(await kvAdapter.get(pendingKey));
      const processingKey = `processing/${file}`;
      const claimToken = `${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      task.status = "processing";
      task.claimed_at = now();
      task.attempts = Number(task.attempts || 0) + 1;
      task.claimed_by = process.env.CODEX_WORKER_ID || "codex-inbox-monitor";
      task.claim_token = claimToken;
      task.executor_last_heartbeat_at = executorLastHeartbeatAt || task.executor_last_heartbeat_at || null;
      await kvAdapter.put(processingKey, JSON.stringify(task));
      const confirmedClaim = await kvAdapter.getOrNull(processingKey);
      if (!confirmedClaim || JSON.parse(confirmedClaim).claim_token !== claimToken) continue;
      await kvAdapter.delete(pendingKey);
      try {
        task.execution_started_at = now();
        await setExecutorRuntimeStatus("busy", task.task_id, {
          execution_started_at: task.execution_started_at,
        });
        await applyQueuedRecoveryNotice(task);
        await kvAdapter.put(processingKey, JSON.stringify(task));
        const result = await handler(task);
        const owner = await kvAdapter.getOrNull(processingKey);
        if (!owner || JSON.parse(owner).claim_token !== claimToken) continue;
        task.status = "completed";
        task.completed_at = now();
        task.technical_summary = String(result?.technical_summary || "").slice(0, 4_000);
        task.final_user_message = String(result?.final_user_message || "").slice(0, MAX_LINE_MESSAGE_LENGTH);
        task.progress_stage = result?.progress_stage || null;
        task.progress_user_message = String(result?.progress_user_message || "").slice(0, MAX_LINE_MESSAGE_LENGTH) || null;
        task.result_summary = task.technical_summary.slice(0, 500);
        task.result_status = result?.result_status || "completed";
        if (!(await kvAdapter.getOrNull(failedKey))) await kvAdapter.put(completedKey, JSON.stringify(task));
        const progress = await pushProgressResult(task, result);
        if (progress) {
          task.progress_push_status = progress.pushed ? "sent" : "failed";
          task.progress_push_http_status = progress.status;
          if (!progress.pushed) task.progress_push_error = progress.reason || "progress_push_failed";
        }
        const push = await pushFinalResult(task, result);
        task.final_push_status = push.pushed ? "sent" : "failed";
        task.final_push_http_status = push.status;
        task.final_push_at = now();
        if (!push.pushed) task.final_push_error = push.reason || "push_failed";
        await kvAdapter.put(completedKey, JSON.stringify(task));
        await kvAdapter.delete(processingKey);
        await setExecutorRuntimeStatus("online", null, { last_completed_task_id: task.task_id });
      } catch (error) {
        const owner = await kvAdapter.getOrNull(processingKey);
        if (!owner || JSON.parse(owner).claim_token !== claimToken) continue;
        task.status = "failed";
        task.failed_at = now();
        task.error_summary = String(error?.message || error).slice(0, 500);
        task.retryable = true;
        await applyFailedFinalPush(task, error);
        task.final_push_at = now();
        if (!(await kvAdapter.getOrNull(completedKey))) await kvAdapter.put(failedKey, JSON.stringify(task));
        await kvAdapter.delete(processingKey);
        await setExecutorRuntimeStatus("online", null, { last_failed_task_id: task.task_id });
      }
    }
  } finally {
    if (shouldWriteExecutorStatus() && executorRuntimeStatus !== "busy") {
      await setExecutorRuntimeStatus("online", null, { last_scan_finished_at: now() });
    }
    localScanLock = false;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const scan = process.env.CODEX_INBOX_MODE === "kv" ? scanKvOnce : scanOnce;
  startExecutorHeartbeat();
  startWakeServer(scan);
  await triggerScan(scan, "startup");
  setInterval(() => triggerScan(scan, "fallback_poll").catch(() => {}), POLL_INTERVAL_MS);
}
