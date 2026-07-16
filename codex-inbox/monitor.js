import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
export const INBOX_ROOT = ROOT;
const execFileAsync = promisify(execFile);
const KV_NAMESPACE_ID = process.env.CODEX_INBOX_KV_NAMESPACE_ID || "ba842d5662f94e60bfeb4a85e9f0e36c";
const PROJECT_ROOT = path.resolve(ROOT, "..");
const DROPBOX_DIR = "/Users/phoebe/Library/CloudStorage/Dropbox/codex專案/菲比 LINE 智能助理_02/想法紀錄_TEST";
const FINAL_PUSH_URL = process.env.CODEX_FINAL_PUSH_URL || "https://pline-v2-0-test-line-gateway-r2c3b.phy4175.workers.dev/internal/final-push";
const folders = ["pending", "processing", "completed", "failed"];
const now = () => new Date().toISOString();
let localScanLock = false;

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
      const result = await handler(claim.task);
      claim.task.status = "completed";
      claim.task.completed_at = now();
      claim.task.result_summary = String(result?.result_summary || "completed").slice(0, 500);
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

async function executeWithCodex(task) {
  const prompt = [
    "你是菲比 LINE 智能助理 V3 的 Codex 執行器。只處理這一筆完整原句，不要做預先 regex 分類。",
    `專案根目錄：${PROJECT_ROOT}`,
    `既有 Dropbox 想法資料夾：${DROPBOX_DIR}`,
    "若原句是保存想法/備忘，直接使用既有本機工具新增一份 JSON，保留 original_text，完成後停止；不得掃描整個專案。不得操作 FORMAL、正式網站、付款、Gmail、Calendar 或對外發布。",
    `original_text：${task.original_text}`,
  ].join("\n");
  const { stdout } = await execFileAsync("/opt/homebrew/bin/codex", [
    "exec", "--ephemeral", "--ignore-user-config", "--sandbox", "danger-full-access", "-c", "model_reasoning_effort=low", "--cd", PROJECT_ROOT,
    "--add-dir", DROPBOX_DIR, prompt,
  ], { timeout: 120_000, maxBuffer: 2 * 1024 * 1024 });
  const summary = stdout.trim().split("\n").filter(Boolean).slice(-4).join(" ").slice(0, 500);
  if (!summary) throw new Error("Codex returned no execution summary");
  return { result_summary: summary, result_status: "completed" };
}

async function pushFinalResult(task, result) {
  const text = typeof result.final_reply === "string" && result.final_reply.trim()
    ? result.final_reply.trim()
    : `已完成：「${task.original_text}」✨`;
  const response = await fetch(FINAL_PUSH_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ task_id: task.task_id, text }),
  });
  const body = await response.json().catch(() => ({}));
  return { pushed: response.ok && body.ok === true, status: response.status, reason: body.error };
}

async function executeAndPush(task) {
  return executeWithCodex(task);
}

export async function scanKvOnce(handler = executeAndPush) {
  if (localScanLock) return;
  localScanLock = true;
  try {
  const pendingKeys = await kvList("pending/");
  for (const pendingKey of pendingKeys) {
    const file = pendingKey.slice("pending/".length);
    const completedKey = `completed/${file}`;
    const failedKey = `failed/${file}`;
    if (await kvGetOrNull(completedKey) || await kvGetOrNull(failedKey)) {
      await kvDelete(pendingKey).catch(() => {});
      continue;
    }
    const task = JSON.parse(await kvGet(pendingKey));
    const processingKey = `processing/${file}`;
    const claimToken = `${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    task.status = "processing";
    task.claimed_at = now();
    task.attempts = Number(task.attempts || 0) + 1;
    task.claimed_by = process.env.CODEX_WORKER_ID || "codex-inbox-monitor";
    task.claim_token = claimToken;
    await kvPut(processingKey, JSON.stringify(task));
    const confirmedClaim = await kvGetOrNull(processingKey);
    if (!confirmedClaim || JSON.parse(confirmedClaim).claim_token !== claimToken) continue;
    await kvDelete(pendingKey);
    try {
      const result = await handler(task);
      const owner = await kvGetOrNull(processingKey);
      if (!owner || JSON.parse(owner).claim_token !== claimToken) continue;
      task.status = "completed";
      task.completed_at = now();
      task.result_summary = String(result?.result_summary || "completed").slice(0, 500);
      task.result_status = result?.result_status || "completed";
      if (!(await kvGetOrNull(failedKey))) await kvPut(completedKey, JSON.stringify(task));
      const push = await pushFinalResult(task, result);
      task.final_push_status = push.pushed ? "sent" : "failed";
      task.final_push_http_status = push.status;
      if (!push.pushed) task.final_push_error = push.reason || "push_failed";
      await kvPut(completedKey, JSON.stringify(task));
      await kvDelete(processingKey);
    } catch (error) {
      const owner = await kvGetOrNull(processingKey);
      if (!owner || JSON.parse(owner).claim_token !== claimToken) continue;
      task.status = "failed";
      task.failed_at = now();
      task.error_summary = String(error?.message || error).slice(0, 500);
      task.retryable = true;
      if (!(await kvGetOrNull(completedKey))) await kvPut(failedKey, JSON.stringify(task));
      await kvDelete(processingKey);
    }
  }
  } finally {
    localScanLock = false;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const scan = process.env.CODEX_INBOX_MODE === "kv" ? scanKvOnce : scanOnce;
  await scan();
  setInterval(() => scan().catch(() => {}), 60_000);
}
