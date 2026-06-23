# 額外剪刀補償機制 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在分錢 session 中追蹤「中繼轉移剪刀」支出，匯率在輸入當下鎖定，費用由全隊按份額均攤補償給付出者。

**Architecture:** 在 session 資料新增 `extraScissors` 陣列；`computeSettlementForSession` 將其總額納入 `netRevenue` 扣除（全隊分攤）並累加至付款人 `scissorPaid`（使付款人收到補償）；index.html 新增輸入區塊與結算摘要行。

**Tech Stack:** Vue 3 Composition API（全域 CDN，無打包工具）；純 HTML/JS，無測試框架，驗證靠瀏覽器手動測試。

## Global Constraints

- 所有 JS 變更在 `loot.js` 的 `useLoot()` 函式內完成，不新增其他檔案
- 所有 HTML 變更在 `index.html` 的分錢頁籤（`loot-tab` 區塊）內完成
- 折算金額永遠用 `entry.scissorType / entry.rateSnapshot * 1000`，不使用動態 `mileageRate`
- `rateSnapshot` 只在 `addExtraScissor` 時寫入一次，之後不改

---

### Task 1: loot.js — 資料結構與結算邏輯

**Files:**
- Modify: `loot.js:54-62` (normalizeSession return)
- Modify: `loot.js:78` (addSession)
- Modify: `loot.js:169-177` (clearSession)
- Modify: `loot.js:191-202` (createSessionFromRun session object)
- Modify: `loot.js:162` (after removeMemberItem — insert 3 new functions)
- Modify: `loot.js:283-286` (totalSnowflakeCost / netRevenue)
- Modify: `loot.js:350` (after memberItems loop — insert extraScissors scissorPaid loop)
- Modify: `loot.js:362-377` (computeSettlementForSession return)
- Modify: `loot.js:635` (useLoot return — export new functions)

**Interfaces:**
- Produces:
  - `extraScissorCash(entry: { scissorType: number, rateSnapshot: number }) → number` (萬楓幣)
  - `addExtraScissor() → void`
  - `removeExtraScissor(id: number) → void`
  - `settlementResult.totalExtraScissorCost: number`

- [ ] **Step 1: 在 `normalizeSession` return 加 `extraScissors`**

找到 `loot.js:54-62`，把：
```js
    return {
      id: Number(src.id) || nextId(),
      name: src.name || '新分錢',
      date: src.date || '',
      members: Array.isArray(src.members) ? src.members.filter(Boolean) : [],
      soldItems: Array.isArray(src.soldItems) ? src.soldItems.filter(i => i && i.id != null) : [],
      memberItems,
      snowflakesUsed: Number(src.snowflakesUsed) || 0,
    }
```
改成：
```js
    return {
      id: Number(src.id) || nextId(),
      name: src.name || '新分錢',
      date: src.date || '',
      members: Array.isArray(src.members) ? src.members.filter(Boolean) : [],
      soldItems: Array.isArray(src.soldItems) ? src.soldItems.filter(i => i && i.id != null) : [],
      memberItems,
      snowflakesUsed: Number(src.snowflakesUsed) || 0,
      extraScissors: Array.isArray(src.extraScissors) ? src.extraScissors.filter(e => e && e.id != null) : [],
    }
```

- [ ] **Step 2: 在 `addSession` 和 `createSessionFromRun` 加 `extraScissors: []`**

找到 `loot.js:78`，把：
```js
    const s = { id: nextId(), name: '新分錢', date: '', members: [], soldItems: [], memberItems: [], snowflakesUsed: 0 }
```
改成：
```js
    const s = { id: nextId(), name: '新分錢', date: '', members: [], soldItems: [], memberItems: [], snowflakesUsed: 0, extraScissors: [] }
```

找到 `loot.js:199-201`（`createSessionFromRun` 裡的 `s` 物件末尾），把：
```js
      soldItems:      drops,
      memberItems:    [],
      snowflakesUsed: 0,
```
改成：
```js
      soldItems:      drops,
      memberItems:    [],
      snowflakesUsed: 0,
      extraScissors:  [],
```

- [ ] **Step 3: 在 `clearSession` 加 `cs.extraScissors = []`**

