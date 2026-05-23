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

  const VALID_ATK  = new Set([5, 7, 9, 10, 11, 12, 14, 15, 17, 20])
  const DIST_ATKS  = [5, 7, 9, 10, 11, 12, 14, 15, 17, 20]

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

  // 批量填入暫存：key = `${atk}_no` / `${atk}_yes`
  const bulkPriceInputs = ref({})

  function applyBulkPrice(atk) {
    const no  = bulkPriceInputs.value[`${atk}_no`]
    const yes = bulkPriceInputs.value[`${atk}_yes`]
    for (const o of allOutcomes.value) {
      if (o.atk !== atk) continue
      if (no  !== undefined && no  !== null && no  !== '' && !isNaN(Number(no)))
        marketPrices.value[o.keyNo]  = Number(no)
      if (yes !== undefined && yes !== null && yes !== '' && !isNaN(Number(yes)))
        marketPrices.value[o.keyYes] = Number(yes)
    }
  }

  const batch = ref({
    slots:  ['p10_str', 'p10_str', 'p10_str'],
    hammer: 'none',
    slot4:  'p10_str',
    qty:    10,
  })

  const optimizer = ref({ hammerType: 'none', qty: 40, hammerMode: 'always' })

  const conditionalHammer = ref({
    hammerType: '50',
    slot4:      'p10_str',
    triggerAtks: [7, 9, 10],
    slots:      ['p10_str', 'p10_str', 'p10_str'],
    qty:        40,
  })

  const condStrategy = ref({
    scroll10:       'p10_str',
    scroll60:       'p60_atk',
    synthCost:      3,
    synthFrameRate: 1,
    qty:            40,
  })

  // ⑧ 補點策略比較
  // ── ⑨ 金之心分配器 ──────────────────────────────────────────
  const distributor = ref({
    members: [
      { name: '玩家1', pct: 50 },
      { name: '玩家2', pct: 50 },
    ],
    hearts: Object.fromEntries(DIST_ATKS.map(a => [a, 0])),
    prices: Object.fromEntries(DIST_ATKS.map(a => [a, 0])),
  })

  function addMember() {
    distributor.value.members.push({ name: `玩家${distributor.value.members.length + 1}`, pct: 0 })
  }
  function removeMember(i) {
    if (distributor.value.members.length <= 2) return
    distributor.value.members.splice(i, 1)
  }

  // 最大剩餘法分配整數顆數
  function largestRemainder(total, pcts, totalPct) {
    if (total <= 0 || totalPct <= 0) return pcts.map(() => 0)
    const exact  = pcts.map(p => total * (Number(p) || 0) / totalPct)
    const floors = exact.map(Math.floor)
    const fracs  = exact.map((e, i) => e - floors[i])
    let leftover = total - floors.reduce((a, b) => a + b, 0)
    const order  = fracs.map((f, i) => ({ f, i })).sort((a, b) => b.f - a.f || a.i - b.i)
    const result = [...floors]
    for (let k = 0; k < leftover; k++) result[order[k].i]++
    return result
  }

  const distributorResult = computed(() => {
    const d       = distributor.value
    const members = d.members
    if (!members || members.length < 2) return null
    const totalPct = members.reduce((s, m) => s + (Number(m.pct) || 0), 0)
    if (Math.abs(totalPct - 100) > 0.01) return { invalid: true, totalPct }

    const activeAtks = DIST_ATKS.filter(atk => (d.hearts[atk] || 0) > 0)
    if (activeAtks.length === 0) return { invalid: false, totalPct, empty: true }

    // allocation[i][atk] = 分配顆數
    const allocation = members.map(() => Object.fromEntries(DIST_ATKS.map(a => [a, 0])))
    const idealVal   = new Array(members.length).fill(0)   // 萬楓幣
    const actualVal  = new Array(members.length).fill(0)

    for (const atk of activeAtks) {
      const qty   = d.hearts[atk] || 0
      const price = d.prices[atk] || 0
      const dist  = largestRemainder(qty, members.map(m => m.pct), totalPct)
      for (let i = 0; i < members.length; i++) {
        allocation[i][atk] = dist[i]
        idealVal[i]  += (Number(members[i].pct) / totalPct) * price * qty
        actualVal[i] += dist[i] * price
      }
    }

    // 餘額：正數＝多拿了（要補錢給別人），負數＝少拿了（別人要補給他）
    const balances = members.map((_, i) => actualVal[i] - idealVal[i])

    // 最簡清算轉帳
    const debtors   = members.map((m, i) => ({ name: m.name, amt:  balances[i] })).filter(x => x.amt >  0.01).sort((a, b) => b.amt - a.amt)
    const creditors = members.map((m, i) => ({ name: m.name, amt: -balances[i] })).filter(x => x.amt >  0.01).sort((a, b) => b.amt - a.amt)
    const transfers = []
    const ds = debtors.map(x => ({ ...x }))
    const cs = creditors.map(x => ({ ...x }))
    let di = 0, ci = 0
    while (di < ds.length && ci < cs.length) {
      const pay = Math.min(ds[di].amt, cs[ci].amt)
      if (pay > 0.01) transfers.push({ from: ds[di].name, to: cs[ci].name, amt: pay })
      ds[di].amt -= pay; cs[ci].amt -= pay
      if (ds[di].amt < 0.01) di++
      if (cs[ci].amt < 0.01) ci++
    }

    return { invalid: false, empty: false, totalPct, activeAtks, allocation, idealVal, actualVal, balances, transfers }
  })

  const adaptiveScroll = ref({
    gate:     'p10_str',   // 10% 關卡卷
    main:     'p60_atk',   // 60% 主卷（slot2，以及 slot3 在主卷有過時）
    fallback: 'skip',      // slot3 在關卡過但主卷沒過時：'skip' 或某 10% 卷 id
    qty:      40,
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
      optimizer:          { ...optimizer.value },
      condStrategy:       { ...condStrategy.value },
      conditionalHammer:  JSON.parse(JSON.stringify(conditionalHammer.value)),
      adaptiveScroll:     { ...adaptiveScroll.value },
      distributor:        JSON.parse(JSON.stringify(distributor.value)),
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
    if (s.batch)             Object.assign(batch.value,             s.batch)
    if (s.optimizer)         Object.assign(optimizer.value,         s.optimizer)
    if (s.condStrategy)      Object.assign(condStrategy.value,      s.condStrategy)
    if (s.conditionalHammer) Object.assign(conditionalHammer.value, JSON.parse(JSON.stringify(s.conditionalHammer)))
    if (s.adaptiveScroll)    Object.assign(adaptiveScroll.value,    s.adaptiveScroll)
    if (s.distributor) {
      if (s.distributor.members) distributor.value.members = s.distributor.members
      if (s.distributor.hearts)  Object.assign(distributor.value.hearts, s.distributor.hearts)
      if (s.distributor.prices)  Object.assign(distributor.value.prices, s.distributor.prices)
    }
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

  // ── 黃金鐵鎚條件使用期望值 ──────────────────────────────────────
  const conditionalHammerAnalysis = computed(() => {
    const ch    = conditionalHammer.value
    const slots = ch.slots.map(id => SCROLLS.find(s => s.id === id))
    const s4    = SCROLLS.find(s => s.id === ch.slot4)
    if (slots.some(s => !s) || !s4) return null

    const triggerSet    = new Set(ch.triggerAtks)
    const hammerCost    = ch.hammerType === '100' ? (hammer100.value || 0) : (hammer50.value || 0)
    const hammerProb    = ch.hammerType === '100' ? 1.0 : 0.5   // 鐵鎚開槽機率
    const scrollRate    = s4.rate                                // 開槽後卷軸過的機率
    const s4ScrollCost  = scrollCosts.value[s4.id] || 0
    // 每次觸發鐵鎚的期望費用：鎚費（必付）+ 開槽後才花卷軸費
    const hammerTotalExpCost = hammerCost + hammerProb * s4ScrollCost
    // 拿到鎚後ATK的最終機率 = 鐵鎚開槽 × 卷軸有過
    const probUp = hammerProb * scrollRate

    const scrollCostTotal  = slots.reduce((sum, sc) => sum + (scrollCosts.value[sc.id] || 0), 0)
    const baseCostPerHeart = materialCost.value + scrollCostTotal

    // 枚舉 3 槽出心
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

    // 聚合相同 (atk, subs) 的機率
    const grouped = new Map()
    for (const { prob, atk, subs } of raw3) {
      const k = `${atk}_${subsKey(subs)}`
      if (!grouped.has(k)) grouped.set(k, { atk, subs, prob: 0 })
      grouped.get(k).prob += prob
    }

    const validTable = []
    let wasteProb = 0

    for (const { atk, subs, prob } of grouped.values()) {
      const valid     = VALID_ATK.has(atk)
      const useHammer = valid && triggerSet.has(atk)
      const label     = subsLabel(subs)

      let netEV = 0, sellBase = 0, sellHammered = null
      let hammeredAtk = null, hammeredLabel = null

      if (valid) {
        sellBase = expectedMarketValue(atk, subs)
        if (useHammer) {
          hammeredAtk   = atk + s4.atk
          const hSubs   = addSubs(subs, s4.subs)
          hammeredLabel = subsLabel(hSubs)
          sellHammered  = VALID_ATK.has(hammeredAtk)
            ? expectedMarketValue(hammeredAtk, hSubs)
            : sellBase
          // 正確機率：鐵鎚開槽（hammerProb）× 卷軸過（scrollRate）才拿到鎚後ATK
          // 鐵鎚失敗 OR 卷軸沒過 → 維持原ATK（sellBase）
          // 費用：鎚費必付；卷軸費只有開槽後才花
          netEV = probUp * sellHammered + (1 - probUp) * sellBase - hammerTotalExpCost
        } else {
          netEV = sellBase
        }
        validTable.push({
          atk, subs, label, prob, useHammer,
          hammeredAtk, hammeredLabel, sellBase, sellHammered,
          netEV,
          profit: netEV - baseCostPerHeart,
        })
      } else {
        wasteProb += prob
      }
    }

    validTable.sort((a, b) => a.atk - b.atk || a.label.localeCompare(b.label))

    const expNetRevPerHeart     = validTable.reduce((s, r) => s + r.prob * r.netEV, 0)
    const expHammerCostPerHeart = validTable
      .filter(r => r.useHammer)
      .reduce((s, r) => s + r.prob * hammerTotalExpCost, 0)

    return {
      scrollCostTotal, baseCostPerHeart,
      hammerCost, s4ScrollCost, hammerProb, scrollRate, probUp, hammerTotalExpCost,
      validTable, wasteProb,
      expNetRevPerHeart,
      expHammerCostPerHeart,
      expProfitPerHeart: expNetRevPerHeart - baseCostPerHeart,
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

  // ── ⑧ 補點策略比較 ────────────────────────────────────────────
  const adaptiveScrollAnalysis = computed(() => {
    const gate     = SCROLLS.find(s => s.id === adaptiveScroll.value.gate)
    const main     = SCROLLS.find(s => s.id === adaptiveScroll.value.main)
    const fallback = adaptiveScroll.value.fallback === 'skip' ? null
                     : SCROLLS.find(s => s.id === adaptiveScroll.value.fallback)
    if (!gate || !main) return null
    if (isMixedMagic([gate, main])) return null
    if (fallback && isMixedMagic([gate, fallback])) return null

    const qty       = adaptiveScroll.value.qty || 1
    const synthCost = condStrategy.value.synthCost  ?? 0
    const frameRate = (condStrategy.value.synthFrameRate ?? 0) / 100

    const gateCost     = scrollCosts.value[gate.id] || 0
    const mainCost     = scrollCosts.value[main.id] || 0

    // 計算單一變體的分析資料
    // slot3Pass = gate 過且 main 過時 slot3 用的卷；slot3Fail = gate 過但 main 沒過時 slot3 用的卷（null=不點）
    function calcVariant(slot3Pass, slot3Fail) {
      const pG  = gate.rate
      const pM  = main.rate
      const pSP = slot3Pass ? slot3Pass.rate : 0
      const pSF = slot3Fail ? slot3Fail.rate : 0

      const slot3PassCost = slot3Pass ? (scrollCosts.value[slot3Pass.id] || 0) : 0
      const slot3FailCost = slot3Fail ? (scrollCosts.value[slot3Fail.id] || 0) : 0

      // 期望卷軸總花費
      const scrollCostTotal =
        gateCost +
        pG * mainCost +
        pG * pM * slot3PassCost +
        pG * (1 - pM) * slot3FailCost

      const costPerHeart = materialCost.value + scrollCostTotal

      // 枚舉成果
      const rawOutcomes = []
      // 關卡沒過 → 廢品
      rawOutcomes.push({ prob: 1 - pG, atk: 0, subs: {} })
      // 關卡過，主卷過：
      if (slot3Pass) {
        rawOutcomes.push({ prob: pG * pM * pSP,       atk: gate.atk + main.atk + slot3Pass.atk, subs: addSubs(addSubs(gate.subs, main.subs), slot3Pass.subs) })
        rawOutcomes.push({ prob: pG * pM * (1 - pSP), atk: gate.atk + main.atk,                 subs: addSubs(gate.subs, main.subs) })
      } else {
        rawOutcomes.push({ prob: pG * pM, atk: gate.atk + main.atk, subs: addSubs(gate.subs, main.subs) })
      }
      // 關卡過，主卷沒過：
      if (slot3Fail) {
        rawOutcomes.push({ prob: pG * (1 - pM) * pSF,       atk: gate.atk + slot3Fail.atk, subs: addSubs(gate.subs, slot3Fail.subs) })
        rawOutcomes.push({ prob: pG * (1 - pM) * (1 - pSF), atk: gate.atk,                 subs: { ...gate.subs } })
      } else {
        rawOutcomes.push({ prob: pG * (1 - pM), atk: gate.atk, subs: { ...gate.subs } })
      }

      // 聚合
      const grouped = new Map()
      for (const { prob, atk, subs } of rawOutcomes) {
        if (prob <= 0) continue
        const k = `${atk}_${subsKey(subs)}`
        if (!grouped.has(k)) grouped.set(k, { atk, subs, prob: 0 })
        grouped.get(k).prob += prob
      }

      let pScrap = 0, expRevPerHeart = 0
      const outcomes = []
      for (const { atk, subs, prob } of grouped.values()) {
        const valid    = VALID_ATK.has(atk)
        const ev       = valid ? expectedMarketValueNullable(atk, subs) : null
        const isScrap   = !valid || ev === 0
        const isUnknown = valid && ev === null
        if (isScrap)         pScrap          += prob
        else if (!isUnknown) expRevPerHeart  += prob * ev
        outcomes.push({ atk, subs, label: subsLabel(subs), prob, ev, isScrap, isUnknown })
      }
      outcomes.sort((a, b) => b.atk - a.atk)

      // 回收計算
      const s = pScrap
      const totalScrolled    = qty * 2 / (2 - s)
      const totalSynthesized = totalScrolled - qty
      const synthHeartCost   = synthCost + scrollCostTotal
      const totalCost        = qty * costPerHeart + totalSynthesized * synthHeartCost

      const pSell = outcomes.filter(o => !o.isScrap && !o.isUnknown).reduce((a, o) => a + o.prob, 0)
      const avgNetDiff = pSell > 0
        ? outcomes.filter(o => !o.isScrap && !o.isUnknown)
            .reduce((a, o) => a + (o.prob / pSell) * ((getNetPriceNullable(o.atk, o.subs, true) ?? 0) - (getNetPriceNullable(o.atk, o.subs, false) ?? 0)), 0)
        : 0
      const totalFrameBonus  = totalSynthesized * pSell * frameRate * avgNetDiff
      const totalRevenue     = totalScrolled * expRevPerHeart + totalFrameBonus
      const totalProfit      = totalRevenue - totalCost
      const expProfit        = totalProfit / qty

      return { scrollCostTotal, costPerHeart, pScrap, expRevPerHeart, outcomes,
               totalScrolled, totalSynthesized, totalCost, totalRevenue, totalProfit, expProfit }
    }

    return {
      gate, main, fallback,
      // 標準：slot3 永遠點主卷（不管主卷slot2中沒中）
      standard:     calcVariant(main, main),
      // 補10%：slot3 在主卷沒中時改點 fallback（10%卷）
      withFallback: fallback ? calcVariant(main, fallback) : null,
      // 不補點：slot3 在主卷沒中時直接跳過
      withSkip:     calcVariant(main, null),
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

    const hammerMode = optimizer.value.hammerMode || 'always'
    const results = []

    for (let i = 0; i < 8; i++) {
      for (let j = i; j < 8; j++) {
        for (let k = j; k < 8; k++) {
          const slots3 = [SCROLLS[i], SCROLLS[j], SCROLLS[k]]
          if (isMixedMagic(slots3)) continue
          const s4List = hammerType === 'none' ? [null] : SCROLLS

          for (const s4 of s4List) {
            if (s4 && isMixedMagic([...slots3, s4])) continue

            if (s4) {
              // ── 鐵鎚單次模式（always = 每顆都槌一次；conditional = 觸發ATK才槌一次）──
              // 兩者都只試一次，失敗不重試
              const triggerSet = hammerMode === 'conditional'
                ? new Set(conditionalHammer.value.triggerAtks || [7, 9, 10])
                : null  // null = 所有ATK都觸發（每顆都槌）
              const hammerProb    = hammerType === '50' ? 0.5 : 1.0
              const hammerCostOne = hammerType === '50' ? (hammer50.value || 0) : (hammer100.value || 0)
              const s4ScrollCost  = scrollCosts.value[s4.id] || 0
              const costPerUse    = hammerCostOne + hammerProb * s4ScrollCost  // 每次用鎚的期望花費

              // 3槽條件點法（不含s4）
              const is10c      = sc => sc.rate < 0.5
              const sorted3c   = [...slots3].sort((a, b) => Number(is10c(b)) - Number(is10c(a)))
              const gate10sc   = sorted3c.filter(is10c)
              const rest60sc   = sorted3c.filter(sc => !is10c(sc))
              const gateSlotsc = gate10sc.slice(0, 2)
              const condSlotsc = [...gate10sc.slice(2), ...rest60sc]  // 不含s4

              const hasGatec   = gateSlotsc.length > 0
              const pGateFailc = hasGatec ? gateSlotsc.reduce((p, sc) => p * (1 - sc.rate), 1) : 0
              const pGatePassc = 1 - pGateFailc

              const gateScrollCostc = gateSlotsc.reduce((sum, sc) => sum + (scrollCosts.value[sc.id] || 0), 0)
              const condScrollCostc = condSlotsc.reduce((sum, sc) => sum + (scrollCosts.value[sc.id] || 0), 0)
              const scrollCostTotal_c = gateScrollCostc + pGatePassc * condScrollCostc

              // 枚舉3槽成果
              const rawOut3 = []
              if (!hasGatec) {
                const n = slots3.length
                for (let mask = 0; mask < (1 << n); mask++) {
                  let prob = 1, atk = 0
                  const subs = {}
                  for (let b = 0; b < n; b++) {
                    const bit = (mask >> (n - 1 - b)) & 1
                    prob *= bit ? slots3[b].rate : (1 - slots3[b].rate)
                    if (bit) {
                      atk += slots3[b].atk
                      for (const [kk, v] of Object.entries(slots3[b].subs)) subs[kk] = (subs[kk] || 0) + v
                    }
                  }
                  rawOut3.push({ prob, atk, subs })
                }
              } else {
                const nG = gateSlotsc.length, nC = condSlotsc.length
                for (let gmask = 0; gmask < (1 << nG); gmask++) {
                  let gProb = 1, gAtk = 0
                  const gSubs = {}
                  let anyPass = false
                  for (let b = 0; b < nG; b++) {
                    const bit = (gmask >> (nG - 1 - b)) & 1
                    gProb *= bit ? gateSlotsc[b].rate : (1 - gateSlotsc[b].rate)
                    if (bit) {
                      anyPass = true; gAtk += gateSlotsc[b].atk
                      for (const [kk, v] of Object.entries(gateSlotsc[b].subs)) gSubs[kk] = (gSubs[kk] || 0) + v
                    }
                  }
                  if (!anyPass) {
                    rawOut3.push({ prob: gProb, atk: 0, subs: {} })
                  } else {
                    for (let cmask = 0; cmask < (1 << nC); cmask++) {
                      let cProb = 1, cAtk = gAtk
                      const cSubs = { ...gSubs }
                      for (let b = 0; b < nC; b++) {
                        const bit = (cmask >> (nC - 1 - b)) & 1
                        cProb *= bit ? condSlotsc[b].rate : (1 - condSlotsc[b].rate)
                        if (bit) {
                          cAtk += condSlotsc[b].atk
                          for (const [kk, v] of Object.entries(condSlotsc[b].subs)) cSubs[kk] = (cSubs[kk] || 0) + v
                        }
                      }
                      rawOut3.push({ prob: gProb * cProb, atk: cAtk, subs: cSubs })
                    }
                  }
                }
              }

              // 合并3槽成果（用於計算觸發機率 × 鎚費）
              const grouped3 = new Map()
              for (const { prob, atk, subs } of rawOut3) {
                const k = `${atk}_${subsKey(subs)}`
                if (!grouped3.has(k)) grouped3.set(k, { atk, subs, prob: 0 })
                grouped3.get(k).prob += prob
              }
              const outcomes3 = [...grouped3.values()]

              // 期望鎚費（只試一次，失敗不重試）
              const expHammerContrib_c = outcomes3
                .filter(o => triggerSet === null || triggerSet.has(o.atk))
                .reduce((sum, o) => sum + o.prob * costPerUse, 0)
              const costPerHeart_c = materialCost.value + scrollCostTotal_c + expHammerContrib_c

              // 展開最終成果（觸發ATK → 一次鎚，成功加s4，失敗原ATK，不重試）
              const rawFinal = []
              for (const { prob, atk, subs } of outcomes3) {
                if (triggerSet === null || triggerSet.has(atk)) {
                  const probWin  = hammerProb * s4.rate
                  const probLose = 1 - probWin
                  const wSubs = { ...subs }
                  for (const [kk, v] of Object.entries(s4.subs)) wSubs[kk] = (wSubs[kk] || 0) + v
                  rawFinal.push({ prob: prob * probWin,  atk: atk + s4.atk, subs: wSubs })
                  rawFinal.push({ prob: prob * probLose, atk, subs })
                } else {
                  rawFinal.push({ prob, atk, subs })
                }
              }

              // 聚合最終成果
              const groupedF = new Map()
              for (const { prob, atk, subs } of rawFinal) {
                const k = `${atk}_${subsKey(subs)}`
                if (!groupedF.has(k)) groupedF.set(k, { atk, subs, prob: 0 })
                groupedF.get(k).prob += prob
              }
              let pScrap_c = 0, expRevPerHeart_c = 0
              const outcomes_c = []
              for (const { atk, subs, prob } of groupedF.values()) {
                const valid = VALID_ATK.has(atk)
                const ev    = valid ? expectedMarketValueNullable(atk, subs) : null
                const isScrap   = !valid || ev === 0
                const isUnknown = valid && ev === null
                if (isScrap)         pScrap_c         += prob
                else if (!isUnknown) expRevPerHeart_c += prob * ev
                outcomes_c.push({ atk, subs, label: subsLabel(subs), prob, ev, isScrap, isUnknown })
              }
              outcomes_c.sort((a, b) => b.atk - a.atk || a.label.localeCompare(b.label))

              // 回收計算（條件模式）
              const s_c = pScrap_c
              const totalScrolled_c    = qty * 2 / (2 - s_c)
              const totalSynthesized_c = totalScrolled_c - qty
              const synthHeartCost_c   = synthCost + scrollCostTotal_c + expHammerContrib_c
              const totalCost_c        = qty * costPerHeart_c + totalSynthesized_c * synthHeartCost_c

              const pSell_c = outcomes_c.filter(o => !o.isScrap && !o.isUnknown).reduce((a, o) => a + o.prob, 0)
              const avgNetDiff_c = pSell_c > 0
                ? outcomes_c.filter(o => !o.isScrap && !o.isUnknown)
                    .reduce((a, o) => a + (o.prob / pSell_c) * ((getNetPriceNullable(o.atk, o.subs, true) ?? 0) - (getNetPriceNullable(o.atk, o.subs, false) ?? 0)), 0)
                : 0
              const totalFrameBonus_c  = totalSynthesized_c * pSell_c * frameRate * avgNetDiff_c
              const totalRevenue_c     = totalScrolled_c * expRevPerHeart_c + totalFrameBonus_c
              const totalProfit_c      = totalRevenue_c - totalCost_c
              const expProfitPerHeart_c = totalProfit_c / qty

              const label_c = slots3.map(s => s.name).join(' / ') + ` + 🔨${triggerSet ? '(條件)' : ''}${s4.name}`
              results.push({
                label: label_c, costPerHeart: costPerHeart_c, scrollCostTotal: scrollCostTotal_c,
                pScrap: pScrap_c, expRevPerHeart: expRevPerHeart_c,
                totalScrolled: totalScrolled_c, totalSynthesized: totalSynthesized_c,
                totalCost: totalCost_c, totalRevenue: totalRevenue_c, totalProfit: totalProfit_c,
                expProfit: expProfitPerHeart_c,
                outcomes: outcomes_c,
              })

            } else {
              // ── 一般模式（每顆都槌到開為止）──
              // 條件點法：10%卷（至多前2張）當關卡，全爆就停；60%卷及剩餘10%卷在關卡至少一張過後才點
              const is10 = sc => sc.rate < 0.5
              const sorted3   = [...slots3].sort((a, b) => Number(is10(b)) - Number(is10(a)))
              const gate10s   = sorted3.filter(is10)
              const rest60s   = sorted3.filter(sc => !is10(sc))
              const gateSlots = gate10s.slice(0, 2)
              const condSlots = [...gate10s.slice(2), ...rest60s, ...(s4 ? [s4] : [])]

              const hasGate   = gateSlots.length > 0
              const pGateFail = hasGate ? gateSlots.reduce((p, sc) => p * (1 - sc.rate), 1) : 0
              const pGatePass = 1 - pGateFail

              const gateScrollCost = gateSlots.reduce((sum, sc) => sum + (scrollCosts.value[sc.id] || 0), 0)
              const condScrollCost = condSlots.reduce((sum, sc) => sum + (scrollCosts.value[sc.id] || 0), 0)
              const scrollCostTotal  = gateScrollCost + pGatePass * condScrollCost
              const hammerCostCond   = pGatePass * hammerExpCost
              const costPerHeart     = materialCost.value + scrollCostTotal + hammerCostCond

              // 枚舉結果（條件式）
              const rawOutcomes = []
              if (!hasGate) {
                // 純60%：全部無條件點
                const allSlots = [...slots3, ...(s4 ? [s4] : [])]
                const n = allSlots.length
                for (let mask = 0; mask < (1 << n); mask++) {
                  let prob = 1, atk = 0
                  const subs = {}
                  for (let b = 0; b < n; b++) {
                    const bit = (mask >> (n - 1 - b)) & 1
                    prob *= bit ? allSlots[b].rate : (1 - allSlots[b].rate)
                    if (bit) {
                      atk += allSlots[b].atk
                      for (const [kk, v] of Object.entries(allSlots[b].subs)) subs[kk] = (subs[kk] || 0) + v
                    }
                  }
                  rawOutcomes.push({ prob, atk, subs })
                }
              } else {
                // 有10%關卡：關卡全爆→廢品（停手），至少一張過→點其餘卷軸
                const nGate = gateSlots.length
                const nCond = condSlots.length
                for (let gmask = 0; gmask < (1 << nGate); gmask++) {
                  let gProb = 1, gAtk = 0
                  const gSubs = {}
                  let anyGatePass = false
                  for (let b = 0; b < nGate; b++) {
                    const bit = (gmask >> (nGate - 1 - b)) & 1
                    gProb *= bit ? gateSlots[b].rate : (1 - gateSlots[b].rate)
                    if (bit) {
                      anyGatePass = true
                      gAtk += gateSlots[b].atk
                      for (const [kk, v] of Object.entries(gateSlots[b].subs)) gSubs[kk] = (gSubs[kk] || 0) + v
                    }
                  }
                  if (!anyGatePass) {
                    rawOutcomes.push({ prob: gProb, atk: 0, subs: {} })
                  } else {
                    for (let cmask = 0; cmask < (1 << nCond); cmask++) {
                      let cProb = 1, cAtk = gAtk
                      const cSubs = { ...gSubs }
                      for (let b = 0; b < nCond; b++) {
                        const bit = (cmask >> (nCond - 1 - b)) & 1
                        cProb *= bit ? condSlots[b].rate : (1 - condSlots[b].rate)
                        if (bit) {
                          cAtk += condSlots[b].atk
                          for (const [kk, v] of Object.entries(condSlots[b].subs)) cSubs[kk] = (cSubs[kk] || 0) + v
                        }
                      }
                      rawOutcomes.push({ prob: gProb * cProb, atk: cAtk, subs: cSubs })
                    }
                  }
                }
              }

              // 聚合
              const grouped = new Map()
              for (const { prob, atk, subs } of rawOutcomes) {
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
              const synthHeartCost   = synthCost + scrollCostTotal + hammerCostCond
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
            } // end if conditional / else always
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
    marketPrices, marketPriceFilter, bulkPriceInputs, applyBulkPrice,
    batch, optimizer,
    materialCost,
    condStrategy, condStrategyAnalysis,
    conditionalHammer, conditionalHammerAnalysis,
    adaptiveScroll, adaptiveScrollAnalysis,
    allOutcomes, batchOutcomes, batchAnalysis, strategyRanking,
    DIST_ATKS, distributor, addMember, removeMember, distributorResult,
    getState, setState,
  }
}
