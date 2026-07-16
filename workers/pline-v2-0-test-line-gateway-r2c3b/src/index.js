const LINE_REPLY_API_URL = "https://api.line.me/v2/bot/message/reply";
const N8N_WEBHOOK_URL = "https://n8nphy.app.n8n.cloud/webhook/pline-v2-0-test";
const LOCAL_QUERY_API_URL = "https://provide-defined-tim-contributions.trycloudflare.com/query";
const FIXED_REPLY_TEXT = "記好了 ✨";
const QUERY_ERROR_TEXT = "查詢暫時沒有成功，請稍後再試一次 🙏";
const CLASSIFIED_RECORD_PATTERN = /［(網站|報價|課程)］\s*/;

const COUNT_DAY_PHRASES = [
  "我今天記了幾筆",
  "今天有幾個想法",
  "今天記錄幾筆",
  "今天的備忘數量",
];
const LIST_DAY_PHRASES = [
  "列出今天的想法",
  "今天記了什麼",
  "今天的備忘",
  "看今天的記錄",
];
const COUNT_MONTH_PHRASES = [
  "我這個月記了幾筆",
  "本月有幾個想法",
  "本月記錄幾筆",
];
const LIST_MONTH_PHRASES = [
  "列出本月想法",
  "這個月記了什麼",
  "本月的備忘",
];
const COUNT_YEAR_PHRASES = [
  "我今年記了幾筆",
  "今年有幾個想法",
  "今年記錄幾筆",
];
const LIST_YEAR_PHRASES = [
  "列出今年想法",
  "今年記了什麼",
  "今年的備忘",
];

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function summarizeError(text) {
  return text.replace(/\s+/g, " ").slice(0, 180);
}

async function replyToLine(replyToken, replyText, env) {
  if (!env.LINE_CHANNEL_ACCESS_TOKEN) {
    console.error("line_reply_failed", {
      status: "missing_token",
      summary: "LINE_CHANNEL_ACCESS_TOKEN binding is missing",
    });
    return;
  }

  const response = await fetch(LINE_REPLY_API_URL, {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.LINE_CHANNEL_ACCESS_TOKEN}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      replyToken,
      messages: [{ type: "text", text: replyText }],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("line_reply_failed", {
      status: response.status,
      summary: summarizeError(errorText),
    });
  }
}

async function getReplyTextFromN8n(text) {
  try {
    const response = await fetch(N8N_WEBHOOK_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("n8n_forward_failed", {
        status: response.status,
        summary: summarizeError(errorText),
      });
      return null;
    }

    console.log("n8n_forward", { status: response.status });
    const result = await response.json();
    if (
      result?.ok === true &&
      result?.version === "V2.0" &&
      typeof result.reply_text === "string" &&
      result.reply_text.trim().length > 0
    ) {
      return result.reply_text;
    }
    return null;
  } catch (error) {
    console.error("n8n_forward_failed", {
      status: "network_error",
      summary: summarizeError(error instanceof Error ? error.message : String(error)),
    });
    return null;
  }
}

function queryAction(text) {
  if (COUNT_DAY_PHRASES.some((phrase) => text.includes(phrase))) return "count_day";
  if (LIST_DAY_PHRASES.some((phrase) => text.includes(phrase))) return "list_day";
  if (COUNT_MONTH_PHRASES.some((phrase) => text.includes(phrase))) return "count_month";
  if (LIST_MONTH_PHRASES.some((phrase) => text.includes(phrase))) return "list_month";
  if (COUNT_YEAR_PHRASES.some((phrase) => text.includes(phrase))) return "count_year";
  if (LIST_YEAR_PHRASES.some((phrase) => text.includes(phrase))) return "list_year";
  return null;
}

function directQuery(text) {
  let match = text.match(/^列出(.+?)類想法$/);
  if (match) return { action: "search_category", category: match[1] };
  match = text.match(/^搜尋分類(.+)$/);
  if (match) return { action: "search_category", category: match[1] };
  match = text.match(/^幫我找跟(.+?)有關的想法$/);
  if (match) return { action: "search", keyword: match[1] };
  match = text.match(/^(?:搜尋|找)(.+)$/);
  if (match) return { action: "search", keyword: match[1] };
  match = text.match(/^(?:看|查看)第\s*(\d+)\s*筆$/);
  if (match) return { action: "get_item", index: Number(match[1]) };
  match = text.match(/^(?:把第\s*(\d+)\s*筆改成|修改第\s*(\d+)\s*筆為)(.+)$/);
  if (match) return { action: "update_item", index: Number(match[1] || match[2]), text: match[3].trim() };
  match = text.match(/^(?:刪除第\s*(\d+)\s*筆|把第\s*(\d+)\s*筆刪掉)$/);
  if (match) return { action: "delete_item", index: Number(match[1] || match[2]) };
  match = text.match(/^(?:把第\s*(\d+)\s*筆派給 Codex|請 Codex 分析第\s*(\d+)\s*筆)$/);
  if (match) return { action: "codex_task", index: Number(match[1] || match[2]) };
  return null;
}

function classifiedRecordQuery(text) {
  const match = text.match(CLASSIFIED_RECORD_PATTERN);
  if (!match) return null;
  return {
    action: "record",
    text: text.replace(CLASSIFIED_RECORD_PATTERN, "").replace(/^阿光，記一下\s*/, ""),
    original_text: text,
    category: match[1],
  };
}

async function getReplyTextFromQuery(query) {
  try {
    const response = await fetch(LOCAL_QUERY_API_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(query),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("query_failed", {
        status: response.status,
        summary: summarizeError(errorText),
      });
      return QUERY_ERROR_TEXT;
    }

    const result = await response.json();
    if (typeof result?.reply_text === "string" && result.reply_text.trim().length > 0) {
      return result.reply_text;
    }

    console.error("query_failed", { status: response.status, summary: "missing_reply_text" });
  } catch (error) {
    console.error("query_failed", {
      status: "network_error",
      summary: summarizeError(error instanceof Error ? error.message : String(error)),
    });
  }
  return QUERY_ERROR_TEXT;
}

export default {
  async fetch(request, env) {
    if (request.method === "GET") {
      return jsonResponse({ ok: true, worker: "pline-v2-0-test-line-gateway-r2c3b" });
    }

    if (request.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    let payload;
    try {
      payload = await request.json();
    } catch {
      return jsonResponse({ ok: true });
    }

    const events = Array.isArray(payload.events) ? payload.events : [];
    await Promise.all(
      events.map(async (event) => {
        if (
          event?.type === "message" &&
          event?.message?.type === "text" &&
          typeof event.replyToken === "string" &&
          event.replyToken.length > 0
        ) {
          const action = queryAction(event.message.text);
          const classifiedRecord = classifiedRecordQuery(event.message.text);
          const directQueryRequest = directQuery(event.message.text);
          const replyText = classifiedRecord
            ? await getReplyTextFromQuery(classifiedRecord)
            : directQueryRequest
              ? await getReplyTextFromQuery(directQueryRequest)
            : action
              ? await getReplyTextFromQuery({ action })
              : (await getReplyTextFromN8n(event.message.text)) || FIXED_REPLY_TEXT;
          await replyToLine(event.replyToken, replyText, env);
        }
      }),
    );

    return jsonResponse({ ok: true });
  },
};
