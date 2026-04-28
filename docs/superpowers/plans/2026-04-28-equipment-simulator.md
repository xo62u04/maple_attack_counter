# 楓星裝備模擬器 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在現有楓星攻擊力計算機加入「裝備模擬器」Tab，支援 25 個裝備槽（本體 + 衝捲 + 潛能 3 行）、職業技能與隊伍 BUFF、DPS/MDPS 計算、攻屬比分析及 localStorage 存檔，並在 Tab 1 同步加入隊伍 BUFF。

**Architecture:** Vue 3 CDN（無 build pipeline），裝備邏輯抽出為 `equip.js` composable，主頁面 `index.html` 加 Tab 切換，`app.js` 橋接兩 Tab 共用狀態（職業選擇、partyBuffs 清單）。`data.json` 新增各職業技能預設值與 partyBuffs 清單。

**Tech Stack:** Vue 3 CDN（Composition API）、原生 CSS Variables、localStorage、data.json（fetch）

---

## 檔案對應

| 檔案 | 操作 | 責任 |
|------|------|------|
| `data.json` | 修改 | 各職業加 `skills[]`；頂層加 `partyBuffs[]` |
| `equip.js` | 新建 | 裝備模擬器所有狀態、計算、存檔邏輯 |
| `index.html` | 修改 | Tab 切換 UI + 裝備模擬器 HTML 區塊 + Tab 1 BUFF 區塊 |
| `app.js` | 修改 | 引入 equip composable；Tab 1 加 partyBuffs 狀態與計算 |
| `style.css` | 修改 | 裝備模擬器 CSS、Tab bar、BUFF 清單樣式 |

---

## Task 1：data.json — 新增職業技能與隊伍 BUFF

**Files:**
- Modify: `data.json`

- [ ] **Step 1：確認現有 data.json 結構**

讀取 `data.json`，確認每個 job 物件的欄位（id, name, group, mainStat, subStat, attackType, weapons）。

- [ ] **Step 2：為每個職業新增 `skills` 陣列**

對以下職業在 job 物件中加入 `"skills"` 欄位。未列出的職業加空陣列 `"skills": []`。

```json
// 英雄 (hero)
"skills": [
  { "name": "激勵 (Rage)", "type": "atkFlat", "value": 20, "enabled": true }
]

// 聖騎士 (paladin)
"skills": [
  { "name": "激勵 (Rage)", "type": "atkFlat", "value": 20, "enabled": true }
]

// 黑騎士 (darkKnight)
"skills": [
  { "name": "守護者祝福 (Beholder)", "type": "atkFlat", "value": 15, "enabled": true }
]

// 箭神 (bowmaster)
"skills": [
  { "name": "會心之眼 (Sharp Eyes)", "type": "critRate", "value": 30, "enabled": true },
  { "name": "會心之眼 爆傷", "type": "critDmg", "value": 30, "enabled": true }
]

// 神射手 (marksman)
"skills": [
  { "name": "會心之眼 (Sharp Eyes)", "type": "critRate", "value": 30, "enabled": true },
  { "name": "會心之眼 爆傷", "type": "critDmg", "value": 30, "enabled": true }
]

// 煉獄巫師 (battleMage)
"skills": [
  { "name": "黑暗光環 (Dark Aura)", "type": "atkPct", "value": 20, "enabled": true }
]

// 幻影 (phantom)
"skills": [
  { "name": "會心之眼（複製）", "type": "critRate", "value": 30, "enabled": true },
  { "name": "會心之眼 爆傷（複製）", "type": "critDmg", "value": 30, "enabled": true }
]

// 其餘職業（英雄傳說、末日反抗軍、惡魔、精靈、劍豪、陰陽師等）
"skills": []
```

所有 4 轉職業共用楓葉戰士，不在 skills 裡，改放 partyBuffs。

- [ ] **Step 3：新增頂層 `partyBuffs` 陣列**

在 data.json 最外層（與 `"jobs"` 平級）新增：

```json
"partyBuffs": [
  {
    "id": "sharpEyes",
    "name": "會心之眼",
    "source": "箭神 / 神射手",
    "effects": [
      { "type": "critRate", "value": 30 },
      { "type": "critDmg", "value": 30 }
    ]
  },
  {
    "id": "rage",
    "name": "激勵 (Rage)",
    "source": "英雄",
    "effects": [{ "type": "atkFlat", "value": 20 }]
  },
  {
    "id": "advBlessing",
    "name": "進階祝福",
    "source": "主教",
    "effects": [{ "type": "atkFlat", "value": 30 }]
  },
  {
    "id": "darkAura",
    "name": "黑暗光環",
    "source": "煉獄巫師",
    "effects": [{ "type": "atkPct", "value": 20 }]
  },
  {
    "id": "battleMageRope",
    "name": "三繩技能",
    "source": "煉獄巫師",
    "effects": [{ "type": "atkFlat", "value": 0 }]
  },
  {
    "id": "mapleWarrior",
    "name": "楓葉戰士",
    "source": "多職業 4 轉",
    "effects": [{ "type": "allStatPct", "value": 15 }]
  },
  {
    "id": "finalSpeed",
    "name": "最終極速",
    "source": "待確認",
    "effects": [{ "type": "hitsPerSecBonus", "value": 0 }]
  }
]
```

- [ ] **Step 4：驗證 JSON 格式正確**

```bash
node -e "JSON.parse(require('fs').readFileSync('data.json','utf8')); console.log('OK')"
```

Expected: `OK`

- [ ] **Step 5：Commit**

```bash
git add data.json
git commit -m "feat(data): add job skills and partyBuffs to data.json"
```

---

## Task 2：equip.js — 裝備模擬器 Composable

**Files:**
- Create: `equip.js`

這個檔案 export 一個 `useEquip(jobsRef, partyBuffsRef)` 函式，接收外部傳入的 jobs 和 partyBuffs（來自 app.js 的 fetch 結果），回傳所有裝備模擬器需要的響應式狀態與方法。

- [ ] **Step 1：建立 equip.js 骨架與 25 個裝備槽定義**

