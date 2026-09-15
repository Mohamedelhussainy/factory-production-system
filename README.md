# نظام إدارة الإنتاج — تطبيق الويب

نسخة أولى (الموديول 1): لوحة متابعة عامة + صفحات إدارية محمية بتسجيل دخول لتعريف
العائلات/العمليات والخطة الأسبوعية للأصناف. البيانات مأخوذة من ملفات المصنع الأصلية
(53 صنف لهم خطة فعلية).

## هيكل المشروع

```
webapp/
  index.html          ← لوحة المتابعة (عامة، بدون تسجيل دخول)
  login.html          ← تسجيل الدخول
  families.html       ← تعريف العائلات وعملياتها (admin فقط)
  plan.html           ← الخطة الأسبوعية للأصناف (admin فقط)
  admin.html          ← استيراد بيانات أولية + إدارة صلاحيات المستخدمين (admin فقط)
  style.css           ← التصميم المشترك لكل الصفحات
  seed_items.json      ← بيانات الأصناف الأولية (53 صنف)
  seed_families.json   ← بيانات العائلات الأولية (Ledger/Vertical مُجهزين)
  firestore.rules      ← صلاحيات قاعدة البيانات (تُرفع لـ Firebase)
  js/
    firebase-config.js ← إعدادات مشروعك (لازم تعدّلها بنفسك)
    auth.js            ← تسجيل الدخول والصلاحيات + القائمة الجانبية
    calc.js            ← منطق توزيع الخطة اليومية (نفس منطق ملف الإكسل)
    app.js             ← منطق لوحة المتابعة
    login.js, families.js, plan.js, admin.js
```

## خطوات التشغيل

### 1) جهّز مشروع Firebase
اتبع الخطوات اللي اتفقنا عليها (Console > Add project > فعّل Firestore + Authentication
Email/Password + سجّل Web App). خد كائن `firebaseConfig`.

### 2) عدّل `js/firebase-config.js`
حط القيم اللي أخدتها من Firebase مكان `PASTE_YOUR_...`.

### 3) ارفع صلاحيات قاعدة البيانات
من Firebase Console > Firestore Database > Rules، الصق محتوى ملف `firestore.rules`
واعمل Publish. (أو لو مستخدم Firebase CLI: `firebase deploy --only firestore:rules`)

### 4) اعمل أول حساب أدمن
- من Firebase Console > Authentication > Add user، اعمل حساب بإيميلك.
- انسخ الـ UID بتاعه من نفس الصفحة.
- افتح `admin.html` محليًا (أو بعد الرفع) — بس هتحتاج تدخل بيانات مستخدم admin يدويًا
  في قاعدة البيانات أول مرة (لحد ما تعمل أول حساب): من Firestore Console،
  اعمل collection اسمها `users`، وحط فيه document الـ id بتاعه = الـ UID اللي نسخته،
  وفيه field: `role: "admin"`, `name: "اسمك"`.
- بعد كده سجّل دخول من `login.html` وهتقدر تدخل صفحات الأدمن عادي.

### 5) جرّب الموقع محليًا
افتح `index.html` مباشرة في المتصفح، أو الأفضل شغّل سيرفر محلي بسيط عشان الـ
ES Modules تشتغل صح:
```
cd webapp
python3 -m http.server 8080
```
افتح `http://localhost:8080`

### 6) استورد البيانات الأولية
سجّل دخول كأدمن > روح `admin.html` > دوس "استيراد الأصناف والعائلات".

### 7) ارفع المشروع على GitHub
```
cd webapp
git init
git add .
git commit -m "أول نسخة من نظام إدارة الإنتاج"
git branch -M main
git remote add origin <رابط الريبو بتاعك على GitHub>
git push -u origin main
```

### 8) انشر على Firebase Hosting
```
npm install -g firebase-tools
firebase login
firebase init hosting   # اختار المجلد ده كـ public directory
firebase deploy
```
هتاخد لينك زي `https://your-project.web.app` — ده اللينك اللي تدّيه للناس.

## الأدوار (Roles)
- **بدون تسجيل دخول (viewer)**: يشوف لوحة المتابعة بس (`index.html`) — قراءة فقط.
- **supervisor**: (هنضيفه في الموديول الجاي) يقدر يسجّل الإنتاج الفعلي والتوقفات.
- **admin**: يتحكم في العائلات/العمليات والخطة الأسبوعية وصلاحيات المستخدمين.

## الخطوة الجاية (الموديول 2)
- صفحة تسجيل الإنتاج الفعلي اليومي لكل وردية (`production.html`) — supervisor.
- صفحة سجل التوقفات (صيانة / نقص خامة / نقص عمالة) (`downtime.html`) — supervisor.
- ربط شيت "معدلات_التشغيل" اللي عملناه في الإكسل بصفحة عمليات كل عيلة، عشان
  حاسبة الماكينات والعمالة تشتغل فعليًا جوه الموقع (`calc.js` جاهز للمنطق، ناقصه
  بس ربط زمن التشغيل الحقيقي لكل صنف/عملية).
