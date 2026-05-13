# BOSS 週排程系統 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在現有楓星工具內新增 BOSS 週排程系統，涵蓋成員身份識別、不可用時段管理、多分團自動排程、與分錢系統連動。

**Architecture:** 新增 `schedule.js` composable（模仿 `loot.js` 結構），掛載至 `app.js`；資料納入現有 Firebase sync doc；`index.html` 新增「排程」Tab 並新增三個子區塊的 HTML；`loot.js` 新增 `createSessionFromRun()`。

**Tech Stack:** Vue 3 CDN (no build), Firebase Firestore 10.x compat SDK, WebCrypto API (SHA-256), pure browser CSS Grid

---

## 檔案異動對照

| 檔案 | 動作 | 說明 |
|------|------|------|
| `schedule.js` | 新增 | 全部排程邏輯：state、identity、week utils、auto-scheduler |
| `loot.js` | 修改 | 新增 `createSessionFromRun()` |
| `app.js` | 修改 | 掛載 schedule、擴充 sync（currentSyncData / applyCloudData）、Tab |
| `index.html` | 修改 | 加 `<script src="schedule.js">`、Tab nav HTML、排程三區塊 HTML |
| `style.css` | 修改 | 排程相關樣式（grid、Tab、狀態色） |

---

## Task 1: schedule.js — 資料狀態與 CRUD

**Files:**
- Create: `schedule.js`

- [ ] **Step 1: 建立基礎 composable 骨架**

新增 `schedule.js`（參考 `loot.js` 模式）：

```js
function useSchedule() {
  const { ref, computed } = Vue

  let _nextId = 1
  function nextId() { return _nextId++ }

  // ── 核心資料 ──
  const scheduleMembers  = ref([])   // [{ name, pinHash, isAdmin, characters, recurringUnavailable }]
  const scheduleBosses   = ref([])   // [{ id, name, minLevel, parties: [{id,label,members,runsPerWeek}] }]
  const weeklySchedules  = ref([])   // [{ weekStart, runs, memberWeeklyUnavailable }]

  // ── Identity 狀態 ──
  const currentUser   = ref(null)   // { name, pinHash } | null
  const loginError    = ref('')
  const loginLoading  = ref(false)

  // ── 週選擇（UI 用）──
  const scheduleWeekIdx = ref(0)    // 0=本週, 1=下週, 2=下下週

  const currentWeekSchedule = computed(() =>
    weeklySchedules.value[scheduleWeekIdx.value] ?? null
  )

  // ── scheduleMembers CRUD ──
  function addScheduleMember(name) {
    if (scheduleMembers.value.find(m => m.name === name)) return
    scheduleMembers.value.push({
      name,
      pinHash: '',
      isAdmin: scheduleMembers.value.length === 0, // 第一個自動成管理員
      characters: [],
      recurringUnavailable: [],
    })
  }
  function removeScheduleMember(name) {
    scheduleMembers.value = scheduleMembers.value.filter(m => m.name !== name)
  }
  function setMemberAdmin(name, val) {
    const m = scheduleMembers.value.find(m => m.name === name)
    if (m) m.isAdmin = val
  }

  // ── 角色 CRUD ──
  function addCharacter(memberName) {
    const m = scheduleMembers.value.find(m => m.name === memberName)
    if (!m) return
    m.characters.push({ id: nextId(), name: '新角色', level: 200 })
  }
  function removeCharacter(memberName, charId) {
    const m = scheduleMembers.value.find(m => m.name === memberName)
    if (!m) return
    m.characters = m.characters.filter(c => c.id !== charId)
  }

  // ── scheduleBosses CRUD ──
  function addScheduleBoss() {
    scheduleBosses.value.push({ id: nextId(), name: '新王', minLevel: 200, parties: [] })
  }
  function removeScheduleBoss(id) {
    scheduleBosses.value = scheduleBosses.value.filter(b => b.id !== id)
  }
  function addParty(bossId) {
    const b = scheduleBosses.value.find(b => b.id === bossId)
    if (!b) return
    b.parties.push({ id: nextId(), label: 'A團', members: [], runsPerWeek: 1 })
  }
  function removeParty(bossId, partyId) {
    const b = scheduleBosses.value.find(b => b.id === bossId)
    if (!b) return
    b.parties = b.parties.filter(p => p.id !== partyId)
  }

  // ── getState / setState ──
  function getState() {
    return {
      scheduleMembers:  JSON.parse(JSON.stringify(scheduleMembers.value)),
      scheduleBosses:   JSON.parse(JSON.stringify(scheduleBosses.value)),
      weeklySchedules:  JSON.parse(JSON.stringify(weeklySchedules.value)),
    }
  }
  function setState(s) {
    if (!s) return
    if (s.scheduleMembers)  scheduleMembers.value  = s.scheduleMembers
    if (s.scheduleBosses)   scheduleBosses.value   = s.scheduleBosses
    if (s.weeklySchedules)  weeklySchedules.value  = s.weeklySchedules
    // 重建 _nextId
    let maxId = 0
    for (const b of scheduleBosses.value) {
      if (b.id > maxId) maxId = b.id
      for (const p of b.parties) if (p.id > maxId) maxId = p.id
    }
    for (const w of weeklySchedules.value)
      for (const r of w.runs) if (r.id > maxId) maxId = r.id
    for (const m of scheduleMembers.value)
      for (const c of (m.characters || [])) if (c.id > maxId) maxId = c.id
    _nextId = maxId + 1
  }

  return {
    scheduleMembers, scheduleBosses, weeklySchedules,
    currentUser, loginError, loginLoading,
    scheduleWeekIdx, currentWeekSchedule,
    addScheduleMember, removeScheduleMember, setMemberAdmin,
    addCharacter, removeCharacter,
    addScheduleBoss, removeScheduleBoss, addParty, removeParty,
    getState, setState,
    nextId,
  }
}
```

- [ ] **Step 2: 在 index.html 引入 schedule.js**

在 `index.html` 的 `</body>` 前（其他 `<script>` 旁）加一行：

```html
<script src="schedule.js"></script>
```

- [ ] **Step 3: 在 app.js 掛載 schedule**

`app.js` 的 setup() 開頭加：

```js
const schedule = Vue.reactive(useSchedule())
```

在 `return { ... }` 裡加 `schedule,`。

- [ ] **Step 4: 驗證**

