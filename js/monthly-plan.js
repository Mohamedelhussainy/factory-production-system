import { db } from "./firebase-config.js";
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { watchAuth, renderSidebar } from "./auth.js";
import { fmt } from "./calc.js";

watchAuth((state) => renderSidebar("monthly-plan.html", state));

async function load() {
  const snap = await getDocs(collection(db, "items"));
  const rows = snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .map(it => ({ ...it, total: Number(it.w1||0)+Number(it.w2||0)+Number(it.w3||0)+Number(it.w4||0) }))
    .filter(it => it.total > 0)
    .sort((a, b) => (a.family || "").localeCompare(b.family || ""));

  document.getElementById("monthlyBody").innerHTML = rows.map(it => `
    <tr>
      <td><span class="tag">${it.family || "-"}</span></td>
      <td>${it.code || it.id}</td>
      <td>${it.desc || ""}</td>
      <td class="num">${fmt(it.total)}</td>
      <td class="num">${fmt(it.w1||0)}</td>
      <td class="num">${fmt(it.w2||0)}</td>
      <td class="num">${fmt(it.w3||0)}</td>
      <td class="num">${fmt(it.w4||0)}</td>
    </tr>`).join("") || `<tr><td colspan="8" class="empty">لا توجد بيانات — استورد بيانات أولية أو أضف أصناف من صفحة تعديل الخطة</td></tr>`;
}

load().catch(err => {
  console.error(err);
  document.getElementById("monthlyBody").innerHTML = `<tr><td colspan="8" class="empty">تعذر تحميل البيانات — تأكد من ضبط إعدادات Firebase.</td></tr>`;
});
