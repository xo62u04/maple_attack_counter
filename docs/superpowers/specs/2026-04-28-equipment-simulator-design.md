# 楓星裝備模擬器 — 設計文件

**日期：** 2026-04-28
**版本：** 1.0
**目標：** 在現有攻擊力計算機中新增「裝備模擬器」Tab，讓玩家輸入全身裝備屬性並計算攻屬比、DPS、MDPS，以判斷哪件裝備升級效益最高。

---

## 一、專案概覽

### 新增功能
- 在現有 `index.html` 加入 Tab 切換（攻擊力計算機 ↔ 裝備模擬器）
- 裝備模擬器可輸入 25 個裝備槽：本體屬性 + 衝捲 + 潛能（3 行）
- 職業技能自動帶入（可修改）+ 隊伍 BUFF 勾選清單（數值可修改）
- 攻屬比分析：1% 主屬性 = X 攻擊力
- DPS / MDPS 輸出（打王 & 打小怪分開）
- 裝備組合可存入 localStorage（最多 20 組）

### 不在範圍內
- 強化系統（星力、楓葉神器）
- 裝備掉落機率計算
- 多角色對比

---

## 二、檔案結構變動

```
maple_attack_counter/
├── index.html          ← 修改：加 Tab 切換 + 裝備模擬器 HTML 區塊
├── app.js              ← 修改：加裝備模擬器 Vue 邏輯
├── style.css           ← 修改：加裝備模擬器 CSS
├── data.json           ← 修改：加各職業技能預設值 + BUFF 清單
└── equip.js            ← 新建：裝備模擬器獨立 Vue composable
```

`equip.js` 負責所有裝備相關狀態與計算，`app.js` 只負責 Tab 狀態切換與共用職業資料橋接。

---

## 三、25 個裝備槽定義

| 分組 | 槽位（id） |
|------|-----------|
| 武器類 | `weapon`, `secondary` |
| 防具類 | `hat`, `top`, `bottom`, `glove`, `shoe`, `cape`, `shoulder`, `belt`, `heart` |
| 飾品類 | `face`, `eye`, `earring`, `pendant`, `pocket`, `title`, `ring1`, `ring2`, `ring3`, `ring4` |
| 特殊類 | `energy`, `pet1`, `pet2`, `pet3` |

---

## 四、每個裝備槽的資料結構

```js
{
  id: 'hat',
  name: '頭盔',               // 使用者可修改的備注名稱
  group: 'armor',            // 'weapon' | 'armor' | 'accessory' | 'special'
  base: {
    mainStat: 0,             // 主屬性（STR/DEX/INT/LUK，依職業）
    subStat: 0,              // 副屬性
    atk: 0,                  // 物/魔攻擊力
    allStat: 0               // 全屬性
  },
  scroll: {
    count: 0,                // 衝捲成功次數
    perScroll: 0,            // 每次獲得的主屬或 ATK
    stat: 'mainStat'         // 'mainStat' | 'atk'（武器填 atk，防具填 mainStat）
  },
  potential: [
    { type: 'none', value: 0 },   // 潛能行 1
    { type: 'none', value: 0 },   // 潛能行 2
    { type: 'none', value: 0 }    // 潛能行 3
  ]
}
```

---

## 五、潛能類型（type 值）

| type | 說明 | 計入公式位置 |
|------|------|------------|
| `mainStatPct` | %主屬性 | 乘入總 %主屬 |
| `subStatPct` | %副屬性 | 乘入總 %副屬 |
| `allStatPct` | %全屬性 | 同時加入 %主屬 + %副屬 |
| `mainStatFlat` | 主屬性+（平） | 加入總平主屬 |
| `subStatFlat` | 副屬性+（平） | 加入總平副屬 |
| `allStatFlat` | 全屬性+（平） | 同時加入平主屬 + 平副屬 |
| `atkFlat` | 物/魔攻+（平） | 加入總 ATK |
| `atkPct` | %物/魔攻 | 加入總 ATK% |
| `critRate` | 爆擊率+ | 加入總爆擊率 |
| `critDmg` | 爆擊傷害+ | 加入最大爆傷（同爆擊計算機邏輯） |
| `bossDmg` | BOSS傷害+ | 加入 bossPct |
| `totalDmg` | 總傷害+ | 加入 totalDmgPct |
| `ignoreDef` | 無視防禦+ | 加入 ignoreDefPct（多個用公式相乘） |
| `hpFlat` | HP+（不計入傷害，僅顯示） | 顯示用 |
| `hpPct` | %HP（不計入傷害，僅顯示） | 顯示用 |
| `none` | （無）| 忽略 |

---

## 六、職業技能與隊伍 BUFF

### 6-1 職業技能（存於 data.json）

每個職業新增 `skills` 陣列，預設值為技能滿點數值（使用者可修改）：

```json
{
  "id": "hero",
  "skills": [
    { "name": "激勵 (Rage)", "type": "atkFlat", "value": 20 },
    { "name": "Combo Attack", "type": "atkPct", "value": 50 }
  ]
}
```

