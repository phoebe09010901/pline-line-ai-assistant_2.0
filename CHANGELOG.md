# CHANGELOG

---

## 2026-07-16

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
5. 自然語言記錄想法
6. 依日／月／年查詢與統計
7. 後續 Codex 派工能力

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
