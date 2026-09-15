import { db } from "./firebase-config.js";
import {
  collection, getDocs, addDoc, query, where, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { watchAuth, renderSidebar, requireRoles } from "./auth.js";

requireRoles(["supervisor"]);
let currentUser = null;
watchAuth((state) => { renderSidebar("attendance.html", state); currentUser = state; });

const msgBox = document.getElementById("msgBox");
function showMsg(text, type) {
  msgBox.innerHTML = `<div class="msg ${type}">${text}</div>`;
  setTimeout(() => (msgBox.innerHTML = ""), 3000);
}

function todayStr() { return new Date().toISOString().slice(0, 10); }
document.getElementById("attDate").value = todayStr();

async function loadDayAttendance() {
  const date = document.getElementById("attDate").value || todayStr();
  try {
    const q = query(collection(db, "attendance"), where("date", "==", date));
    const snap = await getDocs(q);
    const rows = snap.docs.map(d => d.data()).sort((a, b) => Number(a.shift) - Number(b.shift));

    document.getElementById("attBody").innerHTML = rows.map(r => `
      <tr>
        <td>وردية ${r.shift}</td>
        <td class="num">${r.headcount}</td>
        <td class="num">${r.hoursPerWorker}</td>
        <td class="num">${r.totalHours}</td>
      </tr>`).join("") || `<tr><td colspan="4" class="empty">لا يوجد تسجيل حضور لليوم ده لسه</td></tr>`;

    const totalHours = rows.reduce((s, r) => s + Number(r.totalHours || 0), 0);
    const totalHeadcount = rows.reduce((s, r) => s + Number(r.headcount || 0), 0);
    document.getElementById("attDayTotal").textContent = totalHours;
    document.getElementById("attDayHeadcount").textContent = totalHeadcount;
  } catch (e) {
    document.getElementById("attBody").innerHTML = `<tr><td colspan="4" class="empty">تعذر تحميل البيانات</td></tr>`;
  }
}

document.getElementById("attForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const headcount = Number(document.getElementById("attHeadcount").value || 0);
  const hoursPerWorker = Number(document.getElementById("attHours").value || 0);
  const data = {
    date: document.getElementById("attDate").value,
    shift: document.getElementById("attShift").value,
    headcount,
    hoursPerWorker,
    totalHours: headcount * hoursPerWorker,
    enteredBy: currentUser?.name || "",
    timestamp: serverTimestamp(),
  };
  try {
    await addDoc(collection(db, "attendance"), data);
    showMsg("تم حفظ تسجيل الحضور", "ok");
    document.getElementById("attHeadcount").value = "";
    loadDayAttendance();
  } catch (err) {
    showMsg("حصل خطأ أثناء الحفظ: " + err.message, "error");
  }
});

document.getElementById("attDate").addEventListener("change", loadDayAttendance);

loadDayAttendance();
