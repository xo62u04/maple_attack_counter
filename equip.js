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
    weaponCoeff: 1.0,
    skillPct: 100, mastery: 60,
    critRate: 0, minCritBonus: 20, maxCritBonus: 50,
    baseBossDmg: 0, baseTotalDmg: 0,
    bossDefPct: 0, monsterDefPct: 10, ignoreDefPct: 0,
    hitsPerSec: 1,
  })

  // 是否啟用裝備槽計算（關閉時直接用裸裝+技能/BUFF，適合直接輸入聚合值）
  const useEquipSlots  = Vue.ref(true)

  const slots          = Vue.ref(Object.fromEntries(SLOT_DEFS.map(d => [d.id, makeSlot(d)])))
  const selectedSlotId = Vue.ref('weapon')
  const selectedSlot   = Vue.computed(() => slots.value[selectedSlotId.value])
  const jobSkills      = Vue.ref([])
  const activeBuffs    = Vue.ref([])

  // ── 藥水（不套用%屬性，加在乘算之後）──
  const potions = Vue.ref([
    { id: 'mainStat', name: '主屬藥水',  statType: 'main', value: 0,  fixed: false, enabled: false },
    { id: 'atk',      name: '攻擊藥水',  statType: 'atk',  value: 0,  fixed: false, enabled: false },
    { id: 'bless1',   name: '祝福密藥1', statType: 'main', value: 0,  fixed: false, enabled: false },
    { id: 'bless2',   name: '祝福密藥2', statType: 'main', value: 0,  fixed: false, enabled: false },
    { id: 'weather',  name: '天氣',      statType: 'atk',  value: 30, fixed: true,  enabled: false },
  ])

  // 藥水加總（bypass pct，獨立累計）
  const potionTotals = Vue.computed(() => {
    let mainBypass = 0, atkBypass = 0
    for (const pot of potions.value) {
      if (!pot.enabled) continue
      const v = Number(pot.value) || 0
      if      (pot.statType === 'main') mainBypass += v
      else if (pot.statType === 'atk')  atkBypass  += v
    }
    return { mainBypass, atkBypass }
  })

  const totals = Vue.computed(() => {
    let flatMain = 0, flatSub = 0, flatAtk = 0
    let pctMain = 0, pctSub = 0, pctAtk = 0
    let critRate = 0, critDmg = 0
    let bossDmg  = Number(equipSettings.value.baseBossDmg)  || 0
    let totalDmg = Number(equipSettings.value.baseTotalDmg) || 0
    const ignoreDefFactors = []

    if (useEquipSlots.value)
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
    const coeff = Number(s.weaponCoeff) || 1

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

    // 藥水：不套用%屬性，直接加在乘算之後
    const pot = potionTotals.value
    const step1 = 4 * (realFinalMain + pot.mainBypass) + realFinalSub
    // realFinalAtk：遊戲在 ATK 乘上 ATK% 後也做 floor（整數運算），再加藥水 ATK
    const realFinalAtk = Math.floor(finalAtk * (1 + finalAtkPct / 100)) + pot.atkBypass
    const step3 = realFinalAtk
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
    // ATK 與最終結果均 floor，模擬遊戲整數運算
    const tableAtkMax = Math.floor(step1 * coeff * realFinalAtk / 100)
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

  // +1 點主屬性（平值）提升傷害%
  // flat 主屬性會被 pctMain% 放大後進入 step1，所以增益 = 4 × (1+pctMain/100) / step1
  const oneMainFlatGain = Vue.computed(() => {
    const r = dmgResult.value
    const t = totals.value
    if (!r.step1) return 0
    return (4 * (1 + t.pctMain / 100) / r.step1) * 100
  })

  // +1 點 ATK（平值）提升傷害%
  // flat ATK 被 atkPct% 放大後進入 step3；(1+atkPct%) 在分子分母對消 → 增益 = 1 / finalAtk
  const oneAtkFlatGain = Vue.computed(() => {
    const r = dmgResult.value
    if (!r.finalAtk) return 0
    return 100 / r.finalAtk
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

  function _efficiencyBase(r, t) {
    // +1% 主屬性%：step1 增量 = 4 × finalMain（基底）× 0.01，不含 pctMain 乘數
    // （pctMain 的影響已在分母 step1 中體現，不應再重複相乘）
    const mainPct = r.step1 > 0 ? (4 * r.finalMain * 0.01 / r.step1) * 100 : 0
    // +1% ATK%：step3 相對增量 = 1 / (1 + atkPct/100)
    const atkPct  = (100 + r.finalAtkPct) > 0 ? 100 / (100 + r.finalAtkPct) : 0
    return { mainPct, atkPct }
  }

  // 打 BOSS：總傷與 BOSS傷 分母都包含 bossDmg
  const upgradeEfficiencyBoss = Vue.computed(() => {
    const r = dmgResult.value
    const t = totals.value
    const { mainPct, atkPct } = _efficiencyBase(r, t)
    const base = 100 + t.bossDmg + t.totalDmg
    const bossDmgGain  = base > 0 ? 100 / base : 0
    const totalDmgGain = base > 0 ? 100 / base : 0  // 對 BOSS，兩者分母相同
    return [
      { label: '+1% 主屬性', gain: mainPct },
      { label: '+1% ATK',   gain: atkPct },
      { label: '+1% BOSS傷', gain: bossDmgGain },
      { label: '+1% 總傷',   gain: totalDmgGain },
    ].sort((a, b) => b.gain - a.gain)
  })

  // 打小怪：BOSS傷無效，只計總傷
  const upgradeEfficiencyMob = Vue.computed(() => {
    const r = dmgResult.value
    const t = totals.value
    const { mainPct, atkPct } = _efficiencyBase(r, t)
    const totalDmgGain = (100 + t.totalDmg) > 0 ? 100 / (100 + t.totalDmg) : 0
    return [
      { label: '+1% 主屬性', gain: mainPct },
      { label: '+1% ATK',   gain: atkPct },
      { label: '+1% 總傷',   gain: totalDmgGain },
    ].sort((a, b) => b.gain - a.gain)
  })

  // ── 統一存檔介面（由 app.js 的 saveCharacter/loadCharacter 管理）──
  function getState() {
    return {
      baseStats:     JSON.parse(JSON.stringify(baseStats.value)),
      equipSettings: JSON.parse(JSON.stringify(equipSettings.value)),
      slots:         JSON.parse(JSON.stringify(slots.value)),
      jobSkills:     JSON.parse(JSON.stringify(jobSkills.value)),
      activeBuffs:   JSON.parse(JSON.stringify(activeBuffs.value)),
      useEquipSlots: useEquipSlots.value,
      potions:       JSON.parse(JSON.stringify(potions.value)),
    }
  }

  function setState(state) {
    if (!state) return
    if (state.baseStats)     Object.assign(baseStats.value,     state.baseStats)
    if (state.equipSettings) Object.assign(equipSettings.value, state.equipSettings)
    if (state.slots)         slots.value       = state.slots
    if (state.jobSkills)     jobSkills.value   = state.jobSkills
    if (state.activeBuffs)   activeBuffs.value = state.activeBuffs
    if (state.useEquipSlots !== undefined) useEquipSlots.value = state.useEquipSlots
    if (state.potions)       potions.value     = state.potions
  }

  function initJobSkills(jobId) {
    const job = (jobsRef.value || []).find(j => j.id === jobId)
    jobSkills.value = (job && job.skills) ? job.skills.map(s => Object.assign({}, s)) : []
    // 同時設定武器係數（取第一把武器；使用者可在側欄手動修改）
    if (job && job.weapons && job.weapons[0]) {
      equipSettings.value.weaponCoeff = job.weapons[0].coefficient
    }
  }

  // ── 潛能比較器 ──
  // 可選的潛能詞條類型（右側「換成」輸入欄用）
  const POT_COMPARE_TYPES = [
    { value: 'none',         label: '（不選）' },
    { value: 'mainStatPct',  label: '主屬性 %' },
    { value: 'subStatPct',   label: '副屬性 %' },
    { value: 'allStatPct',   label: '全屬性 %' },
    { value: 'mainStatFlat', label: '主屬性+（平）' },
    { value: 'subStatFlat',  label: '副屬性+（平）' },
    { value: 'allStatFlat',  label: '全屬性+（平）' },
    { value: 'atkPct',       label: 'ATK %' },
    { value: 'atkFlat',      label: 'ATK+（平）' },
    { value: 'bossDmg',      label: 'BOSS傷害 %' },
    { value: 'totalDmg',     label: '總傷害 %' },
    { value: 'critRate',     label: '爆擊率 %' },
    { value: 'critDmg',      label: '爆擊傷害 %' },
    { value: 'ignoreDef',    label: '無視防禦 %' },
  ]

  // 使用者輸入的「想換成的潛能」（最多 3 行）
  const potCompareNew = Vue.ref([
    { type: 'none', value: 0 },
    { type: 'none', value: 0 },
    { type: 'none', value: 0 },
  ])

  // 把目前選中裝備槽的潛能貢獻從 totals 中扣除 → 算出「沒有這組潛能」的基底
  function _subtractPotLines(t, potLines) {
    const adj = {
      flatMain: t.flatMain, flatSub: t.flatSub, flatAtk: t.flatAtk,
      pctMain:  t.pctMain,  pctSub:  t.pctSub,  pctAtk:  t.pctAtk,
      critRate: t.critRate, critDmg: t.critDmg,
      bossDmg:  t.bossDmg,  totalDmg: t.totalDmg,
      ignoreDefTotal: t.ignoreDefTotal,
    }
    for (const line of potLines) {
      const v = Number(line.value) || 0
      if (!v || line.type === 'none') continue
      switch (line.type) {
        case 'mainStatPct':  adj.pctMain  -= v; break
        case 'subStatPct':   adj.pctSub   -= v; break
        case 'allStatPct':   adj.pctMain  -= v; adj.pctSub -= v; break
        case 'mainStatFlat': adj.flatMain -= v; break
        case 'subStatFlat':  adj.flatSub  -= v; break
        case 'allStatFlat':  adj.flatMain -= v; adj.flatSub -= v; break
        case 'atkFlat':      adj.flatAtk  -= v; break
        case 'atkPct':       adj.pctAtk   -= v; break
        case 'critRate':     adj.critRate -= v; break
        case 'critDmg':      adj.critDmg  -= v; break
        case 'bossDmg':      adj.bossDmg  -= v; break
        case 'totalDmg':     adj.totalDmg -= v; break
        // ignoreDef 用乘法堆疊，暫略（誤差極小）
      }
    }
    return adj
  }

  // 從扣除後的 totals 重推關鍵戰鬥數值（_calcPotGain 需要的欄位）
  function _derivedR(t_adj) {
    const finalMain     = (Number(baseStats.value.mainStat) || 0) + t_adj.flatMain
    const finalSub      = (Number(baseStats.value.subStat)  || 0) + t_adj.flatSub
    const finalAtk      = (Number(baseStats.value.atk)      || 0) + t_adj.flatAtk
    const finalAtkPct   = t_adj.pctAtk
    const realFinalMain = Math.floor(finalMain * (1 + t_adj.pctMain / 100))
    const realFinalSub  = Math.floor(finalSub  * (1 + t_adj.pctSub  / 100))
    const step1         = 4 * realFinalMain + realFinalSub
    return { finalMain, finalSub, finalAtk, finalAtkPct, step1 }
  }

  // 計算一組潛能詞條對傷害的邊際增益（以基底 r, t 為參考點）
  function _calcPotGain(lines, r, t, s) {
    if (!r.step1 || !r.finalAtk) return { bossPct: 0, mobPct: 0 }
    const { step1, finalMain, finalSub, finalAtk, finalAtkPct } = r
    const { pctMain, pctSub, bossDmg: bossDmgNow, totalDmg: totalDmgNow } = t

    const agg = {}
    for (const line of lines) {
      const v = Number(line.value) || 0
      if (!v || line.type === 'none') continue
      agg[line.type] = (agg[line.type] || 0) + v
    }

    let bossPct = 0, mobPct = 0
    for (const [type, val] of Object.entries(agg)) {
      switch (type) {
        case 'mainStatPct': {
          const g = step1 > 0 ? (4 * finalMain * val / 100 / step1) * 100 : 0
          bossPct += g; mobPct += g; break
        }
        case 'subStatPct': {
          const g = step1 > 0 ? (finalSub * val / 100 / step1) * 100 : 0
          bossPct += g; mobPct += g; break
        }
        case 'allStatPct': {
          const g = step1 > 0 ? ((4 * finalMain + finalSub) * val / 100 / step1) * 100 : 0
          bossPct += g; mobPct += g; break
        }
        case 'atkPct': {
          const g = (100 + finalAtkPct) > 0 ? (val / (100 + finalAtkPct)) * 100 : 0
          bossPct += g; mobPct += g; break
        }
        case 'bossDmg': {
          const base = 100 + bossDmgNow + totalDmgNow
          bossPct += base > 0 ? (val / base) * 100 : 0
          break
        }
        case 'totalDmg': {
          const bossBase = 100 + bossDmgNow + totalDmgNow
          const mobBase  = 100 + totalDmgNow
          bossPct += bossBase > 0 ? (val / bossBase) * 100 : 0
          mobPct  += mobBase  > 0 ? (val / mobBase)  * 100 : 0
          break
        }
        case 'mainStatFlat': {
          const g = step1 > 0 ? (4 * (1 + pctMain / 100) * val / step1) * 100 : 0
          bossPct += g; mobPct += g; break
        }
        case 'subStatFlat': {
          const g = step1 > 0 ? ((1 + pctSub / 100) * val / step1) * 100 : 0
          bossPct += g; mobPct += g; break
        }
        case 'allStatFlat': {
          const g = step1 > 0 ? ((4 * (1 + pctMain / 100) + (1 + pctSub / 100)) * val / step1) * 100 : 0
          bossPct += g; mobPct += g; break
        }
        case 'atkFlat': {
          const g = finalAtk > 0 ? (val / finalAtk) * 100 : 0
          bossPct += g; mobPct += g; break
        }
        case 'critRate': {
          if (!s) break
          const totalCR  = Math.min(100, (Number(s.critRate) || 0) + (t.critRate || 0))
          const totalCDM = (Number(s.maxCritBonus) || 0) + (t.critDmg || 0)
          const minC     = Number(s.minCritBonus) || 0
          const critM    = 1 + totalCR / 100 * (minC + totalCDM) / 200
          const addedCR  = Math.min(val, 100 - totalCR)
          const newCritM = 1 + (totalCR + addedCR) / 100 * (minC + totalCDM) / 200
          const g = critM > 0 ? (newCritM / critM - 1) * 100 : 0
          bossPct += g; mobPct += g; break
        }
        case 'critDmg': {
          if (!s) break
          const totalCR  = Math.min(100, (Number(s.critRate) || 0) + (t.critRate || 0))
          const totalCDM = (Number(s.maxCritBonus) || 0) + (t.critDmg || 0)
          const minC     = Number(s.minCritBonus) || 0
          const critM    = 1 + totalCR / 100 * (minC + totalCDM) / 200
          const newCritM = 1 + totalCR / 100 * (minC + totalCDM + val) / 200
          const g = critM > 0 ? (newCritM / critM - 1) * 100 : 0
          bossPct += g; mobPct += g; break
        }
        case 'ignoreDef': {
          if (!s) break
          const ignEff        = (t.ignoreDefTotal || 0) / 100
          const bossDefPct    = (Number(s.bossDefPct)    || 0) / 100
          const monsterDefPct = (Number(s.monsterDefPct) || 0) / 100
          const step6Boss     = 1 - bossDefPct    * (1 - ignEff)
          const step6Mob      = 1 - monsterDefPct * (1 - ignEff)
          const newIgnEff     = 1 - (1 - ignEff) * (1 - val / 100)
          const newStep6Boss  = 1 - bossDefPct    * (1 - newIgnEff)
          const newStep6Mob   = 1 - monsterDefPct * (1 - newIgnEff)
          bossPct += step6Boss > 0 ? (newStep6Boss / step6Boss - 1) * 100 : 0
          mobPct  += step6Mob  > 0 ? (newStep6Mob  / step6Mob  - 1) * 100 : 0
          break
        }
      }
    }
    return { bossPct, mobPct }
  }

  // 比較結果：目前選中裝備槽的潛能 vs 使用者輸入的新潛能
  // 基底（t_base / r_base）先扣除目前潛能，確保兩者在同一起跑線比較
  const potCompareResult = Vue.computed(() => {
    const t   = totals.value
    const s   = equipSettings.value
    const currentPot = selectedSlot.value?.potential || []
    const t_base = _subtractPotLines(t, currentPot)
    const r_base = _derivedR(t_base)
    const currentGain = _calcPotGain(currentPot,           r_base, t_base, s)
    const newGain     = _calcPotGain(potCompareNew.value,  r_base, t_base, s)
    return {
      slotName: selectedSlot.value?.name || '',
      current:  currentGain,
      new:      newGain,
      net: {
        bossPct: newGain.bossPct - currentGain.bossPct,
        mobPct:  newGain.mobPct  - currentGain.mobPct,
      },
    }
  })

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
    baseStats, equipSettings, useEquipSlots,
    slots, selectedSlotId, selectedSlot,
    jobSkills, activeBuffs,
    totals, dmgResult, attackStatRatio, onePercentMainEquivFlat, oneAtkEquivMain,
    potions, potionTotals,
    upgradeEfficiencyBoss, upgradeEfficiencyMob,
    oneMainFlatGain, oneAtkFlatGain,
    POT_COMPARE_TYPES, potCompareNew, potCompareResult,
    getState, setState,
    initJobSkills, initPartyBuffs, importFromTab1,
  }
}
