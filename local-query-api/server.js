import { createServer } from "node:http";
import { promises as fs } from "node:fs";
import path from "node:path";

const PORT = Number(process.env.PORT || 8787);
const DATA_DIR = "/Users/phoebe/Library/CloudStorage/Dropbox/codex專案/菲比 LINE 智能助理_02/想法紀錄_TEST";
const DELETED_DIR = "/Users/phoebe/Library/CloudStorage/Dropbox/codex專案/菲比 LINE 智能助理_02/想法紀錄_TEST_已刪除";
const CODEX_QUEUE_DIR = "/Users/phoebe/Documents/菲比 LINE 智能助理_02/codex-queue";
const FILE_PATTERN = /^idea_\d{4}-\d{2}-\d{2}_.*\.json$/;
const CATEGORY_PATTERN = /^［(網站|報價|課程)］\s*/;
let recentSearchResults = [];

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

async function searchItems(keyword) {
  const names = await fs.readdir(DATA_DIR);
  const normalizedKeyword = String(keyword).toLocaleLowerCase();
  const items = [];
  for (const name of names.filter((value) => FILE_PATTERN.test(value))) {
    const file = path.join(DATA_DIR, name);
    try {
      const data = JSON.parse(await fs.readFile(file, "utf8"));
      const fields = [data.text, data.original_text, data.category]
        .filter((value) => typeof value === "string")
        .map((value) => value.toLocaleLowerCase());
      if (fields.some((value) => value.includes(normalizedKeyword))) {
        items.push({
          id: name,
          file,
          data,
          text: typeof data.text === "string" ? data.text : (data.original_text || ""),
          created_at: data.created_at || null,
        });
      }
    } catch {
      // Ignore incomplete or invalid synced files.
    }
  }
  return items.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
}

function visibleItems(items) {
  return items.map(({ id, text, created_at, data }) => ({ id, text, created_at, category: data?.category || "" }));
}

function numberedReply(title, items) {
  return `${title}\n\n${items.map((item, index) => `${index + 1}. ${item.text}`).join("\n")}`;
}

async function searchCategory(category) {
  const items = await searchItems(category);
  return items.filter((item) => item.data.category === category);
}

async function allItems() {
  const names = await fs.readdir(DATA_DIR);
  const items = [];
  for (const name of names.filter((value) => FILE_PATTERN.test(value))) {
    const file = path.join(DATA_DIR, name);
    try {
      const data = JSON.parse(await fs.readFile(file, "utf8"));
      const text = typeof data.text === "string" ? data.text : data.original_text;
      if (typeof text === "string") items.push({ id: name, file, data, text, created_at: data.created_at || null });
    } catch {
      // Ignore incomplete or invalid synced files.
    }
  }
  return items.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
}

function selectedItem(index) {
  const number = Number(index);
  return Number.isInteger(number) && number >= 1 ? recentSearchResults[number - 1] : null;
}

function parseCategory(text) {
  const match = String(text).match(CATEGORY_PATTERN);
  return {
    category: match?.[1] || null,
    text: String(text).replace(CATEGORY_PATTERN, ""),
  };
}

function taipeiTimestamp() {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).formatToParts(new Date());
  return Object.fromEntries(parts.filter(({ type }) => type !== "literal").map(({ type, value }) => [type, value]));
}

async function recordItem(body) {
  const originalText = typeof body.original_text === "string" ? body.original_text : "";
  const text = typeof body.text === "string" ? body.text : "";
  const category = typeof body.category === "string" ? body.category : "";
  const now = taipeiTimestamp();
  const createdAt = `${now.year}-${now.month}-${now.day}T${now.hour}:${now.minute}:${now.second}+08:00`;
  const baseName = `idea_${now.year}-${now.month}-${now.day}_${now.hour}-${now.minute}-${now.second}`;
  let file = path.join(DATA_DIR, `${baseName}.json`);
  let suffix = 1;
  while (true) {
    try {
      await fs.access(file);
      file = path.join(DATA_DIR, `${baseName}-${suffix++}.json`);
    } catch {
      break;
    }
  }
  await fs.writeFile(file, `${JSON.stringify({
    category, text, original_text: originalText, created_at: createdAt,
    source: "LINE", project: "菲比 LINE 智能助理_02", version: "V2.0",
  }, null, 2)}\n`, "utf8");
  return { status: 200, body: { ok: true, action: "record", reply_text: "記好了 ✨" } };
}

