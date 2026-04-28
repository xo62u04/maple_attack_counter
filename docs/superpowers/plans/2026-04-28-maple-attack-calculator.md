# 楓星攻擊力計算機 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立靜態網頁計算機，讓楓星玩家選擇職業、輸入屬性後即時看到傷害公式每步拆解與最終傷害，並可存檔與分享連結，部署於 GitHub Pages。

**Architecture:** Vue 3（CDN）單頁應用，`index.html` 掛載 Vue app，`app.js` 含所有響應式狀態與 computed 計算，`data.json` 存放職業武器資料由瀏覽器 fetch 載入。無 build pipeline，直接 push 到 GitHub Pages。

**Tech Stack:** Vue 3（CDN unpkg），原生 CSS（CSS Variables），localStorage API，URL API（URLSearchParams）

---

## 檔案對應

| 檔案 | 職責 |
|------|------|
| `index.html` | HTML 骨架、Vue CDN 載入、#app 掛載點 |
| `style.css` | 深色楓之谷主題、雙欄佈局、響應式 |
| `app.js` | Vue createApp：資料 fetch、reactive state、所有 computed、存檔/分享邏輯 |
| `data.json` | 24 個職業的 id/name/group/mainStat/subStat/attackType/weapons 陣列 |

---

## Task 1：專案骨架與 .gitignore

**Files:**
- Create: `index.html`
- Create: `style.css`
- Create: `app.js`
- Modify: `.gitignore`

- [ ] **Step 1：建立 .gitignore**

內容如下（覆蓋現有）：

```
.superpowers/
```

- [ ] **Step 2：建立 index.html**

