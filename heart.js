function useHeartFactory() {
  const { ref, computed } = Vue

  // ── 常數 ──────────────────────────────────────────────────
  const SCROLLS = [
    { id: 'p10_str', name: '5攻3力',   rate: 0.10, atk: 5, subs: { str: 3 } },
    { id: 'p10_dex', name: '5攻1敏',   rate: 0.10, atk: 5, subs: { dex: 1 } },
    { id: 'p10_luk', name: '5攻3幸',   rate: 0.10, atk: 5, subs: { luk: 3 } },
    { id: 'p10_int', name: '5魔攻3智', rate: 0.10, atk: 5, subs: { int: 3 } },
    { id: 'p60_str', name: '2攻1力',   rate: 0.60, atk: 2, subs: { str: 1 } },
    { id: 'p60_atk', name: '2攻',      rate: 0.60, atk: 2, subs: {} },
    { id: 'p60_luk', name: '2攻1幸',   rate: 0.60, atk: 2, subs: { luk: 1 } },
    { id: 'p60_int', name: '2魔攻1智', rate: 0.60, atk: 2, subs: { int: 1 } },
  ]

  const VALID_ATK = new Set([5, 7, 9, 10, 11, 12, 14, 15, 17, 20])

  // ── 副屬性工具函式 ─────────────────────────────────────────

  // 市價查詢用的 canonical key，如 "dex1str2"
  function subsKey(subs) {
    const s = Object.entries(subs)
      .filter(([, v]) => v > 0)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}${v}`)
      .join('')
    return s || '_'
  }

  // 顯示用，如 "1敏2力"
  function subsLabel(subs) {
    const parts = []
    if (subs.dex) parts.push(`${subs.dex}敏`)
    if (subs.luk) parts.push(`${subs.luk}幸`)
    if (subs.int) parts.push(`${subs.int}智`)
    if (subs.str) parts.push(`${subs.str}力`)
    return parts.join('') || '無副屬'
  }

  function addSubs(a, b) {
    const r = { ...a }
    for (const [k, v] of Object.entries(b)) r[k] = (r[k] || 0) + v
    return r
  }

  // ── 狀態 ──────────────────────────────────────────────────
  const goldPrice    = ref(0)
  const crystalPrice = ref(0)
  const scrollCosts  = ref(Object.fromEntries(SCROLLS.map(s => [s.id, 0])))
  const hammer50     = ref(0)
  const hammer100    = ref(0)
  const pot70Price   = ref(0)
  const pot90Price   = ref(0)
  const auctionFee   = ref(3)

  // 市價：key = `${atk}_${subsKey}_no/yes`（舊格式 `${atk}_no` 不相容，需重填）
  const marketPrices = ref({})

  const batch = ref({
    slots:  ['p10_str', 'p10_str', 'p10_str'],
    hammer: 'none',
    slot4:  'p10_str',
    qty:    10,
  })

  const optimizer = ref({ hammerType: 'none', qty: 40 })

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
      auctionFee:   auctionFee.value,
      marketPrices: { ...marketPrices.value },
      batch:        JSON.parse(JSON.stringify(batch.value)),
      optimizer:    { ...optimizer.value },
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
    auctionFee.value   = s.auctionFee   ?? 3
    if (s.marketPrices) Object.assign(marketPrices.value, s.marketPrices)
    if (s.batch)        Object.assign(batch.value,        s.batch)
    if (s.optimizer)    Object.assign(optimizer.value,    s.optimizer)
  }

  // ── 材料成本 ───────────────────────────────────────────────
  const materialCost = computed(() =>
    3 * (goldPrice.value || 0) + 10 + 4 * (crystalPrice.value || 0)
  )

  // ── 市價查詢 ───────────────────────────────────────────────
  function getMarketPrice(atk, subs, hasPotential) {
    if (!VALID_ATK.has(atk)) return 0
    return marketPrices.value[`${atk}_${subsKey(subs)}_${hasPotential ? 'yes' : 'no'}`] || 0
  }

  function getNetPrice(atk, subs, hasPotential) {
    return getMarketPrice(atk, subs, hasPotential) * (1 - (auctionFee.value || 0) / 100)
  }

  function expectedMarketValue(atk, subs) {
    return 0.9 * getNetPrice(atk, subs, false) + 0.1 * getNetPrice(atk, subs, true)
  }

  // ── 枚舉所有策略可能出現的非廢品結果（供市價表格使用）─────────
  const allOutcomes = computed(() => {
    const seen = new Set()
    const list = []
    const add = (atk, subs) => {
      if (!VALID_ATK.has(atk)) return
      const kb = `${atk}_${subsKey(subs)}`
      if (seen.has(kb)) return
      seen.add(kb)
      list.push({ atk, subs, label: subsLabel(subs), keyNo: `${kb}_no`, keyYes: `${kb}_yes` })
    }
    // 3-slot combos (all unordered with repetition)
    for (let i = 0; i < 8; i++) for (let j = i; j < 8; j++) for (let k = j; k < 8; k++) {
      const slots3 = [SCROLLS[i], SCROLLS[j], SCROLLS[k]]
      for (let mask = 1; mask < 8; mask++) {
        let atk = 0; const subs = {}
        for (let b = 0; b < 3; b++) {
          if ((mask >> (2-b)) & 1) { atk += slots3[b].atk; for (const [sk, sv] of Object.entries(slots3[b].subs)) subs[sk] = (subs[sk]||0)+sv }
        }
        add(atk, subs)
      }
      // 4-slot combos (with hammer slot = any scroll)
      for (const s4 of SCROLLS) {
        const slots4 = [...slots3, s4]
        for (let mask = 1; mask < 16; mask++) {
          let atk = 0; const subs = {}
          for (let b = 0; b < 4; b++) {
            if ((mask >> (3-b)) & 1) { atk += slots4[b].atk; for (const [sk, sv] of Object.entries(slots4[b].subs)) subs[sk] = (subs[sk]||0)+sv }
          }
          add(atk, subs)
        }
      }
    }
    return list.sort((a, b) => a.atk - b.atk || a.label.localeCompare(b.label))
  })

  // ── 枚舉目前批量策略的非廢品結果（供批量分析使用）────────────
  const batchOutcomes = computed(() => {
    const slots  = batch.value.slots.map(id => SCROLLS.find(s => s.id === id))
    const hammer = batch.value.hammer
    const s4     = SCROLLS.find(s => s.id === batch.value.slot4)
    if (slots.some(s => !s)) return []

    const raw3 = []
    for (let mask = 0; mask < 8; mask++) {
      let atk = 0
      const subs = {}
      for (let j = 0; j < 3; j++) {
        if ((mask >> (2 - j)) & 1) {
          atk += slots[j].atk
          for (const [k, v] of Object.entries(slots[j].subs)) subs[k] = (subs[k] || 0) + v
        }
      }
      raw3.push({ atk, subs })
    }

    const all = (hammer === 'none' || !s4) ? raw3 : raw3.flatMap(o => [
      { atk: o.atk + s4.atk, subs: addSubs(o.subs, s4.subs) },
      { atk: o.atk,           subs: { ...o.subs } },
    ])

    const seen = new Set()
    const list = []
    for (const o of all) {
      if (!VALID_ATK.has(o.atk)) continue
      const kb = `${o.atk}_${subsKey(o.subs)}`
      if (seen.has(kb)) continue
      seen.add(kb)
      list.push({
        atk:    o.atk,
        subs:   o.subs,
        label:  subsLabel(o.subs),
        keyNo:  `${kb}_no`,
        keyYes: `${kb}_yes`,
      })
    }
    return list.sort((a, b) => a.atk - b.atk || a.label.localeCompare(b.label))
  })

  // ── 批量分析 ───────────────────────────────────────────────
  const batchAnalysis = computed(() => {
    const slots  = batch.value.slots.map(id => SCROLLS.find(s => s.id === id))
    const hammer = batch.value.hammer
    const s4     = SCROLLS.find(s => s.id === batch.value.slot4)
    if (slots.some(s => !s)) return null

    const hammerExpCost =
      hammer === '50'  ? 2 * (hammer50.value  || 0) :
      hammer === '100' ? (hammer100.value || 0) : 0

    const scrollCostTotal =
      slots.reduce((s, sc) => s + (scrollCosts.value[sc.id] || 0), 0) +
      (hammer !== 'none' && s4 ? (scrollCosts.value[s4.id] || 0) : 0)

    const costPerHeart = materialCost.value + scrollCostTotal + hammerExpCost

    // 枚舉 3 槽，追蹤副屬性
    const raw3 = []
    for (let mask = 0; mask < 8; mask++) {
      let prob = 1, atk = 0
      const subs = {}
      for (let j = 0; j < 3; j++) {
        const bit = (mask >> (2 - j)) & 1
        prob *= bit ? slots[j].rate : (1 - slots[j].rate)
        if (bit) {
          atk += slots[j].atk
          for (const [k, v] of Object.entries(slots[j].subs)) subs[k] = (subs[k] || 0) + v
        }
      }
      raw3.push({ prob, atk, subs })
    }

    const raw = (hammer === 'none' || !s4) ? raw3 : raw3.flatMap(o => [
      { prob: o.prob * s4.rate,       atk: o.atk + s4.atk, subs: addSubs(o.subs, s4.subs) },
      { prob: o.prob * (1 - s4.rate), atk: o.atk,          subs: { ...o.subs } },
    ])

    // 按 (atk, subsKey) 聚合
    const grouped = new Map()
    for (const { prob, atk, subs } of raw) {
      const k = `${atk}_${subsKey(subs)}`
      if (!grouped.has(k)) grouped.set(k, { atk, subs, prob: 0 })
      grouped.get(k).prob += prob
    }

    const table = [...grouped.values()]
      .map(({ atk, subs, prob }) => {
        const netNo  = getNetPrice(atk, subs, false)
        const netYes = getNetPrice(atk, subs, true)
        const expVal = VALID_ATK.has(atk) ? (0.9 * netNo + 0.1 * netYes) : 0
        return {
          atk, subs,
          label:          subsLabel(subs),
          prob,
          netNo, netYes, expVal,
          profit:         expVal - costPerHeart,
          expectedInBatch: prob * (batch.value.qty || 1),
          heartsPerOne:   prob > 0 ? 1 / prob : Infinity,
          valid:          VALID_ATK.has(atk),
        }
      })
      .sort((a, b) => a.atk - b.atk || a.label.localeCompare(b.label))

    const validTable      = table.filter(r => r.valid)
    const wasteProb       = table.filter(r => !r.valid).reduce((s, r) => s + r.prob, 0)
    const totalExpRevenue = table.reduce((s, r) => s + r.prob * r.expVal, 0)

    return {
      costPerHeart, hammerExpCost, scrollCostTotal,
      table: validTable, wasteProb, totalExpRevenue,
      expProfit:   totalExpRevenue - costPerHeart,
      totalBudget: costPerHeart * (batch.value.qty || 1),
    }
  })

  // ── 最佳策略排行 ───────────────────────────────────────────
  const strategyRanking = computed(() => {
    const hammerType    = optimizer.value.hammerType
    const qty           = optimizer.value.qty || 1
    const hammerExpCost =
      hammerType === '50'  ? 2 * (hammer50.value  || 0) :
      hammerType === '100' ? (hammer100.value || 0) : 0

    const results = []

    for (let i = 0; i < 8; i++) {
      for (let j = i; j < 8; j++) {
        for (let k = j; k < 8; k++) {
          const slots3 = [SCROLLS[i], SCROLLS[j], SCROLLS[k]]
          const s4List = hammerType === 'none' ? [null] : SCROLLS

          for (const s4 of s4List) {
            const scrollCostTotal =
              slots3.reduce((s, sc) => s + (scrollCosts.value[sc.id] || 0), 0) +
              (s4 ? (scrollCosts.value[s4.id] || 0) : 0)
            const costPerHeart = materialCost.value + scrollCostTotal + hammerExpCost

            const raw3 = []
            for (let mask = 0; mask < 8; mask++) {
              let prob = 1, atk = 0
              const subs = {}
              for (let b = 0; b < 3; b++) {
                const bit = (mask >> (2 - b)) & 1
                prob *= bit ? slots3[b].rate : (1 - slots3[b].rate)
                if (bit) {
                  atk += slots3[b].atk
                  for (const [kk, v] of Object.entries(slots3[b].subs)) subs[kk] = (subs[kk] || 0) + v
                }
              }
              raw3.push({ prob, atk, subs })
            }

            const raw = s4 ? raw3.flatMap(o => [
              { prob: o.prob * s4.rate,       atk: o.atk + s4.atk, subs: addSubs(o.subs, s4.subs) },
              { prob: o.prob * (1 - s4.rate), atk: o.atk,          subs: { ...o.subs } },
            ]) : raw3

            const totalExpRevenue = raw.reduce((sum, o) => sum + o.prob * expectedMarketValue(o.atk, o.subs), 0)
            const expProfit = totalExpRevenue - costPerHeart

            const label = slots3.map(s => s.name).join(' / ') + (s4 ? ` + 🔨${s4.name}` : '')
            results.push({ label, costPerHeart, scrollCostTotal, totalExpRevenue, expProfit, totalProfit: expProfit * qty })
          }
        }
      }
    }

    results.sort((a, b) => b.expProfit - a.expProfit)
    return results.slice(0, 15)
  })

  return {
    SCROLLS, VALID_ATK,
    goldPrice, crystalPrice,
    scrollCosts, hammer50, hammer100,
    pot70Price, pot90Price,
    auctionFee,
    marketPrices,
    batch, optimizer,
    materialCost,
    allOutcomes, batchOutcomes, batchAnalysis, strategyRanking,
    getState, setState,
  }
}
