import { db } from "./firebase-config.js";
import {
  collection, getDocs, doc, setDoc, deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { watchAuth, renderSidebar, requireRoles } from "./auth.js";

requireRoles(["admin"]);
watchAuth((state) => renderSidebar("plan.html", state));

const itemsBody = document.getElementById("itemsBody");
const msgBox = document.getElementById("msgBox");
const familySelect = document.getElementById("newFamily");

function showMsg(text, type) {
  msgBox.innerHTML = `<div class="msg ${type}">${text}</div>`;
  setTimeout(() => (msgBox.innerHTML = ""), 3000);
}

async function loadFamilyOptions() {
  const snap = await getDocs(collection(db, "families"));
  familySelect.innerHTML = snap.docs.map(d => `<option value="${d.id}">${d.id}</option>`).join("")
    || `<option value="">لا توجد عائلات بعد</option>`;
}

function buildRow(id, it) {
  const tr = document.createElement("tr");
  tr.dataset.id = id;
  tr.innerHTML = `
    <td>${it.code || id}</td>
    <td><input class="f-desc" value="${it.desc || ""}"></td>
    <td><input class="f-family" value="${it.family || ""}"></td>
    <td><input class="f-w1" type="number" value="${it.w1 || 0}"></td>
    <td><input class="f-w2" type="number" value="${it.w2 || 0}"></td>
    <td><input class="f-w3" type="number" value="${it.w3 || 0}"></td>
    <td><input class="f-w4" type="number" value="${it.w4 || 0}"></td>
    <td><button class="btn danger del-btn" type="button">حذف</button></td>
  `;
  tr.querySelector(".del-btn").addEventListener("click", async () => {
    if (!confirm("حذف الصنف ده؟")) return;
    await deleteDoc(doc(db, "items", id));
    tr.remove();
  });
  return tr;
}

async function loadItems() {
  const snap = await getDocs(collection(db, "items"));
  document.getElementById("itemCount").textContent = `(${snap.size})`;
  if (snap.empty) {
    itemsBody.innerHTML = `<tr><td colspan="8" class="empty">لا توجد أصناف بعد</td></tr>`;
    return;
  }
  itemsBody.innerHTML = "";
  snap.forEach(d => itemsBody.appendChild(buildRow(d.id, d.data())));
}

document.getElementById("addItemBtn").addEventListener("click", async () => {
  const code = document.getElementById("newCode").value.trim();
  const desc = document.getElementById("newDesc").value.trim();
  const family = familySelect.value;
  if (!code) { showMsg("لازم تدخل كود الصنف", "error"); return; }
  await setDoc(doc(db, "items", code), { code, desc, family, w1:0, w2:0, w3:0, w4:0 });
  document.getElementById("newCode").value = "";
  document.getElementById("newDesc").value = "";
  loadItems();
});

document.getElementById("saveAllBtn").addEventListener("click", async () => {
  const rows = [...itemsBody.querySelectorAll("tr")];
  try {
    await Promise.all(rows.map(tr => {
      const id = tr.dataset.id;
      const data = {
        code: id,
        desc: tr.querySelector(".f-desc").value.trim(),
        family: tr.querySelector(".f-family").value.trim(),
        w1: Number(tr.querySelector(".f-w1").value || 0),
        w2: Number(tr.querySelector(".f-w2").value || 0),
        w3: Number(tr.querySelector(".f-w3").value || 0),
        w4: Number(tr.querySelector(".f-w4").value || 0),
      };
      return setDoc(doc(db, "items", id), data, { merge: true });
    }));
    showMsg("تم حفظ كل التعديلات بنجاح", "ok");
  } catch (e) {
    showMsg("حصل خطأ أثناء الحفظ: " + e.message, "error");
  }
});

loadFamilyOptions();
loadItems().catch(err => {
  console.error(err);
  itemsBody.innerHTML = `<tr><td colspan="8" class="empty">تعذر تحميل البيانات — تأكد من ضبط إعدادات Firebase.</td></tr>`;
});
