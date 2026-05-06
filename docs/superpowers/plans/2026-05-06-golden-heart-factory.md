# 金之心製造工廠 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增第五個 Tab「💛 金之心工廠」，計算金之心製作成本、衝卷期望值，並提供單顆決策（EV 分析）。

**Architecture:** 新增 `heart.js` composable 封裝全部計算邏輯（純函式優先，方便驗證）。`index.html` 加入 Tab 5 模板與 script 標籤。`app.js` 初始化並接入現有 localStorage + 雲端同步。

**Tech Stack:** Vue 3 (CDN, Composition API)，vanilla JS，無 build tooling，localStorage 持久化，CSS 變數沿用現有主題。

---

## 檔案地圖

| 動作 | 路徑 | 負責內容 |
|------|------|---------|
| 新增 | `heart.js` | `useHeartFactory()` composable：常數、全部狀態、計算邏輯、getState/setState |
| 修改 | `index.html` | 加 Tab 按鈕、加 `<script src="heart.js">`、加 Tab 5 模板 |
| 修改 | `app.js` | 初始化 `heartFactory`、加 localStorage 讀寫、加入 return 與 pushAll/pullAll |
| 修改 | `style.css` | 金之心工廠專用 class |

---

## Task 1：建立 `heart.js` 骨架（常數 + 狀態 + getState/setState）

**Files:**
- Create: `heart.js`

- [ ] **Step 1：建立檔案，寫入骨架**

```js
function useHeartFactory() {
  const { ref, computed } = Vue

  // ── 常數 ──────────────────────────────────────────────────
  const SCROLLS = [
    { id: 'p10_str', name: '5攻3力',   rate: 0.10, atk: 5 },
    { id: 'p10_dex', name: '5攻1敏',   rate: 0.10, atk: 5 },
    { id: 'p10_luk', name: '5攻3姓',   rate: 0.10, atk: 5 },
    { id: 'p10_int', name: '5魔攻3智', rate: 0.10, atk: 5 },
    { id: 'p60_str', name: '2攻1力',   rate: 0.60, atk: 2 },
    { id: 'p60_atk', name: '2攻',      rate: 0.60, atk: 2 },
    { id: 'p60_luk', name: '2攻1幸',   rate: 0.60, atk: 2 },
    { id: 'p60_int', name: '2魔攻1智', rate: 0.60, atk: 2 },
  ]

  // ATK 結果有市價的集合（其餘為廢品，市值 0）
  const VALID_ATK = new Set([5, 7, 9, 10, 11, 12, 14, 15, 17, 20])

  // 3槽／4槽的 ATK 結果分組（僅用於市價表的 UI 分組標示）
  const ATK_3SLOT = [5, 7, 9, 10, 12, 15]
  const ATK_4SLOT = [11, 14, 17, 20]

  // ── 狀態 ──────────────────────────────────────────────────
  const goldPrice    = ref(0)   // 黃金單價（萬/顆）
  const crystalPrice = ref(0)   // 高級物品結晶單價（萬/顆）
  // 超高研磨劑固定 10萬，不需要 ref

  // 卷軸成本 { scrollId → 萬 }
  const scrollCosts = ref(Object.fromEntries(SCROLLS.map(s => [s.id, 0])))

  // 鐵鎚成本（萬）
  const hammer50  = ref(0)
  const hammer100 = ref(0)

  // 市場最低價 { `${atk}_no` → 萬, `${atk}_yes` → 萬 }
  const marketPrices = ref(
    Object.fromEntries(
      [...VALID_ATK].flatMap(atk => [
        [`${atk}_no`,  0],
        [`${atk}_yes`, 0],
      ])
    )
  )

  // 批量策略
  const batch = ref({
    slots:  ['p10_str', 'p10_str', 'p10_str'],  // slot1~3 的卷軸 id
    hammer: 'none',   // 'none' | '50' | '100'
    slot4:  'p10_str', // 第4槽（加槌後）用的卷軸
    qty:    10,
  })

  // 單顆心臟狀態
  const heart = ref({
    slots: [
      { scrollId: 'p10_str', result: 'unused' },  // result: 'unused'|'pass'|'fail'
      { scrollId: 'p10_str', result: 'unused' },
      { scrollId: 'p10_str', result: 'unused' },
    ],
    hasPotential: false,
    hammerUsed:   false,
    slot4: { scrollId: 'p10_str', result: 'unused' },
  })

  // 決策助手：要分析的卷軸/鐵鎚
  const nextScrollId       = ref('p10_str')
  const nextHammerType     = ref('50')
  const nextHammerScrollId = ref('p10_str')

  // ── getState / setState ────────────────────────────────────
  function getState() {
    return {
      goldPrice:    goldPrice.value,
      crystalPrice: crystalPrice.value,
      scrollCosts:  { ...scrollCosts.value },
      hammer50:     hammer50.value,
      hammer100:    hammer100.value,
      marketPrices: { ...marketPrices.value },
      batch:        JSON.parse(JSON.stringify(batch.value)),
    }
  }

  function setState(s) {
    if (!s) return
    goldPrice.value    = s.goldPrice    ?? 0
    crystalPrice.value = s.crystalPrice ?? 0
    if (s.scrollCosts)  Object.assign(scrollCosts.value,  s.scrollCosts)
    hammer50.value     = s.hammer50     ?? 0
    hammer100.value    = s.hammer100    ?? 0
    if (s.marketPrices) Object.assign(marketPrices.value, s.marketPrices)
    if (s.batch)        Object.assign(batch.value,        s.batch)
  }

  function resetHeart() {
    heart.value = {
      slots: [
        { scrollId: 'p10_str', result: 'unused' },
        { scrollId: 'p10_str', result: 'unused' },
        { scrollId: 'p10_str', result: 'unused' },
      ],
      hasPotential: false,
      hammerUsed:   false,
      slot4: { scrollId: 'p10_str', result: 'unused' },
    }
  }

  return {
    SCROLLS, VALID_ATK, ATK_3SLOT, ATK_4SLOT,
    goldPrice, crystalPrice,
    scrollCosts, hammer50, hammer100,
    marketPrices,
    batch,
    heart, nextScrollId, nextHammerType, nextHammerScrollId,
    getState, setState, resetHeart,
  }
}
```

- [ ] **Step 2：驗證骨架可被載入（稍後在 Task 3 掛上 script 後驗證，此步先跳過）**

- [ ] **Step 3：Commit**

```bash
git add heart.js
git commit -m "feat: add heart.js composable skeleton"
```

---

## Task 2：heart.js 加入全部計算邏輯