開瀏覽器，打開主頁，在 console 確認：
```js
// 應看到空陣列，不報錯
document.querySelector('#app').__vue_app__.config.globalProperties
// 或在 Vue devtools 確認 schedule composable 掛上
```

- [ ] **Step 5: Commit**

```bash
git add schedule.js index.html app.js
git commit -m "feat: add schedule.js composable scaffold with CRUD and state"
```

---

## Task 2: Identity 系統（名字 + PIN）

**Files:**
- Modify: `schedule.js`

- [ ] **Step 1: 在 schedule.js 加入 hashPin 與 login/logout**

在 `useSchedule()` 內，`getState()` 之前加入：

```js
  const SCHEDULE_IDENTITY_KEY = 'maple_schedule_identity'

  async function hashPin(pin) {
    const enc = new TextEncoder()
    const buf = await crypto.subtle.digest('SHA-256', enc.encode(String(pin)))
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('')
  }

  async function login(name, pin) {
    loginError.value = ''
    loginLoading.value = true
    try {
      const h = await hashPin(pin)
      const member = scheduleMembers.value.find(m => m.name === name)
      if (!member) { loginError.value = '找不到此成員，請聯絡管理員'; return false }
      if (!member.pinHash) {
        // 第一次登入：直接設定 PIN
        member.pinHash = h
        currentUser.value = { name }
        localStorage.setItem(SCHEDULE_IDENTITY_KEY, JSON.stringify({ name, pinHash: h }))
        return true
      }
      if (member.pinHash !== h) { loginError.value = 'PIN 錯誤'; return false }
      currentUser.value = { name }
      localStorage.setItem(SCHEDULE_IDENTITY_KEY, JSON.stringify({ name, pinHash: h }))
      return true
    } finally {
      loginLoading.value = false
    }
  }

  function logout() {
    currentUser.value = null
    localStorage.removeItem(SCHEDULE_IDENTITY_KEY)
  }

  function loadIdentity() {
    try {
      const raw = localStorage.getItem(SCHEDULE_IDENTITY_KEY)
      if (!raw) return
      const saved = JSON.parse(raw)
      const member = scheduleMembers.value.find(m => m.name === saved.name)
      if (member && member.pinHash === saved.pinHash) {
        currentUser.value = { name: saved.name }
      }
    } catch {}
  }

  const currentMember = computed(() =>
    currentUser.value
      ? scheduleMembers.value.find(m => m.name === currentUser.value.name) ?? null
      : null
  )
  const isAdmin    = computed(() => currentMember.value?.isAdmin ?? false)
  const isLoggedIn = computed(() => currentUser.value !== null)
```

在 `return { ... }` 加入：
```js
    login, logout, loadIdentity,
    currentMember, isAdmin, isLoggedIn,
```

- [ ] **Step 2: app.js 在 onMounted 後半段呼叫 loadIdentity**

找到 `_bootstrapping = false` 那行的附近，加在 schedule.setState 之後（Task 5 會正式整合 setState，先佔位）：

```js
// onMounted 末尾，await pullAll() 之後：
schedule.loadIdentity()
```

- [ ] **Step 3: 驗證**

開瀏覽器 console：
```js
// 手動測試 hashPin（確認 WebCrypto 可用）
// 先在 schedule 裡確認有 login 方法
```

- [ ] **Step 4: Commit**

```bash
git add schedule.js app.js
git commit -m "feat: add name+PIN identity system to schedule"
```

---

## Task 3: 週工具函式與 Roll Forward

**Files:**
- Modify: `schedule.js`

- [ ] **Step 1: 加入 week utility 函式**

在 `useSchedule()` 內 `getState()` 之前加：

```js
  // ── 週工具 ──
  function getWeekStart(date = new Date()) {
    const d = new Date(date)
    const day = d.getDay()                   // 0=日,1=一...6=六
    const diff = day === 0 ? -6 : 1 - day   // 往回到週一
    d.setDate(d.getDate() + diff)
    return d.toISOString().slice(0, 10)      // YYYY-MM-DD
  }

  function addDays(isoDate, days) {
    const d = new Date(isoDate)
    d.setDate(d.getDate() + days)
    return d.toISOString().slice(0, 10)
  }

  // 本週週一
  const todayWeekStart = computed(() => getWeekStart())

  // 某週的 dayOfWeek（0=週日）轉為實際日期字串
  function slotToDate(weekStart, dayOfWeek) {
    // weekStart 是週一（dayOfWeek=1），需換算
    // dayOfWeek 0=日 → 在該週是 weekStart+6
    const offset = dayOfWeek === 0 ? 6 : dayOfWeek - 1
    return addDays(weekStart, offset)
  }

  // 計算某週某王本週剩餘場次（completed < runsPerWeek）
  function runsLeft(weekStart, bossId, partyId) {
    const week = weeklySchedules.value.find(w => w.weekStart === weekStart)
    if (!week) return 0
    const done = week.runs.filter(r =>
      r.bossId === bossId && r.partyId === partyId &&
      (r.status === 'confirmed' || r.status === 'done')
    ).length
    const boss  = scheduleBosses.value.find(b => b.id === bossId)
    const party = boss?.parties.find(p => p.id === partyId)
    return Math.max(0, (party?.runsPerWeek ?? 0) - done)
  }
```

- [ ] **Step 2: 加入 rollForwardWeeks**

```js
  function rollForwardWeeks() {
    const today = getWeekStart()
    // 移除過期的週（weekStart < 本週一）
    weeklySchedules.value = weeklySchedules.value.filter(w => w.weekStart >= today)
    // 補足至 3 週
    while (weeklySchedules.value.length < 3) {
      const prev = weeklySchedules.value[weeklySchedules.value.length - 1]
      const weekStart = prev ? addDays(prev.weekStart, 7) : today
      weeklySchedules.value.push({
        weekStart,
        runs: [],
        memberWeeklyUnavailable: {},
      })
    }
  }
```

在 `return { ... }` 加入：
```js
    getWeekStart, addDays, slotToDate, todayWeekStart, runsLeft, rollForwardWeeks,
```

- [ ] **Step 3: app.js 在 onMounted 呼叫 rollForwardWeeks**

在 `schedule.loadIdentity()` 之後加：

```js
schedule.rollForwardWeeks()
```

- [ ] **Step 4: 驗證**

