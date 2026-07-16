import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
export const INBOX_ROOT = ROOT;
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

if (process.argv[1] === new URL(import.meta.url).pathname) {
  await scanOnce();
  setInterval(() => scanOnce().catch(() => {}), 60_000);
}
