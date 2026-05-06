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

  const VALID_ATK = new Set([5, 7, 9, 10, 11, 12, 14, 15, 17, 20])
  const ATK_3SLOT = [5, 7, 9, 10, 12, 15]
  const ATK_4SLOT = [11, 14, 17, 20]

  // ── 狀態 ──────────────────────────────────────────────────
  const goldPrice    = ref(0)
  const crystalPrice = ref(0)

  const scrollCosts = ref(Object.fromEntries(SCROLLS.map(s => [s.id, 0])))

  const hammer50  = ref(0)
  const hammer100 = ref(0)

  // 潛能卷成本（萬）
  const pot70Price = ref(0)
  const pot90Price = ref(0)

  const marketPrices = ref(
    Object.fromEntries(
      [...VALID_ATK].flatMap(atk => [
        [`${atk}_no`,  0],
        [`${atk}_yes`, 0],
      ])
    )
  )

  const batch = ref({
    slots:  ['p10_str', 'p10_str', 'p10_str'],
    hammer: 'none',
    slot4:  'p10_str',
    qty:    10,
  })

  const heart = ref({
    slots: [
      { scrollId: 'p10_str', result: 'unused' },
      { scrollId: 'p10_str', result: 'unused' },
      { scrollId: 'p10_str', result: 'unused' },
    ],
    hasPotential: false,
    hammerUsed:   false,
    slot4: { scrollId: 'p10_str', result: 'unused' },
  })

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
      pot70Price:   pot70Price.value,
      pot90Price:   pot90Price.value,
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
    pot70Price.value   = s.pot70Price   ?? 0
    pot90Price.value   = s.pot90Price   ?? 0
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

  // ── 計算：材料成本 ────────────────────────────────────────
  const materialCost = computed(() =>
    3 * (goldPrice.value || 0) + 10 + 4 * (crystalPrice.value || 0)
  )

  // ── 計算：市價查詢 ────────────────────────────────────────
  function getMarketPrice(atk, hasPotential) {
    if (!VALID_ATK.has(atk)) return 0
    return marketPrices.value[`${atk}_${hasPotential ? 'yes' : 'no'}`] || 0
  }

  function expectedMarketValue(atk) {
    return 0.9 * getMarketPrice(atk, false) + 0.1 * getMarketPrice(atk, true)
  }

  // ── 計算：批量分析 ────────────────────────────────────────
  const batchAnalysis = computed(() => {
    const slots  = batch.value.slots.map(id => SCROLLS.find(s => s.id === id))
    const hammer = batch.value.hammer
    const s4     = SCROLLS.find(s => s.id === batch.value.slot4)

    if (slots.some(s => !s)) return null

    const hammerExpCost =
      hammer === '50'  ? 2 * (hammer50.value  || 0) :
      hammer === '100' ? (hammer100.value || 0) :
      0

    const scrollCostTotal =
      slots.reduce((sum, sc) => sum + (scrollCosts.value[sc.id] || 0), 0) +
      (hammer !== 'none' && s4 ? (scrollCosts.value[s4.id] || 0) : 0)

    const costPerHeart = materialCost.value + scrollCostTotal + hammerExpCost

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

    const raw = (hammer === 'none' || !s4) ? raw3 : raw3.flatMap(o => [
      { prob: o.prob * s4.rate,       atk: o.atk + s4.atk },
      { prob: o.prob * (1 - s4.rate), atk: o.atk           },
    ])

    const grouped = {}
    for (const { prob, atk } of raw) {
      grouped[atk] = (grouped[atk] || 0) + prob
    }

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

  // 潛能卷 EV（成功→有潛能市價，失敗→裝備消失=0）
  // EV vs 現在賣 = rate × P_yes - scrollCost - P_no
  function calcPotEV(rate, scrollCost) {
    const atk    = heartCurrentAtk.value
    const p_no   = getMarketPrice(atk, false)
    const p_yes  = getMarketPrice(atk, true)
    const ev     = rate * p_yes - scrollCost - p_no
    return { rate, scrollCost, p_no, p_yes, ev, ok: ev > 0 }
  }

  const pot70EVResult = computed(() => calcPotEV(0.70, pot70Price.value || 0))
  const pot90EVResult = computed(() => calcPotEV(0.90, pot90Price.value || 0))

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
    pot70Price, pot90Price, pot70EVResult, pot90EVResult,
    getState, setState, resetHeart,
  }
}
