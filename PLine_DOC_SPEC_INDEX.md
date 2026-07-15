# PLine｜DOC｜文件與規格整理

最後更新：2026-07-16

---

## DOC 任務目的

整理 `菲比 LINE 智能助理_02` 的文件入口與第一階段規格，讓後續固定 Thread 可以用同一套邊界判斷工作是否該做。

本任務只處理文件與規格。

不做：

- 程式實作
- n8n workflow
- LINE / Reply API 實際連線
- token / secret / credentials
- FORMAL 環境操作
- 舊專案同步或搬移

---

## 文件地圖

| 文件 | 狀態 | 說明 |
| --- | --- | --- |
| `BASELINE.md` | active | V2.0 LINE → Worker → n8n → TEST Dropbox 成功基準 |
| `README.md` | active | 專案入口與目前 baseline 摘要 |
| `PROJECT_STATE.md` | active | 專案狀態、目標、邊界、固定 Threads |
| `PLine_PHASE1_MINIMAL_REPLY_SPEC.md` | active | 第一階段最小 Reply API 驗收規格 |
| `PLine_N8N_WORKFLOW_ADJUSTMENT_2026-07-15.md` | referenced | n8n 延後到第二階段的判定紀錄 |
| `n8n/baseline/PLine_V2.0_LINE_N8N_DROPBOX_PASS.json` | active | 已通過的 n8n V2.0 Dropbox baseline 匯出 |
| `n8n/baseline/PLine_V2.0_LINE_N8N_PASS.json` | active | 已通過的 n8n V2.0 baseline 匯出 |
| `n8n/PLine_V2_0_workflow_skeleton.json` | historical | 2026-07-15 歷史 skeleton，不是目前 baseline |
| `n8n/README.md` | active | V2.0 workflow 與 baseline 狀態 |
| `PLine_TEST_ACCEPTANCE_2026-07-15.md` | referenced | 測試前置驗收與目前 blocked 原因 |
| `PLine_RELEASE_CLOSEOUT_CHECK.md` | referenced | 第一階段 release 收尾與上線判定 |
| `PLine_ARCHIVE_HISTORY.md` | active | 歷史建置紀錄與階段節點索引 |
| `CODEX_NOTES.md` | active | Codex 操作原則、Debug 原則、Computer Use 邊界 |
| `CHANGELOG.md` | active | 日期式變更紀錄 |

---

## 第一階段規格摘要

第一階段只驗收：

```text
LINE text message
-> Webhook receives event
-> LINE Reply API sends reply
-> user receives "記好了 ✨"
```

成功條件以真實 TEST LINE 收到回覆為準。

2026-07-16 已通過 V2.0 TEST Dropbox baseline：LINE → Worker → n8n V2.0 → TEST Dropbox JSON，且 LINE Reply `記好了 ✨` 仍 PASS。

目前 baseline 僅代表 TEST 主流程可作為正式開發基準；FORMAL 仍不允許，AI 仍未加入。

---

## Thread 分工

| Thread | 責任 |
| --- | --- |
| `PLine｜00｜總控制台` | 排定下一步、確認邊界、不自行新增 Thread |
| `PLine｜DOC｜文件與規格整理` | 維護文件入口、規格、狀態同步 |
| `PLine｜N8N｜n8n workflow 調整` | 維護 V2.0 n8n workflow 與 baseline 匯出 |
| `PLine｜TEST｜測試與驗收` | 真實 TEST 流程驗收與結果紀錄 |
| `PLine｜FIX｜小修正與命名同步` | 只處理已定位的小修正 |
| `PLine｜RELEASE｜階段收尾與上線檢查` | 階段完成後做收尾，不代表 FORMAL 上線 |
| `PLine｜ARCHIVE｜歷史建置紀錄` | 保留歷史紀錄，不回填複雜舊架構 |

---

## 下一步

交給 `PLine｜00｜總控制台` 決定 baseline 後的下一個單一功能。

不得直接修改 baseline，不得碰 FORMAL，不得在同一輪加入多個新功能。