找到 `loot.js:169-177`，把：
```js
  function clearSession() {
    const cs = currentSession.value
    if (!cs) return
    cs.date = ''
    cs.members = []
    cs.soldItems = []
    cs.memberItems = []
    cs.snowflakesUsed = 0
  }
```
改成：
```js
  function clearSession() {
    const cs = currentSession.value
    if (!cs) return
    cs.date = ''
    cs.members = []
    cs.soldItems = []
    cs.memberItems = []
    cs.snowflakesUsed = 0
    cs.extraScissors = []
  }
```

- [ ] **Step 4: 在 `removeMemberItem` 後面插入三個新函式**

找到 `loot.js:159-162`（`removeMemberItem` 函式結尾），在其後（`function memberItemScissorCost` 之前）插入：
```js
  function extraScissorCash(entry) {
    const rate = Number(entry?.rateSnapshot) || 0
    return rate > 0 ? (Number(entry?.scissorType) || 0) / rate * 1000 : 0
  }
  function addExtraScissor() {
    if (!currentSession.value) return
    if (!currentSession.value.extraScissors) currentSession.value.extraScissors = []
    currentSession.value.extraScissors.push({
      id: nextId(),
      memberName: currentSession.value.members[0]?.name || '',
      scissorType: 3900,
      rateSnapshot: mileageRate.value,
      note: '',
    })
  }
  function removeExtraScissor(id) {
    if (!currentSession.value) return
    currentSession.value.extraScissors = (currentSession.value.extraScissors || []).filter(e => e.id !== id)
  }
```

- [ ] **Step 5: 在 `computeSettlementForSession` 加 `totalExtraScissorCost`，更新 `netRevenue`**

找到 `loot.js:283-286`，把：
```js
    const snowflakesUsed = Number(session?.snowflakesUsed) || 0
    const totalSnowflakeCost = snowflakesUsed * snowflakeCostPer.value

    const netRevenue = totalRevenue - totalScissorCost - totalSnowflakeCost
```
改成：
```js
    const snowflakesUsed = Number(session?.snowflakesUsed) || 0
    const totalSnowflakeCost = snowflakesUsed * snowflakeCostPer.value

    const totalExtraScissorCost = (session?.extraScissors ?? []).reduce((sum, e) =>
      sum + extraScissorCash(e), 0)

    const netRevenue = totalRevenue - totalScissorCost - totalSnowflakeCost - totalExtraScissorCost
```

- [ ] **Step 6: 在 memberItems 迴圈之後插入 extraScissors 的 `scissorPaid` 累加迴圈**

找到 `loot.js:350`（memberItems `for` 迴圈結束的 `}`，其後緊接空行和 `for (const m of Object.values(memberMap))`），在兩者之間插入：
```js
    for (const e of (session?.extraScissors ?? [])) {
      const mm = memberMap[e.memberName]
      if (mm) mm.scissorPaid += extraScissorCash(e)
    }
```

- [ ] **Step 7: 在 `computeSettlementForSession` return 加 `totalExtraScissorCost`**

找到 `loot.js:372`，把：
```js
      totalScissorCost,
      totalSnowflakeCost,
```
改成：
```js
      totalScissorCost,
      totalExtraScissorCost,
      totalSnowflakeCost,
```

- [ ] **Step 8: 在 `useLoot` return 加入三個新函式**

找到 `loot.js:635`，把：
```js
    addMemberItem, removeMemberItem, memberItemScissorCost,
```
改成：
```js
    addMemberItem, removeMemberItem, memberItemScissorCost,
    extraScissorCash, addExtraScissor, removeExtraScissor,
```

- [ ] **Step 9: 在 `setState` 的 `_nextId` 重建迴圈加入 `extraScissors`**

找到 `loot.js:611-615`，把：
```js
    for (const sess of sessions.value) {
      if (!sess) continue
      if (sess.id > maxId) maxId = sess.id
      for (const i of (sess.soldItems || [])) if (i && i.id > maxId) maxId = i.id
      for (const i of (sess.memberItems || [])) if (i && i.id > maxId) maxId = i.id
    }
```
改成：
```js
    for (const sess of sessions.value) {
      if (!sess) continue
      if (sess.id > maxId) maxId = sess.id
      for (const i of (sess.soldItems || [])) if (i && i.id > maxId) maxId = i.id
      for (const i of (sess.memberItems || [])) if (i && i.id > maxId) maxId = i.id
      for (const e of (sess.extraScissors || [])) if (e && e.id > maxId) maxId = e.id
    }
```

