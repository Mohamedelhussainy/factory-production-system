import { db } from "./firebase-config.js";
import {
  collection, getDocs, addDoc, query, where, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { watchAuth, renderSidebar, requireRoles } from "./auth.js";

requireRoles(["supervisor"]);
let currentUser = null;
watchAuth((state) => { renderSidebar("downtime.html", state); currentUser = state; });

const familySelect = document.getElementById("dtFamily");
const msgBox = document.getElementById("msgBox");
const downtimeBody = document.getElementById("downtimeBody");

const REASON_LABELS = {
  maintenance: "صيانة",
  material: "نقص خامة",
  labor: "نقص عمالة",
  other: "أخرى",
};

function showMsg(text, type) {
  msgBox.innerHTML = `<div class="msg ${type}">${text}</div>`;
  setTimeout(() => (msgBox.innerHTML = ""), 3000);
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
document.getElementById("dtDate").value = todayStr();

async function loadFamilies() {
  const snap = await getDocs(collection(db, "families"));
  familySelect.innerHTML = snap.docs.map(d => `<option value="${d.id}">${d.id}</option>`).join("")
    || `<option value="">لا توجد عائلات بعد</option>`;
}

function minutesBetween(start, end) {
  if (!start || !end) return null;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  let diff = (eh * 60 + em) - (sh * 60 + sm);
  if (diff < 0) diff += 24 * 60; // عبر منتصف الليل
  return diff;
}

async function loadTodayDowntime() {
  const date = document.getElementById("dtDate").value || todayStr();
  try {
    const q = query(collection(db, "downtimeLog"), where("date", "==", date));
    const snap = await getDocs(q);
    const rows = snap.docs.map(d => d.data());
    downtimeBody.innerHTML = rows.map(r => `
      <tr>
        <td>${r.family}</td>
        <td>${r.machine}</td>
        <td><span class="tag">${REASON_LABELS[r.reason] || r.reason}</span></td>
        <td class="num">${r.start}</td>
        <td class="num">${r.end || "مستمر"}</td>
        <td class="num">${r.durationMinutes ?? "-"}</td>
      </tr>`).join("") || `<tr><td colspan="6" class="empty">لا توجد أعطال مسجلة اليوم</td></tr>`;
  } catch (e) {
    downtimeBody.innerHTML = `<tr><td colspan="6" class="empty">تعذر تحميل البيانات</td></tr>`;
  }
}

document.getElementById("downtimeForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const start = document.getElementById("dtStart").value;
  const end = document.getElementById("dtEnd").value;
  const data = {
    date: document.getElementById("dtDate").value,
    family: familySelect.value,
    machine: document.getElementById("dtMachine").value.trim(),
    reason: document.getElementById("dtReason").value,
    start, end: end || null,
    durationMinutes: minutesBetween(start, end),
    notes: document.getElementById("dtNotes").value.trim(),
    enteredBy: currentUser?.name || "",
    timestamp: serverTimestamp(),
  };
  try {
    await addDoc(collection(db, "downtimeLog"), data);
    showMsg("تم حفظ تسجيل العطل", "ok");
    document.getElementById("dtMachine").value = "";
    document.getElementById("dtNotes").value = "";
    document.getElementById("dtStart").value = "";
    document.getElementById("dtEnd").value = "";
    loadTodayDowntime();
  } catch (err) {
    showMsg("حصل خطأ أثناء الحفظ: " + err.message, "error");
  }
});

document.getElementById("dtDate").addEventListener("change", loadTodayDowntime);

loadFamilies();
loadTodayDowntime();