**Files:**
- Modify: `heart.js`（在 `return` 陳述式前加入以下計算）

- [ ] **Step 1：加入 materialCost、getMarketPrice、expectedMarketValue**

在 `resetHeart` 函式後、`return` 前插入：

```js
  // ── 計算：材料成本 ────────────────────────────────────────
  const materialCost = computed(() =>
    3 * (goldPrice.value || 0) + 10 + 4 * (crystalPrice.value || 0)
  )

  // ── 計算：市價查詢 ────────────────────────────────────────
  function getMarketPrice(atk, hasPotential) {
    if (!VALID_ATK.has(atk)) return 0
    return marketPrices.value[`${atk}_${hasPotential ? 'yes' : 'no'}`] || 0
  }

  // 含10%潛能機率的期望市值
  function expectedMarketValue(atk) {
    return 0.9 * getMarketPrice(atk, false) + 0.1 * getMarketPrice(atk, true)
  }
```

- [ ] **Step 2：加入 batchAnalysis computed**

```js
  // ── 計算：批量分析 ────────────────────────────────────────
  const batchAnalysis = computed(() => {
    const slots  = batch.value.slots.map(id => SCROLLS.find(s => s.id === id))
    const hammer = batch.value.hammer
    const s4     = SCROLLS.find(s => s.id === batch.value.slot4)

    if (slots.some(s => !s)) return null   // 防呆：卷軸未找到

    const hammerExpCost =
      hammer === '50'  ? 2 * (hammer50.value  || 0) :
      hammer === '100' ? (hammer100.value || 0) :
      0

    const scrollCostTotal =
      slots.reduce((sum, sc) => sum + (scrollCosts.value[sc.id] || 0), 0) +
      (hammer !== 'none' && s4 ? (scrollCosts.value[s4.id] || 0) : 0)

    const costPerHeart = materialCost.value + scrollCostTotal + hammerExpCost

    // 枚舉 3 槽 8 種組合
    const raw3 = []
    for (let mask = 0; mask < 8; mask++) {
      let prob = 1, atk = 0
      for (let j = 0; j < 3; j++) {
        const bit = (mask >> (2 - j)) & 1
        prob *= bit ? slots[j].rate : (1 - slots[j].rate)
        atk  += bit * slots[j].atk
      }
      raw3.push({ prob, atk })
    }

    // 若有加槌，展開第4槽（成功/失敗各一分支）
    const raw = (hammer === 'none' || !s4) ? raw3 : raw3.flatMap(o => [
      { prob: o.prob * s4.rate,       atk: o.atk + s4.atk },
      { prob: o.prob * (1 - s4.rate), atk: o.atk           },
    ])

    // 按 ATK 加總機率
    const grouped = {}
    for (const { prob, atk } of raw) {
      grouped[atk] = (grouped[atk] || 0) + prob
    }

    // 組成結果表
    const table = Object.entries(grouped)
      .map(([atk, prob]) => {
        const a      = +atk
        const expVal = expectedMarketValue(a)
        return {
          atk:    a,
          prob,
          expVal,
          profit: expVal - costPerHeart,
          valid:  VALID_ATK.has(a),
        }
      })
      .sort((a, b) => a.atk - b.atk)

    const validTable = table.filter(r => r.valid)
    const wasteProb  = table.filter(r => !r.valid).reduce((s, r) => s + r.prob, 0)
    const totalExpRevenue = table.reduce((s, r) => s + r.prob * r.expVal, 0)

    return {
      costPerHeart,
      hammerExpCost,
      scrollCostTotal,
      table: validTable,
      wasteProb,
      totalExpRevenue,
      expProfit:   totalExpRevenue - costPerHeart,
      totalBudget: costPerHeart * (batch.value.qty || 1),
    }
  })
```

- [ ] **Step 3：加入單顆心臟 computeds**

```js
  // ── 計算：單顆心臟狀態 ────────────────────────────────────
  const heartCurrentAtk = computed(() => {
    let atk = 0
    for (const slot of heart.value.slots) {
      if (slot.result === 'pass') {
        atk += SCROLLS.find(s => s.id === slot.scrollId)?.atk || 0
      }
    }
    if (heart.value.hammerUsed && heart.value.slot4.result === 'pass') {
      atk += SCROLLS.find(s => s.id === heart.value.slot4.scrollId)?.atk || 0
    }
    return atk
  })

  const heartCurrentMarketValue = computed(() =>
    getMarketPrice(heartCurrentAtk.value, heart.value.hasPotential)
  )

  const heartCostSoFar = computed(() => {
    let cost = materialCost.value
    for (const slot of heart.value.slots) {
      if (slot.result !== 'unused') cost += scrollCosts.value[slot.scrollId] || 0
    }
    if (heart.value.hammerUsed && heart.value.slot4.result !== 'unused') {
      cost += scrollCosts.value[heart.value.slot4.scrollId] || 0
    }
    return cost
  })

  const heartCurrentProfit = computed(() =>
    heartCurrentMarketValue.value - heartCostSoFar.value
  )

  const heartHasOpenSlot = computed(() =>
    heart.value.slots.some(s => s.result === 'unused') ||
    (heart.value.hammerUsed && heart.value.slot4.result === 'unused')
  )

  const heartCanHammer = computed(() =>
    !heart.value.hammerUsed &&
    heart.value.slots.every(s => s.result !== 'unused')
  )
```

- [ ] **Step 4：加入 EV 計算函式與 computed**

```js
  // ── 計算：EV ──────────────────────────────────────────────
  function calcScrollEV(scrollId) {
    const scroll = SCROLLS.find(s => s.id === scrollId)
    if (!scroll) return null
    const curVal     = heartCurrentMarketValue.value
    const successAtk = heartCurrentAtk.value + scroll.atk
    const successVal = getMarketPrice(successAtk, heart.value.hasPotential)
    const cost       = scrollCosts.value[scrollId] || 0
    const ev         = scroll.rate * (successVal - curVal) - cost
    return { scroll, cost, successAtk, successVal, failVal: curVal, ev, ok: ev > 0 }
  }

  function calcHammerEV(hammerType, scrollId) {
    const hammerCost = hammerType === '50'
      ? 2 * (hammer50.value || 0)
      : (hammer100.value || 0)
    const scroll = SCROLLS.find(s => s.id === scrollId)
    if (!scroll) return null
    const curVal     = heartCurrentMarketValue.value
    const successAtk = heartCurrentAtk.value + scroll.atk
    const successVal = getMarketPrice(successAtk, heart.value.hasPotential)
    const scrollCost = scrollCosts.value[scrollId] || 0
    const slot4EV    = scroll.rate * (successVal - curVal) - scrollCost
    const totalEV    = slot4EV - hammerCost
    return { hammerType, hammerCost, scroll, scrollCost, successAtk, successVal, slot4EV, totalEV, ok: totalEV > 0 }
  }

  const scrollEVResult    = computed(() => calcScrollEV(nextScrollId.value))
  const hammer50EVResult  = computed(() => calcHammerEV('50',  nextHammerScrollId.value))
  const hammer100EVResult = computed(() => calcHammerEV('100', nextHammerScrollId.value))
```

