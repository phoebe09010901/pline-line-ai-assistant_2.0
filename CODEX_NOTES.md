# CODEX NOTES

---

# 核心原則

保持簡單。

先讓功能真正跑通，再增加功能。

不要先建立大型架構。

---

# 第一階段流程

LINE

↓

Webhook

↓

LINE Reply API

↓

回覆：

```
記好了 ✨
```

完成。

---

# 開發原則

1. 每次只完成一件事情。
2. 完成後立即真實測試。
3. 測試成功再進下一步。
4. 不一次加入很多功能。
5. 不預先設計第二版功能。

---

# Debug 原則

遇到問題：

先修主流程。

不要：

- 新增 Gate
- 新增 Thread
- 新增 Tool
- 新增 Trace
- 新增 Safety Layer
- 新增 State Machine

先找真正停止的位置。

修好。

重新測一次。

---

# Computer Use 原則

若 Computer Use 可以完成：

- 點擊
- 操作 TEST 環境
- 傳送 TEST LINE
- 驗證結果

則由 Computer Use 自行完成。

除非：

- 需要菲比登入
- 多因素驗證
- 平台禁止
- 會碰 FORMAL

否則不要要求菲比操作。

---

# 固定 Threads

- PLine｜00｜總控制台
- PLine｜DOC｜文件與規格整理
- PLine｜N8N｜n8n workflow 調整
- PLine｜TEST｜測試與驗收
- PLine｜FIX｜小修正與命名同步
- PLine｜RELEASE｜階段收尾與上線檢查
- PLine｜ARCHIVE｜歷史建置紀錄

---

# 最重要目標

第一個綠燈：

LINE 收到訊息

↓

回覆：

**記好了 ✨**

只要做到這一步，就算第一階段成功。

後面的功能全部建立在這個成功基礎上。