重新載入頁面，在 console：
```js
// weeklySchedules 應有 3 筆，weekStart 為本週一、下週一、下下週一
```

- [ ] **Step 5: Commit**

```bash
git add schedule.js app.js
git commit -m "feat: add week utilities and roll-forward logic to schedule"
```

---

## Task 4: 不可用時段管理

**Files:**
- Modify: `schedule.js`

- [ ] **Step 1: 加入不可用時段的增刪函式**

在 `useSchedule()` 內加：

```js
  // ── 固定不可用（recurring）──
  function toggleRecurring(memberName, dayOfWeek, hour) {
    const m = scheduleMembers.value.find(m => m.name === memberName)
    if (!m) return
    const idx = m.recurringUnavailable.findIndex(s =>
      s.dayOfWeek === dayOfWeek && s.startHour <= hour && s.endHour > hour
    )
    if (idx >= 0) {
      // 移除這個小時格（可能需要切割現有區間）
      const old = m.recurringUnavailable.splice(idx, 1)[0]
      if (old.startHour < hour)
        m.recurringUnavailable.push({ dayOfWeek, startHour: old.startHour, endHour: hour })
      if (old.endHour > hour + 1)
        m.recurringUnavailable.push({ dayOfWeek, startHour: hour + 1, endHour: old.endHour })
    } else {
      m.recurringUnavailable.push({ dayOfWeek, startHour: hour, endHour: hour + 1 })
    }
  }

  // 判斷某個 hour 是否在固定不可用內
  function isRecurringUnavail(memberName, dayOfWeek, hour) {
    const m = scheduleMembers.value.find(m => m.name === memberName)
    if (!m) return false
    return m.recurringUnavailable.some(s =>
      s.dayOfWeek === dayOfWeek && s.startHour <= hour && s.endHour > hour
    )
  }

  // ── 本週臨時不可用 ──
  function toggleWeeklyUnavail(weekStart, memberName, dayOfWeek, hour) {
    const week = weeklySchedules.value.find(w => w.weekStart === weekStart)
    if (!week) return
    if (!week.memberWeeklyUnavailable[memberName])
      week.memberWeeklyUnavailable[memberName] = []
    const slots = week.memberWeeklyUnavailable[memberName]
    const idx = slots.findIndex(s =>
      s.dayOfWeek === dayOfWeek && s.startHour <= hour && s.endHour > hour
    )
    if (idx >= 0) {
      const old = slots.splice(idx, 1)[0]
      if (old.startHour < hour)
        slots.push({ dayOfWeek, startHour: old.startHour, endHour: hour })
      if (old.endHour > hour + 1)
        slots.push({ dayOfWeek, startHour: hour + 1, endHour: old.endHour })
    } else {
      slots.push({ dayOfWeek, startHour: hour, endHour: hour + 1 })
    }
  }

  function isWeeklyUnavail(weekStart, memberName, dayOfWeek, hour) {
    const week = weeklySchedules.value.find(w => w.weekStart === weekStart)
    const slots = week?.memberWeeklyUnavailable?.[memberName] ?? []
    return slots.some(s => s.dayOfWeek === dayOfWeek && s.startHour <= hour && s.endHour > hour)
  }

  // 格子狀態：'recurring' | 'weekly' | 'avail'
  function cellStatus(weekStart, memberName, dayOfWeek, hour) {
    if (isRecurringUnavail(memberName, dayOfWeek, hour)) return 'recurring'
    if (isWeeklyUnavail(weekStart, memberName, dayOfWeek, hour)) return 'weekly'
    return 'avail'
  }
```

在 `return { ... }` 加入：
```js
    toggleRecurring, isRecurringUnavail,
    toggleWeeklyUnavail, isWeeklyUnavail, cellStatus,
```

- [ ] **Step 2: Commit**

```bash
git add schedule.js
git commit -m "feat: add unavailability toggle functions to schedule"
```

---

## Task 5: 自動排程演算法

**Files:**
- Modify: `schedule.js`

- [ ] **Step 1: 加入 buildUnavailSet 與評分函式**

```js
  function buildUnavailSet(memberName, weekStart) {
    const unavail = new Set()
    const m = scheduleMembers.value.find(m => m.name === memberName)
    if (!m) return unavail
    for (const s of (m.recurringUnavailable || []))
      for (let h = s.startHour; h < s.endHour; h++)
        unavail.add(`${s.dayOfWeek}-${h}`)
    const week = weeklySchedules.value.find(w => w.weekStart === weekStart)
    for (const s of (week?.memberWeeklyUnavailable?.[memberName] ?? []))
      for (let h = s.startHour; h < s.endHour; h++)
        unavail.add(`${s.dayOfWeek}-${h}`)
    return unavail
  }

  function scoreSlot(dayOfWeek, hour) {
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
    if (!isWeekend && hour >= 18 && hour <= 22) return 3
    if (isWeekend) return 2
    return 1
  }
```

- [ ] **Step 2: 加入 autoScheduleWeek**

