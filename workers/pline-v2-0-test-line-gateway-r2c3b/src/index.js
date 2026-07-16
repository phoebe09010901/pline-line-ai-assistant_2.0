const LINE_REPLY_API_URL = "https://api.line.me/v2/bot/message/reply";
const QUICK_ACK_REPLY = "我收到訊息了，馬上幫你處理 ✨";
const QUICK_QUESTION_ACK_REPLY = "我收到問題了，馬上幫你查一下 ✨";
const LONG_TASK_REPLY = "我收到任務了，正在處理中 🛠️\n\n任務編號：{display_task_id}\n\n完成後我會再通知你。";
const PROJECT = "菲比 LINE 智能助理_02";
const WORKER_NAME = "pline-v2-0-test-line-gateway-r2c3b";
const LONG_TASK_HINTS = [
  "修改檔案", "整理專案", "執行程式", "部署", "computer use", "Computer Use",
  "多步驟", "長時間分析", "修正程式", "實作", "開發", "重構",
  "檢查專案", "跑測試", "驗證結果", "建立網站", "產生報告",
];

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8" } });
}

function taipeiNow() {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.filter((p) => p.type !== "literal").map((p) => [p.type, p.value]));
  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}:${values.second}+08:00`;
}

function taskId(event, lineEventId) {
  return event.webhookEventId || lineEventId;
}

function displayTaskId() {
  const timePart = Date.now().toString(36).toUpperCase().slice(-6);
  const randomPart = Math.random().toString(36).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4).padEnd(4, "0");
  return `P-${timePart}-${randomPart}`;
}

function executionMode(text) {
  return LONG_TASK_HINTS.some((hint) => text.includes(hint)) ? "long" : "quick";
}

export function ackUserMessage(text, mode, displayId) {
  if (mode === "long") return LONG_TASK_REPLY.replace("{display_task_id}", displayId);
  return /[?？]/.test(text) ? QUICK_QUESTION_ACK_REPLY : QUICK_ACK_REPLY;
}

async function writeInboxTask(event, env) {
  const lineEventId = typeof event.webhookEventId === "string" && event.webhookEventId
    ? event.webhookEventId
    : typeof event.replyToken === "string" ? event.replyToken : `event-${Date.now()}`;
  const id = taskId(event, lineEventId);
  const mode = executionMode(event.message.text);
  const displayId = displayTaskId();
  const key = `pending/${id}.json`;
  const seenKey = `events/${lineEventId}`;
  const task = {
    task_id: id,
    display_task_id: displayId,
    execution_mode: mode,
    ack_user_message: ackUserMessage(event.message.text, mode, displayId),
    progress_stage: mode === "long" ? "queued" : null,
    progress_user_message: null,
    line_event_id: lineEventId,
    text: event.message.text,
    original_text: event.message.text,
    ...(typeof event.source?.userId === "string" ? { user_id: event.source.userId } : {}),
    source: "LINE",
    status: "pending",
    received_at: taipeiNow(),
    attempts: 0,
    project: PROJECT,
    version: "V3.0",
  };

  if (!env.CODEX_INBOX) throw new Error("CODEX_INBOX binding is missing");
  if (await env.CODEX_INBOX.get(seenKey)) return { duplicate: true };
  await env.CODEX_INBOX.put(seenKey, id);
  await env.CODEX_INBOX.put(key, JSON.stringify(task));
  return { duplicate: false, task };
}

async function replyToLine(event, env, task) {
  if (!env.LINE_CHANNEL_ACCESS_TOKEN) throw new Error("LINE_CHANNEL_ACCESS_TOKEN binding is missing");
  const text = task?.ack_user_message || ackUserMessage(event.message.text, task?.execution_mode, task?.display_task_id);
  const response = await fetch(LINE_REPLY_API_URL, {
    method: "POST",
    headers: { authorization: `Bearer ${env.LINE_CHANNEL_ACCESS_TOKEN}`, "content-type": "application/json" },
    body: JSON.stringify({ replyToken: event.replyToken, messages: [{ type: "text", text }] }),
  });
  if (!response.ok) console.error("line_reply_failed", { status: response.status });
}

async function pushLineText(taskId, text, env) {
  const task = taskId && env.CODEX_INBOX
    ? (await env.CODEX_INBOX.get(`completed/${taskId}.json`, "json"))
      || (await env.CODEX_INBOX.get(`processing/${taskId}.json`, "json"))
      || (await env.CODEX_INBOX.get(`failed/${taskId}.json`, "json"))
    : null;
  if (!task?.user_id || typeof text !== "string" || !text.trim()) return json({ ok: false, error: "missing_task_target" }, 400);
  if (!env.LINE_CHANNEL_ACCESS_TOKEN) return json({ ok: false, error: "missing_runtime_binding" }, 500);
  const response = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: { authorization: `Bearer ${env.LINE_CHANNEL_ACCESS_TOKEN}`, "content-type": "application/json" },
    body: JSON.stringify({ to: task.user_id, messages: [{ type: "text", text }] }),
  });
  return json({ ok: response.ok, status: response.status });
}

export default {
  async fetch(request, env) {
    if (request.method === "GET") return json({ ok: true, worker: WORKER_NAME, version: "V3.0" });
    if (request.method === "POST" && new URL(request.url).pathname === "/internal/final-push") {
      let body;
      try { body = await request.json(); } catch { return json({ ok: false, error: "invalid_json" }, 400); }
      return pushLineText(body?.task_id, body?.text, env);
    }
    if (request.method === "POST" && new URL(request.url).pathname === "/internal/progress-push") {
      let body;
      try { body = await request.json(); } catch { return json({ ok: false, error: "invalid_json" }, 400); }
      return pushLineText(body?.task_id, body?.text, env);
    }
    if (request.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
    let payload;
    try { payload = await request.json(); } catch { return json({ ok: true }); }
    for (const event of Array.isArray(payload.events) ? payload.events : []) {
      if (event?.type !== "message" || event?.message?.type !== "text" || typeof event.replyToken !== "string") continue;
      try {
        const result = await writeInboxTask(event, env);
        if (!result.duplicate) await replyToLine(event, env, result.task);
      } catch (error) {
        console.error("inbox_task_failed", { status: "error", summary: error instanceof Error ? error.message : String(error) });
      }
    }
    return json({ ok: true });
  },
};
