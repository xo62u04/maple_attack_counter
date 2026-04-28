const { createApp, ref, computed, onMounted } = Vue

// Stub — full logic implemented when Task 3 replaces this file.
// Page will show "載入職業資料中..." indefinitely until Task 3 lands.

createApp({
  setup() {
    // ── 資料載入 ──
    const jobs = ref([])
    const loading = ref(true)
    const loadError = ref(false)

    // ── 選擇狀態 ──
    const selectedGroup = ref('')
    const selectedJobId = ref('')
    const selectedWeaponName = ref('')
    const coefficient = ref(1.0)

    // ── 屬性輸入 ──
    const stats = ref({
      STR: 0, DEX: 0, INT: 0, LUK: 0,
      atk: 0, atkPct: 0,
      skillPct: 100,
      totalDmgPct: 0, bossPct: 0, enhancePct: 0,
      bossDefPct: 0, ignoreDefPct: 0
    })

    // ── 存檔 ──
    const saveName = ref('')
    const selectedSaveKey = ref('')
    const saveMessage = ref('')
    const savedCharacters = ref([])

    return {
      jobs, loading, loadError,
      selectedGroup, selectedJobId, selectedWeaponName, coefficient,
      stats,
      saveName, selectedSaveKey, saveMessage, savedCharacters
    }
  }
}).mount('#app')
