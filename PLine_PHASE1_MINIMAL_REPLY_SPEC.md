# PLine 第一階段最小 Reply 規格

最後更新：2026-07-15

---

## 目標

在 TEST 環境中，讓 LINE 使用者傳送任意文字後收到固定回覆：

```text
記好了 ✨
```

---

## 範圍

本規格只定義第一階段最小主流程。

包含：

1. 接收 LINE Webhook 文字事件
2. 取得本次事件可用的 reply token
3. 呼叫 LINE Reply API
4. 回覆固定文字
5. 由 `PLine｜TEST｜測試與驗收` 確認 LINE 端實際收到訊息

不包含：

- 訊息內容解析
- JSON 儲存
- Dropbox
- n8n
- AI 判斷
- 任務分類
- Codex 派工
- FORMAL 環境

---

## 驗收條件

第一階段成功必須同時符合：

1. TEST LINE 帳號送出任意文字。
2. Webhook 有收到事件。
3. Reply API 有被呼叫且沒有失敗。
4. LINE 對話中收到 `記好了 ✨`。

只看文件或本機推論不算完成。

---

## 失敗時先看

若沒有收到回覆，依序確認：

1. LINE Webhook 是否有收到事件。
2. reply token 是否存在且尚可使用。
3. Reply API 是否回傳錯誤。
4. Channel access token / secret 是否在 TEST 環境設定正確。
5. 是否誤碰 FORMAL 或舊專案設定。

Debug 時只修主流程，不新增 Gate、Thread、Tool、Trace 或 State Machine。
