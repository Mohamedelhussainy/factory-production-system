import { db } from "./firebase-config.js";
import { collection, getDocs, doc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { watchAuth, renderSidebar, requireRoles } from "./auth.js";

requireRoles(["admin"]);
watchAuth((state) => renderSidebar("rates.html", state));

const itemSelect = document.getElementById("itemSelect");
const ratesPanel = document.getElementById("ratesPanel");
const ratesBody = document.getElementById("ratesBody");
const familyLabel = document.getElementById("familyLabel");
const weightPanel = document.getElementById("weightPanel");
const itemWeightInput = document.getElementById("itemWeight");
const msgBox = document.getElementById("msgBox");

function showMsg(text, type) {
  msgBox.innerHTML = `<div class="msg ${type}">${text}</div>`;
  setTimeout(() => (msgBox.innerHTML = ""), 3000);
}

let allItems = [];
let allFamilies = [];
let currentItemId = null;

function renderRatesForItem(itemId) {
  currentItemId = itemId;
  const item = allItems.find(i => i.id === itemId);
  if (!item) return;

  weightPanel.style.display = "block";
  itemWeightInput.value = item.weightKg ?? 0;

  const family = allFamilies.find(f => f.id === item.family);
  const ops = (family?.operations || []).slice().sort((a, b) => (a.seq || 0) - (b.seq || 0));

  familyLabel.textContent = `— ${item.family || "بدون عيلة"}`;
  if (ops.length === 0) {
    ratesPanel.style.display = "block";
    ratesBody.innerHTML = `<tr><td colspan="4" class="empty">العيلة دي لسه مالهاش عمليات معرّفة — روح صفحة "العائلات والعمليات" الأول.</td></tr>`;
    return;
  }

  const existingRates = item.rates || [];
  ratesPanel.style.display = "block";
  ratesBody.innerHTML = ops.map(op => {
    const existing = existingRates.find(r => r.opSeq === op.seq) || {};
    return `<tr data-seq="${op.seq}">
      <td class="num">${op.seq}</td>
      <td>${op.name}</td>
      <td><input type="number" step="0.0001" class="rate-hours" value="${existing.hoursPerUnit ?? 0}"></td>
      <td><input type="number" step="1" class="rate-cap" value="${existing.shiftCapacity ?? 0}"></td>
    </tr>`;
  }).join("");
}

async function loadItems() {
  const [itemsSnap, familiesSnap] = await Promise.all([
    getDocs(collection(db, "items")),
    getDocs(collection(db, "families")),
  ]);
  allItems = itemsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  allFamilies = familiesSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  itemSelect.innerHTML = allItems
    .sort((a, b) => (a.family || "").localeCompare(b.family || ""))
    .map(it => `<option value="${it.id}">${it.family || "-"} — ${it.code || it.id} — ${it.desc || ""}</option>`)
    .join("");

  if (allItems.length > 0) renderRatesForItem(allItems[0].id);
}

itemSelect.addEventListener("change", () => renderRatesForItem(itemSelect.value));

document.getElementById("saveRatesBtn").addEventListener("click", async () => {
  if (!currentItemId) return;
  const rows = [...ratesBody.querySelectorAll("tr[data-seq]")];
  const rates = rows.map(tr => ({
    opSeq: Number(tr.dataset.seq),
    hoursPerUnit: Number(tr.querySelector(".rate-hours").value || 0),
    shiftCapacity: Number(tr.querySelector(".rate-cap").value || 0),
  }));
  try {
    await setDoc(doc(db, "items", currentItemId), { rates }, { merge: true });
    const item = allItems.find(i => i.id === currentItemId);
    if (item) item.rates = rates;
    showMsg("تم حفظ المعدلات بنجاح", "ok");
  } catch (e) {
    showMsg("حصل خطأ أثناء الحفظ: " + e.message, "error");
  }
});

document.getElementById("saveWeightBtn").addEventListener("click", async () => {
  if (!currentItemId) return;
  const weightKg = Number(itemWeightInput.value || 0);
  try {
    await setDoc(doc(db, "items", currentItemId), { weightKg }, { merge: true });
    const item = allItems.find(i => i.id === currentItemId);
    if (item) item.weightKg = weightKg;
    showMsg("تم حفظ وزن الوحدة بنجاح", "ok");
  } catch (e) {
    showMsg("حصل خطأ أثناء الحفظ: " + e.message, "error");
  }
});

loadItems().catch(err => {
  console.error(err);
  itemSelect.innerHTML = `<option>تعذر تحميل البيانات</option>`;
});
