const data = window.DASHBOARD_DATA;
const DEFAULT_CAPITAL = 1000000;
const CAPITAL_KEY = "monthlyRotationCapital";
let capital = Number(localStorage.getItem(CAPITAL_KEY)) || DEFAULT_CAPITAL;

const money = new Intl.NumberFormat("zh-TW", { style: "currency", currency: "TWD", maximumFractionDigits: 0 });
const number = new Intl.NumberFormat("zh-TW", { maximumFractionDigits: 0 });
const fmtPct = (value) => `${Number(value ?? 0) >= 0 ? "+" : ""}${Number(value ?? 0).toFixed(2)}%`;
const cls = (value) => Number(value) >= 0 ? "pos" : "neg";
const escapeHtml = (value) => String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));

function primaryTheme(tags = []) {
  const joined = tags.join(" ");
  const rules = [
    ["軍工航太", /軍工|航太|無人機|國防/],
    ["功率半導體", /功率|SiC|GaN|第三代半導體/],
    ["被動元件", /MLCC|被動元件|電感|保護元件/],
    ["先進封裝", /CoWoS|先進封裝|封裝測試/],
    ["矽晶圓", /矽晶圓/],
    ["半導體設備", /晶圓製程設備|檢測設備/],
    ["AI 伺服器", /AI伺服器|伺服器|散熱/],
    ["工具機自動化", /工具機|自動化/],
    ["電子零組件", /電子零組件/],
  ];
  return rules.find(([, pattern]) => pattern.test(joined))?.[0] || tags[0] || "其他題材";
}

function latestCompletedHoldings() {
  const months = [...new Set(data.historicalTrades.map((row) => row.month))].sort();
  const latest = months.at(-1);
  return data.historicalTrades.filter((row) => row.month === latest);
}

function renderStatus() {
  const status = data.dataStatus || {};
  document.getElementById("dataStatus").innerHTML = `
    <strong>${escapeHtml(status.rebalanceNotice || "資料已更新")}</strong>
    <span class="status-meta">交易資料 ${escapeHtml(status.latestTradeDate || "-")} · 法人 ${escapeHtml(status.latestChipDate || "-")} · 營收 ${escapeHtml(status.latestRevenueMonth || "-")}</span>`;
  document.getElementById("generatedAt").textContent = `更新：${String(data.generatedAt).replace("T", " ")}`;
}

function renderActions() {
  const positions = data.current.positions;
  const currentIds = new Set(positions.map((row) => String(row.stockId)));
  const old = latestCompletedHoldings();
  const sells = old.filter((row) => !currentIds.has(String(row.stockId)));
  const buyDate = data.current.summary.buyDate || positions[0]?.buyDate || "下一交易日";
  document.getElementById("actionTitle").textContent = `${buyDate} 執行換股`;
  document.getElementById("actionSummary").textContent = "先完成舊持股賣出，再將可用資金平均配置到本月五檔。";
  const sellText = sells.length ? `賣出 ${sells.map((row) => `${row.stockId} ${row.name}`).join("、")}` : "本期無需賣出";
  document.getElementById("tradeActions").innerHTML = `
    <span class="trade-pill sell">${escapeHtml(sellText)}</span>
    <span class="trade-pill">買進 ${positions.map((row) => `${row.stockId} ${row.name}`).join("、")}</span>`;
}

function renderCapital() {
  const perStock = capital / Math.max(data.current.positions.length, 1);
  document.getElementById("capitalValue").textContent = money.format(capital);
  document.getElementById("allocationHint").textContent = `每檔約 ${money.format(perStock)}（20%）`;
  document.getElementById("capitalInput").value = capital;
}

function shareEstimate(price, budget) {
  const totalShares = Math.floor(budget / price);
  const lots = Math.floor(totalShares / 1000);
  const oddShares = totalShares % 1000;
  return { totalShares, lots, oddShares, estimatedCost: totalShares * price };
}

function renderPicks() {
  const perStock = capital / Math.max(data.current.positions.length, 1);
  document.getElementById("pickCards").innerHTML = data.current.positions.map((row) => {
    const estimate = shareEstimate(Number(row.latestClose), perStock);
    const shareText = estimate.lots > 0 ? `${estimate.lots} 張 + ${number.format(estimate.oddShares)} 股` : `${number.format(estimate.oddShares)} 股`;
    const tags = (row.conceptTags || []).filter((tag, index, list) => tag && list.indexOf(tag) === index).slice(0, 6);
    return `<article class="pick-card">
      <div class="pick-top">
        <span class="rank">#${row.rank}</span>
        <span class="stock-code">${escapeHtml(row.stockId)}</span>
        <h3 class="stock-name">${escapeHtml(row.name)}</h3>
        <span class="primary-theme">${escapeHtml(primaryTheme(tags))}</span>
      </div>
      <div class="pick-numbers">
        <div class="number-cell"><span>參考收盤</span><strong>${money.format(row.latestClose)}</strong></div>
        <div class="number-cell"><span>配置預算</span><strong>${money.format(perStock)}</strong></div>
        <div class="number-cell"><span>資料日期</span><strong>${escapeHtml(row.latestDate)}</strong></div>
        <div class="number-cell"><span>模型排名</span><strong>${Number(row.score).toFixed(3)}</strong></div>
      </div>
      <div class="share-plan"><strong>估計買進 ${shareText}</strong><span>預估使用 ${money.format(estimate.estimatedCost)}，實際以成交價為準</span></div>
      <div class="theme-list">${tags.map((tag) => `<span class="theme-tag" title="${escapeHtml(tag)}">${escapeHtml(tag)}</span>`).join("")}</div>
    </article>`;
  }).join("");
  const current = data.current.summary;
  document.getElementById("currentSummary").textContent = current.pendingEntry
    ? `${current.buyDate} 待買進 · 參考價日期 ${current.latestDate}`
    : `${current.latestDate} · 平均 ${fmtPct(current.avgReturnPct)} · 勝率 ${Number(current.winRatePct).toFixed(2)}%`;
}