```js
// equip.js
const { ref, computed } = Vue

const SLOT_DEFS = [
  // 武器類
  { id: 'weapon',    name: '武器',       group: 'weapon' },
  { id: 'secondary', name: '副武器',     group: 'weapon' },
  // 防具類
  { id: 'hat',       name: '頭盔',       group: 'armor' },
  { id: 'top',       name: '上衣',       group: 'armor' },
  { id: 'bottom',    name: '下衣',       group: 'armor' },
  { id: 'glove',     name: '手套',       group: 'armor' },
  { id: 'shoe',      name: '鞋子',       group: 'armor' },
  { id: 'cape',      name: '披風',       group: 'armor' },
  { id: 'shoulder',  name: '肩膀',       group: 'armor' },
  { id: 'belt',      name: '腰帶',       group: 'armor' },
  { id: 'heart',     name: '機器人心臟', group: 'armor' },
  // 飾品類
  { id: 'face',      name: '臉部裝飾',   group: 'accessory' },
  { id: 'eye',       name: '眼部裝飾',   group: 'accessory' },
  { id: 'earring',   name: '耳環',       group: 'accessory' },
  { id: 'pendant',   name: '吊墜',       group: 'accessory' },
  { id: 'pocket',    name: '口袋道具',   group: 'accessory' },
  { id: 'title',     name: '稱號',       group: 'accessory' },
  { id: 'ring1',     name: '戒指 1',     group: 'accessory' },
  { id: 'ring2',     name: '戒指 2',     group: 'accessory' },
  { id: 'ring3',     name: '戒指 3',     group: 'accessory' },
  { id: 'ring4',     name: '戒指 4',     group: 'accessory' },
  // 特殊類
  { id: 'energy',    name: '能源',       group: 'special' },
  { id: 'pet1',      name: '寵物裝備 1', group: 'special' },
  { id: 'pet2',      name: '寵物裝備 2', group: 'special' },
  { id: 'pet3',      name: '寵物裝備 3', group: 'special' },
]

const POTENTIAL_TYPES = [
  { value: 'none',         label: '（無）' },
  { value: 'mainStatPct',  label: '%主屬性' },
  { value: 'subStatPct',   label: '%副屬性' },
  { value: 'allStatPct',   label: '%全屬性' },
  { value: 'mainStatFlat', label: '主屬性+' },
  { value: 'subStatFlat',  label: '副屬性+' },
  { value: 'allStatFlat',  label: '全屬性+' },
  { value: 'atkFlat',      label: 'ATK+（平）' },
  { value: 'atkPct',       label: '%ATK' },
  { value: 'critRate',     label: '爆擊率+' },
  { value: 'critDmg',      label: '爆擊傷害+' },
  { value: 'bossDmg',      label: 'BOSS傷害+' },
  { value: 'totalDmg',     label: '總傷害+' },
  { value: 'ignoreDef',    label: '無視防禦+' },
  { value: 'hpFlat',       label: 'HP+' },
  { value: 'hpPct',        label: '%HP' },
]

function makeSlot(def) {
  return {
    id: def.id,
    name: def.name,
    group: def.group,
    note: '',
    base: { mainStat: 0, subStat: 0, atk: 0, allStat: 0 },
    scroll: { count: 0, perScroll: 0, stat: def.group === 'weapon' ? 'atk' : 'mainStat' },
    potential: [
      { type: 'none', value: 0 },
      { type: 'none', value: 0 },
      { type: 'none', value: 0 },
    ]
  }
}

function useEquip(jobsRef, partyBuffsRef) {
  // 裸裝 & 技能設定
  const baseStats = ref({ mainStat: 0, subStat: 0, atk: 0 })
  const equipSettings = ref({
    skillPct: 100, mastery: 60,
    critRate: 0, minCritBonus: 20, maxCritBonus: 50,
    bossDefPct: 0, monsterDefPct: 10, ignoreDefPct: 0,
    hitsPerSec: 1
  })

  // 裝備槽
  const slots = ref(Object.fromEntries(SLOT_DEFS.map(d => [d.id, makeSlot(d)])))
  const selectedSlotId = ref('weapon')
  const selectedSlot = computed(() => slots.value[selectedSlotId.value])

  // 職業技能（從 jobsRef 讀取，使用者可修改）
  const jobSkills = ref([])   // [{ name, type, value, enabled }]

  // 隊伍 BUFF（從 partyBuffsRef 讀取，使用者可修改）
  const activeBuffs = ref([]) // [{ id, name, source, enabled, effects: [{ type, value }] }]

  return {
    SLOT_DEFS, POTENTIAL_TYPES, makeSlot,
    baseStats, equipSettings,
    slots, selectedSlotId, selectedSlot,
    jobSkills, activeBuffs,
  }
}
```

- [ ] **Step 2：Commit 骨架**

```bash
git add equip.js
git commit -m "feat(equip): add equip.js skeleton with slot definitions"
```

- [ ] **Step 3：實作屬性合計 computed**

在 `useEquip` 內加入 `totals` computed：

```js
const totals = computed(() => {
  let flatMain = 0, flatSub = 0, flatAtk = 0, allStat = 0
  let pctMain = 0, pctSub = 0, pctAtk = 0
  let critRate = 0, critDmg = 0
  let bossDmg = 0, totalDmg = 0
  let ignoreDefFactors = []  // 累乘用

  // 裝備槽
  for (const slot of Object.values(slots.value)) {
    flatMain += Number(slot.base.mainStat) || 0
    flatSub  += Number(slot.base.subStat)  || 0
    flatAtk  += Number(slot.base.atk)      || 0
    allStat  += Number(slot.base.allStat)  || 0

    const scrollVal = (Number(slot.scroll.count) || 0) * (Number(slot.scroll.perScroll) || 0)
    if (slot.scroll.stat === 'atk') flatAtk  += scrollVal
    else                             flatMain += scrollVal

    for (const pot of slot.potential) {
      const v = Number(pot.value) || 0
      if (pot.type === 'mainStatPct')  pctMain  += v
      else if (pot.type === 'subStatPct')   pctSub   += v
      else if (pot.type === 'allStatPct')   { pctMain += v; pctSub += v }
      else if (pot.type === 'mainStatFlat') flatMain += v
      else if (pot.type === 'subStatFlat')  flatSub  += v
      else if (pot.type === 'allStatFlat')  { flatMain += v; flatSub += v }
      else if (pot.type === 'atkFlat')      flatAtk  += v
      else if (pot.type === 'atkPct')       pctAtk   += v
      else if (pot.type === 'critRate')     critRate += v
      else if (pot.type === 'critDmg')      critDmg  += v
      else if (pot.type === 'bossDmg')      bossDmg  += v
      else if (pot.type === 'totalDmg')     totalDmg += v
      else if (pot.type === 'ignoreDef')    ignoreDefFactors.push(v)
    }
  }

  // 全屬性基底
  flatMain += allStat
  flatSub  += allStat

  // 職業技能
  for (const sk of jobSkills.value) {
    if (!sk.enabled) continue
    const v = Number(sk.value) || 0
    applyEffect(sk.type, v, { pctMain, pctSub, pctAtk, flatMain, flatSub, flatAtk, critRate, critDmg, bossDmg, totalDmg, ignoreDefFactors })
  }

  // 隊伍 BUFF
  for (const buf of activeBuffs.value) {
    if (!buf.enabled) continue
    for (const eff of buf.effects) {
      const v = Number(eff.value) || 0
      if (eff.type === 'atkFlat')      flatAtk  += v
      else if (eff.type === 'atkPct')  pctAtk   += v
      else if (eff.type === 'critRate') critRate += v
      else if (eff.type === 'critDmg') critDmg  += v
      else if (eff.type === 'allStatPct') { pctMain += v; pctSub += v }
      else if (eff.type === 'bossDmg') bossDmg  += v
      else if (eff.type === 'totalDmg') totalDmg += v
    }
  }

  // 無視防禦累乘
  const ignoreDefTotal = ignoreDefFactors.length
    ? (1 - ignoreDefFactors.reduce((acc, v) => acc * (1 - v / 100), 1)) * 100
    : (Number(equipSettings.value.ignoreDefPct) || 0)

  return { flatMain, flatSub, flatAtk, pctMain, pctSub, pctAtk, critRate, critDmg, bossDmg, totalDmg, ignoreDefTotal }
})
```