- [ ] **Step 5：更新 return 陳述式，加入所有新增的 ref/computed/fn**

```js
  return {
    SCROLLS, VALID_ATK, ATK_3SLOT, ATK_4SLOT,
    goldPrice, crystalPrice,
    scrollCosts, hammer50, hammer100,
    marketPrices,
    batch,
    heart, nextScrollId, nextHammerType, nextHammerScrollId,
    materialCost,
    getMarketPrice,
    batchAnalysis,
    heartCurrentAtk, heartCurrentMarketValue,
    heartCostSoFar, heartCurrentProfit,
    heartHasOpenSlot, heartCanHammer,
    scrollEVResult, hammer50EVResult, hammer100EVResult,
    getState, setState, resetHeart,
  }
```

- [ ] **Step 6：Commit**

```bash
git add heart.js
git commit -m "feat: add heart factory calculation logic"
```

---

## Task 3：接入 index.html 與 app.js

**Files:**
- Modify: `index.html`（加 script tag + Tab 按鈕）
- Modify: `app.js`（初始化 + localStorage + return）

- [ ] **Step 1：在 index.html 的 `<script src="alchemy.js...">` 行前加上 heart.js**

在 `index.html` 第 1436 行（`<script src="equip.js">`附近）的區塊，找到：
```html
  <script src="equip.js"></script>
```
在其上方新增：
```html
  <script src="heart.js"></script>
```

- [ ] **Step 2：在 index.html Tab bar 加第五個按鈕**

找到：
```html
        <button class="tab-btn" :class="{ active: activeTab === 'alchemy' }" @click="activeTab = 'alchemy'">
          鍊金成本
        </button>
```
在其後加：
```html
        <button class="tab-btn" :class="{ active: activeTab === 'heart' }" @click="activeTab = 'heart'">
          💛 金之心工廠
        </button>
```

- [ ] **Step 3：在 app.js setup() 中初始化 heartFactory**

找到：
```js
    const alchemy = Vue.reactive(useAlchemy())
```
在其後加：
```js
    const heartFactory = Vue.reactive(useHeartFactory())
```

- [ ] **Step 4：在 app.js 的 onMounted() 加入讀取**

找到：
```js
      loadAlchemySettings()
```
在其後加：
```js
      loadHeartSettings()
```

- [ ] **Step 5：在 app.js 加入 localStorage 讀寫函式**

找到：
```js
    Vue.watch(() => JSON.stringify(alchemy.getState()), saveAlchemySettings)
```
在其後加：
```js
    const HEART_SETTINGS_KEY = 'maple_heart_factory_settings'

    function saveHeartSettings() {
      try {
        localStorage.setItem(HEART_SETTINGS_KEY, JSON.stringify(heartFactory.getState()))
      } catch {}
      pushAll()
    }

    function loadHeartSettings() {
      try {
        const raw = localStorage.getItem(HEART_SETTINGS_KEY)
        if (raw) heartFactory.setState(JSON.parse(raw))
      } catch {}
    }

    Vue.watch(() => JSON.stringify(heartFactory.getState()), saveHeartSettings)
```

- [ ] **Step 6：在 app.js 的 applyCloudData 加入 heart**

找到：
```js
      if (data.alchemy) {
        localStorage.setItem(ALCHEMY_SETTINGS_KEY, JSON.stringify(data.alchemy))
        loadAlchemySettings()
      }
```
在其後加：
```js
      if (data.heart) {
        localStorage.setItem(HEART_SETTINGS_KEY, JSON.stringify(data.heart))
        loadHeartSettings()
      }
```

- [ ] **Step 7：在 app.js 的 pushAll 加入 heart**

找到：
```js
        alchemy: alchemy.getState(),
```
在其後加：
```js
        heart: heartFactory.getState(),
```

- [ ] **Step 8：在 app.js 的 return 加入 heartFactory**

找到：
```js
      alchemy, saveAlchemySettings,
```
在其後加：
```js
      heartFactory,
```

- [ ] **Step 9：開瀏覽器 console 驗證骨架正常**

開啟 `index.html`（用 Live Server 或直接開檔案），在 console 執行：
```js
// 不應噴錯，heartFactory 應是 reactive 物件
document.querySelector('#app').__vue_app__.config.globalProperties
// 或直接看 Tab 切換時「💛 金之心工廠」出現
```

點擊「💛 金之心工廠」Tab，應顯示空白頁（還沒有 `v-else-if` template）。

- [ ] **Step 10：Commit**

```bash
git add index.html app.js
git commit -m "feat: wire heartFactory into app shell and localStorage"
```

---

## Task 4：HTML 模板 — 區塊 ①② 成本設定

**Files:**
- Modify: `index.html`（加 Tab 5 main 區塊）

- [ ] **Step 1：在 `index.html` 的 alchemy tab 結束後（`</main>` 後、`<!-- ── 衝突...` 前）加入 heart tab 模板**

找到：
```html
    </main>

    <!-- ── 衝突解決對話框 ── -->
```
在其間插入：