```html
<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>楓星攻擊力計算機</title>
  <link rel="stylesheet" href="style.css" />
</head>
<body>
  <div id="app">
    <header class="site-header">
      <h1>⚔️ 楓星攻擊力計算機</h1>
      <div class="header-actions">
        <button @click="saveCharacter" class="btn btn-save">💾 存檔</button>
        <button @click="shareUrl" class="btn btn-share">🔗 分享</button>
      </div>
    </header>

    <div v-if="loadError" class="error-banner">
      資料載入失敗，請重新整理頁面。
    </div>

    <div v-if="loading" class="loading">載入職業資料中...</div>

    <main v-else class="calculator">
      <!-- 左欄：輸入 -->
      <section class="input-panel">

        <div class="field-group">
          <label>職業群</label>
          <select v-model="selectedGroup" @change="onGroupChange">
            <option value="">請選擇職業群</option>
            <option v-for="g in groups" :key="g" :value="g">{{ g }}</option>
          </select>
        </div>

        <div class="field-group">
          <label>職業</label>
          <select v-model="selectedJobId" @change="onJobChange" :disabled="!selectedGroup">
            <option value="">請選擇職業</option>
            <option v-for="j in filteredJobs" :key="j.id" :value="j.id">{{ j.name }}</option>
          </select>
        </div>

        <div class="field-group" v-if="selectedJob">
          <label>武器</label>
          <select v-model="selectedWeaponName" @change="onWeaponChange">
            <option v-for="w in selectedJob.weapons" :key="w.name" :value="w.name">{{ w.name }}</option>
          </select>
        </div>

        <div class="field-group" v-if="selectedJob">
          <label>武器係數（可修改）</label>
          <input type="number" v-model.number="coefficient" step="0.01" min="0" />
        </div>

        <div class="divider"></div>

        <div class="field-group" v-if="needsStat('STR')">
          <label>STR{{ selectedJob && selectedJob.mainStat === 'STR' ? '（主屬）' : selectedJob && selectedJob.subStat.includes('STR') ? '（副屬）' : '' }}</label>
          <input type="number" v-model.number="stats.STR" min="0" :class="{ invalid: !isValidNumber(stats.STR) }" />
        </div>

        <div class="field-group" v-if="needsStat('DEX')">
          <label>DEX{{ selectedJob && selectedJob.mainStat === 'DEX' ? '（主屬）' : selectedJob && selectedJob.subStat.includes('DEX') ? '（副屬）' : '' }}</label>
          <input type="number" v-model.number="stats.DEX" min="0" :class="{ invalid: !isValidNumber(stats.DEX) }" />
        </div>

        <div class="field-group" v-if="needsStat('INT')">
          <label>INT{{ selectedJob && selectedJob.mainStat === 'INT' ? '（主屬）' : '' }}</label>
          <input type="number" v-model.number="stats.INT" min="0" :class="{ invalid: !isValidNumber(stats.INT) }" />
        </div>

        <div class="field-group" v-if="needsStat('LUK')">
          <label>LUK{{ selectedJob && selectedJob.mainStat === 'LUK' ? '（主屬）' : selectedJob && selectedJob.subStat.includes('LUK') ? '（副屬）' : '' }}</label>
          <input type="number" v-model.number="stats.LUK" min="0" :class="{ invalid: !isValidNumber(stats.LUK) }" />
        </div>

        <div class="divider"></div>

        <div class="field-group">
          <label>{{ selectedJob && selectedJob.attackType === 'magical' ? '魔法' : '物理' }}攻擊力</label>
          <input type="number" v-model.number="stats.atk" min="0" :class="{ invalid: !isValidNumber(stats.atk) }" />
        </div>

        <div class="field-group">
          <label>攻擊力 %</label>
          <div class="input-suffix">
            <input type="number" v-model.number="stats.atkPct" min="0" :class="{ invalid: !isValidNumber(stats.atkPct) }" />
            <span>%</span>
          </div>
        </div>

        <div class="field-group">
          <label>技能 %</label>
          <div class="input-suffix">
            <input type="number" v-model.number="stats.skillPct" min="0" :class="{ invalid: !isValidNumber(stats.skillPct) }" />
            <span>%</span>
          </div>
        </div>

        <div class="field-group">
          <label>總傷害 %</label>
          <div class="input-suffix">
            <input type="number" v-model.number="stats.totalDmgPct" min="0" :class="{ invalid: !isValidNumber(stats.totalDmgPct) }" />
            <span>%</span>
          </div>
        </div>

        <div class="field-group">
          <label>BOSS 傷害 %</label>
          <div class="input-suffix">
            <input type="number" v-model.number="stats.bossPct" min="0" :class="{ invalid: !isValidNumber(stats.bossPct) }" />
            <span>%</span>
          </div>
        </div>

        <div class="field-group">
          <label>強化傷害 %</label>
          <div class="input-suffix">
            <input type="number" v-model.number="stats.enhancePct" min="0" :class="{ invalid: !isValidNumber(stats.enhancePct) }" />
            <span>%</span>
          </div>
        </div>

        <div class="field-group">
          <label>BOSS 防禦 %</label>
          <div class="input-suffix">
            <input type="number" v-model.number="stats.bossDefPct" min="0" max="100" :class="{ invalid: !isValidNumber(stats.bossDefPct) }" />
            <span>%</span>
          </div>
        </div>

        <div class="field-group">
          <label>等效無視防禦 %</label>
          <div class="input-suffix">
            <input type="number" v-model.number="stats.ignoreDefPct" min="0" max="100" :class="{ invalid: !isValidNumber(stats.ignoreDefPct) }" />
            <span>%</span>
          </div>
        </div>

        <div class="divider"></div>

        <div class="save-section">
          <div class="field-group">
            <label>存檔名稱</label>
            <input type="text" v-model="saveName" placeholder="例：我的黑騎士" maxlength="20" />
          </div>
          <div class="save-actions">
            <button @click="saveCharacter" class="btn btn-save" :disabled="!saveName.trim()">💾 儲存</button>
            <select v-model="selectedSaveKey" @change="loadCharacter" v-if="savedCharacters.length > 0">
              <option value="">載入存檔...</option>
              <option v-for="c in savedCharacters" :key="c.name" :value="c.name">{{ c.name }}</option>
            </select>
            <button @click="deleteCharacter" class="btn btn-delete" v-if="selectedSaveKey" title="刪除此存檔">🗑️</button>
          </div>
          <div v-if="saveMessage" class="save-message">{{ saveMessage }}</div>
        </div>

      </section>

      <!-- 右欄：計算拆解 -->
      <section class="result-panel">
        <div v-if="!selectedJob" class="result-placeholder">
          ← 請先選擇職業並輸入數值
        </div>

        <div v-else-if="!formulaValid" class="result-placeholder">
          ⚠️ 請確認所有欄位皆為有效數字
        </div>

        <div v-else class="breakdown">
          <div class="breakdown-step">
            <div class="step-label">Step 1：主副屬加成</div>
            <div class="step-formula">
              (4 × {{ selectedJob.mainStat }} + {{ subStatLabel }})
            </div>
            <div class="step-value">
              = (4 × {{ fmt(mainStatValue) }} + {{ fmt(subStatValue) }})
              = <strong>{{ fmt(step1) }}</strong>
            </div>
          </div>

          <div class="breakdown-step">
            <div class="step-label">Step 2：× 武器係數 {{ coefficient }}</div>
            <div class="step-value">= <strong>{{ fmt(step2) }}</strong></div>
          </div>

          <div class="breakdown-step">
            <div class="step-label">Step 3：攻擊力效果</div>
            <div class="step-formula">
              ATK × (1 + 攻擊力%) = {{ fmt(stats.atk) }} × {{ (1 + stats.atkPct / 100).toFixed(2) }}
            </div>
            <div class="step-value">= <strong>{{ fmt(step3) }}</strong></div>
          </div>

          <div class="breakdown-step">
            <div class="step-label">Step 4：× 0.01 × 技能% {{ stats.skillPct }}%</div>
            <div class="step-value">= <strong>{{ fmt(step4) }}</strong></div>
          </div>

          <div class="breakdown-step">
            <div class="step-label">Step 5：傷害倍率</div>
            <div class="step-formula">
              1 + (總傷害% + BOSS% + 強化%) = 1 + ({{ stats.totalDmgPct }} + {{ stats.bossPct }} + {{ stats.enhancePct }}) / 100
            </div>
            <div class="step-value">= ×<strong>{{ step5multiplier.toFixed(4) }}</strong></div>
          </div>

          <div class="breakdown-step">
            <div class="step-label">Step 6：BOSS 防禦折減</div>
            <div class="step-formula">
              1 − {{ stats.bossDefPct }}% × (1 − {{ stats.ignoreDefPct }}%)
            </div>
            <div class="step-value">= ×<strong>{{ step6multiplier.toFixed(4) }}</strong></div>
          </div>

          <div class="final-result">
            <div class="final-label">最終傷害（單擊）</div>
            <div class="final-value">{{ fmtFinal(finalDamage) }}</div>
          </div>
        </div>
      </section>
    </main>
  </div>

  <script src="https://unpkg.com/vue@3/dist/vue.global.prod.js"></script>
  <script src="app.js"></script>
</body>
</html>
```

