import { db } from "./firebase-config.js";
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { watchAuth, renderSidebar } from "./auth.js";
import { dailyTargetForItem, dayInfo, machineRequirement, laborRequirement, fmt } from "./calc.js";

watchAuth((state) => renderSidebar("daily-plan.html", state));

let allItems = [];
let allFamilies = [];

function pad(n) { return String(n).padStart(2, "0"); }
function toDateInputValue(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }

const dateInput = document.getElementById("dailyDate");
dateInput.value = toDateInputValue(new Date());
dateInput.addEventListener("change", render);

function render() {
  const date = dateInput.value ? new Date(dateInput.value + "T00:00:00") : new Date();
  const { isFriday } = dayInfo(date);

  const rows = allItems
    .map(it => ({ ...it, todayTarget: dailyTargetForItem(it, date) }))
    .filter(it => it.todayTarget > 0)
    .sort((a, b) => b.todayTarget - a.todayTarget);

  const totalTarget = rows.reduce((s, it) => s + it.todayTarget, 0);
  document.getElementById("kpiTarget").textContent = fmt(totalTarget).toLocaleString("ar-EG");
  document.getElementById("kpiItems").textContent = rows.length;
  document.getElementById("kpiFriday").textContent = isFriday ? "نعم" : "لا";

  document.getElementById("dailyItemsBody").innerHTML = rows.map(it => `
    <tr>
      <td>${it.code || it.id}</td>
      <td>${it.desc || ""}</td>
      <td><span class="tag">${it.family || "-"}</span></td>
      <td class="num">${fmt(it.todayTarget)}</td>
    </tr>`).join("") || `<tr><td colspan="4" class="empty">لا توجد أصناف مجدولة (يمكن يكون اليوم جمعة)</td></tr>`;

  // ---- الماكينات ----
  const machineRows = [];
  for (const fam of allFamilies) {
    const ops = fam.operations || [];
    if (ops.length === 0) continue;
    const results = machineRequirement(allItems, fam.id, ops, date);
    results.forEach(r => {
      if (r.machineShiftsNeeded <= 0) return;
      const famItemsToday = rows.filter(it => it.family === fam.id && (it.rates || []).some(rt => rt.opSeq === r.opSeq));
      const topItem = famItemsToday[0];
      machineRows.push({
        family: fam.id,
        opName: r.opName,
        productDesc: topItem ? (topItem.desc || topItem.code) : "-",
        productQty: topItem ? fmt(topItem.todayTarget) : "-",
        machineShiftsNeeded: r.machineShiftsNeeded,
      });
    });
  }
  document.getElementById("machinesBody").innerHTML = machineRows.map(r => `
    <tr>
      <td><span class="tag">${r.family}</span></td>
      <td>${r.opName}</td>
      <td>${r.productDesc}</td>
      <td class="num">${r.productQty}</td>
      <td class="num">${r.machineShiftsNeeded}</td>
    </tr>`).join("") || `<tr><td colspan="5" class="empty">محتاج تعرّف معدلات التشغيل لكل صنف من صفحة "معدلات التشغيل" الأول</td></tr>`;

  // ---- العمالة ----
  const laborRows = laborRequirement(allItems, allFamilies, date).filter(r => r.count > 0);
  document.getElementById("laborBody").innerHTML = laborRows.map(r => `
    <tr><td>${r.label}</td><td class="num">${r.count}</td></tr>`).join("")
    || `<tr><td colspan="2" class="empty">محتاج تعرّف فئة العمالة لكل عملية من صفحة "العائلات والعمليات"، ومعدلات التشغيل لكل صنف</td></tr>`;
}

async function loadAndRender() {
  const [itemsSnap, familiesSnap] = await Promise.all([
    getDocs(collection(db, "items")),
    getDocs(collection(db, "families")),
  ]);
  allItems = itemsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  allFamilies = familiesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  render();
}

loadAndRender().catch(err => {
  console.error(err);
  document.getElementById("dailyItemsBody").innerHTML = `<tr><td colspan="4" class="empty">تعذر تحميل البيانات — تأكد من ضبط إعدادات Firebase.</td></tr>`;
});
