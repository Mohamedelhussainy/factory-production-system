import { db } from "./firebase-config.js";
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { watchAuth, renderSidebar } from "./auth.js";
import { fmt } from "./calc.js";

watchAuth((state) => renderSidebar("weekly-plan.html", state));

let allItems = [];
let currentWeek = 1;

function render(week) {
  document.getElementById("weeklyTitle").textContent = `الأسبوع ${week}`;
  const key = "w" + week;
  const rows = allItems
    .filter(it => Number(it[key] || 0) > 0)
    .sort((a, b) => Number(b[key]) - Number(a[key]));

  document.getElementById("weeklyBody").innerHTML = rows.map(it => `
    <tr>
      <td>${it.code || it.id}</td>
      <td>${it.desc || ""}</td>
      <td><span class="tag">${it.family || "-"}</span></td>
      <td class="num">${fmt(Number(it[key]))}</td>
    </tr>`).join("") || `<tr><td colspan="4" class="empty">لا توجد أصناف مستهدفة في الأسبوع ده</td></tr>`;
}

document.querySelectorAll(".week-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    currentWeek = Number(btn.dataset.week);
    document.querySelectorAll(".week-btn").forEach(b => b.className = "btn secondary week-btn");
    btn.className = "btn week-btn";
    render(currentWeek);
  });
});

async function load() {
  const snap = await getDocs(collection(db, "items"));
  allItems = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  render(currentWeek);
}

load().catch(err => {
  console.error(err);
  document.getElementById("weeklyBody").innerHTML = `<tr><td colspan="4" class="empty">تعذر تحميل البيانات — تأكد من ضبط إعدادات Firebase.</td></tr>`;
});
