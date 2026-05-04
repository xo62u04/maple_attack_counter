# 同步衝突偵測 + 裝備同步設計

**日期：** 2026-05-04
**目標：** 設定同步碼時偵測本地與雲端資料衝突，讓使用者選擇要用哪份；同時將裝備模擬器狀態納入同步範圍。

---

## 需求摘要

1. **衝突偵測**：只在使用者輸入並確認同步碼時觸發，比較本地與雲端的時間戳，若不同則顯示對話框讓使用者選擇
2. **裝備同步**：將 `equip.getState()` 納入 Firestore 同步，pull 時用 `equip.setState()` 還原

---

## 時間戳機制

**雲端時間戳：** Firestore document 的 `updatedAt` 欄位（server timestamp，每次 push 時寫入）

**本地時間戳：** localStorage key `maple_sync_last_push`，值為 ISO 8601 字串（e.g. `"2026-05-04T10:32:00.000Z"`），每次 push 成功後更新

**比較邏輯：**
- 雲端無資料 → 推本地上去（初始化），不顯示對話框
- 本地無資料（`maple_sync_last_push` 不存在）→ 直接套用雲端
- 兩邊都有資料：
  - `cloud.updatedAt ≈ localSyncedAt`（差距 < 1 秒）→ 視為相同，靜默套用雲端
  - 否則 → 顯示衝突對話框

---

## 衝突對話框 UI

彈出一個 modal（Vue v-if 控制），內容如下：

```
┌─────────────────────────────────────────┐
│  ⚠️ 偵測到資料不同步                    │
│                                         │
│  本地資料  最後儲存：2026-05-04 10:32   │
│  雲端資料  最後儲存：2026-05-04 11:15   │
│                                         │
│  [用本地資料]        [用雲端資料]        │
└─────────────────────────────────────────┘
```

- 按「**用本地資料**」→ 把本地資料推上雲端，關閉對話框
- 按「**用雲端資料**」→ 套用雲端資料到本地 + Vue refs，關閉對話框
- 時間顯示格式：`YYYY-MM-DD HH:mm`（台北時間）

---

## 同步資料範圍（更新後）

Firestore document `syncs/{syncCode}` 欄位：

```
characters  : array   // savedCharacters
loot        : object  // loot.getState()
alchemy     : object  // alchemy.getState()
equip       : object  // equip.getState()  ← 新增
updatedAt   : timestamp
```

---

## 行為邏輯更新

### onSetSyncCode（更新）

```
輸入同步碼 → trim → 驗證格式
  → applySyncCode(code)
  → 拉雲端資料 (sync.pull)
  → 若無雲端資料 → pushAll()（初始化）→ 結束
  → 若有雲端資料：
      取 localSyncedAt = localStorage.getItem('maple_sync_last_push')
      若無 localSyncedAt → applyCloudData() → 結束
      比較 cloud.updatedAt vs localSyncedAt
      若差距 < 1秒 → applyCloudData() → 結束
      否則 → 顯示衝突對話框（儲存 cloudData 待使用者選擇）
```

### pushAll（更新）

成功後額外儲存：
```js
localStorage.setItem('maple_sync_last_push', new Date().toISOString())
```

並加入 `equip: equip.getState()` 到推送資料。

### applyCloudData(data)（新增）

將雲端資料寫入 localStorage 並更新 Vue refs：
```js
function applyCloudData(data) {
  if (data.characters) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data.characters))
    loadSavedCharacters()
  }
  if (data.loot) {
    localStorage.setItem(LOOT_SETTINGS_KEY, JSON.stringify(data.loot))
    loadLootSettings()
  }
  if (data.alchemy) {
    localStorage.setItem(ALCHEMY_SETTINGS_KEY, JSON.stringify(data.alchemy))
    loadAlchemySettings()
  }
  if (data.equip) equip.setState(data.equip)
}
```

### pullAll（更新）

改為呼叫 `applyCloudData(data)`，不再重複邏輯。

### 使用者選擇「用本地資料」

```
pushAll() → 更新 maple_sync_last_push → 關閉對話框
```

### 使用者選擇「用雲端資料」

```
applyCloudData(cloudData) → 關閉對話框
```

---

## 異動檔案

| 檔案 | 修改內容 |
|------|---------|
| `sync.js` | `push()` 成功後回傳 `updatedAt` 給 app.js；或 app.js 自己記時間 |
| `app.js` | 新增衝突對話框 reactive state、`applyCloudData()`、更新 `onSetSyncCode`、更新 `pushAll`（加 equip + localSyncedAt）、更新 `pullAll`（加 equip） |
| `index.html` | 新增衝突對話框 HTML（v-if modal） |
| `style.css` | 衝突對話框樣式 |

---

## 範圍外（不做）

- 自動定期同步
- 三方合併（只選其中一份，不 merge）
- 逐欄位比較（整份資料為單位）
