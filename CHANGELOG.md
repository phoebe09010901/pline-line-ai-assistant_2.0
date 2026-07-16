# CHANGELOG

---

## 2026-07-16

### DOC｜LINE V3.0 閉環驗收後文件整理

本輪 `PLine｜DOC｜文件與規格整理` 只更新四份允許文件，將目前狀態從 V3 receive-only checkpoint 更新為 V3.0 真實單筆 / 三筆閉環驗收完成。

更新文件：

- `PROJECT_STATE.md`
- `CHANGELOG.md`
- `CODEX_NOTES.md`
- `BASELINE.md`

V2 / V3 基準：

- V2.0 已完成並保存
- V3 branch：`v3/codex-line-inbox`
- V3 release commit：`7287cf5f254ca45782d7f5b262b1e698f16e7622`
- V3 tag：`v3.0-codex-line-inbox-complete`
- 真實使用 checkpoint tag：`v3.0-inbox-receive-checkpoint`

已確認綠燈：

- LINE Webhook 收件：PASS
- LINE 即時 ACK `收到，已交給 Codex ✨`：PASS，三筆各 1 次
- inbox 狀態結構與競態驗收：已有 PASS 證據
- duplicate execution：0
- Codex monitor 真正常駐：PASS，本輪 monitor 已 claim 三筆任務
- Codex 實際執行：PASS，本輪完成 Dropbox 寫入 / 想法查詢 / 專案狀態查詢
- Codex 使用工具完成任務：PASS，第一筆 Dropbox +1，第二 / 三筆完成查詢
- LINE 第二段最終結果回覆：PASS，三筆 final push HTTP 200，且 LINE UI 顯示自然 `final_user_message`

FIX 完成內容：

- FIX thread id：`019f6941-2862-7602-8b91-c38870711703`
- FIX turn id：`019f696c-b985-7d23-be00-30e45e913667`
- 修改檔案：`codex-inbox/monitor.js`
- Codex prompt 要求最後輸出 JSON object：`technical_summary` + `final_user_message`
- `technical_summary` 只保存於 completed task / legacy result_summary，不推 LINE
- LINE final push 唯一內容來源為 `final_user_message`
- 若 `final_user_message` 空白、過長、含本機路徑、Markdown link、JSON 檔名、task_id、stdout/stderr/PID、明顯 secret/token 字樣，task failed，不推 `technical_summary`
- 保留 stdin ignore / `--output-last-message` 修正
- LaunchAgent 已重啟：`com.pline.v3-codex-inbox-monitor`，PID `60764`

TEST 完成內容：

- TEST thread id：`019f6940-ff63-7392-8dab-d285f4f44928`
- TEST turn id：`019f6971-1f57-7313-b4cf-a5ed0f480d59`
- WORKER_STATUS：completed
- ORCHESTRATOR_NOTIFY：no
- ORCHESTRATOR_MESSAGE：Codex 自行撰寫 LINE 友善最終回覆已 PASS，不需續派。

---

### V3 receive-only live checkpoint

V3.0 Codex LINE Inbox 已完成 RELEASE，但本次只保存 receive-only checkpoint。

- existing release commit：`7287cf5f254ca45782d7f5b262b1e698f16e7622`
- existing tag：`v3.0-codex-line-inbox-complete`
- 以上 commit / tag 保留
- TEST LINE 三則真實訊息均收到 `收到，已交給 Codex ✨`
- LINE Webhook 接收 PASS
- 即時 ACK PASS
- duplicate reply 初步為 0
- Codex inbox task 是否實際建立待檔案核對
- Codex monitor 常駐 / 領取 / 自主理解 / 工具執行尚未證實
- 尚未收到第二段 Codex 最終執行結果，final LINE result 不得標 PASS
- checkpoint 定位：`LINE 收件段完成，Codex 後段執行尚待修正`
- 不描述為 V3 全流程完成
- 本輪尚未修正 monitor、Worker、local-query-api、n8n

