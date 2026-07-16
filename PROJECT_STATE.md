# 菲比 LINE 智能助理_02｜PROJECT_STATE

最後更新：2026-07-16

---

# V3.4 mainline｜allowlist owner admin 修正

本輪文件結論以 V3.4 allowlist / owner admin 真實驗收為準。V3.3 offline queue recovery、V3.1 阿光統一人格與自然任務回覆基準、V3.0 closed-loop verification、V2 / 第一版 Dropbox baseline 與 receive-only checkpoint 保留為歷史基準。

## V3.4 allowlist / owner admin 修正

根因：TEST runtime `PLINE_ADMIN_LINE_USER_IDS` allowlist 指到錯的 LINE 帳號，導致非 owner / 非預期帳號被設為 admin，真正 owner 被 deny。

修正狀態：

- 程式 env 名稱正確：`PLINE_ADMIN_LINE_USER_IDS` / fallback `ADMIN_LINE_USER_IDS`
- Worker version：V3.4
- FIX 只修 TEST Worker runtime secret，將 `PLINE_ADMIN_LINE_USER_IDS` 改為 owner 指紋 `129bd0dd27ee` 對應的 LINE userId
- 完整 LINE userId 未顯示、未寫入 repo
- Cloudflare Secret Change deployment：`2026-07-16T12:08:19.915Z`
- Cloudflare Secret Change version：`8dee98ae-d8d3-4c6d-b2be-ef06d3a1b86a`
- 未修改檔案、未 commit、未 push、未碰 n8n / FORMAL / 舊專案 / 正式 LINE

## V3.4 真實驗收結果

- TEST thread id：`019f6940-ff63-7392-8dab-d285f4f44928`
- TEST turn id：`019f6ad5-487e-7651-a464-d2fbfcd30535`
- owner/admin 訊息：`我現在有多少想法 V34OWNER2010`
- owner task：`task-b5d9a64f814016e26de723a103d0a6e2`
- display id：`P-NGWX1T-0PNY`
- owner 指紋：`129bd0dd27ee`
- role / auth：`admin / allow_admin`
- 狀態：pending → processing → completed
- attempts：`1`
- final push：`sent / HTTP 200`
- final：`我查到了，你現在共有 3 則想法。`
- 先前錯帳號指紋：`18ba0ce4706d`
- 非 admin auth-event：`guest / deny_not_in_admin_allowlist`
- 非 admin 結果：收到限制訊息，不進 pending / processing，不啟動 executor
- KV 收斂：pending=0、processing=0
- 工程欄位外洩：本輪 owner final 與 deny 訊息未檢出 Codex / monitor / Worker / Gateway / task_id / PID / stdout / stderr / local path
- duplicate：owner task attempts=1，非 admin 未建 task；未見重複 task / execution / final push

可標 PASS：

- V3.4 allowlist / owner admin 修正
- 非 admin 阻擋
- 管理者 task 建立與 final push

不可標 PASS / 待 FIX：

- 不得把 V3.4 全功能標成完全 PASS
- 列表語句 `請通通幫我列出來`：FAILED / 待 FIX
- 旁支 task：`task-7aa0f59c07617bc6f6764f4be0923f39`
- failed 原因：`Codex did not provide a valid LINE final message`
- 此旁支不是 allowlist 修正阻塞點，但表示「列表語句 final 產生」仍待 FIX，不可把整體列表功能標 PASS

邊界：

- 本輪是 TEST Worker / TEST LINE allowlist 修正驗收
- 不碰正式 LINE、FORMAL、n8n、舊專案或 credentials
- 不顯示、記錄或提交完整 LINE userId / token / secret

---

# V3.3 history｜offline queue recovery / fallback poll

## V3.3 真實驗收狀態

