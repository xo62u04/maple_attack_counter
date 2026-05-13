# BOSS 週排程系統設計文件

**日期：** 2026-05-13
**專案：** maple_attack_counter
**範圍：** 新增 `schedule.js`，修改 `index.html`、`sync.js`、`loot.js`

---

## 1. 功能概述

為現有的分錢系統延伸一套 BOSS 週排程系統，讓固定團隊能：
- 管理成員角色資料（等級、可打哪些王）
- 設定每隻 BOSS 的分團組成與每週場次
- 每位成員填入自己的不可用時段（固定 + 臨時）
- 系統自動排出最佳打王時間，管理員可手動調整
- 完成一場後一鍵連動到分錢系統建立 session

---

## 2. 資料模型

所有資料儲存於現有 Firebase sync doc（同一個 sync code）。

### 2.1 scheduleMembers

```js
scheduleMembers: [
  {
    name: "小明",                    // 對應 memberPresets 的名字
    pinHash: "sha256_hash_string",   // SHA-256(PIN)
    isAdmin: false,
    characters: [
      { name: "小明主", level: 280 },
      { name: "小明副", level: 250 }
    ],
    recurringUnavailable: [
      // 每週固定不可用時段（每週重複）
      { dayOfWeek: 1, startHour: 9, endHour: 18 }  // 0=週日, 1=週一...
    ]
  }
]
```

### 2.2 scheduleBosses

```js
scheduleBosses: [
  {
    id: 1,
    name: "黑魔法師",
    minLevel: 260,
    parties: [
      {
        id: 1,
        label: "A團",
        members: ["小明", "小花", "小華"],
        runsPerWeek: 1
      },
      {
        id: 2,
        label: "B團",
        members: ["小明", "小賴", "小布"],
        runsPerWeek: 2
      }
    ]
  }
]
```

### 2.3 weeklySchedules

最多保留 3 筆（本週 + 往後兩週）。每週一自動 roll forward：移除最舊一週，加入新的第三週。

```js
weeklySchedules: [
  {
    weekStart: "2026-05-11",   // 當週週一 ISO 日期（YYYY-MM-DD）
    runs: [
      {
        id: 1,
        bossId: 1,
        partyId: 1,
        dayOfWeek: 3,          // 0=週日, 1=週一 ... 6=週六
        hour: 20,              // 0~23
        members: ["小明", "小花", "小華"],
        status: "auto",        // "auto" | "manual" | "confirmed" | "done" | "unschedulable"
        lootSessionId: null    // 連動分錢後填入 session id
      }
    ],
    memberWeeklyUnavailable: {
      // 本週臨時不可用時段（與 recurringUnavailable 取聯集）
      "小明": [
        { dayOfWeek: 4, startHour: 19, endHour: 22 }
      ]
    }
  }
]
```

---

## 3. 身份識別

### 登入流程
1. 排程頁面頂部顯示登入列
2. 使用者從下拉選自己的名字，輸入 PIN
3. 前端計算 `SHA-256(PIN)`，與 Firebase 中的 `pinHash` 比對
4. 成功後，`{ name, pin }` 存入 `localStorage`，下次自動帶入
5. 新成員第一次登入時若 `pinHash` 為空，輸入的 PIN 即為設定

### 權限

| 動作 | 一般成員 | 管理員 |
|------|---------|--------|
| 登入 / 設定自己的 PIN | ✅ | ✅ |
| 填自己的不可用時段 | ✅ | ✅ |
| 查看排程 | ✅ | ✅ |
| 新增 / 修改 BOSS 與分團 | ❌ | ✅ |
| 觸發自動排程 | ❌ | ✅ |
| 手動調整排程時段 | ❌ | ✅ |
| 標記場次完成 / 連動分錢 | ❌ | ✅ |
| 管理成員角色清單 | ❌ | ✅ |

`isAdmin` 儲存於 `scheduleMembers`，只有已有 `isAdmin: true` 的帳號能設定其他人為管理員。

---

## 4. 自動排程演算法

### 輸入
- `scheduleBosses`（所有 BOSS 及分團）
- `scheduleMembers`（固定不可用時段）
- 當週 `memberWeeklyUnavailable`（臨時不可用）
- 當週已 `"manual"` 或 `"confirmed"` 的場次（不覆蓋）

### 步驟

