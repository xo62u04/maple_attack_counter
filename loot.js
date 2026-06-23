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
  // 雪花：3500里程 = 11個
  const snowflakeCostPer = computed(() =>
    mileageRate.value > 0 ? (3500 / 11 / mileageRate.value * 1000) : 0
  )

  function cashFromMileage(mileage, rate) {
    const cleanRate = Number(rate) || 0
    return cleanRate > 0 ? (Number(mileage) || 0) / cleanRate * 1000 : 0
  }

  function sessionMileageRate(session = currentSession.value) {
    const lockedRate = Number(session?.rateSnapshot) || 0
    if (session?.rateLocked && lockedRate > 0) return lockedRate
    return Number(mileageRate.value) || 0
  }

  function sessionScissorCost(mileage, session = currentSession.value) {
    return cashFromMileage(mileage, sessionMileageRate(session))
  }

  function sessionSnowflakeCostPer(session = currentSession.value) {
    return cashFromMileage(3500 / 11, sessionMileageRate(session))
  }

  // ── 常用隊員預設 ──
  const memberPresets = ref([])   // [{ id, name, defaultShare }]

  // ── 王掉落表 ──
  const bossDropTables = ref([])  // [{ id, bossName, drops: [{ id, itemName, needsScissors, scissorType }] }]

  // ── 當次 session ──
  const sessions = ref([])           // [{ id, name, date, members, soldItems }]
  const currentSessionId = ref(null)

  const currentSession = computed(() =>
    sessions.value.find(s => s.id === currentSessionId.value) ?? sessions.value[0] ?? null
  )

  // ── 設定區折疊狀態 ──
  const settingsOpen = ref(false)

  // ── 總計清算扣帳紀錄 ──
  const settlementPayments = ref([])  // [{ id, from, to, amount, paidAt }]
  const manualSettlementPayment = ref({ from: '', to: '', amount: 0 })
  const transferSettlementAmounts = ref({})

  // ── ID 產生器 ──
  let _nextId = 1
  function nextId() { return _nextId++ }

  function normalizeSession(sess) {
    const src = sess && typeof sess === 'object' ? sess : {}
    const memberItems = Array.isArray(src.memberItems)
      ? src.memberItems
          .filter(i => i && i.id != null)
          .map(i => ({ ...i, scissorMileage: Math.max(0, Number(i.scissorMileage) || 0) }))
      : []
    const rateSnapshot = Math.max(0, Number(src.rateSnapshot) || 0)
    return {
      id: Number(src.id) || nextId(),
      name: src.name || '新分錢',
      date: src.date || '',
      rateLocked: Boolean(src.rateLocked && rateSnapshot > 0),
      rateSnapshot,
      members: Array.isArray(src.members) ? src.members.filter(Boolean) : [],
      soldItems: Array.isArray(src.soldItems) ? src.soldItems.filter(i => i && i.id != null) : [],
      memberItems,
      snowflakesUsed: Number(src.snowflakesUsed) || 0,
      snowflakeOwner: String(src.snowflakeOwner || ''),
      extraScissors: Array.isArray(src.extraScissors)
        ? src.extraScissors
            .filter(e => e && e.id != null)
            .map(e => ({
              id:           Number(e.id),
              memberName:   String(e.memberName || ''),
              scissorType:  [3900, 7100].includes(Number(e.scissorType)) ? Number(e.scissorType) : 3900,
              rateSnapshot: Math.max(0, Number(e.rateSnapshot) || 0),
              note:         String(e.note || ''),
            }))
        : [],
    }
  }

  function normalizeSettlementPayment(payment) {
    const src = payment && typeof payment === 'object' ? payment : {}
    return {
      id: Number(src.id) || nextId(),
      from: String(src.from || ''),
      to: String(src.to || ''),
      amount: Math.max(0, Number(src.amount) || 0),
      paidAt: src.paidAt || '',
    }
  }

  // ── Session 管理 ──
  function addSession() {
    const s = {
      id: nextId(),
      name: '新分錢',
      date: '',
      rateLocked: false,
      rateSnapshot: Math.max(0, Number(mileageRate.value) || 0),
      members: [],
      soldItems: [],
      memberItems: [],
      snowflakesUsed: 0,
      snowflakeOwner: '',
      extraScissors: [],
    }
    sessions.value.push(s)
    currentSessionId.value = s.id
  }
  function deleteSession() {
    if (sessions.value.length <= 1) return
    const idx = sessions.value.findIndex(s => s.id === currentSessionId.value)
    sessions.value = sessions.value.filter(s => s.id !== currentSessionId.value)
    currentSessionId.value = sessions.value[Math.min(idx, sessions.value.length - 1)].id
  }
  function switchSession(id) {
    if (!sessions.value.find(s => s.id === id)) return
    currentSessionId.value = id
  }
  function lockSessionMileageRate(session = currentSession.value) {
    if (!session) return
    session.rateSnapshot = Math.max(0, Number(mileageRate.value) || 0)
    session.rateLocked = session.rateSnapshot > 0
  }
  function unlockSessionMileageRate(session = currentSession.value) {
    if (!session) return
    session.rateLocked = false
  }

  // ── 常用隊員管理 ──
  function addMemberPreset() {
    memberPresets.value.push({ id: nextId(), name: '新隊員', defaultShare: 1 })
  }
  function removeMemberPreset(id) {
    memberPresets.value = memberPresets.value.filter(m => m.id !== id)
  }

  // ── 本次 session 隊員 ──
  function addSessionMemberFromPreset(preset) {
    if (!currentSession.value) return
    if (currentSession.value.members.find(m => m.name === preset.name)) return
    currentSession.value.members.push({ name: preset.name, share: preset.defaultShare })
  }
  function addSessionMemberManual() {
    if (!currentSession.value) return
    currentSession.value.members.push({ name: '臨時隊員', share: 1 })
  }
  function removeSessionMember(idx) {
    if (!currentSession.value) return
    currentSession.value.members.splice(idx, 1)
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
    if (!currentSession.value) return
    currentSession.value.soldItems.push({
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
    if (!currentSession.value) return
    currentSession.value.soldItems = currentSession.value.soldItems.filter(i => i && i.id !== id)
  }

  // ── 成員自取物品 ──
  function addMemberItem(memberName) {
    if (!currentSession.value) return
    if (!currentSession.value.memberItems) currentSession.value.memberItems = []
    currentSession.value.memberItems.push({ id: nextId(), fromMember: '', memberName: memberName || '', itemName: '', price: 0, scissorMileage: 0 })
  }
  function removeMemberItem(id) {
    if (!currentSession.value) return
    currentSession.value.memberItems = (currentSession.value.memberItems || []).filter(i => i.id !== id)
  }

  function extraScissorCash(entry, session = currentSession.value) {
    const rate = session?.rateLocked
      ? sessionMileageRate(session)
      : (Number(entry?.rateSnapshot) || sessionMileageRate(session))
    return rate > 0 ? (Number(entry?.scissorType) || 0) / rate * 1000 : 0
  }
  function addExtraScissor() {
    if (!currentSession.value) return
    if ((currentSession.value.members || []).length === 0) return
    if (!currentSession.value.extraScissors) currentSession.value.extraScissors = []
    currentSession.value.extraScissors.push({
      id: nextId(),
      memberName: currentSession.value.members[0].name,
      scissorType: 3900,
      rateSnapshot: sessionMileageRate(currentSession.value),
      note: '',
    })
  }
  function removeExtraScissor(id) {
    if (!currentSession.value) return
    currentSession.value.extraScissors = (currentSession.value.extraScissors || []).filter(e => e.id !== id)
  }

  function memberItemScissorCost(item, session = currentSession.value) {
    const mileage = Math.max(0, Number(item?.scissorMileage) || 0)
    return cashFromMileage(mileage, sessionMileageRate(session))
  }

  function clearSession() {
    const cs = currentSession.value
    if (!cs) return
    cs.date = ''
    cs.members = []
    cs.soldItems = []
    cs.memberItems = []
    cs.snowflakesUsed = 0
    cs.snowflakeOwner = ''
    cs.extraScissors = []
    cs.rateLocked = false
    cs.rateSnapshot = Math.max(0, Number(mileageRate.value) || 0)
  }
  function createSessionFromRun({ bossName, members, date }) {
    const sessionName = `${bossName} ${date}`
    const boss  = bossDropTables.value.find(b => b.bossName === bossName)
    const drops = (boss?.drops ?? []).map(d => ({
      id:          nextId(),
      itemName:    d.itemName,
      qty:         1,
      pickedBy:    '',
      status:      'pending',
      price:       0,
      fee:         auctionFee.value,
      scissorType: d.needsScissors ? d.scissorType : 0,
    }))
    const s = {
      id:             nextId(),
      name:           sessionName,
      date,
      rateLocked:     false,
      rateSnapshot:   Math.max(0, Number(mileageRate.value) || 0),
      members: members.map(name => {
        const preset = memberPresets.value.find(p => p.name === name)
        return { name, share: preset?.defaultShare ?? 1 }
      }),
      soldItems:      drops,
      memberItems:    [],
      snowflakesUsed: 0,
      snowflakeOwner: '',
      extraScissors:  [],
    }
    sessions.value.push(s)
    currentSessionId.value = s.id
    return s.id
  }
  function dropCount(itemName) {
    return currentSession.value?.soldItems.filter(i => i && i.itemName === itemName).length ?? 0
  }

  // ── 最小轉帳算法 ──
  function calcTransfers(members, cubePrice) {
    const usesCubes = cubePrice > 0

    // 以萬為單位做貪婪匹配，避免各方獨立 round 造成顆數不一致
    const debtors   = members.filter(m => m.diff > 0.01).map(m => ({ name: m.name, amount: m.diff }))
    const creditors = members.filter(m => m.diff < -0.01).map(m => ({ name: m.name, amount: -m.diff }))

    debtors.sort((a, b) => b.amount - a.amount)
    creditors.sort((a, b) => b.amount - a.amount)

    const result = []
    let di = 0, ci = 0
    while (di < debtors.length && ci < creditors.length) {
      const pay = Math.min(debtors[di].amount, creditors[ci].amount)
      if (pay > 0.01) {
        let displayAmount, unit, cashRemainder
        if (usesCubes) {
          displayAmount = Math.floor(pay / cubePrice)
          unit = '顆方塊'
          const remainder = Math.round((pay - displayAmount * cubePrice) * 10) / 10
          cashRemainder = remainder > 0.05 ? remainder : 0
        } else {
          displayAmount = Math.round(pay * 10) / 10
          unit = '萬楓幣'
          cashRemainder = 0
        }
        result.push({
          from: debtors[di].name,
          to:   creditors[ci].name,
          rawAmount: Math.round(pay * 10) / 10,
          amount: displayAmount,
          unit,
          cashRemainder,
        })
      }
      debtors[di].amount   -= pay
      creditors[ci].amount -= pay
      if (debtors[di].amount   <= 0.01) di++
      if (creditors[ci].amount <= 0.01) ci++
    }
    return result
  }

  function computeSettlementForSession(session) {
    const members = session?.members ?? []
    if (members.length === 0) return null
    const effectiveMileageRate = sessionMileageRate(session)

    const validItems = (session?.soldItems ?? []).filter(
      i => i && (i.status === 'sold' || i.status === 'selfuse')
    )

    const itemNet = (i) => {
      const gross = (Number(i.qty) || 1) * (Number(i.price) || 0)
      const feeRate = i.status === 'sold' ? (Number(i.fee) || 0) : 0
      return gross * (1 - feeRate / 100)
    }
    const memberItems = (session?.memberItems ?? []).filter(i =>
      i && i.memberName && ((Number(i.price) || 0) > 0 || memberItemScissorCost(i, session) > 0)
    )
    const totalMemberItemValue = memberItems.reduce((sum, i) => sum + (Number(i.price) || 0), 0)
    const totalMemberScissorCost = memberItems.reduce((sum, i) => sum + memberItemScissorCost(i, session), 0)
    const totalCashRevenue  = validItems.filter(i => i.status === 'sold').reduce((sum, i) => sum + itemNet(i), 0)
    const totalSelfuseValue = validItems.filter(i => i.status === 'selfuse').reduce((sum, i) => sum + itemNet(i), 0)
    const totalItemValue    = totalSelfuseValue   // 成員自取物品不計入可分配收入
    const totalRevenue      = totalCashRevenue + totalItemValue

    const totalScissorCost = validItems.reduce((sum, i) => {
      if (!i.scissorType || i.status !== 'sold') return sum
      return sum + (Number(i.qty) || 1) * cashFromMileage(i.scissorType, effectiveMileageRate)
    }, 0)

    const snowflakesUsed = Number(session?.snowflakesUsed) || 0
    const totalSnowflakeCost = snowflakesUsed * sessionSnowflakeCostPer(session)
    const snowflakeOwner = String(session?.snowflakeOwner || '')

    const totalExtraScissorCost = (session?.extraScissors ?? []).reduce((sum, e) =>
      sum + extraScissorCash(e, session), 0)

    const netRevenue = totalRevenue - totalScissorCost - totalSnowflakeCost - totalExtraScissorCost

    const totalShares = members.reduce((s, m) => s + (Number(m.share) || 0), 0)
    if (totalShares === 0) return null

    const memberMap = {}
    for (const m of members) {
      memberMap[m.name] = {
        name: m.name,
        share: Number(m.share) || 0,
        pct: (Number(m.share) || 0) / totalShares,
        soldEarned:    0,   // 已賣物品現金（扣AH費）
        selfuseCost:   0,   // 自用物品市場價值（算作個人收到的報酬）
        receiptTotal:  0,   // 成員自取物品市值合計
        givenTotal:    0,   // 給出物品市值合計（抵銷應付現金）
        scissorPaid:   0,   // 自付剪刀成本
        snowflakeShare: 0,  // 雪花實付成本；未指定開的人時沿用舊均攤
        grossEarned:   0,   // soldEarned + selfuseCost + receiptTotal - givenTotal
        earned: 0,          // grossEarned - scissorPaid - snowflakeShare
        due: 0,
        diff: 0,
        receivedItems: [],  // [{ itemName, price }]
        selfuseItems:  [],  // [{ itemName, price }]
      }
    }

    for (const item of validItems) {
      const mm = memberMap[item.pickedBy]
      if (!mm) continue
      if (item.status === 'sold')    mm.soldEarned  += itemNet(item)
      if (item.status === 'selfuse') {
        mm.selfuseCost += itemNet(item)
        mm.selfuseItems.push({ itemName: item.itemName || '（未命名）', price: itemNet(item) })
      }
      if (item.scissorType && item.status === 'sold') {
        mm.scissorPaid += (Number(item.qty) || 1) * cashFromMileage(item.scissorType, effectiveMileageRate)
      }
    }

    for (const mi of memberItems) {
      const receiver = memberMap[mi.memberName]
      if (!receiver) continue
      const price = Number(mi.price) || 0
      const scissorCost = memberItemScissorCost(mi, session)
      const receiptTotal = price + scissorCost
      receiver.receiptTotal += receiptTotal
      receiver.receivedItems.push({
        itemName: mi.itemName || '（未命名）',
        price,
        scissorCost,
        total: receiptTotal,
        fromMember: mi.fromMember || '',
      })

      if (mi.fromMember) {
        const giver = memberMap[mi.fromMember]
        if (giver) giver.givenTotal += price
      }

      const scissorPayer = mi.fromMember || mi.memberName
      if (scissorCost > 0 && scissorPayer) {
        const payer = memberMap[scissorPayer]
        if (payer) payer.scissorPaid += scissorCost
      }
    }

    for (const e of (session?.extraScissors ?? [])) {
      const mm = memberMap[e.memberName]
      if (mm) mm.scissorPaid += extraScissorCash(e, session)
    }

    if (totalSnowflakeCost > 0.01) {
      const owner = memberMap[snowflakeOwner]
      if (owner) {
        owner.snowflakeShare += totalSnowflakeCost
      } else {
        for (const m of Object.values(memberMap)) {
          m.snowflakeShare += totalSnowflakeCost * m.pct
        }
      }
    }

    for (const m of Object.values(memberMap)) {
      m.grossEarned    = Number(m.soldEarned) + Number(m.selfuseCost) + Number(m.receiptTotal) - Number(m.givenTotal)
      m.earned         = Number(m.grossEarned) - Number(m.scissorPaid) - Number(m.snowflakeShare)
      m.due            = Number(netRevenue)    * Number(m.pct)
      m.diff           = Number(m.earned)      - Number(m.due)
    }

    const transfers = calcTransfers(Object.values(memberMap), cubePrice.value)

    return {
      sessionId: session?.id,
      sessionName: session?.name || '未命名',
      sessionDate: session?.date || '',
      totalCashRevenue,
      totalSelfuseValue,
      totalMemberItemValue,
      totalMemberScissorCost,
      totalItemValue,
      totalRevenue,
      totalScissorCost,
      totalExtraScissorCost,
      totalSnowflakeCost,
      netRevenue,
      members: Object.values(memberMap),
      transfers,
    }
  }

  // ── 結算計算 ──
  const settlementResult = computed(() => computeSettlementForSession(currentSession.value))

  function addBalance(map, name, amount) {
    if (!name || Math.abs(amount) <= 0.01) return
    map.set(name, (map.get(name) || 0) + amount)
  }

  const totalSettlementResult = computed(() => {
    const balances = new Map()
    const activeSessions = []

    for (const session of sessions.value) {
      const result = computeSettlementForSession(session)
      if (!result) continue

      let sessionOwed = 0
      let hasBalance = false
      for (const member of result.members) {
        addBalance(balances, member.name, member.diff)
        if (Math.abs(member.diff) > 0.01) hasBalance = true
        if (member.diff > 0.01) sessionOwed += member.diff
      }
      if (hasBalance) {
        activeSessions.push({
          id: result.sessionId,
          name: result.sessionName,
          date: result.sessionDate,
          amount: Math.round(sessionOwed * 10) / 10,
        })
      }
    }

    for (const payment of settlementPayments.value) {
      const amount = Number(payment.amount) || 0
      if (amount <= 0.01) continue
      addBalance(balances, payment.from, -amount)
      addBalance(balances, payment.to, amount)
    }

    const members = Array.from(balances.entries())
      .map(([name, diff]) => ({ name, diff: Math.round(diff * 10) / 10 }))
      .filter(m => Math.abs(m.diff) > 0.01)
      .sort((a, b) => b.diff - a.diff || a.name.localeCompare(b.name, 'zh-Hant'))

    const transfers = calcTransfers(members, cubePrice.value)
    const totalOwed = transfers.reduce((sum, t) => sum + (Number(t.rawAmount) || 0), 0)
    const paidTotal = settlementPayments.value.reduce((sum, p) => sum + (Number(p.amount) || 0), 0)

    return {
      members,
      transfers,
      activeSessions,
      totalOwed: Math.round(totalOwed * 10) / 10,
      paidTotal: Math.round(paidTotal * 10) / 10,
    }
  })

  const recentSettlementPayments = computed(() =>
    settlementPayments.value
      .slice()
      .sort((a, b) => String(b.paidAt).localeCompare(String(a.paidAt)))
      .slice(0, 8)
  )

  const totalSettlementPeople = computed(() => {
    const names = new Set()
    for (const session of sessions.value) {
      for (const member of (session?.members || [])) {
        if (member?.name) names.add(member.name)
      }
    }
    for (const payment of settlementPayments.value) {
      if (payment.from) names.add(payment.from)
      if (payment.to) names.add(payment.to)
    }
    for (const member of totalSettlementResult.value.members) {
      if (member.name) names.add(member.name)
    }
    return Array.from(names).sort((a, b) => a.localeCompare(b, 'zh-Hant'))
  })

  function addSettlementPayment(from, to, amount, paidAt = new Date().toISOString()) {
    const cleanFrom = String(from || '').trim()
    const cleanTo = String(to || '').trim()
    const cleanAmount = Math.round((Number(amount) || 0) * 10) / 10
    if (!cleanFrom || !cleanTo || cleanFrom === cleanTo || cleanAmount <= 0.01) return false
    settlementPayments.value.push({
      id: nextId(),
      from: cleanFrom,
      to: cleanTo,
      amount: cleanAmount,
      paidAt,
    })
    return true
  }

  function fillManualSettlementPayment(transfer) {
    if (!transfer) return
    manualSettlementPayment.value.from = transfer.from || ''
    manualSettlementPayment.value.to = transfer.to || ''
    manualSettlementPayment.value.amount = Math.round((Number(transfer.rawAmount) || 0) * 10) / 10
  }

  function addManualSettlementPayment() {
    const p = manualSettlementPayment.value
    if (addSettlementPayment(p.from, p.to, p.amount)) {
      p.amount = 0
    }
  }

  function transferPaymentKey(transfer) {
    if (!transfer) return ''
    return `${transfer.from || ''}__${transfer.to || ''}`
  }

  function getTransferPaymentAmount(transfer) {
    return transferSettlementAmounts.value[transferPaymentKey(transfer)] ?? ''
  }

  function setTransferPaymentAmount(transfer, value) {
    const key = transferPaymentKey(transfer)
    if (!key) return
    if (value === '' || value == null) {
      delete transferSettlementAmounts.value[key]
      return
    }
    transferSettlementAmounts.value[key] = value
  }

  function isTransferPaymentAmountValid(transfer) {
    const amount = Number(getTransferPaymentAmount(transfer)) || 0
    const maxAmount = Number(transfer?.rawAmount) || 0
    return amount > 0.01 && amount <= maxAmount + 0.01
  }

  function settleTransferAmount(transfer) {
    if (!transfer || !isTransferPaymentAmountValid(transfer)) return
    const key = transferPaymentKey(transfer)
    const amount = Math.min(Number(getTransferPaymentAmount(transfer)) || 0, Number(transfer.rawAmount) || 0)
    if (addSettlementPayment(transfer.from, transfer.to, amount)) {
      delete transferSettlementAmounts.value[key]
    }
  }

  function settleOneTransfer(transfer) {
    if (!transfer) return
    addSettlementPayment(transfer.from, transfer.to, transfer.rawAmount)
  }

  function settleTotalTransfers() {
    const transfers = totalSettlementResult.value?.transfers ?? []
    if (transfers.length === 0) return
    const paidAt = new Date().toISOString()
    for (const transfer of transfers) {
      addSettlementPayment(transfer.from, transfer.to, transfer.rawAmount, paidAt)
    }
  }

  function removeSettlementPayment(id) {
    settlementPayments.value = settlementPayments.value.filter(p => p.id !== id)
  }

  function formatPaidAt(value) {
    if (!value) return ''
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return ''
    return date.toLocaleString('zh-TW', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  // ── 存檔整合 ──
  function getState() {
    return {
      mileageRate: mileageRate.value,
      cubePrice:   cubePrice.value,
      auctionFee:  auctionFee.value,
      memberPresets:  JSON.parse(JSON.stringify(memberPresets.value)),
      bossDropTables: JSON.parse(JSON.stringify(bossDropTables.value)),
      sessions:        JSON.parse(JSON.stringify(sessions.value)),
      currentSessionId: currentSessionId.value,
      settlementPayments: JSON.parse(JSON.stringify(settlementPayments.value)),
    }
  }

  function setState(s) {
    if (!s) return
    if (s.mileageRate != null) mileageRate.value = s.mileageRate
    if (s.cubePrice   != null) cubePrice.value   = s.cubePrice
    if (s.auctionFee  != null) auctionFee.value  = s.auctionFee
    if (s.memberPresets) {
      memberPresets.value = Array.isArray(s.memberPresets) ? s.memberPresets.filter(m => m && m.id != null) : []
    }
    if (s.bossDropTables) {
      bossDropTables.value = Array.isArray(s.bossDropTables)
        ? s.bossDropTables
            .filter(b => b && b.id != null)
            .map(b => ({ ...b, drops: Array.isArray(b.drops) ? b.drops.filter(d => d && d.id != null) : [] }))
        : []
    }
    settlementPayments.value = Array.isArray(s.settlementPayments)
      ? s.settlementPayments.map(normalizeSettlementPayment).filter(p => p.from && p.to && p.amount > 0)
      : []

    // 舊格式相容：有 session 無 sessions
    if (s.session && !s.sessions) {
      sessions.value = [{ id: 1, name: '舊紀錄', ...s.session }]
      currentSessionId.value = 1
    } else if (s.sessions && s.sessions.length > 0) {
      sessions.value = s.sessions.map(normalizeSession).filter(Boolean)
      currentSessionId.value = sessions.value.some(sess => sess.id === s.currentSessionId)
        ? s.currentSessionId
        : sessions.value[0]?.id
    }
    sessions.value = sessions.value.map(normalizeSession).filter(Boolean)

    // 全新安裝：sessions 仍為空則建立預設
    if (sessions.value.length === 0) addSession()

    // 重建 _nextId（避免 id 衝突）
    let maxId = 0
    for (const m of memberPresets.value) if (m && m.id > maxId) maxId = m.id
    for (const b of bossDropTables.value) {
      if (!b) continue
      if (b.id > maxId) maxId = b.id
      for (const d of (b.drops || [])) if (d && d.id > maxId) maxId = d.id
    }
    for (const sess of sessions.value) {
      if (!sess) continue
      if (sess.id > maxId) maxId = sess.id
      for (const i of (sess.soldItems || [])) if (i && i.id > maxId) maxId = i.id
      for (const i of (sess.memberItems || [])) if (i && i.id > maxId) maxId = i.id
      for (const e of (sess.extraScissors || [])) if (e && e.id > maxId) maxId = e.id
    }
    for (const p of settlementPayments.value) if (p && p.id > maxId) maxId = p.id
    _nextId = maxId + 1
  }

  return {
    mileageRate, cubePrice, auctionFee,
    scissorCost3900, scissorCost7100, snowflakeCostPer,
    sessionMileageRate, sessionScissorCost, sessionSnowflakeCostPer,
    memberPresets, bossDropTables,
    sessions, currentSessionId, currentSession,
    settingsOpen, settlementPayments, manualSettlementPayment, transferSettlementAmounts,
    recentSettlementPayments, totalSettlementPeople,
    transferPaymentKey, getTransferPaymentAmount, setTransferPaymentAmount,
    isTransferPaymentAmountValid, settleTransferAmount,
    nextId,
    addMemberPreset, removeMemberPreset,
    addSessionMemberFromPreset, addSessionMemberManual, removeSessionMember,
    lockSessionMileageRate, unlockSessionMileageRate,
    addBoss, removeBoss, addDrop, removeDrop,
    addDropToSession, removeSessionItem, clearSession, createSessionFromRun, dropCount,
    addMemberItem, removeMemberItem, memberItemScissorCost,
    extraScissorCash, addExtraScissor, removeExtraScissor,
    addSession, deleteSession, switchSession,
    settlementResult, totalSettlementResult,
    fillManualSettlementPayment, addManualSettlementPayment,
    settleOneTransfer, settleTotalTransfers, removeSettlementPayment, formatPaidAt,
    getState, setState,
  }
}
