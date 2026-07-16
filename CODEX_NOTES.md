# CODEX NOTES

---

# 核心原則

保持簡單。

先讓功能真正跑通，再增加功能。

本輪 V3 文件結論以 `v3/codex-line-inbox` 的 closed-loop verification 為準，不以舊 V2 / 第一版 Dropbox baseline 或 receive-only checkpoint 作為目前結論。

目前階段採用：

```text
綠燈不可破壞＋功能優先模式
```

---

# V3.0 mainline｜Codex LINE closed-loop verification

## V3.0 真實閉環驗收

V3.0 Codex LINE Inbox 已完成真實單筆 / 三筆閉環驗收。

- existing release commit：`7287cf5f254ca45782d7f5b262b1e698f16e7622`
- existing tag：`v3.0-codex-line-inbox-complete`
- 真實使用 checkpoint tag：`v3.0-inbox-receive-checkpoint`
- branch：`v3/codex-line-inbox`
- LINE Webhook 接收 PASS
- LINE 即時 ACK `收到，已交給 Codex ✨` PASS，三筆各 1 次
- inbox 狀態結構與競態驗收已有 PASS 證據
- duplicate execution = 0
- Codex monitor 真正常駐 PASS，本輪 monitor 已 claim 三筆任務
- Codex 實際執行 PASS，本輪完成 Dropbox 寫入 / 想法查詢 / 專案狀態查詢
- Codex 使用工具完成任務 PASS
- LINE 第二段最終結果回覆 PASS，三筆 final push HTTP 200，且 LINE UI 顯示自然 `final_user_message`
- duplicate task / execution / ACK / final push：0 / 0 / 0 / 0
- 最終 KV：pending / processing 皆空；三筆只在 completed，failed 無新增

## Codex 長任務通知模式

Codex 長任務通知模式已完成 live LINE 驗收。

驗收證據：

- release commit：`54d49e77d78ffe77d5b6eb8facd13b166c1a779b`
- Worker version id：`2b185523-f024-4ea6-93c9-54abb8d79ec0`
- TEST thread id：`019f6940-ff63-7392-8dab-d285f4f44928`
- TEST turn id：`019f699c-50c5-7912-b823-2a292be0accd`
- quick task id：`01KXMST2V7ZZ73YC3XXEV7M5RJ`
- long task id：`01KXMSZVXM2EMD8XJX12584Y1S`
- display_task_id：`P-N4SSOP-0SYS`
- duplicate ACK / final push / task / execution：0 / 0 / 0 / 0

PASS 範圍：

- quick task 不進長任務通知流程，live PASS
- long task immediate ACK 顯示 display_task_id，live PASS
- progress / final 對外無內部工程欄位，live PASS
- duplicate ACK / final push / task / execution = 0

觸發規格：

- 只有需要修改檔案、整理專案、執行程式、部署、Computer Use、多步驟工作或長時間分析的任務，才進入 Codex 長任務模式。
- 簡單想法新增、搜尋、修改、刪除與一般快速任務，仍可直接執行並回覆，不進入長任務通知流程。

長任務 LINE immediate ACK：

```text
已收到任務，正在處理中 🛠️

任務編號：<display_task_id>

完成後會再通知你。
```

訊息規格：

- 狀態通知不得由 monitor 根據任務類型套固定內容。
- Codex / 執行端產生自然的 `progress_user_message`，monitor 只負責原樣推送。
- 相關欄位：`display_task_id`、`execution_mode`、`progress_stage`、`progress_user_message`、`technical_summary`、`final_user_message`。
- LINE 不得顯示內部 task_id、PID、stdout、stderr、本機路徑或工程欄位。

## FIX 完成原則

- FIX thread id：`019f6941-2862-7602-8b91-c38870711703`
- FIX turn id：`019f696c-b985-7d23-be00-30e45e913667`
- 修改檔案：`codex-inbox/monitor.js`
- Codex prompt 要求最後輸出 JSON object：`technical_summary` + `final_user_message`
- `technical_summary` 只保存於 completed task / legacy result_summary，不推 LINE
- LINE final push 唯一內容來源為 `final_user_message`
- 若 `final_user_message` 空白、過長、含本機路徑、Markdown link、JSON 檔名、task_id、stdout/stderr/PID、明顯 secret/token 字樣，task failed，不推 `technical_summary`
- 保留 stdin ignore / `--output-last-message` 修正
- LaunchAgent 已重啟：`com.pline.v3-codex-inbox-monitor`，PID `60764`

## TEST 完成證據

