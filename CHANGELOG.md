# CHANGELOG

---

## 2026-07-16

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

- 未加入 Dropbox
- 未加入 JSON 儲存
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
