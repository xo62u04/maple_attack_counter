# Loot Session History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把分錢系統從單一 session 改為多筆 session 清單，每筆可獨立填寫與編輯，資料永久保留。

**Architecture:** 在 `loot.js` 把 `session` ref 換成 `sessions` 陣列 + `currentSessionId` ref，並加一個 `currentSession` computed 讓現有邏輯幾乎不用改。`index.html` 在分錢區最上方加一排 session 選擇器，並把所有 `loot.session` 換成 `loot.currentSession`。

**Tech Stack:** Vue 3 (CDN), vanilla JS, 無 build pipeline，localStorage + Firebase Firestore 同步。

---

## 檔案清單

| 檔案 | 變更類型 | 說明 |
|------|---------|------|
| `loot.js` | 修改 | 資料模型重構：session → sessions/currentSession |
| `index.html` | 修改 | 新增 session 選擇器 UI，loot.session → loot.currentSession |
| `style.css` | 修改 | 新增 `.session-selector` 樣式 |

---

## Task 1：重構 `loot.js` 資料模型

**Files:**
- Modify: `loot.js`

### 步驟

- [ ] **Step 1：把 `session` ref 換成 `sessions` + `currentSessionId`**

把 `loot.js` 第 24-28 行（`const session = ref({...})`）整段換成：

```js
const sessions = ref([])           // [{ id, name, date, members, soldItems }]
const currentSessionId = ref(null)

const currentSession = computed(() =>
  sessions.value.find(s => s.id === currentSessionId.value) ?? sessions.value[0] ?? null
)
```

- [ ] **Step 2：新增 session 管理函式**

在 `nextId` 函式之後、`addMemberPreset` 之前插入：

```js
// ── Session 管理 ──
function addSession() {
  const s = { id: nextId(), name: '新分錢', date: '', members: [], soldItems: [] }
  sessions.value.push(s)
  currentSessionId.value = s.id
}
function deleteSession() {
  if (sessions.value.length <= 1) return
  sessions.value = sessions.value.filter(s => s.id !== currentSessionId.value)
  currentSessionId.value = sessions.value[sessions.value.length - 1].id
}
function switchSession(id) {
  currentSessionId.value = id
}
```

- [ ] **Step 3：更新操作函式，把 `session.value` 改為 `currentSession.value`**

以下函式全部把 `session.value` 改成 `currentSession.value`（共 6 處）：

```js
// addSessionMemberFromPreset
function addSessionMemberFromPreset(preset) {
  if (currentSession.value.members.find(m => m.name === preset.name)) return
  currentSession.value.members.push({ name: preset.name, share: preset.defaultShare })
}

// addSessionMemberManual
function addSessionMemberManual() {
  currentSession.value.members.push({ name: '臨時隊員', share: 1 })
}

// removeSessionMember
function removeSessionMember(idx) {
  currentSession.value.members.splice(idx, 1)
}

// addDropToSession
function addDropToSession(itemName, needsScissors, scissorType) {
  currentSession.value.soldItems.push({
    id: nextId(),
    itemName,
    qty: 1,
    pickedBy: '',
    status: 'pending',
    price: 0,
    fee: auctionFee.value,
    scissorType: needsScissors ? scissorType : 0,
  })
}

// removeSessionItem
function removeSessionItem(id) {
  currentSession.value.soldItems = currentSession.value.soldItems.filter(i => i.id !== id)
}

// clearSession
function clearSession() {
  const cs = currentSession.value
  if (!cs) return
  cs.date = ''
  cs.members = []
  cs.soldItems = []
}

// dropCount
function dropCount(itemName) {
  return currentSession.value?.soldItems.filter(i => i.itemName === itemName).length ?? 0
}
```

- [ ] **Step 4：更新 `settlementResult` computed**

`settlementResult` 內所有 `session.value` 改成 `currentSession.value`：

```js
const settlementResult = computed(() => {
  const members = currentSession.value?.members ?? []
  if (members.length === 0) return null

  const validItems = (currentSession.value?.soldItems ?? []).filter(
    i => i.status === 'sold' || i.status === 'selfuse'
  )
  // ... 以下邏輯不變
```

確認 `settlementResult` 內所有 `session.value.members` 和 `session.value.soldItems` 都已替換，其餘計算邏輯保持不動。

- [ ] **Step 5：更新 `getState()` / `setState()`**