- TEST thread id：`019f6940-ff63-7392-8dab-d285f4f44928`
- TEST turn id：`019f6971-1f57-7313-b4cf-a5ed0f480d59`
- WORKER_STATUS：completed
- ORCHESTRATOR_NOTIFY：no
- ORCHESTRATOR_MESSAGE：Codex 自行撰寫 LINE 友善最終回覆已 PASS，不需續派。

三筆真實 LINE 測試：

1. `01KXMQ4DER98X2D302NNQNJZ6S`：記錄想法，completed，attempts=1，final_push_status=sent，HTTP 200，Dropbox JSON +1，新增 `idea_2026-07-16_13-43-36.json`。
2. `01KXMQCKYXPN2T3T2HK92K60DM`：查詢會員登入相關想法，completed，attempts=1，final_push_status=sent，HTTP 200，查詢既有想法資料，Dropbox JSON +0。
3. `01KXMQH9J4GEG42CJB2SA0GFH8`：查詢菲比股市練功房狀態，completed，attempts=1，final_push_status=sent，HTTP 200，只讀查詢專案狀態與資料，Dropbox JSON +0。

三筆皆符合：

- `technical_summary` 已保存，未推 LINE
- LINE 第二段皆只顯示 `final_user_message`
- 未顯示 `/Users/phoebe`、`.json`、Markdown link、`original_text`、`task_id`、stdout、stderr、exit code 或工程描述

## 目前已完成主線

```text
LINE → Codex → 工具執行 → LINE 第二段友善回覆
```

## 仍不得誤標 PASS

只將已真實驗收者標 PASS。未做的 release / push / 遠端驗證，不得寫成 PASS。

本輪 DOC 未自行做新的 LINE 測試、未修改 Worker / n8n / inbox 架構、未碰 FORMAL、未處理 token / secret / credentials。

---

## V2 dirty 處理

- archive branch：`archive/v2-uncommitted-before-v3`
- archive commit：`7e0ca34`
- runtime task JSON 已移出 repo，不進 Git
- main 未改寫，V2 tags 保留

## V3 分支

- branch：`v3/codex-line-inbox`
- start tag：`v2.0-idea-query-complete`
- start commit：`78c44d63c6e74b7e9f1846dfc24d2c840aefc0bc`
- 未混入 V2 dirty 變更
- 未混入 runtime task JSON

## V3 inbox / KV monitor

- initial V3 implementation by FIX turn：`019f68a2-76e5-76e0-b9db-0e0456b1f984`
- KV monitor fix commit：`2fba817d735ce7fb186dd74bbe4b0d3af3094e14`
- failed archive / duplicate execution race fix commit：`9199b8c4fb04b068b7677bd39e59198bb6673940`
- final fix changed file：`codex-inbox/monitor.js`
- Worker version under test：`f06216fc-ad14-4a8f-a1f4-99d774abd90e`
- final race fix did not modify Worker
- n8n / LINE Webhook not modified

## V3 foundation 歷史驗收

- TEST thread id：`019f6660-c0f0-7d32-ad8e-460f76b9a81c`
- TEST turn id：`019f68b8-6f8d-7353-89db-59dd19df33c0`
- `REMOTE_SUCCESS_CASE=PASS`
- `ORIGINAL_TEXT_PRESERVED=PASS`
- `SINGLE_COMPLETED_STATE=PASS`
- `FAILED_ARCHIVE_TEST=PASS`
- `SINGLE_FAILED_STATE=PASS`
- `DUPLICATE_TASK=0`
- `DUPLICATE_REPLY=0`
- `DUPLICATE_EXECUTION=0`
- `LINE_SMOKE=PASS`
- `LINE_REPLY_ONCE=PASS`
- `REMOTE_PENDING_TO_COMPLETED_AFTER_LINE=PASS`
- `UNEXPECTED_JSON_WRITES=0`
- `UNEXPECTED_N8N_EXECUTIONS=0`
- `SENSITIVE_DATA_FOUND=false`
- `SAFE_TO_DISPATCH_FIX=no`
- `NEXT_HANDOFF_TO_DOC_READY=PASS`

## Current V3 behavior

- LINE 作為 Codex 行動收件匣：LINE Gateway 收件後立即回覆 `收到，已交給 Codex ✨`
- 原文完整保存到 remote KV pending task
- monitor 可 claim KV pending，轉 processing / completed
- failed archive 安全落到 failed，保留 `error_summary` / `retryable`，單一終態
- Codex prompt 產生 `technical_summary` + `final_user_message`
- `technical_summary` 只存內部紀錄，不推 LINE
- LINE 第二段最終回覆唯一來源為 `final_user_message`
- 三筆真實 LINE 測試已完成 `LINE → Codex → 工具執行 → LINE 第二段友善回覆`
- duplicate task / execution / ACK / final push 均為 0

