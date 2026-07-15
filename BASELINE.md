# 菲比 LINE 智能助理_02｜Baseline

日期：2026-07-16

---

## Baseline 名稱

`v2.0-line-n8n-baseline`

本 baseline 保存目前已通過的 TEST 主流程：

```text
LINE
→ Worker
→ n8n V2.0
→ LINE Reply「記好了 ✨」
```

---

## PASS 證據

- LINE → Worker：PASS
- Worker → n8n V2.0：PASS
- n8n HTTP response：`200`
- LINE Reply `記好了 ✨`：PASS
- LINE「菲比智能客服 測試」已收到 `記好了 ✨`

---

## 固定資訊

- Worker 名稱：`pline-v2-0-test-line-gateway-r2c3b`
- Worker 檔案：`workers/pline-v2-0-test-line-gateway-r2c3b/src/index.js`
- n8n workflow 名稱：`PLine｜菲比 LINE 智能助理｜V2.0`
- n8n workflow 匯出檔：`n8n/baseline/PLine_V2.0_LINE_N8N_PASS.json`
- n8n workflow 匯出狀態：已檢查，未包含 token、secret、credentials

---

## 尚未加入

- Dropbox
- JSON 儲存
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
- 不碰 FORMAL。
- 不修改舊專案：`/Users/phoebe/Documents/菲比 LINE 智能助理`
- 不保存 token、secret 或 credentials。
- 不 push。

---

## Baseline 狀態

```text
BASELINE_STATUS=created
LINE_TO_WORKER=passed
WORKER_TO_N8N_V2_0=passed
LINE_REPLY_FIXED_TEXT=passed
FORMAL_ALLOWED=false
DROPBOX_ADDED=false
JSON_STORAGE_ADDED=false
AI_ADDED=false
```
