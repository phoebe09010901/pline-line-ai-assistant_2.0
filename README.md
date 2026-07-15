# 菲比 LINE 智能助理_02

本專案是重新建立的簡化版。

第一階段只驗證一條最小主流程：

```text
LINE 收到文字訊息
-> Webhook 收到事件
-> 呼叫 LINE Reply API
-> 回覆「記好了 ✨」
```

只要這條流程在 TEST 環境真實跑通，第一階段就算成功。

---

## 目前狀態

- 專案階段：V2.0 LINE → Worker → n8n → TEST Dropbox baseline 已建立
- 工作邊界：TEST only
- FORMAL：不碰
- 舊專案：不修改
- 本次 RELEASE 判定：TEST Dropbox baseline PASS，FORMAL 仍不允許

---

## 文件入口

| 文件 | 用途 |
| --- | --- |
| `BASELINE.md` | V2.0 LINE / Worker / n8n / TEST Dropbox 成功基準 |
| `PROJECT_STATE.md` | 專案目標、階段、邊界、固定 Threads |
| `PLine_DOC_SPEC_INDEX.md` | 文件地圖與規格同步狀態 |
| `PLine_PHASE1_MINIMAL_REPLY_SPEC.md` | 第一階段最小可驗收規格 |
| `PLine_N8N_WORKFLOW_ADJUSTMENT_2026-07-15.md` | n8n 延後判定紀錄 |
| `n8n/baseline/PLine_V2.0_LINE_N8N_DROPBOX_PASS.json` | 已通過的 n8n V2.0 Dropbox baseline 匯出 |
| `n8n/baseline/PLine_V2.0_LINE_N8N_PASS.json` | 已通過的 n8n V2.0 baseline 匯出 |
| `n8n/PLine_V2_0_workflow_skeleton.json` | 歷史 skeleton，不是目前 baseline |
| `n8n/README.md` | V2.0 workflow 與 baseline 狀態 |
| `PLine_TEST_ACCEPTANCE_2026-07-15.md` | 第一階段測試前置驗收紀錄 |
| `PLine_RELEASE_CLOSEOUT_CHECK.md` | 階段收尾與上線檢查 |
| `PLine_ARCHIVE_HISTORY.md` | 歷史建置紀錄與階段節點索引 |
| `CODEX_NOTES.md` | Codex 工作原則與 Debug 邊界 |
| `CHANGELOG.md` | 日期式變更紀錄 |

---

## 目前仍不加入

- AI 分析
- 自然語言分類
- Codex 派工
- Database
- 多層 Gate / Safety Layer
- FORMAL 環境操作

目前保存已通過的 LINE → Worker → n8n V2.0 → TEST Dropbox JSON，且 LINE Reply `記好了 ✨` 仍 PASS。