- [ ] **Step 3：建立 style.css**

```css
/* ── CSS Variables ── */
:root {
  --bg: #0f0f1a;
  --bg-panel: #1a1a2e;
  --bg-input: #16213e;
  --border: #2a2a4a;
  --accent: #ffd700;
  --accent-dim: #b8960a;
  --text: #e0e0e0;
  --text-dim: #8888aa;
  --success: #4ade80;
  --danger: #f87171;
  --step-bg: #1e1e35;
  --step-border: #2e2e50;
}

* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  background: var(--bg);
  color: var(--text);
  font-family: 'Segoe UI', '微軟正黑體', sans-serif;
  font-size: 14px;
  min-height: 100vh;
}

/* ── Header ── */
.site-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  background: var(--bg-panel);
  border-bottom: 2px solid var(--accent);
}

.site-header h1 {
  font-size: 20px;
  color: var(--accent);
  letter-spacing: 1px;
}

.header-actions { display: flex; gap: 8px; }

/* ── Buttons ── */
.btn {
  padding: 6px 14px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  transition: opacity 0.2s;
}
.btn:disabled { opacity: 0.4; cursor: not-allowed; }
.btn-save { background: var(--accent); color: #000; }
.btn-share { background: #4a90d9; color: #fff; }
.btn-delete { background: var(--danger); color: #fff; padding: 6px 10px; }

/* ── Layout ── */
.calculator {
  display: grid;
  grid-template-columns: 360px 1fr;
  gap: 0;
  min-height: calc(100vh - 60px);
}

/* ── Input Panel ── */
.input-panel {
  background: var(--bg-panel);
  border-right: 1px solid var(--border);
  padding: 20px;
  overflow-y: auto;
}

.field-group {
  margin-bottom: 12px;
}

.field-group label {
  display: block;
  color: var(--text-dim);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 4px;
}

.field-group input,
.field-group select {
  width: 100%;
  background: var(--bg-input);
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--text);
  padding: 8px 10px;
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s;
}

.field-group input:focus,
.field-group select:focus {
  border-color: var(--accent);
}

.field-group input.invalid {
  border-color: var(--danger);
}

.field-group select:disabled {
  opacity: 0.4;
}

.input-suffix {
  display: flex;
  align-items: center;
  gap: 6px;
}

.input-suffix input { flex: 1; }
.input-suffix span { color: var(--text-dim); font-size: 14px; }

.divider {
  height: 1px;
  background: var(--border);
  margin: 16px 0;
}

/* ── Save Section ── */
.save-section { margin-top: 8px; }

.save-actions {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-top: 8px;
}

.save-actions select {
  flex: 1;
  background: var(--bg-input);
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--text);
  padding: 6px 10px;
  font-size: 13px;
}

.save-message {
  margin-top: 6px;
  font-size: 12px;
  color: var(--success);
}

/* ── Result Panel ── */
.result-panel {
  padding: 24px;
  background: var(--bg);
  overflow-y: auto;
}

.result-placeholder {
  color: var(--text-dim);
  font-size: 16px;
  margin-top: 60px;
  text-align: center;
}

/* ── Breakdown ── */
.breakdown {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-width: 560px;
}

.breakdown-step {
  background: var(--step-bg);
  border: 1px solid var(--step-border);
  border-radius: 8px;
  padding: 12px 16px;
}

.step-label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--accent);
  margin-bottom: 4px;
}

.step-formula {
  font-size: 13px;
  color: var(--text-dim);
  margin-bottom: 4px;
}

.step-value {
  font-size: 15px;
  color: var(--text);
}

.step-value strong {
  color: #7ec8e3;
  font-size: 17px;
}

/* ── Final Result ── */
.final-result {
  background: #0d4d3a;
  border: 2px solid var(--accent);
  border-radius: 10px;
  padding: 20px;
  text-align: center;
  margin-top: 8px;
}

.final-label {
  font-size: 12px;
  color: var(--text-dim);
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 8px;
}

.final-value {
  font-size: 32px;
  font-weight: 700;
  color: var(--accent);
  letter-spacing: 1px;
}

/* ── Error / Loading ── */
.error-banner {
  background: #4a0000;
  border: 1px solid var(--danger);
  color: var(--danger);
  padding: 12px 24px;
  text-align: center;
}

.loading {
  text-align: center;
  padding: 60px;
  color: var(--text-dim);
  font-size: 16px;
}

/* ── Responsive ── */
@media (max-width: 768px) {
  .calculator {
    grid-template-columns: 1fr;
  }
  .input-panel {
    border-right: none;
    border-bottom: 1px solid var(--border);
  }
}
```

