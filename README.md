# 菲比 LINE 智能助理_02

本專案是重新建立的簡化版，目前主線在 V3.4 / KV quota / admin allowlist / duplicate guard 收尾後待修正。

本輪文件結論以 2026-07-17 closeout 為準，不以舊 V3.4 / V3.3 / V3.1 / V3.0 / V2 / 第一版 Dropbox baseline 或 receive-only checkpoint 作為目前結論。

V3 目標主流程：

```text
LINE
-> Worker / Gateway 收到訊息
-> 即時 ACK
-> remote pending task
-> inbox monitor 領取
-> 執行工具 / 任務
-> LINE 第二段最終結果
```

目前保留既有真實閉環驗收結果，但今日 live caveat 必須優先於歷史 PASS。

---

## 目前狀態

- 專案階段：V3.4 / KV quota / admin allowlist / duplicate guard 待修正
- V3 主線：既有 LINE → 阿光 inbox → 執行 → LINE 第二段回覆閉環已建立
- V3.4 allowlist：owner admin 與非 admin deny 有歷史驗收
- 本輪 FIX：Worker source version `V3.4.2`，TEST / FORMAL source/config 已參數化，allowlist 支援逗號 / 空白 / 換行分隔
- KV quota：root cause 已定位，heartbeat/status throttling 已 release，待 quota reset 後重測
- 想法列表：今日 live 出現 ACK-only，不能用 V3.3 歷史 PASS 覆蓋
- V2 / 第一版：已保留為歷史 baseline 與功能驗收紀錄
- 工作邊界：TEST only
- FORMAL：不碰
- 舊專案：不修改
- 本次 RELEASE 判定：KV quota / 權限 / 重複防護修正前，不允許擴大標 PASS

已確認：

- V3.0 / V3.1 / V3.3 / V3.4 的歷史驗收已保留
- 阿光第一人稱與自然 LINE 回覆規格仍維持
- owner allowlist 修正歷史已完成：`admin / allow_admin`
- 非 admin deny 歷史已完成
- 本機 source 已支援多 admin allowlist 逗號 / 空白 / 換行分隔
- 本機 source 已支援 environment / task namespace / queue key / monitor push URL / idea/query path 分離
- Cloudflare KV write quota root cause 已定位
- throttling release commit：`79baab0e5fc639b771fdaa7d3f07984f400d036f`
- Worker version：`adbbb420-f203-4edd-88d4-6a9236865d87`
- V2 / 第一版功能 baseline 保留為受保護綠燈

不得誤標 PASS：

- KV quota reset 後的真實 LINE 重測
- queue enqueue / heartbeat / 來源澄清
- `列出本月想法` 的第二段 final
- Worker source `V3.4.2` 已部署
- admin allowlist Gate 與多 admin secret live PASS
- 同一 event / task / execution / JSON / push 的全鏈路防重複
- FORMAL 環境
- n8n AI Agent
- Database / 多層 Gate / Safety Layer

---

## 文件入口

| 文件 | 用途 |
| --- | --- |
| `PROJECT_STATE.md` | 專案目標、V3.4 / KV quota / FIX source、邊界、固定 Threads |
| `PLine_DOC_SPEC_INDEX.md` | 文件地圖、2026-07-17 closeout / FIX、V2 / V3 baseline 關係 |
| `BASELINE.md` | 2026-07-17 closeout baseline note 與受保護歷史基準 |
| `CODEX_NOTES.md` | Codex 工作原則、V3 / 綠燈邊界、明日優先順序 |
| `CHANGELOG.md` | 日期式變更紀錄 |
| `PLine_ARCHIVE_HISTORY.md` | 歷史建置紀錄與 V3 / KV quota 階段節點索引 |
| `PLine_PHASE1_MINIMAL_REPLY_SPEC.md` | 第一階段最小可驗收規格 |
| `PLine_N8N_WORKFLOW_ADJUSTMENT_2026-07-15.md` | n8n 歷史判定、V2.0 baseline 與 V3 checkpoint recheck |
| `PLine_TEST_ACCEPTANCE_2026-07-15.md` | 第一階段測試前置驗收紀錄 |
| `PLine_RELEASE_CLOSEOUT_CHECK.md` | 階段收尾與上線檢查；目前 NO GO / live retest pending |
| `codex-inbox/monitor.js` | V3 inbox monitor、結果 JSON 解析、progress / final push、LINE 訊息防護 |
| `codex-inbox/com.pline.v3-monitor.plist` | V3 monitor LaunchAgent 設定 |
| `local-query-api/README.md` | local-query-api 查詢服務說明 |
| `local-query-api/server.js` | 查詢 / 搜尋 / 查看 / 修改 / 刪除服務 |
| `workers/pline-v2-0-test-line-gateway-r2c3b/src/index.js` | LINE Gateway / Worker 主程式 |
| `n8n/baseline/PLine_V2.0_LINE_N8N_DROPBOX_PASS.json` | 已通過的 n8n V2.0 Dropbox baseline 匯出 |
| `n8n/baseline/PLine_V2.0_LINE_N8N_PASS.json` | 已通過的 n8n V2.0 baseline 匯出 |
| `n8n/PLine_V2_0_workflow_skeleton.json` | 歷史 skeleton，不是目前 baseline |
| `n8n/README.md` | V2.0 workflow 與 baseline 狀態 |

