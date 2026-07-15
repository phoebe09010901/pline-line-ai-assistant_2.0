import { createServer } from "node:http";
import { promises as fs } from "node:fs";
import path from "node:path";

const PORT = Number(process.env.PORT || 8787);
const DATA_DIR = "/Users/phoebe/Library/CloudStorage/Dropbox/codex專案/菲比 LINE 智能助理_02/想法紀錄_TEST";
const FILE_PATTERN = /^idea_\d{4}-\d{2}-\d{2}_.*\.json$/;

function taipeiDateParts() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  return Object.fromEntries(parts.filter(({ type }) => type !== "literal").map(({ type, value }) => [type, value]));
}

function todayTaipei() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function monthTaipei() {
  const { year, month } = taipeiDateParts();
  return `${year}-${month}`;
}

function yearTaipei() {
  return taipeiDateParts().year;
}

function sendJson(response, status, body) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
}

async function filesWithPrefix(prefix) {
  const names = await fs.readdir(DATA_DIR);
  return names
    .filter((name) => FILE_PATTERN.test(name) && name.startsWith(`idea_${prefix}`))
    .map((name) => path.join(DATA_DIR, name));
}

async function todayFiles() {
  return filesWithPrefix(`${todayTaipei()}_`);
}

async function readItems(files) {
  const items = [];
  for (const file of files) {
    try {
      const data = JSON.parse(await fs.readFile(file, "utf8"));
      const text = typeof data.text === "string" ? data.text : data.original_text;
      if (typeof text === "string") {
        items.push({ text, created_at: data.created_at || null });
      }
    } catch {
      // Ignore incomplete or invalid synced files.
    }
  }
  return items.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
}

async function handleQuery(body) {
  const action = body?.action;
  if (!["count_day", "list_day", "count_month", "list_month", "count_year", "list_year"].includes(action)) {
    return { status: 400, body: { ok: false, error: "unsupported_action" } };
  }

  const period = action.endsWith("_day")
    ? { files: await todayFiles(), label: "今天", empty: "今天還沒有記錄想法喔 ✨", listLabel: "今天記錄了：" }
    : action.endsWith("_month")
      ? { files: await filesWithPrefix(`${monthTaipei()}-`), label: "本月", empty: "本月還沒有記錄想法喔 ✨", listLabel: "本月最近記錄：" }
      : { files: await filesWithPrefix(`${yearTaipei()}-`), label: "今年", empty: "今年還沒有記錄想法喔 ✨", listLabel: "今年最近記錄：" };
  const files = period.files;
  if (action.startsWith("count_")) {
    return {
      status: 200,
      body: {
        ok: true,
        action,
        count: files.length,
        reply_text: files.length ? `${period.label}共記錄 ${files.length} 筆 ✨` : period.empty,
      },
    };
  }

  const items = await readItems(files);
  const limited = items.slice(0, 10);
  const replyText = files.length
    ? `${period.listLabel}\n\n${limited.map((item, index) => `${index + 1}. ${item.text}`).join("\n")}`
    : period.empty;
  return {
    status: 200,
    body: {
      ok: true,
      action,
      count: files.length,
      items: limited,
      reply_text: replyText,
    },
  };
}

const server = createServer(async (request, response) => {
  try {
    if (request.method === "GET" && request.url === "/health") {
      return sendJson(response, 200, { ok: true });
    }

    if (request.method === "POST" && request.url === "/query") {
      let raw = "";
      for await (const chunk of request) raw += chunk;
      const result = await handleQuery(JSON.parse(raw));
      return sendJson(response, result.status, result.body);
    }

    return sendJson(response, 404, { ok: false, error: "not_found" });
  } catch (error) {
    return sendJson(response, 500, { ok: false, error: "query_failed" });
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`local-query-api listening on http://127.0.0.1:${PORT}`);
});