- [ ] **Step 10: Commit**

```bash
git add loot.js
git commit -m "feat: add extra scissors data and settlement logic"
```

---

### Task 2: index.html — UI 輸入區塊與結算摘要

**Files:**
- Modify: `index.html:1500` (在 memberItems section 的 `</div>` 後插入新 subsection)
- Modify: `index.html:1519` (在「剪刀成本」row 後插入「額外剪刀成本」row)

**Interfaces:**
- Consumes (from Task 1):
  - `loot.extraScissorCash(e)` → number
  - `loot.addExtraScissor()` → void
  - `loot.removeExtraScissor(id)` → void
  - `loot.currentSession.extraScissors` → array
  - `loot.settlementResult.totalExtraScissorCost` → number

- [ ] **Step 1: 在 memberItems 區塊後插入「額外剪刀支出」subsection**

找到 `index.html:1500`（`<!-- 成員自取物品 -->` 對應 `<div class="loot-subsection">` 的結尾 `</div>`），在其後插入：
```html
        <!-- 額外剪刀支出 -->
        <div class="loot-subsection">
          <h3>✂ 額外剪刀支出</h3>
          <div class="loot-item-table" v-if="(loot.currentSession.extraScissors || []).length > 0">
            <div class="loot-receipt-header">
              <span>付剪刀的人</span><span>剪刀類型</span><span>折算(萬)</span><span>備註</span><span></span>
            </div>
            <div v-for="e in loot.currentSession.extraScissors" :key="e.id" class="loot-receipt-row">
              <select v-model="e.memberName" class="loot-select-sm">
                <option value="">-</option>
                <option v-for="m in loot.currentSession.members" :key="m.name" :value="m.name">{{ m.name }}</option>
              </select>
              <select v-model.number="e.scissorType" class="loot-select-sm">
                <option :value="3900">3900里程</option>
                <option :value="7100">7100里程</option>
              </select>
              <span class="loot-receipt-cost">{{ loot.extraScissorCash(e).toFixed(1) }}</span>
              <input type="text" v-model="e.note" class="loot-input-name" placeholder="備註" />
              <button class="btn btn-delete loot-btn-sm" @click="loot.removeExtraScissor(e.id)">✕</button>
            </div>
          </div>
          <div class="loot-receipt-add-row">
            <button class="btn loot-add-btn" @click="loot.addExtraScissor()">＋ 新增</button>
          </div>
        </div>
```

- [ ] **Step 2: 在結算摘要「剪刀成本」行後插入「額外剪刀成本」行**

找到 `index.html:1519`（`<span>剪刀成本</span>` 那行），在其後插入：
```html
            <div class="loot-summary-row danger" v-if="(loot.settlementResult.totalExtraScissorCost ?? 0) > 0.01">
              <span>額外剪刀成本（均攤）</span><span>-{{ (loot.settlementResult.totalExtraScissorCost ?? 0).toFixed(1) }} 萬</span>
            </div>
```

- [ ] **Step 3: 在瀏覽器中驗證**

開啟 `index.html`，切到「分錢」頁籤：

1. 加入 2 名成員（例如 A、B），各 share=1
2. 加入一個已賣出物品，price=1000，scissorType=3900，pickedBy=A
3. 在「額外剪刀支出」按「＋ 新增」，選 B、3900里程
4. 確認折算欄顯示正確萬楓幣數值（= 3900 / 目前匯率 * 1000）
5. 在設定改 mileageRate，確認剛才那筆的折算欄**不變**
6. 看結算結果：「額外剪刀成本」出現並顯示負值
7. 看成員表格：B 的「剪刀↓」欄比 A 多（B 付了額外剪刀）
8. 看轉帳清單：A 應付 B 錢（B 補償）

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat: add extra scissors UI and settlement summary row"
```
