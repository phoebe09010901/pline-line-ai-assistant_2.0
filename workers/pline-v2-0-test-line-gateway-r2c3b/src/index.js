const LINE_REPLY_API_URL = "https://api.line.me/v2/bot/message/reply";
const RECEIVED_REPLY = "收到，已交給 Codex ✨";
const PROJECT = "菲比 LINE 智能助理_02";
const WORKER_NAME = "pline-v2-0-test-line-gateway-r2c3b";

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

async function writeInboxTask(event, env) {
  const lineEventId = typeof event.webhookEventId === "string" && event.webhookEventId
    ? event.webhookEventId
    : typeof event.replyToken === "string" ? event.replyToken : `event-${Date.now()}`;
  const id = taskId(event, lineEventId);
  const key = `pending/${id}.json`;
  const seenKey = `events/${lineEventId}`;
  const task = {
    task_id: id,
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
  return { duplicate: false };
}

async function replyToLine(event, env) {
  if (!env.LINE_CHANNEL_ACCESS_TOKEN) throw new Error("LINE_CHANNEL_ACCESS_TOKEN binding is missing");
  const response = await fetch(LINE_REPLY_API_URL, {
    method: "POST",
    headers: { authorization: `Bearer ${env.LINE_CHANNEL_ACCESS_TOKEN}`, "content-type": "application/json" },
    body: JSON.stringify({ replyToken: event.replyToken, messages: [{ type: "text", text: RECEIVED_REPLY }] }),
  });
  if (!response.ok) console.error("line_reply_failed", { status: response.status });
}

export default {
  async fetch(request, env) {
    if (request.method === "GET") return json({ ok: true, worker: WORKER_NAME, version: "V3.0" });
    if (request.method === "POST" && new URL(request.url).pathname === "/internal/final-push") {
      let body;
      try { body = await request.json(); } catch { return json({ ok: false, error: "invalid_json" }, 400); }
      const task = body?.task_id && env.CODEX_INBOX ? await env.CODEX_INBOX.get(`completed/${body.task_id}.json`, "json") : null;
      if (!task?.user_id || typeof body.text !== "string" || !body.text.trim()) return json({ ok: false, error: "missing_task_target" }, 400);
      if (!env.LINE_CHANNEL_ACCESS_TOKEN) return json({ ok: false, error: "missing_runtime_binding" }, 500);
      const response = await fetch("https://api.line.me/v2/bot/message/push", {
        method: "POST",
        headers: { authorization: `Bearer ${env.LINE_CHANNEL_ACCESS_TOKEN}`, "content-type": "application/json" },
        body: JSON.stringify({ to: task.user_id, messages: [{ type: "text", text: body.text }] }),
      });
      return json({ ok: response.ok, status: response.status });
    }
    if (request.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
    let payload;
    try { payload = await request.json(); } catch { return json({ ok: true }); }
    for (const event of Array.isArray(payload.events) ? payload.events : []) {
      if (event?.type !== "message" || event?.message?.type !== "text" || typeof event.replyToken !== "string") continue;
      try {
        const result = await writeInboxTask(event, env);
        if (!result.duplicate) await replyToLine(event, env);
      } catch (error) {
        console.error("inbox_task_failed", { status: "error", summary: error instanceof Error ? error.message : String(error) });
      }
    }
    return json({ ok: true });
  },
};
