import { watchAuth, NAV_ITEMS, logout, hasAccess, ROLE_LABELS } from "./auth.js";

const ICONS = {
  "monthly-plan.html": "🗓️",
  "weekly-plan.html": "📆",
  "daily-plan.html": "📅",
  "production-entry.html": "🏭",
  "attendance.html": "🧑‍🤝‍🧑",
  "downtime.html": "🛠️",
  "management.html": "📊",
  "families.html": "🔗",
  "plan.html": "✏️",
  "rates.html": "⏱️",
  "admin.html": "🛡️",
};

function renderGrid(authState) {
  const grid = document.getElementById("appGrid");
  const role = authState?.role || null;
  const modules = NAV_ITEMS.filter(item => item.href !== "index.html");

  grid.innerHTML = modules.map(item => {
    const icon = ICONS[item.href] || "📁";
    const allowed = hasAccess(role, item.allowedRoles);
    if (allowed) {
      return `<a class="app-card" href="${item.href}">
        <div class="icon-circle">${icon}</div>
        <div class="label">${item.label}</div>
      </a>`;
    }
    const roleNote = item.allowedRoles ? `يحتاج صلاحية: ${ROLE_LABELS[item.allowedRoles[0]] || item.allowedRoles[0]}` : "";
    return `<a class="app-card locked" href="login.html">
      <div class="icon-circle">🔒</div>
      <div class="label">${item.label}</div>
      <div class="lock-note">${roleNote}</div>
    </a>`;
  }).join("");
}

function renderGreeting(authState) {
  const box = document.getElementById("greetingBox");
  const authIcon = document.getElementById("authIconBtn");
  if (authState?.user) {
    const roleLabel = ROLE_LABELS[authState.role] || authState.role || "";
    box.textContent = `أهلاً، ${authState.name}${roleLabel ? " — " + roleLabel : ""}`;
    box.classList.add("logged");
    authIcon.textContent = "🚪";
    authIcon.onclick = (e) => { e.preventDefault(); logout(); };
  } else {
    box.textContent = "Welcome to the Acrow production team";
    box.classList.remove("logged");
    authIcon.textContent = "👤";
    authIcon.onclick = (e) => { e.preventDefault(); window.location.href = "login.html"; };
  }
}

watchAuth((state) => {
  renderGreeting(state);
  renderGrid(state);
});
