function useHeartFactory() {
  const { ref, computed } = Vue

  // ── 常數 ──────────────────────────────────────────────────
  const SCROLLS = [
    { id: 'p10_str', name: '5攻3力',   rate: 0.10, atk: 5, subs: { str: 3 }, magic: false },
    { id: 'p10_dex', name: '5攻1敏',   rate: 0.10, atk: 5, subs: { dex: 1 }, magic: false },
    { id: 'p10_luk', name: '5攻3幸',   rate: 0.10, atk: 5, subs: { luk: 3 }, magic: false },
    { id: 'p10_int', name: '5魔攻3智', rate: 0.10, atk: 5, subs: { int: 3 }, magic: true  },
    { id: 'p60_str', name: '2攻1力',   rate: 0.60, atk: 2, subs: { str: 1 }, magic: false },
    { id: 'p60_atk', name: '2攻',      rate: 0.60, atk: 2, subs: {},         magic: false },
    { id: 'p60_luk', name: '2攻1幸',   rate: 0.60, atk: 2, subs: { luk: 1 }, magic: false },
    { id: 'p60_int', name: '2魔攻1智', rate: 0.60, atk: 2, subs: { int: 1 }, magic: true  },
  ]

  function isMixedMagic(scrollList) {
    const hasMagic    = scrollList.some(s => s && s.magic)
    const hasPhysical = scrollList.some(s => s && !s.magic)
    return hasMagic && hasPhysical
  }

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

  // 市價卡片展開/折疊：key = atk數值，false = 折疊，undefined/true = 展開
  const marketPriceFilter = ref({})

  const batch = ref({
    slots:  ['p10_str', 'p10_str', 'p10_str'],
    hammer: 'none',
    slot4:  'p10_str',
    qty:    10,
  })

  const optimizer = ref({ hammerType: 'none', qty: 40 })

  const condStrategy = ref({
    scroll10:       'p10_str',
    scroll60:       'p60_atk',
    synthCost:      3,
    synthFrameRate: 1,
    qty:            40,
  })

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
      marketPrices:       { ...marketPrices.value },
      marketPriceFilter:  { ...marketPriceFilter.value },
      batch:              JSON.parse(JSON.stringify(batch.value)),
      optimizer:    { ...optimizer.value },
      condStrategy: { ...condStrategy.value },
    }
  }

  function setState(s) {
    if (!s) return
    goldPrice.value    = s.goldPrice    ?? 0
    crystalPrice.value = s.crystalPrice ?? 0
    if (s.scrollCosts)   Object.assign(scrollCosts.value,   s.scrollCosts)
    hammer50.value     = s.hammer50     ?? 0
    hammer100.value    = s.hammer100    ?? 0
    pot70Price.value   = s.pot70Price   ?? 0
    pot90Price.value   = s.pot90Price   ?? 0
    auctionFee.value   = s.auctionFee   ?? 3
    if (s.marketPrices)       Object.assign(marketPrices.value,       s.marketPrices)
    if (s.marketPriceFilter)  Object.assign(marketPriceFilter.value,  s.marketPriceFilter)
    if (s.batch)              Object.assign(batch.value,              s.batch)
    if (s.optimizer)     Object.assign(optimizer.value,     s.optimizer)
    if (s.condStrategy)  Object.assign(condStrategy.value,  s.condStrategy)
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

  // 空白（未填）→ null；填了（包含0）→ 數字
  function getNetPriceNullable(atk, subs, hasPotential) {
    if (!VALID_ATK.has(atk)) return null
    const raw = marketPrices.value[`${atk}_${subsKey(subs)}_${hasPotential ? 'yes' : 'no'}`]
    if (raw === undefined || raw === null || raw === '' || (typeof raw === 'number' && isNaN(raw))) return null
    return Number(raw) * (1 - (auctionFee.value || 0) / 100)
  }

  // 兩格都空白 → null（不知道市價）；否則空白那格當 0 計算
  function expectedMarketValueNullable(atk, subs) {
    const netNo  = getNetPriceNullable(atk, subs, false)
    const netYes = getNetPriceNullable(atk, subs, true)
    if (netNo === null && netYes === null) return null
    return 0.9 * (netNo ?? 0) + 0.1 * (netYes ?? 0)
  }

  function expectedMarketValue(atk, subs) {
    return 0.9 * getNetPrice(atk, subs, false) + 0.1 * getNetPrice(atk, subs, true)
  }

  // ── 條件點法＋合成回收分析 ─────────────────────────────────────
  const condStrategyAnalysis = computed(() => {
    const sc10 = SCROLLS.find(s => s.id === condStrategy.value.scroll10)
    const sc60 = SCROLLS.find(s => s.id === condStrategy.value.scroll60)
    if (!sc10 || !sc60) return null

    const p  = sc10.rate
    const q  = sc60.rate
    const qty = condStrategy.value.qty || 1
    const synthCost  = condStrategy.value.synthCost  ?? 0
    const frameRate  = (condStrategy.value.synthFrameRate ?? 0) / 100

    // 廢品 = 兩張10%都沒過
    const pScrap   = (1 - p) * (1 - p)
    const pSuccess = 1 - pScrap

    // 期望卷軸成本：
    //  槽1 (10%): 固定 c10
    //  槽2: 若槽1過 → c60；若槽1沒過 → c10
    //  槽3: 若槽1過 → c60；若槽1沒過且槽2過 → c60；兩者都沒過 → 不用
    const c10 = scrollCosts.value[sc10.id] || 0
    const c60 = scrollCosts.value[sc60.id] || 0
    const scrollCostPerHeart =
      c10 +
      p * c60 + (1 - p) * c10 +
      p * c60 + (1 - p) * p * c60

    const baseCostPerHeart = materialCost.value + scrollCostPerHeart

    // 枚舉出心結果
    const rawOutcomes = []
    const tryAdd = (atk, subs, prob) => {
      if (VALID_ATK.has(atk) && prob > 0) rawOutcomes.push({ atk, subs, prob })
    }
    // 9攻: 槽1過 + 兩槽60%都過
    tryAdd(sc10.atk + 2 * sc60.atk, addSubs(sc10.subs, addSubs(sc60.subs, sc60.subs)), p * q * q)
    // 7攻: (槽1過 + 只有一槽60%過) OR (槽1沒過 + 槽2過 + 槽3過)
    tryAdd(sc10.atk + sc60.atk, addSubs(sc10.subs, sc60.subs), p * 2 * q * (1 - q) + (1 - p) * p * q)
    // 5攻: (槽1過 + 兩槽60%都沒過) OR (槽1沒過 + 槽2過 + 槽3沒過)
    tryAdd(sc10.atk, { ...sc10.subs }, p * (1 - q) * (1 - q) + (1 - p) * p * (1 - q))

    const outcomes = rawOutcomes
      .sort((a, b) => b.atk - a.atk)
      .map(o => ({
        ...o,
        label:  subsLabel(o.subs),
        netNo:  getNetPrice(o.atk, o.subs, false),
        netYes: getNetPrice(o.atk, o.subs, true),
        expVal: expectedMarketValue(o.atk, o.subs),
      }))

    const expRevPerHeart = outcomes.reduce((s, o) => s + o.prob * o.expVal, 0)

    // 合成回收：連續近似  s = pScrap
    //  從 qty 顆出發，總衝卷數 = 2*qty/(2-s)，合成數 = qty*s/(2-s)
    const s = pScrap
    const totalScrolled    = 2 * qty / (2 - s)
    const totalSynthesized = totalScrolled - qty
    const totalUsable      = totalScrolled * pSuccess

    // 合成出框加成：合成出的可賣心有 frameRate 機率多有潛能
    const avgNetDiff = pSuccess > 0
      ? outcomes.reduce((sum, o) => sum + (o.prob / pSuccess) * (o.netYes - o.netNo), 0)
      : 0
    const totalFrameBonus = totalSynthesized * pSuccess * frameRate * avgNetDiff

    // 總成本 = 初始材料 + 全部卷軸費 + 合成費
    const totalCost    = qty * materialCost.value + totalScrolled * scrollCostPerHeart + totalSynthesized * synthCost
    const totalRevenue = totalScrolled * expRevPerHeart + totalFrameBonus
    const totalProfit  = totalRevenue - totalCost
    const effCostPerUsable = totalUsable > 0 ? totalCost / totalUsable : Infinity

    return {
      sc10, sc60, pScrap, pSuccess,
      scrollCostPerHeart, baseCostPerHeart,
      outcomes, expRevPerHeart,
      qty, totalScrolled, totalSynthesized, totalUsable,
      totalCost, totalRevenue, totalFrameBonus, totalProfit, effCostPerUsable,
    }
  })

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
      if (isMixedMagic(slots3)) continue
      for (let mask = 1; mask < 8; mask++) {
        let atk = 0; const subs = {}
        for (let b = 0; b < 3; b++) {
          if ((mask >> (2-b)) & 1) { atk += slots3[b].atk; for (const [sk, sv] of Object.entries(slots3[b].subs)) subs[sk] = (subs[sk]||0)+sv }
        }
        add(atk, subs)
      }
      // 4-slot combos (with hammer slot = any scroll)
      for (const s4 of SCROLLS) {
        if (isMixedMagic([...slots3, s4])) continue
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

  // ── 最佳策略排行（含回收）──────────────────────────────────────
  const strategyRanking = computed(() => {
    const hammerType    = optimizer.value.hammerType
    const qty           = optimizer.value.qty || 1
    const hammerExpCost =
      hammerType === '50'  ? 2 * (hammer50.value  || 0) :
      hammerType === '100' ? (hammer100.value || 0) : 0
    const synthCost  = condStrategy.value.synthCost ?? 0
    const frameRate  = (condStrategy.value.synthFrameRate ?? 0) / 100

    const results = []

    for (let i = 0; i < 8; i++) {
      for (let j = i; j < 8; j++) {
        for (let k = j; k < 8; k++) {
          const slots3 = [SCROLLS[i], SCROLLS[j], SCROLLS[k]]
          if (isMixedMagic(slots3)) continue
          const s4List = hammerType === 'none' ? [null] : SCROLLS

          for (const s4 of s4List) {
            if (s4 && isMixedMagic([...slots3, s4])) continue

            const scrollCostTotal =
              slots3.reduce((s, sc) => s + (scrollCosts.value[sc.id] || 0), 0) +
              (s4 ? (scrollCosts.value[s4.id] || 0) : 0)
            const costPerHeart = materialCost.value + scrollCostTotal + hammerExpCost

            // enumerate & aggregate
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

            // 聚合
            const grouped = new Map()
            for (const { prob, atk, subs } of raw) {
              const k = `${atk}_${subsKey(subs)}`
              if (!grouped.has(k)) grouped.set(k, { atk, subs, prob: 0 })
              grouped.get(k).prob += prob
            }

            // 分類：廢品（回收）/ 空白（不知道）/ 可賣
            let pScrap = 0, expRevPerHeart = 0
            const outcomes = []
            for (const { atk, subs, prob } of grouped.values()) {
              const valid = VALID_ATK.has(atk)
              const ev    = valid ? expectedMarketValueNullable(atk, subs) : null
              // 0元 也算廢品（回收）; null = 不知道; >0 = 可賣
              const isScrap   = !valid || ev === 0
              const isUnknown = valid && ev === null
              if (isScrap)        pScrap         += prob
              else if (!isUnknown) expRevPerHeart += prob * ev
              outcomes.push({ atk, subs, label: subsLabel(subs), prob, ev, isScrap, isUnknown })
            }
            outcomes.sort((a, b) => b.atk - a.atk || a.label.localeCompare(b.label))

            // 回收計算（連續近似）
            const s = pScrap
            const totalScrolled    = qty * 2 / (2 - s)
            const totalSynthesized = totalScrolled - qty
            const synthHeartCost   = synthCost + scrollCostTotal + hammerExpCost
            const totalCost        = qty * costPerHeart + totalSynthesized * synthHeartCost

            // 合成出框加成
            const pSell = outcomes.filter(o => !o.isScrap && !o.isUnknown).reduce((a, o) => a + o.prob, 0)
            const avgNetDiff = pSell > 0
              ? outcomes.filter(o => !o.isScrap && !o.isUnknown)
                  .reduce((a, o) => a + (o.prob / pSell) * ((getNetPriceNullable(o.atk, o.subs, true) ?? 0) - (getNetPriceNullable(o.atk, o.subs, false) ?? 0)), 0)
              : 0
            const totalFrameBonus  = totalSynthesized * pSell * frameRate * avgNetDiff
            const totalRevenue     = totalScrolled * expRevPerHeart + totalFrameBonus
            const totalProfit      = totalRevenue - totalCost
            const expProfitPerHeart = totalProfit / qty

            const label = slots3.map(s => s.name).join(' / ') + (s4 ? ` + 🔨${s4.name}` : '')
            results.push({
              label, costPerHeart, scrollCostTotal,
              pScrap, expRevPerHeart,
              totalScrolled, totalSynthesized,
              totalCost, totalRevenue, totalProfit,
              expProfit: expProfitPerHeart,
              outcomes,
            })
          }
        }
      }
    }

    results.sort((a, b) => b.totalProfit - a.totalProfit)
    return results.slice(0, 15)
  })

  return {
    SCROLLS, VALID_ATK,
    goldPrice, crystalPrice,
    scrollCosts, hammer50, hammer100,
    pot70Price, pot90Price,
    auctionFee,
    marketPrices, marketPriceFilter,
    batch, optimizer,
    materialCost,
    condStrategy, condStrategyAnalysis,
    allOutcomes, batchOutcomes, batchAnalysis, strategyRanking,
    getState, setState,
  }
}
