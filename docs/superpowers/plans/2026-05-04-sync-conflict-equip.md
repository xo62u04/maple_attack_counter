# 同步衝突偵測 + 裝備同步 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 設定同步碼時偵測本地與雲端資料衝突並讓使用者選擇，同時將裝備模擬器狀態納入同步範圍。

**Architecture:** 在 app.js 新增 `applyCloudData()`、`conflictDialog` ref、`resolveConflict()`、`formatSyncTime()` 並重寫 `onSetSyncCode()` 加入衝突偵測流程；`pushAll()` 改為 async 並在成功後記錄本地時間戳；`index.html` 加入衝突對話框 modal；`style.css` 加入對話框樣式。

**Tech Stack:** Vue 3 CDN global build, Firebase Firestore compat SDK, plain JS (no build pipeline)

---

## 異動檔案一覽

| 檔案 | 修改內容 |
|------|---------|
| `app.js` | 新增 `SYNC_LAST_PUSH_KEY`、`applyCloudData()`、`conflictDialog` ref、`formatSyncTime()`、`resolveConflict()`；重寫 `pushAll()`（async + equip + timestamp）；重寫 `pullAll()`（呼叫 applyCloudData）；重寫 `onSetSyncCode()`（衝突偵測）；更新 return |
| `index.html` | 新增衝突對話框 modal HTML |
| `style.css` | 新增衝突對話框樣式 |

---

## Task 1: app.js — equip 同步 + applyCloudData + pushAll timestamp

**Files:**
- Modify: `app.js`

這個 task 把現有的 pull/push 邏輯重構：提取 `applyCloudData()`、更新 `pullAll()` 呼叫它、更新 `pushAll()` 加入 equip 和時間戳。

- [ ] **Step 1: 在 `const sync = useSync()` 後加入 SYNC_LAST_PUSH_KEY 常數**

  找到：
  ```js
      const sync = useSync()
      let _pulling = false
  ```

  改成：
  ```js
      const sync = useSync()
      let _pulling = false
      const SYNC_LAST_PUSH_KEY = 'maple_sync_last_push'
  ```

- [ ] **Step 2: 在 `pullAll` 之前新增 `applyCloudData` 函式**

  找到：
  ```js
      async function pullAll() {
  ```

  在它的上方插入：
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

- [ ] **Step 3: 將 `pullAll` 改為呼叫 applyCloudData**

  找到整個 `pullAll` 函式：
  ```js
      async function pullAll() {
        if (!sync.syncCode.value) return
        _pulling = true
        try {
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
        } finally {
          await Vue.nextTick()
          _pulling = false
        }
      }
  ```

  改成：
  ```js
      async function pullAll() {
        if (!sync.syncCode.value) return
        _pulling = true
        try {
          const data = await sync.pull(sync.syncCode.value)
          if (!data) return
          applyCloudData(data)
        } finally {
          await Vue.nextTick()
          _pulling = false
        }
      }
  ```

- [ ] **Step 4: 將 `pushAll` 改為 async，加入 equip 和時間戳**

  找到整個 `pushAll` 函式：
  ```js
      function pushAll() {
        if (!sync.syncCode.value) return
        if (_pulling) return
        sync.push(sync.syncCode.value, {
          characters: savedCharacters.value,
          loot: loot.getState(),
          alchemy: alchemy.getState()
        })
      }
  ```

  改成：
  ```js
      async function pushAll() {
        if (!sync.syncCode.value) return
        if (_pulling) return
        await sync.push(sync.syncCode.value, {
          characters: savedCharacters.value,
          loot: loot.getState(),
          alchemy: alchemy.getState(),
          equip: equip.getState()
        })
        if (sync.syncStatus.value !== 'error') {
          localStorage.setItem(SYNC_LAST_PUSH_KEY, new Date().toISOString())
        }
      }
  ```

- [ ] **Step 5: Commit**

  ```bash
  git add app.js
  git commit -m "feat: add equip to sync scope, refactor applyCloudData, store push timestamp"
  ```

---

## Task 2: app.js — 衝突對話框 state + onSetSyncCode 衝突偵測 + resolveConflict

**Files:**
- Modify: `app.js`

