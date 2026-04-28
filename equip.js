// equip.js — Equipment Simulator Composable
// Vue 3 CDN (no build pipeline)
// Uses Vue.ref / Vue.computed to avoid conflict with app.js global scope declarations

const SLOT_DEFS = [
  { id: 'weapon',    name: '武器',       group: 'weapon' },
  { id: 'secondary', name: '副武器', group: 'weapon' },
  { id: 'hat',       name: '頭盔',       group: 'armor' },
  { id: 'top',       name: '上衣',       group: 'armor' },
  { id: 'bottom',    name: '下衣',       group: 'armor' },
  { id: 'glove',     name: '手套',       group: 'armor' },
  { id: 'shoe',      name: '鞋子',       group: 'armor' },
  { id: 'cape',      name: '披風',       group: 'armor' },
  { id: 'shoulder',  name: '肩膀',       group: 'armor' },
  { id: 'belt',      name: '腰帶',       group: 'armor' },
  { id: 'heart',     name: '機器人心臟', group: 'armor' },
  { id: 'face',      name: '臉部裝飾', group: 'accessory' },
  { id: 'eye',       name: '眼部裝飾', group: 'accessory' },
  { id: 'earring',   name: '耳環',       group: 'accessory' },
  { id: 'pendant',   name: '吊墜',       group: 'accessory' },
  { id: 'pocket',    name: '口袋道具', group: 'accessory' },
  { id: 'title',     name: '稱號',       group: 'accessory' },
  { id: 'ring1',     name: '戒指 1',     group: 'accessory' },
  { id: 'ring2',     name: '戒指 2',     group: 'accessory' },
  { id: 'ring3',     name: '戒指 3',     group: 'accessory' },
  { id: 'ring4',     name: '戒指 4',     group: 'accessory' },
  { id: 'energy',    name: '能源',       group: 'special' },
  { id: 'pet1',      name: '寵物裝備 1', group: 'special' },
  { id: 'pet2',      name: '寵物裝備 2', group: 'special' },
  { id: 'pet3',      name: '寵物裝備 3', group: 'special' },
]

