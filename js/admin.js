import { auth, projectId } from "./firebase-config.js";
import { watchAuth, renderSidebar, requireRoles } from "./auth.js";

requireRoles(["admin"]);
watchAuth((state) => renderSidebar("admin.html", state));

const msgBox = document.getElementById("msgBox");
function showMsg(text, type) {
  msgBox.innerHTML = `<div class="msg ${type}">${text}</div>`;
}

// ---------- تحويل بيانات JS لصيغة Firestore REST ----------
function toFirestoreValue(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === "string") return { stringValue: v };
  if (typeof v === "boolean") return { booleanValue: v };
  if (typeof v === "number") {
    return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  }
  if (Array.isArray(v)) {
    return { arrayValue: { values: v.map(toFirestoreValue) } };
  }
  if (typeof v === "object") {
    return { mapValue: { fields: toFirestoreFields(v) } };
  }
  return { stringValue: String(v) };
}
function toFirestoreFields(obj) {
  const fields = {};
  for (const [k, v] of Object.entries(obj)) fields[k] = toFirestoreValue(v);
  return fields;
}

// ---------- كتابة مستند عن طريق طلب HTTPS عادي (REST) بدل قناة الكتابة المستمرة ----------
async function restSetDoc(collectionName, docId, data, attempts = 4) {
  if (!auth.currentUser) throw new Error("مسجّلش دخول");
  console.log("🔍 تشخيص REST: UID الحالي =", auth.currentUser.uid, "| الإيميل =", auth.currentUser.email);
  const idToken = await auth.currentUser.getIdToken(true); // true = تجديد إجباري للتوكن
const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/default/documents/${collectionName}/${encodeURIComponent(docId)}`;
  const body = JSON.stringify({ fields: toFirestoreFields(data) });

  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, {
        method: "PATCH",
        headers: {
          "Authorization": `Bearer ${idToken}`,
          "Content-Type": "application/json",
        },
        body,
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`HTTP ${res.status}: ${errText.slice(0, 200)}`);
      }
      return;
    } catch (e) {
      if (i === attempts - 1) throw e;
      await new Promise(r => setTimeout(r, 2000));
    }
  }
}

// ---------- كتابة/تحديث حقل واحد بس من غير ما نمسح باقي حقول المستند ----------
async function restMergeFields(collectionName, docId, data, attempts = 4) {
  if (!auth.currentUser) throw new Error("مسجّلش دخول");
  const idToken = await auth.currentUser.getIdToken(true);
  const fieldPaths = Object.keys(data).map(k => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join("&");
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/default/documents/${collectionName}/${encodeURIComponent(docId)}?${fieldPaths}`;
  const body = JSON.stringify({ fields: toFirestoreFields(data) });

  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, {
        method: "PATCH",
        headers: { "Authorization": `Bearer ${idToken}`, "Content-Type": "application/json" },
        body,
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`HTTP ${res.status}: ${errText.slice(0, 200)}`);
      }
      return;
    } catch (e) {
      if (i === attempts - 1) throw e;
      await new Promise(r => setTimeout(r, 2000));
    }
  }
}

document.getElementById("seedBtn").addEventListener("click", async () => {
  const statusEl = document.getElementById("seedStatus");
  const btn = document.getElementById("seedBtn");

  if (!auth.currentUser) {
    showMsg("لازم تسجّل دخول الأول قبل ما تستورد البيانات.", "error");
    return;
  }

  btn.disabled = true;
  try {
    const [itemsRes, familiesRes] = await Promise.all([
      fetch("seed_items.json"), fetch("seed_families.json")
    ]);
    const items = await itemsRes.json();
    const families = await familiesRes.json();
    const familyEntries = Object.entries(families);
    const total = familyEntries.length + items.length;
    let done = 0;

    for (const [name, operations] of familyEntries) {
      statusEl.textContent = `جارِ الاستيراد... (${done + 1} من ${total}) — عيلة: ${name}`;
      await restSetDoc("families", name, { name, operations });
      done++;
    }
    for (const it of items) {
      statusEl.textContent = `جارِ الاستيراد... (${done + 1} من ${total}) — صنف: ${it.code}`;
      await restSetDoc("items", it.code, it);
      done++;
    }

    statusEl.textContent = `تم استيراد ${items.length} صنف و ${familyEntries.length} عيلة بنجاح ✔`;
    showMsg("تم الاستيراد بنجاح", "ok");
  } catch (e) {
    console.error(e);
    showMsg("حصل خطأ أثناء الاستيراد: " + e.message + " — البيانات اللي اتكتبت قبل الخطأ محفوظة، تقدر تدوس الزرار تاني وهيكمل.", "error");
  } finally {
    btn.disabled = false;
  }
});

document.getElementById("seedWeightsBtn").addEventListener("click", async () => {
  const statusEl = document.getElementById("weightsStatus");
  const btn = document.getElementById("seedWeightsBtn");

  if (!auth.currentUser) {
    showMsg("لازم تسجّل دخول الأول قبل ما تستورد البيانات.", "error");
    return;
  }

  btn.disabled = true;
  try {
    const res = await fetch("seed_weights.json");
    const weights = await res.json();
    const entries = Object.entries(weights);
    let done = 0;
    for (const [code, weightKg] of entries) {
      statusEl.textContent = `جارِ الاستيراد... (${done + 1} من ${entries.length}) — صنف: ${code}`;
      await restMergeFields("items", code, { weightKg: Number(weightKg) || 0 });
      done++;
    }
    statusEl.textContent = `تم تحديث وزن ${entries.length} صنف بنجاح ✔`;
    showMsg("تم استيراد الأوزان بنجاح", "ok");
  } catch (e) {
    console.error(e);
    showMsg("حصل خطأ أثناء استيراد الأوزان: " + e.message, "error");
  } finally {
    btn.disabled = false;
  }
});

document.getElementById("addUserBtn").addEventListener("click", async () => {
  const uid = document.getElementById("uidInput").value.trim();
  const name = document.getElementById("nameInput").value.trim();
  const role = document.getElementById("roleInput").value;
  if (!uid) { showMsg("لازم تدخل الـ UID", "error"); return; }
  if (!auth.currentUser) { showMsg("لازم تسجّل دخول الأول.", "error"); return; }
  try {
    await restSetDoc("users", uid, { name, role });
    showMsg(`تم حفظ صلاحية "${name}" كـ ${role}`, "ok");
    document.getElementById("uidInput").value = "";
    document.getElementById("nameInput").value = "";
  } catch (e) {
    showMsg("حصل خطأ: " + e.message, "error");
  }
});