- [ ] **Step 1: 在 `applyCloudData` 之前新增衝突對話框 reactive state 和 formatSyncTime**

  找到：
  ```js
      function applyCloudData(data) {
  ```

  在它的上方插入：
  ```js
      const conflictDialog = ref({ show: false, cloudData: null, cloudTime: null, localTime: null })

      function formatSyncTime(date) {
        if (!date) return '不明'
        const d = date instanceof Date ? date : new Date(date)
        return d.toLocaleString('zh-TW', {
          timeZone: 'Asia/Taipei',
          year: 'numeric', month: '2-digit', day: '2-digit',
          hour: '2-digit', minute: '2-digit'
        })
      }

  ```

  注意：`ref` 在 app.js 最外層 `const { createApp, ref, computed, ... } = Vue` 已解構，setup 內可直接使用。

- [ ] **Step 2: 重寫 onSetSyncCode 加入衝突偵測流程**

  找到整個 `onSetSyncCode` 函式：
  ```js
      async function onSetSyncCode() {
        const code = sync.syncCodeDraft.value.trim()
        if (!code) return
        if (code.includes('/') || code === '.' || code === '..') {
          sync.syncStatus.value = 'error'
          setTimeout(() => { if (sync.syncStatus.value === 'error') sync.syncStatus.value = 'idle' }, 3000)
          return
        }
        sync.applySyncCode(code)
        await pullAll()
      }
  ```

  改成：
  ```js
      async function onSetSyncCode() {
        const code = sync.syncCodeDraft.value.trim()
        if (!code) return
        if (code.includes('/') || code === '.' || code === '..') {
          sync.syncStatus.value = 'error'
          setTimeout(() => { if (sync.syncStatus.value === 'error') sync.syncStatus.value = 'idle' }, 3000)
          return
        }
        sync.applySyncCode(code)

        const cloudData = await sync.pull(code)

        if (!cloudData) {
          await pushAll()
          return
        }

        const localSyncedAt = localStorage.getItem(SYNC_LAST_PUSH_KEY)
        if (!localSyncedAt) {
          _pulling = true
          try { applyCloudData(cloudData) } finally { await Vue.nextTick(); _pulling = false }
          return
        }

        const cloudTime = cloudData.updatedAt?.toDate?.()
        if (!cloudTime) {
          _pulling = true
          try { applyCloudData(cloudData) } finally { await Vue.nextTick(); _pulling = false }
          return
        }

        const localTime = new Date(localSyncedAt)
        const diffMs = Math.abs(cloudTime.getTime() - localTime.getTime())

        if (diffMs < 1000) {
          _pulling = true
          try { applyCloudData(cloudData) } finally { await Vue.nextTick(); _pulling = false }
          return
        }

        conflictDialog.value = { show: true, cloudData, cloudTime, localTime }
      }
  ```

- [ ] **Step 3: 在 onSetSyncCode 之後新增 resolveConflict 函式**

  找到：
  ```js
      Vue.watch(() => JSON.stringify(alchemy.getState()), saveAlchemySettings)
  ```

  在它的上方插入：
  ```js
      async function resolveConflict(choice) {
        const { cloudData } = conflictDialog.value
        conflictDialog.value = { show: false, cloudData: null, cloudTime: null, localTime: null }
        if (choice === 'cloud') {
          _pulling = true
          try { applyCloudData(cloudData) } finally { await Vue.nextTick(); _pulling = false }
        } else {
          await pushAll()
        }
      }

  ```

- [ ] **Step 4: 在 return 中 expose 新增的函式和 state**

  找到：
  ```js
        sync, onSetSyncCode,
  ```

  改成：
  ```js
        sync, onSetSyncCode,
        conflictDialog, resolveConflict, formatSyncTime,
  ```

- [ ] **Step 5: Commit**

  ```bash
  git add app.js
  git commit -m "feat: add conflict dialog state, detection in onSetSyncCode, resolveConflict"
  ```

---

## Task 3: index.html — 衝突對話框 modal HTML

**Files:**
- Modify: `index.html`

