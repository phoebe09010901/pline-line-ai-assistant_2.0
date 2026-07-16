import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));

export const ACCOUNTING_TARGET_FILE = process.env.PLINE_ACCOUNTING_TARGET_FILE
  || "/Users/phoebe/Library/CloudStorage/Dropbox/菲比工作總倉庫/90_TEMP_處理中暫存/菲比帳務明細.csv";

function taipeiDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function defaultAccountingSourceFile() {
  return path.join(ROOT, `accounting_${taipeiDate()}.csv`);
}

function parseArgs(argv) {
  const options = { command: argv[2], source: "", target: "", requiredText: "" };
  for (let index = 3; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--source") options.source = argv[++index] || "";
    else if (arg === "--target") options.target = argv[++index] || "";
    else if (arg === "--required-text") options.requiredText = argv[++index] || "";
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

export async function syncAccountingCsv(options = {}) {
  const source = options.source || defaultAccountingSourceFile();
  const target = options.target || ACCOUNTING_TARGET_FILE;
  const sourceContent = await fs.readFile(source, "utf8");
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, sourceContent);
  const targetContent = await fs.readFile(target, "utf8");
  if (targetContent !== sourceContent) {
    throw new Error("Accounting CSV target verification failed: target content differs from source");
  }
  if (options.requiredText && !targetContent.includes(options.requiredText)) {
    throw new Error("Accounting CSV target verification failed: required text missing from target");
  }
  const stat = await fs.stat(target);
  return {
    ok: true,
    action: "sync-accounting-csv",
    source,
    target,
    bytes: stat.size,
    verified: true,
    required_text_present: options.requiredText ? targetContent.includes(options.requiredText) : null,
  };
}

async function main() {
  const options = parseArgs(process.argv);
  if (options.command !== "sync") {
    throw new Error("Usage: node codex-inbox/accounting-tools.js sync [--source file] [--target file] [--required-text text]");
  }
  console.log(JSON.stringify(await syncAccountingCsv(options), null, 2));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
