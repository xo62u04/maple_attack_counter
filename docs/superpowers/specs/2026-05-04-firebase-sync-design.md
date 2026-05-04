# Firebase 雲端同步設計

**日期：** 2026-05-04
**目標：** 讓使用者可以用一組自訂同步碼，在多台裝置之間同步所有存檔資料。

---

## 需求摘要

- 不需要帳號系統，使用者自訂一組同步碼（類似暗語）
- 開頁面時自動從 Firestore 拉取資料（覆蓋本地）
- 每次儲存時自動推送到 Firestore
- 同步範圍：角色存檔、掉寶設定、煉金設定（全部）

---

## Firestore 資料結構

Collection: `syncs`
Document ID: `{syncCode}`（使用者輸入的同步碼）

```
syncs/
  {syncCode}/
    characters  : array   // savedCharacters 的完整資料
    loot        : object  // lootSettings
    alchemy     : object  // alchemySettings
    updatedAt   : timestamp
```

---

## 行為邏輯

### 開頁面（Pull）
1. 讀取 localStorage 中的 `maple_sync_code`
2. 若有值 → 發送 Firestore GET 請求
3. 若文件存在 → 將 `characters`、`loot`、`alchemy` 寫入 localStorage，並呼叫現有的 `loadSavedCharacters()`、`loadLootSettings()`、`loadAlchemySettings()` 更新 Vue refs，讓畫面即時反映
4. 若文件不存在（新同步碼）→ 不動作，等待第一次儲存時建立

### 儲存時（Push）
在以下三個現有的儲存點，儲存到 localStorage 之後，若有同步碼則同步推送到 Firestore：
- `app.js` 中角色儲存（`localStorage.setItem(STORAGE_KEY, ...)`）
- `app.js` 中掉寶設定儲存（`localStorage.setItem(LOOT_SETTINGS_KEY, ...)`）
- `app.js` 中煉金設定儲存（`localStorage.setItem(ALCHEMY_SETTINGS_KEY, ...)`）

Firestore 寫入時帶入 `updatedAt: serverTimestamp()`，使用 `setDoc` with merge。

---

## UI 設計

在頁面適當位置（建議現有設定區塊或頁首）加入同步碼區塊：

```
[ 同步碼輸入框 ] [ 確認 ] [ 清除 ]
狀態文字：「已同步 / 同步中... / 同步失敗」
```

- 輸入同步碼後按「確認」：儲存到 localStorage，立刻觸發一次 Pull
- 按「清除」：刪除 localStorage 中的同步碼，停用同步功能
- 狀態文字顯示目前同步狀態（idle / loading / error）

---

## Firebase 設定

- 使用 Firebase Web SDK v9 (modular)，透過 CDN `<script type="module">` 引入，不需要 npm build
- 在 `index.html` 加入 Firebase 初始化 config（從 Firebase Console 取得）
- 新增獨立模組 `sync.js` 處理所有 Firestore 邏輯，讓 `app.js` 只呼叫簡單函式

### Firestore 安全規則
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /syncs/{syncCode} {
      allow read, write: if true;
    }
  }
}
```
> 知道同步碼即可讀寫，符合「簡單就好」的需求。

---

## 新增檔案

| 檔案 | 說明 |
|------|------|
| `sync.js` | Firebase 初始化、pull、push 函式 |

## 修改檔案

| 檔案 | 修改內容 |
|------|---------|
| `index.html` | 加入 Firebase CDN script tags、同步碼 UI |
| `app.js` | 在三個儲存點加入 push 呼叫、頁面載入時呼叫 pull |
| `style.css` | 同步碼區塊的樣式 |

---

## 範圍外（不做）

- 衝突偵測（最後寫入的裝置為準）
- 版本歷史
- 帳號系統
- 即時監聽（onSnapshot）