> 注意：`applyEffect` helper 將職業技能的 type 對應加到各合計，邏輯同 BUFF loop，抽成小函式避免重複。

- [ ] **Step 4：實作傷害 & DPS computed**

```js
const dmgResult = computed(() => {
  const t = totals.value
  const s = equipSettings.value
  const job = jobsRef.value.find(j => j.id === /* 由外部傳入的 selectedJobId */ selectedJobIdRef.value)
  const coeff = job ? (job.weapons[0]?.coefficient || 1) : 1

  const finalMain = (Number(baseStats.value.mainStat) || 0) + t.flatMain
  const finalSub  = (Number(baseStats.value.subStat)  || 0) + t.flatSub
  const finalAtk  = (Number(baseStats.value.atk)      || 0) + t.flatAtk
  const finalAtkPct = t.pctAtk

  const step1 = 4 * finalMain * (1 + t.pctMain / 100) + finalSub * (1 + t.pctSub / 100)
  const step2 = step1 * coeff
  const step3 = finalAtk * (1 + finalAtkPct / 100)
  const step4 = step2 * step3 * 0.01 * (Number(s.skillPct) || 0) / 100

  const step5Boss = 1 + (t.totalDmg + t.bossDmg) / 100
  const step5Mob  = 1 + t.totalDmg / 100
  const step6Boss = 1 - (Number(s.bossDefPct) || 0) / 100 * (1 - t.ignoreDefTotal / 100)
  const step6Mob  = 1 - (Number(s.monsterDefPct) || 0) / 100 * (1 - t.ignoreDefTotal / 100)

  const maxBoss = step4 * step5Boss * step6Boss
  const maxMob  = step4 * step5Mob  * step6Mob
  const minBoss = maxBoss * (Number(s.mastery) || 0) / 100
  const minMob  = maxMob  * (Number(s.mastery) || 0) / 100

  const totalCritDmgMax = (Number(s.maxCritBonus) || 0) + t.critDmg
  const critMult = 1 + (Number(s.critRate) + t.critRate) / 100 * ((Number(s.minCritBonus) || 0) + totalCritDmgMax) / 200

  const avgBoss = (maxBoss + minBoss) / 2 * critMult
  const avgMob  = (maxMob  + minMob)  / 2 * critMult

  const hps = Number(s.hitsPerSec) || 0
  return {
    maxBoss, minBoss, avgBoss,
    maxMob,  minMob,  avgMob,
    dpsBoss: avgBoss * hps,  mdpsBoss: avgBoss * hps * 60,
    dpsMob:  avgMob  * hps,  mdpsMob:  avgMob  * hps * 60,
    finalMain, finalSub, finalAtk, finalAtkPct,
    step1, coeff,
  }
})
```

> `selectedJobIdRef` 由 `useEquip(jobsRef, partyBuffsRef, selectedJobIdRef)` 第三個參數傳入。

- [ ] **Step 5：實作攻屬比 computed**

```js
const attackStatRatio = computed(() => {
  const r = dmgResult.value
  if (!r.finalMain || !r.step1 || !r.finalAtk) return 0
  // 1% 主屬性 = 以下等效 ATK 數值
  return r.finalAtk * (1 + r.finalAtkPct / 100) * 0.04 * r.finalMain / r.step1
})

const upgradeEfficiency = computed(() => {
  const r = dmgResult.value
  const t = totals.value
  const mainPctGain  = r.step1 > 0 ? 0.04 * r.finalMain / r.step1 * 100 : 0
  const atkPctGain   = r.finalAtkPct > -100 ? 100 / (100 + r.finalAtkPct) : 0
  const bossDmgGain  = t.bossDmg > -100 ? 100 / (100 + t.bossDmg) : 0
  const totalDmgGain = t.totalDmg > -100 ? 100 / (100 + t.totalDmg) : 0
  return [
    { label: '+1% 主屬性', gain: mainPctGain },
    { label: '+1% ATK',    gain: atkPctGain },
    { label: '+1% BOSS傷', gain: bossDmgGain },
    { label: '+1% 總傷',   gain: totalDmgGain },
  ].sort((a, b) => b.gain - a.gain)
})
```

- [ ] **Step 6：實作存檔與讀檔**

```js
const EQUIP_STORAGE_KEY = 'maple_calc_equipment'
const MAX_EQUIP_SAVES = 20

const equipSets = ref([])
const equipSaveName = ref('')
const selectedEquipSave = ref('')
const equipSaveMsg = ref('')

function loadEquipSets() {
  try {
    const raw = localStorage.getItem(EQUIP_STORAGE_KEY)
    equipSets.value = raw ? JSON.parse(raw) : []
  } catch { equipSets.value = [] }
}

function persistEquipSets() {
  try {
    localStorage.setItem(EQUIP_STORAGE_KEY, JSON.stringify(equipSets.value))
  } catch { equipSaveMsg.value = '⚠️ 儲存失敗（空間不足）' }
}

function saveEquipSet() {
  const name = equipSaveName.value.trim()
  if (!name) return
  if (equipSets.value.length >= MAX_EQUIP_SAVES && !equipSets.value.find(e => e.name === name)) {
    equipSaveMsg.value = '⚠️ 已達 20 筆上限'
    return
  }
  const entry = {
    name,
    baseStats: { ...baseStats.value },
    equipSettings: { ...equipSettings.value },
    slots: JSON.parse(JSON.stringify(slots.value)),
    jobSkills: JSON.parse(JSON.stringify(jobSkills.value)),
    activeBuffs: JSON.parse(JSON.stringify(activeBuffs.value)),
  }
  const idx = equipSets.value.findIndex(e => e.name === name)
  if (idx >= 0) equipSets.value[idx] = entry
  else equipSets.value.push(entry)
  persistEquipSets()
  equipSaveMsg.value = `✅ 已儲存「${name}」`
  setTimeout(() => { equipSaveMsg.value = '' }, 2000)
}

function loadEquipSet() {
  const key = selectedEquipSave.value
  if (!key) return
  const entry = equipSets.value.find(e => e.name === key)
  if (!entry) return
  Object.assign(baseStats.value, entry.baseStats)
  Object.assign(equipSettings.value, entry.equipSettings)
  slots.value = entry.slots
  jobSkills.value = entry.jobSkills
  activeBuffs.value = entry.activeBuffs
  equipSaveName.value = entry.name
}

function deleteEquipSet() {
  const key = selectedEquipSave.value
  if (!key) return
  equipSets.value = equipSets.value.filter(e => e.name !== key)
  persistEquipSets()
  selectedEquipSave.value = ''
  equipSaveMsg.value = `🗑️ 已刪除「${key}」`
  setTimeout(() => { equipSaveMsg.value = '' }, 2000)
}
```