async function updateItem(index, text) {
  const item = selectedItem(index);
  if (!item) return { status: 200, body: { ok: true, reply_text: "請先搜尋想法，再告訴我要修改第幾筆喔 ✨" } };
  const parsed = parseCategory(text);
  const data = { ...item.data, text: parsed.text, updated_at: new Date().toISOString() };
  if (parsed.category) data.category = parsed.category;
  await fs.writeFile(item.file, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  item.data = data;
  item.text = parsed.text;
  item.created_at = data.created_at || null;
  return { status: 200, body: { ok: true, action: "update_item", index: Number(index), reply_text: `已修改第 ${Number(index)} 筆 ✨` } };
}

async function deleteItem(index) {
  const item = selectedItem(index);
  if (!item) return { status: 200, body: { ok: true, reply_text: "請先搜尋想法，再告訴我要刪除第幾筆喔 ✨" } };
  await fs.mkdir(DELETED_DIR, { recursive: true });
  await fs.rename(item.file, path.join(DELETED_DIR, item.id));
  return { status: 200, body: { ok: true, action: "delete_item", index: Number(index), reply_text: `已刪除第 ${Number(index)} 筆 ✨` } };
}

async function codexTask(index) {
  const item = selectedItem(index);
  if (!item) return { status: 200, body: { ok: true, reply_text: "請先搜尋想法，再告訴我要交給 Codex 第幾筆喔 ✨" } };
  await fs.mkdir(CODEX_QUEUE_DIR, { recursive: true });
  const stamp = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).format(new Date()).replace(/[-: ]/g, (value) => value === " " ? "_" : "").replace(/T/, "_");
  const queueFile = path.join(CODEX_QUEUE_DIR, `task_${stamp}.json`);
  await fs.writeFile(queueFile, `${JSON.stringify({ idea_text: item.text, created_at: item.created_at, status: "pending" }, null, 2)}\n`, "utf8");
  return { status: 200, body: { ok: true, action: "codex_task", index: Number(index), reply_text: `已將第 ${Number(index)} 筆交給 Codex 處理 ✨` } };
}

async function handleQuery(body) {
  const action = body?.action;
  if (action === "record") return recordItem(body);
  if (action === "search") {
    const keyword = typeof body?.keyword === "string" ? body.keyword : "";
    const items = await searchItems(keyword);
    recentSearchResults = items;
    const limited = items.slice(0, 10);
    return {
      status: 200,
      body: {
        ok: true,
        action,
        keyword,
        count: items.length,
        items: visibleItems(limited),
        reply_text: items.length
          ? `找到 ${items.length} 筆和「${keyword}」有關的記錄：\n\n${limited.map((item, index) => `${index + 1}. ${item.text}`).join("\n")}`
          : `沒有找到和「${keyword}」有關的記錄喔 ✨`,
      },
    };
  }

  if (action === "search_category") {
    const category = typeof body?.category === "string" ? body.category : "";
    const items = await searchCategory(category);
    recentSearchResults = items;
    const limited = items.slice(0, 10);
    return {
      status: 200,
      body: {
        ok: true, action, category, count: items.length, items: visibleItems(limited),
        reply_text: items.length ? numberedReply(`找到 ${items.length} 筆「${category}」分類記錄：`, limited) : `沒有找到「${category}」分類的記錄喔 ✨`,
      },
    };
  }

  if (action === "list_all" || action === "list_recent") {
    const items = await allItems();
    recentSearchResults = items;
    const limited = items.slice(0, 10);
    const label = action === "list_recent" ? "最近記錄：" : "所有想法：";
    return { status: 200, body: { ok: true, action, count: items.length, items: visibleItems(limited), reply_text: limited.length ? numberedReply(label, limited) : "目前還沒有記錄想法喔 ✨" } };
  }

  if (action === "count_all") {
    const items = await allItems();
    return { status: 200, body: { ok: true, action, count: items.length, reply_text: `目前共記錄 ${items.length} 筆 ✨` } };
  }

  if (["get_item", "update_item", "delete_item", "codex_task"].includes(action)) {
    if (action === "get_item") {
      const item = selectedItem(body?.index);
      return item
        ? { status: 200, body: { ok: true, action, index: Number(body.index), text: item.text, created_at: item.created_at, original_text: item.data.original_text || null, reply_text: `第 ${Number(body.index)} 筆：${item.text}\n建立時間：${item.created_at || "未知"}` } }
        : { status: 200, body: { ok: true, action, reply_text: "請先搜尋想法，再告訴我要看第幾筆喔 ✨" } };
    }
    if (action === "update_item") return updateItem(body?.index, body?.text);
    if (action === "delete_item") return deleteItem(body?.index);
    return codexTask(body?.index);
  }

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
