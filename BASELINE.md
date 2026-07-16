# 菲比 LINE 智能助理_02｜Baseline

日期：2026-07-16

完成日期：2026-07-16 08:20 Asia/Taipei

---

## Baseline 名稱

`v2.0-line-n8n-dropbox-baseline`

本 baseline 保存目前已通過的 TEST 主流程：

```text
LINE
→ Worker
→ 查詢文字：Worker 直接分流至 local-query-api
→ 記錄文字：n8n V2.0 → TEST Dropbox JSON
→ LINE Reply
```

---

## PASS 證據

- LINE Webhook：PASS
- LINE 記錄想法與固定回覆：PASS
- Worker → n8n V2.0：PASS
- n8n → TEST Dropbox JSON：PASS
- local-query-api 日／月／年查詢：PASS
- Worker 直接查詢分流：PASS
- n8n 記錄流程：PASS
- 搜尋：PASS
- 查看：PASS
- 修改：PASS
- 刪除：PASS
- 分類記錄：PASS
- 分類搜尋：PASS
- Codex queue pending task：PASS
- local-query-api 本機 HTTP 200：PASS
- local-query-api 同一 HTTPS tunnel HTTP 200：PASS
- n8n HTTP response：`200`
- LINE Reply `記好了 ✨`：PASS
- LINE「菲比智能客服 測試」已收到 `記好了 ✨`
- 本月 LINE 查詢 PASS，數量 4
- 今年 LINE 查詢 PASS，數量 4
- 四項 LINE 查詢 PASS：本月數量、本月列表、本年數量、本年列表
- 查詢新增 JSON = 0
- 記錄測試新增 JSON = 1
- duplicate JSON = 0
- duplicate reply = 0
- 查詢未送 n8n
- 分類測試 JSON：`category=網站`
- 分類測試 JSON：`text` 已移除 `［網站］`
- 分類測試 JSON：`original_text` 保留
- 刪除測試資料已移至 `想法紀錄_TEST_已刪除`
- Codex queue 測試前 2、測試後 3，新增 1 筆 pending

補充：先前 TEST 中查詢分類曾失敗，後由 Worker 路由優先順序修正後 PASS。

---

## 固定資訊

- Worker 名稱：`pline-v2-0-test-line-gateway-r2c3b`
- Worker 最終版本：`3b55cc36-30cf-491f-8abd-2a9bec0d62a5`
- Worker 檔案：`workers/pline-v2-0-test-line-gateway-r2c3b/src/index.js`
- n8n workflow 名稱：`PLine｜菲比 LINE 智能助理｜V2.0`
- n8n 狀態：僅保留既有成功記錄流程，未新增查詢路由
- n8n workflow 匯出檔：`n8n/baseline/PLine_V2.0_LINE_N8N_DROPBOX_PASS.json`
- n8n workflow 匯出狀態：已清除 credentials metadata，已檢查未包含 token、secret、credentials
- local-query-api：`local-query-api/server.js`
- local-query-api actions：`count_day`、`list_day`、`count_month`、`list_month`、`count_year`、`list_year`
- TEST Dropbox 固定路徑：`/Users/phoebe/Library/CloudStorage/Dropbox/codex專案/菲比 LINE 智能助理_02/想法紀錄_TEST`
- Dropbox 檔名格式：`idea_YYYY-MM-DD_HH-mm-ss.json`

---

## 本 baseline 已加入

- TEST Dropbox JSON 寫入
- 日／月／年想法查詢
- 搜尋、查看、修改、刪除
- 分類記錄與分類搜尋
- Codex queue pending task
- Worker 直接查詢分流
- n8n 記錄流程

---

## 尚未加入

- AI 分析
- 自然語言分類
- Codex 派工
- Database
- 複雜 Gate / trace / diagnostic / preflight / review / recovery / handoff / 狀態機 / 安全層

---

## 邊界

- 只保存目前成功版本作為正式開發基準。
- 不修改目前已成功的 Worker。
- 不修改目前已成功的 n8n workflow。
- n8n 僅保留既有成功記錄流程，未新增查詢路由。
- 不碰 FORMAL。
- 不修改舊專案：`/Users/phoebe/Documents/菲比 LINE 智能助理`
- 不保存 token、secret 或 credentials。
- 不 push。

---

## Baseline 狀態

```text
BASELINE_STATUS=created
LINE_WEBHOOK=passed
LINE_TO_WORKER=passed
WORKER_DIRECT_QUERY_ROUTING=passed
WORKER_TO_N8N_V2_0=passed
N8N_TO_TEST_DROPBOX_JSON=passed
LOCAL_QUERY_API_ACTIONS=count_day,list_day,count_month,list_month,count_year,list_year
QUERY_DAY_MONTH_YEAR=passed
SEARCH_VIEW_EDIT_DELETE=passed
CATEGORY_RECORD=passed
CATEGORY_SEARCH=passed
CODEX_QUEUE_PENDING_TASK=passed
MONTH_QUERY_COUNT=4
YEAR_QUERY_COUNT=4
QUERY_ADDED_JSON=0
RECORD_TEST_ADDED_JSON=1
QUERY_SENT_TO_N8N=false
CATEGORY_JSON_CATEGORY=網站
CATEGORY_JSON_TEXT_PREFIX_REMOVED=true
CATEGORY_JSON_ORIGINAL_TEXT_PRESERVED=true
DELETED_TEST_DATA_MOVED_TO=想法紀錄_TEST_已刪除
CODEX_QUEUE_BEFORE=2
CODEX_QUEUE_AFTER=3
CODEX_QUEUE_ADDED_PENDING=1
LINE_REPLY_FIXED_TEXT=passed
WORKER_FINAL_VERSION=3b55cc36-30cf-491f-8abd-2a9bec0d62a5
DROPBOX_PATH=/Users/phoebe/Library/CloudStorage/Dropbox/codex專案/菲比 LINE 智能助理_02/想法紀錄_TEST
DROPBOX_FILENAME=idea_YYYY-MM-DD_HH-mm-ss.json
DUPLICATE_JSON=0
DUPLICATE_REPLY=0
FORMAL_ALLOWED=false
DROPBOX_ADDED=true
JSON_STORAGE_ADDED=true
AI_ADDED=false
OLD_PROJECT_MODIFIED=false
N8N_QUERY_ROUTING_ADDED=false
```
