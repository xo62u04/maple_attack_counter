# Firebase 雲端同步 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 讓使用者輸入一組自訂同步碼，在多台裝置間自動同步所有存檔（角色、掉寶、煉金設定）。

**Architecture:** 新增 `sync.js` 模組（與 `loot.js`、`equip.js` 同模式），以 Firebase Firestore compat SDK 做雲端讀寫。`app.js` 負責協調：頁面載入時 pull、每次儲存後 push。

**Tech Stack:** Firebase 10.x (compat CDN), Cloud Firestore, Vue 3 CDN (global build)

---

## 異動檔案一覽

| 檔案 | 說明 |
|------|------|
| 新增 `sync.js` | Firebase 初始化、pull/push、同步碼 reactive state |
| 修改 `index.html` | 加入 Firebase CDN scripts、`sync.js`、header 同步碼 UI |
| 修改 `app.js` | 實例化 useSync()、pullAll/pushAll/onSetSyncCode、hook 三個 save 函式、onMounted 呼叫 pull、expose 至 template |
| 修改 `style.css` | `.sync-bar`、`.sync-input`、`.sync-status-text` 樣式 |

---

## Task 1: Firebase 專案設定（使用者手動操作）

**Files:** 無程式碼，僅使用者操作

- [ ] **Step 1: 建立 Firebase 專案**

  前往 https://console.firebase.google.com/ → 新增專案 → 輸入名稱 → 停用 Google Analytics（可選）→ 建立專案

- [ ] **Step 2: 啟用 Cloud Firestore**

  左側選單「建構」→「Firestore Database」→「建立資料庫」→ 選「以測試模式開始」→ 選離你最近的區域 → 完成

- [ ] **Step 3: 取得 Web App 設定**

  專案設定（齒輪圖示）→「您的應用程式」→「新增應用程式」→ 選 Web（`</>`）→ 輸入暱稱 → 不勾 Firebase Hosting → 註冊應用程式 → 複製 `firebaseConfig` 物件（下一個 Task 會用到）

  格式如下（值因專案而異）：
  ```js
  const firebaseConfig = {
    apiKey: "AIzaSy...",
    authDomain: "your-project.firebaseapp.com",
    projectId: "your-project",
    storageBucket: "your-project.appspot.com",
    messagingSenderId: "123456789",
    appId: "1:123:web:abc"
  }
  ```

- [ ] **Step 4: 確認**

  Firebase Console 的 Firestore 頁面可以看到空的資料庫畫面即完成。

---

## Task 2: 建立 sync.js

**Files:**
- Create: `sync.js`

- [ ] **Step 1: 建立 sync.js，填入從 Firebase Console 取得的 config**

  將 Task 1 Step 3 取得的 `firebaseConfig` 值填入：

  ```js
  // sync.js — Firebase Cloud Sync Composable
  // Vue 3 CDN (no build pipeline), Firebase 10.x compat SDK

  function useSync() {
    const { ref, computed } = Vue

    const SYNC_CODE_KEY = 'maple_sync_code'

    const syncCode     = ref(localStorage.getItem(SYNC_CODE_KEY) || '')
    const syncCodeDraft = ref(syncCode.value)
    const syncStatus   = ref('idle') // 'idle' | 'syncing' | 'ok' | 'error'

    let db = null

    function _initFirebase() {
      if (db) return
      const firebaseConfig = {
        apiKey:            "FILL_IN",
        authDomain:        "FILL_IN",
        projectId:         "FILL_IN",
        storageBucket:     "FILL_IN",
        messagingSenderId: "FILL_IN",
        appId:             "FILL_IN"
      }
      const app = firebase.initializeApp(firebaseConfig)
      db = firebase.firestore(app)
    }

    async function pull(code) {
      _initFirebase()
      syncStatus.value = 'syncing'
      try {
        const snap = await db.collection('syncs').doc(code).get()
        syncStatus.value = 'ok'
        setTimeout(() => { if (syncStatus.value === 'ok') syncStatus.value = 'idle' }, 3000)
        return snap.exists ? snap.data() : null
      } catch (e) {
        syncStatus.value = 'error'
        return null
      }
    }

    async function push(code, data) {
      _initFirebase()
      syncStatus.value = 'syncing'
      try {
        await db.collection('syncs').doc(code).set({
          ...data,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        })
        syncStatus.value = 'ok'
        setTimeout(() => { if (syncStatus.value === 'ok') syncStatus.value = 'idle' }, 3000)
      } catch (e) {
        syncStatus.value = 'error'
      }
    }

    function applySyncCode(code) {
      syncCode.value      = code
      syncCodeDraft.value = code
      localStorage.setItem(SYNC_CODE_KEY, code)
    }

    function clearSyncCode() {
      syncCode.value      = ''
      syncCodeDraft.value = ''
      syncStatus.value    = 'idle'
      localStorage.removeItem(SYNC_CODE_KEY)
    }

    const statusText = computed(() => ({
      idle:    '',
      syncing: '⏳ 同步中...',
      ok:      '✅ 已同步',
      error:   '❌ 同步失敗'
    }[syncStatus.value]))

    return { syncCode, syncCodeDraft, syncStatus, statusText, pull, push, applySyncCode, clearSyncCode }
  }
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add sync.js
  git commit -m "feat: add sync.js Firebase composable"
  ```

