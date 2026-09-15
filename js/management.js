import { db } from "./firebase-config.js";
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { watchAuth, renderSidebar, requireRoles } from "./auth.js";
import { dailyTargetForItem } from "./calc.js";

requireRoles(["management"]);
watchAuth((state) => renderSidebar("management.html", state));

const REASON_LABELS = { maintenance: "صيانة", material: "نقص خامة", labor: "نقص عمالة", other: "أخرى" };
const REASON_COLORS = { maintenance: "#e8a33d", material: "#d1574b", labor: "#4f8fae", other: "#94a1ad" };

function pad(n) { return String(n).padStart(2, "0"); }
function toDateStr(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function addDays(d, n) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }

function barChartSVG(labels, values, color = "#4f8fae") {
  const w = 700, h = 220, pad2 = 36;
  const max = Math.max(1, ...values);
  const gap = (w - pad2 * 2) / values.length;
  const barW = gap * 0.5;
  let bars = "";
  values.forEach((v, i) => {
    const barH = (v / max) * (h - pad2 * 2);
    const x = pad2 + i * gap + (gap - barW) / 2;
    const y = h - pad2 - barH;
    bars += `<rect x="${x}" y="${y}" width="${barW}" height="${barH}" fill="${color}" rx="3"></rect>`;
    bars += `<text x="${x + barW / 2}" y="${h - pad2 + 16}" fill="#94a1ad" font-size="10" text-anchor="middle">${labels[i]}</text>`;
    bars += `<text x="${x + barW / 2}" y="${y - 6}" fill="#e7ebee" font-size="11" text-anchor="middle">${v.toLocaleString("ar-EG")}</text>`;
  });
  return `<svg viewBox="0 0 ${w} ${h}" style="width:100%; height:auto; font-family:inherit;">
    <line x1="${pad2}" y1="${h - pad2}" x2="${w - pad2}" y2="${h - pad2}" stroke="#313a44"></line>
    ${bars}
  </svg>`;
}

function dualBarChartSVG(labels, seriesA, seriesB, colorA = "#4f8fae", colorB = "#94a1ad", labelA = "فعلي", labelB = "مخطط") {
  const w = 700, h = 240, pad2 = 40;
  const max = Math.max(1, ...seriesA, ...seriesB);
  const gap = (w - pad2 * 2) / labels.length;
  const barW = gap * 0.32;
  let bars = "";
  labels.forEach((label, i) => {
    const xCenter = pad2 + i * gap + gap / 2;
    const barHA = (seriesA[i] / max) * (h - pad2 * 2);
    const barHB = (seriesB[i] / max) * (h - pad2 * 2);
    const xA = xCenter - barW - 3, xB = xCenter + 3;
    bars += `<rect x="${xA}" y="${h - pad2 - barHA}" width="${barW}" height="${barHA}" fill="${colorA}" rx="2"></rect>`;
    bars += `<rect x="${xB}" y="${h - pad2 - barHB}" width="${barW}" height="${barHB}" fill="${colorB}" rx="2"></rect>`;
    bars += `<text x="${xCenter}" y="${h - pad2 + 16}" fill="#94a1ad" font-size="10" text-anchor="middle">${label}</text>`;
    bars += `<text x="${xA + barW/2}" y="${h - pad2 - barHA - 6}" fill="${colorA}" font-size="10" text-anchor="middle">${seriesA[i]}</text>`;
    bars += `<text x="${xB + barW/2}" y="${h - pad2 - barHB - 6}" fill="${colorB}" font-size="10" text-anchor="middle">${seriesB[i]}</text>`;
  });
  return `<svg viewBox="0 0 ${w} ${h}" style="width:100%; height:auto; font-family:inherit;">
    <line x1="${pad2}" y1="${h - pad2}" x2="${w - pad2}" y2="${h - pad2}" stroke="#313a44"></line>
    <circle cx="${w - 170}" cy="14" r="5" fill="${colorA}"></circle>
    <text x="${w - 158}" y="18" fill="#e7ebee" font-size="11">${labelA}</text>
    <circle cx="${w - 90}" cy="14" r="5" fill="${colorB}"></circle>
    <text x="${w - 78}" y="18" fill="#e7ebee" font-size="11">${labelB}</text>
    ${bars}
  </svg>`;
}

