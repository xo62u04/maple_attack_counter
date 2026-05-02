function useLoot() {
  const { ref, computed } = Vue

  // ── 匯率設定 ──
  const mileageRate = ref(18000)   // 1000萬楓幣 = N里程
  const cubePrice   = ref(100)     // 奇幻方塊單價（萬楓幣/顆）
  const auctionFee  = ref(3)       // 預設拍賣手續費 %

  // ── 里程換算 ──
  const scissorCost3900 = computed(() =>
    mileageRate.value > 0 ? (3900 / mileageRate.value * 1000) : 0
  )
  const scissorCost7100 = computed(() =>
    mileageRate.value > 0 ? (7100 / mileageRate.value * 1000) : 0
  )

  // ── 常用隊員預設 ──
  const memberPresets = ref([])   // [{ id, name, defaultShare }]

  // ── 王掉落表 ──
  const bossDropTables = ref([])  // [{ id, bossName, drops: [{ id, itemName, needsScissors, scissorType }] }]

  // ── 當次 session ──
  const session = ref({
    date: '',
    members: [],     // [{ name, share }]
    soldItems: [],   // [{ id, itemName, qty, pickedBy, status, price, scissorType }]
  })

  // ── 設定區折疊狀態 ──
  const settingsOpen = ref(false)

  // ── ID 產生器 ──
  let _nextId = 1
  function nextId() { return _nextId++ }

  // ── 常用隊員管理 ──
  function addMemberPreset() {
    memberPresets.value.push({ id: nextId(), name: '新隊員', defaultShare: 1 })
  }
  function removeMemberPreset(id) {
    memberPresets.value = memberPresets.value.filter(m => m.id !== id)
  }

  // ── 本次 session 隊員 ──
  function addSessionMemberFromPreset(preset) {
    if (session.value.members.find(m => m.name === preset.name)) return
    session.value.members.push({ name: preset.name, share: preset.defaultShare })
  }
  function addSessionMemberManual() {
    session.value.members.push({ name: '臨時隊員', share: 1 })
  }
  function removeSessionMember(idx) {
    session.value.members.splice(idx, 1)
  }

  // ── 王掉落表管理 ──
  function addBoss() {
    bossDropTables.value.push({ id: nextId(), bossName: '新王', drops: [] })
  }
  function removeBoss(id) {
    bossDropTables.value = bossDropTables.value.filter(b => b.id !== id)
  }
  function addDrop(bossId) {
    const boss = bossDropTables.value.find(b => b.id === bossId)
    if (!boss) return
    boss.drops.push({ id: nextId(), itemName: '新物品', needsScissors: false, scissorType: 3900 })
  }
  function removeDrop(bossId, dropId) {
    const boss = bossDropTables.value.find(b => b.id === bossId)
    if (!boss) return
    boss.drops = boss.drops.filter(d => d.id !== dropId)
  }

  // ── session 物品管理 ──
  function addDropToSession(itemName, needsScissors, scissorType) {
    session.value.soldItems.push({
      id: nextId(),
      itemName,
      qty: 1,
      pickedBy: '',
      status: 'pending',
      price: 0,
      fee: auctionFee.value,
      scissorType: needsScissors ? scissorType : 0,
    })
  }
  function removeSessionItem(id) {
    session.value.soldItems = session.value.soldItems.filter(i => i.id !== id)
  }
  function clearSession() {
    session.value = { date: '', members: [], soldItems: [] }
  }
  function dropCount(itemName) {
    return session.value.soldItems.filter(i => i.itemName === itemName).length
  }

  // ── 最小轉帳算法 ──
  function calcTransfers(members, cubePrice) {
    const usesCubes = cubePrice > 0
    const toUnit = (wan) => usesCubes
      ? Math.round(wan / cubePrice)
      : Math.round(wan * 10) / 10

    const debtors   = members.filter(m => m.diff > 0.01).map(m => ({ name: m.name, amount: toUnit(m.diff) }))
    const creditors = members.filter(m => m.diff < -0.01).map(m => ({ name: m.name, amount: toUnit(-m.diff) }))

    debtors.sort((a, b) => b.amount - a.amount)
    creditors.sort((a, b) => b.amount - a.amount)

    const result = []
    let di = 0, ci = 0
    while (di < debtors.length && ci < creditors.length) {
      const pay = Math.min(debtors[di].amount, creditors[ci].amount)
      if (pay > 0) {
        result.push({
          from: debtors[di].name,
          to:   creditors[ci].name,
          amount: pay,
          unit: usesCubes ? '顆方塊' : '萬楓幣',
        })
      }
      debtors[di].amount   -= pay
      creditors[ci].amount -= pay
      if (debtors[di].amount   <= 0) di++
      if (creditors[ci].amount <= 0) ci++
    }
    return result
  }

  // ── 結算計算 ──
  const settlementResult = computed(() => {
    const members = session.value.members
    if (members.length === 0) return null

    const validItems = session.value.soldItems.filter(
      i => i.status === 'sold' || i.status === 'selfuse'
    )

    const itemNet = (i) => {
      const gross = (Number(i.qty) || 1) * (Number(i.price) || 0)
      const feeRate = i.status === 'sold' ? (Number(i.fee) || 0) : 0
      return gross * (1 - feeRate / 100)
    }
    const totalRevenue = validItems.reduce((sum, i) => sum + itemNet(i), 0)

    const totalScissorCost = validItems.reduce((sum, i) => {
      if (!i.scissorType) return sum
      return sum + (Number(i.qty) || 1) * (i.scissorType / mileageRate.value * 1000)
    }, 0)

    const netRevenue = totalRevenue - totalScissorCost

    const totalShares = members.reduce((s, m) => s + (Number(m.share) || 0), 0)
    if (totalShares === 0) return null

    const memberMap = {}
    for (const m of members) {
      memberMap[m.name] = {
        name: m.name,
        share: Number(m.share) || 0,
        pct: (Number(m.share) || 0) / totalShares,
        soldEarned:  0,   // 已賣物品現金（扣AH費）
        selfuseCost: 0,   // 自用物品市場價值（算作個人收到的報酬）
        scissorPaid: 0,   // 自付剪刀成本
        grossEarned: 0,   // soldEarned + selfuseCost
        earned: 0,        // grossEarned - scissorPaid
        due: 0,
        diff: 0,
      }
    }

    for (const item of validItems) {
      const mm = memberMap[item.pickedBy]
      if (!mm) continue
      if (item.status === 'sold')    mm.soldEarned  += itemNet(item)
      if (item.status === 'selfuse') mm.selfuseCost += itemNet(item)
      if (item.scissorType) {
        mm.scissorPaid += (Number(item.qty) || 1) * (item.scissorType / mileageRate.value * 1000)
      }
    }

    for (const m of Object.values(memberMap)) {
      m.grossEarned = Number(m.soldEarned)  + Number(m.selfuseCost)
      m.earned      = Number(m.grossEarned) - Number(m.scissorPaid)
      m.due         = Number(netRevenue)    * Number(m.pct)
      m.diff        = Number(m.earned)      - Number(m.due)
    }

    const transfers = calcTransfers(Object.values(memberMap), cubePrice.value)

    return {
      totalRevenue,
      totalScissorCost,
      netRevenue,
      members: Object.values(memberMap),
      transfers,
    }
  })

  // ── 存檔整合 ──
  function getState() {
    return {
      mileageRate: mileageRate.value,
      cubePrice:   cubePrice.value,
      auctionFee:  auctionFee.value,
      memberPresets:  JSON.parse(JSON.stringify(memberPresets.value)),
      bossDropTables: JSON.parse(JSON.stringify(bossDropTables.value)),
      session:        JSON.parse(JSON.stringify(session.value)),
    }
  }

  function setState(s) {
    if (!s) return
    if (s.mileageRate != null)  mileageRate.value  = s.mileageRate
    if (s.cubePrice   != null)  cubePrice.value    = s.cubePrice
    if (s.auctionFee  != null)  auctionFee.value   = s.auctionFee
    if (s.memberPresets)        memberPresets.value  = s.memberPresets
    if (s.bossDropTables)       bossDropTables.value = s.bossDropTables
    if (s.session)              session.value        = s.session
    // 重建 _nextId（避免 id 衝突）
    let maxId = 0
    for (const m of memberPresets.value) if (m.id > maxId) maxId = m.id
    for (const b of bossDropTables.value) {
      if (b.id > maxId) maxId = b.id
      for (const d of b.drops) if (d.id > maxId) maxId = d.id
    }
    for (const i of session.value.soldItems) if (i.id > maxId) maxId = i.id
    _nextId = maxId + 1
  }

  return {
    mileageRate, cubePrice, auctionFee,
    scissorCost3900, scissorCost7100,
    memberPresets, bossDropTables,
    session, settingsOpen,
    nextId,
    addMemberPreset, removeMemberPreset,
    addSessionMemberFromPreset, addSessionMemberManual, removeSessionMember,
    addBoss, removeBoss, addDrop, removeDrop,
    addDropToSession, removeSessionItem, clearSession, dropCount,
    settlementResult,
    getState, setState,
  }
}