明日唯一主線：

- 查明真實 LINE 任務停點
- 確認 remote task 狀態為 pending / processing / completed / failed 的哪一層
- 確認 Codex monitor 是否真正常駐
- 只修真正故障層
- 完成單筆 `LINE → Codex → 工具執行 → LINE 第二段結果`

目前不得誤標 PASS：

- Codex monitor 是否真正常駐
- Codex 是否實際執行
- Codex 是否使用工具完成任務
- LINE 第二段最終結果回覆

---

### V3 mainline｜Codex LINE inbox foundation PASS

本輪文件結論以 V3 mainline 為準，不以舊 V2 / 第一版 Dropbox baseline 作為本輪結論。

V2 dirty 處理：

- archive branch：`archive/v2-uncommitted-before-v3`
- archive commit：`7e0ca34`
- runtime task JSON 已移出 repo，不進 Git
- main 未改寫，V2 tags 保留

V3 分支：

- branch：`v3/codex-line-inbox`
- start tag：`v2.0-idea-query-complete`
- start commit：`78c44d63c6e74b7e9f1846dfc24d2c840aefc0bc`
- 未混入 V2 dirty 變更
- 未混入 runtime task JSON

V3 inbox / KV monitor：

- initial V3 implementation by FIX turn：`019f68a2-76e5-76e0-b9db-0e0456b1f984`
- KV monitor fix commit：`2fba817d735ce7fb186dd74bbe4b0d3af3094e14`
- failed archive / duplicate execution race fix commit：`9199b8c4fb04b068b7677bd39e59198bb6673940`
- final fix changed file：`codex-inbox/monitor.js`
- Worker version under test：`f06216fc-ad14-4a8f-a1f4-99d774abd90e`
- final race fix did not modify Worker
- n8n / LINE Webhook not modified

TEST final V3 pass：

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

Current V3 behavior：

- LINE 作為 Codex 行動收件匣：LINE Gateway 收件後立即回覆 `收到，已交給 Codex ✨`
- 原文完整保存到 remote KV pending task
- monitor 可 claim KV pending，轉 processing / completed
- failed archive 安全落到 failed，保留 `error_summary` / `retryable`，單一終態
- duplicate event / reply / execution 均為 0
- 尚未宣稱完整 Codex 自主工具選擇與完成後回覆 LINE 全面完成
- 本輪是 V3 inbox / monitor foundation pass

---

### 第一版功能完整 PASS

目前第一版功能已由 FIX worker 完成並 PASS。

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
- 分類測試 JSON：`category=網站`
- 分類測試 JSON：`text` 已移除 `［網站］`
- 分類測試 JSON：`original_text` 保留
- 刪除測試資料已移至 `想法紀錄_TEST_已刪除`
- Codex queue 測試前 2、測試後 3，新增 1 筆 pending
- duplicate JSON / reply = 0
- 舊專案未修改
- FORMAL 未操作

補充：

先前 TEST 中查詢分類曾失敗，後由 Worker 路由優先順序修正後 PASS。

---

### 日／月／年查詢功能 PASS

FIX worker 已完成查詢功能並 PASS。

已完成的 `local-query-api` actions：

- `count_day`
- `list_day`
- `count_month`
- `list_month`
- `count_year`
- `list_year`

測試結果：

- 本機 HTTP 200
- 同一 HTTPS tunnel HTTP 200
- 固定 Dropbox 路徑：`/Users/phoebe/Library/CloudStorage/Dropbox/codex專案/菲比 LINE 智能助理_02/想法紀錄_TEST`
- Worker 直接查詢分流，非查詢文字仍走 n8n 記錄流程
- 本月 LINE 查詢 PASS，數量 4
- 今年 LINE 查詢 PASS，數量 4
- 四項 LINE 查詢 PASS：本月數量、本月列表、本年數量、本年列表
- 查詢新增 JSON = 0
- 記錄測試收到 `記好了 ✨`，新增 JSON = 1
- duplicate JSON = 0
- duplicate reply = 0