### 6-2 隊伍 BUFF 清單（存於 data.json）

```json
{
  "partyBuffs": [
    { "id": "sharpEyes",     "name": "會心之眼",        "source": "箭神/神射手", "effects": [{ "type": "critRate", "value": 30 }, { "type": "critDmg", "value": 30 }] },
    { "id": "rage",          "name": "激勵 (Rage)",     "source": "英雄",        "effects": [{ "type": "atkFlat", "value": 20 }] },
    { "id": "advBlessing",   "name": "進階祝福",         "source": "主教",        "effects": [{ "type": "atkFlat", "value": 30 }] },
    { "id": "darkAura",      "name": "黑暗光環",         "source": "煉獄巫師",    "effects": [{ "type": "atkPct", "value": 20 }] },
    { "id": "battleMageRope","name": "三繩技能",         "source": "煉獄巫師",    "effects": [{ "type": "atkFlat", "value": 0 }] },
    { "id": "mapleWarrior",  "name": "楓葉戰士",         "source": "多職業4轉",   "effects": [{ "type": "allStatPct", "value": 15 }] },
    { "id": "finalSpeed",    "name": "最終極速",         "source": "待確認",      "effects": [{ "type": "speedBonus", "value": 0 }] },
    { "id": "custom1",       "name": "自訂 BUFF",       "source": "",            "effects": [{ "type": "none", "value": 0 }] }
  ]
}
```

**所有預設數值使用者均可在介面中修改。** 勾選哪些 BUFF 有效、數值多少，會和裝備組合一起存進 localStorage。

---

## 七、屬性合計計算

全身裝備 + 技能 + BUFF 完成後，計算各類屬性的合計：

```
totalFlatMain  = Σ base.mainStat + Σ base.allStat + Σ scroll（mainStat）+ Σ potential(mainStatFlat) + Σ potential(allStatFlat)
totalFlatSub   = Σ base.subStat  + Σ base.allStat + Σ potential(subStatFlat) + Σ potential(allStatFlat)
totalFlatAtk   = Σ base.atk + Σ scroll（atk）+ Σ potential(atkFlat) + Σ skill(atkFlat) + Σ buff(atkFlat)
totalMainPct   = Σ potential(mainStatPct) + Σ potential(allStatPct) + Σ skill(mainStatPct) + Σ buff(allStatPct)
totalSubPct    = Σ potential(subStatPct)  + Σ potential(allStatPct) + Σ buff(allStatPct)
totalAtkPct    = Σ potential(atkPct) + Σ skill(atkPct) + Σ buff(atkPct)
totalCritRate  = Σ potential(critRate) + Σ skill(critRate) + Σ buff(critRate)
totalCritDmg   = Σ potential(critDmg) + Σ buff(critDmg)
totalBossPct   = Σ potential(bossDmg) + Σ skill(bossDmg)
totalTotalDmg  = Σ potential(totalDmg)
totalIgnoreDef = 1 − Π (1 − each ignoreDef/100)   ← 多個無視防禦相乘公式
```

---

## 七-B、裝備模擬器獨立輸入欄位

裝備模擬器**自成一體**，有自己的輸入區，不依賴 Tab 1 的數值：

```
裸裝屬性（不含任何裝備）：
  裸裝主屬性  [____]    ← 純角色等級/職業帶來的主屬性
  裸裝副屬性  [____]
  裸裝攻擊力  [____]    ← 武器本體 ATK 以外的固有攻擊力（通常為 0）

技能設定（同 Tab 1）：
  技能%  [____]   熟練度%  [____]
  爆擊率% [____]  最小爆傷% [____]  最大爆傷% [____]

BOSS 設定（同 Tab 1）：
  BOSS 防禦率%  [____]   怪物防禦率%  [____]   等效無視防禦%  [____]

攻速：每秒打擊數  [____]
```

完成計算後提供「**匯出到攻擊力計算機**」按鈕，將合計數值填入 Tab 1。

---

## 八、傷害與 DPS 計算

**裝備模擬器獨立計算完整傷害：**

```
finalMain = (裸裝主屬性 + totalFlatMain) × (1 + totalMainPct / 100)
finalSub  = (裸裝副屬性 + totalFlatSub)  × (1 + totalSubPct  / 100)
finalAtk  = 裸裝攻擊力  + totalFlatAtk
finalAtkPct = totalAtkPct

step1 = 4 × finalMain + finalSub
step2 = step1 × weaponCoefficient
step3 = finalAtk × (1 + finalAtkPct / 100)
step4 = step2 × step3 × 0.01 × skillPct / 100
step5Boss = 1 + (totalTotalDmg + totalBossPct + enhancePct) / 100
step5Mob  = 1 + (totalTotalDmg + enhancePct) / 100
step6Boss = 1 − bossDefPct / 100 × (1 − totalIgnoreDef)
step6Mob  = 1 − mobDefPct   / 100 × (1 − totalIgnoreDef)

avgCritMult = 1 + critRate/100 × (minCritBonus + totalCritDmg) / 200
avgDmgBoss = (step4 × step5Boss × step6Boss) × (1 + mastery/100) / 2 × avgCritMult
avgDmgMob  = (step4 × step5Mob  × step6Mob)  × (1 + mastery/100) / 2 × avgCritMult
```