```js
  function autoScheduleWeek(weekStart) {
    const week = weeklySchedules.value.find(w => w.weekStart === weekStart)
    if (!week) return

    // 保留 manual / confirmed / done
    const locked = week.runs.filter(r =>
      ['manual', 'confirmed', 'done'].includes(r.status)
    )
    const newRuns = [...locked]

    // 已佔用時段（跨所有人）
    const occupiedSlots = new Set(locked.map(r => `${r.dayOfWeek}-${r.hour}`))
    // 每人已佔用時段（避免一人同時兩場）
    const memberOccupied = {}
    for (const run of locked)
      for (const name of run.members) {
        if (!memberOccupied[name]) memberOccupied[name] = new Set()
        memberOccupied[name].add(`${run.dayOfWeek}-${run.hour}`)
      }

    for (const boss of scheduleBosses.value) {
      for (const party of boss.parties) {
        const lockedCount = locked.filter(r =>
          r.bossId === boss.id && r.partyId === party.id
        ).length
        const needed = party.runsPerWeek - lockedCount
        if (needed <= 0) continue

        // 建立每個成員的不可用集合（含已佔用場次）
        const memberUnavail = {}
        for (const name of party.members) {
          memberUnavail[name] = buildUnavailSet(name, weekStart)
          if (memberOccupied[name])
            for (const s of memberOccupied[name]) memberUnavail[name].add(s)
        }

        // 候選時段
        const candidates = []
        for (let day = 0; day <= 6; day++) {
          for (let hour = 0; hour <= 23; hour++) {
            const key = `${day}-${hour}`
            if (occupiedSlots.has(key)) continue
            const allAvail = party.members.every(n => !memberUnavail[n]?.has(key))
            if (allAvail) candidates.push({ day, hour, score: scoreSlot(day, hour) })
          }
        }
        candidates.sort((a, b) => b.score - a.score)

        let scheduled = 0
        for (const slot of candidates) {
          if (scheduled >= needed) break
          const key = `${slot.day}-${slot.hour}`
          const run = {
            id: nextId(),
            bossId: boss.id,
            partyId: party.id,
            dayOfWeek: slot.day,
            hour: slot.hour,
            members: [...party.members],
            status: 'auto',
            lootSessionId: null,
          }
          newRuns.push(run)
          occupiedSlots.add(key)
          for (const name of party.members) {
            if (!memberOccupied[name]) memberOccupied[name] = new Set()
            memberOccupied[name].add(key)
            memberUnavail[name].add(key)
          }
          scheduled++
        }

        for (let i = scheduled; i < needed; i++) {
          newRuns.push({
            id: nextId(), bossId: boss.id, partyId: party.id,
            dayOfWeek: null, hour: null,
            members: [...party.members], status: 'unschedulable', lootSessionId: null,
          })
        }
      }
    }

    week.runs = newRuns
  }

  function autoScheduleAll() {
    for (const week of weeklySchedules.value) {
      autoScheduleWeek(week.weekStart)
    }
  }
```

- [ ] **Step 3: 加入 run 操作函式（管理員用）**

```js
  function updateRunTime(weekStart, runId, dayOfWeek, hour) {
    const week = weeklySchedules.value.find(w => w.weekStart === weekStart)
    if (!week) return
    const run = week.runs.find(r => r.id === runId)
    if (!run) return
    run.dayOfWeek = dayOfWeek
    run.hour      = hour
    run.status    = 'manual'
  }

  function confirmRun(weekStart, runId) {
    const week = weeklySchedules.value.find(w => w.weekStart === weekStart)
    if (!week) return
    const run = week.runs.find(r => r.id === runId)
    if (run && run.status !== 'done') run.status = 'confirmed'
  }

  function markRunDone(weekStart, runId, lootSessionId) {
    const week = weeklySchedules.value.find(w => w.weekStart === weekStart)
    if (!week) return
    const run = week.runs.find(r => r.id === runId)
    if (!run) return
    run.status = 'done'
    run.lootSessionId = lootSessionId
  }
```

在 `return { ... }` 加入：
```js
    buildUnavailSet, autoScheduleWeek, autoScheduleAll,
    updateRunTime, confirmRun, markRunDone,
```

- [ ] **Step 4: Commit**

```bash
git add schedule.js
git commit -m "feat: add auto-scheduler algorithm to schedule"
```

---

## Task 6: sync 整合（app.js）

**Files:**
- Modify: `app.js`

- [ ] **Step 1: currentSyncData 納入 schedule**

找到 `function currentSyncData()` 那段（約 701 行），改為：

```js
    function currentSyncData() {
      return {
        characters: savedCharacters.value,
        loot: loot.getState(),
        alchemy: alchemy.getState(),
        equip: equip.getState(),
        heart: heartFactory.getState(),
        schedule: schedule.getState(),
      }
    }
```

- [ ] **Step 2: applyCloudData 還原 schedule**

找到 `function applyCloudData(data)` 那段，加上：

```js
      if (data.schedule) schedule.setState(data.schedule)
```

（加在 `if (data.heart)` 那段之後）

- [ ] **Step 3: normalizeSyncData 加 schedule**

找到 `function normalizeSyncData(data)`，改為：

```js
    function normalizeSyncData(data) {
      return {
        characters: data?.characters || [],
        loot:       data?.loot      || loot.getState(),
        alchemy:    data?.alchemy   || alchemy.getState(),
        equip:      data?.equip     || equip.getState(),
        heart:      data?.heart     || heartFactory.getState(),
        schedule:   data?.schedule  || schedule.getState(),
      }
    }
```

- [ ] **Step 4: onMounted 補 rollForwardWeeks 與 loadIdentity**

找到 `if (sync.syncCode.value) await pullAll()` 那行，在 `_bootstrapping = false` 之前：

```js
      schedule.rollForwardWeeks()
      schedule.loadIdentity()
```

- [ ] **Step 5: 加 watch 讓 schedule 異動觸發 push**

在 `Vue.watch(() => JSON.stringify(alchemy.getState()), saveAlchemySettings)` 附近加：

```js
    Vue.watch(() => JSON.stringify(schedule.getState()), () => pushAll())
```

- [ ] **Step 6: 驗證**

設定 sync code，修改一筆 scheduleMembers，確認 Firebase console 裡 doc 有 `schedule` 欄位。

- [ ] **Step 7: Commit**

```bash
git add app.js
git commit -m "feat: integrate schedule state into Firebase sync"
```

---

## Task 7: loot.js — createSessionFromRun

**Files:**
- Modify: `loot.js`

- [ ] **Step 1: 新增 createSessionFromRun 函式**

在 `loot.js` 的 `clearSession()` 函式之後、`return { ... }` 之前加：

```js
  function createSessionFromRun({ bossName, members, date }) {
    const sessionName = `${bossName} ${date}`
    // 從 bossDropTables 找對應掉落
    const boss  = bossDropTables.value.find(b => b.bossName === bossName)
    const drops = (boss?.drops ?? []).map(d => ({
      id:         nextId(),
      itemName:   d.itemName,
      qty:        1,
      pickedBy:   '',
      status:     'pending',
      price:      0,
      fee:        auctionFee.value,
      scissorType: d.needsScissors ? d.scissorType : 0,
    }))
    const s = {
      id:              nextId(),
      name:            sessionName,
      date,
      members: members.map(name => {
        const preset = memberPresets.value.find(p => p.name === name)
        return { name, share: preset?.defaultShare ?? 1 }
      }),
      soldItems:       drops,
      memberItems:     [],
      snowflakesUsed:  0,
    }
    sessions.value.push(s)
    currentSessionId.value = s.id
    return s.id
  }
```

- [ ] **Step 2: 加入 return**

在 `return { ... }` 裡加 `createSessionFromRun,`。

