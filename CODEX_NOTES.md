# CODEX NOTES

---

# 核心原則

保持簡單。

先讓功能真正跑通，再增加功能。

不要新增複雜 Gate、trace、diagnostic、preflight、review、recovery、handoff、狀態機或安全層。

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

# V2.0 Baseline

2026-07-16 已保存目前成功版本為正式開發基準。

基準檔案：

- `BASELINE.md`
- `n8n/baseline/PLine_V2.0_LINE_N8N_PASS.json`

baseline 必須保持：

- LINE → Worker PASS
- Worker → n8n V2.0 PASS
- LINE Reply `記好了 ✨` PASS
- 未加入 Dropbox、JSON、AI
- 不碰 FORMAL
- 不修改舊專案
- 不保存 token、secret、credentials

---

# 本輪邊界

- 舊專案未修改：`/Users/phoebe/Documents/菲比 LINE 智能助理`
- FORMAL 未操作
- 正式 LINE 未操作
- 未寫入或顯示 token、secret、credentials
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
