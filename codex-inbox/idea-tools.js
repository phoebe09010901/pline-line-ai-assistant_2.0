import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const IDEA_DIR = process.env.PLINE_IDEA_DIR
  || "/Users/phoebe/Library/CloudStorage/Dropbox/codex專案/菲比 LINE 智能助理_02/想法紀錄_TEST";
export const DELETED_DIR = process.env.PLINE_IDEA_DELETED_DIR
  || "/Users/phoebe/Library/CloudStorage/Dropbox/codex專案/菲比 LINE 智能助理_02/想法紀錄_TEST_已刪除";

const FILE_PATTERN = /^idea_\d{4}-\d{2}-\d{2}_.*\.json$/;

function taipeiNow() {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.filter((p) => p.type !== "literal").map((p) => [p.type, p.value]));
  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}:${values.second}+08:00`;
}

function taipeiDateParts() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  return Object.fromEntries(parts.filter(({ type }) => type !== "literal").map(({ type, value }) => [type, value]));
}

function ideaDate(idea) {
  const created = String(idea.data.created_at || "");
  const createdDate = created.match(/\d{4}-\d{2}-\d{2}/)?.[0];
  return createdDate || idea.file.match(/^idea_(\d{4}-\d{2}-\d{2})_/)?.[1] || "";
}

function matchesPeriod(idea, period) {
  if (!period || period === "all") return true;
  const { year, month, day } = taipeiDateParts();
  const date = ideaDate(idea);
  if (period === "day") return date === `${year}-${month}-${day}`;
  if (period === "month") return date.startsWith(`${year}-${month}-`);
  if (period === "year") return date.startsWith(`${year}-`);
  return true;
}

function parseArgs(argv) {
  const options = {
    command: argv[2],
    query: "",
    text: "",
    file: "",
    latest: false,
    period: "all",
    idempotencyKey: "",
    operationFingerprint: "",
    sourceEventId: "",
    sourceMessageId: "",
    sourceUserId: "",
    sourceUserFingerprint: "",
    taskId: "",
  };
  for (let index = 3; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--query") options.query = argv[++index] || "";
    else if (arg === "--text") options.text = argv[++index] || "";
    else if (arg === "--file") options.file = argv[++index] || "";
    else if (arg === "--latest") options.latest = true;
    else if (arg === "--period") options.period = argv[++index] || "all";
    else if (arg === "--idempotency-key") options.idempotencyKey = argv[++index] || "";
    else if (arg === "--operation-fingerprint") options.operationFingerprint = argv[++index] || "";
    else if (arg === "--source-event-id") options.sourceEventId = argv[++index] || "";
    else if (arg === "--source-message-id") options.sourceMessageId = argv[++index] || "";
    else if (arg === "--source-user-id") options.sourceUserId = argv[++index] || "";
    else if (arg === "--source-user-fingerprint") options.sourceUserFingerprint = argv[++index] || "";
    else if (arg === "--task-id") options.taskId = argv[++index] || "";
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

async function readIdea(filePath) {
  const raw = await fs.readFile(filePath, "utf8");
  const data = JSON.parse(raw);
  const text = typeof data.text === "string" ? data.text : data.original_text;
  return { file: path.basename(filePath), path: filePath, data, text: typeof text === "string" ? text : "" };
}

async function listIdeas(dir = IDEA_DIR) {
  const names = await fs.readdir(dir);
  const ideas = [];
  for (const name of names.filter((item) => FILE_PATTERN.test(item))) {
    try {
      ideas.push(await readIdea(path.join(dir, name)));
    } catch {
      // Ignore incomplete Dropbox sync files.
    }
  }
  return ideas.sort((a, b) => String(b.data.created_at || b.file).localeCompare(String(a.data.created_at || a.file)));
}

async function resolveTarget({ query, file, latest }, dir = IDEA_DIR) {
  const ideas = await listIdeas(dir);
  if (file) {
    const target = ideas.find((idea) => idea.file === path.basename(file));
    if (!target) throw new Error("No matching idea file found");
    return target;
  }
  const candidates = query
    ? ideas.filter((idea) => `${idea.text}\n${idea.data.original_text || ""}`.includes(query))
    : ideas;
  if (!candidates.length) throw new Error("No matching idea found");
  if (latest || candidates.length === 1) return candidates[0];
  throw new Error(`Multiple matching ideas found: ${candidates.length}. Use a more specific query or --latest.`);
}

export async function searchIdeas(query = "", dir = IDEA_DIR) {
  const ideas = await listIdeas(dir);
  return query ? ideas.filter((idea) => `${idea.text}\n${idea.data.original_text || ""}`.includes(query)) : ideas;
}

export async function listIdeasForPeriod(period = "all", dir = IDEA_DIR) {
  return (await listIdeas(dir)).filter((idea) => matchesPeriod(idea, period));
}

function ideaTimestampForFile() {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.filter((p) => p.type !== "literal").map((p) => [p.type, p.value]));
  return `${values.year}-${values.month}-${values.day}_${values.hour}${values.minute}${values.second}`;
}

function duplicateSaveCandidate(ideas, options) {
  return ideas.find((idea) => {
    if (options.idempotencyKey && idea.data.idempotency_key === options.idempotencyKey) return true;
    if (options.operationFingerprint && idea.data.operation_fingerprint === options.operationFingerprint) return true;
    return false;
  }) || null;
}

export async function saveIdea(options, dir = IDEA_DIR) {
  if (!options?.text) throw new Error("Missing idea text");
  await fs.mkdir(dir, { recursive: true });
  const ideas = await listIdeas(dir);
  const duplicate = duplicateSaveCandidate(ideas, options);
  if (duplicate) {
    return {
      ok: true,
      action: "save",
      duplicate: true,
      file: duplicate.file,
      text: duplicate.text,
      idempotency_key: options.idempotencyKey || null,
      operation_fingerprint: options.operationFingerprint || null,
      dir,
    };
  }
  const data = {
    text: options.text,
    original_text: options.text,
    created_at: taipeiNow(),
    source: "line",
    task_id: options.taskId || null,
    source_event_id: options.sourceEventId || null,
    source_message_id: options.sourceMessageId || null,
    source_user_id: options.sourceUserId || null,
    source_user_fingerprint: options.sourceUserFingerprint || null,
    idempotency_key: options.idempotencyKey || null,
    operation_fingerprint: options.operationFingerprint || null,
  };
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const suffix = attempt ? `_${attempt}` : "";
    const file = `idea_${ideaTimestampForFile()}${suffix}.json`;
    const filePath = path.join(dir, file);
    try {
      const handle = await fs.open(filePath, "wx");
      await handle.writeFile(`${JSON.stringify(data, null, 2)}\n`);
      await handle.close();
      return { ok: true, action: "save", duplicate: false, file, text: options.text, idempotency_key: options.idempotencyKey || null, operation_fingerprint: options.operationFingerprint || null, dir };
    } catch (error) {
      if (error?.code !== "EEXIST" || attempt === 4) throw error;
    }
  }
  throw new Error("Unable to create idea file");
}

export async function updateIdea(options, dir = IDEA_DIR) {
  if (!options?.text) throw new Error("Missing replacement text");
  const target = await resolveTarget(options, dir);
  const updated = {
    ...target.data,
    previous_text: target.text,
    text: options.text,
    updated_at: taipeiNow(),
  };
  await fs.writeFile(target.path, `${JSON.stringify(updated, null, 2)}\n`);
  return { ok: true, action: "update", file: target.file, previous_text: target.text, text: options.text, dir };
}

export async function deleteIdea(options, dir = IDEA_DIR, deletedDir = DELETED_DIR) {
  const target = await resolveTarget(options, dir);
  await fs.mkdir(deletedDir, { recursive: true });
  const destination = path.join(deletedDir, target.file);
  await fs.rename(target.path, destination);
  return { ok: true, action: "delete", file: target.file, from_dir: dir, deleted_dir: deletedDir };
}

async function main() {
  const options = parseArgs(process.argv);
  if (!["search", "save", "update", "delete"].includes(options.command)) {
    throw new Error("Usage: node codex-inbox/idea-tools.js search|save|update|delete [--query text] [--period all|day|month|year] [--text text] [--file idea_...json] [--latest]");
  }
  const matches = options.command === "search"
    ? (await searchIdeas(options.query)).filter((idea) => matchesPeriod(idea, options.period))
    : null;
  const result = matches
    ? { ok: true, action: "search", count: matches.length, items: matches.slice(0, 10).map((idea) => ({ file: idea.file, text: idea.text, created_at: idea.data.created_at || null })) }
    : options.command === "save"
      ? await saveIdea(options)
      : options.command === "update"
        ? await updateIdea(options)
        : await deleteIdea(options);
  console.log(JSON.stringify(result, null, 2));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
