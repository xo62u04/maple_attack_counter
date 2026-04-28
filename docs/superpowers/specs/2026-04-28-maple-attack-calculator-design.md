# 楓星攻擊力計算機 — 設計文件

**日期：** 2026-04-28  
**版本：** 1.0  
**目標：** 建立一個靜態網頁計算機，供楓星玩家計算各職業最終傷害，部署於 GitHub Pages。

---

## 一、專案概覽

### 目標
- 支援物攻與魔攻兩種攻擊類型
- 涵蓋楓星所有可用職業（24 個四轉職業）
- 即時顯示公式拆解，讓使用者理解每個數值的貢獻
- 個人角色資料存於 localStorage，支援 URL 分享
- 職業與武器係數資料從 GitHub repo 動態抓取（data.json）

### 部署
- GitHub Pages，repo：`https://github.com/xo62u04/maple_attack_counter`
- 所有資源靜態，無後端

---

## 二、技術選型

| 項目 | 選擇 | 原因 |
|------|------|------|
| 框架 | Vue 3（CDN） | 響應式綁定適合大量表單欄位即時計算，無需 build pipeline |
| 樣式 | 原生 CSS（CSS Variables） | 無額外依賴 |
| 資料 | data.json（GitHub raw） | 共用職業/武器係數，可由 repo 維護者更新 |
| 存檔 | localStorage | 個人角色資料，最多 20 筆 |
| 分享 | URL query string | 無後端即可跨裝置分享 |

---

## 三、檔案結構

```
maple_attack_counter/
├── index.html          # 主頁面（Vue 3 CDN 掛載點）
├── app.js              # Vue 應用邏輯（計算、存檔、分享）
├── style.css           # 全域樣式
├── data.json           # 職業、武器、係數共用資料
└── docs/
    └── superpowers/
        └── specs/
            └── 2026-04-28-maple-attack-calculator-design.md
```

---

