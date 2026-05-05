# 分錢 Session 多筆紀錄設計

**日期：** 2026-05-05
**目標：** 把分錢系統從單一 session 改為多筆 session 清單，每筆可獨立填寫與編輯，資料永久保留。

---

## 需求背景

每週有多隻 BOSS 要分錢，每筆分錢紀錄可能跨多天才能結算完畢。現有系統只有單一 `session`，開新的就蓋掉舊的，無法保留歷史紀錄。

---

## UI 設計

在分錢頁面最上方，現有 UI 之前，加入一排 session 選擇器：

```
[ 黑馬 5/5 ▼ ] [ + 新增 ] [ 刪除 ]
```

- 下拉選單：列出所有 session，顯示格式為 `名稱（日期）`
- **+ 新增**：建立空白 session，名稱預設「新分錢」，自動切換到該 session
- **刪除**：刪除目前 session；只剩一個 session 時禁用（不可刪）
- 切換 session 後，下方既有分錢 UI 立刻反映該 session 的資料，操作行為完全不變

每個 session 在既有的日期欄之前新增一個**名稱欄位**（例如「黑馬」、「卡麻希拉」），名稱與日期合起來顯示在下拉選單中。

---

## 資料結構

### 舊格式

```js
{
  mileageRate, cubePrice, auctionFee,
  memberPresets, bossDropTables,
  session: { date, members, soldItems }
}
```

### 新格式

```js
{
  mileageRate, cubePrice, auctionFee,
  memberPresets, bossDropTables,
  sessions: [
    { id, name, date, members, soldItems },
    ...
  ],
  currentSessionId: <number>
}
```

- `id`：數字，由現有 `nextId()` 產生
- `name`：使用者自訂字串，預設 `"新分錢"`
- `date`、`members`、`soldItems`：與舊 `session` 欄位相同

---

## loot.js 變更

### 新增 refs

```js
const sessions = ref([])           // [{ id, name, date, members, soldItems }]
const currentSessionId = ref(null)
```

### 新增 computed

```js
const currentSession = computed(() =>
  sessions.value.find(s => s.id === currentSessionId.value) || sessions.value[0]
)
```

### 現有函式調整

所有原本讀寫 `session.value` 的函式（`addDropToSession`、`removeSessionItem`、`clearSession`、`dropCount`、`settlementResult` 等）改為讀寫 `currentSession.value`。

原本 export 的 `session` ref 改為 export `currentSession` computed，讓 `app.js` / `index.html` 無需大幅改動。

### 新增函式

```js
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

### getState / setState 更新

`getState()` 回傳 `sessions` 陣列與 `currentSessionId`（移除舊 `session` 欄位）。

`setState()` 讀取 `sessions` 與 `currentSessionId`；若偵測到舊格式（有 `session` 無 `sessions`），自動包裝：

```js
if (s.session && !s.sessions) {
  sessions.value = [{ id: 1, name: '舊紀錄', ...s.session }]
  currentSessionId.value = 1
}
```

`setState()` 完成後，若 `sessions` 仍為空（全新安裝無任何存檔），自動呼叫 `addSession()` 建立第一筆。

---

## index.html 變更

在分錢 tab 的 session 區塊最上方，加入 session 選擇器 HTML（Vue template）：

```html
<div class="session-selector">
  <select @change="loot.switchSession(+$event.target.value)">
    <option v-for="s in loot.sessions" :key="s.id" :value="s.id"
            :selected="s.id === loot.currentSessionId">
      {{ s.name }}{{ s.date ? ' (' + s.date + ')' : '' }}
    </option>
  </select>
  <button @click="loot.addSession()">+ 新增</button>
  <button @click="loot.deleteSession()" :disabled="loot.sessions.length <= 1">刪除</button>
</div>
```

每個 session 的既有日期欄前加入名稱輸入欄：

```html
<input v-model="loot.currentSession.name" placeholder="Session 名稱" />
```

---

## style.css 變更

加入 `.session-selector` 樣式，風格與現有 UI 一致（同排 flex 佈局）。

---

## Firebase Sync 相容

`loot.getState()` 回傳的 `sessions` 陣列直接取代原本的 `loot.session`，`sync.js` / `app.js` 的 push/pull 路徑（`data.loot`）不需要改動。

---

## 範圍外（不做）

- Session 排序或篩選（依日期、依結算狀態）
- Session 複製
- Session 匯出
