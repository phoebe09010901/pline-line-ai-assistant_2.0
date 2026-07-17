# PLine｜DOC｜文件與規格整理

最後更新：2026-07-17

---

## DOC 任務目的

整理 `菲比 LINE 智能助理_02` 的文件入口、規格、baseline 與 V3 主線狀態，讓後續固定 Thread 可以用同一套邊界判斷工作是否該做。

本任務只處理文件與規格。

不做：

- 程式實作或 runtime 修正
- n8n workflow 修改
- LINE / Reply API 實際連線
- token / secret / credentials
- FORMAL 環境操作
- 舊專案同步或搬移

---

## 目前文件結論

目前文件主線以 2026-07-17 closeout 與本輪 FIX 小修正為準：

```text
V3.4 / KV quota / admin allowlist / duplicate guard
PLine FIX source: V3.4.2 FORMAL config parameterization
```

V3.0 / V3.1 / V3.3 / V3.4 的歷史驗收可保留，但不得覆蓋今日最新 live caveat。

已確認：

- LINE → 阿光 inbox → 執行 → LINE 第二段回覆的既有閉環已建立
- V3.4 owner allowlist 修正歷史已完成，owner 可走 `admin / allow_admin`
- V3.4 非 admin deny 歷史已完成
- 本機 Worker source `V3.4.2` 已支援 allowlist 逗號 / 空白 / 換行分隔與 TEST / FORMAL source/config 參數化
- 阿光第一人稱與自然 LINE 回覆規格仍維持
- Cloudflare KV write quota root cause 已定位
- heartbeat/status throttling 已 release

仍不得誤標 PASS：

- KV quota reset 後的真實 LINE 重測
- queue enqueue / heartbeat / 來源澄清
- `列出本月想法` 的第二段 final
- Worker source `V3.4.2` 已部署
- admin allowlist Gate 與多 admin secret live PASS
- 同一 event / task / execution / JSON / push 的全鏈路防重複
- FORMAL、正式 LINE、正式 Cloudflare、n8n AI Agent

V2.0 / 第一版功能仍是受保護 baseline；V3.3 列表 PASS 也只能作為歷史證據，不能覆蓋今日 ACK-only live 問題。

---

## 文件地圖

| 文件 | 狀態 | 說明 |
| --- | --- | --- |
| `README.md` | active | 專案入口、2026-07-17 closeout / FIX 摘要、V2 / V3 baseline 關係 |
| `PROJECT_STATE.md` | active | 專案狀態、V3.4 / KV quota / FIX source、固定 Threads |
| `BASELINE.md` | active | 2026-07-17 closeout / FIX baseline note 與受保護歷史基準 |
| `CODEX_NOTES.md` | active | Codex 操作原則、V3 / 綠燈邊界、FIX 與明日優先順序 |
| `CHANGELOG.md` | active | 日期式變更紀錄 |
| `PLine_ARCHIVE_HISTORY.md` | active | 歷史建置紀錄與 V2 / 第一版 / V3 / KV quota 階段節點索引 |
| `PLine_PHASE1_MINIMAL_REPLY_SPEC.md` | active | 第一階段最小 Reply API 驗收規格 |
| `PLine_N8N_WORKFLOW_ADJUSTMENT_2026-07-15.md` | referenced | n8n 歷史判定、V2.0 baseline 匯出與 V3 checkpoint recheck |
| `PLine_TEST_ACCEPTANCE_2026-07-15.md` | referenced | 測試前置驗收、2026-07-16 V3 TEST、2026-07-17 local regression |
| `PLine_RELEASE_CLOSEOUT_CHECK.md` | referenced | 階段收尾、tag / commit 與 NO GO / live retest pending 上線判定 |
| `codex-inbox/monitor.js` | active | V3 Codex inbox monitor foundation |
| `codex-inbox/com.pline.v3-monitor.plist` | active | V3 monitor LaunchAgent 設定 |
| `codex-inbox/pending/.gitkeep` | active | V3 pending queue 目錄保留 |
| `codex-inbox/processing/.gitkeep` | active | V3 processing queue 目錄保留 |
| `codex-inbox/completed/.gitkeep` | active | V3 completed queue 目錄保留 |
| `codex-inbox/failed/.gitkeep` | active | V3 failed queue 目錄保留 |
| `local-query-api/README.md` | active | local-query-api 查詢服務與資料路徑 env 說明 |
| `local-query-api/server.js` | active | 日／月／年、搜尋、查看、修改、刪除等查詢服務；支援 `PLINE_QUERY_DATA_DIR` |
| `workers/pline-v2-0-test-line-gateway-r2c3b/src/index.js` | active | LINE Gateway / Worker 主程式；本機 source `V3.4.2` |
| `workers/pline-v2-0-test-line-gateway-r2c3b/wrangler.toml` | active | TEST vars 與 FORMAL env template；不含 secret |
| `n8n/baseline/PLine_V2.0_LINE_N8N_DROPBOX_PASS.json` | active | 已通過的 n8n V2.0 Dropbox baseline 匯出 |
| `n8n/baseline/PLine_V2.0_LINE_N8N_PASS.json` | active | 已通過的 n8n V2.0 baseline 匯出 |
| `n8n/PLine_V2_0_workflow_skeleton.json` | historical | 2026-07-15 歷史 skeleton，不是目前 baseline |
| `n8n/README.md` | active | V2.0 workflow 與 baseline 狀態 |

---

## V3 / V3.4 規格摘要

V3 目標流程：

```text
LINE
-> Worker / Gateway receives message
-> immediate ACK / progress
-> remote pending task
-> Codex monitor claims task
-> Codex executes intended tool/action
-> LINE receives second final result
```

目前可保留為歷史綠燈：

- V3.0 closed-loop verification 已完成真實驗收
- V3.1 阿光統一人格與自然任務回覆基準
- V3.3 offline queue recovery / fallback poll 驗收
- V3.4 owner allowlist / 非 admin deny 驗收
- 本機 source `V3.4.2`：allowlist 與 TEST / FORMAL source/config 參數化

目前最新 caveat：

- KV quota 已觸發且 throttling 已 release，需 quota reset 後重測
- 想法列表今日 live 出現 ACK-only，不得沿用 V3.3 列表 PASS 作為最新判定
- `V3.4.2` 尚未部署，多 admin allowlist Gate 與 FORMAL config 仍需 RELEASE / live 驗收
- duplicate guard 仍需做全鏈路回歸

下一步必須沿著明日修正主線前進，不得把 n8n AI Agent 或附件功能寫成已完成。

---

## V2 / 第一版 baseline 摘要

V2.0 / 第一版功能已通過並保留為受保護基準：

- LINE Reply `記好了 ✨` PASS
- Worker → n8n V2.0 PASS
- n8n → TEST Dropbox JSON PASS
- 日／月／年查詢 PASS
- 搜尋 / 查看 / 修改 / 刪除 PASS
- 分類記錄與分類搜尋 PASS
- Codex queue pending task PASS
- duplicate JSON = 0
- duplicate reply = 0

這些基準不得因 V3 修正被重構、改名、拆除或搬移。

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

交給 `PLine｜00｜總控制台` 決定下一個單一修正。

目前唯一主線：

```text
完成 admin allowlist Gate
-> 修正 event / task / execution / JSON / push 全鏈路防重複
-> 完成非 admin 與 admin 真實 LINE 驗收
-> 修正想法列表只 ACK、沒有第二段 final
-> 安全問題 PASS 後再規劃 n8n AI Agent
```

不得直接修改 baseline，不得碰 FORMAL，不得在同一輪加入多個新功能。