- TEST thread id：`019f6940-ff63-7392-8dab-d285f4f44928`
- TEST turn id：`019f6a69-4d16-7601-92e7-8d7428755e0d`
- WORKER_STATUS：completed
- V3.3 真實 LINE 驗收結果：PASS
- 重要 caveat：即時 wake endpoint / 秒級事件驅動 wake 不可標 PASS
- 原因：`CODEX_MONITOR_WAKE_URL` 未配置，任務實際走 `missing_wake_url` / fallback poll / monitor recovery
- 測試範圍：TEST LINE / 測試 Worker
- 未切換正式 LINE、正式 Cloudflare、n8n 或 FORMAL

可標 PASS：

- LINE ACK 可見
- online 列表第二段 final 可見
- online heartbeat metadata 有記錄
- offline queued 有記錄
- monitor recovery 有記錄
- recovery progress push 已送出
- final push 已送出
- duplicate task / execution / ACK / final push = 0

不可標 PASS：

- 即時 wake endpoint
- 秒級事件驅動 wake
- 正式 LINE / 正式 Cloudflare / n8n / FORMAL 切換

## V3.3 online 列表驗收

- 訊息時間：`2026-07-16 18:15`
- LINE 訊息：`列出本月想法 V33ON1815`
- task：`01KXN6S8CCWKM5J19X8RQD7V6X`
- display：`P-NCSBNC-0AZ2`
- 路徑：pending → processing → completed
- heartbeat：enqueue 時 `state=online`, `online=true`, `busy=false`, `monitor_version=V3.3`
- wake：`wake_status=skipped`, `wake_skip_reason=missing_wake_url`
- timing：received `18:15:32`, claimed `18:15:48`, completed `18:16:47`, final push `18:16:52`
- LINE：ACK 可見；第二段 final 可見，列出本月 19 則想法
- execution：`attempts=1`, `final_push_status=sent`, HTTP 200

## V3.3 offline queue / recovery 驗收

- 訊息時間：`2026-07-16 18:20`
- LINE 訊息：`我想看這19則想法 V33OFF1819`
- task：`01KXN729ADVBMF3MDW5DR2QQKH`
- display：`P-NCYNY8-0H44`
- 目前位置：`completed/01KXN729ADVBMF3MDW5DR2QQKH.json`
- queued evidence：`queued_while_offline=true`, `queued_at=18:20:27`
- offline snapshot：enqueue 時 `state=stale`, `online=false`, `age_ms=130785`
- wake：`wake_status=not_attempted`, `wake_skip_reason=executor_offline_or_unknown`
- monitor recovery：monitor 恢復後 PID `22710`，`claimed_at=18:21:47`
- execution：`attempts=1`, duplicate execution = 0
- recovery push：`recovery_progress_push_status=sent`, HTTP 200
- final push：`final_push_status=sent`, HTTP 200，`final_push_at=18:22:52`
- LINE：離線 ACK、恢復通知、第二段 final 皆在 TEST LINE 畫面可見

## V3.3 inbox 收斂與安全

- KV / inbox 收斂：pending=0、processing=0、completed=28、failed=17
- monitor heartbeat：`status=online`, `monitor_version=V3.3`, `current_task_id=null`
- duplicate task / execution / ACK / final push：0
- 對外訊息安全：未見 Codex / monitor / Worker / Gateway / task_id / PID / stdout / stderr / local path

阿光對外人格規格仍維持：LINE 對菲比用第一人稱「我」。不得把「交給 Codex」寫成對菲比顯示文案；技術紀錄可使用 Codex / monitor / Worker / Gateway 等名稱。

---

# V3.1 history｜阿光統一人格與自然任務回覆基準

## V3.1 基準狀態

- 基準名稱：V3.1 阿光統一人格與自然任務回覆基準
- 日期：2026-07-16
- branch：`v3/codex-line-inbox`
- V3.1 前置程式基準 commit：`33a3ce62270dd462456d00a9272d381bac8264c2`
- V3.0 歷史基準 commit：`7287cf5f254ca45782d7f5b262b1e698f16e7622`
- V3.0 tag：`v3.0-codex-line-inbox-complete`
- V3.0 checkpoint tag：`v3.0-inbox-receive-checkpoint`
- RELEASE 預計建立 tag：`v3.1-aguang-unified-assistant-baseline`
- tag 狀態：待 `PLine｜RELEASE｜階段收尾與上線檢查` 建立；本輪 DOC 不建立 tag

