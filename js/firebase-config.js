// =========================================================
// إعدادات Firebase — حط هنا الكائن اللي هتاخده من:
// Firebase Console > Project settings > Your apps > (Web) </>
// =========================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { initializeFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyAZAJUeaKzqZzxsM7mjztd0xaGy5NzlvAI",
  authDomain: "factory-production-syste-c0b57.firebaseapp.com",
  projectId: "factory-production-syste-c0b57",
  storageBucket: "factory-production-syste-c0b57.firebasestorage.app",
  messagingSenderId: "193985162644",
  appId: "1:193985162644:web:637b01bcd2a6447b4f3381"
};

export const app = initializeApp(firebaseConfig);
export const projectId = firebaseConfig.projectId;
// بنسيب Firestore يكتشف لوحده لو محتاج Long Polling (أثبت إنه شغال صح)
// ومهم جدًا: بنحدد اسم قاعدة البيانات "default" صراحةً (مش الافتراضية الكلاسيكية)
// لأن مشروعك بالذات عنده قاعدة بيانات مسمّاة "default" مش القاعدة الافتراضية العادية.
export const db = initializeFirestore(app, {
  experimentalAutoDetectLongPolling: true,
  useFetchStreams: false,
}, "default");
export const auth = getAuth(app);
