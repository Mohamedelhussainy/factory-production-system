import { auth } from "./firebase-config.js";
import {
  signInWithEmailAndPassword,
  setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const form = document.getElementById("loginForm");
const msgBox = document.getElementById("msgBox");

function showMsg(text, type) {
  msgBox.innerHTML = `<div class="msg ${type}">${text}</div>`;
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  try {
    // يحفظ تسجيل الدخول في المتصفح قبل الانتقال إلى الصفحة المحمية
    await setPersistence(auth, browserLocalPersistence);

    await signInWithEmailAndPassword(auth, email, password);

    const params = new URLSearchParams(window.location.search);
    const next = params.get("next");

    window.location.href = next || "index.html";
  } catch (err) {
    console.error("LOGIN_FAILED", err);
    showMsg(
      "تعذر تسجيل الدخول: " + (err.code || err.message),
      "error"
    );
  }
});