## 四、data.json 結構

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
    }
  ]
}
```

**subStat 可能值：**
- `"DEX"` — 單一副屬性
- `"STR"` — 單一副屬性
- `"LUK"` — 單一副屬性
- `"DEX+STR"` — 雙副屬性（暗影神偷、影武者）

**attackType 可能值：**
- `"physical"` — 物攻（使用物理攻擊力欄位）
- `"magical"` — 魔攻（使用魔法攻擊力欄位）

---

## 五、完整職業與武器係數

| 職業 | 職業群 | 武器 | 係數 | 主屬 | 副屬 | 攻擊類型 |
|------|--------|------|------|------|------|----------|
| 英雄 | 冒險家 - 劍士系 | 單手劍、單手斧 | 1.20 | STR | DEX | 物攻 |
| 英雄 | 冒險家 - 劍士系 | 雙手劍、雙手斧 | 1.34 | STR | DEX | 物攻 |
| 聖騎士 | 冒險家 - 劍士系 | 單手劍、單手斧、單手棍 | 1.20 | STR | DEX | 物攻 |
| 聖騎士 | 冒險家 - 劍士系 | 雙手劍、雙手斧、雙手棍 | 1.34 | STR | DEX | 物攻 |
| 黑騎士 | 冒險家 - 劍士系 | 長槍、矛 | 1.49 | STR | DEX | 物攻 |
| 火毒大魔導士 | 冒險家 - 魔法使系 | 長杖、短杖 | 1.20 | INT | LUK | 魔攻 |
| 冰雷大魔導士 | 冒險家 - 魔法使系 | 長杖、短杖 | 1.20 | INT | LUK | 魔攻 |
| 主教 | 冒險家 - 魔法使系 | 長杖、短杖 | 1.20 | INT | LUK | 魔攻 |
| 箭神 | 冒險家 - 弓箭手系 | 弓 | 1.30 | DEX | STR | 物攻 |
| 神射手 | 冒險家 - 弓箭手系 | 弩 | 1.35 | DEX | STR | 物攻 |
| 夜使者 | 冒險家 - 盜賊系 | 拳套（爪型） | 1.75 | LUK | DEX | 物攻 |
| 暗影神偷 | 冒險家 - 盜賊系 | 短劍 | 1.30 | LUK | DEX+STR | 物攻 |
| 影武者 | 冒險家 - 盜賊系 | 雙刀 | 1.30 | LUK | DEX+STR | 物攻 |
| 拳霸 | 冒險家 - 海賊系 | 拳套 | 1.70 | STR | DEX | 物攻 |
| 槍神 | 冒險家 - 海賊系 | 手槍 | 1.50 | DEX | STR | 物攻 |
| 重砲指揮官 | 冒險家 - 海賊系 | 大砲 | 1.50 | STR | DEX | 物攻 |
| 狂狼勇士 | 英雄傳說 | 矛 | 1.49 | STR | DEX | 物攻 |
| 龍魔導士 | 英雄傳說 | 長杖、短杖 | 1.20 | INT | LUK | 魔攻 |
| 煉獄巫師 | 末日反抗軍 | 長杖 | 1.20 | INT | LUK | 魔攻 |
| 狂豹獵人 | 末日反抗軍 | 弩 | 1.35 | DEX | STR | 物攻 |
| 機甲戰神 | 末日反抗軍 | 火槍 | 1.50 | DEX | STR | 物攻 |
| 惡魔殺手 | 惡魔 | 單手棍 | 1.20 | STR | DEX | 物攻 |
| 精靈遊俠 | 精靈 | 雙弩 | 1.30 | DEX | STR | 物攻 |
| 幻影 | 幻影 | 手杖 | 1.30 | LUK | DEX | 物攻 |
| 劍豪 | 劍豪 | 武士刀 | 1.25 | STR | DEX | 物攻 |
| 陰陽師 | 陰陽師 | 扇子 | 1.35 | INT | LUK | 魔攻 |

**資料來源：**
- [楓之谷全職業武器係數總表 — 巴哈姆特](https://home.gamer.com.tw/creationDetail.php?sn=1965148)
- [武器係數、表攻公式和單/雙手武器一覽表 — 巴哈姆特](https://home.gamer.com.tw/artwork.php?sn=1700424)

---

## 六、傷害公式

```
最終傷害 =
  (4 × mainStat + subStat)
  × weaponCoefficient
  × (ATK × (1 + ATK% / 100))
  × 0.01
  × skill% / 100
  × (1 + (totalDmg% + boss% + enhance%) / 100)
  × (1 - bossDefense% / 100 × (1 - ignoreDefense% / 100))