---

# 固定資訊

- 專案名稱：菲比 LINE 智能助理_02
- LINE 官方帳號：`菲比智能客服 測試`
- 第一階段固定回覆：`記好了 ✨`
- Worker 名稱：`pline-v2-0-test-line-gateway-r2c3b`
- Worker 修改檔案：`workers/pline-v2-0-test-line-gateway-r2c3b/src/index.js`
- n8n workflow 名稱：`PLine｜菲比 LINE 智能助理｜V2.0`
- n8n Cloud workflow URL：`https://n8nphy.app.n8n.cloud/workflow/X1yl5OAKtZE2B24i?projectId=CpQJpNNFd9pH0LCm`
- n8n production webhook：`https://n8nphy.app.n8n.cloud/webhook/pline-v2-0-test`

---

# 綠燈不可破壞原則

任何已經 PASS、已經變成綠燈的流程，不得任意重構、拆除、改名或改寫。

目前已經變綠燈的流程：

- LINE「菲比智能客服 測試」Webhook 接收
- Cloudflare Worker：`pline-v2-0-test-line-gateway-r2c3b`
- Worker → n8n V2.0
- n8n HTTP 200
- TEST Dropbox JSON 寫入
- 日／月／年查詢分流
- LINE Reply：`記好了 ✨`

新增功能時，必須優先使用：

- 新增一個 node
- 新增一條連線
- 新增一個小函式
- 新增一個獨立檔案
- 在既有流程旁邊增加功能

不得優先使用：

- 重畫 workflow
- 重構已成功程式
- 更換 Worker
- 更換 Webhook URL
- 改名
- 合併流程
- 搬移成功節點
- 重建整套架構

若新增功能失敗，先停用或移除新增部分，已經綠燈的主流程必須仍能正常運作。

---

# 功能優先模式

目前階段以最快完成實際功能為最高優先。

先完成：

1. LINE 收到文字：PASS
2. LINE 回覆 `記好了 ✨`：PASS
3. n8n 收到文字：PASS
4. Dropbox 寫入 JSON：PASS
5. 自然語言記錄想法：PASS
6. 依日／月／年查詢與統計：月／年查詢 PASS，日查詢 action 已完成
7. 後續 Codex 派工能力

在以上主要功能未全部暢通前，不得因以下項目阻塞主線：

- 額外 Gate
- preflight
- diagnostic
- review
- recovery
- evidence
- handoff
- cleanup
- root cause
- baseline lock
- arm helper
- session lifecycle
- terminal ACK
- forward settlement
- 多層 authorization
- 額外安全審查
- 完整測試框架
- 複雜狀態機

這些項目統一記錄為：

```text
後續安全補強｜主要功能完成後處理
```

不得在目前主線中展開。

---

# 最低必要邊界

開發期間只保留以下最低邊界：

1. 不得顯示或寫入 token、secret、credentials
2. 不得修改舊專案：`/Users/phoebe/Documents/菲比 LINE 智能助理`
3. 不得碰 FORMAL 或其他正式環境
4. 不得破壞已經 PASS 的綠燈流程
5. 不得把測試資料寫入錯誤專案路徑

除上述五項外，不得再用安全理由阻塞目前功能開發。

---

# 第一階段

第一階段 LINE 固定回覆已 PASS，且目前仍正常。

真實 LINE 測試已看到：

- `測試 V2.0 n8n`
- `記好了 ✨`

---

# 第二階段 N8N V2.0

第二階段 n8n 最小接收流程與 Worker 串接已完成。

已確認：

- n8n production webhook 單獨測試已通過
- payload：`{"text":"測試 V2.0 n8n"}`
- HTTP response：`200`
- response body：`{"ok":true,"version":"V2.0"}`
- LINE → Worker → n8n V2.0 已通過
- Worker tail 顯示 n8n HTTP 200
- n8n workflow 已產生真實執行紀錄並收到文字資料
- LINE Reply `記好了 ✨` 仍正常

補充：

LINE desktop 輸入框殘留內容造成一次附帶第二筆事件，但不影響指定測試成功。

---

# TEST Dropbox

本階段已 PASS：

```text
LINE「菲比智能客服 測試」
→ pline-v2-0-test-line-gateway-r2c3b
→ n8n workflow「PLine｜菲比 LINE 智能助理｜V2.0」
→ TEST Dropbox
```

固定寫入規格：

