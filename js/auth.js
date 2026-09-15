// =========================================================
// وحدة تسجيل الدخول والصلاحيات — مستخدمة في كل صفحات النظام
// =========================================================
// وضع الاختبار مغلق: الصلاحيات تعمل فعليًا.
const TEMP_OPEN_MODE = false;

import { auth, projectId } from "./firebase-config.js";
import {
  onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// الأدوار المتاحة في النظام:
// admin       — مدير المصنع: صلاحية كاملة
// management  — إدارة عليا: تحليل وعرض
// supervisor  — مشرف: تسجيل أعطال
// operator    — عامل إدخال: تسجيل إنتاج
// viewer      — زائر

export const NAV_ITEMS = [
  { href: "index.html",            label: "الرئيسية",                   allowedRoles: null },
  { href: "monthly-plan.html",     label: "الخطة الشهرية",             allowedRoles: null },
  { href: "weekly-plan.html",      label: "الخطة الأسبوعية",           allowedRoles: null },
  { href: "daily-plan.html",       label: "الخطة اليومية",             allowedRoles: null },
  { href: "production-entry.html", label: "إدخال الإنتاج",             allowedRoles: ["operator"] },
  { href: "attendance.html",       label: "تسجيل الحضور",             allowedRoles: ["supervisor"] },
  { href: "downtime.html",         label: "تسجيل الأعطال",             allowedRoles: ["supervisor"] },
  { href: "management.html",       label: "الإدارة العليا (تحليل)",    allowedRoles: ["management"] },
  { href: "families.html",         label: "العائلات والعمليات",        allowedRoles: ["admin"] },
  { href: "plan.html",             label: "تعديل الخطة (مدير المصنع)", allowedRoles: ["admin"] },
  { href: "rates.html",            label: "معدلات التشغيل",           allowedRoles: ["admin"] },
  { href: "admin.html",            label: "إدارة عامة (مدير المصنع)", allowedRoles: ["admin"] },
];

export const ROLE_LABELS = {
  admin: "مدير المصنع",
  management: "إدارة عليا",
  supervisor: "مشرف",
  operator: "عامل إدخال",
  viewer: "زائر",
};

export function hasAccess(userRole, allowedRoles) {
  if (TEMP_OPEN_MODE) return true;
  if (!allowedRoles) return true;
  if (userRole === "admin") return true;
  return allowedRoles.includes(userRole);
}

// بنحوّل قيمة REST من Firestore (زي {stringValue:"admin"}) لقيمة JS عادية
function fromFirestoreValue(v) {
  if (!v) return null;
  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return v.doubleValue;
  if ("booleanValue" in v) return v.booleanValue;
  if ("nullValue" in v) return null;
  if ("arrayValue" in v) return (v.arrayValue.values || []).map(fromFirestoreValue);
  if ("mapValue" in v) return fromFirestoreFields(v.mapValue.fields || {});
  return null;
}
function fromFirestoreFields(fields) {
  const out = {};
  for (const [k, v] of Object.entries(fields || {})) out[k] = fromFirestoreValue(v);
  return out;
}

// بنقرا صلاحية المستخدم عن طريق طلب HTTPS عادي (REST) بدل مكتبة Firestore —
// أثبتت الطريقة دي إنها أوثق على الشبكات/الإعدادات اللي بتواجه مشاكل مع قاعدة
// البيانات المسمّاة "default" في مشروعك.
async function fetchRoleWithRetry(uid) {
  const delays = [1500, 3000, 5000, 7000, 9000];
  const idToken = await auth.currentUser.getIdToken();
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/default/documents/users/${encodeURIComponent(uid)}`;

  for (let i = 0; i < delays.length; i++) {
    try {
      const res = await fetch(url, { headers: { "Authorization": `Bearer ${idToken}` } });
      if (res.status === 404) return null; // المستند مش موجود
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      return fromFirestoreFields(json.fields || {});
    } catch (e) {
      if (i === delays.length - 1) throw e;
      await new Promise(resolve => setTimeout(resolve, delays[i]));
    }
  }
}

export function watchAuth(callback) {
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      callback({ user: null, role: null, name: null, resolved: true });
      return;
    }

    callback({
      user,
      role: "viewer",
      name: user.email,
      resolved: false
    });

    try {
      const data = await fetchRoleWithRetry(user.uid);
      console.log("🔍 تشخيص الدور: UID =", user.uid, "| البيانات المجابة =", data);

      callback({
        user,
        role: data?.role || "viewer",
        name: data?.name || user.email,
        resolved: true
      });
    } catch (e) {
      console.error("تعذر قراءة صلاحية المستخدم:", e);

      callback({
        user,
        role: "viewer",
        name: user.email,
        resolved: true
      });
    }
  });
}

export async function logout() {
  await signOut(auth);
  window.location.href = "index.html";
}

export function renderSidebar(activeHref, authState) {
  const sidebar = document.getElementById("sidebar");
  if (!sidebar) return;

  const role = authState?.role || null;

  const links = NAV_ITEMS.map(item => {
    if (!hasAccess(role, item.allowedRoles)) return "";

    const active = item.href === activeHref ? "active" : "";

    return `
      <a class="nav-link ${active}" href="${item.href}">
        ${item.label}
      </a>
    `;
  }).join("");

  const roleLabel = role ? (ROLE_LABELS[role] || role) : "";

  const authBox = authState?.user
    ? `
      <div class="auth-box">
        <div class="who">
          ${authState.name}
          <span class="role-badge">${roleLabel}</span>
        </div>
        <a href="#" id="logoutBtn" class="btn secondary"
           style="width:100%;text-align:center;display:block;">
          تسجيل خروج
        </a>
      </div>
    `
    : `
      <div class="auth-box">
        <a href="login.html" class="btn"
           style="width:100%;text-align:center;display:block;">
          تسجيل دخول
        </a>
      </div>
    `;

  sidebar.innerHTML = `
    <div class="brand">
      نظام إدارة الإنتاج
      <small>لوحة تحكم المصنع</small>
    </div>
    ${links}
    ${authBox}
  `;

  const logoutBtn = document.getElementById("logoutBtn");

  if (logoutBtn) {
    logoutBtn.addEventListener("click", event => {
      event.preventDefault();
      logout();
    });
  }
}

export function requireRoles(allowedRoles) {
  if (TEMP_OPEN_MODE) return;

  watchAuth(state => {
    if (!state.user) {
      window.location.href =
        "login.html?next=" + encodeURIComponent(window.location.pathname);
      return;
    }

    if (!state.resolved) return;

    if (!hasAccess(state.role, allowedRoles)) {
      window.location.href =
        "login.html?next=" + encodeURIComponent(window.location.pathname);
    }
  });
}
