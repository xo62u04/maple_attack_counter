const { createApp, ref, computed, onMounted } = Vue

createApp({
  setup() {
    // ── 資料載入 ──
    const jobs = ref([])
    const loading = ref(true)
    const loadError = ref(false)

    onMounted(async () => {
      try {
        const res = await fetch('data.json')
        if (!res.ok) throw new Error('HTTP ' + res.status)
        const data = await res.json()
        jobs.value = data.jobs
      } catch (e) {
        loadError.value = true
      } finally {
        loading.value = false
      }
      loadFromUrl()
      loadSavedCharacters()
    })

    // ── 選擇狀態 ──
    const selectedGroup = ref('')
    const selectedJobId = ref('')
    const selectedWeaponName = ref('')
    const coefficient = ref(1.0)

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
      selectedJobId.value = ''
      selectedWeaponName.value = ''
      coefficient.value = 1.0
    }

    function onJobChange() {
      const job = selectedJob.value
      if (!job) return
      selectedWeaponName.value = job.weapons[0]?.name || ''
      coefficient.value = job.weapons[0]?.coefficient || 1.0
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
      bossDefPct: 0, ignoreDefPct: 0
    })

    // ── 需要顯示哪些屬性欄位 ──
    function needsStat(stat) {
      const job = selectedJob.value
      if (!job) return false
      return job.mainStat === stat || job.subStat.includes(stat)
    }

    // ── 公式計算 ──
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

    const subStatLabel = computed(() => {
      const job = selectedJob.value
      if (!job) return ''
      return job.subStat
    })

    const formulaValid = computed(() => {
      if (!selectedJob.value) return false
      const s = stats.value
      return [s.atk, s.atkPct, s.skillPct, s.totalDmgPct, s.bossPct, s.enhancePct, s.bossDefPct, s.ignoreDefPct]
        .every(v => isValidNumber(v))
    })

    const step1 = computed(() => 4 * mainStatValue.value + subStatValue.value)
    const step2 = computed(() => step1.value * coefficient.value)
    const step3 = computed(() => (Number(stats.value.atk) || 0) * (1 + (Number(stats.value.atkPct) || 0) / 100))
    const step4 = computed(() => step2.value * step3.value * 0.01 * (Number(stats.value.skillPct) || 0) / 100)
    const step5multiplier = computed(() =>
      1 + ((Number(stats.value.totalDmgPct) || 0) + (Number(stats.value.bossPct) || 0) + (Number(stats.value.enhancePct) || 0)) / 100
    )
    const step6multiplier = computed(() =>
      1 - (Number(stats.value.bossDefPct) || 0) / 100 * (1 - (Number(stats.value.ignoreDefPct) || 0) / 100)
    )
    const finalDamage = computed(() => step4.value * step5multiplier.value * step6multiplier.value)

    // ── 格式化 ──
    function fmt(n) {
      return Math.round(n).toLocaleString('zh-TW')
    }
    function fmtFinal(n) {
      if (!formulaValid.value) return '-'
      return Math.round(n).toLocaleString('zh-TW')
    }

    // ── 存檔（localStorage）──
    const STORAGE_KEY = 'maple_calc_characters'
    const MAX_SAVES = 20
    const saveName = ref('')
    const selectedSaveKey = ref('')
    const saveMessage = ref('')
    const savedCharacters = ref([])

    function loadSavedCharacters() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY)
        savedCharacters.value = raw ? JSON.parse(raw) : []
      } catch {
        savedCharacters.value = []
      }
    }

    function persistSaves() {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(savedCharacters.value))
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
        stats: { ...stats.value }
      }
      const idx = savedCharacters.value.findIndex(c => c.name === name)
      if (idx >= 0) {
        savedCharacters.value[idx] = entry
      } else {
        savedCharacters.value.push(entry)
      }
      persistSaves()
      saveMessage.value = `✅ 已儲存「${name}」`
      setTimeout(() => { saveMessage.value = '' }, 2000)
    }

    function loadCharacter() {
      const key = selectedSaveKey.value
      if (!key) return
      const entry = savedCharacters.value.find(c => c.name === key)
      if (!entry) return
      selectedGroup.value = entry.group
      selectedJobId.value = entry.jobId
      selectedWeaponName.value = entry.weaponName
      coefficient.value = entry.coefficient
      Object.assign(stats.value, entry.stats)
      saveName.value = entry.name
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
        str: stats.value.STR,
        dex: stats.value.DEX,
        int: stats.value.INT,
        luk: stats.value.LUK,
        atk: stats.value.atk,
        atkp: stats.value.atkPct,
        skill: stats.value.skillPct,
        total: stats.value.totalDmgPct,
        boss: stats.value.bossPct,
        enhance: stats.value.enhancePct,
        bdef: stats.value.bossDefPct,
        idef: stats.value.ignoreDefPct
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
      selectedGroup.value = params.get('group') || job.group
      selectedJobId.value = jobId
      selectedWeaponName.value = params.get('weapon') || job.weapons[0]?.name || ''
      coefficient.value = parseFloat(params.get('coeff')) || job.weapons[0]?.coefficient || 1.0
      const s = stats.value
      s.STR = parseInt(params.get('str')) || 0
      s.DEX = parseInt(params.get('dex')) || 0
      s.INT = parseInt(params.get('int')) || 0
      s.LUK = parseInt(params.get('luk')) || 0
      s.atk = parseInt(params.get('atk')) || 0
      s.atkPct = parseFloat(params.get('atkp')) || 0
      s.skillPct = parseFloat(params.get('skill')) || 100
      s.totalDmgPct = parseFloat(params.get('total')) || 0
      s.bossPct = parseFloat(params.get('boss')) || 0
      s.enhancePct = parseFloat(params.get('enhance')) || 0
      s.bossDefPct = parseFloat(params.get('bdef')) || 0
      s.ignoreDefPct = parseFloat(params.get('idef')) || 0
    }

    return {
      jobs, loading, loadError,
      groups, filteredJobs, selectedJob,
      selectedGroup, selectedJobId, selectedWeaponName, coefficient,
      onGroupChange, onJobChange, onWeaponChange,
      stats, needsStat,
      isValidNumber, formulaValid,
      mainStatValue, subStatValue, subStatLabel,
      step1, step2, step3, step4, step5multiplier, step6multiplier, finalDamage,
      fmt, fmtFinal,
      saveName, selectedSaveKey, saveMessage, savedCharacters,
      saveCharacter, loadCharacter, deleteCharacter,
      shareUrl
    }
  }
}).mount('#app')