const POTENTIAL_TYPES = [
  { value: 'none',         label: '(無)' },
  { value: 'mainStatPct',  label: '%主屬性' },
  { value: 'subStatPct',   label: '%副屬性' },
  { value: 'allStatPct',   label: '%全屬性' },
  { value: 'mainStatFlat', label: '主屬性+' },
  { value: 'subStatFlat',  label: '副屬性+' },
  { value: 'allStatFlat',  label: '全屬性+' },
  { value: 'atkFlat',      label: 'ATK+(平)' },
  { value: 'atkPct',       label: '%ATK' },
  { value: 'critRate',     label: '爆擊率+%' },
  { value: 'critDmg',      label: '爆擊傷害+%' },
  { value: 'bossDmg',      label: 'BOSS傷害+%' },
  { value: 'totalDmg',     label: '總傷害+%' },
  { value: 'ignoreDef',    label: '無視防禦+%' },
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

function applySkillEffect(type, value, acc) {
  if      (type === 'mainStatFlat') acc.flatMain += value
  else if (type === 'subStatFlat')  acc.flatSub  += value
  else if (type === 'allStatFlat')  { acc.flatMain += value; acc.flatSub += value }
  else if (type === 'atkFlat')      acc.flatAtk  += value
  else if (type === 'mainStatPct')  acc.pctMain  += value
  else if (type === 'subStatPct')   acc.pctSub   += value
  else if (type === 'allStatPct')   { acc.pctMain += value; acc.pctSub += value }
  else if (type === 'atkPct')       acc.pctAtk   += value
  else if (type === 'critRate')     acc.critRate  += value
  else if (type === 'critDmg')      acc.critDmg   += value
  else if (type === 'bossDmg')      acc.bossDmg   += value
  else if (type === 'totalDmg')     acc.totalDmg  += value
}

function useEquip(jobsRef, partyBuffsRef, selectedJobIdRef) {

  const baseStats = Vue.ref({ mainStat: 0, subStat: 0, atk: 0 })

  const equipSettings = Vue.ref({
    skillPct: 100, mastery: 60,
    critRate: 0, minCritBonus: 20, maxCritBonus: 50,
    bossDefPct: 0, monsterDefPct: 10, ignoreDefPct: 0,
    hitsPerSec: 1,
  })

  const slots          = Vue.ref(Object.fromEntries(SLOT_DEFS.map(d => [d.id, makeSlot(d)])))
  const selectedSlotId = Vue.ref('weapon')
  const selectedSlot   = Vue.computed(() => slots.value[selectedSlotId.value])
  const jobSkills      = Vue.ref([])
  const activeBuffs    = Vue.ref([])

  const totals = Vue.computed(() => {
    let flatMain = 0, flatSub = 0, flatAtk = 0
    let pctMain = 0, pctSub = 0, pctAtk = 0
    let critRate = 0, critDmg = 0, bossDmg = 0, totalDmg = 0
    const ignoreDefFactors = []

    for (const slot of Object.values(slots.value)) {
      flatMain += Number(slot.base.mainStat) || 0
      flatSub  += Number(slot.base.subStat)  || 0
      flatAtk  += Number(slot.base.atk)      || 0
      const allStatBase = Number(slot.base.allStat) || 0
      flatMain += allStatBase
      flatSub  += allStatBase
      const scrollVal = (Number(slot.scroll.count) || 0) * (Number(slot.scroll.perScroll) || 0)
      if (slot.scroll.stat === 'atk') flatAtk += scrollVal
      else flatMain += scrollVal
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
        }
      }
    }

    const acc = { flatMain, flatSub, flatAtk, pctMain, pctSub, pctAtk, critRate, critDmg, bossDmg, totalDmg }
    for (const sk of jobSkills.value) {
      if (!sk.enabled) continue
      applySkillEffect(sk.type, Number(sk.value) || 0, acc)
    }
    ;({ flatMain, flatSub, flatAtk, pctMain, pctSub, pctAtk, critRate, critDmg, bossDmg, totalDmg } = acc)

    for (const buf of activeBuffs.value) {
      if (!buf.enabled) continue
      for (const eff of buf.effects) {
        const v = Number(eff.value) || 0
        if      (eff.type === 'atkFlat')      flatAtk  += v
        else if (eff.type === 'atkPct')       pctAtk   += v
        else if (eff.type === 'critRate')     critRate += v
        else if (eff.type === 'critDmg')      critDmg  += v
        else if (eff.type === 'allStatPct')   { pctMain += v; pctSub += v }
        else if (eff.type === 'bossDmg')      bossDmg  += v
        else if (eff.type === 'totalDmg')     totalDmg += v
      }
    }

    const ignoreDefTotal = ignoreDefFactors.length > 0
      ? (1 - ignoreDefFactors.reduce((a, v) => a * (1 - v / 100), 1)) * 100
      : (Number(equipSettings.value.ignoreDefPct) || 0)

    return { flatMain, flatSub, flatAtk, pctMain, pctSub, pctAtk, critRate, critDmg, bossDmg, totalDmg, ignoreDefTotal }
  })

  const dmgResult = Vue.computed(() => {
    const t = totals.value
    const s = equipSettings.value
    const job = (jobsRef.value || []).find(j => j.id === (selectedJobIdRef ? selectedJobIdRef.value : null))
    const coeff = (job && job.weapons && job.weapons[0]) ? job.weapons[0].coefficient : 1

    const finalMain   = (Number(baseStats.value.mainStat) || 0) + t.flatMain
    const finalSub    = (Number(baseStats.value.subStat)  || 0) + t.flatSub
    const finalAtk    = (Number(baseStats.value.atk)      || 0) + t.flatAtk
    const finalAtkPct = t.pctAtk

    const realFinalMain = Math.floor(finalMain * (1 + t.pctMain / 100))
    const realFinalSub  = Math.floor(finalSub  * (1 + t.pctSub  / 100))

    if (finalMain <= 0 || finalAtk <= 0) {
      return { maxBoss:0, minBoss:0, avgBoss:0, maxMob:0, minMob:0, avgMob:0,
               dpsBoss:0, mdpsBoss:0, dpsMob:0, mdpsMob:0,
               finalMain, finalSub, finalAtk, finalAtkPct, step1:0, step4:0, coeff,
               realFinalMain:0, realFinalSub:0, tableAtkMax:0, tableAtkMin:0 }
    }

    const step1 = 4 * realFinalMain + realFinalSub
    const step3 = finalAtk * (1 + finalAtkPct / 100)
    const step4 = step1 * coeff * step3 * 0.01 * (Number(s.skillPct) || 100) / 100

    const step5Boss = 1 + (t.totalDmg + t.bossDmg) / 100
    const step5Mob  = 1 + t.totalDmg / 100
    const ignEff    = t.ignoreDefTotal / 100
    const step6Boss = 1 - (Number(s.bossDefPct)    || 0) / 100 * (1 - ignEff)
    const step6Mob  = 1 - (Number(s.monsterDefPct) || 0) / 100 * (1 - ignEff)

    const maxBoss = step4 * step5Boss * step6Boss
    const maxMob  = step4 * step5Mob  * step6Mob
    const mastery = (Number(s.mastery) || 0) / 100
    const minBoss = maxBoss * mastery
    const minMob  = maxMob  * mastery

    const totalCritRate   = Math.min(100, (Number(s.critRate) || 0) + t.critRate)
    const totalCritDmgMax = (Number(s.maxCritBonus) || 0) + t.critDmg
    const critMult = 1 + totalCritRate / 100 * ((Number(s.minCritBonus) || 0) + totalCritDmgMax) / 200

    const avgBoss = (maxBoss + minBoss) / 2 * critMult
    const avgMob  = (maxMob  + minMob)  / 2 * critMult

    let hitsBonus = 0
    for (const buf of activeBuffs.value) {
      if (!buf.enabled) continue
      for (const eff of buf.effects) {
        if (eff.type === 'hitsPerSecBonus') hitsBonus += Number(eff.value) || 0
      }
    }
    const hps = (Number(s.hitsPerSec) || 0) + hitsBonus

    // 遊戲表攻範圍：不含技能%、不含boss/mob傷害、不含防禦折減
    // 包含技能加攻（Rage 等 atkFlat buff 已計入 finalAtk）
    const tableAtkMax = step1 * coeff * step3 * 0.01
    const tableAtkMin = Math.floor(tableAtkMax * (Number(s.mastery) || 0) / 100)

    return {
      maxBoss, minBoss, avgBoss, maxMob, minMob, avgMob,
      dpsBoss: avgBoss * hps, mdpsBoss: avgBoss * hps * 60,
      dpsMob:  avgMob  * hps, mdpsMob:  avgMob  * hps * 60,
      finalMain, finalSub, finalAtk, finalAtkPct, step1, step4, coeff,
      realFinalMain, realFinalSub,
      tableAtkMax, tableAtkMin,
    }
  })

  const attackStatRatio = Vue.computed(() => {
    const r = dmgResult.value
    if (!r.finalMain || !r.step1 || !r.finalAtk) return 0
    return r.finalAtk * (1 + r.finalAtkPct / 100) * 0.04 * r.finalMain / r.step1
  })

  // 1% 主屬性 ≈ 多少屬性點（平值）
  // 原理：finalMain(rawMain) 增加 1% 乘數，等效於增加 rawMain*0.01 的最終主屬
  //       增加 X 點平主屬，最終主屬增加 X*(1+pctMain/100)
  //       因此 X = rawMain * 0.01 / (1 + pctMain/100)
  const onePercentMainEquivFlat = Vue.computed(() => {
    const r = dmgResult.value
    const t = totals.value
    if (!r.finalMain) return 0
    const pctMult = 1 + t.pctMain / 100
    return r.finalMain * 0.01 / pctMult
  })

  // 1 ATK（平）≈ 多少點主屬性（平值）
  // 原理：step4 ∝ step1 * step3；∂step4/∂flatAtk ∝ step1*(1+atkPct/100)
  //       ∂step4/∂flatMain ∝ 4*(1+pctMain/100)*step3
  //       令兩者相等 → X = step1 / (4*(1+pctMain/100)*finalAtk)
  const oneAtkEquivMain = Vue.computed(() => {
    const r = dmgResult.value
    const t = totals.value
    if (!r.step1 || !r.finalAtk) return 0
    const pctMult = 1 + t.pctMain / 100
    return r.step1 / (4 * pctMult * r.finalAtk)
  })

  const upgradeEfficiency = Vue.computed(() => {
    const r = dmgResult.value
    const t = totals.value
    const mainPctGain  = r.step1 > 0 ? (4 * r.finalMain * (1 + t.pctMain / 100) * 0.01 / r.step1) * 100 : 0
    const atkPctGain   = (100 + r.finalAtkPct) > 0 ? 100 / (100 + r.finalAtkPct) : 0
    const bossDmgGain  = (100 + t.bossDmg + t.totalDmg) > 0 ? 100 / (100 + t.bossDmg + t.totalDmg) : 0
    const totalDmgGain = (100 + t.totalDmg) > 0 ? 100 / (100 + t.totalDmg) : 0
    return [
      { label: '+1% 主屬性', gain: mainPctGain },
      { label: '+1% ATK',                gain: atkPctGain },
      { label: '+1% BOSS傷',         gain: bossDmgGain },
      { label: '+1% 總傷',       gain: totalDmgGain },
    ].sort((a, b) => b.gain - a.gain)
  })

  const EQUIP_STORAGE_KEY = 'maple_calc_equipment'
  const MAX_EQUIP_SAVES   = 20
  const equipSets         = Vue.ref([])
  const equipSaveName     = Vue.ref('')
  const selectedEquipSave = Vue.ref('')
  const equipSaveMsg      = Vue.ref('')

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
      equipSaveMsg.value = '⚠️ 已達 20 筆上限'
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
    equipSaveMsg.value = '✅ 已儲存「' + name + '」'
    setTimeout(() => { equipSaveMsg.value = '' }, 2000)
  }

  function loadEquipSet() {
    const key = selectedEquipSave.value
    if (!key) return
    const entry = equipSets.value.find(e => e.name === key)
    if (!entry) return
    Object.assign(baseStats.value,     entry.baseStats     || {})
    Object.assign(equipSettings.value, entry.equipSettings || {})
    slots.value       = entry.slots      || slots.value
    jobSkills.value   = entry.jobSkills  || []
    activeBuffs.value = entry.activeBuffs || []
    equipSaveName.value = entry.name
  }

  function deleteEquipSet() {
    const key = selectedEquipSave.value
    if (!key) return
    equipSets.value = equipSets.value.filter(e => e.name !== key)
    persistEquipSets()
    selectedEquipSave.value = ''
    equipSaveMsg.value = '🗑️ 已刪除「' + key + '」'
    setTimeout(() => { equipSaveMsg.value = '' }, 2000)
  }

  function initJobSkills(jobId) {
    const job = (jobsRef.value || []).find(j => j.id === jobId)
    jobSkills.value = (job && job.skills) ? job.skills.map(s => Object.assign({}, s)) : []
  }

  function initPartyBuffs() {
    activeBuffs.value = (partyBuffsRef.value || []).map(b => Object.assign({}, b, {
      enabled: false,
      effects: b.effects.map(e => Object.assign({}, e))
    }))
  }

  function importFromTab1(tab1Stats, mainStatKey) {
    baseStats.value.mainStat = Number(tab1Stats[mainStatKey]) || 0
    baseStats.value.subStat  = 0
    baseStats.value.atk      = 0
    const s = equipSettings.value
    s.skillPct      = tab1Stats.skillPct      != null ? tab1Stats.skillPct      : 100
    s.mastery       = tab1Stats.mastery        != null ? tab1Stats.mastery       : 60
    s.critRate      = tab1Stats.critRate       != null ? tab1Stats.critRate      : 0
    s.minCritBonus  = tab1Stats.minCritBonus   != null ? tab1Stats.minCritBonus  : 20
    s.maxCritBonus  = tab1Stats.maxCritBonus   != null ? tab1Stats.maxCritBonus  : 50
    s.bossDefPct    = tab1Stats.bossDefPct     != null ? tab1Stats.bossDefPct    : 0
    s.monsterDefPct = tab1Stats.monsterDefPct  != null ? tab1Stats.monsterDefPct : 10
    s.ignoreDefPct  = tab1Stats.ignoreDefPct   != null ? tab1Stats.ignoreDefPct  : 0
  }

  return {
    SLOT_DEFS, POTENTIAL_TYPES, makeSlot,
    baseStats, equipSettings,
    slots, selectedSlotId, selectedSlot,
    jobSkills, activeBuffs,
    totals, dmgResult, attackStatRatio, onePercentMainEquivFlat, oneAtkEquivMain, upgradeEfficiency,
    equipSets, equipSaveName, selectedEquipSave, equipSaveMsg,
    loadEquipSets, saveEquipSet, loadEquipSet, deleteEquipSet,
    initJobSkills, initPartyBuffs, importFromTab1,
  }
}