**DPS / MDPS：**
```
hitsPerSec ← 使用者輸入（每秒打擊數，例如 3.5）

DPS_boss  = avgDmgBoss × hitsPerSec
DPS_mob   = avgDmgMob  × hitsPerSec
MDPS_boss = DPS_boss × 60
MDPS_mob  = DPS_mob  × 60
```

---

## 九、攻屬比計算

```
1% 主屬性等效 ATK =
  finalAtk × (1 + finalAtkPct/100) × 0.04 × finalMain
  ÷ (4 × finalMain + finalSub)
```

各升級類型效益（每 1 單位的傷害提升百分比）：
- **+1% 主屬**：`0.04 × finalMain / step1`（受現有 step1 影響）
- **+1% ATK**：固定 `1 / (1 + finalAtkPct/100)` 約 1%（不受屬性影響）
- **+1% BOSS 傷**：`1 / (1 + totalBossPct/100)` 的倒數百分比增益
- **+1% 總傷**：`1 / (1 + totalTotalDmg/100)`

---

## 十、UI 佈局

```
┌─────────────────────────────────────────────────────────────────┐
│  ⚔️ 楓星攻擊力計算機          [⚔️ 攻擊力計算機] [🎒 裝備模擬器]  │
├──────────────────┬──────────────────────────────────────────────┤
│ 左欄：裝備槽清單  │ 右上：選中裝備的詳細輸入                      │
│                  │                                              │
│ ▼ 武器類         │  [本體屬性]  [衝捲]  [潛能3行]               │
│   ⚔️ 武器 ←選中  │                                              │
│   🛡️ 副武器      ├──────────────────────────────────────────────┤
│ ▼ 防具類         │ 右下三格：                                    │
│   🪖 頭盔        │  [📊 全裝備合計]  [⚡技能&BUFF]  [📈攻屬比]   │
│   👕 上衣        │                                              │
│   ...            │  合計欄：主屬+%、副屬+%、ATK+、ATK%          │
│ ▼ 飾品類         │  爆擊率、爆傷、BOSS%、總傷%、無視%            │
│   ...            │                                              │
│ ▼ 特殊類         │  BUFF欄：職業技能清單＋隊伍BUFF勾選            │
│   ...            │                                              │
│ ──────────────   │  攻屬比：1%主屬 = X ATK                      │
│ 攻速：[X]下/秒   │  各類型效益排名                               │
│ ──────────────   ├──────────────────────────────────────────────┤
│ 存檔名稱 [    ]  │  DPS（打王）= XXXX  │  DPS（小怪）= XXXX    │
│ [儲存][我的組合▼]│  MDPS（打王）= XXXX │  MDPS（小怪）= XXXX  │
└──────────────────┴──────────────────────────────────────────────┘
```

---

## 十一、localStorage 存檔格式

```json
{
  "equipSets": [
    {
      "name": "我的黑騎士配置",
      "jobId": "darkKnight",
      "hitsPerSec": 3.5,
      "slots": { "weapon": { ... }, "hat": { ... }, ... },
      "skills": [{ "name": "激勵", "type": "atkFlat", "value": 20, "enabled": true }],
      "buffs": [
        { "id": "sharpEyes", "enabled": true, "effects": [{ "type": "critRate", "value": 30 }, { "type": "critDmg", "value": 30 }] }
      ]
    }
  ]
}
```

localStorage key：`maple_calc_equipment`，最多 20 組。

---

## 十二、data.json 新增欄位

### 各職業技能預設值（加入每個 job 物件）

| 職業 | 技能 | 類型 | 預設值 |
|------|------|------|-------|
| 英雄 | 激勵 Rage | atkFlat | 20 |
| 聖騎士 | 激勵 Rage | atkFlat | 20 |
| 黑騎士 | 守護者 Beholder | atkFlat | 15 |
| 箭神 | 會心之眼 | critRate+critDmg | 30+30 |
| 神射手 | 會心之眼 | critRate+critDmg | 30+30 |
| 煉獄巫師 | 黑暗光環 | atkPct | 20 |
| 幻影 | 會心之眼（複製） | critRate+critDmg | 30+30 |
| 各4轉 | 楓葉戰士 | allStatPct | 15 |

（其他職業技能視 data.json 補充，預設值均為滿點數值，使用者可修改）

---

## 十三、錯誤處理

| 狀況 | 處理 |
|------|------|
| 未選職業 | 顯示「請先在攻擊力計算機選擇職業」提示 |
| 欄位為空/非數字 | 當作 0，不顯示錯誤（裝備可以空著） |
| localStorage 超過 20 組 | 提示刪除舊組合 |
| 無視防禦多個值 | 自動套用多重公式：1 - Π(1 - each/100) |