1. **鎖定不可覆蓋的場次**：`status` 為 `"manual"` / `"confirmed"` / `"done"` 的 run 保留不動。
2. **建立每人可用格**：合併 `recurringUnavailable` + `memberWeeklyUnavailable`，得出每人每週 168 個小時格的可用狀態。
3. **對每個分團**（按 `bossId` + `partyId`）：
   a. 取所有分團成員的可用格交集 → 「全員可用」時段
   b. 排除已排入任一成員的既有場次時段（避免同一人同時打兩場）
   c. 對剩餘時段評分：
      - 平日 18:00–22:00 → +3 分
      - 週末任意時段 → +2 分
      - 其他時段 → +1 分
   d. 從高分到低分選取，選夠 `runsPerWeek` 個不重疊時段
   e. 找不到足夠時段 → 盡量排，不足的標記 `"unschedulable"`
4. 寫入 `weeklySchedules[week].runs`，`status: "auto"`

### 重排規則
- 管理員按「🔄 自動排程」觸發
- 只重排 `status === "auto"` 的場次
- `"manual"` / `"confirmed"` / `"done"` 不動

---

## 5. UI 版面

### 5.1 Tab 導航（新增）

`index.html` 最上方加三個 Tab，取代目前的 section 捲動：

```
[ 📅 排程 ]  [ 💰 分錢 ]  [ 🛠️ 設定 ]
```

### 5.2 排程 Tab 三個子區塊

**① 我的時間**（需登入）
- 登入列：名字下拉 + PIN 輸入 + 登入按鈕
- 週選擇器（本週 / 下週 / 下下週）
- 7 行（週日~週六）× 24 列（0~23 時）的格子表格
- 格子狀態：空白（可用）/ 深紅（固定不可用）/ 橘（本週臨時不可用）
- 點擊切換臨時不可用；長按切換固定不可用
- 儲存並 sync

**② BOSS 設定**（管理員顯示編輯按鈕）
- 列出所有 BOSS，可展開看分團
- 每個分團顯示：標籤、成員清單、每週場次數
- 管理員可新增 BOSS、新增/編輯分團、設定最低等級

**③ 本週排程**（所有人可看）
- 週選擇器
- 表格：橫軸 = 週一到週日，列 = 各分團
- 每格（已排入的場次）顯示：時間、成員、狀態標籤
- `"unschedulable"` 的格子顯示 ⚠️ 橘色警告
- 管理員操作：
  - 🔄 自動排程（整週重排 auto 場次）
  - 點擊場次 → 彈窗改時間（改為 manual）
  - ✅ 確認場次（auto → confirmed）
  - ✔ 標記完成 → 觸發分錢連動
- 每隻 BOSS 旁顯示「本週剩餘 N 場」（已 confirmed / done 的場次數 vs runsPerWeek）

### 5.3 連動分錢

管理員點「✔ 標記完成」後：
1. 在 `sessions` 建立新 session：
   - `name`：`"[BOSS名] [YYYY-MM-DD]"`
   - `members`：分團成員（從 `memberPresets` 帶入比例；若不在 memberPresets 中則 share 預設為 1）
   - `soldItems`：從 `bossDropTables` 帶入該 BOSS 的掉落物（status 預設 `"pending"`）
2. 將 `run.lootSessionId` 設為新 session id，`run.status` 改為 `"done"`
3. 切換到分錢 Tab 並跳到該 session

---

## 6. 檔案異動

| 檔案 | 異動內容 |
|------|---------|
| `schedule.js`（新增） | 所有排程邏輯：資料管理、演算法、狀態 |
| `index.html` | 加 Tab 導航；新增排程 Tab 三個子區塊的 HTML |
| `sync.js` | `getState` / `setState` 納入 `scheduleMembers`、`scheduleBosses`、`weeklySchedules` |
| `loot.js` | 新增 `createSessionFromRun(run, boss, party)` 接受排程的預填資料 |
| `style.css` | 排程相關樣式（格子表格、Tab、狀態色） |
| `app.js` | 掛載 `useSchedule()`，傳入現有 `loot`、`sync` 實例 |

---

## 7. 週期 Roll Forward

每次開啟頁面時（`app.js` 初始化）：
1. 計算當週週一日期
2. 若 `weeklySchedules` 最早一筆的 `weekStart` < 當週週一 → 移除
3. 若 `weeklySchedules` 筆數 < 3 → 補齊至 3 筆（新週以固定不可用時段跑一次自動排程）
4. 有變更則寫回 Firebase

---

## 8. 不在本次範圍內

- 推播通知提醒打王時間
- 出席記錄 / 出勤率統計
- BOSS 難度分級或傷害門檻
- 行動版特化排版