```html
    <!-- ══════════════════════════════════════════ Tab 5：金之心工廠 ══ -->
    <main v-else-if="activeTab === 'heart'" class="heart-tab">

      <!-- ① 材料成本 -->
      <section class="heart-section">
        <h2 class="heart-section-title">① 材料成本</h2>
        <div class="heart-cost-row">
          <div class="heart-field">
            <label>黃金 × 3&nbsp;&nbsp;單價</label>
            <div class="heart-input-wrap">
              <input type="number" v-model.number="heartFactory.goldPrice" min="0" />
              <span>萬/顆</span>
            </div>
          </div>
          <div class="heart-field">
            <label>超高研磨劑 × 1</label>
            <div class="heart-input-wrap">
              <input type="number" value="10" disabled class="heart-fixed" />
              <span>萬（固定）</span>
            </div>
          </div>
          <div class="heart-field">
            <label>高級物品結晶 × 4&nbsp;&nbsp;單價</label>
            <div class="heart-input-wrap">
              <input type="number" v-model.number="heartFactory.crystalPrice" min="0" />
              <span>萬/顆</span>
            </div>
          </div>
          <div class="heart-total-chip">
            每顆材料成本：<strong>{{ heartFactory.materialCost }} 萬</strong>
            <small>= 3×{{ heartFactory.goldPrice||0 }} + 10 + 4×{{ heartFactory.crystalPrice||0 }}</small>
          </div>
        </div>
      </section>

      <!-- ② 卷軸 & 鐵鎚成本 -->
      <section class="heart-section">
        <h2 class="heart-section-title">② 卷軸 & 鐵鎚成本</h2>
        <div class="heart-scroll-block">
          <!-- 10% 卷軸 -->
          <div class="heart-scroll-group">
            <div class="heart-scroll-group-title heart-gold">── 10% 攻擊卷軸</div>
            <div class="heart-scroll-grid">
              <div v-for="sc in heartFactory.SCROLLS.filter(s => s.rate === 0.10)" :key="sc.id" class="heart-scroll-item">
                <span>{{ sc.name }}</span>
                <input type="number" v-model.number="heartFactory.scrollCosts[sc.id]" min="0" />
                <span>萬</span>
              </div>
            </div>
          </div>
          <!-- 60% 卷軸 -->
          <div class="heart-scroll-group">
            <div class="heart-scroll-group-title heart-purple">── 60% 攻擊卷軸（補槽用）</div>
            <div class="heart-scroll-grid">
              <div v-for="sc in heartFactory.SCROLLS.filter(s => s.rate === 0.60)" :key="sc.id" class="heart-scroll-item">
                <span>{{ sc.name }}</span>
                <input type="number" v-model.number="heartFactory.scrollCosts[sc.id]" min="0" />
                <span>萬</span>
              </div>
            </div>
          </div>
          <!-- 鐵鎚 -->
          <div class="heart-scroll-group">
            <div class="heart-scroll-group-title heart-red">── 鐵鎚（+1槽）</div>
            <div class="heart-scroll-grid" style="grid-template-columns:1fr">
              <div class="heart-scroll-item">
                <span>50% 鐵鎚</span>
                <input type="number" v-model.number="heartFactory.hammer50" min="0" />
                <span>萬</span>
              </div>
              <div class="heart-scroll-item">
                <span>100% 鐵鎚</span>
                <input type="number" v-model.number="heartFactory.hammer100" min="0" />
                <span>萬</span>
              </div>
            </div>
            <div class="heart-note">50%鎚期望成本 = 2 × 單價</div>
          </div>
        </div>
      </section>

    </main><!-- end heart tab -->
```

- [ ] **Step 2：開瀏覽器，切到「💛 金之心工廠」Tab，確認區塊①②顯示正常**

驗證：
- 黃金、結晶價格輸入後，「每顆材料成本」即時更新
- 8 種卷軸 + 2 種鐵鎚都有輸入框

- [ ] **Step 3：Commit**

```bash
git add index.html
git commit -m "feat: add heart factory HTML sections 1 and 2 (cost inputs)"
```

---

## Task 5：HTML 模板 — 區塊 ③ 市場最低價

**Files:**
- Modify: `index.html`（在 ② section 後、`</main>` 前插入）

- [ ] **Step 1：加入市場最低價表格**

在 `<!-- end heart tab -->` 的 `</main>` 前插入：

```html
      <!-- ③ 市場最低價 -->
      <section class="heart-section">
        <h2 class="heart-section-title">③ 各心臟市場最低價（查市場後填入）</h2>
        <div class="heart-price-block">
          <!-- 3槽 -->
          <div class="heart-price-group">
            <div class="heart-price-group-title heart-blue">── 3槽（無槌）</div>
            <div class="heart-price-table-head">
              <span>心臟</span><span>無潛能（萬）</span><span>有潛能（萬）</span>
            </div>
            <div v-for="atk in heartFactory.ATK_3SLOT" :key="'3_'+atk" class="heart-price-row">
              <span class="heart-atk-label">{{ atk }}攻</span>
              <input type="number" v-model.number="heartFactory.marketPrices[atk+'_no']"  min="0" />
              <input type="number" v-model.number="heartFactory.marketPrices[atk+'_yes']" min="0" />
            </div>
          </div>
          <!-- 4槽 -->
          <div class="heart-price-group">
            <div class="heart-price-group-title heart-purple">── 4槽（加槌後）</div>
            <div class="heart-price-table-head">
              <span>心臟</span><span>無潛能（萬）</span><span>有潛能（萬）</span>
            </div>
            <div v-for="atk in heartFactory.ATK_4SLOT" :key="'4_'+atk" class="heart-price-row">
              <span class="heart-atk-label heart-atk-hammer">{{ atk }}攻</span>
              <input type="number" v-model.number="heartFactory.marketPrices[atk+'_no']"  min="0" />
              <input type="number" v-model.number="heartFactory.marketPrices[atk+'_yes']" min="0" />
            </div>
          </div>
          <div class="heart-note" style="align-self:flex-end">
            共 20 格，填完即可用於 EV 計算
          </div>
        </div>
      </section>
```

- [ ] **Step 2：開瀏覽器確認 20 格市價輸入正確顯示**

應看到兩組（3槽 6行、4槽 4行），每行有兩個輸入框（無潛能/有潛能）。

- [ ] **Step 3：Commit**

```bash
git add index.html
git commit -m "feat: add heart factory HTML section 3 (market prices)"
```

---

## Task 6：HTML 模板 — 區塊 ④ 批量分析

**Files:**
- Modify: `index.html`（在 ③ section 後、`</main>` 前插入）

- [ ] **Step 1：加入批量分析與單顆決策的外層 grid**

在 ③ section 後、`</main>` 前插入：