- [ ] **Step 4：建立 app.js 空殼（確認 Vue 掛載正常）**

```js
const { createApp, ref, computed, watch, onMounted } = Vue

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
```

- [ ] **Step 5：在瀏覽器開啟 index.html 確認頁面可載入（Vue 不報錯，顯示「載入職業資料中...」）**

在 `maple_attack_counter/` 目錄下用瀏覽器開啟 `index.html`（直接雙擊或 `file://` 路徑）。預期看到深色背景的頁面和「載入職業資料中...」文字。

- [ ] **Step 6：Commit**

```bash
cd maple_attack_counter
git add index.html style.css app.js .gitignore
git commit -m "feat: add project scaffold with Vue 3 CDN and dark theme CSS"
```

---

## Task 2：data.json — 完整職業資料

**Files:**
- Create: `data.json`

- [ ] **Step 1：建立 data.json**

```json
{
  "jobs": [
    {
      "id": "hero",
      "name": "英雄",
      "group": "冒險家 - 劍士系",
      "mainStat": "STR",
      "subStat": "DEX",
      "attackType": "physical",
      "weapons": [
        { "name": "單手劍", "coefficient": 1.20 },
        { "name": "雙手劍", "coefficient": 1.34 },
        { "name": "單手斧", "coefficient": 1.20 },
        { "name": "雙手斧", "coefficient": 1.34 }
      ]
    },
    {
      "id": "paladin",
      "name": "聖騎士",
      "group": "冒險家 - 劍士系",
      "mainStat": "STR",
      "subStat": "DEX",
      "attackType": "physical",
      "weapons": [
        { "name": "單手劍", "coefficient": 1.20 },
        { "name": "雙手劍", "coefficient": 1.34 },
        { "name": "單手斧", "coefficient": 1.20 },
        { "name": "雙手斧", "coefficient": 1.34 },
        { "name": "單手棍", "coefficient": 1.20 },
        { "name": "雙手棍", "coefficient": 1.34 }
      ]
    },
    {
      "id": "darkKnight",
      "name": "黑騎士",
      "group": "冒險家 - 劍士系",
      "mainStat": "STR",
      "subStat": "DEX",
      "attackType": "physical",
      "weapons": [
        { "name": "長槍", "coefficient": 1.49 },
        { "name": "矛",   "coefficient": 1.49 }
      ]
    },
    {
      "id": "firePoisonMage",
      "name": "火毒大魔導士",
      "group": "冒險家 - 魔法使系",
      "mainStat": "INT",
      "subStat": "LUK",
      "attackType": "magical",
      "weapons": [
        { "name": "長杖", "coefficient": 1.20 },
        { "name": "短杖", "coefficient": 1.20 }
      ]
    },
    {
      "id": "iceLightningMage",
      "name": "冰雷大魔導士",
      "group": "冒險家 - 魔法使系",
      "mainStat": "INT",
      "subStat": "LUK",
      "attackType": "magical",
      "weapons": [
        { "name": "長杖", "coefficient": 1.20 },
        { "name": "短杖", "coefficient": 1.20 }
      ]
    },
    {
      "id": "bishop",
      "name": "主教",
      "group": "冒險家 - 魔法使系",
      "mainStat": "INT",
      "subStat": "LUK",
      "attackType": "magical",
      "weapons": [
        { "name": "長杖", "coefficient": 1.20 },
        { "name": "短杖", "coefficient": 1.20 }
      ]
    },
    {
      "id": "bowmaster",
      "name": "箭神",
      "group": "冒險家 - 弓箭手系",
      "mainStat": "DEX",
      "subStat": "STR",
      "attackType": "physical",
      "weapons": [
        { "name": "弓", "coefficient": 1.30 }
      ]
    },
    {
      "id": "marksman",
      "name": "神射手",
      "group": "冒險家 - 弓箭手系",
      "mainStat": "DEX",
      "subStat": "STR",
      "attackType": "physical",
      "weapons": [
        { "name": "弩", "coefficient": 1.35 }
      ]
    },
    {
      "id": "nightLord",
      "name": "夜使者",
      "group": "冒險家 - 盜賊系",
      "mainStat": "LUK",
      "subStat": "DEX",
      "attackType": "physical",
      "weapons": [
        { "name": "拳套（爪型）", "coefficient": 1.75 }
      ]
    },
    {
      "id": "shadower",
      "name": "暗影神偷",
      "group": "冒險家 - 盜賊系",
      "mainStat": "LUK",
      "subStat": "DEX+STR",
      "attackType": "physical",
      "weapons": [
        { "name": "短劍", "coefficient": 1.30 }
      ]
    },
    {
      "id": "dualBlade",
      "name": "影武者",
      "group": "冒險家 - 盜賊系",
      "mainStat": "LUK",
      "subStat": "DEX+STR",
      "attackType": "physical",
      "weapons": [
        { "name": "雙刀", "coefficient": 1.30 }
      ]
    },
    {
      "id": "buccaneer",
      "name": "拳霸",
      "group": "冒險家 - 海賊系",
      "mainStat": "STR",
      "subStat": "DEX",
      "attackType": "physical",
      "weapons": [
        { "name": "拳套", "coefficient": 1.70 }
      ]
    },
    {
      "id": "corsair",
      "name": "槍神",
      "group": "冒險家 - 海賊系",
      "mainStat": "DEX",
      "subStat": "STR",
      "attackType": "physical",
      "weapons": [
        { "name": "手槍", "coefficient": 1.50 }
      ]
    },
    {
      "id": "cannoneer",
      "name": "重砲指揮官",
      "group": "冒險家 - 海賊系",
      "mainStat": "STR",
      "subStat": "DEX",
      "attackType": "physical",
      "weapons": [
        { "name": "大砲", "coefficient": 1.50 }
      ]
    },
    {
      "id": "aran",
      "name": "狂狼勇士",
      "group": "英雄傳說",
      "mainStat": "STR",
      "subStat": "DEX",
      "attackType": "physical",
      "weapons": [
        { "name": "矛", "coefficient": 1.49 }
      ]
    },
    {
      "id": "evan",
      "name": "龍魔導士",
      "group": "英雄傳說",
      "mainStat": "INT",
      "subStat": "LUK",
      "attackType": "magical",
      "weapons": [
        { "name": "長杖", "coefficient": 1.20 },
        { "name": "短杖", "coefficient": 1.20 }
      ]
    },
    {
      "id": "battleMage",
      "name": "煉獄巫師",
      "group": "末日反抗軍",
      "mainStat": "INT",
      "subStat": "LUK",
      "attackType": "magical",
      "weapons": [
        { "name": "長杖", "coefficient": 1.20 }
      ]
    },
    {
      "id": "wildHunter",
      "name": "狂豹獵人",
      "group": "末日反抗軍",
      "mainStat": "DEX",
      "subStat": "STR",
      "attackType": "physical",
      "weapons": [
        { "name": "弩", "coefficient": 1.35 }
      ]
    },
    {
      "id": "mechanic",
      "name": "機甲戰神",
      "group": "末日反抗軍",
      "mainStat": "DEX",
      "subStat": "STR",
      "attackType": "physical",
      "weapons": [
        { "name": "火槍", "coefficient": 1.50 }
      ]
    },
    {
      "id": "demonSlayer",
      "name": "惡魔殺手",
      "group": "惡魔",
      "mainStat": "STR",
      "subStat": "DEX",
      "attackType": "physical",
      "weapons": [
        { "name": "單手棍", "coefficient": 1.20 }
      ]
    },
    {
      "id": "mercedes",
      "name": "精靈遊俠",
      "group": "精靈",
      "mainStat": "DEX",
      "subStat": "STR",
      "attackType": "physical",
      "weapons": [
        { "name": "雙弩", "coefficient": 1.30 }
      ]
    },
    {
      "id": "phantom",
      "name": "幻影",
      "group": "幻影",
      "mainStat": "LUK",
      "subStat": "DEX",
      "attackType": "physical",
      "weapons": [
        { "name": "手杖", "coefficient": 1.30 }
      ]
    },
    {
      "id": "hayato",
      "name": "劍豪",
      "group": "劍豪",
      "mainStat": "STR",
      "subStat": "DEX",
      "attackType": "physical",
      "weapons": [
        { "name": "武士刀", "coefficient": 1.25 }
      ]
    },
    {
      "id": "kanna",
      "name": "陰陽師",
      "group": "陰陽師",
      "mainStat": "INT",
      "subStat": "LUK",
      "attackType": "magical",
      "weapons": [
        { "name": "扇子", "coefficient": 1.35 }
      ]
    }
  ]
}
```