function renderKpis() {
  const items = [
    ["今年累積報酬", fmtPct(data.summary.ytdMarkedReturnPct), data.summary.ytdMarkedReturnPct],
    ["已完成月份報酬", fmtPct(data.summary.completedReturnPct), data.summary.completedReturnPct],
    ["目前持股報酬", fmtPct(data.summary.currentMonthReturnPct), data.summary.currentMonthReturnPct],
    ["月勝率", `${Number(data.summary.monthlyWinRatePct).toFixed(2)}%`, data.summary.monthlyWinRatePct],
    ["個股勝率", `${Number(data.summary.stockWinRatePct).toFixed(2)}%`, data.summary.stockWinRatePct],
  ];
  document.getElementById("kpis").innerHTML = items.map(([label, value, raw]) => `<div class="kpi"><div class="label">${label}</div><div class="value ${cls(raw)}">${value}</div></div>`).join("");
}

function renderHistory() {
  document.getElementById("monthRows").innerHTML = [...data.monthlyHistory].reverse().map((row) => `<tr><td>${row.month}</td><td class="${cls(row.returnPct)}">${fmtPct(row.returnPct)}</td><td>${Number(row.winRatePct).toFixed(2)}%</td><td>${row.winner20Count}/${row.holdingCount}</td></tr>`).join("");
  document.getElementById("tradeRows").innerHTML = [...data.historicalTrades].reverse().map((row) => `<tr><td>${row.month}</td><td>${row.stockId}</td><td>${escapeHtml(row.name)}</td><td class="${cls(row.returnPct)}">${fmtPct(row.returnPct)}</td><td>${row.hit20 ? "是" : "否"}</td></tr>`).join("");
}

function drawEquityChart() {
  const canvas = document.getElementById("equityChart");
  const rect = canvas.getBoundingClientRect();
  if (!rect.width) return;
  const scale = window.devicePixelRatio || 1;
  canvas.width = Math.floor(rect.width * scale);
  canvas.height = Math.floor(rect.height * scale);
  const ctx = canvas.getContext("2d");
  ctx.scale(scale, scale);
  const w = rect.width, h = rect.height;
  const pad = { left: 55, right: 22, top: 18, bottom: 40 };
  const points = data.equityCurve;
  const values = points.map((point) => Number(point.equity));
  const min = Math.min(...values, 1) * .96, max = Math.max(...values, 1) * 1.04;
  const plotW = w - pad.left - pad.right, plotH = h - pad.top - pad.bottom;
  const x = (i) => pad.left + (i / Math.max(points.length - 1, 1)) * plotW;
  const y = (value) => pad.top + (1 - (value - min) / Math.max(max - min, .001)) * plotH;
  ctx.clearRect(0, 0, w, h);
  ctx.font = "12px Segoe UI, Microsoft JhengHei";
  for (let i = 0; i <= 4; i += 1) {
    const yy = pad.top + i / 4 * plotH;
    ctx.strokeStyle = "#dfe4e1"; ctx.beginPath(); ctx.moveTo(pad.left, yy); ctx.lineTo(w - pad.right, yy); ctx.stroke();
    ctx.fillStyle = "#67716c"; ctx.textAlign = "right"; ctx.fillText(`${((max - i / 4 * (max - min) - 1) * 100).toFixed(0)}%`, pad.left - 8, yy + 4);
  }
  ctx.strokeStyle = "#126b4f"; ctx.lineWidth = 3; ctx.beginPath();
  points.forEach((point, i) => i ? ctx.lineTo(x(i), y(point.equity)) : ctx.moveTo(x(i), y(point.equity))); ctx.stroke();
  points.forEach((point, i) => { ctx.fillStyle = point.kind === "current" ? "#d28b13" : "#126b4f"; ctx.beginPath(); ctx.arc(x(i), y(point.equity), 4, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#67716c"; ctx.textAlign = "center"; ctx.fillText(point.label.replace("2026-", ""), x(i), h - 14); });
}

const dialog = document.getElementById("capitalDialog");
document.getElementById("editCapital").addEventListener("click", () => { renderCapital(); dialog.showModal(); });
document.querySelectorAll("[data-capital]").forEach((button) => button.addEventListener("click", () => { document.getElementById("capitalInput").value = button.dataset.capital; }));
document.getElementById("capitalForm").addEventListener("submit", (event) => {
  if (event.submitter?.value !== "save") return;
  event.preventDefault();
  const value = Number(document.getElementById("capitalInput").value);
  if (!Number.isFinite(value) || value < 10000) return;
  capital = value;
  localStorage.setItem(CAPITAL_KEY, String(capital));
  renderCapital(); renderPicks(); dialog.close();
});

renderStatus(); renderActions(); renderCapital(); renderPicks(); renderKpis(); renderHistory(); drawEquityChart();
window.addEventListener("resize", drawEquityChart);