```html
      <!-- ④⑤ 批量分析 + 單顆決策 -->
      <div class="heart-bottom-grid">

        <!-- ④ 批量分析 -->
        <section class="heart-panel">
          <h2 class="heart-panel-title heart-green">④ 批量分析</h2>
          <div class="heart-note" style="margin-bottom:8px">設定衝卷策略，計算各結果機率與期望利潤</div>

          <!-- 策略設定 -->
          <div v-for="(_, i) in [0,1,2]" :key="i" class="heart-slot-row">
            <span class="heart-slot-label">槽{{ i+1 }}</span>
            <select v-model="heartFactory.batch.slots[i]" class="heart-sel">
              <option v-for="sc in heartFactory.SCROLLS" :key="sc.id" :value="sc.id">
                {{ sc.name }}（{{ (sc.rate*100).toFixed(0) }}%，{{ heartFactory.scrollCosts[sc.id]||0 }}萬）
              </option>
            </select>
          </div>
          <div class="heart-slot-row">
            <span class="heart-slot-label">槌子</span>
            <select v-model="heartFactory.batch.hammer" class="heart-sel">
              <option value="none">不加槌</option>
              <option value="50">50%鐵鎚（期望 {{ 2*(heartFactory.hammer50||0) }}萬）</option>
              <option value="100">100%鐵鎚（{{ heartFactory.hammer100||0 }}萬）</option>
            </select>
          </div>
          <div class="heart-slot-row" v-if="heartFactory.batch.hammer !== 'none'">
            <span class="heart-slot-label">槽4卷</span>
            <select v-model="heartFactory.batch.slot4" class="heart-sel">
              <option v-for="sc in heartFactory.SCROLLS" :key="sc.id" :value="sc.id">
                {{ sc.name }}（{{ (sc.rate*100).toFixed(0) }}%）
              </option>
            </select>
          </div>
          <div class="heart-slot-row">
            <span class="heart-slot-label">製作顆數</span>
            <input type="number" v-model.number="heartFactory.batch.qty" min="1" class="heart-qty-input" />
          </div>

          <div class="heart-divider"></div>

          <template v-if="heartFactory.batchAnalysis">
            <!-- 成本摘要 -->
            <div class="heart-ev-row"><span>每顆材料成本</span><span>{{ heartFactory.materialCost }} 萬</span></div>
            <div class="heart-ev-row"><span>卷軸成本合計</span><span>{{ heartFactory.batchAnalysis.scrollCostTotal }} 萬</span></div>
            <div class="heart-ev-row" v-if="heartFactory.batch.hammer !== 'none'">
              <span>鐵鎚期望成本</span><span>{{ heartFactory.batchAnalysis.hammerExpCost }} 萬</span>
            </div>
            <div class="heart-ev-row heart-ev-total">
              <span>每顆總成本</span><span>{{ heartFactory.batchAnalysis.costPerHeart }} 萬</span>
            </div>
            <div class="heart-ev-row">
              <span>{{ heartFactory.batch.qty }} 顆總預算</span>
              <span>{{ heartFactory.batchAnalysis.totalBudget }} 萬</span>
            </div>

            <div class="heart-divider"></div>

            <!-- 結果機率表 -->
            <div class="heart-outcome-head">
              <span>結果</span><span>機率</span><span>期望市值</span><span>利潤/顆</span>
            </div>
            <div v-for="r in heartFactory.batchAnalysis.table" :key="r.atk" class="heart-outcome-row">
              <span>{{ r.atk }}攻</span>
              <span>{{ (r.prob*100).toFixed(2) }}%</span>
              <span>{{ r.expVal.toFixed(0) }} 萬</span>
              <span :class="r.profit >= 0 ? 'heart-profit' : 'heart-loss'">
                {{ r.profit >= 0 ? '+' : '' }}{{ r.profit.toFixed(0) }} 萬
              </span>
            </div>
            <div class="heart-outcome-row heart-waste" v-if="heartFactory.batchAnalysis.wasteProb > 0.0001">
              <span>廢品（其他）</span>
              <span>{{ (heartFactory.batchAnalysis.wasteProb*100).toFixed(2) }}%</span>
              <span>0 萬</span>
              <span class="heart-loss">{{ (-heartFactory.batchAnalysis.costPerHeart).toFixed(0) }} 萬</span>
            </div>

            <div class="heart-divider"></div>

            <!-- 期望利潤 -->
            <div class="heart-ev-row">
              <span>期望收益（含潛能）</span>
              <span>{{ heartFactory.batchAnalysis.totalExpRevenue.toFixed(0) }} 萬</span>
            </div>
            <div class="heart-ev-row heart-ev-total"
                 :class="heartFactory.batchAnalysis.expProfit >= 0 ? 'heart-profit' : 'heart-loss'">
              <span>每顆期望利潤</span>
              <span>{{ heartFactory.batchAnalysis.expProfit >= 0 ? '+' : '' }}{{ heartFactory.batchAnalysis.expProfit.toFixed(0) }} 萬</span>
            </div>
          </template>
        </section>

        <!-- ⑤ 放 Task 7 -->
        <section class="heart-panel" id="heart-decision-placeholder">
          <h2 class="heart-panel-title heart-orange">⑤ 單顆決策助手</h2>
          <div class="heart-note">（下一步實作）</div>
        </section>

      </div><!-- end heart-bottom-grid -->
```

- [ ] **Step 2：開瀏覽器確認批量分析正確運作**

輸入黃金 = 50，結晶 = 30，5攻3力卷軸 = 200萬，三槽均選「5攻3力（10%）」，不加槌：
- 每顆總成本應 = `3×50 + 10 + 4×30 + 3×200` = 280 + 600 = 880 萬
- 表格應顯示：5攻(2.7%)、10攻(0.3%)、15攻(0.01%)，廢品(~97%)

- [ ] **Step 3：Commit**

```bash
git add index.html
git commit -m "feat: add heart factory HTML section 4 (batch analysis)"
```

---

## Task 7：HTML 模板 — 區塊 ⑤ 單顆決策助手

**Files:**
- Modify: `index.html`（替換 `#heart-decision-placeholder` section）

- [ ] **Step 1：替換佔位 section**

找到：
```html
        <!-- ⑤ 放 Task 7 -->
        <section class="heart-panel" id="heart-decision-placeholder">
          <h2 class="heart-panel-title heart-orange">⑤ 單顆決策助手</h2>
          <div class="heart-note">（下一步實作）</div>
        </section>
```
替換為：