- [ ] **Step 3: Commit**

```bash
git add loot.js
git commit -m "feat: add createSessionFromRun to loot for schedule integration"
```

---

## Task 8: index.html — Tab 導航重構

**Files:**
- Modify: `index.html`

- [ ] **Step 1: 找到現有 Tab 導航 HTML**

搜尋 `activeTab` 在 index.html 的位置，找到 Tab 按鈕區（約在頁頂）。

- [ ] **Step 2: 在 Tab 列最前方加入「排程」Tab**

現有 Tab 列（格式參考現有按鈕），在最前方插入：

```html
<button
  class="tab-btn"
  :class="{ active: activeTab === 'schedule' }"
  @click="activeTab = 'schedule'"
>📅 排程</button>
```

- [ ] **Step 3: 在 index.html 加入排程 section 容器**

在現有各 section 旁邊（和其他 Tab 的 v-show 保持一致格式）加入：

```html
<section v-show="activeTab === 'schedule'" class="schedule-section">
  <!-- Task 9、10、11 的 HTML 填入此處 -->
</section>
```

- [ ] **Step 4: app.js return 確認 schedule 已導出**

確認 `return { ... }` 裡有 `schedule,`（Task 1 Step 3 已加）。

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat: add schedule tab to navigation"
```

---

## Task 9: index.html — 「我的時間」子區塊

**Files:**
- Modify: `index.html`

- [ ] **Step 1: 在排程 section 內加入登入列 + 我的時間區塊**

```html
<!-- ① 登入 -->
<div class="sched-login-bar">
  <template v-if="!schedule.isLoggedIn">
    <select v-model="schedLoginName" class="sched-select">
      <option value="">選擇你的名字</option>
      <option v-for="m in schedule.scheduleMembers" :key="m.name" :value="m.name">
        {{ m.name }}
      </option>
    </select>
    <input
      type="password" v-model="schedLoginPin"
      class="sched-pin-input" placeholder="PIN（首次登入即設定）"
      @keyup.enter="doSchedLogin"
    />
    <button class="btn" @click="doSchedLogin" :disabled="schedule.loginLoading">
      {{ schedule.loginLoading ? '登入中...' : '登入' }}
    </button>
    <span v-if="schedule.loginError" class="sched-error">{{ schedule.loginError }}</span>
  </template>
  <template v-else>
    <span class="sched-user-label">👤 {{ schedule.currentUser.name }}</span>
    <span v-if="schedule.isAdmin" class="sched-admin-badge">管理員</span>
    <button class="btn btn-sm" @click="schedule.logout()">登出</button>
  </template>
</div>

<!-- ② 我的時間（需登入）-->
<div v-if="schedule.isLoggedIn" class="sched-subsection">
  <h3>🕐 我的不可用時段</h3>
  <div class="sched-week-tabs">
    <button
      v-for="(w, i) in schedule.weeklySchedules" :key="w.weekStart"
      class="btn btn-sm" :class="{ active: schedule.scheduleWeekIdx === i }"
      @click="schedule.scheduleWeekIdx = i"
    >{{ i === 0 ? '本週' : i === 1 ? '下週' : '下下週' }}（{{ w.weekStart }}）</button>
  </div>
  <div v-if="schedule.currentWeekSchedule" class="sched-avail-grid-wrap">
    <div class="sched-avail-grid">
      <!-- 標頭 -->
      <div class="sched-grid-corner"></div>
      <div v-for="h in 24" :key="h" class="sched-grid-hour">{{ h - 1 }}</div>
      <!-- 每天一列 -->
      <template v-for="day in [1,2,3,4,5,6,0]" :key="day">
        <div class="sched-grid-day">{{ ['日','一','二','三','四','五','六'][day] }}</div>
        <div
          v-for="h in 24" :key="h"
          class="sched-grid-cell"
          :class="schedule.cellStatus(schedule.currentWeekSchedule.weekStart, schedule.currentUser.name, day, h-1)"
          @click="onCellClick(day, h-1)"
        ></div>
      </template>
    </div>
    <div class="sched-avail-legend">
      <span class="sched-legend-recurring">固定不可用</span>
      <span class="sched-legend-weekly">本週臨時不可用</span>
      <span class="sched-legend-avail">可用</span>
    </div>
    <div class="sched-avail-mode">
      <label>
        <input type="checkbox" v-model="schedRecurringMode" />
        編輯固定不可用（長期每週）
      </label>
    </div>
  </div>
</div>
```

- [ ] **Step 2: app.js 加入 schedLoginName、schedLoginPin、schedRecurringMode 及處理函式**

在 setup() 的 `const schedule = ...` 之後加：

```js
    // ── 排程 UI 狀態 ──
    const schedLoginName    = ref('')
    const schedLoginPin     = ref('')
    const schedRecurringMode = ref(false)

    async function doSchedLogin() {
      if (!schedLoginName.value || !schedLoginPin.value) return
      await schedule.login(schedLoginName.value, schedLoginPin.value)
      if (schedule.isLoggedIn) schedLoginPin.value = ''
    }

    function onCellClick(dayOfWeek, hour) {
      if (!schedule.isLoggedIn || !schedule.currentWeekSchedule) return
      const name = schedule.currentUser.name
      const ws   = schedule.currentWeekSchedule.weekStart
      if (schedRecurringMode.value) {
        schedule.toggleRecurring(name, dayOfWeek, hour)
      } else {
        schedule.toggleWeeklyUnavail(ws, name, dayOfWeek, hour)
      }
    }
```

在 `return { ... }` 加入：
```js
      schedLoginName, schedLoginPin, schedRecurringMode,
      doSchedLogin, onCellClick,