邊界：

- Worker URL / name unchanged
- n8n workflow unchanged
- n8n 未修改
- Worker 未修改
- `local-query-api` 未修改
- 舊專案未修改
- FORMAL 未操作
- LINE Webhook 未修改
- 未 commit / push

---

### TEST Dropbox JSON 寫入 PASS

本階段已 PASS：

```text
LINE「菲比智能客服 測試」
→ pline-v2-0-test-line-gateway-r2c3b
→ n8n workflow「PLine｜菲比 LINE 智能助理｜V2.0」
→ TEST Dropbox
```

已記錄：

- LINE Reply `記好了 ✨` 仍 PASS
- TEST Dropbox 固定路徑：`/Users/phoebe/Library/CloudStorage/Dropbox/codex專案/菲比 LINE 智能助理_02/想法紀錄_TEST`
- 檔名格式：`idea_YYYY-MM-DD_HH-mm-ss.json`
- JSON 欄位：`text`、`created_at`、`Asia/Taipei`、`source`、`project`、`version`
- duplicate JSON = 0
- duplicate reply = 0
- 舊專案未修改
- FORMAL 未操作

保留並延續「綠燈不可破壞＋功能優先模式」。

---

### 固定開發原則：綠燈不可破壞＋功能優先模式

新增固定開發原則。

目前已經變綠燈的流程：

- LINE「菲比智能客服 測試」Webhook 接收
- Cloudflare Worker：`pline-v2-0-test-line-gateway-r2c3b`
- Worker → n8n V2.0
- n8n HTTP 200
- TEST Dropbox JSON 寫入
- 日／月／年查詢分流
- 搜尋 / 查看 / 修改 / 刪除
- 分類記錄與分類搜尋
- Codex queue pending task
- LINE Reply：`記好了 ✨`

原則：

- 已經 PASS 的主流程不得任意重構、拆除、改名或改寫
- 新增功能時優先新增 node、連線、小函式、獨立檔案，或在既有流程旁邊增加功能
- 不優先重畫 workflow、重構成功程式、更換 Worker、更換 Webhook URL、改名、合併流程、搬移成功節點或重建整套架構
- 若新增功能失敗，先停用或移除新增部分，綠燈主流程必須仍能正常運作

功能優先模式：

1. LINE 收到文字：PASS
2. LINE 回覆 `記好了 ✨`：PASS
3. n8n 收到文字：PASS
4. Dropbox 寫入 JSON：PASS
5. 自然語言記錄想法：PASS
6. 依日／月／年查詢與統計：PASS
7. 搜尋、查看、修改、刪除：PASS
8. 分類記錄與分類搜尋：PASS
9. Codex queue pending task：PASS

在主要功能未全部暢通前，額外 Gate、preflight、diagnostic、review、recovery、evidence、handoff、cleanup、root cause、baseline lock、arm helper、session lifecycle、terminal ACK、forward settlement、多層 authorization、額外安全審查、完整測試框架、複雜狀態機，統一記錄為：

```text
後續安全補強｜主要功能完成後處理
```

最低必要邊界：

1. 不得顯示或寫入 token、secret、credentials
2. 不得修改舊專案：`/Users/phoebe/Documents/菲比 LINE 智能助理`
3. 不得碰 FORMAL 或其他正式環境
4. 不得破壞已經 PASS 的綠燈流程
5. 不得把測試資料寫入錯誤專案路徑

除上述五項外，不得再用安全理由阻塞目前功能開發。

---

### V2.0 Dropbox baseline 保存

將目前已通過的 TEST Dropbox 主流程保存為正式開發基準。

新增：

- `n8n/baseline/PLine_V2.0_LINE_N8N_DROPBOX_PASS.json`

baseline 內容：