- [ ] **Step 7：實作從 jobsRef 初始化職業技能的函式**

```js
function initJobSkills(jobId) {
  const job = jobsRef.value.find(j => j.id === jobId)
  jobSkills.value = job?.skills
    ? job.skills.map(s => ({ ...s }))
    : []
}

function initPartyBuffs() {
  activeBuffs.value = (partyBuffsRef.value || []).map(b => ({
    ...b,
    enabled: false,
    effects: b.effects.map(e => ({ ...e }))
  }))
}
```

- [ ] **Step 8：實作「從攻擊力計算機匯入」函式**

```js
// tab1Stats 格式：{ STR, DEX, INT, LUK, atk, atkPct, skillPct, mastery, critRate, minCritBonus, maxCritBonus, bossDefPct, monsterDefPct, ignoreDefPct }
function importFromTab1(tab1Stats, mainStatKey) {
  baseStats.value.mainStat = Number(tab1Stats[mainStatKey]) || 0
  baseStats.value.subStat  = 0   // 副屬性裸裝留 0，裝備填入
  baseStats.value.atk      = 0
  equipSettings.value.skillPct      = tab1Stats.skillPct      ?? 100
  equipSettings.value.mastery       = tab1Stats.mastery        ?? 60
  equipSettings.value.critRate      = tab1Stats.critRate       ?? 0
  equipSettings.value.minCritBonus  = tab1Stats.minCritBonus   ?? 20
  equipSettings.value.maxCritBonus  = tab1Stats.maxCritBonus   ?? 50
  equipSettings.value.bossDefPct    = tab1Stats.bossDefPct     ?? 0
  equipSettings.value.monsterDefPct = tab1Stats.monsterDefPct  ?? 10
  equipSettings.value.ignoreDefPct  = tab1Stats.ignoreDefPct   ?? 0
  // 裝備槽不清空，讓使用者自己決定
}
```

- [ ] **Step 9：export 所有需要暴露的值與方法，Commit**

```js
  return {
    SLOT_DEFS, POTENTIAL_TYPES,
    baseStats, equipSettings,
    slots, selectedSlotId, selectedSlot,
    jobSkills, activeBuffs,
    totals, dmgResult, attackStatRatio, upgradeEfficiency,
    equipSets, equipSaveName, selectedEquipSave, equipSaveMsg,
    loadEquipSets, saveEquipSet, loadEquipSet, deleteEquipSet,
    initJobSkills, initPartyBuffs, importFromTab1,
  }
```

```bash
git add equip.js
git commit -m "feat(equip): implement equip composable with totals, DPS, ratio, save/load"
```

---

## Task 3：app.js — 整合 equip composable + Tab 1 加隊伍 BUFF

**Files:**
- Modify: `app.js`

- [ ] **Step 1：在 onMounted 內從 data.json 讀取 partyBuffs**

在現有 `onMounted` 的 fetch block 內加：

```js
// 現有的：
jobs.value = data.jobs
// 新增：
partyBuffs.value = data.partyBuffs || []
```

在 `setup()` 最上方 `jobs` 旁加：

```js
const partyBuffs = ref([])
```

- [ ] **Step 2：初始化 equip composable**

在 `setup()` 的 `jobs` 宣告後加：

```js
const equip = useEquip(jobs, partyBuffs, selectedJobId)
```

在 `onMounted` 的 `loadFromUrl()` 後加：

```js
equip.loadEquipSets()
equip.initPartyBuffs()
```

在現有 `onJobChange()` 函式內最後加：

```js
equip.initJobSkills(selectedJobId.value)
```

- [ ] **Step 3：Tab 1 加入隊伍 BUFF 狀態**

Tab 1 的隊伍 BUFF 使用與裝備模擬器相同的 `partyBuffs` 來源，但有獨立的啟用狀態。在 `setup()` 加：

```js
// Tab 1 獨立的 BUFF 啟用狀態（僅 enabled + 每個 effect 的 value 可改）
const tab1Buffs = ref([])   // 格式同 equip.activeBuffs

function initTab1Buffs() {
  tab1Buffs.value = (partyBuffs.value || []).map(b => ({
    ...b,
    enabled: false,
    effects: b.effects.map(e => ({ ...e }))
  }))
}
```

在 `onMounted` 的 `initPartyBuffs()` 後加 `initTab1Buffs()`。

- [ ] **Step 4：Tab 1 的 BUFF 計算加入現有 computed**

修改現有 `step5Boss` / `step5Mob` / `step6Boss` 等 computed，加入 `tab1Buffs` 的貢獻。在現有 `step3` computed 修改：

```js
const tab1BuffTotals = computed(() => {
  let atkFlat = 0, atkPct = 0, critRate = 0, critDmg = 0, allStatPct = 0, bossDmg = 0
  for (const buf of tab1Buffs.value) {
    if (!buf.enabled) continue
    for (const eff of buf.effects) {
      const v = Number(eff.value) || 0
      if (eff.type === 'atkFlat')      atkFlat   += v
      else if (eff.type === 'atkPct')  atkPct    += v
      else if (eff.type === 'critRate') critRate  += v
      else if (eff.type === 'critDmg') critDmg   += v
      else if (eff.type === 'allStatPct') allStatPct += v
      else if (eff.type === 'bossDmg') bossDmg   += v
    }
  }
  return { atkFlat, atkPct, critRate, critDmg, allStatPct, bossDmg }
})
```

將 `tab1BuffTotals.value.atkFlat` 加入 `step3`（ATK 加成），`atkPct` 加入 ATK% 計算，`critRate` / `critDmg` 加入 `critMult`，`bossDmg` 加入 `step5Boss`。

- [ ] **Step 5：更新 Tab 1 的 saveCharacter / loadCharacter 包含 tab1Buffs**

在 `saveCharacter` 的 `entry` 物件中加：

