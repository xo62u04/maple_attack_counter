// equip.js — 裝備模擬器 Composable
// 使用 Vue 3 CDN Composition API (無 build pipeline)
const { ref, computed } = Vue

// ── 25 個裝備槽定義 ──────────────────────────────────────────
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

// ── 潛能類型 ──────────────────────────────────────────────────
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
  { value: 'critRate',     label: '爆擊率+%' },
  { value: 'critDmg',      label: '爆擊傷害+%' },
  { value: 'bossDmg',      label: 'BOSS傷害+%' },
  { value: 'totalDmg',     label: '總傷害+%' },
  { value: 'ignoreDef',    label: '無視防禦+%' },
  { value: 'hpFlat',       label: 'HP+' },
  { value: 'hpPct',        label: '%HP' },
]

// ── 建立空裝備槽 ──────────────────────────────────────────────
function makeSlot(def) {
  return {
    id: def.id,
    name: def.name,
    group: def.group,
    note: '',
    base: { mainStat: 0, subStat: 0, atk: 0, allStat: 0 },
    scroll: {
      count: 0,
      perScroll: 0,
      stat: def.group === 'weapon' ? 'atk' : 'mainStat'
    },
    potential: [
      { type: 'none', value: 0 },
      { type: 'none', value: 0 },
      { type: 'none', value: 0 },
    ]
  }
}

// ── 屬性效果 helper（職業技能用）───────────────────────────────
function applySkillEffect(type, value, acc) {
  if (type === 'atkFlat')      acc.flatAtk  += value
  else if (type === 'atkPct')  acc.pctAtk   += value
  else if (type === 'critRate') acc.critRate += value
  else if (type === 'critDmg') acc.critDmg  += value
  else if (type === 'mainStatPct') acc.pctMain += value
  else if (type === 'subStatPct')  acc.pctSub  += value
  else if (type === 'allStatPct')  { acc.pctMain += value; acc.pctSub += value }
  else if (type === 'bossDmg') acc.bossDmg  += value
  else if (type === 'totalDmg') acc.totalDmg += value
}

