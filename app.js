const { createApp, ref, computed, onMounted, watch } = Vue

createApp({
  setup() {
    // ── Tab 切換 ──
    const activeTab = ref('calc')

    // ── 雲端同步 ──
    const sync = useSync()
    let _pulling = false
    const SYNC_LAST_PUSH_KEY = 'maple_sync_last_push'

    // ── 裝備模擬器字體縮放 ──
    const equipZoom = ref(1)
    function changeEquipZoom(delta, reset = false) {
      if (reset) {
        equipZoom.value = 1
      } else {
        equipZoom.value = Math.round(Math.max(0.5, Math.min(2, equipZoom.value + delta)) * 10) / 10
      }
      document.documentElement.style.setProperty('--equip-zoom', equipZoom.value)
    }

    // ── 資料載入 ──
    const jobs      = ref([])
    const partyBuffs = ref([])
    const loading   = ref(true)
    const loadError = ref(false)

    onMounted(async () => {
      try {
        const res = await fetch('data.json')
        if (!res.ok) throw new Error('HTTP ' + res.status)
        const data = await res.json()
        jobs.value       = data.jobs       || []
        partyBuffs.value = data.partyBuffs || []
      } catch (e) {
        loadError.value = true
      } finally {
        loading.value = false
      }
      loadFromUrl()
      loadSavedCharacters()
      initTab1Buffs()
      equip.initPartyBuffs()
      loadLootSettings()
      loadAlchemySettings()
      if (sync.syncCode.value) pullAll()
    })

    // ── 選擇狀態 ──
    const selectedGroup      = ref('')
    const selectedJobId      = ref('')
    const selectedWeaponName = ref('')
    const coefficient        = ref(1.0)

    const groups = computed(() => {
      const seen = new Set()
      return jobs.value
        .map(j => j.group)
        .filter(g => { if (seen.has(g)) return false; seen.add(g); return true })
    })

    const filteredJobs = computed(() =>
      jobs.value.filter(j => j.group === selectedGroup.value)
    )

    const selectedJob = computed(() =>
      jobs.value.find(j => j.id === selectedJobId.value) || null
    )

    function onGroupChange() {
      selectedJobId.value      = ''
      selectedWeaponName.value = ''
      coefficient.value        = 1.0
    }

    function onJobChange() {
      const job = selectedJob.value
      if (!job) return
      selectedWeaponName.value = job.weapons[0]?.name || ''
      coefficient.value        = job.weapons[0]?.coefficient || 1.0
      // 裝備模擬器同步更新職業技能
      equip.initJobSkills(selectedJobId.value)
    }

    function onWeaponChange() {
      const job = selectedJob.value
      if (!job) return
      const w = job.weapons.find(w => w.name === selectedWeaponName.value)
      if (w) coefficient.value = w.coefficient
    }

    // ── 屬性輸入 ──
    const stats = ref({
      STR: 0, DEX: 0, INT: 0, LUK: 0,
      atk: 0, atkPct: 0,
      skillPct: 100,
      totalDmgPct: 0, bossPct: 0, enhancePct: 0,
      bossDefPct: 0, ignoreDefPct: 0,
      mastery: 60,
      critRate: 0,
      minCritBonus: 20,
      maxCritBonus: 50,
      monsterDefPct: 10,
      characterLevel: 120,
      monsterLevel: 120,
      monsterAvoid: 0,
      extraAccuracy: 0,
    })

    function needsStat(stat) {
      const job = selectedJob.value
      if (!job) return false
      return job.mainStat === stat || job.subStat.includes(stat)
    }

    function isValidNumber(v) {
      return v !== '' && v !== null && !isNaN(Number(v))
    }

    const mainStatValue = computed(() => {
      const job = selectedJob.value
      if (!job) return 0
      return Number(stats.value[job.mainStat]) || 0
    })

    const subStatValue = computed(() => {
      const job = selectedJob.value
      if (!job) return 0
      if (job.subStat === 'DEX+STR') {
        return (Number(stats.value.DEX) || 0) + (Number(stats.value.STR) || 0)
      }
      return Number(stats.value[job.subStat]) || 0
    })

    const subStatLabel = computed(() => selectedJob.value?.subStat || '')

    // ── Tab 1 隊伍 BUFF ──
    const tab1Buffs = ref([])

    function initTab1Buffs() {
      tab1Buffs.value = (partyBuffs.value || []).map(b => ({
        ...b,
        enabled: false,
        effects: b.effects.map(e => ({ ...e }))
      }))
    }

    const tab1BuffTotals = computed(() => {
      let atkFlat = 0, atkPct = 0, critRate = 0, critDmg = 0
      let allStatPct = 0, bossDmg = 0, totalDmg = 0
      for (const buf of tab1Buffs.value) {
        if (!buf.enabled) continue
        for (const eff of buf.effects) {
          const v = Number(eff.value) || 0
          if (eff.type === 'atkFlat')        atkFlat    += v
          else if (eff.type === 'atkPct')    atkPct     += v
          else if (eff.type === 'critRate')  critRate   += v
          else if (eff.type === 'critDmg')   critDmg    += v
          else if (eff.type === 'allStatPct') allStatPct += v
          else if (eff.type === 'bossDmg')   bossDmg    += v
          else if (eff.type === 'totalDmg')  totalDmg   += v
        }
      }
      return { atkFlat, atkPct, critRate, critDmg, allStatPct, bossDmg, totalDmg }
    })

    // ── 公式計算（含 BUFF）──
    const formulaValid = computed(() => {
      if (!selectedJob.value) return false
      const s = stats.value
      return [
        s.atk, s.atkPct, s.skillPct,
        s.totalDmgPct, s.bossPct, s.enhancePct,
        s.bossDefPct, s.ignoreDefPct,
        s.mastery, s.critRate, s.minCritBonus, s.maxCritBonus, s.monsterDefPct,
        s.characterLevel, s.monsterLevel, s.monsterAvoid, s.extraAccuracy
      ].every(v => isValidNumber(v))
    })

    // 全屬性%加成到主/副屬性（allStatPct 讓主/副屬性同步等比放大）
    const effectiveMainStat = computed(() => {
      const base = mainStatValue.value
      const allPct = tab1BuffTotals.value.allStatPct
      return base * (1 + allPct / 100)
    })
    const effectiveSubStat = computed(() => {
      const base = subStatValue.value
      const allPct = tab1BuffTotals.value.allStatPct
      return base * (1 + allPct / 100)
    })

    const step1 = computed(() => 4 * effectiveMainStat.value + effectiveSubStat.value)
    const step2 = computed(() => step1.value * coefficient.value)
    const step3 = computed(() => {
      const buffAtk    = tab1BuffTotals.value.atkFlat
      const buffAtkPct = tab1BuffTotals.value.atkPct
      const totalAtk   = (Number(stats.value.atk) || 0) + buffAtk
      const totalAtkPct = (Number(stats.value.atkPct) || 0) + buffAtkPct
      return totalAtk * (1 + totalAtkPct / 100)
    })
    const step4 = computed(() => step2.value * step3.value * 0.01 * (Number(stats.value.skillPct) || 0) / 100)

    const step5Boss = computed(() => {
      const buffBoss  = tab1BuffTotals.value.bossDmg
      const buffTotal = tab1BuffTotals.value.totalDmg
      return 1 + ((Number(stats.value.totalDmgPct) || 0) + (Number(stats.value.bossPct) || 0) + (Number(stats.value.enhancePct) || 0) + buffBoss + buffTotal) / 100
    })
    const step5Mob = computed(() => {
      const buffTotal = tab1BuffTotals.value.totalDmg
      return 1 + ((Number(stats.value.totalDmgPct) || 0) + (Number(stats.value.enhancePct) || 0) + buffTotal) / 100
    })

    const step6Boss = computed(() =>
      1 - (Number(stats.value.bossDefPct) || 0) / 100 * (1 - (Number(stats.value.ignoreDefPct) || 0) / 100)
    )
    const step6Mob = computed(() =>
      1 - (Number(stats.value.monsterDefPct) || 0) / 100 * (1 - (Number(stats.value.ignoreDefPct) || 0) / 100)
    )

    const finalDmgBoss = computed(() => step4.value * step5Boss.value * step6Boss.value)
    const maxDmgBoss   = computed(() => finalDmgBoss.value)
    const minDmgBoss   = computed(() => finalDmgBoss.value * (Number(stats.value.mastery) || 0) / 100)
    const avgDmgBoss   = computed(() => (maxDmgBoss.value + minDmgBoss.value) / 2)

    const finalDmgMob  = computed(() => step4.value * step5Mob.value * step6Mob.value)
    const maxDmgMob    = computed(() => finalDmgMob.value)
    const minDmgMob    = computed(() => finalDmgMob.value * (Number(stats.value.mastery) || 0) / 100)
    const avgDmgMob    = computed(() => (maxDmgMob.value + minDmgMob.value) / 2)

    const critMult = computed(() => {
      const buffCritRate = tab1BuffTotals.value.critRate
      const buffCritDmg  = tab1BuffTotals.value.critDmg
      const rate = Math.min(100, (Number(stats.value.critRate) || 0) + buffCritRate) / 100
      const minB = Number(stats.value.minCritBonus) || 0
      const maxB = (Number(stats.value.maxCritBonus) || 0) + buffCritDmg
      return 1 + rate * (minB + maxB) / 200
    })
    const avgDmgBossCrit = computed(() => avgDmgBoss.value * critMult.value)
    const avgDmgMobCrit  = computed(() => avgDmgMob.value  * critMult.value)

    const accuracyMode = computed(() =>
      selectedJob.value?.attackType === 'magical' ? '魔法命中' : '物理命中'
    )
    const rawAccuracy = computed(() => {
      const s = stats.value
      const extra = Number(s.extraAccuracy) || 0
      if (selectedJob.value?.attackType === 'magical') {
        return (Number(s.INT) || 0) + (Number(s.LUK) || 0) * 1.2 + extra
      }
      return (Number(s.LUK) || 0) + (Number(s.DEX) || 0) * 1.2 + extra
    })
    const cappedAccuracy = computed(() => Math.max(0, Math.min(9999, rawAccuracy.value)))
    const cappedMonsterAvoid = computed(() =>
      Math.max(0, Math.min(9999, Number(stats.value.monsterAvoid) || 0))
    )
    const playerAccuracyRoot = computed(() => Math.floor(Math.sqrt(cappedAccuracy.value)))
    const monsterAvoidRoot = computed(() => Math.floor(Math.sqrt(cappedMonsterAvoid.value)))
    const hitLevelPenalty = computed(() =>
      Math.max(0, (Number(stats.value.monsterLevel) || 0) - (Number(stats.value.characterLevel) || 0)) * 5
    )
    const hitRateBase = computed(() =>
      Math.min(100, playerAccuracyRoot.value - monsterAvoidRoot.value + 100)
    )
    const hitRateRaw = computed(() => hitRateBase.value - hitLevelPenalty.value)
    const hitRate = computed(() => Math.max(0, hitRateRaw.value))
    const hitLevelDiff = computed(() =>
      Math.max(0, (Number(stats.value.monsterLevel) || 0) - (Number(stats.value.characterLevel) || 0))
    )
    const maxHitRateByLevel = computed(() => Math.max(0, 100 - hitLevelPenalty.value))
    const hitRateNote = computed(() => {
      if (hitLevelDiff.value > 0 && hitRateBase.value >= 100) {
        return `基礎命中已達 100%，怪物高 ${hitLevelDiff.value} 等會固定扣 ${hitLevelPenalty.value}%，所以目前最高命中率是 ${maxHitRateByLevel.value.toFixed(1)}%。`
      }
      if (hitRateBase.value < 100) {
        return '目前還沒達到基礎命中 100%，提高命中或降低怪物迴避會提升命中率。'
      }
      return '同等或低等怪物在基礎命中達 100% 後不會再 MISS。'
    })

    // ── 格式化 ──
    function fmt(n) {
      if (n === undefined || n === null || isNaN(n)) return '0'
      if (n >= 1e8) return (n / 1e8).toFixed(2) + ' 億'
      if (n >= 1e4) return (n / 1e4).toFixed(1) + ' 萬'
      return Math.round(n).toLocaleString('zh-TW')
    }
    function fmtFinal(n) {
      if (!formulaValid.value) return '-'
      return fmt(n)
    }
    function fmtM(n) {
      if (!n) return '0'
      if (n >= 1e8) return (n / 1e8).toFixed(2) + ' 億'
      if (n >= 1e4) return (n / 1e4).toFixed(1) + ' 萬'
      return Math.round(n).toLocaleString('zh-TW')
    }

    // ── DPS 數字格式切換：'wan'（萬）| 'k'（K）| 'raw'（純數字）──
    const dpsFormat = ref('wan')
    const DPS_FORMAT_LABELS = { wan: '萬', k: 'K', raw: '#' }
    function cycleDpsFormat() {
      const order = ['wan', 'k', 'raw']
      const idx = order.indexOf(dpsFormat.value)
      dpsFormat.value = order[(idx + 1) % order.length]
    }
    function fmtDps(n) {
      if (!n) return '0'
      if (dpsFormat.value === 'k') {
        if (n >= 1e6) return (n / 1e6).toFixed(2) + ' M'
        if (n >= 1e3) return (n / 1e3).toFixed(1) + ' K'
        return Math.round(n).toString()
      }
      if (dpsFormat.value === 'raw') {
        return Math.round(n).toLocaleString('zh-TW')
      }
      // 'wan' — 預設
      if (n >= 1e8) return (n / 1e8).toFixed(2) + ' 億'
      if (n >= 1e4) return (n / 1e4).toFixed(1) + ' 萬'
      return Math.round(n).toLocaleString('zh-TW')
    }

    // ── 裝備模擬器 Composable ──
    const equip = useEquip(jobs, partyBuffs, selectedJobId)
    // ── 分錢系統 ──
    const loot = Vue.reactive(useLoot())
    const alchemy = Vue.reactive(useAlchemy())

    // 職業變更時：更新武器係數；只在 Tab2 技能清單為空時才自動載入（避免覆蓋已設定的技能）
    watch(selectedJobId, (id) => {
      const job = (jobs.value || []).find(j => j.id === id)
      if (job && job.weapons && job.weapons[0]) {
        equip.equipSettings.value.weaponCoeff = job.weapons[0].coefficient
      }
      if (equip.jobSkills.value.length === 0) {
        equip.initJobSkills(id)
      }
    })

    // 新增自訂技能
    function addCustomSkill() {
      equip.jobSkills.value.push({ name: '自訂技能', type: 'atkFlat', value: 0, enabled: true })
    }

    // 移除技能
    function removeSkill(idx) {
      equip.jobSkills.value.splice(idx, 1)
    }

    // ── 裝備槽摘要（左欄清單顯示用）──
    function slotSummary(slot) {
      if (!slot) return ''
      const parts = []
      const scrollVal = (Number(slot.scroll.count) || 0) * (Number(slot.scroll.perScroll) || 0)
      const totalAtk  = (Number(slot.base.atk)      || 0) + (slot.scroll.stat === 'atk'      ? scrollVal : 0)
      const totalMain = (Number(slot.base.mainStat)  || 0) + (slot.scroll.stat === 'mainStat' ? scrollVal : 0)
      if (totalAtk)  parts.push(`A+${totalAtk}`)
      if (totalMain) parts.push(`主+${totalMain}`)
      const pctLines = slot.potential.filter(p => p.type !== 'none' && (Number(p.value) || 0) > 0)
      if (pctLines.length) parts.push(`潛×${pctLines.length}`)
      return parts.join(' ')
    }

    // ── 匯出到 Tab 1 ──
    function exportToTab1() {
      const r = equip.dmgResult.value
      const t = equip.totals.value
      const job = selectedJob.value
      if (job) {
        stats.value[job.mainStat] = Math.round(r.finalMain)
        stats.value.atk           = Math.round(r.finalAtk)
        stats.value.atkPct        = parseFloat(r.finalAtkPct.toFixed(2))
        stats.value.totalDmgPct   = parseFloat(t.totalDmg.toFixed(2))
        stats.value.bossPct       = parseFloat(t.bossDmg.toFixed(2))
        stats.value.critRate      = parseFloat((equip.equipSettings.value.critRate + t.critRate).toFixed(2))
        stats.value.maxCritBonus  = parseFloat((equip.equipSettings.value.maxCritBonus + t.critDmg).toFixed(2))
      }
      activeTab.value = 'calc'
    }

    // ── 存檔（localStorage）──
    const STORAGE_KEY = 'maple_calc_characters'
    const MAX_SAVES   = 20
    const saveName           = ref('')
    const selectedSaveKey    = ref('')
    const saveMessage        = ref('')
    const savedCharacters    = ref([])

    function loadSavedCharacters() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY)
        savedCharacters.value = raw ? JSON.parse(raw) : []
      } catch { savedCharacters.value = [] }

      // ── 一次性搬移：把舊裝備模擬器的存檔（maple_calc_equipment）合併進來 ──
      try {
        const oldRaw = localStorage.getItem('maple_calc_equipment')
        if (oldRaw) {
          const oldSets = JSON.parse(oldRaw)
          let changed = false
          for (const old of oldSets) {
            if (!old.name) continue
            const alreadyExists = savedCharacters.value.some(c => c.name === old.name)
            if (!alreadyExists) {
              // 包裝成統一格式：Tab1 欄位留空，裝備資料放進 equipData
              savedCharacters.value.push({
                name:      old.name,
                jobId:     '',
                group:     '',
                weaponName:'',
                coefficient: 1,
                stats:     {},
                tab1Buffs: [],
                equipData: {
                  baseStats:     old.baseStats     || {},
                  equipSettings: old.equipSettings || {},
                  slots:         old.slots         || {},
                  jobSkills:     old.jobSkills      || [],
                  activeBuffs:   old.activeBuffs    || [],
                }
              })
              changed = true
            }
          }
          if (changed) persistSaves()
          // 搬移完畢後刪除舊資料，避免重複搬
          localStorage.removeItem('maple_calc_equipment')
        }
      } catch (e) { /* 搬移失敗不影響主功能 */ }
    }

    function persistSaves() {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(savedCharacters.value))
      } catch { saveMessage.value = '⚠️ 儲存失敗（瀏覽器儲存空間不足）' }
      pushAll()
    }

    function saveCharacter() {
      const name = saveName.value.trim()
      if (!name) return
      if (savedCharacters.value.length >= MAX_SAVES && !savedCharacters.value.find(c => c.name === name)) {
        saveMessage.value = '⚠️ 已達 20 筆上限，請先刪除舊存檔'
        return
      }
      const entry = {
        name,
        jobId: selectedJobId.value,
        group: selectedGroup.value,
        weaponName: selectedWeaponName.value,
        coefficient: coefficient.value,
        stats: { ...stats.value },
        tab1Buffs: JSON.parse(JSON.stringify(tab1Buffs.value)),
        equipData: equip.getState(),
      }
      const idx = savedCharacters.value.findIndex(c => c.name === name)
      if (idx >= 0) savedCharacters.value[idx] = entry
      else savedCharacters.value.push(entry)
      persistSaves()
      saveMessage.value = `✅ 已儲存「${name}」`
      setTimeout(() => { saveMessage.value = '' }, 2000)
    }

    function loadCharacter() {
      const key = selectedSaveKey.value
      if (!key) return
      const entry = savedCharacters.value.find(c => c.name === key)
      if (!entry) return
      selectedGroup.value      = entry.group
      selectedJobId.value      = entry.jobId
      selectedWeaponName.value = entry.weaponName
      coefficient.value        = entry.coefficient
      Object.assign(stats.value, entry.stats)
      if (entry.tab1Buffs) tab1Buffs.value = entry.tab1Buffs
      else initTab1Buffs()
      saveName.value = entry.name
      // 還原裝備模擬器（含武器係數、裝備槽、技能）
      if (entry.equipData) equip.setState(entry.equipData)
      else equip.initJobSkills(entry.jobId)
    }

    // ── 匯出所有存檔（下載 JSON 檔）──
    function exportSaves() {
      if (savedCharacters.value.length === 0) {
        saveMessage.value = '⚠️ 目前沒有存檔可匯出'
        setTimeout(() => { saveMessage.value = '' }, 2000)
        return
      }
      const json = JSON.stringify(savedCharacters.value, null, 2)
      const blob = new Blob([json], { type: 'application/json' })
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `maple_saves_${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      saveMessage.value = `✅ 已匯出 ${savedCharacters.value.length} 筆存檔`
      setTimeout(() => { saveMessage.value = '' }, 2000)
    }

    // ── 從 JSON 檔匯入存檔（同名覆蓋，新增不存在的）──
    function importSaves(event) {
      const file = event.target.files[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result)
          if (!Array.isArray(data)) throw new Error('not array')
          let added = 0, updated = 0
          for (const entry of data) {
            if (!entry.name) continue
            const idx = savedCharacters.value.findIndex(c => c.name === entry.name)
            if (idx >= 0) { savedCharacters.value[idx] = entry; updated++ }
            else           { savedCharacters.value.push(entry);  added++   }
          }
          persistSaves()
          saveMessage.value = `✅ 匯入完成：新增 ${added} 筆，更新 ${updated} 筆`
        } catch {
          saveMessage.value = '⚠️ 匯入失敗：請確認為正確的楓星存檔 JSON'
        }
        setTimeout(() => { saveMessage.value = '' }, 3000)
      }
      reader.readAsText(file, 'utf-8')
      event.target.value = '' // 重設，讓同一檔案可再次匯入
    }

    function deleteCharacter() {
      const key = selectedSaveKey.value
      if (!key) return
      savedCharacters.value = savedCharacters.value.filter(c => c.name !== key)
      persistSaves()
      selectedSaveKey.value = ''
      saveMessage.value = `🗑️ 已刪除「${key}」`
      setTimeout(() => { saveMessage.value = '' }, 2000)
    }

    // ── URL 分享 ──
    function shareUrl() {
      const params = new URLSearchParams({
        job: selectedJobId.value,
        group: selectedGroup.value,
        weapon: selectedWeaponName.value,
        coeff: coefficient.value,
        str: stats.value.STR, dex: stats.value.DEX,
        int: stats.value.INT, luk: stats.value.LUK,
        atk: stats.value.atk, atkp: stats.value.atkPct,
        skill: stats.value.skillPct,
        total: stats.value.totalDmgPct,
        boss: stats.value.bossPct,
        enhance: stats.value.enhancePct,
        bdef: stats.value.bossDefPct,
        idef: stats.value.ignoreDefPct,
        mastery: stats.value.mastery,
        crit: stats.value.critRate,
        mincrit: stats.value.minCritBonus,
        maxcrit: stats.value.maxCritBonus,
        mdef: stats.value.monsterDefPct,
        clevel: stats.value.characterLevel,
        mlevel: stats.value.monsterLevel,
        mavoid: stats.value.monsterAvoid,
        acc: stats.value.extraAccuracy
      })
      const url = window.location.origin + window.location.pathname + '?' + params.toString()
      navigator.clipboard.writeText(url).then(() => {
        saveMessage.value = '✅ 連結已複製到剪貼簿！'
        setTimeout(() => { saveMessage.value = '' }, 2500)
      }).catch(() => {
        prompt('複製此連結：', url)
      })
    }

    function loadFromUrl() {
      const params = new URLSearchParams(window.location.search)
      if (!params.has('job')) return
      const jobId = params.get('job')
      const job = jobs.value.find(j => j.id === jobId)
      if (!job) return
      selectedGroup.value      = params.get('group') || job.group
      selectedJobId.value      = jobId
      selectedWeaponName.value = params.get('weapon') || job.weapons[0]?.name || ''
      coefficient.value        = parseFloat(params.get('coeff')) || job.weapons[0]?.coefficient || 1.0
      const s = stats.value
      s.STR = parseInt(params.get('str'))  || 0
      s.DEX = parseInt(params.get('dex'))  || 0
      s.INT = parseInt(params.get('int'))  || 0
      s.LUK = parseInt(params.get('luk'))  || 0
      s.atk = parseInt(params.get('atk'))  || 0
      s.atkPct = parseFloat(params.get('atkp')) || 0
      const skillRaw = params.get('skill')
      s.skillPct = skillRaw !== null ? parseFloat(skillRaw) : 100
      s.totalDmgPct = parseFloat(params.get('total'))   || 0
      s.bossPct     = parseFloat(params.get('boss'))    || 0
      s.enhancePct  = parseFloat(params.get('enhance')) || 0
      s.bossDefPct  = parseFloat(params.get('bdef'))    || 0
      s.ignoreDefPct = parseFloat(params.get('idef'))   || 0
      const masteryRaw  = params.get('mastery')
      if (masteryRaw  !== null) s.mastery      = parseFloat(masteryRaw)
      const critRaw     = params.get('crit')
      if (critRaw     !== null) s.critRate      = parseFloat(critRaw)
      const minCritRaw  = params.get('mincrit')
      if (minCritRaw  !== null) s.minCritBonus  = parseFloat(minCritRaw)
      const maxCritRaw  = params.get('maxcrit')
      if (maxCritRaw  !== null) s.maxCritBonus  = parseFloat(maxCritRaw)
      const mdefRaw     = params.get('mdef')
      if (mdefRaw     !== null) s.monsterDefPct = parseFloat(mdefRaw)
      const clevelRaw   = params.get('clevel')
      if (clevelRaw   !== null) s.characterLevel = parseFloat(clevelRaw)
      const mlevelRaw   = params.get('mlevel')
      if (mlevelRaw   !== null) s.monsterLevel = parseFloat(mlevelRaw)
      const mavoidRaw   = params.get('mavoid')
      if (mavoidRaw   !== null) s.monsterAvoid = parseFloat(mavoidRaw)
      const accRaw      = params.get('acc')
      if (accRaw      !== null) s.extraAccuracy = parseFloat(accRaw)
    }

    // ── 分錢系統設定存檔 ──
    const LOOT_SETTINGS_KEY = 'maple_loot_settings'

    function saveLootSettings() {
      try {
        localStorage.setItem(LOOT_SETTINGS_KEY, JSON.stringify(loot.getState()))
      } catch {}
      pushAll()
    }

    function loadLootSettings() {
      try {
        const raw = localStorage.getItem(LOOT_SETTINGS_KEY)
        if (raw) {
          const s = JSON.parse(raw)
          loot.setState(s)
        }
      } catch {}
    }

    Vue.watch(() => JSON.stringify(loot.getState()), saveLootSettings)

    // ── 鍊金成本設定存檔 ──
    const ALCHEMY_SETTINGS_KEY = 'maple_alchemy_settings'

    function saveAlchemySettings() {
      try {
        localStorage.setItem(ALCHEMY_SETTINGS_KEY, JSON.stringify(alchemy.getState()))
      } catch {}
      pushAll()
    }

    function loadAlchemySettings() {
      try {
        const raw = localStorage.getItem(ALCHEMY_SETTINGS_KEY)
        if (raw) alchemy.setState(JSON.parse(raw))
      } catch {}
    }

    const conflictDialog = ref({ show: false, cloudData: null, cloudTime: null, localTime: null })

    function formatSyncTime(date) {
      if (!date) return '不明'
      const d = date instanceof Date ? date : new Date(date)
      return d.toLocaleString('zh-TW', {
        timeZone: 'Asia/Taipei',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit'
      })
    }

    function applyCloudData(data) {
      if (data.characters) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data.characters))
        loadSavedCharacters()
      }
      if (data.loot) {
        localStorage.setItem(LOOT_SETTINGS_KEY, JSON.stringify(data.loot))
        loadLootSettings()
      }
      if (data.alchemy) {
        localStorage.setItem(ALCHEMY_SETTINGS_KEY, JSON.stringify(data.alchemy))
        loadAlchemySettings()
      }
      if (data.equip) equip.setState(data.equip)
    }

    async function _applyWithGuard(data) {
      _pulling = true
      try { applyCloudData(data) } finally { await Vue.nextTick(); _pulling = false }
    }

    async function pullAll() {
      if (!sync.syncCode.value) return
      _pulling = true
      const data = await sync.pull(sync.syncCode.value)
      if (!data) { _pulling = false; return }
      await _applyWithGuard(data)
    }

    async function pushAll() {
      if (!sync.syncCode.value) return
      if (_pulling) return
      await sync.push(sync.syncCode.value, {
        characters: savedCharacters.value,
        loot: loot.getState(),
        alchemy: alchemy.getState(),
        equip: equip.getState()
      })
      if (sync.syncStatus.value !== 'error') {
        localStorage.setItem(SYNC_LAST_PUSH_KEY, new Date().toISOString())
      }
    }

    async function onSetSyncCode() {
      const code = sync.syncCodeDraft.value.trim()
      if (!code) return
      if (code.includes('/') || code === '.' || code === '..') {
        sync.syncStatus.value = 'error'
        setTimeout(() => { if (sync.syncStatus.value === 'error') sync.syncStatus.value = 'idle' }, 3000)
        return
      }
      sync.applySyncCode(code)

      const cloudData = await sync.pull(code)

      if (!cloudData) {
        await pushAll()
        return
      }

      const localSyncedAt = localStorage.getItem(SYNC_LAST_PUSH_KEY)
      if (!localSyncedAt) {
        await _applyWithGuard(cloudData)
        return
      }

      const cloudTime = cloudData.updatedAt?.toDate?.()
      if (!cloudTime) {
        await _applyWithGuard(cloudData)
        return
      }

      const localTime = new Date(localSyncedAt)
      if (isNaN(localTime.getTime())) {
        await _applyWithGuard(cloudData)
        return
      }
      const diffMs = Math.abs(cloudTime.getTime() - localTime.getTime())

      if (diffMs < 1000) {
        await _applyWithGuard(cloudData)
        return
      }

      conflictDialog.value = { show: true, cloudData, cloudTime, localTime }
    }

    async function resolveConflict(choice) {
      if (!conflictDialog.value.show) return
      const { cloudData } = conflictDialog.value
      conflictDialog.value = { show: false, cloudData: null, cloudTime: null, localTime: null }
      if (choice === 'cloud') {
        await _applyWithGuard(cloudData)
      } else {
        await pushAll()
      }
    }

    Vue.watch(() => JSON.stringify(alchemy.getState()), saveAlchemySettings)

    return {
      activeTab, equipZoom, changeEquipZoom, saveName, selectedSaveKey, saveMessage, savedCharacters,
      saveCharacter, loadCharacter, deleteCharacter, exportSaves, importSaves,
      jobs, partyBuffs, loading, loadError,
      groups, filteredJobs, selectedJob,
      selectedGroup, selectedJobId, selectedWeaponName, coefficient,
      onGroupChange, onJobChange, onWeaponChange,
      stats, needsStat,
      isValidNumber, formulaValid,
      mainStatValue, subStatValue, subStatLabel,
      tab1Buffs, tab1BuffTotals, initTab1Buffs,
      step1, step2, step3, step4,
      step5Boss, step5Mob, step6Boss, step6Mob,
      maxDmgBoss, minDmgBoss, avgDmgBoss, avgDmgBossCrit,
      maxDmgMob, minDmgMob, avgDmgMob, avgDmgMobCrit,
      accuracyMode, rawAccuracy, cappedAccuracy, cappedMonsterAvoid,
      playerAccuracyRoot, monsterAvoidRoot, hitRateBase, hitLevelPenalty, hitLevelDiff,
      maxHitRateByLevel, hitRateRaw, hitRate, hitRateNote,
      fmt, fmtFinal, fmtM, fmtDps, dpsFormat, DPS_FORMAT_LABELS, cycleDpsFormat,
      shareUrl,
      equip,
      slotSummary,
      exportToTab1,
      addCustomSkill,
      removeSkill,
      loot, saveLootSettings,
      alchemy, saveAlchemySettings,
      sync, onSetSyncCode,
      conflictDialog, resolveConflict, formatSyncTime,
    }
  }
}).mount('#app')