```js
tab1Buffs: JSON.parse(JSON.stringify(tab1Buffs.value))
```

在 `loadCharacter` 中加：

```js
if (entry.tab1Buffs) tab1Buffs.value = entry.tab1Buffs
else initTab1Buffs()
```

- [ ] **Step 6：匯出到 return，Commit**

```js
// 在 return 中新增
partyBuffs, tab1Buffs, tab1BuffTotals, initTab1Buffs,
equip,   // 整個 composable 一起 expose 給 template
```

```bash
git add app.js
git commit -m "feat(app): integrate equip composable and add party buffs to Tab1"
```

---

## Task 4：index.html — Tab 切換 + Tab 1 BUFF 區塊

**Files:**
- Modify: `index.html`

- [ ] **Step 1：加入 Tab bar**

將現有 `<header>` 的 `<h1>` 旁加 Tab 切換，在 `setup()` 加 `const activeTab = ref('calc')`：

```html
<!-- 在 .site-header 內，header-actions 前 -->
<div class="tab-bar">
  <button class="tab-btn" :class="{ active: activeTab === 'calc' }" @click="activeTab = 'calc'">
    ⚔️ 攻擊力計算機
  </button>
  <button class="tab-btn" :class="{ active: activeTab === 'equip' }" @click="activeTab = 'equip'">
    🎒 裝備模擬器
  </button>
</div>
```

在 `<main>` 上加 `v-if="activeTab === 'calc'"`，新增裝備模擬器區塊 `v-if="activeTab === 'equip'"`。

- [ ] **Step 2：Tab 1 左欄底部加 BUFF 勾選區塊**

在現有左欄的 `<div class="divider"></div>` 之前（存檔區上方）加：

```html
<div class="divider"></div>
<div class="section-title">隊伍 BUFF</div>
<div class="buff-list">
  <div v-for="buf in tab1Buffs" :key="buf.id" class="buff-item">
    <label class="buff-label">
      <input type="checkbox" v-model="buf.enabled" />
      <span class="buff-name">{{ buf.name }}</span>
      <span class="buff-source">{{ buf.source }}</span>
    </label>
    <div v-if="buf.enabled" class="buff-effects">
      <div v-for="eff in buf.effects" :key="eff.type" class="buff-effect-row">
        <span class="buff-effect-type">{{ eff.type }}</span>
        <input type="number" v-model.number="eff.value" class="buff-effect-val" />
      </div>
    </div>
  </div>
</div>
```

- [ ] **Step 3：建立裝備模擬器主區塊骨架**

```html
<main v-if="activeTab === 'equip'" class="equip-main">
  <!-- 左欄：裝備槽清單 + 設定 + 存檔 -->
  <section class="equip-sidebar">
    <!-- Step 4 實作 -->
  </section>

  <!-- 右欄：詳細輸入 + 統計 -->
  <section class="equip-content">
    <!-- Step 5 實作 -->
  </section>
</main>
```

- [ ] **Step 4：左欄 — 裝備槽清單**

```html
<div class="equip-import-bar">
  <button class="btn btn-import" @click="equip.importFromTab1(stats, selectedJob?.mainStat || 'STR')">
    📥 從攻擊力計算機匯入
  </button>
</div>

<div class="equip-slot-groups">
  <template v-for="group in ['weapon','armor','accessory','special']" :key="group">
    <div class="slot-group-label">
      {{ { weapon:'⚔️ 武器類', armor:'🛡️ 防具類', accessory:'💍 飾品類', special:'⚙️ 特殊類' }[group] }}
    </div>
    <div
      v-for="def in equip.SLOT_DEFS.filter(d => d.group === group)"
      :key="def.id"
      class="slot-list-item"
      :class="{ active: equip.selectedSlotId.value === def.id }"
      @click="equip.selectedSlotId.value = def.id"
    >
      <span>{{ def.name }}</span>
      <span class="slot-summary">{{ slotSummary(equip.slots.value[def.id]) }}</span>
    </div>
  </template>
</div>

<!-- 裸裝屬性 + 設定 -->
<div class="divider"></div>
<div class="section-title">裸裝屬性</div>
<div class="field-group">
  <label>裸裝主屬性</label>
  <input type="number" v-model.number="equip.baseStats.value.mainStat" min="0" />
</div>
<div class="field-group">
  <label>裸裝副屬性</label>
  <input type="number" v-model.number="equip.baseStats.value.subStat" min="0" />
</div>
<div class="field-group">
  <label>裸裝攻擊力</label>
  <input type="number" v-model.number="equip.baseStats.value.atk" min="0" />
</div>

<div class="divider"></div>
<div class="section-title">技能 & 攻速設定</div>
<!-- 技能%、熟練度、爆擊率、最小/最大爆傷、攻速、防禦設定 — 同 Tab 1 欄位樣式 -->
<div class="field-group">
  <label>技能 %</label>
  <input type="number" v-model.number="equip.equipSettings.value.skillPct" min="0" />
</div>
<div class="field-group">
  <label>熟練度 %</label>
  <input type="number" v-model.number="equip.equipSettings.value.mastery" min="0" max="100" />
</div>
<div class="field-group">
  <label>爆擊率 %</label>
  <input type="number" v-model.number="equip.equipSettings.value.critRate" min="0" max="100" />
</div>
<div class="field-group">
  <label>最小爆傷加成 %</label>
  <input type="number" v-model.number="equip.equipSettings.value.minCritBonus" min="0" />
</div>
<div class="field-group">
  <label>最大爆傷加成 %</label>
  <input type="number" v-model.number="equip.equipSettings.value.maxCritBonus" min="0" />
</div>
<div class="field-group">
  <label>每秒打擊數</label>
  <input type="number" v-model.number="equip.equipSettings.value.hitsPerSec" min="0" step="0.1" />
</div>
<div class="field-group">
  <label>BOSS 防禦率 %</label>
  <input type="number" v-model.number="equip.equipSettings.value.bossDefPct" min="0" max="100" />
</div>
<div class="field-group">
  <label>小怪防禦率 %</label>
  <input type="number" v-model.number="equip.equipSettings.value.monsterDefPct" min="0" max="100" />
</div>
<div class="field-group">
  <label>等效無視防禦 %</label>
  <input type="number" v-model.number="equip.equipSettings.value.ignoreDefPct" min="0" max="100" />
</div>

<!-- 存檔區 -->
<div class="divider"></div>
<div class="save-section">
  <div class="field-group">
    <label>組合名稱</label>
    <input type="text" v-model="equip.equipSaveName.value" placeholder="例：我的黑騎士配置" maxlength="20" />
  </div>
  <div class="save-actions">
    <button class="btn btn-save" @click="equip.saveEquipSet()" :disabled="!equip.equipSaveName.value.trim()">💾 儲存</button>
    <select v-model="equip.selectedEquipSave.value" @change="equip.loadEquipSet()" v-if="equip.equipSets.value.length > 0">
      <option value="">載入組合...</option>
      <option v-for="e in equip.equipSets.value" :key="e.name" :value="e.name">{{ e.name }}</option>
    </select>
    <button class="btn btn-delete" @click="equip.deleteEquipSet()" v-if="equip.selectedEquipSave.value">🗑️</button>
  </div>
  <div v-if="equip.equipSaveMsg.value" class="save-message">{{ equip.equipSaveMsg.value }}</div>
</div>
```