- LINE Webhook：PASS
- LINE Reply `記好了 ✨`：PASS
- Worker → n8n V2.0：PASS
- n8n → TEST Dropbox JSON：PASS
- duplicate JSON = 0
- duplicate reply = 0
- Worker：`pline-v2-0-test-line-gateway-r2c3b`
- n8n workflow：`PLine｜菲比 LINE 智能助理｜V2.0`

邊界：

- 匯出檔已清除 credentials metadata，已檢查未包含 token、secret、credentials
- FORMAL 未操作
- 舊專案未修改
- 未 push

狀態：

```text
BASELINE_STATUS=dropbox_baseline_created
N8N_TO_TEST_DROPBOX_JSON=passed
FORMAL_ALLOWED=false
```

---

### V2.0 baseline 保存

將目前已通過的 TEST 主流程保存為正式開發基準。

新增：

- `BASELINE.md`
- `n8n/baseline/PLine_V2.0_LINE_N8N_PASS.json`

baseline 內容：

- LINE → Worker：PASS
- Worker → n8n V2.0：PASS
- LINE Reply `記好了 ✨`：PASS
- Worker：`pline-v2-0-test-line-gateway-r2c3b`
- n8n workflow：`PLine｜菲比 LINE 智能助理｜V2.0`

邊界：

- 此段為 Dropbox 前一版 baseline 紀錄
- 未加入 AI 分析
- FORMAL 未操作
- 舊專案未修改
- 未 push

狀態：

```text
BASELINE_STATUS=created
LINE_TO_WORKER_TO_N8N=passed
FORMAL_ALLOWED=false
```

---

### 第二階段 N8N V2.0 最小接收流程

第二階段 n8n 最小接收流程與 Worker 串接已完成。

固定資訊：

- n8n workflow 名稱：`PLine｜菲比 LINE 智能助理｜V2.0`
- n8n Cloud workflow URL：`https://n8nphy.app.n8n.cloud/workflow/X1yl5OAKtZE2B24i?projectId=CpQJpNNFd9pH0LCm`
- n8n production webhook：`https://n8nphy.app.n8n.cloud/webhook/pline-v2-0-test`
- Worker 名稱：`pline-v2-0-test-line-gateway-r2c3b`
- Worker 修改檔案：`workers/pline-v2-0-test-line-gateway-r2c3b/src/index.js`

---

### 驗證結果

第一階段 LINE 固定回覆已 PASS，仍正常。

n8n production webhook 單獨測試已通過：

- payload：`{"text":"測試 V2.0 n8n"}`
- HTTP response：`200`
- response body：`{"ok":true,"version":"V2.0"}`

Worker 串接結果：

- LINE → Worker → n8n V2.0 已通過
- Worker tail 顯示 n8n HTTP 200
- n8n workflow 已產生真實執行紀錄並收到文字資料
- LINE Reply `記好了 ✨` 仍正常
- 真實 LINE 測試中，LINE「菲比智能客服 測試」已顯示 `測試 V2.0 n8n` 與 `記好了 ✨`

補充：

LINE desktop 輸入框殘留內容造成一次附帶第二筆事件，但不影響指定測試成功。

狀態：

```text
PHASE1_LINE_REPLY=passed
PHASE2_N8N_MINIMAL_RECEIVE=passed
LINE_TO_WORKER_TO_N8N=passed
FORMAL_ALLOWED=false
```

---

### 邊界

- 舊專案未修改：`/Users/phoebe/Documents/菲比 LINE 智能助理`
- FORMAL 未操作
- 正式 LINE 未操作
- 未寫入或顯示 token、secret、credentials
- baseline commit / tag 由 RELEASE thread 建立
- 未 push
- 未新增 Gate、trace、diagnostic、preflight、review、recovery、handoff、狀態機或安全層

---

## 2026-07-15

### 第一階段 TEST 主流程

第一階段已完成：

```text
LINE 任意文字訊息
→ TEST Worker /webhook
→ LINE Reply API
→ 回覆「記好了 ✨」
```

狀態：

```text
PHASE1_TEST_MAIN_FLOW=passed
FORMAL_ALLOWED=false
```