```

- [ ] **Step 3: Commit**

```bash
git add index.html app.js
git commit -m "feat: add availability grid UI for schedule"
```

---

## Task 10: index.html — 「BOSS 設定」子區塊

**Files:**
- Modify: `index.html`

- [ ] **Step 1: 在排程 section 內加入 BOSS 設定區塊**

（接在「我的時間」之後）

```html
<!-- ③ BOSS 設定（管理員才能編輯）-->
<div class="sched-subsection">
  <h3>⚔️ BOSS 設定</h3>
  <div v-for="boss in schedule.scheduleBosses" :key="boss.id" class="sched-boss-card">
    <div class="sched-boss-header">
      <template v-if="schedule.isAdmin">
        <input v-model="boss.name" class="sched-input-name" placeholder="BOSS 名稱" />
        <label>最低等級
          <input type="number" v-model.number="boss.minLevel" class="sched-input-num" min="0" />
        </label>
        <button class="btn btn-delete btn-sm" @click="schedule.removeScheduleBoss(boss.id)">✕</button>
      </template>
      <template v-else>
        <span class="sched-boss-name">{{ boss.name }}</span>
        <span class="sched-boss-level">Lv {{ boss.minLevel }}+</span>
      </template>
    </div>
    <!-- 分團 -->
    <div v-for="party in boss.parties" :key="party.id" class="sched-party-row">
      <template v-if="schedule.isAdmin">
        <input v-model="party.label" class="sched-input-label" placeholder="團標籤" />
        <div class="sched-party-members">
          <span v-for="name in party.members" :key="name" class="sched-member-chip">
            {{ name }}
            <span class="sched-chip-remove" @click="party.members = party.members.filter(n=>n!==name)">×</span>
          </span>
          <select
            @change="e => { if(e.target.value && !party.members.includes(e.target.value)) party.members.push(e.target.value); e.target.value='' }"
            class="sched-select-sm"
          >
            <option value="">＋ 加入成員</option>
            <option v-for="m in schedule.scheduleMembers" :key="m.name" :value="m.name">{{ m.name }}</option>
          </select>
        </div>
        <label>每週
          <input type="number" v-model.number="party.runsPerWeek" class="sched-input-num" min="1" max="20" />
          場
        </label>
        <button class="btn btn-delete btn-sm" @click="schedule.removeParty(boss.id, party.id)">✕</button>
      </template>
      <template v-else>
        <span class="sched-party-label">{{ party.label }}</span>
        <span class="sched-party-member-list">{{ party.members.join('、') }}</span>
        <span class="sched-party-runs">{{ party.runsPerWeek }}場/週</span>
      </template>
    </div>
    <button v-if="schedule.isAdmin" class="btn btn-sm" @click="schedule.addParty(boss.id)">＋ 新增分團</button>
  </div>
  <button v-if="schedule.isAdmin" class="btn" @click="schedule.addScheduleBoss()">＋ 新增 BOSS</button>
</div>

<!-- 管理員：成員管理 -->
<div v-if="schedule.isAdmin" class="sched-subsection">
  <h3>👥 排程成員管理</h3>
  <div v-for="m in schedule.scheduleMembers" :key="m.name" class="sched-member-mgmt-row">
    <span class="sched-member-name">{{ m.name }}</span>
    <span v-if="m.isAdmin" class="sched-admin-badge">管理員</span>
    <span v-else class="sched-member-chars">
      角色：{{ m.characters.map(c => c.name + ' Lv' + c.level).join('、') || '（無）' }}
    </span>
    <button v-if="!m.isAdmin" class="btn btn-sm" @click="schedule.setMemberAdmin(m.name, true)">設為管理員</button>
    <button class="btn btn-delete btn-sm" @click="schedule.removeScheduleMember(m.name)">✕</button>
  </div>
  <div class="sched-add-member-row">
    <select v-model="schedNewMemberName" class="sched-select">
      <option value="">從常用隊員加入</option>
      <option v-for="p in loot.memberPresets" :key="p.name" :value="p.name">{{ p.name }}</option>
    </select>
    <button class="btn btn-sm" @click="onAddScheduleMember">＋ 加入</button>
  </div>
</div>
```

- [ ] **Step 2: app.js 加入成員管理 UI 狀態**

```js
    const schedNewMemberName = ref('')
    function onAddScheduleMember() {
      if (!schedNewMemberName.value) return
      schedule.addScheduleMember(schedNewMemberName.value)
      schedNewMemberName.value = ''
    }
```

在 `return { ... }` 加：
```js
      schedNewMemberName, onAddScheduleMember,
```

- [ ] **Step 3: Commit**

```bash
git add index.html app.js
git commit -m "feat: add BOSS config and member management UI for schedule"
```

---

## Task 11: index.html — 「本週排程」子區塊

**Files:**
- Modify: `index.html`

- [ ] **Step 1: 在排程 section 末尾加入本週排程區塊**

```html
<!-- ④ 本週排程 -->
<div class="sched-subsection">
  <h3>📋 本週排程</h3>
  <div class="sched-week-tabs">
    <button
      v-for="(w, i) in schedule.weeklySchedules" :key="w.weekStart"
      class="btn btn-sm" :class="{ active: schedule.scheduleWeekIdx === i }"
      @click="schedule.scheduleWeekIdx = i"
    >{{ i === 0 ? '本週' : i === 1 ? '下週' : '下下週' }}（{{ w.weekStart }}）</button>
    <button v-if="schedule.isAdmin" class="btn btn-sm sched-auto-btn"
      @click="schedule.autoScheduleWeek(schedule.currentWeekSchedule.weekStart)">
      🔄 自動排程
    </button>
  </div>

  <div v-if="schedule.currentWeekSchedule">
    <!-- 無法排入警告 -->
    <div v-if="schedule.currentWeekSchedule.runs.some(r => r.status === 'unschedulable')"
         class="sched-warn-banner">
      ⚠️ 部分場次無法自動排入，請手動處理
    </div>

    <!-- 排程列表 -->
    <div v-for="boss in schedule.scheduleBosses" :key="boss.id" class="sched-boss-block">
      <div v-for="party in boss.parties" :key="party.id" class="sched-party-block">
        <div class="sched-party-block-header">
          <span class="sched-boss-chip">{{ boss.name }}</span>
          <span class="sched-party-chip">{{ party.label }}</span>
          <span class="sched-runs-left">
            本週剩 {{ schedule.runsLeft(schedule.currentWeekSchedule.weekStart, boss.id, party.id) }} 場
          </span>
        </div>
        <div
          v-for="run in schedule.currentWeekSchedule.runs.filter(r => r.bossId===boss.id && r.partyId===party.id)"
          :key="run.id"
          class="sched-run-row"
          :class="run.status"
        >
          <template v-if="run.status === 'unschedulable'">
            <span class="sched-run-time sched-unschedulable">⚠️ 無法排入</span>
          </template>
          <template v-else>
            <span class="sched-run-time">
              {{ ['日','一','二','三','四','五','六'][run.dayOfWeek] }} {{ String(run.hour).padStart(2,'0') }}:00
            </span>
          </template>
          <span class="sched-run-members">{{ run.members.join('、') }}</span>
          <span class="sched-run-status-badge" :class="'badge-' + run.status">
            {{ { auto:'自動', manual:'手動', confirmed:'已確認', done:'完成', unschedulable:'無法排入' }[run.status] }}
          </span>
          <!-- 管理員操作 -->
          <template v-if="schedule.isAdmin && run.status !== 'done'">
            <button class="btn btn-sm" @click="openEditRun(run)">✏️</button>
            <button v-if="run.status !== 'confirmed' && run.status !== 'unschedulable'"
              class="btn btn-sm" @click="schedule.confirmRun(schedule.currentWeekSchedule.weekStart, run.id)">
              ✅ 確認
            </button>
            <button v-if="run.status === 'confirmed'"
              class="btn btn-sm sched-done-btn"
              @click="onMarkDone(run)">
              ✔ 完成→分錢
            </button>
          </template>
          <a v-if="run.status === 'done' && run.lootSessionId" class="btn btn-sm"
            @click="goToLootSession(run.lootSessionId)">
            💰 查看分錢
          </a>
        </div>
      </div>
    </div>
  </div>