- [ ] **Step 2：驗證 JSON 格式正確**

```bash
node -e "const d = require('./data.json'); console.log('Jobs:', d.jobs.length, '職業')"
```

預期輸出：`Jobs: 24 職業`

- [ ] **Step 3：Commit**

```bash
git add data.json
git commit -m "feat: add complete job and weapon coefficient data (24 classes)"
```

---

## Task 3：Vue app — 資料載入與 computed 選擇狀態

**Files:**
- Modify: `app.js`

- [ ] **Step 1：實作 fetch data.json 與 groups/filteredJobs computed**

用以下內容完整替換 `app.js`（此步驟包含所有 computed，後續 Task 只會新增不會重複）：

```js
const { createApp, ref, computed, watch, onMounted } = Vue

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
      return job.subStat  // "DEX", "STR", "LUK", or "DEX+STR"
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
```

- [ ] **Step 2：瀏覽器手動驗證計算公式**

開啟 `index.html`，選擇「黑騎士」→ 「矛」（係數 1.49）並輸入以下數值，確認右欄結果符合預期：

| 欄位 | 輸入值 |
|------|--------|
| STR | 4000 |
| DEX | 500 |
| 攻擊力 | 2000 |
| 攻擊力% | 150 |
| 技能% | 500 |
| 總傷害% | 100 |
| BOSS% | 250 |
| 強化% | 0 |
| BOSS防禦% | 50 |
| 等效無視% | 70 |