```html
        <!-- ⑤ 單顆決策助手 -->
        <section class="heart-panel">
          <h2 class="heart-panel-title heart-orange">⑤ 單顆決策助手</h2>
          <div class="heart-note" style="margin-bottom:8px">輸入目前這顆心臟的狀態，即時計算下一步 EV</div>

          <!-- 槽位狀態輸入 -->
          <div v-for="(slot, i) in heartFactory.heart.slots" :key="i" class="heart-slot-row">
            <span class="heart-slot-label">槽{{ i+1 }}</span>
            <select v-model="slot.scrollId" class="heart-sel" style="flex:1">
              <option v-for="sc in heartFactory.SCROLLS" :key="sc.id" :value="sc.id">{{ sc.name }}</option>
            </select>
            <div class="heart-result-btns">
              <button :class="['heart-btn-result', slot.result==='pass'?'active-pass':'']"
                      @click="slot.result='pass'">✅ 過</button>
              <button :class="['heart-btn-result', slot.result==='fail'?'active-fail':'']"
                      @click="slot.result='fail'">❌ 失敗</button>
              <button :class="['heart-btn-result', slot.result==='unused'?'active-none':'']"
                      @click="slot.result='unused'">－ 未用</button>
            </div>
          </div>

          <!-- 潛能 & 槌子 -->
          <div class="heart-slot-row">
            <span class="heart-slot-label">潛能</span>
            <select v-model="heartFactory.heart.hasPotential" class="heart-sel">
              <option :value="false">❌ 無潛能</option>
              <option :value="true">✅ 有潛能</option>
            </select>
          </div>
          <div class="heart-slot-row">
            <span class="heart-slot-label">槌子</span>
            <select v-model="heartFactory.heart.hammerUsed" class="heart-sel">
              <option :value="false">尚未加槌（3槽）</option>
              <option :value="true">已加槌（4槽）</option>
            </select>
          </div>
          <div v-if="heartFactory.heart.hammerUsed" class="heart-slot-row">
            <span class="heart-slot-label">槽4</span>
            <select v-model="heartFactory.heart.slot4.scrollId" class="heart-sel" style="flex:1">
              <option v-for="sc in heartFactory.SCROLLS" :key="sc.id" :value="sc.id">{{ sc.name }}</option>
            </select>
            <div class="heart-result-btns">
              <button :class="['heart-btn-result', heartFactory.heart.slot4.result==='pass'?'active-pass':'']"
                      @click="heartFactory.heart.slot4.result='pass'">✅ 過</button>
              <button :class="['heart-btn-result', heartFactory.heart.slot4.result==='fail'?'active-fail':'']"
                      @click="heartFactory.heart.slot4.result='fail'">❌ 失敗</button>
              <button :class="['heart-btn-result', heartFactory.heart.slot4.result==='unused'?'active-none':'']"
                      @click="heartFactory.heart.slot4.result='unused'">－ 未用</button>
            </div>
          </div>

          <button class="heart-reset-btn" @click="heartFactory.resetHeart()">🔄 重設心臟</button>

          <div class="heart-divider"></div>

          <!-- 目前狀態摘要 -->
          <div class="heart-state-chip">
            目前：<strong>{{ heartFactory.heartCurrentAtk }}攻</strong>
            <span v-if="heartFactory.heart.hasPotential" class="heart-pot-badge">✨ 有潛能</span>
          </div>
          <div class="heart-ev-row">
            <span>現在賣</span>
            <span class="heart-market-val">{{ heartFactory.heartCurrentMarketValue }} 萬</span>
          </div>
          <div class="heart-ev-row">
            <span>已花費成本</span><span>{{ heartFactory.heartCostSoFar }} 萬</span>
          </div>
          <div class="heart-ev-row heart-ev-total"
               :class="heartFactory.heartCurrentProfit >= 0 ? 'heart-profit' : 'heart-loss'">
            <span>目前損益</span>
            <span>{{ heartFactory.heartCurrentProfit >= 0 ? '+' : '' }}{{ heartFactory.heartCurrentProfit }} 萬</span>
          </div>

          <div class="heart-divider"></div>

          <!-- 下一格：選卷軸分析 EV（僅在有空槽時顯示）-->
          <template v-if="heartFactory.heartHasOpenSlot">
            <div class="heart-note" style="margin-bottom:6px">下一格，要點哪種卷軸？</div>
            <select v-model="heartFactory.nextScrollId" class="heart-sel" style="width:100%;margin-bottom:8px">
              <option v-for="sc in heartFactory.SCROLLS" :key="sc.id" :value="sc.id">
                {{ sc.name }}（{{ (sc.rate*100).toFixed(0) }}%，{{ heartFactory.scrollCosts[sc.id]||0 }}萬）
              </option>
            </select>

            <template v-if="heartFactory.scrollEVResult">
              <div class="heart-ev-box">
                <div class="heart-ev-row">
                  <span>成功({{ (heartFactory.scrollEVResult.scroll.rate*100).toFixed(0) }}%)
                    → {{ heartFactory.scrollEVResult.successAtk }}攻
                    {{ heartFactory.heart.hasPotential ? '有潛' : '無潛' }}
                  </span>
                  <span class="heart-profit">市價 {{ heartFactory.scrollEVResult.successVal }} 萬</span>
                </div>
                <div class="heart-ev-row">
                  <span>失敗({{ (100 - heartFactory.scrollEVResult.scroll.rate*100).toFixed(0) }}%)
                    → 維持 {{ heartFactory.heartCurrentAtk }}攻
                  </span>
                  <span>市價 {{ heartFactory.scrollEVResult.failVal }} 萬</span>
                </div>
                <div class="heart-ev-row">
                  <span>卷軸成本</span>
                  <span class="heart-loss">−{{ heartFactory.scrollEVResult.cost }} 萬</span>
                </div>
                <div class="heart-ev-row heart-ev-total"
                     :class="heartFactory.scrollEVResult.ok ? 'heart-profit' : 'heart-loss'">
                  <span>EV（vs 現在賣 {{ heartFactory.heartCurrentMarketValue }} 萬）</span>
                  <span>
                    {{ heartFactory.scrollEVResult.ev >= 0 ? '+' : '' }}{{ heartFactory.scrollEVResult.ev.toFixed(0) }} 萬
                    &nbsp;
                    <span :class="heartFactory.scrollEVResult.ok ? 'heart-tag-go' : 'heart-tag-stop'">
                      {{ heartFactory.scrollEVResult.ok ? '建議點！' : '不建議' }}
                    </span>
                  </span>
                </div>
              </div>
            </template>
          </template>

          <!-- 加槌分析（僅在心臟尚未加槌且三槽都用完時顯示）-->
          <template v-if="heartFactory.heartCanHammer">
            <div class="heart-divider"></div>
            <div class="heart-note" style="margin-bottom:6px">加槌子開第4槽？選槽4卷軸：</div>
            <select v-model="heartFactory.nextHammerScrollId" class="heart-sel" style="width:100%;margin-bottom:8px">
              <option v-for="sc in heartFactory.SCROLLS" :key="sc.id" :value="sc.id">{{ sc.name }}</option>
            </select>

            <template v-if="heartFactory.hammer50EVResult">
              <div class="heart-ev-box" style="margin-bottom:6px">
                <div class="heart-ev-box-title heart-gold">🔨 50%鐵鎚（期望成本 {{ heartFactory.hammer50EVResult.hammerCost }} 萬）</div>
                <div class="heart-ev-row">
                  <span>槽4成功 → {{ heartFactory.hammer50EVResult.successAtk }}攻</span>
                  <span class="heart-profit">{{ heartFactory.hammer50EVResult.successVal }} 萬</span>
                </div>
                <div class="heart-ev-row">
                  <span>槽4成功期望增益</span>
                  <span>{{ heartFactory.hammer50EVResult.slot4EV.toFixed(0) }} 萬</span>
                </div>
                <div class="heart-ev-row heart-ev-total"
                     :class="heartFactory.hammer50EVResult.ok ? 'heart-profit' : 'heart-loss'">
                  <span>總 EV（含槌成本）</span>
                  <span>
                    {{ heartFactory.hammer50EVResult.totalEV >= 0 ? '+' : '' }}{{ heartFactory.hammer50EVResult.totalEV.toFixed(0) }} 萬
                    &nbsp;
                    <span :class="heartFactory.hammer50EVResult.ok ? 'heart-tag-go' : 'heart-tag-stop'">
                      {{ heartFactory.hammer50EVResult.ok ? '建議！' : '不建議' }}
                    </span>
                  </span>
                </div>
              </div>
            </template>

            <template v-if="heartFactory.hammer100EVResult">
              <div class="heart-ev-box">
                <div class="heart-ev-box-title heart-red">🔨 100%鐵鎚（{{ heartFactory.hammer100EVResult.hammerCost }} 萬）</div>
                <div class="heart-ev-row">
                  <span>槽4成功 → {{ heartFactory.hammer100EVResult.successAtk }}攻</span>
                  <span class="heart-profit">{{ heartFactory.hammer100EVResult.successVal }} 萬</span>
                </div>
                <div class="heart-ev-row heart-ev-total"
                     :class="heartFactory.hammer100EVResult.ok ? 'heart-profit' : 'heart-loss'">
                  <span>總 EV（含槌成本）</span>
                  <span>
                    {{ heartFactory.hammer100EVResult.totalEV >= 0 ? '+' : '' }}{{ heartFactory.hammer100EVResult.totalEV.toFixed(0) }} 萬
                    &nbsp;
                    <span :class="heartFactory.hammer100EVResult.ok ? 'heart-tag-go' : 'heart-tag-stop'">
                      {{ heartFactory.hammer100EVResult.ok ? '建議！' : '不建議' }}
                    </span>
                  </span>
                </div>
              </div>
            </template>
          </template>

        </section>
```