</div>

<!-- 編輯場次 Dialog -->
<div v-if="editRunDialog.show" class="sched-dialog-overlay" @click.self="editRunDialog.show=false">
  <div class="sched-dialog">
    <h4>調整場次時間</h4>
    <label>星期
      <select v-model.number="editRunDialog.dayOfWeek" class="sched-select">
        <option v-for="(d,i) in ['日','一','二','三','四','五','六']" :key="i" :value="i">週{{ d }}</option>
      </select>
    </label>
    <label>時間
      <select v-model.number="editRunDialog.hour" class="sched-select">
        <option v-for="h in 24" :key="h" :value="h-1">{{ String(h-1).padStart(2,'0') }}:00</option>
      </select>
    </label>
    <div class="sched-dialog-actions">
      <button class="btn" @click="saveEditRun">儲存</button>
      <button class="btn" @click="editRunDialog.show=false">取消</button>
    </div>
  </div>
</div>
```

- [ ] **Step 2: app.js 加入排程操作函式**

```js
    // ── 排程操作 ──
    const editRunDialog = ref({ show: false, weekStart: '', runId: null, dayOfWeek: 1, hour: 20 })

    function openEditRun(run) {
      editRunDialog.value = {
        show: true,
        weekStart: schedule.currentWeekSchedule.weekStart,
        runId: run.id,
        dayOfWeek: run.dayOfWeek ?? 1,
        hour: run.hour ?? 20,
      }
    }

    function saveEditRun() {
      schedule.updateRunTime(
        editRunDialog.value.weekStart,
        editRunDialog.value.runId,
        editRunDialog.value.dayOfWeek,
        editRunDialog.value.hour
      )
      editRunDialog.value.show = false
    }

    function onMarkDone(run) {
      const week = schedule.currentWeekSchedule
      if (!week) return
      const boss = schedule.scheduleBosses.find(b => b.id === run.bossId)
      const date = schedule.slotToDate(week.weekStart, run.dayOfWeek)
      const sessionId = loot.createSessionFromRun({
        bossName: boss?.name ?? '未知王',
        members:  run.members,
        date,
      })
      schedule.markRunDone(week.weekStart, run.id, sessionId)
      activeTab.value = 'loot'
    }

    function goToLootSession(sessionId) {
      loot.switchSession(sessionId)
      activeTab.value = 'loot'
    }
```

在 `return { ... }` 加：
```js
      editRunDialog, openEditRun, saveEditRun, onMarkDone, goToLootSession,
```

- [ ] **Step 3: Commit**

```bash
git add index.html app.js
git commit -m "feat: add weekly schedule view with run management and loot link"
```

---

## Task 12: style.css — 排程樣式

**Files:**
- Modify: `style.css`

- [ ] **Step 1: 在 style.css 末尾加入排程相關樣式**

```css
/* ══════════════════════════════════
   排程系統
══════════════════════════════════ */

/* 登入列 */
.sched-login-bar {
  display: flex; align-items: center; gap: 8px;
  padding: 10px; background: var(--bg2); border-radius: 8px; margin-bottom: 12px;
  flex-wrap: wrap;
}
.sched-pin-input { width: 100px; }
.sched-user-label { font-weight: 600; color: var(--text); }
.sched-admin-badge {
  background: #7c5cfc; color: #fff;
  font-size: 11px; padding: 2px 7px; border-radius: 99px;
}
.sched-error { color: var(--danger); font-size: 13px; }

/* 子區塊 */
.sched-subsection {
  background: var(--bg2); border-radius: 10px;
  padding: 14px; margin-bottom: 14px;
}
.sched-subsection h3 { margin: 0 0 10px; font-size: 15px; }