手動計算驗證：
- Step1 = 4×4000 + 500 = 16,500
- Step2 = 16,500 × 1.49 = 24,585
- Step3 = 2000 × (1 + 150/100) = 5,000
- Step4 = 24,585 × 5,000 × 0.01 × (500/100) = 24,585 × 5,000 × 0.01 × 5 = 6,146,250
- Step5 = 1 + (100+250+0)/100 = 4.50
- Step6 = 1 - 0.50 × (1 - 0.70) = 1 - 0.15 = 0.85
- 最終 = 6,146,250 × 4.50 × 0.85 = **23,509,406**

右欄「最終傷害」應顯示 `23,509,406`。

- [ ] **Step 3：Commit**

```bash
git add app.js
git commit -m "feat: implement complete Vue app with formula, save/load, and URL share"
```

---

## Task 4：GitHub Pages 部署

**Files:**
- Modify: `.gitignore`（確認 `.superpowers/` 已加入）

- [ ] **Step 1：確認 .gitignore 包含 .superpowers/**

確認 `.gitignore` 內容：
```
.superpowers/
```

- [ ] **Step 2：push 到 GitHub**

```bash
git push origin main
```

- [ ] **Step 3：開啟 GitHub repo 設定 Pages**

1. 瀏覽 `https://github.com/xo62u04/maple_attack_counter`
2. 點 **Settings** → 左側 **Pages**
3. Source 選 **Deploy from a branch**
4. Branch 選 **main**，folder 選 **/ (root)**
5. 按 **Save**
6. 等候約 1–2 分鐘，頁面會顯示部署網址