let allProd = [];
let allDowntime = [];
let allItems = [];
let allAttendance = [];

// ---------- تعريف الفترات الثلاث ----------
function getBuckets(period) {
  const today = new Date();
  if (period === "daily") {
    const yesterday = addDays(today, -1);
    return [
      { label: "أمس", dates: [toDateStr(yesterday)] },
      { label: "اليوم", dates: [toDateStr(today)] },
    ];
  }
  if (period === "weekly") {
    const buckets = [];
    for (let w = 3; w >= 0; w--) {
      const end = addDays(today, -7 * w);
      const start = addDays(end, -6);
      const dates = [];
      for (let d = new Date(start); d <= end; d = addDays(d, 1)) dates.push(toDateStr(d));
      const label = w === 0 ? "هذا الأسبوع" : `قبل ${w} أسبوع`;
      buckets.push({ label, dates });
    }
    return buckets;
  }
  // monthly: الشهر الحالي مقابل اللي قبله
  const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const prevMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const prevMonthEnd = addDays(thisMonthStart, -1);
  const datesInRange = (start, end) => {
    const arr = [];
    for (let d = new Date(start); d <= end; d = addDays(d, 1)) arr.push(toDateStr(d));
    return arr;
  };
  return [
    { label: prevMonthStart.toLocaleDateString("ar-EG", { month: "long" }), dates: datesInRange(prevMonthStart, prevMonthEnd) },
    { label: thisMonthStart.toLocaleDateString("ar-EG", { month: "long" }), dates: datesInRange(thisMonthStart, today) },
  ];
}

function sumQtyForDates(dates) {
  const set = new Set(dates);
  return allProd.filter(r => set.has(r.date)).reduce((s, r) => s + Number(r.qty || 0), 0);
}
function downtimeRecordsForDates(dates) {
  const set = new Set(dates);
  return allDowntime.filter(r => set.has(r.date));
}

// ---------- الوزن والإنتاجية ----------
function itemWeight(itemCode) {
  const item = allItems.find(it => it.code === itemCode || it.id === itemCode);
  return item ? Number(item.weightKg || 0) : 0;
}
function actualWeightKgForDates(dates) {
  const set = new Set(dates);
  return allProd.filter(r => set.has(r.date))
    .reduce((s, r) => s + Number(r.qty || 0) * itemWeight(r.itemCode), 0);
}
function plannedWeightKgForDates(dates) {
  let total = 0;
  for (const dateStr of dates) {
    const date = new Date(dateStr + "T00:00:00");
    for (const item of allItems) {
      total += dailyTargetForItem(item, date) * Number(item.weightKg || 0);
    }
  }
  return total;
}
function attendanceHoursForDates(dates) {
  const set = new Set(dates);
  return allAttendance.filter(r => set.has(r.date)).reduce((s, r) => s + Number(r.totalHours || 0), 0);
}

