// gacha.js — 轉蛋試算機 Composable
// 188,100 里程 = 200抽；匯率：N 里程 / 1000萬楓幣 由使用者設定

function useGacha() {
  const { ref, computed } = Vue

  const PULL_MP = 940.5 // 188100 / 200，每抽花費里程數

  const ITEMS = [
    // ── 傳說級 ──
    { id: 'warrior_badge',    name: '傳說中的勇士胸章',        rate: 0.007,  cat: '傳說級' },
    { id: 'rhi_heart',        name: '鋰之心',                  rate: 0.021,  cat: '傳說級' },
    { id: 'arcane_essence',   name: '太初之精髓',              rate: 0.038,  cat: '傳說級' },
    // ── 特殊道具 ──
    { id: 'canter_mirror',    name: '坎特的水鏡',              rate: 0.124,  cat: '特殊道具' },
    { id: 'silver_brand',     name: '銀烙印的印章',            rate: 0.73,   cat: '特殊道具' },
    { id: 'gold_brand',       name: '金烙印的印章',            rate: 0.585,  cat: '特殊道具' },
    { id: 'special_brand',    name: '特別刻印之印',            rate: 0.18,   cat: '特殊道具' },
    { id: 'silver_add',       name: '銀色附加潛力印章',        rate: 0.692,  cat: '特殊道具' },
    { id: 'gold_add',         name: '金色附加潛力印章',        rate: 0.516,  cat: '特殊道具' },
    { id: 'special_add',      name: '特別附加潛力印章',        rate: 0.062,  cat: '特殊道具' },
    { id: 'special_pot_scr',  name: '特殊潛力賦予卷軸',        rate: 0.065,  cat: '特殊道具' },
    { id: 'special_add_scr',  name: '特殊附加潛力賦予卷軸',   rate: 0.045,  cat: '特殊道具' },
    // ── 工具 ──
    { id: 'hammer_50',        name: '黃金鐵鎚 50%',           rate: 1.25,   cat: '工具' },
    { id: 'hammer',           name: '黃金鐵鎚',                rate: 0.457,  cat: '工具' },
    { id: 'wonder_scroll',    name: '不可思議的卷軸',          rate: 4,      cat: '工具' },
    { id: 'wonder_recipe',    name: '不可思議的配方',          rate: 3,      cat: '工具' },
    { id: 'protect_scroll',   name: '保護卷軸',                rate: 1,      cat: '工具' },
    // ── 特殊券 ──
    { id: 'exp_2x',           name: '經驗值2倍券',             rate: 4,      cat: '特殊券' },
    { id: 'mystery_book',     name: '[百科書]神秘百科書',      rate: 3,      cat: '特殊券' },
    // ── 坐騎 ──
    { id: 'barogo_perm',      name: '巴洛古騎寵券（永久）',   rate: 0.18,   cat: '坐騎' },
    { id: 'barogo_7d',        name: '巴洛古騎寵7天',          rate: 3,      cat: '坐騎' },
    { id: 'snowjira_perm',    name: '雪吉拉騎寵券（永久）',   rate: 0.18,   cat: '坐騎' },
    { id: 'snowjira_7d',      name: '雪吉拉騎寵7天',          rate: 3,      cat: '坐騎' },
    { id: 'nightmare_perm',   name: '夢魘騎寵券（永久）',     rate: 0.18,   cat: '坐騎' },
    { id: 'nightmare_7d',     name: '夢魘騎寵7天',            rate: 3,      cat: '坐騎' },
    // ── 椅子 ──
    { id: 'mini_divine',      name: '迷你神獸椅',              rate: 0.05,   cat: '椅子' },
    { id: 'gem_maple',        name: '寶石楓葉椅子',            rate: 0.55,   cat: '椅子' },
    { id: 'under_maple',      name: '楓樹下',                  rate: 0.55,   cat: '椅子' },
    { id: 'cat_love',         name: '貓咪的愛椅子',            rate: 0.55,   cat: '椅子' },
    { id: 'summer_cat',       name: '涼夏貓咪椅',              rate: 0.55,   cat: '椅子' },
    { id: 'flower_view',      name: '賞花椅',                  rate: 0.55,   cat: '椅子' },
    { id: 'swing',            name: '盪鞦韆',                  rate: 0.8,    cat: '椅子' },
    { id: 'warm_table',       name: '暖暖桌',                  rate: 0.8,    cat: '椅子' },
    { id: 'hinoki_tub',       name: '澎澎檜木桶',              rate: 0.8,    cat: '椅子' },
    { id: 'love_chair',       name: '戀愛椅子',                rate: 0.8,    cat: '椅子' },
    { id: 'stripe_chair',     name: '紅藍條紋椅',              rate: 0.8,    cat: '椅子' },
    // ── 消耗品 ──
    { id: 'super_100',        name: '超級藥水 (100個)',         rate: 1,      cat: '消耗品' },
    { id: 'super_50',         name: '超級藥水 (50個)',          rate: 3,      cat: '消耗品' },
    { id: 'super_15',         name: '超級藥水 (15個)',          rate: 8,      cat: '消耗品' },
    { id: 'heal_100',         name: '萬能療傷藥 (100個)',       rate: 1,      cat: '消耗品' },
    { id: 'heal_50',          name: '萬能療傷藥 (50個)',        rate: 3,      cat: '消耗品' },
    { id: 'heal_15',          name: '萬能療傷藥 (15個)',        rate: 8,      cat: '消耗品' },
    // ── 硬幣 ──
    { id: 'coin_5',           name: '露西亞硬幣 (5個)',         rate: 1.85,   cat: '硬幣' },
    { id: 'coin_4',           name: '露西亞硬幣 (4個)',         rate: 3.12,   cat: '硬幣' },
    { id: 'coin_3',           name: '露西亞硬幣 (3個)',         rate: 4.27,   cat: '硬幣' },
    { id: 'coin_2',           name: '露西亞硬幣 (2個)',         rate: 8.71,   cat: '硬幣' },
    { id: 'coin_1',           name: '露西亞硬幣 (1個)',         rate: 21.938, cat: '硬幣' },
  ]

  // 分類順序
  const CAT_ORDER = ['傳說級', '特殊道具', '工具', '特殊券', '坐騎', '椅子', '消耗品', '硬幣']

  // 分類折疊狀態
  const collapsedCats = ref(new Set(['消耗品', '硬幣']))

  function toggleCat(cat) {
    const s = new Set(collapsedCats.value)
    s.has(cat) ? s.delete(cat) : s.add(cat)
    collapsedCats.value = s
  }

  // ── 設定 ──
  // mpPer10M：每 1000萬楓幣 可換幾點里程（使用者輸入）
  const mpPer10M = ref(1000)

  // ── 市價輸入（萬楓幣），key = item.id ──
  const prices = ref({})

  // ── 每抽成本（楓幣）──
  const costPerPull = computed(() => {
    const rate = Number(mpPer10M.value)
    if (!rate || rate <= 0) return 0
    return Math.round(PULL_MP * (10_000_000 / rate))
  })

  // ── 帶計算的物品清單 ──
  const enriched = computed(() =>
    ITEMS.map(item => {
      const priceWan = Number(prices.value[item.id]) || 0
      const price    = priceWan * 10000             // 轉換：萬楓幣 → 楓幣
      const avgPulls = 100 / item.rate              // 平均抽到次數
      const avgCost  = avgPulls * costPerPull.value // 平均花費（楓幣）
      const evPerPull = (item.rate / 100) * price   // 每抽期望值（楓幣）
      const profit   = price > 0 ? price - avgCost : null
      const profitPct = price > 0 && avgCost > 0
        ? ((price - avgCost) / avgCost * 100)
        : null
      return {
        ...item,
        price,
        avgPulls,
        avgCost,
        evPerPull,
        profit,
        profitPct,
        isProfitable: profit !== null && profit > 0,
      }
    })
  )

  // ── 整體分析 ──
  const totalEvPerPull = computed(() =>
    enriched.value.reduce((s, i) => s + i.evPerPull, 0)
  )
  const evVsCost = computed(() => totalEvPerPull.value - costPerPull.value)

  // ── 200抽完整期望值 ──
  const totalEv200 = computed(() => totalEvPerPull.value * 200)
  const cost200    = computed(() => costPerPull.value * 200)

  // ── 按分類分組 ──
  const groupedItems = computed(() => {
    const map = {}
    for (const cat of CAT_ORDER) map[cat] = []
    for (const item of enriched.value) {
      if (map[item.cat]) map[item.cat].push(item)
    }
    return CAT_ORDER.map(cat => ({ cat, items: map[cat] }))
  })

  function getState() {
    return { mpPer10M: mpPer10M.value, prices: { ...prices.value } }
  }
  function setState(s) {
    if (!s) return
    if (s.mpPer10M != null) mpPer10M.value = s.mpPer10M
    if (s.prices)           prices.value   = { ...s.prices }
  }

  return {
    ITEMS, CAT_ORDER, collapsedCats, toggleCat,
    mpPer10M, prices,
    costPerPull, enriched, groupedItems,
    totalEvPerPull, evVsCost, totalEv200, cost200,
    getState, setState,
  }
}
