import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
export const INBOX_ROOT = ROOT;
const execFileAsync = promisify(execFile);
const KV_NAMESPACE_ID = process.env.CODEX_INBOX_KV_NAMESPACE_ID || "ba842d5662f94e60bfeb4a85e9f0e36c";
const folders = ["pending", "processing", "completed", "failed"];
const now = () => new Date().toISOString();

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

export async function scanOnce(handler = async () => ({ result_summary: "handed to Codex", result_status: "completed" })) {
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

async function kvPut(key, value) {
  await kvCommand(["put", key, value]);
}

async function kvDelete(key) {
  await kvCommand(["delete", key]);
}

export async function scanKvOnce(handler = async () => ({ result_summary: "handed to Codex", result_status: "completed" })) {
  const pendingKeys = await kvList("pending/");
  for (const pendingKey of pendingKeys) {
    const task = JSON.parse(await kvGet(pendingKey));
    const file = pendingKey.slice("pending/".length);
    const processingKey = `processing/${file}`;
    task.status = "processing";
    task.claimed_at = now();
    task.attempts = Number(task.attempts || 0) + 1;
    task.claimed_by = process.env.CODEX_WORKER_ID || "codex-inbox-monitor";
    await kvPut(processingKey, JSON.stringify(task));
    await kvDelete(pendingKey);
    try {
      const result = await handler(task);
      task.status = "completed";
      task.completed_at = now();
      task.result_summary = String(result?.result_summary || "completed").slice(0, 500);
      task.result_status = result?.result_status || "completed";
      await kvPut(`completed/${file}`, JSON.stringify(task));
      await kvDelete(processingKey);
    } catch (error) {
      task.status = "failed";
      task.failed_at = now();
      task.error_summary = String(error?.message || error).slice(0, 500);
      task.retryable = true;
      await kvPut(`failed/${file}`, JSON.stringify(task));
      await kvDelete(processingKey);
    }
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const scan = process.env.CODEX_INBOX_MODE === "kv" ? scanKvOnce : scanOnce;
  await scan();
  setInterval(() => scan().catch(() => {}), 60_000);
}
