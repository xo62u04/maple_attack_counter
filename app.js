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
      bossDefPct: 0, ignoreDefPct: 0,
      // 熟練度 & 爆擊（BigBang era）
      mastery: 60,
      critRate: 0,
      minCritBonus: 20,
      maxCritBonus: 50,
      // 小怪防禦率（BigBang PDRate，大部分小怪預設 10%）
      monsterDefPct: 10
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
      return [
        s.atk, s.atkPct, s.skillPct,
        s.totalDmgPct, s.bossPct, s.enhancePct,
        s.bossDefPct, s.ignoreDefPct,
        s.mastery, s.critRate, s.minCritBonus, s.maxCritBonus, s.monsterDefPct
      ].every(v => isValidNumber(v))
    })

    // ── 步驟 1–4（共用）──
    const step1 = computed(() => 4 * mainStatValue.value + subStatValue.value)
    const step2 = computed(() => step1.value * coefficient.value)
    const step3 = computed(() => (Number(stats.value.atk) || 0) * (1 + (Number(stats.value.atkPct) || 0) / 100))
    const step4 = computed(() => step2.value * step3.value * 0.01 * (Number(stats.value.skillPct) || 0) / 100)

    // ── 步驟 5（打王 vs 打小怪倍率）──
    const step5Boss = computed(() =>
      1 + ((Number(stats.value.totalDmgPct) || 0) + (Number(stats.value.bossPct) || 0) + (Number(stats.value.enhancePct) || 0)) / 100
    )
    const step5Mob = computed(() =>
      1 + ((Number(stats.value.totalDmgPct) || 0) + (Number(stats.value.enhancePct) || 0)) / 100
    )

    // ── 步驟 6（防禦折減）──
    // 打王：用 BOSS 防禦 %；打小怪：用怪物防禦率 %（BigBang PDRate）
    const step6Boss = computed(() =>
      1 - (Number(stats.value.bossDefPct) || 0) / 100 * (1 - (Number(stats.value.ignoreDefPct) || 0) / 100)
    )
    const step6Mob = computed(() =>
      1 - (Number(stats.value.monsterDefPct) || 0) / 100 * (1 - (Number(stats.value.ignoreDefPct) || 0) / 100)
    )

    // ── 最終傷害（打王）──
    const finalDmgBoss = computed(() => step4.value * step5Boss.value * step6Boss.value)
    const maxDmgBoss = computed(() => finalDmgBoss.value)
    const minDmgBoss = computed(() => finalDmgBoss.value * (Number(stats.value.mastery) || 0) / 100)
    const avgDmgBoss = computed(() => (maxDmgBoss.value + minDmgBoss.value) / 2)

    // ── 最終傷害（打小怪）──
    const finalDmgMob = computed(() => step4.value * step5Mob.value * step6Mob.value)
    const maxDmgMob = computed(() => finalDmgMob.value)
    const minDmgMob = computed(() => finalDmgMob.value * (Number(stats.value.mastery) || 0) / 100)
    const avgDmgMob = computed(() => (maxDmgMob.value + minDmgMob.value) / 2)

    // ── 爆擊平均（含爆率 × 平均爆傷）──
    // BigBang 前 2016 年：最小爆傷與最大爆傷分開計算
    // avg_with_crit = avg_no_crit × (1 + critRate% × (minCritBonus + maxCritBonus) / 200)
    const critMult = computed(() => {
      const rate = (Number(stats.value.critRate) || 0) / 100
      const avg = ((Number(stats.value.minCritBonus) || 0) + (Number(stats.value.maxCritBonus) || 0)) / 200
      return 1 + rate * avg
    })
    const avgDmgBossCrit = computed(() => avgDmgBoss.value * critMult.value)
    const avgDmgMobCrit = computed(() => avgDmgMob.value * critMult.value)

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
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(savedCharacters.value))
      } catch {
        saveMessage.value = '⚠️ 儲存失敗（瀏覽器儲存空間不足）'
      }
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
      // 使用 Object.assign，舊存檔缺少的新欄位保留預設值
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
        idef: stats.value.ignoreDefPct,
        mastery: stats.value.mastery,
        crit: stats.value.critRate,
        mincrit: stats.value.minCritBonus,
        maxcrit: stats.value.maxCritBonus,
        mdef: stats.value.monsterDefPct
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
      const skillRaw = params.get('skill')
      s.skillPct = skillRaw !== null ? parseFloat(skillRaw) : 100
      s.totalDmgPct = parseFloat(params.get('total')) || 0
      s.bossPct = parseFloat(params.get('boss')) || 0
      s.enhancePct = parseFloat(params.get('enhance')) || 0
      s.bossDefPct = parseFloat(params.get('bdef')) || 0
      s.ignoreDefPct = parseFloat(params.get('idef')) || 0
      // 新欄位（若舊連結不含則保留預設值）
      const masteryRaw = params.get('mastery')
      if (masteryRaw !== null) s.mastery = parseFloat(masteryRaw)
      const critRaw = params.get('crit')
      if (critRaw !== null) s.critRate = parseFloat(critRaw)
      const minCritRaw = params.get('mincrit')
      if (minCritRaw !== null) s.minCritBonus = parseFloat(minCritRaw)
      const maxCritRaw = params.get('maxcrit')
      if (maxCritRaw !== null) s.maxCritBonus = parseFloat(maxCritRaw)
      const mdefRaw = params.get('mdef')
      if (mdefRaw !== null) s.monsterDefPct = parseFloat(mdefRaw)
    }

    return {
      jobs, loading, loadError,
      groups, filteredJobs, selectedJob,
      selectedGroup, selectedJobId, selectedWeaponName, coefficient,
      onGroupChange, onJobChange, onWeaponChange,
      stats, needsStat,
      isValidNumber, formulaValid,
      mainStatValue, subStatValue, subStatLabel,
      step1, step2, step3, step4,
      step5Boss, step5Mob, step6Boss, step6Mob,
      maxDmgBoss, minDmgBoss, avgDmgBoss, avgDmgBossCrit,
      maxDmgMob, minDmgMob, avgDmgMob, avgDmgMobCrit,
      fmt, fmtFinal,
      saveName, selectedSaveKey, saveMessage, savedCharacters,
      saveCharacter, loadCharacter, deleteCharacter,
      shareUrl
    }
  }
}).mount('#app')