---

## Task 3: 更新 index.html — Firebase CDN、sync.js、同步碼 UI

**Files:**
- Modify: `index.html`

- [ ] **Step 1: 在 script 區塊加入 Firebase CDN 與 sync.js**

  找到：
  ```html
    <script src="https://unpkg.com/vue@3/dist/vue.global.prod.js"></script>
    <script src="equip.js"></script>
  ```

  改成：
  ```html
    <script src="https://unpkg.com/vue@3/dist/vue.global.prod.js"></script>
    <script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js"></script>
    <script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js"></script>
    <script src="equip.js"></script>
  ```

  找到：
  ```html
    <script src="app.js?v=20260503-7"></script>
  ```

  改成（在 app.js 之前加入 sync.js）：
  ```html
    <script src="sync.js"></script>
    <script src="app.js?v=20260503-7"></script>
  ```

- [ ] **Step 2: 在 header-actions 加入同步碼 UI**

  找到：
  ```html
      <div class="header-actions">
  ```

  在這個 `<div class="header-actions">` 的開頭（`<button v-if...` 之前）加入：
  ```html
        <div class="sync-bar">
          <input
            v-model="sync.syncCodeDraft.value"
            class="sync-input"
            placeholder="同步碼"
            @keyup.enter="onSetSyncCode"
          />
          <button class="btn btn-sync" @click="onSetSyncCode" :disabled="!sync.syncCodeDraft.value.trim()">確認</button>
          <button class="btn btn-sync-clear" v-if="sync.syncCode.value" @click="sync.clearSyncCode()">清除</button>
          <span class="sync-status-text">{{ sync.statusText.value }}</span>
        </div>
  ```

- [ ] **Step 3: 開瀏覽器確認頁面不報錯**

  開 `index.html`（需透過本機伺服器，例如 `npx serve .` 或 VS Code Live Server），打開 DevTools Console，確認沒有 `firebase is not defined` 或其他錯誤。

- [ ] **Step 4: Commit**

  ```bash
  git add index.html
  git commit -m "feat: add Firebase CDN scripts and sync code UI to header"
  ```

---

## Task 4: 更新 app.js — 接入 sync 模組

**Files:**
- Modify: `app.js`

- [ ] **Step 1: 在 setup() 頂端實例化 useSync()**

  找到：
  ```js
  const { createApp, ref, computed, onMounted, watch } = Vue
  ```

  這行不動。在 `createApp({ setup() {` 的 setup 函式最前面（`const activeTab = ref('calc')` 之前），加入：

  ```js
      // ── 雲端同步 ──
      const sync = useSync()
  ```

- [ ] **Step 2: 加入 pullAll 與 pushAll 輔助函式**

  在 `loadAlchemySettings` 函式之後（約 line 648，`Vue.watch(() => JSON.stringify(alchemy.getState()), saveAlchemySettings)` 之前），加入：

  ```js
      async function pullAll() {
        const data = await sync.pull(sync.syncCode.value)
        if (!data) return
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
      }

      function pushAll() {
        if (!sync.syncCode.value) return
        sync.push(sync.syncCode.value, {
          characters: savedCharacters.value,
          loot: loot.getState(),
          alchemy: alchemy.getState()
        })
      }

      async function onSetSyncCode() {
        const code = sync.syncCodeDraft.value.trim()
        if (!code) return
        sync.applySyncCode(code)
        await pullAll()
      }
  ```

- [ ] **Step 3: 修改 persistSaves — 儲存後推送**

  找到：
  ```js
      function persistSaves() {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(savedCharacters.value))
        } catch { saveMessage.value = '⚠️ 儲存失敗（瀏覽器儲存空間不足）' }
      }
  ```

  改成：
  ```js
      function persistSaves() {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(savedCharacters.value))
        } catch { saveMessage.value = '⚠️ 儲存失敗（瀏覽器儲存空間不足）' }
        pushAll()
      }
  ```

- [ ] **Step 4: 修改 saveLootSettings — 儲存後推送**

  找到：
  ```js
      function saveLootSettings() {
        try {
          localStorage.setItem(LOOT_SETTINGS_KEY, JSON.stringify(loot.getState()))
        } catch {}
      }
  ```

  改成：
  ```js
      function saveLootSettings() {
        try {
          localStorage.setItem(LOOT_SETTINGS_KEY, JSON.stringify(loot.getState()))
        } catch {}
        pushAll()
      }
  ```