- [ ] **Step 5：右欄 — 選中裝備詳細輸入 + 隊伍 BUFF + 統計 + 效益**

```html
<!-- 選中裝備 -->
<div class="equip-slot-detail" v-if="equip.selectedSlot.value">
  <div class="slot-detail-header">{{ equip.selectedSlot.value.name }}</div>

  <!-- 本體屬性 -->
  <div class="detail-section">
    <div class="detail-section-title">⬜ 本體屬性</div>
    <div class="detail-grid">
      <div class="field-group"><label>主屬性+</label><input type="number" v-model.number="equip.selectedSlot.value.base.mainStat" min="0" /></div>
      <div class="field-group"><label>副屬性+</label><input type="number" v-model.number="equip.selectedSlot.value.base.subStat" min="0" /></div>
      <div class="field-group"><label>ATK / MATK+</label><input type="number" v-model.number="equip.selectedSlot.value.base.atk" min="0" /></div>
      <div class="field-group"><label>全屬性+</label><input type="number" v-model.number="equip.selectedSlot.value.base.allStat" min="0" /></div>
    </div>
  </div>

  <!-- 衝捲 -->
  <div class="detail-section">
    <div class="detail-section-title">📜 衝捲</div>
    <div class="detail-grid">
      <div class="field-group"><label>成功次數</label><input type="number" v-model.number="equip.selectedSlot.value.scroll.count" min="0" /></div>
      <div class="field-group">
        <label>每次獲得</label>
        <div class="input-suffix">
          <input type="number" v-model.number="equip.selectedSlot.value.scroll.perScroll" min="0" />
          <select v-model="equip.selectedSlot.value.scroll.stat" style="width:auto">
            <option value="mainStat">主屬性</option>
            <option value="atk">ATK</option>
          </select>
        </div>
      </div>
    </div>
    <div class="scroll-total">
      合計：<strong>+{{ (equip.selectedSlot.value.scroll.count * equip.selectedSlot.value.scroll.perScroll) || 0 }}</strong>
    </div>
  </div>

  <!-- 潛能 -->
  <div class="detail-section">
    <div class="detail-section-title">✨ 潛能（3 行）</div>
    <div v-for="(pot, i) in equip.selectedSlot.value.potential" :key="i" class="potential-row">
      <select v-model="pot.type" class="potential-type-sel">
        <option v-for="t in equip.POTENTIAL_TYPES" :key="t.value" :value="t.value">{{ t.label }}</option>
      </select>
      <input type="number" v-model.number="pot.value" min="0" class="potential-val" :disabled="pot.type === 'none'" />
    </div>
  </div>
</div>

<!-- 右下：全裝合計 + BUFF + 攻屬比 + DPS -->
<div class="equip-bottom-grid">

  <!-- 屬性合計 -->
  <div class="bottom-panel">
    <div class="panel-title">📊 全裝合計</div>
    <div class="stat-row"><span>主屬性+（平）</span><span class="stat-val">+{{ Math.round(equip.totals.value.flatMain) }}</span></div>
    <div class="stat-row"><span>主屬性+（%）</span><span class="stat-val">+{{ equip.totals.value.pctMain.toFixed(1) }}%</span></div>
    <div class="stat-row"><span>副屬性+（平）</span><span class="stat-val">+{{ Math.round(equip.totals.value.flatSub) }}</span></div>
    <div class="stat-row"><span>副屬性+（%）</span><span class="stat-val">+{{ equip.totals.value.pctSub.toFixed(1) }}%</span></div>
    <div class="stat-row"><span>ATK+（平）</span><span class="stat-val">+{{ Math.round(equip.totals.value.flatAtk) }}</span></div>
    <div class="stat-row"><span>ATK+（%）</span><span class="stat-val">+{{ equip.totals.value.pctAtk.toFixed(1) }}%</span></div>
    <div class="stat-row"><span>爆擊率+</span><span class="stat-val">+{{ equip.totals.value.critRate.toFixed(1) }}%</span></div>
    <div class="stat-row"><span>爆擊傷害+</span><span class="stat-val">+{{ equip.totals.value.critDmg.toFixed(1) }}%</span></div>
    <div class="stat-row"><span>BOSS傷害+</span><span class="stat-val">+{{ equip.totals.value.bossDmg.toFixed(1) }}%</span></div>
    <div class="stat-row"><span>總傷害+</span><span class="stat-val">+{{ equip.totals.value.totalDmg.toFixed(1) }}%</span></div>
    <div class="stat-row"><span>無視防禦</span><span class="stat-val">{{ equip.totals.value.ignoreDefTotal.toFixed(1) }}%</span></div>
  </div>

  <!-- 職業技能 + 隊伍 BUFF -->
  <div class="bottom-panel">
    <div class="panel-title">⚡ 技能 & 隊伍 BUFF</div>
    <div class="panel-sub-title">職業技能（可修改）</div>
    <div v-for="sk in equip.jobSkills.value" :key="sk.name" class="buff-item">
      <label><input type="checkbox" v-model="sk.enabled" /> {{ sk.name }}</label>
      <input type="number" v-model.number="sk.value" class="buff-val" v-if="sk.enabled" />
    </div>
    <div class="panel-sub-title" style="margin-top:8px">隊伍 BUFF</div>
    <div v-for="buf in equip.activeBuffs.value" :key="buf.id" class="buff-item">
      <label><input type="checkbox" v-model="buf.enabled" /> {{ buf.name }} <span class="buff-source">{{ buf.source }}</span></label>
      <div v-if="buf.enabled" class="buff-effects">
        <div v-for="eff in buf.effects" :key="eff.type" class="buff-effect-row">
          <span class="buff-type-label">{{ eff.type }}</span>
          <input type="number" v-model.number="eff.value" class="buff-val" />
        </div>
      </div>
    </div>
  </div>

  <!-- 攻屬比 + DPS -->
  <div class="bottom-panel">
    <div class="panel-title">📈 攻屬比 & DPS</div>
    <div class="ratio-box">
      <div class="ratio-label">1% 主屬性 等效 ATK</div>
      <div class="ratio-value">{{ Math.round(equip.attackStatRatio.value) }}</div>
    </div>
    <div class="panel-sub-title" style="margin-top:8px">效益排名（每 +1%）</div>
    <div v-for="(item, i) in equip.upgradeEfficiency.value" :key="item.label" class="efficiency-row" :class="{ top: i === 0 }">
      <span>{{ i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉' }} {{ item.label }}</span>
      <span>+{{ item.gain.toFixed(3) }}%</span>
    </div>
    <div class="divider" style="margin:10px 0"></div>
    <div class="panel-sub-title">傷害輸出</div>
    <div class="dps-grid">
      <div></div><div class="dps-col-head boss-col">⚔️ 打王</div><div class="dps-col-head mob-col">🐾 小怪</div>
      <div class="dps-row-label">平均單擊</div>
      <div class="dps-val">{{ fmt(equip.dmgResult.value.avgBoss) }}</div>
      <div class="dps-val">{{ fmt(equip.dmgResult.value.avgMob) }}</div>
      <div class="dps-row-label">DPS</div>
      <div class="dps-val">{{ fmt(equip.dmgResult.value.dpsBoss) }}</div>
      <div class="dps-val">{{ fmt(equip.dmgResult.value.dpsMob) }}</div>
      <div class="dps-row-label final-row">MDPS</div>
      <div class="dps-val final-val">{{ fmtM(equip.dmgResult.value.mdpsBoss) }}</div>
      <div class="dps-val final-val">{{ fmtM(equip.dmgResult.value.mdpsMob) }}</div>
    </div>
    <div style="margin-top:8px">
      <button class="btn btn-share" @click="exportToTab1()">📤 匯出到攻擊力計算機</button>
    </div>
  </div>
</div>
```