function render(period) {
  const buckets = getBuckets(period);
  const labels = buckets.map(b => b.label);
  const actualValues = buckets.map(b => sumQtyForDates(b.dates));

  const titleMap = {
    daily: "الإنتاج الفعلي — اليوم مقابل أمس",
    weekly: "الإنتاج الفعلي — آخر 4 أسابيع",
    monthly: "الإنتاج الفعلي — هذا الشهر مقابل اللي قبله",
  };
  document.getElementById("actualChartTitle").textContent = titleMap[period];
  document.getElementById("actualChart").innerHTML = barChartSVG(labels, actualValues, "#4f8fae");

  // ---- معدل الإنتاج (طن) وإنتاجية العمالة (كجم/ساعة) لكل باكت ----
  const targetKgPerHr = Number(document.getElementById("targetProdInput").value || 60);
  const actualWeightTons = buckets.map(b => actualWeightKgForDates(b.dates) / 1000);
  const plannedWeightTons = buckets.map(b => plannedWeightKgForDates(b.dates) / 1000);
  const actualProdKgPerHr = buckets.map((b, i) => {
    const hrs = attendanceHoursForDates(b.dates);
    return hrs > 0 ? Math.round((actualWeightTons[i] * 1000) / hrs) : 0;
  });
  const targetProdSeries = buckets.map(() => targetKgPerHr);

  document.getElementById("weightChart").innerHTML = dualBarChartSVG(
    labels,
    actualWeightTons.map(v => Math.round(v * 10) / 10),
    plannedWeightTons.map(v => Math.round(v * 10) / 10),
    "#4f8fae", "#94a1ad", "فعلي (طن)", "مخطط (طن)"
  );
  document.getElementById("productivityChart").innerHTML = dualBarChartSVG(
    labels, actualProdKgPerHr, targetProdSeries, "#4c9a6a", "#e8a33d", "فعلي (كجم/ساعة)", "مستهدف (كجم/ساعة)"
  );

  const avg = arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
  document.getElementById("kpiActualWeight").textContent = (Math.round(avg(actualWeightTons) * 10) / 10).toLocaleString("ar-EG");
  document.getElementById("kpiPlannedWeight").textContent = (Math.round(avg(plannedWeightTons) * 10) / 10).toLocaleString("ar-EG");
  document.getElementById("kpiActualProd").textContent = Math.round(avg(actualProdKgPerHr)).toLocaleString("ar-EG");

  // كل التوقفات في نطاق الفترة (كل البكتات مجمّعة)
  const allDatesInPeriod = buckets.flatMap(b => b.dates);
  const dtRecords = downtimeRecordsForDates(allDatesInPeriod);
  const totalActual = actualValues.reduce((a, b) => a + b, 0);
  const totalDowntime = dtRecords.reduce((s, r) => s + Number(r.durationMinutes || 0), 0);

  document.getElementById("kpiActual").textContent = totalActual.toLocaleString("ar-EG");
  document.getElementById("kpiDowntime").textContent = totalDowntime.toLocaleString("ar-EG");
  document.getElementById("kpiFaults").textContent = dtRecords.length;

  const reasonKeys = Object.keys(REASON_LABELS);
  const byReason = {};
  reasonKeys.forEach(k => (byReason[k] = 0));
  dtRecords.forEach(r => { byReason[r.reason] = (byReason[r.reason] || 0) + Number(r.durationMinutes || 0); });
  document.getElementById("reasonChartTitle").textContent = "أسباب التوقف (دقائق)";
  document.getElementById("reasonChart").innerHTML = barChartSVG(
    reasonKeys.map(k => REASON_LABELS[k]), reasonKeys.map(k => byReason[k]), "#e8a33d"
  );

  const sorted = [...dtRecords].sort((a, b) => (a.date < b.date ? 1 : -1));
  document.getElementById("downtimeDetailBody").innerHTML = sorted.map(r => `
    <tr>
      <td class="num">${r.date}</td>
      <td>${r.family || "-"}</td>
      <td>${r.machine || "-"}</td>
      <td><span class="tag" style="color:${REASON_COLORS[r.reason] || '#fff'}">${REASON_LABELS[r.reason] || r.reason}</span></td>
      <td class="num">${r.durationMinutes ?? "-"}</td>
    </tr>`).join("") || `<tr><td colspan="5" class="empty">لا توجد بيانات في الفترة دي</td></tr>`;
}

function setActiveTab(period) {
  document.getElementById("tabDaily").className = period === "daily" ? "btn" : "btn secondary";
  document.getElementById("tabWeekly").className = period === "weekly" ? "btn" : "btn secondary";
  document.getElementById("tabMonthly").className = period === "monthly" ? "btn" : "btn secondary";
  render(period);
}

document.getElementById("tabDaily").addEventListener("click", () => setActiveTab("daily"));
document.getElementById("tabWeekly").addEventListener("click", () => setActiveTab("weekly"));
document.getElementById("tabMonthly").addEventListener("click", () => setActiveTab("monthly"));

async function loadData() {
  const [prodSnap, dtSnap] = await Promise.all([
    getDocs(collection(db, "dailyProduction")),
    getDocs(collection(db, "downtimeLog")),
  ]);
  allProd = prodSnap.docs.map(d => d.data());
  allDowntime = dtSnap.docs.map(d => d.data());
  setActiveTab("daily");
}

loadData().catch(err => {
  console.error(err);
  document.getElementById("downtimeDetailBody").innerHTML =
    `<tr><td colspan="5" class="empty">تعذر تحميل البيانات</td></tr>`;
});