目前完成的是 V3.1 測試專案基準可收尾；正式「阿光智能助理」搬遷尚未完成。正式搬遷屬第二階段，必須等 RELEASE 完成 V3.1 baseline commit / push / tag 後，由控制台續派 RELEASE 先盤點正式資源再移動。

不得把尚未做的正式上線、FORMAL、n8n 改動或正式搬遷寫成 PASS。

## V3.1 TEST 驗收證據

- TEST final：`BASELINE_READY_FOR_DOC: yes`
- 新增任務：`01KXMYS1E37N8BVRBH26KE44PF`
- 修改任務：`01KXMZ12D77ZFTRBGWMXCNH6KH`
- 刪除任務：`01KXMZGT6VFHYJ3Y8NW3VG9JK0`
- 驗收唯一碼：`V31T1558R2`
- 活躍檔案：`idea_2026-07-16_15-56-56.json`
- 新增 / 修改使用資料夾：`/Users/phoebe/Library/CloudStorage/Dropbox/codex專案/菲比 LINE 智能助理_02/想法紀錄_TEST`
- 刪除移入資料夾：`/Users/phoebe/Library/CloudStorage/Dropbox/codex專案/菲比 LINE 智能助理_02/想法紀錄_TEST_已刪除`
- KV inbox final：pending=0、processing=0、completed=22、failed=11
- duplicate task=0、duplicate execution=0、duplicate ACK=0、duplicate final push=0
- LINE final push：HTTP 200
- 阿光對外人格安全：PASS

阿光對菲比顯示訊息統一使用第一人稱「我」，不得出現 Codex / monitor / Worker / Gateway / 已交給 Codex 等內部角色或工程欄位。

## V3.1 任務回覆與長任務通知規格

- 只有需要修改檔案、整理專案、執行程式、部署、Computer Use、多步驟工作或長時間分析的任務，才進入 Codex 長任務模式。
- 簡單想法新增、搜尋、修改、刪除與快速任務可 quick 直接完成，不進入長任務通知流程。
- monitor 只原樣推送 `ack_user_message` / `progress_user_message` / `final_user_message`，不依任務類型套固定內容。
- LINE 不得顯示內部 task_id、PID、stdout、stderr、本機路徑或工程欄位。

## V3.1 FIX 待 RELEASE 收尾

目前已由 FIX 完成但尚未由 RELEASE 收尾成 V3.1 baseline commit / push / tag：

- 新增 `codex-inbox/idea-tools.js`，支援 search / update / delete；delete 移入 `_02/想法紀錄_TEST_已刪除`，不硬刪。
- 更新 `codex-inbox/monitor.js`，引導執行端用 `idea-tools.js` 處理想法搜尋 / 修改 / 刪除，`local-query-api` 僅負責 count / list。
- FIX validation PASS：`node --check`、`git diff --check`、`/tmp mock search/update/delete`、真實 Dropbox read-only search、阿光安全防漏檢查。
- monitor 已由 FIX 重啟；PID 只可寫入技術文件，不得出現在 LINE 對外訊息。

## 阿光事件驅動即時喚醒規格

事件驅動 wake 已完成程式實作、測試與 release 收尾。

- RELEASE commit：`9508fca2124748a98dd8d9925605e0f46d5a53ec`
- committed files：`codex-inbox/monitor.js`、`workers/pline-v2-0-test-line-gateway-r2c3b/src/index.js`
- 測試 Worker：`pline-v2-0-test-line-gateway-r2c3b`
- Worker version id：`125139b5-95cf-4e75-ae98-43739e99e322`
- `_02` 測試 monitor LaunchAgent running，PID `85389`
- 本機 wake endpoint：`POST http://127.0.0.1:8793/wake` 回 `202 Accepted`
- local HEAD 與 `origin/v3/codex-line-inbox` 對齊 commit：`9508fca2124748a98dd8d9925605e0f46d5a53ec`

驗證 PASS：