/* 週 Tab */
.sched-week-tabs { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 10px; }
.sched-week-tabs .btn.active { background: var(--accent); color: #000; }
.sched-auto-btn { margin-left: auto; }

/* ── 可用格子表格 ── */
.sched-avail-grid-wrap { overflow-x: auto; }
.sched-avail-grid {
  display: grid;
  grid-template-columns: 28px repeat(24, 26px);
  gap: 2px;
  min-width: max-content;
}
.sched-grid-corner { }
.sched-grid-hour {
  font-size: 10px; color: var(--text-dim);
  text-align: center; line-height: 20px;
}
.sched-grid-day {
  font-size: 11px; color: var(--text-dim);
  display: flex; align-items: center; justify-content: center;
}
.sched-grid-cell {
  width: 26px; height: 22px;
  border-radius: 3px; cursor: pointer;
  background: var(--bg3);
  border: 1px solid var(--border);
  transition: background 0.1s;
}
.sched-grid-cell.recurring { background: #b91c1c; border-color: #ef4444; }
.sched-grid-cell.weekly    { background: #c2410c; border-color: #fb923c; }
.sched-grid-cell.avail:hover { background: var(--accent-dim); }

/* 圖例 */
.sched-avail-legend {
  display: flex; gap: 12px; margin-top: 8px; font-size: 12px; flex-wrap: wrap;
}
.sched-legend-recurring::before { content: ''; display: inline-block; width: 12px; height: 12px; background: #b91c1c; border-radius: 2px; margin-right: 4px; vertical-align: middle; }
.sched-legend-weekly::before    { content: ''; display: inline-block; width: 12px; height: 12px; background: #c2410c; border-radius: 2px; margin-right: 4px; vertical-align: middle; }
.sched-legend-avail::before     { content: ''; display: inline-block; width: 12px; height: 12px; background: var(--bg3); border: 1px solid var(--border); border-radius: 2px; margin-right: 4px; vertical-align: middle; }
.sched-avail-mode { margin-top: 8px; font-size: 13px; }

/* ── BOSS 設定 ── */
.sched-boss-card {
  border: 1px solid var(--border); border-radius: 8px;
  padding: 10px; margin-bottom: 10px;
}
.sched-boss-header {
  display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 8px;
}
.sched-boss-name { font-weight: 700; font-size: 15px; }
.sched-boss-level { font-size: 12px; color: var(--text-dim); }
.sched-party-row {
  display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
  padding: 6px 0; border-top: 1px solid var(--border);
}
.sched-party-members { display: flex; flex-wrap: wrap; gap: 4px; }
.sched-member-chip {
  background: var(--bg3); border: 1px solid var(--border);
  border-radius: 99px; padding: 2px 8px; font-size: 12px;
  display: flex; align-items: center; gap: 4px;
}
.sched-chip-remove { cursor: pointer; color: var(--danger); font-weight: 700; }
.sched-input-name  { width: 100px; }
.sched-input-label { width: 60px; }
.sched-input-num   { width: 55px; }
.sched-party-label { font-weight: 600; min-width: 40px; }
.sched-party-member-list { color: var(--text-dim); font-size: 13px; }
.sched-party-runs  { font-size: 13px; }

/* ── 成員管理 ── */
.sched-member-mgmt-row {
  display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
  padding: 6px 0; border-bottom: 1px solid var(--border);
}
.sched-member-name { font-weight: 600; min-width: 60px; }
.sched-member-chars { font-size: 12px; color: var(--text-dim); }
.sched-add-member-row { display: flex; gap: 8px; margin-top: 10px; flex-wrap: wrap; }

/* ── 排程列表 ── */
.sched-boss-block  { margin-bottom: 12px; }
.sched-party-block { margin-bottom: 8px; }
.sched-party-block-header {
  display: flex; align-items: center; gap: 8px; margin-bottom: 4px;
}
.sched-boss-chip {
  background: #3b2f7a; color: #c4b5fd;
  font-size: 12px; padding: 2px 8px; border-radius: 99px; font-weight: 600;
}
.sched-party-chip {
  background: var(--bg3); font-size: 12px; padding: 2px 8px; border-radius: 99px;
}
.sched-runs-left { font-size: 12px; color: var(--text-dim); margin-left: auto; }

.sched-run-row {
  display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
  padding: 6px 8px; border-radius: 6px; margin-bottom: 4px;
  background: var(--bg3); border: 1px solid var(--border);
}
.sched-run-row.confirmed { border-color: #22c55e; }
.sched-run-row.done      { border-color: #6b7280; opacity: 0.7; }
.sched-run-row.unschedulable { border-color: #f97316; }

.sched-run-time   { font-weight: 700; min-width: 70px; font-size: 14px; }
.sched-run-members { font-size: 13px; color: var(--text-dim); flex: 1; }
.sched-unschedulable { color: #f97316; }

.sched-run-status-badge {
  font-size: 11px; padding: 2px 6px; border-radius: 99px;
}
.badge-auto         { background: var(--bg2); color: var(--text-dim); }
.badge-manual       { background: #1e3a5f; color: #93c5fd; }
.badge-confirmed    { background: #14532d; color: #86efac; }
.badge-done         { background: #1f2937; color: #9ca3af; }
.badge-unschedulable { background: #431407; color: #fdba74; }

.sched-done-btn { background: #14532d !important; }
.sched-warn-banner {
  background: #431407; color: #fdba74;
  padding: 8px 12px; border-radius: 6px; margin-bottom: 10px; font-size: 13px;
}

/* ── Dialog ── */
.sched-dialog-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.6);
  display: flex; align-items: center; justify-content: center; z-index: 1000;
}
.sched-dialog {
  background: var(--bg2); border: 1px solid var(--border);
  border-radius: 12px; padding: 20px; min-width: 260px;
  display: flex; flex-direction: column; gap: 12px;
}
.sched-dialog h4 { margin: 0; }
.sched-dialog label { display: flex; flex-direction: column; gap: 4px; font-size: 14px; }
.sched-dialog-actions { display: flex; gap: 8px; justify-content: flex-end; }

/* Shared selects */
.sched-select    { padding: 5px 8px; border-radius: 6px; border: 1px solid var(--border); background: var(--bg3); color: var(--text); }
.sched-select-sm { padding: 3px 6px; border-radius: 4px; border: 1px solid var(--border); background: var(--bg3); color: var(--text); font-size: 13px; }
```

- [ ] **Step 2: 驗證**

開瀏覽器，切換到排程 Tab，確認：
- 登入列顯示正常
- 可用格子表格格式正確（7行×24列）
- BOSS 設定區塊可新增/刪除
- 排程列表顯示正確狀態色

- [ ] **Step 3: Commit**

```bash
git add style.css
git commit -m "feat: add schedule UI styles"
```

---

## Task 13: 端到端驗證與收尾

**Files:**
- Modify: 視需要

- [ ] **Step 1: 完整流程測試**

1. 管理員登入，新增一個 BOSS（例：「黑魔法師」）
2. 新增一個分團「A團」，成員 2 人，每週 1 場
3. 以另一個身份登入，填入不可用時段（例：週一至週五 9-18 點）
4. 管理員觸發「🔄 自動排程」
5. 確認排程結果出現在列表
6. 管理員點「✅ 確認」→ 狀態改為 confirmed
7. 管理員點「✔ 完成→分錢」→ 自動跳到分錢 Tab，session 已建立，BOSS 掉落物已填入

- [ ] **Step 2: 跨裝置同步測試**

兩個瀏覽器分頁使用同一 sync code，一個修改可用時段後，另一個 pull 確認資料同步。

- [ ] **Step 3: 修正發現的 bug**

根據測試結果逐一修正。

- [ ] **Step 4: 最終 Commit**

```bash
git add -A
git commit -m "feat: complete boss schedule system with loot integration"
git push
```
