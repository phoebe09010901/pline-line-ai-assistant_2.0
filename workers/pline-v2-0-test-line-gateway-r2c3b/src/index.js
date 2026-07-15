const LINE_REPLY_API_URL = "https://api.line.me/v2/bot/message/reply";
const N8N_WEBHOOK_URL = "https://n8nphy.app.n8n.cloud/webhook/pline-v2-0-test";
const FIXED_REPLY_TEXT = "記好了 ✨";

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function summarizeError(text) {
  return text.replace(/\s+/g, " ").slice(0, 180);
}

async function replyToLine(replyToken, env) {
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
      messages: [{ type: "text", text: FIXED_REPLY_TEXT }],
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

async function forwardToN8n(text) {
  try {
    const response = await fetch(N8N_WEBHOOK_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),
    });

    if (response.ok) {
      console.log("n8n_forward", { status: response.status });
      return;
    }

    const errorText = await response.text();
    console.error("n8n_forward_failed", {
      status: response.status,
      summary: summarizeError(errorText),
    });
  } catch (error) {
    console.error("n8n_forward_failed", {
      status: "network_error",
      summary: summarizeError(error instanceof Error ? error.message : String(error)),
    });
  }
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
          await forwardToN8n(event.message.text);
          await replyToLine(event.replyToken, env);
        }
      }),
    );

    return jsonResponse({ ok: true });
  },
};