```js
function getState() {
  return {
    mileageRate: mileageRate.value,
    cubePrice:   cubePrice.value,
    auctionFee:  auctionFee.value,
    memberPresets:  JSON.parse(JSON.stringify(memberPresets.value)),
    bossDropTables: JSON.parse(JSON.stringify(bossDropTables.value)),
    sessions:        JSON.parse(JSON.stringify(sessions.value)),
    currentSessionId: currentSessionId.value,
  }
}

function setState(s) {
  if (!s) return
  if (s.mileageRate != null) mileageRate.value = s.mileageRate
  if (s.cubePrice   != null) cubePrice.value   = s.cubePrice
  if (s.auctionFee  != null) auctionFee.value  = s.auctionFee
  if (s.memberPresets)  memberPresets.value  = s.memberPresets
  if (s.bossDropTables) bossDropTables.value = s.bossDropTables

  // 舊格式相容：有 session 無 sessions
  if (s.session && !s.sessions) {
    sessions.value = [{ id: 1, name: '舊紀錄', ...s.session }]
    currentSessionId.value = 1
  } else if (s.sessions && s.sessions.length > 0) {
    sessions.value = s.sessions
    currentSessionId.value = s.currentSessionId ?? s.sessions[0].id
  }

  // 全新安裝：sessions 仍為空則建立預設
  if (sessions.value.length === 0) addSession()

  // 重建 _nextId（避免 id 衝突）
  let maxId = 0
  for (const m of memberPresets.value) if (m.id > maxId) maxId = m.id
  for (const b of bossDropTables.value) {
    if (b.id > maxId) maxId = b.id
    for (const d of b.drops) if (d.id > maxId) maxId = d.id
  }
  for (const sess of sessions.value)
    for (const i of sess.soldItems) if (i.id > maxId) maxId = i.id
  _nextId = maxId + 1
}
```

- [ ] **Step 6：更新 return 物件**

把 `return` 最後的 `session` 換成新 exports：

```js
return {
  mileageRate, cubePrice, auctionFee,
  scissorCost3900, scissorCost7100,
  memberPresets, bossDropTables,
  sessions, currentSessionId, currentSession,
  settingsOpen,
  nextId,
  addMemberPreset, removeMemberPreset,
  addSessionMemberFromPreset, addSessionMemberManual, removeSessionMember,
  addBoss, removeBoss, addDrop, removeDrop,
  addDropToSession, removeSessionItem, clearSession, dropCount,
  addSession, deleteSession, switchSession,
  settlementResult,
  getState, setState,
}
```

- [ ] **Step 7：開啟瀏覽器，驗證 loot.js 無 console 錯誤**

1. 開啟 `index.html`（本地或 Live Server）
2. 切到「💰 分錢系統」tab
3. 開 DevTools Console → 確認無 `TypeError`/`undefined` 報錯
4. 在 Console 輸入 `app._context.provides` 或直接操作 UI 看看分錢功能是否還能正常新增物品

- [ ] **Step 8：Commit**

```bash
git add loot.js
git commit -m "refactor: replace single session with sessions array in loot.js"
```

---

## Task 2：新增 session 選擇器 UI（`index.html`）

**Files:**
- Modify: `index.html`

### 步驟

- [ ] **Step 1：在「本次結算」section 開頭加入 session 選擇器**

找到第 994 行附近：
```html
<section class="loot-section loot-session">
  <h2 class="loot-section-title">🎯 本次結算</h2>
```

在 `<h2>` 之後、`<!-- 日期 -->` 之前插入：

```html
        <!-- Session 選擇器 -->
        <div class="session-selector">
          <select class="session-select" @change="loot.switchSession(+$event.target.value)">
            <option
              v-for="s in loot.sessions"
              :key="s.id"
              :value="s.id"
              :selected="s.id === loot.currentSessionId"
            >{{ s.name }}{{ s.date ? ' (' + s.date + ')' : '' }}</option>
          </select>
          <button class="btn loot-session-add-btn" @click="loot.addSession()">＋ 新增</button>
          <button class="btn btn-delete loot-btn-sm" @click="loot.deleteSession()" :disabled="loot.sessions.length <= 1">刪除</button>
        </div>
```

- [ ] **Step 2：在「打王日期」前新增 session 名稱欄位**

找到第 998-1001 行：
```html
        <!-- 日期 -->
        <div class="loot-date-row">
          <label>打王日期</label>
          <input type="date" v-model="loot.session.date" class="loot-input-date" />
        </div>
```

整段替換成：
```html
        <!-- Session 名稱 + 日期 -->
        <div class="loot-date-row">
          <label>名稱</label>
          <input type="text" v-model="loot.currentSession.name" class="loot-input-session-name" placeholder="例：黑馬、卡麻" />
        </div>
        <div class="loot-date-row">
          <label>打王日期</label>
          <input type="date" v-model="loot.currentSession.date" class="loot-input-date" />
        </div>
```

- [ ] **Step 3：把所有 `loot.session.` 換成 `loot.currentSession.`**

在 `index.html` 中搜尋 `loot.session.`，逐一替換為 `loot.currentSession.`。

