const data = window.DASHBOARD_DATA;

const fmtPct = (value) => `${Number(value ?? 0).toFixed(2)}%`;
const cls = (value) => Number(value) >= 0 ? "pos" : "neg";

document.getElementById("subtitle").textContent = data.dashboardName || "月換股操作追蹤";
document.getElementById("generatedAt").textContent = `更新：${data.generatedAt}`;

const kpis = [
  ["YTD含進行式", fmtPct(data.summary.ytdMarkedReturnPct)],
  ["已完成報酬", fmtPct(data.summary.completedReturnPct)],
  ["進行式均報酬", fmtPct(data.summary.currentMonthReturnPct)],
  ["月勝率", fmtPct(data.summary.monthlyWinRatePct)],
  ["個股勝率", fmtPct(data.summary.stockWinRatePct)],
  ["進行式檔數", data.summary.currentPositions],
];

document.getElementById("kpis").innerHTML = kpis
  .map(([label, value]) => `<div class="kpi"><div class="label">${label}</div><div class="value">${value}</div></div>`)
  .join("");

const current = data.current.summary;
document.getElementById("currentSummary").textContent =
  `${current.latestDate || ""}，平均 ${fmtPct(current.avgReturnPct)}，勝率 ${fmtPct(current.winRatePct)}`;

document.getElementById("currentRows").innerHTML = data.current.positions
  .map((row) => `
    <tr>
      <td>${row.rank}</td>
      <td>${row.stockId}</td>
      <td>${row.name}</td>
      <td>${row.buyDate}</td>
      <td>${row.buyPrice.toFixed(2)}</td>
      <td>${row.latestDate}</td>
      <td>${row.latestClose.toFixed(2)}</td>
      <td class="${cls(row.returnPct)}">${fmtPct(row.returnPct)}</td>
    </tr>`)
  .join("");

document.getElementById("monthRows").innerHTML = data.monthlyHistory
  .map((row) => `
    <tr>
      <td>${row.month}</td>
      <td class="${cls(row.returnPct)}">${fmtPct(row.returnPct)}</td>
      <td>${fmtPct(row.winRatePct)}</td>
      <td><span class="tag">${row.winner20Count}/${row.holdingCount}</span></td>
    </tr>`)
  .join("");

document.getElementById("tradeRows").innerHTML = data.historicalTrades
  .map((row) => `
    <tr>
      <td>${row.month}</td>
      <td>${row.stockId}</td>
      <td>${row.name}</td>
      <td class="${cls(row.returnPct)}">${fmtPct(row.returnPct)}</td>
      <td>${row.hit20 ? "是" : "否"}</td>
    </tr>`)
  .join("");

function drawEquityChart() {
  const canvas = document.getElementById("equityChart");
  const rect = canvas.getBoundingClientRect();
  const scale = window.devicePixelRatio || 1;
  canvas.width = Math.floor(rect.width * scale);
  canvas.height = Math.floor(rect.height * scale);
  const ctx = canvas.getContext("2d");
  ctx.scale(scale, scale);

  const w = rect.width;
  const h = rect.height;
  const pad = { left: 54, right: 22, top: 18, bottom: 42 };
  const points = data.equityCurve;
  const values = points.map((p) => p.equity);
  const min = Math.min(...values, 1) * 0.96;
  const max = Math.max(...values, 1) * 1.04;
  const plotW = w - pad.left - pad.right;
  const plotH = h - pad.top - pad.bottom;
  const x = (i) => pad.left + (points.length === 1 ? 0 : (i / (points.length - 1)) * plotW);
  const y = (v) => pad.top + (1 - (v - min) / (max - min || 1)) * plotH;

  ctx.clearRect(0, 0, w, h);
  ctx.strokeStyle = "#d9dee7";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i <= 4; i++) {
    const yy = pad.top + (i / 4) * plotH;
    ctx.moveTo(pad.left, yy);
    ctx.lineTo(w - pad.right, yy);
  }
  ctx.stroke();

  ctx.fillStyle = "#667085";
  ctx.font = "12px Segoe UI";
  ctx.textAlign = "right";
  for (let i = 0; i <= 4; i++) {
    const value = max - (i / 4) * (max - min);
    ctx.fillText(`${((value - 1) * 100).toFixed(0)}%`, pad.left - 8, pad.top + (i / 4) * plotH + 4);
  }

  ctx.strokeStyle = "#2563eb";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  points.forEach((p, i) => {
    const xx = x(i);
    const yy = y(p.equity);
    if (i === 0) ctx.moveTo(xx, yy);
    else ctx.lineTo(xx, yy);
  });
  ctx.stroke();

  points.forEach((p, i) => {
    const xx = x(i);
    const yy = y(p.equity);
    ctx.fillStyle = p.kind === "current" ? "#f59e0b" : "#2563eb";
    ctx.beginPath();
    ctx.arc(xx, yy, 4, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.fillStyle = "#667085";
  ctx.textAlign = "center";
  points.forEach((p, i) => {
    if (i === 0 || i === points.length - 1 || i % 2 === 1) {
      ctx.fillText(p.label.replace("2026-", ""), x(i), h - 16);
    }
  });
}

drawEquityChart();
window.addEventListener("resize", drawEquityChart);