- [ ] **Step 6：實作 `slotSummary`、`exportToTab1`、`fmt`、`fmtM` helper**

在 `app.js` 的 `return` 前加：

```js
function slotSummary(slot) {
  if (!slot) return ''
  const parts = []
  const totalAtk = (slot.base.atk || 0) + (slot.scroll.stat === 'atk' ? (slot.scroll.count * slot.scroll.perScroll) : 0)
  const totalMain = (slot.base.mainStat || 0) + (slot.scroll.stat === 'mainStat' ? (slot.scroll.count * slot.scroll.perScroll) : 0)
  if (totalAtk) parts.push(`ATK+${totalAtk}`)
  if (totalMain) parts.push(`主+${totalMain}`)
  const pctLines = slot.potential.filter(p => p.type !== 'none' && p.value)
  if (pctLines.length) parts.push(`潛×${pctLines.length}`)
  return parts.join(' ')
}

function exportToTab1() {
  const r = equip.dmgResult.value
  const t = equip.totals.value
  stats.value.STR = r.finalMain   // 只在 STR 職業有意義，其他職業類似
  stats.value.atk = r.finalAtk
  stats.value.atkPct = r.finalAtkPct
  stats.value.totalDmgPct = t.totalDmg
  stats.value.bossPct = t.bossDmg
  stats.value.critRate = equip.equipSettings.value.critRate + t.critRate
  stats.value.maxCritBonus = equip.equipSettings.value.maxCritBonus + t.critDmg
  activeTab.value = 'calc'
}

function fmtM(n) {
  if (n >= 1e8) return (n / 1e8).toFixed(2) + ' 億'
  if (n >= 1e4) return (n / 1e4).toFixed(1) + ' 萬'
  return Math.round(n).toLocaleString('zh-TW')
}
```

- [ ] **Step 7：Commit**

```bash
git add index.html app.js
git commit -m "feat(ui): add Tab switching, equip simulator HTML, and Tab1 party buffs"
```

---

## Task 5：style.css — 裝備模擬器樣式

**Files:**
- Modify: `style.css`

- [ ] **Step 1：加入 Tab bar 樣式**

```css
/* ── Tab Bar ── */
.tab-bar {
  display: flex;
  gap: 0;
  background: var(--bg-panel);
}

.tab-btn {
  padding: 8px 20px;
  background: var(--bg-input);
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--text-dim);
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  transition: all 0.2s;
}

.tab-btn.active {
  color: var(--accent);
  border-bottom-color: var(--accent);
  background: var(--bg-panel);
}

.tab-btn:hover:not(.active) {
  color: var(--text);
  background: var(--bg-panel);
}
```

- [ ] **Step 2：加入裝備模擬器主佈局**

```css
/* ── 裝備模擬器主佈局 ── */
.equip-main {
  display: grid;
  grid-template-columns: 260px 1fr;
  min-height: calc(100vh - 80px);
}

.equip-sidebar {
  background: var(--bg-panel);
  border-right: 1px solid var(--border);
  padding: 16px;
  overflow-y: auto;
  font-size: 13px;
}

.equip-content {
  background: var(--bg);
  overflow-y: auto;
  padding: 16px;
}
```

- [ ] **Step 3：裝備槽清單樣式**

```css
.slot-group-label {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--accent-dim);
  font-weight: 700;
  margin: 10px 0 4px;
}

.slot-list-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 5px 8px;
  border-radius: 4px;
  cursor: pointer;
  border: 1px solid transparent;
  margin-bottom: 2px;
  transition: all 0.15s;
  font-size: 12px;
}

.slot-list-item:hover { background: var(--bg-input); }
.slot-list-item.active {
  background: var(--bg-input);
  border-color: var(--accent);
  color: var(--accent);
}

.slot-summary {
  font-size: 10px;
  color: var(--text-dim);
  max-width: 80px;
  text-align: right;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.equip-import-bar {
  margin-bottom: 10px;
}

.btn-import {
  background: #2a4a3a;
  color: var(--success);
  width: 100%;
  text-align: left;
  padding: 6px 10px;
  font-size: 12px;
}
```

- [ ] **Step 4：裝備詳細輸入樣式**

```css
.equip-slot-detail {
  background: var(--bg-panel);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 12px;
}

.slot-detail-header {
  font-size: 15px;
  font-weight: 700;
  color: var(--accent);
  margin-bottom: 12px;
}

.detail-section {
  margin-bottom: 12px;
}

.detail-section-title {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--accent-dim);
  font-weight: 700;
  margin-bottom: 6px;
}

.detail-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}

.scroll-total {
  font-size: 12px;
  color: var(--success);
  margin-top: 4px;
}

.potential-row {
  display: flex;
  gap: 6px;
  align-items: center;
  margin-bottom: 4px;
}

.potential-type-sel {
  flex: 2;
  background: var(--bg-input);
  border: 1px solid var(--border);
  border-radius: 4px;
  color: var(--text);
  padding: 4px 6px;
  font-size: 12px;
}

.potential-val {
  flex: 1;
  background: var(--bg-input);
  border: 1px solid var(--border);
  border-radius: 4px;
  color: var(--text);
  padding: 4px 6px;
  font-size: 12px;
}
```