- [ ] **Step 2：開瀏覽器驗證單顆決策**

情境：黃金50萬、結晶30萬、5攻3力卷軸200萬、2攻1力卷軸80萬。市價表：5攻無潛=400萬、5攻有潛=800萬、7攻有潛=1100萬。

設定：槽1 5攻3力 ✅過，槽2 2攻1力 ❌失敗，槽3 未用，有潛能。

驗證：
- 目前ATK = 5，市值 = 800萬
- 已花費 = 280(材料) + 200(槽1) + 80(槽2) = 560萬
- 目前損益 = +240萬
- 選「2攻1力（60%）80萬」分析 EV：
  - 60% × (1100 − 800) − 80 = 180 − 80 = **+100萬**，應顯示「建議點！」
- 選「5攻3力（10%）200萬」：
  - 10% × (2000 − 800) − 200（假設10攻有潛=2000萬）= 120 − 200 = **−80萬**，應顯示「不建議」

- [ ] **Step 3：Commit**

```bash
git add index.html
git commit -m "feat: add heart factory HTML section 5 (single-heart decision)"
```

---

## Task 8：CSS 樣式

**Files:**
- Modify: `style.css`（在檔案末尾加入）

- [ ] **Step 1：在 style.css 末尾加入心臟工廠專用 CSS**