- `node --check codex-inbox/monitor.js`
- `node --check workers/pline-v2-0-test-line-gateway-r2c3b/src/index.js`
- `node --check codex-inbox/idea-tools.js`
- `git diff --check` for two changed program files
- wake / `ctx.waitUntil` / fallback poll source confirmation
- TEST local/mock duplicate task / execution / ACK / final push = 0 / 0 / 0 / 0

規格重點：

- Gateway 寫入 pending task 後以 `ctx.waitUntil` 非阻塞 wake monitor。
- wake 不取代 inbox task；monitor 不信任 wake body，仍重新讀 pending 並用既有原子 claim。
- 重複 wake 不造成 duplicate execution。
- monitor 執行中新增任務保留在 queue，後續 queued wake / scan 處理。
- wake failed 時 webhook 仍快速 ACK，task 保留 pending，fallback poll 補救。
- fallback poll 保留低頻 60 秒，只作備援，不是主要啟動方式。
- 不破壞 stdin / EOF、task 狀態、duplicate 防護、LINE final push、Dropbox idea tools。

阿光對外人格規格仍維持：LINE 對菲比用第一人稱「我」，不得顯示 Codex / monitor / Worker / Gateway 等內部角色名，除非菲比問技術細節。

本輪沒有切換正式 LINE、正式 Cloudflare、n8n 或 FORMAL；不得將正式資源標示為已切換。

---

# V3.0 history｜Codex LINE closed-loop verification

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

## Codex 長任務通知模式 live 驗收

Codex 長任務通知模式已完成 live LINE 驗收。

- release commit：`54d49e77d78ffe77d5b6eb8facd13b166c1a779b`
- Worker version id：`2b185523-f024-4ea6-93c9-54abb8d79ec0`
- TEST thread id：`019f6940-ff63-7392-8dab-d285f4f44928`
- TEST turn id：`019f699c-50c5-7912-b823-2a292be0accd`
- quick task id：`01KXMST2V7ZZ73YC3XXEV7M5RJ`
- long task id：`01KXMSZVXM2EMD8XJX12584Y1S`
- display_task_id：`P-N4SSOP-0SYS`
- duplicate ACK / final push / task / execution：0 / 0 / 0 / 0

已可標 PASS：

- quick task 不進長任務通知流程，live PASS
- long task immediate ACK 顯示 display_task_id，live PASS
- progress / final 對外無內部工程欄位，live PASS
- duplicate ACK / final push / task / execution = 0

產品規格：

- 只有需要修改檔案、整理專案、執行程式、部署、Computer Use、多步驟工作或長時間分析的任務，才進入 Codex 長任務模式。
- 簡單想法新增、搜尋、修改、刪除與一般快速任務，仍可直接執行並回覆，不進入長任務通知流程。
- 長任務 LINE immediate ACK：

```text
已收到任務，正在處理中 🛠️

任務編號：<display_task_id>

完成後會再通知你。
```

- 狀態通知不得由 monitor 根據任務類型套固定內容；Codex / 執行端產生自然的 `progress_user_message`，monitor 只負責原樣推送。
- 相關欄位：`display_task_id`、`execution_mode`、`progress_stage`、`progress_user_message`、`technical_summary`、`final_user_message`。
- LINE 不得顯示內部 task_id、PID、stdout、stderr、本機路徑或工程欄位。

## V3.0 FIX 完成內容

- FIX thread id：`019f6941-2862-7602-8b91-c38870711703`
- FIX turn id：`019f696c-b985-7d23-be00-30e45e913667`
- 修改檔案：`codex-inbox/monitor.js`
- Codex prompt 要求最後輸出 JSON object：`technical_summary` + `final_user_message`
- `technical_summary` 只保存於 completed task / legacy result_summary，不推 LINE
- LINE final push 唯一內容來源為 `final_user_message`
- 若 `final_user_message` 空白、過長、含本機路徑、Markdown link、JSON 檔名、task_id、stdout/stderr/PID、明顯 secret/token 字樣，task failed，不推 `technical_summary`
- 保留 stdin ignore / `--output-last-message` 修正
- LaunchAgent 已重啟：`com.pline.v3-codex-inbox-monitor`，PID `60764`