出現位置（依行號）：
- 原 1000 行：`loot.session.date` → `loot.currentSession.date`（Task 2 Step 2 已處理）
- 原 1011 行：`loot.session.members.some(...)` → `loot.currentSession.members.some(...)`
- 原 1017 行：`v-for="(m, idx) in loot.session.members"` → `loot.currentSession.members`
- 原 1022 行：`loot.session.members.reduce(...)` 兩處 → `loot.currentSession.members.reduce(...)`
- 原 1056 行：`loot.session.soldItems.length` → `loot.currentSession.soldItems.length`
- 原 1062 行：`v-for="item in loot.session.soldItems"` → `loot.currentSession.soldItems`
- 原 1066 行：`v-for="m in loot.session.members"` → `loot.currentSession.members`
- 原 1105 行：`loot.session.date` → `loot.currentSession.date`
- 原 1150 行：`loot.session.members.length` → `loot.currentSession.members.length`

替換完後用全域搜尋確認 `loot.session.` 已清零（index.html 內不應再出現）。

- [ ] **Step 4：驗證 UI 基本操作**

開啟瀏覽器，執行以下手動驗證：

1. 切到「💰 分錢系統」tab
2. 確認出現一排下拉選單 `[ 新分錢 ▼ ] [ ＋ 新增 ] [ 刪除（灰）]`
3. 點「＋ 新增」→ 下拉多一筆「新分錢」，「刪除」按鈕變可點
4. 在名稱欄輸入「黑馬」→ 下拉即時更新顯示「黑馬」
5. 選另一個 session → 物品明細清空（因為是空 session）
6. 回原 session → 物品明細恢復

- [ ] **Step 5：Commit**

```bash
git add index.html
git commit -m "feat: add session selector UI to loot tab"
```

---

## Task 3：新增 CSS 樣式（`style.css`）

**Files:**
- Modify: `style.css`

### 步驟

- [ ] **Step 1：搜尋 `.loot-clear-btn` 的樣式區塊位置**

在 `style.css` 中找到 `.loot-clear-btn` 附近，在該段之前（或之後）插入新樣式：

```css
/* ── Session 選擇器 ── */
.session-selector {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}
.session-select {
  flex: 1;
  background: var(--bg-input);
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--text);
  padding: 6px 10px;
  font-size: 14px;
  cursor: pointer;
}
.session-select:focus {
  outline: none;
  border-color: var(--accent);
}
.loot-session-add-btn {
  white-space: nowrap;
  padding: 6px 12px;
}
.loot-input-session-name {
  flex: 1;
  background: var(--bg-input);
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--text);
  padding: 6px 10px;
  font-size: 14px;
}
.loot-input-session-name:focus {
  outline: none;
  border-color: var(--accent);
}
```

- [ ] **Step 2：驗證樣式**

開啟瀏覽器，確認：
1. session 選擇器排成一橫排，下拉拉開足夠寬度
2. 名稱欄與日期欄對齊
3. 「刪除」按鈕在 sessions 只剩一個時顯示灰色不可點

- [ ] **Step 3：Commit**

```bash
git add style.css
git commit -m "style: add session selector styles"
```

---

## Task 4：端對端驗證 + 同步相容確認

**Files:** 無新修改

### 步驟

- [ ] **Step 1：多 session 操作流程驗證**

1. 建立 session「黑馬」，日期填今天，加 3 位隊員，新增 2 個掉落物
2. 點「＋ 新增」建立「卡麻」session，加不同隊員，新增 1 個物品
3. 切回「黑馬」→ 確認 3 位隊員、2 個物品都在
4. 切到「卡麻」→ 確認是獨立的 1 個物品
5. 重新整理頁面 → 確認兩個 session 都保留，切換後資料正確

- [ ] **Step 2：舊資料相容驗證**

在 DevTools Console 手動設定舊格式存檔，驗證 migration：

```js
localStorage.setItem('maple_loot_settings', JSON.stringify({
  mileageRate: 18000, cubePrice: 100, auctionFee: 3,
  memberPresets: [], bossDropTables: [],
  session: { date: '2026-05-01', members: [{ name: '舊玩家', share: 1 }], soldItems: [] }
}))
```

重新整理頁面 → 應看到一個名為「舊紀錄」、日期 2026-05-01 的 session，隊員「舊玩家」完整保留。

- [ ] **Step 3：Firebase 同步驗證**

1. 設定同步碼，按「確認」
2. 建立多個 sessions，操作一些物品
3. 確認狀態列顯示「已同步」（無錯誤）
4. 換另一個瀏覽器 / 無痕視窗，輸入相同同步碼 → 拉取後確認 sessions 完整出現

- [ ] **Step 4：最終 commit**

```bash
git add -A
git status   # 確認無意外檔案
git commit -m "feat: loot session history - multi-session support complete"
```