- [ ] **Step 5: 修改 saveAlchemySettings — 儲存後推送**

  找到：
  ```js
      function saveAlchemySettings() {
        try {
          localStorage.setItem(ALCHEMY_SETTINGS_KEY, JSON.stringify(alchemy.getState()))
        } catch {}
      }
  ```

  改成：
  ```js
      function saveAlchemySettings() {
        try {
          localStorage.setItem(ALCHEMY_SETTINGS_KEY, JSON.stringify(alchemy.getState()))
        } catch {}
        pushAll()
      }
  ```

- [ ] **Step 6: 修改 onMounted — 頁面載入時 pull**

  找到 `onMounted` 中的這段（約 line 37-43）：
  ```js
        loadFromUrl()
        loadSavedCharacters()
        initTab1Buffs()
        equip.initPartyBuffs()
        loadLootSettings()
        loadAlchemySettings()
  ```

  在 `loadAlchemySettings()` 之後加入：
  ```js
        if (sync.syncCode.value) pullAll()
  ```

- [ ] **Step 7: 在 return 中 expose sync 與新函式**

  找到 `return {` 區塊末端，在最後一行 `alchemy, saveAlchemySettings,` 之後加入：
  ```js
        sync, onSetSyncCode,
  ```

- [ ] **Step 8: 手動驗證**

  1. 開兩個不同瀏覽器（或一個無痕視窗）
  2. 在瀏覽器 A：輸入同步碼 `test123` → 按確認 → 儲存一個角色 → 確認 Console 沒有錯誤，狀態顯示「✅ 已同步」
  3. 在瀏覽器 B：輸入相同同步碼 `test123` → 按確認 → 確認角色出現

- [ ] **Step 9: Commit**

  ```bash
  git add app.js
  git commit -m "feat: wire Firebase sync into app.js save/load flow"
  ```

---

## Task 5: 更新 style.css — 同步碼 UI 樣式

**Files:**
- Modify: `style.css`

- [ ] **Step 1: 在 `.btn-import-file:hover` 之後加入同步 UI 樣式**

  找到：
  ```css
  .btn-import-file:hover { background: #3a5a3a; }
  ```

  在其後加入：
  ```css
  .sync-bar { display: flex; align-items: center; gap: 6px; }
  .sync-input {
    padding: 5px 10px;
    border-radius: 6px;
    border: 1px solid #3a5a8a;
    background: #1a2a4a;
    color: #c8d8f0;
    font-size: 13px;
    width: 120px;
  }
  .sync-input::placeholder { color: #6a8aaa; }
  .btn-sync { background: #2a4a6a; color: #7ec8e3; border: 1px solid #3a5a8a; }
  .btn-sync:hover:not(:disabled) { background: #3a5a7a; }
  .btn-sync-clear { background: #3a2a2a; color: #e38a8a; border: 1px solid #6a3a3a; }
  .btn-sync-clear:hover { background: #4a3a3a; }
  .sync-status-text { font-size: 12px; color: #7ec8e3; min-width: 80px; }
  ```

- [ ] **Step 2: 確認 header 在窄螢幕不爆版**

  縮小瀏覽器視窗到 900px 寬，確認 header 的按鈕不會溢出。如果溢出，在 `.site-header` 加上 `flex-wrap: wrap;`。

- [ ] **Step 3: Commit**

  ```bash
  git add style.css
  git commit -m "feat: add sync bar styles"
  ```

---

## Task 6: 設定 Firestore 安全規則

**Files:** 無程式碼，在 Firebase Console 操作

- [ ] **Step 1: 開啟規則編輯器**

  Firebase Console → Firestore Database → 「規則」分頁

- [ ] **Step 2: 將規則改為以下內容**

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

- [ ] **Step 3: 發布規則**

  按「發布」按鈕，等待「已儲存規則」提示。

- [ ] **Step 4: 端對端驗證**

  1. 清除兩個瀏覽器的 localStorage（DevTools → Application → Storage → Clear）
  2. 瀏覽器 A：設定同步碼、新增角色、調整掉寶設定、調整煉金設定 → 確認「✅ 已同步」
  3. 瀏覽器 B：設定同一同步碼 → 確認三種資料都出現

---

## Task 7: 加入 version query string（讓瀏覽器重新載入新檔案）

**Files:**
- Modify: `index.html`

- [ ] **Step 1: 更新 sync.js 與 app.js 的版本字串**

  找到：
  ```html
    <script src="sync.js"></script>
    <script src="app.js?v=20260503-7"></script>
  ```

  改成（日期換成今天）：
  ```html
    <script src="sync.js?v=20260504-1"></script>
    <script src="app.js?v=20260504-1"></script>
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add index.html
  git commit -m "chore: bump script versions for cache busting"
  ```

---

## 完成標準

- 輸入同步碼後按確認，頁面自動從雲端拉取資料
- 儲存角色/掉寶/煉金後，狀態列顯示「✅ 已同步」
- 換另一台裝置輸入相同同步碼，資料完整出現
- 清除同步碼後，同步功能停止（儲存只寫 localStorage）
