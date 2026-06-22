# 額外剪刀補償機制設計

**日期：** 2026-06-22
**功能：** 分錢系統 — 額外剪刀支出追蹤與全隊均攤補償

---

## 背景與問題

王裝每人一次只能撿一件。當目標成員身上已有同裝備時無法自行撿取，需由其他成員代撿後用剪刀轉移，目標成員再用剪刀拍賣。這個「中繼轉移」步驟產生了原本不必要的剪刀費用，應由全隊均攤補償給付出者。

現有系統：
- `soldItems.scissorType`：追蹤賣出物品的剪刀，已納入 `netRevenue` 均攤
- `memberItems.scissorMileage`：追蹤成員間物品轉移的剪刀，但為動態換算（匯率浮動）

新需求：追蹤「中繼轉移剪刀」，匯率在輸入當下鎖定，費用全隊均攤。

---

## 資料結構

Session 新增欄位：

```js
extraScissors: [
  {
    id: Number,
    memberName: String,   // 付剪刀的人
    scissorType: Number,  // 3900 或 7100（里程）
    rateSnapshot: Number, // 加入當下的 mileageRate（鎖定，不隨設定變動）
    note: String,         // 備註（可空）
  }
]
```

折算金額（唯讀，由 `scissorType / rateSnapshot * 1000` 計算）在加入當下決定，之後修改 `mileageRate` 不影響已存紀錄。

---

## 結算邏輯（loot.js）

在 `computeSettlementForSession` 中：

### 1. 計算總額並納入 netRevenue

```js
const totalExtraScissorCost = (session.extraScissors || []).reduce((sum, e) =>
  sum + e.scissorType / e.rateSnapshot * 1000, 0)

const netRevenue = totalRevenue - totalScissorCost - totalSnowflakeCost - totalExtraScissorCost
```

效果：所有人的應得份額（`due`）都按比例縮小，等同全隊共同分攤。

### 2. 付剪刀的人增加個人 scissorPaid

```js
for (const e of (session.extraScissors || [])) {
  const mm = memberMap[e.memberName]
  if (mm) mm.scissorPaid += e.scissorType / e.rateSnapshot * 1000
}
```

效果：付剪刀者 `earned` 降低 → `diff` 更負 → 結算時收到補償。

### 3. 數學驗證

sum(diff) = sum(earned) - sum(due)

- sum(due) = netRevenue（sum(pct)=1）
- sum(earned) = sum(grossEarned) - sum(scissorPaid) - sum(snowflakeShare)
  = (totalCashRevenue + totalSelfuseValue) - (totalScissorCost + totalExtraScissorCost) - totalSnowflakeCost
- sum(due) = totalCashRevenue + totalSelfuseValue - totalScissorCost - totalSnowflakeCost - totalExtraScissorCost

→ sum(diff) = 0 ✓ 帳目平衡。

**舉例：** 2 人均分，總收入 1000 萬，B 多花 100 萬剪刀：
- netRevenue = 900，A/B 各 due = 450
- B: earned = -100，diff = -550（被欠 550）
- A: earned = 1000，diff = +550（欠 550）
- A 付 B 550，B 淨收 450，A 淨留 450 → 均分 ✓

---

## UI（index.html）

### 輸入區塊

在「成員自取物品」下方新增「額外剪刀支出」區塊：

```
[ 付剪刀的人 ▼ ] [ 3900 / 7100 ▼ ] [ XX.X 萬（唯讀） ] [ 備註 ] [ 刪除 ]
[ ＋ 新增 ]
```

- 下拉選成員（currentSession.members）
- 剪刀類型選 3900 或 7100
- 折算欄自動計算並唯讀顯示（依 rateSnapshot）
- 按「新增」時快照當下 `mileageRate`

### 結算摘要

在「剪刀成本」那行後新增：

```
額外剪刀成本     -XX.X 萬
```

---

## 修改範圍

| 檔案 | 變更內容 |
|------|---------|
| `loot.js` | `normalizeSession` 加 `extraScissors`；新增 `addExtraScissor`、`removeExtraScissor`、`extraScissorCash` 函式；`computeSettlementForSession` 加入 `totalExtraScissorCost` 計算與 `scissorPaid` 累加 |
| `index.html` | 新增「額外剪刀支出」輸入區塊；結算摘要新增一行 |

---

## 不在範圍內

- 修改現有 `memberItems.scissorMileage` 的匯率鎖定（另一個問題）
- 支援自訂里程數（方案 C，未選）
