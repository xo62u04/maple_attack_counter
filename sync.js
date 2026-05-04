// sync.js — Firebase Cloud Sync Composable
// Vue 3 CDN (no build pipeline), Firebase 10.x compat SDK

function useSync() {
  const { ref, computed } = Vue

  const SYNC_CODE_KEY = 'maple_sync_code'

  const syncCode      = ref(localStorage.getItem(SYNC_CODE_KEY) || '')
  const syncCodeDraft = ref(syncCode.value)
  const syncStatus    = ref('idle') // 'idle' | 'syncing' | 'ok' | 'error'

  let db = null

  function _initFirebase() {
    if (db) return
    const firebaseConfig = {
      apiKey:            "AIzaSyAcnkakdpO_0CC2Zm0XWdcqv2cjOgd029I",
      authDomain:        "aplecounter.firebaseapp.com",
      projectId:         "aplecounter",
      storageBucket:     "aplecounter.firebasestorage.app",
      messagingSenderId: "385192643267",
      appId:             "1:385192643267:web:be4a1655ed13ecffcb7076"
    }
    const app = firebase.apps.length ? firebase.app() : firebase.initializeApp(firebaseConfig)
    db = firebase.firestore(app)
  }

  async function pull(code) {
    syncStatus.value = 'syncing'
    _initFirebase()
    try {
      const snap = await db.collection('syncs').doc(code).get()
      syncStatus.value = 'ok'
      setTimeout(() => { if (syncStatus.value === 'ok') syncStatus.value = 'idle' }, 3000)
      return snap.exists ? snap.data() : null
    } catch (e) {
      console.error('[sync] pull failed:', e)
      syncStatus.value = 'error'
      setTimeout(() => { if (syncStatus.value === 'error') syncStatus.value = 'idle' }, 5000)
      return null
    }
  }

  async function push(code, data) {
    syncStatus.value = 'syncing'
    _initFirebase()
    try {
      await db.collection('syncs').doc(code).set({
        ...data,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      })
      syncStatus.value = 'ok'
      setTimeout(() => { if (syncStatus.value === 'ok') syncStatus.value = 'idle' }, 3000)
    } catch (e) {
      console.error('[sync] push failed:', e)
      syncStatus.value = 'error'
      setTimeout(() => { if (syncStatus.value === 'error') syncStatus.value = 'idle' }, 5000)
    }
  }

  function applySyncCode(code) {
    syncCode.value      = code
    syncCodeDraft.value = code
    localStorage.setItem(SYNC_CODE_KEY, code)
  }

  function clearSyncCode() {
    syncCode.value      = ''
    syncCodeDraft.value = ''
    syncStatus.value    = 'idle'
    localStorage.removeItem(SYNC_CODE_KEY)
  }

  const statusText = computed(() => ({
    idle:    '',
    syncing: '⏳ 同步中...',
    ok:      '✅ 已同步',
    error:   '❌ 同步失敗'
  }[syncStatus.value]))

  return { syncCode, syncCodeDraft, syncStatus, statusText, pull, push, applySyncCode, clearSyncCode }
}
