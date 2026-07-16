import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
export const INBOX_ROOT = ROOT;
const execFileAsync = promisify(execFile);
const KV_NAMESPACE_ID = process.env.CODEX_INBOX_KV_NAMESPACE_ID || "ba842d5662f94e60bfeb4a85e9f0e36c";
const PROJECT_ROOT = path.resolve(ROOT, "..");
const DROPBOX_DIR = "/Users/phoebe/Library/CloudStorage/Dropbox/codex專案/菲比 LINE 智能助理_02/想法紀錄_TEST";
const FINAL_PUSH_URL = process.env.CODEX_FINAL_PUSH_URL || "https://pline-v2-0-test-line-gateway-r2c3b.phy4175.workers.dev/internal/final-push";
const MAX_LINE_MESSAGE_LENGTH = 5_000;
const folders = ["pending", "processing", "completed", "failed"];
const now = () => new Date().toISOString();
let localScanLock = false;

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
        const result = await handler(claim.task);
        claim.task.status = "completed";
        claim.task.completed_at = now();
        claim.task.technical_summary = String(result?.technical_summary || "").slice(0, 4_000);
        claim.task.final_user_message = String(result?.final_user_message || "").slice(0, MAX_LINE_MESSAGE_LENGTH);
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

function parseCodexResult(lastMessage) {
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
  if (!technicalSummary) throw new Error("Codex did not provide technical_summary");
  validateFinalUserMessage(finalUserMessage);
  return {
    technical_summary: technicalSummary.slice(0, 4_000),
    final_user_message: finalUserMessage,
    result_status: "completed",
  };
}

function validateFinalUserMessage(message) {
  if (!message) throw new Error("Codex did not provide a valid LINE final message");
  if (message.length > MAX_LINE_MESSAGE_LENGTH) throw new Error("Codex LINE final message is too long");
  const blockedPatterns = [
    /\/Users\/[^\s]+/,
    /\[[^\]]+\]\([^)]+\)/,
    /\b(?:task_id|original_text|stdout|stderr|exit code|PID)\b/i,
    /\b(?:authorization|bearer|access_token|refresh_token|client_secret|LINE_CHANNEL|secret|credential)\b/i,
    /\bsk-[A-Za-z0-9_-]+/,
    /\b[\w.-]+\.json\b/i,
  ];
  if (blockedPatterns.some((pattern) => pattern.test(message))) {
    throw new Error("Codex did not provide a valid LINE final message");
  }
}

async function executeWithCodex(task) {
  const prompt = [
    "你是菲比 LINE 智能助理 V3 的 Codex 執行器。你收到的是菲比從 LINE 傳來的原始訊息。",
    `專案根目錄：${PROJECT_ROOT}`,
    `既有 Dropbox 想法資料夾：${DROPBOX_DIR}`,
    "請自行理解需求、選擇現有工具並真正完成工作。不要做預先 regex 分類，不得掃描整個專案。不得操作 FORMAL、正式網站、付款、Gmail、Calendar 或對外發布。",
    "若原句是保存想法/備忘，直接使用既有本機工具新增一份 JSON，保留 original_text，完成後停止。",
    `original_text：${task.original_text}`,
    "",
    "工作完成後，請產生 technical_summary 與 final_user_message。",
    "technical_summary 保存完整工程紀錄，可包含檔名、路徑、工具結果及診斷資訊；它只會寫入 completed task，不會推送 LINE。",
    "final_user_message 是可以直接傳送給菲比的 LINE 最終回覆。",
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
    "{\"technical_summary\":\"完整工程紀錄\",\"final_user_message\":\"適合直接推送 LINE 的繁體中文回覆\"}",
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
  return parseCodexResult(lastMessage);
}

async function pushFinalResult(task, result) {
  const text = typeof result.final_user_message === "string" ? result.final_user_message.trim() : "";
  validateFinalUserMessage(text);
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
        task.technical_summary = String(result?.technical_summary || "").slice(0, 4_000);
        task.final_user_message = String(result?.final_user_message || "").slice(0, MAX_LINE_MESSAGE_LENGTH);
        task.result_summary = task.technical_summary.slice(0, 500);
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
