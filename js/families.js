import { db } from "./firebase-config.js";
import {
  collection, getDocs, doc, setDoc, deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { watchAuth, renderSidebar, requireRoles } from "./auth.js";

requireRoles(["admin"]);
watchAuth((state) => renderSidebar("families.html", state));

const container = document.getElementById("familiesContainer");
const template = document.getElementById("familyCardTemplate");
const msgBox = document.getElementById("msgBox");

function showMsg(text, type) {
  msgBox.innerHTML = `<div class="msg ${type}">${text}</div>`;
  setTimeout(() => (msgBox.innerHTML = ""), 3000);
}

const LABOR_CATEGORIES = [
  { value: "", label: "— بدون —" },
  { value: "auto_weld", label: "لحام أوتوماتيك" },
  { value: "manual_weld", label: "لحام يدوي" },
  { value: "manual_weld_excellent", label: "لحام يدوي ممتاز" },
  { value: "press_tech", label: "فني مكابس" },
  { value: "grinder", label: "حجار" },
  { value: "operator", label: "عامل تشغيل" },
];

function categoryOptionsHTML(selected) {
  return LABOR_CATEGORIES.map(c =>
    `<option value="${c.value}" ${c.value === selected ? "selected" : ""}>${c.label}</option>`
  ).join("");
}

function buildOpRow(op) {
  const tr = document.createElement("tr");
  tr.innerHTML = `
    <td><input type="number" class="op-seq" value="${op.seq ?? ""}" style="width:70px"></td>
    <td><input type="text" class="op-name" value="${op.name ?? ""}"></td>
    <td><input type="number" class="op-machines" value="${op.machines ?? 0}" style="width:90px"></td>
    <td><input type="number" class="op-hours" value="${op.shiftHours ?? 8}" style="width:90px"></td>
    <td><select class="op-category">${categoryOptionsHTML(op.workerCategory || "")}</select></td>
    <td><input type="number" class="op-workers" value="${op.workersPerOp ?? 1}" min="1" style="width:90px"></td>
    <td><button class="btn danger remove-op-btn" type="button">حذف</button></td>
  `;
  tr.querySelector(".remove-op-btn").addEventListener("click", () => tr.remove());
  return tr;
}

function buildFamilyCard(familyName, operations) {
  const node = template.content.cloneNode(true);
  const card = node.querySelector(".family-card");
  card.querySelector(".family-title").textContent = familyName;
  const body = card.querySelector(".ops-body");

  (operations || []).sort((a,b) => (a.seq||0)-(b.seq||0)).forEach(op => body.appendChild(buildOpRow(op)));

  card.querySelector(".add-op-btn").addEventListener("click", () => {
    const nextSeq = body.children.length + 1;
    body.appendChild(buildOpRow({ seq: nextSeq, name: "", machines: 0, shiftHours: 8, workerCategory: "", workersPerOp: 1 }));
  });

  card.querySelector(".save-family-btn").addEventListener("click", async () => {
    const rows = [...body.querySelectorAll("tr")];
    const operations = rows.map(tr => ({
      seq: Number(tr.querySelector(".op-seq").value || 0),
      name: tr.querySelector(".op-name").value.trim(),
      machines: Number(tr.querySelector(".op-machines").value || 0),
      shiftHours: Number(tr.querySelector(".op-hours").value || 8),
      workerCategory: tr.querySelector(".op-category").value,
      workersPerOp: Number(tr.querySelector(".op-workers").value || 1),
    })).filter(op => op.name);
    try {
      await setDoc(doc(db, "families", familyName), { name: familyName, operations });
      showMsg(`تم حفظ "${familyName}"`, "ok");
    } catch (e) {
      showMsg("حصل خطأ أثناء الحفظ: " + e.message, "error");
    }
  });

  card.querySelector(".delete-family-btn").addEventListener("click", async () => {
    if (!confirm(`متأكد إنك عايز تحذف "${familyName}"؟`)) return;
    await deleteDoc(doc(db, "families", familyName));
    loadFamilies();
  });

  return node;
}

document.getElementById("addFamilyBtn").addEventListener("click", async () => {
  const name = document.getElementById("newFamilyName").value.trim();
  if (!name) return;
  await setDoc(doc(db, "families", name), { name, operations: [] });
  document.getElementById("newFamilyName").value = "";
  loadFamilies();
});

async function loadFamilies() {
  container.innerHTML = `<div class="empty">جارِ التحميل...</div>`;
  const snap = await getDocs(collection(db, "families"));
  if (snap.empty) {
    container.innerHTML = `<div class="empty">لا توجد عائلات بعد — أضف واحدة من فوق، أو استوردها من صفحة "استيراد بيانات أولية".</div>`;
    return;
  }
  container.innerHTML = "";
  snap.forEach(d => {
    container.appendChild(buildFamilyCard(d.id, d.data().operations || []));
  });
}

loadFamilies().catch(err => {
  console.error(err);
  container.innerHTML = `<div class="empty">تعذر تحميل البيانات — تأكد من ضبط إعدادات Firebase.</div>`;
});
