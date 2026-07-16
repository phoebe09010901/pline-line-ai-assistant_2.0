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

function parseArgs(argv) {
  const options = { command: argv[2], query: "", text: "", file: "", latest: false };
  for (let index = 3; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--query") options.query = argv[++index] || "";
    else if (arg === "--text") options.text = argv[++index] || "";
    else if (arg === "--file") options.file = argv[++index] || "";
    else if (arg === "--latest") options.latest = true;
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
  if (!["search", "update", "delete"].includes(options.command)) {
    throw new Error("Usage: node codex-inbox/idea-tools.js search|update|delete [--query text] [--text text] [--file idea_...json] [--latest]");
  }
  const matches = options.command === "search" ? await searchIdeas(options.query) : null;
  const result = matches
    ? { ok: true, action: "search", count: matches.length, items: matches.slice(0, 10).map((idea) => ({ file: idea.file, text: idea.text, created_at: idea.data.created_at || null })) }
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
