import { db } from "./firebase-config.js";
import {
  collection, getDocs, addDoc, query, where, orderBy, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { watchAuth, renderSidebar, requireRoles } from "./auth.js";

requireRoles(["operator"]);
let currentUser = null;
watchAuth((state) => { renderSidebar("production-entry.html", state); currentUser = state; });

const itemSelect = document.getElementById("entryItem");
const msgBox = document.getElementById("msgBox");
const entriesBody = document.getElementById("entriesBody");

function showMsg(text, type) {
  msgBox.innerHTML = `<div class="msg ${type}">${text}</div>`;
  setTimeout(() => (msgBox.innerHTML = ""), 3000);
}

function todayStr() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}
document.getElementById("entryDate").value = todayStr();

async function loadItems() {
  const snap = await getDocs(collection(db, "items"));
  itemSelect.innerHTML = snap.docs
    .map(d => `<option value="${d.id}">${d.data().code || d.id} — ${d.data().desc || ""}</option>`)
    .join("") || `<option value="">لا توجد أصناف</option>`;
}

async function loadTodayEntries() {
  const date = document.getElementById("entryDate").value || todayStr();
  try {
    const q = query(collection(db, "dailyProduction"), where("date", "==", date));
    const snap = await getDocs(q);
    const rows = snap.docs.map(d => d.data()).sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
    entriesBody.innerHTML = rows.map(r => `
      <tr>
        <td>${r.timestamp?.toDate ? r.timestamp.toDate().toLocaleTimeString("ar-EG") : "-"}</td>
        <td>${r.shift}</td>
        <td>${r.itemCode}</td>
        <td>${r.machine}</td>
        <td>${r.worker}</td>
        <td class="num">${r.qty}</td>
      </tr>`).join("") || `<tr><td colspan="6" class="empty">لا توجد تسجيلات اليوم</td></tr>`;
  } catch (e) {
    entriesBody.innerHTML = `<tr><td colspan="6" class="empty">تعذر تحميل التسجيلات</td></tr>`;
  }
}

document.getElementById("entryForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const data = {
    date: document.getElementById("entryDate").value,
    shift: document.getElementById("entryShift").value,
    itemCode: document.getElementById("entryItem").value,
    machine: document.getElementById("entryMachine").value.trim(),
    worker: document.getElementById("entryWorker").value.trim(),
    qty: Number(document.getElementById("entryQty").value || 0),
    enteredBy: currentUser?.name || "",
    timestamp: serverTimestamp(),
  };
  try {
    await addDoc(collection(db, "dailyProduction"), data);
    showMsg("تم حفظ التسجيل بنجاح", "ok");
    document.getElementById("entryMachine").value = "";
    document.getElementById("entryWorker").value = "";
    document.getElementById("entryQty").value = "";
    loadTodayEntries();
  } catch (err) {
    showMsg("حصل خطأ أثناء الحفظ: " + err.message, "error");
  }
});

document.getElementById("entryDate").addEventListener("change", loadTodayEntries);

loadItems();
loadTodayEntries();