- [ ] **Step 5：底部三格 + DPS 表格 + BUFF 樣式**

```css
.equip-bottom-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 12px;
}

.bottom-panel {
  background: var(--step-bg);
  border: 1px solid var(--step-border);
  border-radius: 8px;
  padding: 12px;
}

.panel-title {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--accent);
  font-weight: 700;
  margin-bottom: 8px;
}

.panel-sub-title {
  font-size: 10px;
  color: var(--text-dim);
  margin-bottom: 4px;
}

.stat-row {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  margin-bottom: 2px;
  color: var(--text-dim);
}

.stat-val { color: var(--success); font-weight: 600; }

.buff-list { display: flex; flex-direction: column; gap: 4px; }
.buff-item { font-size: 11px; }
.buff-label { display: flex; align-items: center; gap: 5px; cursor: pointer; }
.buff-name { color: var(--text); }
.buff-source { color: var(--text-dim); font-size: 10px; }
.buff-effects { margin-left: 20px; margin-top: 3px; display: flex; flex-direction: column; gap: 2px; }
.buff-effect-row { display: flex; gap: 6px; align-items: center; font-size: 10px; }
.buff-effect-type { color: var(--text-dim); width: 80px; }
.buff-val { width: 60px; background: var(--bg-input); border: 1px solid var(--border); border-radius: 3px; color: var(--text); padding: 2px 5px; font-size: 11px; }

.ratio-box {
  background: #0d4d3a;
  border: 2px solid var(--accent);
  border-radius: 8px;
  padding: 10px;
  text-align: center;
}
.ratio-label { font-size: 11px; color: var(--text-dim); margin-bottom: 4px; }
.ratio-value { font-size: 28px; font-weight: 700; color: var(--accent); }

.efficiency-row { display: flex; justify-content: space-between; font-size: 11px; color: var(--text-dim); margin-bottom: 2px; }
.efficiency-row.top { color: var(--accent); font-weight: 700; }

.dps-grid {
  display: grid;
  grid-template-columns: 1fr 100px 100px;
  gap: 3px 6px;
  font-size: 11px;
  align-items: center;
}
.dps-col-head { text-align: center; font-weight: 700; font-size: 11px; }
.boss-col { color: var(--boss-color); }
.mob-col  { color: var(--mob-color); }
.dps-row-label { color: var(--text-dim); }
.dps-val { text-align: center; color: #7ec8e3; font-weight: 600; font-size: 12px; }
.final-row { color: var(--text); font-weight: 700; }
.final-val { color: var(--accent) !important; font-size: 15px !important; }

/* ── Responsive ── */
@media (max-width: 1100px) {
  .equip-bottom-grid { grid-template-columns: 1fr 1fr; }
}
@media (max-width: 768px) {
  .equip-main { grid-template-columns: 1fr; }
  .equip-bottom-grid { grid-template-columns: 1fr; }
}
```

- [ ] **Step 6：Commit**

```bash
git add style.css
git commit -m "feat(style): add equipment simulator CSS and tab bar styles"
```

---

## Task 6：整合驗證與收尾

**Files:**
- Modify: `app.js`, `index.html`

- [ ] **Step 1：手動驗證 Tab 切換**

在瀏覽器開啟 `index.html`（或 GitHub Pages），確認：
- Tab 切換正常（攻擊力計算機 ↔ 裝備模擬器）
- Tab 1 的隊伍 BUFF 勾選後即時影響傷害計算
- 裝備模擬器左欄可點選各裝備槽

- [ ] **Step 2：手動驗證裝備計算正確性**

以英雄（STR 主屬）為例：
- 裸裝 STR = 1000，武器 ATK = 100（本體）
- 頭盔潛能：%STR 12%
- 武器衝捲：8 次 × 2 ATK = +16 ATK
- 職業技能 Rage：ATK +20
- 每秒打擊數：2

預期合計：totalFlatAtk = 16 + 20 = 36，totalFlatMain 從頭盔潛能 flat 部分 = 0，pctMain = 12%  
finalMain = 1000 × 1.12 = 1120, step1 = 4 × 1120 = 4480  
finalAtk = 100 + 36 = 136, step3 = 136  
攻屬比 = 136 × 0.04 × 1120 / 4480 ≈ 1.36

在介面驗證這個數字。

- [ ] **Step 3：驗證存檔 / 讀取 / 刪除**

- 儲存一組裝備組合，關閉重開頁面，確認仍可讀取
- 刪除後確認消失

- [ ] **Step 4：驗證「從攻擊力計算機匯入」**

- 在 Tab 1 填入 STR=3000, ATK=2000，切換到裝備模擬器，點「匯入」
- 確認裸裝主屬性欄位變為 3000

- [ ] **Step 5：驗證「匯出到攻擊力計算機」**

- 在裝備模擬器輸入裝備後，點「匯出」，確認自動跳回 Tab 1 且數值已填入

- [ ] **Step 6：加入 equip.js 的 `<script>` 標籤到 index.html**

確認 `index.html` 底部的 script 順序：

```html
<script src="https://unpkg.com/vue@3/dist/vue.global.prod.js"></script>
<script src="equip.js"></script>   <!-- 必須在 app.js 之前 -->
<script src="app.js"></script>
```

- [ ] **Step 7：push 到 GitHub**

```bash
git add -A
git commit -m "feat: complete equipment simulator with DPS, MDPS, party buffs, and save/load"
git push origin main
```

---

## 自我審查 Checklist

| 需求 | 對應任務 |
|------|---------|
| 25 個裝備槽統一格式（本體+衝捲+潛能） | Task 2 |
| 潛能類型含爆傷 | Task 2 Step 1 (POTENTIAL_TYPES) |
| 職業技能自動帶入可修改 | Task 2 Step 7, Task 3 Step 2 |
| 隊伍 BUFF 勾選，數值可改 | Task 1 Step 3, Task 3 Step 3 |
| Tab 1 也有隊伍 BUFF | Task 3 Step 3-4 |
| 裸裝屬性輸入 | Task 2 Step 1, Task 4 Step 4 |
| 從 Tab 1 匯入裸裝 | Task 2 Step 8, Task 4 Step 4 |
| 匯出到 Tab 1 | Task 4 Step 6 |
| DPS = 平均 × 每秒打擊數 | Task 2 Step 4 |
| MDPS = DPS × 60 | Task 2 Step 4 |
| 打王 / 小怪分開 | Task 2 Step 4 |
| 攻屬比（1%主屬 = X ATK） | Task 2 Step 5 |
| 效益排名 | Task 2 Step 5 |
| localStorage 存檔最多 20 組 | Task 2 Step 6 |