- LINE Reply `記好了 ✨` 仍 PASS
- Dropbox 路徑：`/Users/phoebe/Library/CloudStorage/Dropbox/codex專案/菲比 LINE 智能助理_02/想法紀錄_TEST`
- 檔名：`idea_YYYY-MM-DD_HH-mm-ss.json`
- JSON 欄位：`text`、`created_at`、`Asia/Taipei`、`source`、`project`、`version`
- duplicate JSON = 0
- duplicate reply = 0
- 舊專案未修改
- FORMAL 未操作

---

# 日／月／年查詢功能

FIX worker 已完成查詢功能並 PASS。

`local-query-api` 六個 action：

- `count_day`
- `list_day`
- `count_month`
- `list_month`
- `count_year`
- `list_year`

目前結果：

- 本機 HTTP 200
- 同一 HTTPS tunnel HTTP 200
- 固定 Dropbox 路徑：`/Users/phoebe/Library/CloudStorage/Dropbox/codex專案/菲比 LINE 智能助理_02/想法紀錄_TEST`
- Worker 直接查詢分流
- 非查詢文字仍走 n8n 記錄流程
- 本月 LINE 查詢 PASS，數量 4
- 今年 LINE 查詢 PASS，數量 4
- 四項 LINE 查詢 PASS：本月數量、本月列表、本年數量、本年列表
- 查詢新增 JSON = 0
- 記錄測試收到 `記好了 ✨`，新增 JSON = 1
- duplicate JSON = 0
- duplicate reply = 0
- Worker URL / name unchanged
- n8n workflow unchanged
- n8n、舊專案、FORMAL、LINE Webhook 未修改

---

# 第一版功能完整 PASS

目前第一版功能已 PASS。

已完成：

- LINE 記錄想法與固定回覆
- Dropbox JSON 寫入
- 日 / 月 / 年數量與清單
- 搜尋、查看、修改、刪除
- 分類記錄直接 Worker → local-query-api → Dropbox
- 分類搜尋
- Codex queue pending task

Computer Use 驗收結果：

- TEST LINE：`菲比智能客服 測試`
- Worker 最終版本：`3b55cc36-30cf-491f-8abd-2a9bec0d62a5`
- 查詢未送 n8n
- n8n 僅保留既有成功記錄流程，未新增查詢路由
- 固定 Dropbox TEST 路徑與 local-query-api 路徑維持文件既有設定
- 分類測試 JSON：`category=網站`
- 分類測試 JSON：`text` 已移除 `［網站］`
- 分類測試 JSON：`original_text` 保留
- 刪除測試資料已移至 `想法紀錄_TEST_已刪除`
- Codex queue 測試前 2、測試後 3，新增 1 筆 pending
- duplicate JSON = 0
- duplicate reply = 0
- 舊專案未修改
- FORMAL 未操作

補充：

先前 TEST 中查詢分類曾失敗，後由 Worker 路由優先順序修正後 PASS。

---

# V2.0 Baseline

2026-07-16 已保存目前成功版本為正式開發基準。

基準檔案：

- `BASELINE.md`
- `n8n/baseline/PLine_V2.0_LINE_N8N_PASS.json`

baseline 必須保持：

- LINE → Worker PASS
- Worker → n8n V2.0 PASS
- n8n → TEST Dropbox JSON PASS
- 搜尋 / 查看 / 修改 / 刪除 PASS
- 分類記錄與分類搜尋 PASS
- Codex queue pending task PASS
- LINE Reply `記好了 ✨` PASS
- duplicate JSON = 0
- duplicate reply = 0
- AI 尚未加入
- 不碰 FORMAL
- 不修改舊專案
- 不保存 token、secret、credentials

---

# 本輪邊界

- 舊專案未修改：`/Users/phoebe/Documents/菲比 LINE 智能助理`
- FORMAL 未操作
- 正式 LINE 未操作
- 未寫入或顯示 token、secret、credentials
- duplicate JSON = 0
- duplicate reply = 0
- 查詢新增 JSON = 0
- 記錄測試新增 JSON = 1
- Worker URL / name unchanged
- Worker final version = `3b55cc36-30cf-491f-8abd-2a9bec0d62a5`
- n8n workflow unchanged
- 查詢未送 n8n
- baseline commit / tag 由 RELEASE thread 建立
- 未 push

---

# 固定 Threads

- PLine｜00｜總控制台
- PLine｜DOC｜文件與規格整理
- PLine｜N8N｜n8n workflow 調整
- PLine｜TEST｜測試與驗收
- PLine｜FIX｜小修正與命名同步
- PLine｜RELEASE｜階段收尾與上線檢查
- PLine｜ARCHIVE｜歷史建置紀錄

不得新增 Thread。
不得開子代理。