```

**副屬性計算規則：**
- `subStat = "DEX"` → 直接取 DEX 值
- `subStat = "STR"` → 直接取 STR 值
- `subStat = "DEX+STR"` → DEX + STR 合計
- `subStat = "LUK"` → 直接取 LUK 值

---

## 七、UI 設計（雙欄版）

### 整體佈局

```
┌─────────────────────────────────────────────────────────┐
│  ⚔️ 楓星攻擊力計算機                        [存檔] [分享] │
├──────────────────────┬──────────────────────────────────┤
│  左欄：輸入           │  右欄：計算拆解（即時更新）        │
│                      │                                  │
│  職業群 ▼            │  Step 1：主副屬加成               │
│  職業   ▼            │  (4 × STR + DEX)                 │
│  武器   ▼            │  = (4 × 4,000 + 500) = 16,500   │
│  係數 [可編輯]        │                                  │
│                      │  Step 2：× 武器係數 1.49          │
│  STR    [    ]       │  = 24,585                        │
│  DEX    [    ]       │                                  │
│  INT    [    ]       │  Step 3：× 攻擊力效果             │
│  LUK    [    ]       │  ATK × (1 + ATK%) = 5,000        │
│  攻擊力  [    ]       │                                  │
│  攻擊力% [    ]%      │  Step 4：× 0.01 × 技能% 500%    │
│  技能%   [    ]%      │  = 30,731,250                    │
│  總傷害% [    ]%      │                                  │
│  BOSS%   [    ]%      │  Step 5：× 傷害倍率              │
│  強化傷害%[    ]%     │  (1 + 總傷害% + BOSS% + 強化%)  │
│  BOSS防禦%[    ]%     │  = ×3.50                         │
│  等效無視%[    ]%     │                                  │
│                      │  Step 6：× BOSS 防禦折減          │
│  ────────────────    │  (1 - 防禦% × (1 - 無視%))       │
│  存檔名稱 [      ]    │                                  │
│  [儲存]  [我的角色 ▼] │  ══════════════════════          │
│                      │  最終傷害（單擊）                  │
│                      │  1,234,567,890                   │
└──────────────────────┴──────────────────────────────────┘
```

### UI 行為細節

1. **職業群下拉** → 更新職業下拉清單（只顯示該群職業）
2. **職業選擇** → 自動帶入對應武器下拉、主副屬標籤、鎖定係數預設值
3. **武器選擇** → 自動填入係數，但欄位可手動覆蓋
4. **所有數值欄位** → 即時觸發右欄計算更新（Vue computed）
5. **主副屬標籤** → 根據職業動態顯示（如「STR（主）」「LUK（副）」）
6. **僅顯示有值的屬性** → 如魔法使系不顯示 STR/DEX 輸入欄（或灰底 disabled）

---

## 八、存檔與分享機制

### localStorage 存檔

- 存檔結構：
  ```json
  {
    "characters": [
      {
        "name": "我的黑騎士",
        "jobId": "darkKnight",
        "weaponName": "矛",
        "coefficient": 1.49,
        "stats": {
          "STR": 4000, "DEX": 500, "INT": 0, "LUK": 0,
          "atk": 2000, "atkPct": 150,
          "skillPct": 500, "totalDmgPct": 100,
          "bossPct": 250, "enhancePct": 0,
          "bossDefPct": 50, "ignoreDefPct": 70
        }
      }
    ]
  }
  ```
- 最多 20 筆存檔
- 左下角下拉選單切換已存角色，載入後自動填入所有欄位

### URL 分享

- 按「分享」按鈕 → 將所有數值編碼為 query string
- 格式範例：
  ```
  ?job=darkKnight&weapon=矛&coeff=1.49&str=4000&dex=500&atk=2000&atkp=150&skill=500&total=100&boss=250&enhance=0&bdef=50&idef=70
  ```
- 頁面載入時檢查 URL query string，若存在則自動填入數值

---

## 九、data.json 動態抓取

- 網頁啟動時 `fetch('data.json')`（相對路徑，同 repo）
- GitHub Pages 部署後 URL 為：
  `https://xo62u04.github.io/maple_attack_counter/data.json`
- 載入中顯示 loading 狀態，載入失敗顯示錯誤訊息
- 職業資料更新只需修改 `data.json` 並推送，無需改動 JS

---

## 十、錯誤處理

| 狀況 | 處理方式 |
|------|---------|
| data.json 載入失敗 | 顯示「資料載入失敗，請重新整理」 |
| 輸入非數字 | 欄位標紅，計算結果顯示 `-` |
| URL 參數職業 ID 不存在 | 忽略 URL 參數，使用預設空白狀態 |
| localStorage 超過 20 筆 | 提示使用者刪除舊存檔 |

---

## 十一、GitHub Pages 部署

1. repo 設定 → Pages → branch: `main`，folder: `/ (root)`
2. 推送後自動部署，網址：`https://xo62u04.github.io/maple_attack_counter/`
3. `.gitignore` 加入 `.superpowers/`

---

## 十二、不在本版本範圍內

- 使用者帳號系統
- 多語言支援
- 傷害歷史紀錄
- DPS 計算（每秒傷害）