## V3.0 TEST 完成內容

- TEST thread id：`019f6940-ff63-7392-8dab-d285f4f44928`
- TEST turn id：`019f6971-1f57-7313-b4cf-a5ed0f480d59`
- WORKER_STATUS：completed
- ORCHESTRATOR_NOTIFY：no
- ORCHESTRATOR_MESSAGE：Codex 自行撰寫 LINE 友善最終回覆已 PASS，不需續派。

三筆真實 LINE 測試：

1. `01KXMQ4DER98X2D302NNQNJZ6S`：`幫我記下，LINE 回覆格式已經變簡單了`
   狀態 completed，attempts=1，final_push_status=sent，HTTP 200。LINE 第二段：`已幫你記下這個備忘：LINE 回覆格式已經變簡單了。` 工具結果：Dropbox JSON +1，新增 `idea_2026-07-16_13-43-36.json`。
2. `01KXMQCKYXPN2T3T2HK92K60DM`：`幫我找和會員登入有關的想法`
   狀態 completed，attempts=1，final_push_status=sent，HTTP 200。LINE 第二段為自然查詢結果，找到 2 筆和「會員」較相關的想法，並說明目前沒有直接找到「會員登入」或 login。工具結果：查詢既有想法資料，Dropbox JSON +0。
3. `01KXMQH9J4GEG42CJB2SA0GFH8`：`幫我查看菲比股市練功房目前做到哪裡`
   狀態 completed，attempts=1，final_push_status=sent，HTTP 200。LINE 第二段自然摘要股市練功房目前完成的報表、儀表板、三大法人、學習資料庫、VCP 模組、PDF 報表與下一步補強方向。工具結果：只讀查詢專案狀態與資料，Dropbox JSON +0。

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

# 專案資訊

**專案名稱**

菲比 LINE 智能助理_02

**專案位置**

`/Users/phoebe/Documents/菲比 LINE 智能助理_02`

**固定資訊**

- LINE 官方帳號：`菲比智能客服 測試`
- 第一階段固定回覆：`記好了 ✨`
- Worker 名稱：`pline-v2-0-test-line-gateway-r2c3b`
- Worker 修改檔案：`workers/pline-v2-0-test-line-gateway-r2c3b/src/index.js`
- n8n workflow 名稱：`PLine｜菲比 LINE 智能助理｜V2.0`
- n8n Cloud workflow URL：`https://n8nphy.app.n8n.cloud/workflow/X1yl5OAKtZE2B24i?projectId=CpQJpNNFd9pH0LCm`
- n8n production webhook：`https://n8nphy.app.n8n.cloud/webhook/pline-v2-0-test`

---

# 第一階段結果

第一階段 LINE 固定回覆已 PASS，且目前仍正常。

已確認：

- LINE「菲比智能客服 測試」可收到測試訊息
- LINE Reply API 回覆 `記好了 ✨`
- 真實 LINE 測試畫面已顯示 `測試 V2.0 n8n` 與 `記好了 ✨`

---

# 第二階段 N8N V2.0 結果

第二階段 n8n 最小接收流程與 Worker 串接已完成。

已確認：

- n8n production webhook 單獨測試已通過
- 測試 payload：`{"text":"測試 V2.0 n8n"}`
- HTTP response：`200`
- response body：`{"ok":true,"version":"V2.0"}`
- LINE → Worker → n8n V2.0 已通過
- Worker tail 顯示 n8n HTTP 200
- n8n workflow 已產生真實執行紀錄並收到文字資料
- LINE Reply `記好了 ✨` 仍正常

補充：

LINE desktop 輸入框殘留內容造成一次附帶第二筆事件，但不影響指定測試成功。

---

# 本階段 TEST Dropbox 結果

本階段已 PASS：

```text
LINE「菲比智能客服 測試」
→ pline-v2-0-test-line-gateway-r2c3b
→ n8n workflow「PLine｜菲比 LINE 智能助理｜V2.0」
→ TEST Dropbox
```