// ── 主 Composable ──────────────────────────────────────────────
function useEquip(jobsRef, partyBuffsRef, selectedJobIdRef) {

  // 裸裝屬性（未穿任何裝備的基底數值）
  const baseStats = ref({ mainStat: 0, subStat: 0, atk: 0 })

  // 技能 & 戰鬥設定
  const equipSettings = ref({
    skillPct:      100,
    mastery:       60,
    critRate:      0,
    minCritBonus:  20,
    maxCritBonus:  50,
    bossDefPct:    0,
    monsterDefPct: 10,
    ignoreDefPct:  0,
    hitsPerSec:    1,
  })

  // 25 個裝備槽
  const slots = ref(Object.fromEntries(SLOT_DEFS.map(d => [d.id, makeSlot(d)])))
  const selectedSlotId = ref('weapon')
  const selectedSlot = computed(() => slots.value[selectedSlotId.value])

  // 職業技能（從 jobsRef 讀入，可修改）
  const jobSkills = ref([])

  // 隊伍 BUFF（從 partyBuffsRef 讀入，可修改）
  const activeBuffs = ref([])

  // ── 全裝屬性合計 ──────────────────────────────────────────
  const totals = computed(() => {
    let flatMain = 0, flatSub = 0, flatAtk = 0
    let pctMain = 0, pctSub = 0, pctAtk = 0
    let critRate = 0, critDmg = 0
    let bossDmg = 0, totalDmg = 0
    const ignoreDefFactors = []

    // 遍歷每個裝備槽
    for (const slot of Object.values(slots.value)) {
      // 本體屬性
      flatMain += Number(slot.base.mainStat) || 0
      flatSub  += Number(slot.base.subStat)  || 0
      flatAtk  += Number(slot.base.atk)      || 0

      // 全屬性本體
      const allStatBase = Number(slot.base.allStat) || 0
      flatMain += allStatBase
      flatSub  += allStatBase

      // 衝捲
      const scrollVal = (Number(slot.scroll.count) || 0) * (Number(slot.scroll.perScroll) || 0)
      if (slot.scroll.stat === 'atk') flatAtk  += scrollVal
      else                             flatMain += scrollVal

      // 潛能（3 行）
      for (const pot of slot.potential) {
        const v = Number(pot.value) || 0
        if (v === 0 || pot.type === 'none') continue
        switch (pot.type) {
          case 'mainStatPct':  pctMain  += v; break
          case 'subStatPct':   pctSub   += v; break
          case 'allStatPct':   pctMain  += v; pctSub += v; break
          case 'mainStatFlat': flatMain += v; break
          case 'subStatFlat':  flatSub  += v; break
          case 'allStatFlat':  flatMain += v; flatSub += v; break
          case 'atkFlat':      flatAtk  += v; break
          case 'atkPct':       pctAtk   += v; break
          case 'critRate':     critRate += v; break
          case 'critDmg':      critDmg  += v; break
          case 'bossDmg':      bossDmg  += v; break
          case 'totalDmg':     totalDmg += v; break
          case 'ignoreDef':    ignoreDefFactors.push(v); break
          // hpFlat, hpPct 目前不影響傷害，略過
        }
      }
    }

    // 職業技能
    const acc = { flatMain, flatSub, flatAtk, pctMain, pctSub, pctAtk, critRate, critDmg, bossDmg, totalDmg }
    for (const sk of jobSkills.value) {
      if (!sk.enabled) continue
      const v = Number(sk.value) || 0
      applySkillEffect(sk.type, v, acc)
    }
    ;({ flatMain, flatSub, flatAtk, pctMain, pctSub, pctAtk, critRate, critDmg, bossDmg, totalDmg } = acc)

    // 隊伍 BUFF
    for (const buf of activeBuffs.value) {
      if (!buf.enabled) continue
      for (const eff of buf.effects) {
        const v = Number(eff.value) || 0
        if (eff.type === 'atkFlat')       flatAtk  += v
        else if (eff.type === 'atkPct')   pctAtk   += v
        else if (eff.type === 'critRate') critRate += v
        else if (eff.type === 'critDmg')  critDmg  += v
        else if (eff.type === 'allStatPct') { pctMain += v; pctSub += v }
        else if (eff.type === 'bossDmg')  bossDmg  += v
        else if (eff.type === 'totalDmg') totalDmg += v
        // hitsPerSecBonus 在 dmgResult 另外處理
      }
    }

    // 無視防禦累乘（若有潛能，否則用設定值）
    const ignoreDefTotal = ignoreDefFactors.length > 0
      ? (1 - ignoreDefFactors.reduce((a, v) => a * (1 - v / 100), 1)) * 100
      : (Number(equipSettings.value.ignoreDefPct) || 0)

    return { flatMain, flatSub, flatAtk, pctMain, pctSub, pctAtk, critRate, critDmg, bossDmg, totalDmg, ignoreDefTotal }
  })

  // ── 傷害 & DPS 計算 ────────────────────────────────────────
  const dmgResult = computed(() => {
    const t = totals.value
    const s = equipSettings.value

    // 武器係數（取當前職業第一把武器，預設 1）
    const job = (jobsRef.value || []).find(j => j.id === (selectedJobIdRef ? selectedJobIdRef.value : null))
    const coeff = job?.weapons?.[0]?.coefficient ?? 1

    // 最終屬性
    const finalMain   = (Number(baseStats.value.mainStat) || 0) + t.flatMain
    const finalSub    = (Number(baseStats.value.subStat)  || 0) + t.flatSub
    const finalAtk    = (Number(baseStats.value.atk)      || 0) + t.flatAtk
    const finalAtkPct = t.pctAtk

    if (finalMain <= 0 || finalAtk <= 0) {
      return {
        maxBoss: 0, minBoss: 0, avgBoss: 0,
        maxMob: 0,  minMob: 0,  avgMob: 0,
        dpsBoss: 0, mdpsBoss: 0, dpsMob: 0, mdpsMob: 0,
        finalMain, finalSub, finalAtk, finalAtkPct,
        step1: 0, coeff,
      }
    }

    // 傷害公式（楓之谷 BigBang）
    const step1 = 4 * finalMain * (1 + t.pctMain / 100) + finalSub * (1 + t.pctSub / 100)
    const step2 = step1 * coeff
    const step3 = finalAtk * (1 + finalAtkPct / 100)
    const step4 = step2 * step3 * 0.01 * (Number(s.skillPct) || 100) / 100

    const step5Boss = 1 + (t.totalDmg + t.bossDmg) / 100
    const step5Mob  = 1 + t.totalDmg / 100

    const ignEff = t.ignoreDefTotal / 100
    const step6Boss = 1 - (Number(s.bossDefPct)    || 0) / 100 * (1 - ignEff)
    const step6Mob  = 1 - (Number(s.monsterDefPct) || 0) / 100 * (1 - ignEff)

    const maxBoss = step4 * step5Boss * step6Boss
    const maxMob  = step4 * step5Mob  * step6Mob
    const mastery = (Number(s.mastery) || 0) / 100
    const minBoss = maxBoss * mastery
    const minMob  = maxMob  * mastery

    // 爆擊倍率（含裝備提供的爆擊率 & 爆傷）
    const totalCritRate = Math.min(100, (Number(s.critRate) || 0) + t.critRate)
    const totalCritDmgMax = (Number(s.maxCritBonus) || 0) + t.critDmg
    const critMult = 1 + totalCritRate / 100 * ((Number(s.minCritBonus) || 0) + totalCritDmgMax) / 200

    const avgBoss = (maxBoss + minBoss) / 2 * critMult
    const avgMob  = (maxMob  + minMob)  / 2 * critMult

    // 攻速加成（最終極速 buff 的 hitsPerSecBonus）
    let hitsBonus = 0
    for (const buf of activeBuffs.value) {
      if (!buf.enabled) continue
      for (const eff of buf.effects) {
        if (eff.type === 'hitsPerSecBonus') hitsBonus += Number(eff.value) || 0
      }
    }
    const hps = (Number(s.hitsPerSec) || 0) + hitsBonus

    return {
      maxBoss, minBoss, avgBoss,
      maxMob,  minMob,  avgMob,
      dpsBoss:  avgBoss * hps,
      mdpsBoss: avgBoss * hps * 60,
      dpsMob:   avgMob  * hps,
      mdpsMob:  avgMob  * hps * 60,
      finalMain, finalSub, finalAtk, finalAtkPct,
      step1, coeff,
    }
  })

  // ── 攻屬比（1% 主屬性 = X ATK 等效）────────────────────────
  const attackStatRatio = computed(() => {
    const r = dmgResult.value
    if (!r.finalMain || !r.step1 || !r.finalAtk) return 0
    return r.finalAtk * (1 + r.finalAtkPct / 100) * 0.04 * r.finalMain / r.step1
  })

  // ── 升級效益排名 ────────────────────────────────────────────
  const upgradeEfficiency = computed(() => {
    const r = dmgResult.value
    const t = totals.value
    const mainPctGain  = r.step1 > 0
      ? (4 * r.finalMain * (1 + t.pctMain / 100) * 0.01 / r.step1) * 100
      : 0
    const atkPctGain   = (100 + r.finalAtkPct) > 0
      ? 100 / (100 + r.finalAtkPct)
      : 0
    const bossDmgGain  = (100 + t.bossDmg + t.totalDmg) > 0
      ? 100 / (100 + t.bossDmg + t.totalDmg)
      : 0
    const totalDmgGain = (100 + t.totalDmg) > 0
      ? 100 / (100 + t.totalDmg)
      : 0
    return [
      { label: '+1% 主屬性', gain: mainPctGain },
      { label: '+1% ATK',    gain: atkPctGain },
      { label: '+1% BOSS傷', gain: bossDmgGain },
      { label: '+1% 總傷',   gain: totalDmgGain },
    ].sort((a, b) => b.gain - a.gain)
  })

  // ── 存檔 / 讀檔 ────────────────────────────────────────────
  const EQUIP_STORAGE_KEY = 'maple_calc_equipment'
  const MAX_EQUIP_SAVES   = 20

  const equipSets         = ref([])
  const equipSaveName     = ref('')
  const selectedEquipSave = ref('')
  const equipSaveMsg      = ref('')

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
    const exists = equipSets.value.find(e => e.name === name)
    if (!exists && equipSets.value.length >= MAX_EQUIP_SAVES) {
      equipSaveMsg.value = '⚠️ 已達 20 筆上限，請先刪除舊組合'
      return
    }
    const entry = {
      name,
      baseStats:     JSON.parse(JSON.stringify(baseStats.value)),
      equipSettings: JSON.parse(JSON.stringify(equipSettings.value)),
      slots:         JSON.parse(JSON.stringify(slots.value)),
      jobSkills:     JSON.parse(JSON.stringify(jobSkills.value)),
      activeBuffs:   JSON.parse(JSON.stringify(activeBuffs.value)),
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
    Object.assign(baseStats.value,     entry.baseStats     || {})
    Object.assign(equipSettings.value, entry.equipSettings || {})
    slots.value       = entry.slots     || slots.value
    jobSkills.value   = entry.jobSkills || []
    activeBuffs.value = entry.activeBuffs || []
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

  // ── 從職業初始化技能 ────────────────────────────────────────
  function initJobSkills(jobId) {
    const job = (jobsRef.value || []).find(j => j.id === jobId)
    jobSkills.value = job?.skills
      ? job.skills.map(s => ({ ...s }))
      : []
  }

  // ── 從 partyBuffsRef 初始化 activeBuffs ────────────────────
  function initPartyBuffs() {
    activeBuffs.value = (partyBuffsRef.value || []).map(b => ({
      ...b,
      enabled: false,
      effects: b.effects.map(e => ({ ...e }))
    }))
  }

  // ── 從攻擊力計算機 Tab 1 匯入裸裝屬性 ──────────────────────
  // tab1Stats: { STR, DEX, INT, LUK, atk, atkPct, skillPct, mastery,
  //              critRate, minCritBonus, maxCritBonus, bossDefPct, monsterDefPct, ignoreDefPct }
  // mainStatKey: 該職業的主屬性欄位名稱，例如 'STR', 'DEX', 'INT', 'LUK'
  function importFromTab1(tab1Stats, mainStatKey) {
    baseStats.value.mainStat = Number(tab1Stats[mainStatKey]) || 0
    baseStats.value.subStat  = 0   // 副屬性裸裝留 0，由裝備槽填入
    baseStats.value.atk      = 0
    equipSettings.value.skillPct      = tab1Stats.skillPct      ?? 100
    equipSettings.value.mastery       = tab1Stats.mastery        ?? 60
    equipSettings.value.critRate      = tab1Stats.critRate       ?? 0
    equipSettings.value.minCritBonus  = tab1Stats.minCritBonus   ?? 20
    equipSettings.value.maxCritBonus  = tab1Stats.maxCritBonus   ?? 50
    equipSettings.value.bossDefPct    = tab1Stats.bossDefPct     ?? 0
    equipSettings.value.monsterDefPct = tab1Stats.monsterDefPct  ?? 10
    equipSettings.value.ignoreDefPct  = tab1Stats.ignoreDefPct   ?? 0
  }

  // ── 回傳所有暴露的狀態與方法 ────────────────────────────────
  return {
    SLOT_DEFS,
    POTENTIAL_TYPES,
    makeSlot,
    baseStats,
    equipSettings,
    slots,
    selectedSlotId,
    selectedSlot,
    jobSkills,
    activeBuffs,
    totals,
    dmgResult,
    attackStatRatio,
    upgradeEfficiency,
    equipSets,
    equipSaveName,
    selectedEquipSave,
    equipSaveMsg,
    loadEquipSets,
    saveEquipSet,
    loadEquipSet,
    deleteEquipSet,
    initJobSkills,
    initPartyBuffs,
    importFromTab1,
  }
}