```css
/* ═══════════════════════════════════════ 金之心工廠 ══ */
.heart-tab {
  max-width: 1200px;
  margin: 0 auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.heart-section {
  background: var(--bg-panel);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 14px 16px;
}

.heart-section-title {
  font-size: 13px;
  font-weight: bold;
  color: var(--accent);
  margin-bottom: 12px;
  letter-spacing: 0.5px;
}

/* ── 材料成本 ── */
.heart-cost-row {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  align-items: flex-end;
}

.heart-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.heart-field label {
  font-size: 11px;
  color: var(--text-dim);
}

.heart-input-wrap {
  display: flex;
  align-items: center;
  gap: 4px;
}

.heart-input-wrap input {
  width: 80px;
  background: var(--bg-input);
  border: 1px solid var(--border);
  color: var(--text);
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 13px;
}

.heart-fixed {
  color: var(--text-dim) !important;
  cursor: not-allowed;
}

.heart-total-chip {
  background: #1e3a1e;
  border: 1px solid var(--success);
  border-radius: 6px;
  padding: 6px 12px;
  font-size: 12px;
  color: var(--success);
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.heart-total-chip small {
  font-size: 10px;
  color: var(--text-dim);
}

/* ── 卷軸 & 鐵鎚 ── */
.heart-scroll-block {
  display: flex;
  gap: 20px;
  flex-wrap: wrap;
}

.heart-scroll-group-title {
  font-size: 11px;
  font-weight: bold;
  margin-bottom: 6px;
}

.heart-scroll-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px;
}

.heart-scroll-item {
  display: flex;
  align-items: center;
  gap: 6px;
  background: var(--bg-input);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 4px 8px;
  font-size: 11px;
}

.heart-scroll-item input {
  width: 65px;
  background: var(--bg-panel);
  border: 1px solid var(--border);
  color: var(--text);
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 11px;
}

.heart-note {
  font-size: 10px;
  color: var(--text-dim);
  font-style: italic;
}

/* ── 市價表 ── */
.heart-price-block {
  display: flex;
  gap: 20px;
  flex-wrap: wrap;
  align-items: flex-start;
}

.heart-price-table-head {
  display: grid;
  grid-template-columns: 55px 90px 90px;
  gap: 4px;
  font-size: 10px;
  color: var(--text-dim);
  margin-bottom: 4px;
  padding: 0 4px;
}

.heart-price-row {
  display: grid;
  grid-template-columns: 55px 90px 90px;
  gap: 4px;
  align-items: center;
  margin-bottom: 3px;
}

.heart-atk-label {
  background: var(--bg-input);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 4px 8px;
  font-size: 12px;
  font-weight: bold;
  text-align: center;
}

.heart-atk-hammer {
  border-color: #6a3a8a;
  color: #c894e8;
}

.heart-price-row input {
  background: var(--bg-input);
  border: 1px solid var(--border);
  color: var(--text);
  padding: 3px 6px;
  border-radius: 4px;
  font-size: 11px;
  width: 100%;
  box-sizing: border-box;
}

.heart-price-group-title {
  font-size: 11px;
  font-weight: bold;
  margin-bottom: 6px;
}

/* ── 下方兩欄 ── */
.heart-bottom-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

@media (max-width: 900px) {
  .heart-bottom-grid { grid-template-columns: 1fr; }
}

.heart-panel {
  background: var(--bg-panel);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 14px 16px;
}

.heart-panel-title {
  font-size: 13px;
  font-weight: bold;
  margin-bottom: 8px;
}

/* ── 策略選擇 ── */
.heart-slot-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 5px;
  font-size: 12px;
}

.heart-slot-label {
  color: var(--text-dim);
  font-size: 11px;
  min-width: 36px;
}

.heart-sel {
  background: var(--bg-input);
  border: 1px solid var(--border);
  color: var(--text);
  padding: 3px 6px;
  border-radius: 4px;
  font-size: 11px;
  flex: 1;
}

.heart-qty-input {
  width: 65px;
  background: var(--bg-input);
  border: 1px solid var(--border);
  color: var(--text);
  padding: 3px 8px;
  border-radius: 4px;
  font-size: 12px;
}

/* ── 結果表 ── */
.heart-outcome-head,
.heart-outcome-row {
  display: grid;
  grid-template-columns: 60px 65px 85px 85px;
  gap: 4px;
  font-size: 11px;
  padding: 3px 0;
  border-bottom: 1px solid #1a2030;
}

.heart-outcome-head {
  color: var(--text-dim);
  font-size: 10px;
}

.heart-waste { opacity: 0.6; }

/* ── EV 顯示 ── */
.heart-ev-row {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  margin-bottom: 3px;
}

.heart-ev-total {
  font-weight: bold;
  padding-top: 4px;
  border-top: 1px solid var(--border);
  margin-top: 2px;
}

.heart-ev-box {
  background: var(--bg-input);
  border-radius: 5px;
  padding: 8px 10px;
  margin-bottom: 6px;
}

.heart-ev-box-title {
  font-size: 11px;
  font-weight: bold;
  margin-bottom: 5px;
}

.heart-divider {
  border: none;
  border-top: 1px solid var(--border);
  margin: 8px 0;
}

/* ── 單顆決策 ── */
.heart-result-btns {
  display: flex;
  gap: 3px;
}

.heart-btn-result {
  background: var(--bg-input);
  border: 1px solid var(--border);
  color: var(--text-dim);
  padding: 2px 7px;
  border-radius: 4px;
  font-size: 10px;
  cursor: pointer;
}

.heart-btn-result.active-pass {
  background: #1e4a2e;
  border-color: var(--success);
  color: var(--success);
}

.heart-btn-result.active-fail {
  background: #4a1e1e;
  border-color: var(--danger);
  color: var(--danger);
}

.heart-btn-result.active-none {
  border-color: #5a6a8a;
  color: var(--text-dim);
}

.heart-reset-btn {
  margin-top: 5px;
  background: var(--bg-input);
  border: 1px solid var(--border);
  color: var(--text-dim);
  padding: 4px 12px;
  border-radius: 4px;
  font-size: 11px;
  cursor: pointer;
}

.heart-state-chip {
  background: #1e1a0e;
  border: 1px solid var(--accent);
  border-radius: 5px;
  padding: 5px 10px;
  font-size: 13px;
  font-weight: bold;
  color: var(--accent);
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin: 6px 0;
}

.heart-pot-badge {
  font-size: 11px;
  color: #c894e8;
}

.heart-market-val {
  color: #4a9eff;
  font-weight: bold;
}

/* ── 顏色 ── */
.heart-profit { color: var(--success); }
.heart-loss   { color: var(--danger);  }
.heart-gold   { color: var(--accent);  }
.heart-purple { color: #c894e8; }
.heart-red    { color: var(--danger);  }
.heart-blue   { color: #4a9eff; }
.heart-green  { color: var(--success); }
.heart-orange { color: #e67e22; }

.heart-tag-go {
  background: #1e4a2e;
  border: 1px solid var(--success);
  color: var(--success);
  padding: 1px 6px;
  border-radius: 3px;
  font-size: 10px;
  font-weight: bold;
}

.heart-tag-stop {
  background: #4a1e1e;
  border: 1px solid var(--danger);
  color: var(--danger);
  padding: 1px 6px;
  border-radius: 3px;
  font-size: 10px;
  font-weight: bold;
}
```

- [ ] **Step 2：開瀏覽器確認樣式正確套用**

整體外觀應與現有 Tab 風格一致（深色背景、金色標題、綠/紅損益色）。

- [ ] **Step 3：Commit**

```bash
git add style.css
git commit -m "feat: add heart factory CSS styles"
```

---

## Task 9：完整測試 & 最終 Commit

- [ ] **Step 1：情境測試 A — 批量分析**

設定：黃金=50萬、結晶=30萬、5攻3力卷軸=200萬、2攻1力卷軸=80萬。
市價：5攻無潛=400萬、5攻有潛=800萬、7攻無潛=600萬、7攻有潛=1100萬、10攻無潛=1200萬、10攻有潛=2000萬。

策略：[5攻3力, 2攻1力, 5攻3力]，不加槌，製作 10 顆。

預期：
- 每顆成本 = 280 + 200 + 80 + 200 = 760 萬
- 機率（近似）：5攻 ≈9.0%，7攻 ≈5.4%，廢品 ≈85.6%
- 期望市值 ≈ 0.09 × (0.9×400 + 0.1×800) + 0.054 × (0.9×600 + 0.1×1100) = 0.09×440 + 0.054×650 ≈ 39.6 + 35.1 = 74.7 萬
- 期望利潤 ≈ 74.7 − 760 = **−685 萬/顆**（高虧損，說明低機率高期望值的策略需要中高攻才回本）

- [ ] **Step 2：情境測試 B — 單顆決策**

設定同上，加入：10攻無潛=1200萬、10攻有潛=2000萬。

心臟狀態：槽1「5攻3力」✅、槽2「2攻1力」❌、槽3 未用、有潛能。

預期：
- 目前 ATK = 5，市值 = 800萬（5攻有潛）
- 已花費 = 280 + 200 + 80 = 560萬
- 損益 = +240萬

選「2攻1力（60%）」→ EV = 60% × (1100−800) − 80 = 100 萬 → **建議點！**
選「5攻3力（10%）」→ EV = 10% × (2000−800) − 200 = 120−200 = **−80萬** → **不建議**

- [ ] **Step 3：測試 localStorage 持久化**

填入各項成本後重新整理頁面，確認數值保留。

- [ ] **Step 4：最終 Commit**

```bash
git add -A
git commit -m "feat: complete golden heart factory tab implementation"
```