- [ ] **Step 1: 在 `</div><!-- end #app -->` 之前加入衝突 modal**

  找到：
  ```html
    </div><!-- end #app -->
  ```

  在它的正上方插入：
  ```html
    <!-- ── 衝突解決對話框 ── -->
    <div v-if="conflictDialog.show" class="conflict-overlay">
      <div class="conflict-modal">
        <div class="conflict-title">⚠️ 偵測到資料不同步</div>
        <div class="conflict-row">
          <span class="conflict-label">本地資料</span>
          <span class="conflict-time">最後儲存：{{ formatSyncTime(conflictDialog.localTime) }}</span>
        </div>
        <div class="conflict-row">
          <span class="conflict-label">雲端資料</span>
          <span class="conflict-time">最後儲存：{{ formatSyncTime(conflictDialog.cloudTime) }}</span>
        </div>
        <div class="conflict-actions">
          <button class="btn btn-conflict-local" @click="resolveConflict('local')">用本地資料</button>
          <button class="btn btn-conflict-cloud" @click="resolveConflict('cloud')">用雲端資料</button>
        </div>
      </div>
    </div>

  ```

  注意：`conflictDialog` 是 top-level ref，在 Vue template 中自動 unwrap，所以 `conflictDialog.show` 即 `conflictDialog.value.show`，不需要加 `.value`。

- [ ] **Step 2: Commit**

  ```bash
  git add index.html
  git commit -m "feat: add conflict resolution modal to index.html"
  ```

---

## Task 4: style.css — 衝突對話框樣式

**Files:**
- Modify: `style.css`

- [ ] **Step 1: 在 `.sync-status-text` 規則之後加入衝突對話框樣式**

  找到：
  ```css
  .sync-status-text { font-size: 12px; color: #7ec8e3; min-width: 80px; }
  ```

  在它的後面加入：
  ```css
  .conflict-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.72);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
  }
  .conflict-modal {
    background: var(--bg-panel);
    border: 2px solid var(--accent);
    border-radius: 12px;
    padding: 28px 32px;
    min-width: 320px;
    display: flex;
    flex-direction: column;
    gap: 18px;
  }
  .conflict-title { font-size: 16px; font-weight: bold; color: #f8c96b; }
  .conflict-row { display: flex; justify-content: space-between; align-items: center; gap: 16px; }
  .conflict-label { color: #7ec8e3; font-weight: 600; white-space: nowrap; }
  .conflict-time { color: #c8d8f0; font-size: 13px; }
  .conflict-actions { display: flex; gap: 12px; justify-content: flex-end; margin-top: 4px; }
  .btn-conflict-local { background: #2a3a2a; color: #7ec87e; border: 1px solid #3a6a3a; }
  .btn-conflict-local:hover { background: #3a4a3a; }
  .btn-conflict-cloud { background: var(--accent); color: #000; }
  .btn-conflict-cloud:hover { opacity: 0.85; }
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add style.css
  git commit -m "feat: add conflict resolution modal styles"
  ```

---

## Task 5: index.html — Bump 版本字串

**Files:**
- Modify: `index.html`

- [ ] **Step 1: 更新所有 script/style 版本字串**

  找到並更新以下四個版本字串（全部從 `20260504-1` 改為 `20260504-2`）：

  ```html
  <link rel="stylesheet" href="style.css?v=20260504-1" />
  ```
  改成：
  ```html
  <link rel="stylesheet" href="style.css?v=20260504-2" />
  ```

  ```html
  <script src="alchemy.js?v=20260504-1"></script>
  <script src="sync.js?v=20260504-1"></script>
  <script src="app.js?v=20260504-1"></script>
  ```
  改成：
  ```html
  <script src="alchemy.js?v=20260504-2"></script>
  <script src="sync.js?v=20260504-2"></script>
  <script src="app.js?v=20260504-2"></script>
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add index.html
  git commit -m "chore: bump script versions for cache busting"
  ```

---

## 完成標準

- 設定同步碼時，若雲端有資料且與本地時間差 > 1 秒 → 跳出衝突對話框
- 按「用本地資料」→ 本地資料推上雲端，對話框關閉
- 按「用雲端資料」→ 雲端資料套用到本地（含裝備），對話框關閉
- 儲存任何資料後，Firestore 的 `equip` 欄位也跟著更新
- 換裝備後儲存角色 → 換裝置設定同一同步碼 → 裝備資料出現