已確認：

- LINE Reply `記好了 ✨` 仍 PASS
- TEST Dropbox 固定路徑：`/Users/phoebe/Library/CloudStorage/Dropbox/codex專案/菲比 LINE 智能助理_02/想法紀錄_TEST`
- 檔名格式：`idea_YYYY-MM-DD_HH-mm-ss.json`
- JSON 欄位：`text`、`created_at`、`Asia/Taipei`、`source`、`project`、`version`
- duplicate JSON = 0
- duplicate reply = 0
- 舊專案未修改
- FORMAL 未操作

---

# 本階段查詢功能結果

FIX worker 已完成日／月／年查詢功能並 PASS。

已完成的 `local-query-api` actions：

- `count_day`
- `list_day`
- `count_month`
- `list_month`
- `count_year`
- `list_year`

已確認：

- `local-query-api` 本機測試 HTTP 200
- `local-query-api` 同一 HTTPS tunnel 測試 HTTP 200
- 固定 Dropbox 路徑：`/Users/phoebe/Library/CloudStorage/Dropbox/codex專案/菲比 LINE 智能助理_02/想法紀錄_TEST`
- Worker 直接查詢分流：查詢文字由 Worker 回查詢結果
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
- n8n 未修改
- 舊專案未修改
- FORMAL 未操作
- LINE Webhook 未修改

---

# 第一版功能完整驗收

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

2026-07-16 已將目前成功版本保存為正式開發基準。

baseline 文件：

- `BASELINE.md`

n8n workflow 匯出：

- `n8n/baseline/PLine_V2.0_LINE_N8N_PASS.json`

已確認：

- LINE → Worker：PASS
- Worker → n8n V2.0：PASS
- LINE Reply `記好了 ✨`：PASS
- 匯出 JSON 未包含 token、secret、credentials
- TEST Dropbox JSON 已 PASS
- duplicate JSON = 0
- duplicate reply = 0
- AI 尚未加入

第二階段狀態：

```text
PHASE1_LINE_REPLY=passed
PHASE2_N8N_MINIMAL_RECEIVE=passed
LINE_TO_WORKER_TO_N8N=passed
BASELINE_STATUS=created
N8N_TO_TEST_DROPBOX_JSON=passed
DROPBOX_BASELINE_FILE=n8n/baseline/PLine_V2.0_LINE_N8N_DROPBOX_PASS.json
FORMAL_ALLOWED=false
```

---

# 固定開發原則｜綠燈不可破壞

任何已經 PASS、已經變成綠燈的流程，不得任意重構、拆除、改名或改寫。

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

# 固定開發原則｜功能優先模式

目前階段以最快完成實際功能為最高優先。

主線功能順序：

1. LINE 收到文字：PASS
2. LINE 回覆 `記好了 ✨`：PASS
3. n8n 收到文字：PASS
4. Dropbox 寫入 JSON：PASS
5. 自然語言記錄想法：PASS
6. 依日／月／年查詢與統計：PASS
7. 搜尋、查看、修改、刪除：PASS
8. 分類記錄與分類搜尋：PASS
9. Codex queue pending task：PASS

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

# 目前邊界

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
- baseline commit / tag 由 `PLine｜RELEASE｜階段收尾與上線檢查` 建立
- 未 push

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

# 後續安全補強｜主要功能完成後處理

- AI 分析
- 自然語言分類
- Codex 派工
- Database
- 複雜 Gate / trace / diagnostic / preflight / review / recovery / handoff / 狀態機 / 安全層

---

# 固定 Threads

本專案固定使用：

- PLine｜00｜總控制台
- PLine｜DOC｜文件與規格整理
- PLine｜N8N｜n8n workflow 調整
- PLine｜TEST｜測試與驗收
- PLine｜FIX｜小修正與命名同步
- PLine｜RELEASE｜階段收尾與上線檢查
- PLine｜ARCHIVE｜歷史建置紀錄

不得新增 Thread。
不得開子代理。