- [ ] **Step 4：驗證 GitHub Pages 正常運作**

開啟 `https://xo62u04.github.io/maple_attack_counter/`，確認：
1. 頁面正常載入（不是 404）
2. 職業下拉有資料（data.json 正確抓到）
3. 選一個職業、輸入數值，右欄即時更新
4. 按「分享」複製連結，新分頁開啟連結後數值自動填入
5. 存一筆存檔，重新整理後下拉選單仍有該存檔

---

## 自我審查（Spec Coverage）

| 規格需求 | 對應 Task |
|----------|-----------|
| 物攻 / 魔攻兩種類型 | Task 3（attackType 判斷攻擊力標籤） |
| 24 個四轉職業 | Task 2（data.json 24 個 job 物件） |
| 職業選擇自動帶武器 / 係數 | Task 3（onJobChange / onWeaponChange） |
| 係數可手動修改 | Task 1（index.html 係數欄位可編輯） |
| 雙欄：輸入 + 即時拆解 | Task 1（index.html 雙欄佈局）+ Task 3（computed step1~6） |
| 副屬 DEX+STR 合計 | Task 3（subStatValue computed） |
| localStorage 存檔（最多 20 筆） | Task 3（saveCharacter / loadCharacter / deleteCharacter） |
| URL 分享 | Task 3（shareUrl / loadFromUrl） |
| data.json 動態 fetch | Task 3（onMounted fetch） |
| 載入失敗錯誤提示 | Task 3（loadError ref） |
| 非數字輸入標紅 | Task 1（.invalid class）+ Task 3（isValidNumber） |
| GitHub Pages 部署 | Task 4 |
