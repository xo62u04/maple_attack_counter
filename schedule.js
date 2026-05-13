function useSchedule() {
  const { ref, computed } = Vue

  let _nextId = 1
  function nextId() { return _nextId++ }

  // ── 核心資料 ──
  const scheduleMembers  = ref([])   // [{ name, pinHash, isAdmin, characters, recurringUnavailable }]
  const scheduleBosses   = ref([])   // [{ id, name, minLevel, parties: [{id,label,members,runsPerWeek}] }]
  const weeklySchedules  = ref([])   // [{ weekStart, runs, memberWeeklyUnavailable }]

  // ── Identity 狀態 ──
  const currentUser   = ref(null)   // { name, pinHash } | null
  const loginError    = ref('')
  const loginLoading  = ref(false)

  // ── 週選擇（UI 用）──
  const scheduleWeekIdx = ref(0)    // 0=本週, 1=下週, 2=下下週

  const currentWeekSchedule = computed(() =>
    weeklySchedules.value[scheduleWeekIdx.value] ?? null
  )

  // ── scheduleMembers CRUD ──
  function addScheduleMember(name) {
    if (scheduleMembers.value.find(m => m.name === name)) return
    scheduleMembers.value.push({
      name,
      pinHash: '',
      isAdmin: scheduleMembers.value.length === 0,
      characters: [],
      recurringUnavailable: [],
    })
  }
  function removeScheduleMember(name) {
    scheduleMembers.value = scheduleMembers.value.filter(m => m.name !== name)
  }
  function setMemberAdmin(name, val) {
    const m = scheduleMembers.value.find(m => m.name === name)
    if (m) m.isAdmin = val
  }

  // ── 角色 CRUD ──
  function addCharacter(memberName) {
    const m = scheduleMembers.value.find(m => m.name === memberName)
    if (!m) return
    m.characters.push({ id: nextId(), name: '新角色', level: 200 })
  }
  function removeCharacter(memberName, charId) {
    const m = scheduleMembers.value.find(m => m.name === memberName)
    if (!m) return
    m.characters = m.characters.filter(c => c.id !== charId)
  }

  // ── scheduleBosses CRUD ──
  function addScheduleBoss() {
    scheduleBosses.value.push({ id: nextId(), name: '新王', minLevel: 200, parties: [] })
  }
  function removeScheduleBoss(id) {
    scheduleBosses.value = scheduleBosses.value.filter(b => b.id !== id)
  }
  function addParty(bossId) {
    const b = scheduleBosses.value.find(b => b.id === bossId)
    if (!b) return
    b.parties.push({ id: nextId(), label: 'A團', members: [], runsPerWeek: 1 })
  }
  function removeParty(bossId, partyId) {
    const b = scheduleBosses.value.find(b => b.id === bossId)
    if (!b) return
    b.parties = b.parties.filter(p => p.id !== partyId)
  }

  // ── Identity ──
  const SCHEDULE_IDENTITY_KEY = 'maple_schedule_identity'

  async function hashPin(pin) {
    const enc = new TextEncoder()
    const buf = await crypto.subtle.digest('SHA-256', enc.encode(String(pin)))
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('')
  }

  async function login(name, pin) {
    loginError.value = ''
    loginLoading.value = true
    try {
      const h = await hashPin(pin)
      const member = scheduleMembers.value.find(m => m.name === name)
      if (!member) { loginError.value = '找不到此成員，請聯絡管理員'; return false }
      if (!member.pinHash) {
        member.pinHash = h
        currentUser.value = { name }
        localStorage.setItem(SCHEDULE_IDENTITY_KEY, JSON.stringify({ name, pinHash: h }))
        return true
      }
      if (member.pinHash !== h) { loginError.value = 'PIN 錯誤'; return false }
      currentUser.value = { name }
      localStorage.setItem(SCHEDULE_IDENTITY_KEY, JSON.stringify({ name, pinHash: h }))
      return true
    } finally {
      loginLoading.value = false
    }
  }

  function logout() {
    currentUser.value = null
    localStorage.removeItem(SCHEDULE_IDENTITY_KEY)
  }

  function loadIdentity() {
    try {
      const raw = localStorage.getItem(SCHEDULE_IDENTITY_KEY)
      if (!raw) return
      const saved = JSON.parse(raw)
      const member = scheduleMembers.value.find(m => m.name === saved.name)
      if (member && member.pinHash === saved.pinHash) {
        currentUser.value = { name: saved.name }
      }
    } catch {}
  }

  const currentMember = computed(() =>
    currentUser.value
      ? scheduleMembers.value.find(m => m.name === currentUser.value.name) ?? null
      : null
  )
  const isAdmin    = computed(() => currentMember.value?.isAdmin ?? false)
  const isLoggedIn = computed(() => currentUser.value !== null)

  // ── 週工具 ──
  function getWeekStart(date = new Date()) {
    const d = new Date(date)
    const day = d.getDay()
    const diff = day === 0 ? -6 : 1 - day
    d.setDate(d.getDate() + diff)
    return d.toISOString().slice(0, 10)
  }

  function addDays(isoDate, days) {
    const d = new Date(isoDate)
    d.setDate(d.getDate() + days)
    return d.toISOString().slice(0, 10)
  }

  const todayWeekStart = computed(() => getWeekStart())

  function slotToDate(weekStart, dayOfWeek) {
    const offset = dayOfWeek === 0 ? 6 : dayOfWeek - 1
    return addDays(weekStart, offset)
  }

  function runsLeft(weekStart, bossId, partyId) {
    const week = weeklySchedules.value.find(w => w.weekStart === weekStart)
    if (!week) return 0
    const done = week.runs.filter(r =>
      r.bossId === bossId && r.partyId === partyId &&
      (r.status === 'confirmed' || r.status === 'done')
    ).length
    const boss  = scheduleBosses.value.find(b => b.id === bossId)
    const party = boss?.parties.find(p => p.id === partyId)
    return Math.max(0, (party?.runsPerWeek ?? 0) - done)
  }

  function rollForwardWeeks() {
    const today = getWeekStart()
    weeklySchedules.value = weeklySchedules.value.filter(w => w.weekStart >= today)
    while (weeklySchedules.value.length < 3) {
      const prev = weeklySchedules.value[weeklySchedules.value.length - 1]
      const weekStart = prev ? addDays(prev.weekStart, 7) : today
      weeklySchedules.value.push({
        weekStart,
        runs: [],
        memberWeeklyUnavailable: {},
      })
    }
  }

  // ── 不可用時段 ──
  function toggleRecurring(memberName, dayOfWeek, hour) {
    const m = scheduleMembers.value.find(m => m.name === memberName)
    if (!m) return
    const idx = m.recurringUnavailable.findIndex(s =>
      s.dayOfWeek === dayOfWeek && s.startHour <= hour && s.endHour > hour
    )
    if (idx >= 0) {
      const old = m.recurringUnavailable.splice(idx, 1)[0]
      if (old.startHour < hour)
        m.recurringUnavailable.push({ dayOfWeek, startHour: old.startHour, endHour: hour })
      if (old.endHour > hour + 1)
        m.recurringUnavailable.push({ dayOfWeek, startHour: hour + 1, endHour: old.endHour })
    } else {
      m.recurringUnavailable.push({ dayOfWeek, startHour: hour, endHour: hour + 1 })
    }
  }

  function isRecurringUnavail(memberName, dayOfWeek, hour) {
    const m = scheduleMembers.value.find(m => m.name === memberName)
    if (!m) return false
    return m.recurringUnavailable.some(s =>
      s.dayOfWeek === dayOfWeek && s.startHour <= hour && s.endHour > hour
    )
  }

  function toggleWeeklyUnavail(weekStart, memberName, dayOfWeek, hour) {
    const week = weeklySchedules.value.find(w => w.weekStart === weekStart)
    if (!week) return
    if (!week.memberWeeklyUnavailable[memberName])
      week.memberWeeklyUnavailable[memberName] = []
    const slots = week.memberWeeklyUnavailable[memberName]
    const idx = slots.findIndex(s =>
      s.dayOfWeek === dayOfWeek && s.startHour <= hour && s.endHour > hour
    )
    if (idx >= 0) {
      const old = slots.splice(idx, 1)[0]
      if (old.startHour < hour)
        slots.push({ dayOfWeek, startHour: old.startHour, endHour: hour })
      if (old.endHour > hour + 1)
        slots.push({ dayOfWeek, startHour: hour + 1, endHour: old.endHour })
    } else {
      slots.push({ dayOfWeek, startHour: hour, endHour: hour + 1 })
    }
  }

  function isWeeklyUnavail(weekStart, memberName, dayOfWeek, hour) {
    const week = weeklySchedules.value.find(w => w.weekStart === weekStart)
    const slots = week?.memberWeeklyUnavailable?.[memberName] ?? []
    return slots.some(s => s.dayOfWeek === dayOfWeek && s.startHour <= hour && s.endHour > hour)
  }

  function cellStatus(weekStart, memberName, dayOfWeek, hour) {
    if (isRecurringUnavail(memberName, dayOfWeek, hour)) return 'recurring'
    if (isWeeklyUnavail(weekStart, memberName, dayOfWeek, hour)) return 'weekly'
    return 'avail'
  }

  // ── 自動排程 ──
  function buildUnavailSet(memberName, weekStart) {
    const unavail = new Set()
    const m = scheduleMembers.value.find(m => m.name === memberName)
    if (!m) return unavail
    for (const s of (m.recurringUnavailable || []))
      for (let h = s.startHour; h < s.endHour; h++)
        unavail.add(`${s.dayOfWeek}-${h}`)
    const week = weeklySchedules.value.find(w => w.weekStart === weekStart)
    for (const s of (week?.memberWeeklyUnavailable?.[memberName] ?? []))
      for (let h = s.startHour; h < s.endHour; h++)
        unavail.add(`${s.dayOfWeek}-${h}`)
    return unavail
  }

  function scoreSlot(dayOfWeek, hour) {
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
    if (!isWeekend && hour >= 18 && hour <= 22) return 3
    if (isWeekend) return 2
    return 1
  }

  function autoScheduleWeek(weekStart) {
    const week = weeklySchedules.value.find(w => w.weekStart === weekStart)
    if (!week) return

    const locked = week.runs.filter(r =>
      ['manual', 'confirmed', 'done'].includes(r.status)
    )
    const newRuns = [...locked]

    const occupiedSlots = new Set(locked.map(r => `${r.dayOfWeek}-${r.hour}`))
    const memberOccupied = {}
    for (const run of locked)
      for (const name of run.members) {
        if (!memberOccupied[name]) memberOccupied[name] = new Set()
        memberOccupied[name].add(`${run.dayOfWeek}-${run.hour}`)
      }

    for (const boss of scheduleBosses.value) {
      for (const party of boss.parties) {
        const lockedCount = locked.filter(r =>
          r.bossId === boss.id && r.partyId === party.id
        ).length
        const needed = party.runsPerWeek - lockedCount
        if (needed <= 0) continue

        const memberUnavail = {}
        for (const name of party.members) {
          memberUnavail[name] = buildUnavailSet(name, weekStart)
          if (memberOccupied[name])
            for (const s of memberOccupied[name]) memberUnavail[name].add(s)
        }

        const candidates = []
        for (let day = 0; day <= 6; day++) {
          for (let hour = 0; hour <= 23; hour++) {
            const key = `${day}-${hour}`
            if (occupiedSlots.has(key)) continue
            const allAvail = party.members.every(n => !memberUnavail[n]?.has(key))
            if (allAvail) candidates.push({ day, hour, score: scoreSlot(day, hour) })
          }
        }
        candidates.sort((a, b) => b.score - a.score)

        let scheduled = 0
        for (const slot of candidates) {
          if (scheduled >= needed) break
          const key = `${slot.day}-${slot.hour}`
          const run = {
            id: nextId(),
            bossId: boss.id,
            partyId: party.id,
            dayOfWeek: slot.day,
            hour: slot.hour,
            members: [...party.members],
            status: 'auto',
            lootSessionId: null,
          }
          newRuns.push(run)
          occupiedSlots.add(key)
          for (const name of party.members) {
            if (!memberOccupied[name]) memberOccupied[name] = new Set()
            memberOccupied[name].add(key)
            memberUnavail[name].add(key)
          }
          scheduled++
        }

        for (let i = scheduled; i < needed; i++) {
          newRuns.push({
            id: nextId(), bossId: boss.id, partyId: party.id,
            dayOfWeek: null, hour: null,
            members: [...party.members], status: 'unschedulable', lootSessionId: null,
          })
        }
      }
    }

    week.runs = newRuns
  }

  function autoScheduleAll() {
    for (const week of weeklySchedules.value) {
      autoScheduleWeek(week.weekStart)
    }
  }

  function updateRunTime(weekStart, runId, dayOfWeek, hour) {
    const week = weeklySchedules.value.find(w => w.weekStart === weekStart)
    if (!week) return
    const run = week.runs.find(r => r.id === runId)
    if (!run) return
    run.dayOfWeek = dayOfWeek
    run.hour      = hour
    run.status    = 'manual'
  }

  function confirmRun(weekStart, runId) {
    const week = weeklySchedules.value.find(w => w.weekStart === weekStart)
    if (!week) return
    const run = week.runs.find(r => r.id === runId)
    if (run && run.status !== 'done') run.status = 'confirmed'
  }

  function markRunDone(weekStart, runId, lootSessionId) {
    const week = weeklySchedules.value.find(w => w.weekStart === weekStart)
    if (!week) return
    const run = week.runs.find(r => r.id === runId)
    if (!run) return
    run.status = 'done'
    run.lootSessionId = lootSessionId
  }

  // ── getState / setState ──
  function getState() {
    return {
      scheduleMembers:  JSON.parse(JSON.stringify(scheduleMembers.value)),
      scheduleBosses:   JSON.parse(JSON.stringify(scheduleBosses.value)),
      weeklySchedules:  JSON.parse(JSON.stringify(weeklySchedules.value)),
    }
  }
  function setState(s) {
    if (!s) return
    if (s.scheduleMembers)  scheduleMembers.value  = s.scheduleMembers
    if (s.scheduleBosses)   scheduleBosses.value   = s.scheduleBosses
    if (s.weeklySchedules)  weeklySchedules.value  = s.weeklySchedules
    let maxId = 0
    for (const b of scheduleBosses.value) {
      if (b.id > maxId) maxId = b.id
      for (const p of b.parties) if (p.id > maxId) maxId = p.id
    }
    for (const w of weeklySchedules.value)
      for (const r of w.runs) if (r.id > maxId) maxId = r.id
    for (const m of scheduleMembers.value)
      for (const c of (m.characters || [])) if (c.id > maxId) maxId = c.id
    _nextId = maxId + 1
  }

  return {
    scheduleMembers, scheduleBosses, weeklySchedules,
    currentUser, loginError, loginLoading,
    scheduleWeekIdx, currentWeekSchedule,
    addScheduleMember, removeScheduleMember, setMemberAdmin,
    addCharacter, removeCharacter,
    addScheduleBoss, removeScheduleBoss, addParty, removeParty,
    login, logout, loadIdentity,
    currentMember, isAdmin, isLoggedIn,
    getWeekStart, addDays, slotToDate, todayWeekStart, runsLeft, rollForwardWeeks,
    toggleRecurring, isRecurringUnavail,
    toggleWeeklyUnavail, isWeeklyUnavail, cellStatus,
    buildUnavailSet, autoScheduleWeek, autoScheduleAll,
    updateRunTime, confirmRun, markRunDone,
    getState, setState,
    nextId,
  }
}