---

## TEST / FORMAL Config

本機 source 已參數化，但尚未建立或部署 FORMAL。

主要 env/config：

- `PLINE_ENVIRONMENT`：runtime 環境，TEST 預設 `test`，FORMAL 應設 `formal`
- `CODEX_TASK_NAMESPACE` / `PLINE_TASK_NAMESPACE`：task namespace，預設 `default`
- `CODEX_EXECUTOR_STATUS_KEY`：monitor heartbeat key；未設時依 environment / namespace 推導
- `CODEX_PENDING_QUEUE_KEY`：pending queue key；未設時依 environment / namespace 推導
- `CODEX_WORKER_BASE_URL`：monitor progress / final push 的 Worker base URL
- `CODEX_FINAL_PUSH_URL` / `CODEX_PROGRESS_PUSH_URL`：完整 push endpoint override
- `CODEX_INBOX_RUNTIME_DIR`：monitor 本機 pending / processing / completed / failed 目錄
- `CODEX_TASK_LOG_DIR`：Codex 執行暫存輸出目錄
- `PLINE_IDEA_DIR` / `PLINE_IDEA_DELETED_DIR`：想法資料與刪除資料路徑
- `PLINE_QUERY_DATA_DIR`：local-query-api 查詢資料路徑；未設時使用 `PLINE_IDEA_DIR`

FORMAL 仍需 RELEASE 建立 Worker、KV、secret、monitor 與正式資料路徑後才能測試。

---

## 受保護 baseline

V2.0 / 第一版功能已通過並保留：

- LINE Reply `記好了 ✨`
- Worker → n8n V2.0
- n8n → TEST Dropbox JSON
- 日／月／年查詢
- 搜尋 / 查看 / 修改 / 刪除
- 分類記錄與分類搜尋
- Codex queue pending task

這些已 PASS 流程不得因 V3 修正被重構、改名、拆除或搬移。

---

## 阿光口吻與 LINE 回覆規則

對菲比顯示的 `progress_user_message` 與 `final_user_message` 必須維持同一人格：

- 以第一人稱「我」自然回報
- 使用簡單繁體中文，適合手機閱讀
- 先說實際完成了什麼，只保留菲比需要知道的結果
- 不顯示本機路徑、Markdown 連結、JSON 檔名、task_id、stdout、stderr、PID、secret / token
- 一般對話不把 LINE 端、Gateway、monitor、Worker 或 Codex 描述成不同角色
- 不使用「已交給 Codex」、「Codex 正在處理」、「等待 Codex 回覆」等內部說法

目前口吻防護位置：

- `codex-inbox/monitor.js`：prompt 規則與 `validateFinalUserMessage()`
- `workers/pline-v2-0-test-line-gateway-r2c3b/src/index.js`：quick / long immediate ACK 文案

長任務失敗通知規則：

- long task 執行失敗時，需產生自然的阿光失敗通知，不能只留下工程錯誤。
- 失敗通知需以第一人稱「我」說明這次沒有完成，並保留可稍後重試的語氣。
- 失敗通知同樣需通過 `validateFinalUserMessage()`，不得出現本機路徑、JSON 檔名、Markdown 連結、task_id、stdout、stderr、PID 或內部角色字眼。

第二次本機驗證重點：

- `progress_user_message` 與 `final_user_message` 皆需以「我」自然回報
- 自然完成回覆可通過 `validateFinalUserMessage()`
- 含本機路徑、JSON 檔名、task_id、stdout / stderr / PID、Markdown 連結、Codex / monitor / Worker / Gateway 等內部說法的對外訊息需被擋下
- long task 失敗通知可產生自然手機回覆，且會先通過同一套對外訊息防護
- 本輪只做本機文件整理與口吻防護驗證，未發送 LINE、未呼叫 push API、未修改遠端服務

---

## 目前仍不宣稱完成

- AI 分析
- Database
- 多層 Gate / Safety Layer
- FORMAL 環境操作
- 未做的 release / push / 遠端驗證

V2 / 第一版歷史仍保存已通過的 LINE → Worker → n8n V2.0 → TEST Dropbox JSON，且 LINE Reply `記好了 ✨` 仍 PASS。

---

## 最新阻塞

- Cloudflare KV write quota 已觸發，真實 LINE 重測需等 quota reset。
- `列出本月想法` 今日 live 只收到 ACK、沒有第二段 final。
- 非 admin 帳號可觸發私人想法操作的權限問題仍需修正。
- 同一內容重複回覆、重複執行及重複產生 JSON 的問題仍需全鏈路修正。
- 多 admin allowlist 尚未更新 secret，不得標 PASS。

---

## 下一步

建議主線：

```text
完成 admin allowlist Gate
-> 修正 event / task / execution / JSON / push 全鏈路防重複
-> 完成非 admin 與 admin 真實 LINE 驗收
-> 修正想法列表只 ACK、沒有第二段 final
-> 安全問題 PASS 後再規劃 n8n AI Agent
```
