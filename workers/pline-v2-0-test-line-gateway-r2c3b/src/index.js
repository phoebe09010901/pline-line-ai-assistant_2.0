const LINE_REPLY_API_URL = "https://api.line.me/v2/bot/message/reply";
const N8N_WEBHOOK_URL = "https://n8nphy.app.n8n.cloud/webhook/pline-v2-0-test";
const LOCAL_QUERY_API_URL = "https://breeding-associates-eagles-solomon.trycloudflare.com/query";
const FIXED_REPLY_TEXT = "記好了 ✨";
const QUERY_ERROR_TEXT = "查詢暫時沒有成功，請稍後再試一次 🙏";
const CLARIFY_TEXT = "我不太確定妳是要記錄、查詢，還是修改，可以再說清楚一點嗎？✨";
const CLASSIFIED_RECORD_PATTERN = /［(網站|報價|課程)］\s*/;
const CHINESE_NUMBERS = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };

const COUNT_DAY_PHRASES = [
  "今天記了幾筆",
  "今天有幾筆",
  "今天記錄了幾筆",
  "我今天記了幾筆",
  "今天有多少筆紀錄",
  "今天有多少筆想法",
  "阿光現在有幾筆紀錄了",
  "現在記了幾筆",
  "目前有幾筆想法",
  "你幫我記了幾筆",
  "我是問你現在紀錄了幾筆",
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
  "本月記了幾筆",
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
  "今年記了幾筆",
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
    const raw = await response.text();
    let result = null;
    try {
      result = JSON.parse(raw);
    } catch {
      return FIXED_REPLY_TEXT;
    }
    if (
      result?.ok === true &&
      result?.version === "V2.0" &&
      typeof result.reply_text === "string" &&
      result.reply_text.trim().length > 0
    ) {
      return result.reply_text;
    }
    // A successful V2.0 record may return only its transport/result envelope.
    // The record flow already completed at HTTP 200, so keep its fixed reply.
    return FIXED_REPLY_TEXT;
  } catch (error) {
    console.error("n8n_forward_failed", {
      status: "network_error",
      summary: summarizeError(error instanceof Error ? error.message : String(error)),
    });
    return null;
  }
}

function parseIndex(text) {
  if (/(剛才|剛剛|最近|最新).{0,6}(那筆|想法|記錄)/.test(text)) return 1;
  const match = text.match(/(?:第\s*)?([一二三四五六七八九十]|\d+)\s*(?:筆|個|項)/);
  return match ? (Number(match[1]) || CHINESE_NUMBERS[match[1]] || null) : null;
}

function periodFor(text) {
  if (text.includes("本月") || text.includes("這個月")) return "month";
  if (text.includes("今年")) return "year";
  if (text.includes("所有") || text.includes("全部") || text.includes("全量") || text.includes("目前的想法")) return "all";
  if (text.includes("最近") || text.includes("最新")) return "recent";
  if (text.includes("今天") || text.includes("現在") || text.includes("目前") || text.includes("剛才") || text.includes("剛剛")) return "day";
  return "all";
}

function countAction(text) {
  const period = periodFor(text);
  return { action: period === "month" ? "count_month" : period === "year" ? "count_year" : period === "all" ? "count_all" : "count_day" };
}

function listActionForPeriod(text) {
  const period = periodFor(text);
  if (period === "month") return "list_month";
  if (period === "year") return "list_year";
  if (period === "recent") return "list_recent";
  if (period === "all") return "list_all";
  return "list_day";
}

function extractKeyword(text) {
  const match = text.match(/(?:搜尋|找)(.+?)(?:相關的?想法|有關的?想法|的想法|的紀錄|$)/);
  return match?.[1]?.trim() || "";
}

function classifyIntent(text) {
  const index = parseIndex(text);
  const hasOperation = /(幾筆|多少筆|紀錄數量|列出|給我看|有哪些|目前的想法|所有想法|最近想法|查看|看|搜尋|找|修改|改成|改為|刪除|刪掉|派給\s*Codex|交給\s*Codex|請\s*Codex|第\s*[一二三四五六七八九十\d]+\s*(筆|個|項)|剛才那筆|剛剛那筆|最近那筆)/i.test(text);
  if (/(幾筆|多少(?:筆|個|東西|紀錄|想法)|紀錄數量)/.test(text)) return countAction(text);
  if (/(刪除|刪掉)/.test(text)) return index ? { action: "delete_item", index } : { action: "clarify" };
  if (/(派給\s*Codex|交給\s*Codex|請\s*Codex)/i.test(text)) return index ? { action: "codex_task", index } : { action: "clarify" };
  if (/(修改|改成|改為)/.test(text)) {
    const updatedText = text.match(/(?:改成|改為|修改.+?為)(.+)$/)?.[1]?.trim();
    return index && updatedText ? { action: "update_item", index, text: updatedText } : { action: "clarify" };
  }
  if (text.includes("搜尋分類")) return { action: "search_category", category: text.replace(/^.*搜尋分類/, "").trim() };
  const categoryMatch = text.match(/(?:列出|搜尋|把)?\s*(網站|報價|課程)(?:的)?類?(?:想法|紀錄)/);
  if (categoryMatch && /(列出|搜尋|紀錄|想法)/.test(text)) return { action: "search_category", category: categoryMatch[1] };
  if (/(查看|看|詳細內容)/.test(text) && index) return { action: "get_item", index };
  if (/(列出|給我看|有哪些|目前的想法|所有想法|最近想法|最近記了什麼)/.test(text)) return { action: listActionForPeriod(text) };
  if (/(搜尋|找)/.test(text)) {
    const keyword = extractKeyword(text);
    return keyword ? { action: "search", keyword } : { action: "clarify" };
  }
  if (hasOperation) return { action: "clarify" };
  if (/(記一下|幫我記|記錄|新增想法|我想到)/.test(text)) return { action: "record_intent" };
  return { action: "clarify" };
}

function queryAction(text) {
  const result = classifyIntent(text);
  return result.action === "record_intent" || result.action === "clarify" ? null : result.action;
}

function legacyListActionForPeriod(text) {
  if (text.includes("本月")) return "list_month";
  if (text.includes("今年")) return "list_year";
  if (text.includes("今天")) return "list_day";
  return "list_year";
}

function directQuery(text) {
  const result = classifyIntent(text);
  return result.action === "record_intent" || result.action === "clarify" ? null : result;
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
          const intent = classifyIntent(event.message.text);
          const classifiedRecord = classifiedRecordQuery(event.message.text);
          const replyText = classifiedRecord
            ? await getReplyTextFromQuery(classifiedRecord)
            : intent.action === "record_intent"
              ? await getReplyTextFromN8n(event.message.text) || QUERY_ERROR_TEXT
              : intent.action === "clarify"
                ? CLARIFY_TEXT
                : await getReplyTextFromQuery(intent);
          await replyToLine(event.replyToken, replyText, env);
        }
      }),
    );

    return jsonResponse({ ok: true });
  },
};
