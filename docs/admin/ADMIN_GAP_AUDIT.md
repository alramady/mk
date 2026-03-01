# تدقيق الفجوات الإدارية — Admin Gap Audit

> هذا المستند يوثق حالة كل عنصر في خريطة الإدارة: مكتمل / جزئي / مفقود، مع تحديد الملفات والمسارات المطلوبة للتنفيذ.
> This document records the status of each Admin Map item: COMPLETE / PARTIAL / MISSING, with exact files/routes needed.

---

## A) لوحة التحكم — Dashboard (`/admin`)

| الحقل / Field | القيمة / Value |
|---|---|
| **الحالة / Status** | **جزئي — PARTIAL** |
| **الموجود / Exists** | صفحة AdminDashboard.tsx (876 سطر). تعرض: إحصائيات أساسية، قائمة الحجوزات مع موافقة/رفض، عدد العقارات والمستخدمين. — AdminDashboard.tsx (876 lines). Shows: basic stats, bookings list with approve/reject, property/user counts. |
| **المفقود / Missing** | KPIs مالية: PAR (الإيرادات لكل وحدة متاحة)، المحصّل سنوياً (YTD)، المدفوعات المستحقة، معدل الإشغال من جدول الوحدات. — Financial KPIs: PAR (revenue per available unit), collected YTD, due payments, occupancy rate from units table. |
| **الملفات المطلوبة / Files** | تعديل `client/src/pages/AdminDashboard.tsx` — إضافة بطاقات KPI مالية. تعديل `server/routers.ts` → `admin.stats` لإضافة بيانات مالية. |
| **التخطيط / Layout** | يستخدم Navbar/Footer بدلاً من DashboardLayout ❌ — يحتاج تحويل. |

---

## B) إدارة العقارات — Properties (`/admin/properties`)

| الحقل / Field | القيمة / Value |
|---|---|
| **الحالة / Status** | **جزئي — PARTIAL** |
| **الموجود / Exists** | AdminProperties.tsx (439 سطر) + AdminPropertyEdit.tsx (566 سطر). يستخدم DashboardLayout ✅. إنشاء/تعديل/عرض. رفع صور. حالات: مسودة/قيد المراجعة/نشط/غير نشط. |
| **المفقود / Missing** | 1) إعادة ترتيب الصور (drag & drop). 2) تعيين صورة غلاف. 3) حارس النشر (PricingSource guard). 4) ربط عقار ↔ وحدة. 5) رابط معاينة الصفحة العامة. 6) حالة "منشور" و"مؤرشف" في واجهة التعديل (تم إصلاح enum الخادم). |
| **الملفات المطلوبة / Files** | تعديل `AdminProperties.tsx` و `AdminPropertyEdit.tsx`. تعديل `server/submission-routers.ts` → `adminUpdateProperty`. |

---

## C) طلبات إضافة عقار — Submissions (`/admin/submissions`)

| الحقل / Field | القيمة / Value |
|---|---|
| **الحالة / Status** | **جزئي — PARTIAL** |
| **الموجود / Exists** | AdminSubmissions.tsx (390 سطر). يستخدم DashboardLayout ✅. عرض الطلبات + الصور. تعديل الحالة. تحويل إلى عقار (تم إصلاح الخلل). ملاحظات داخلية. |
| **المفقود / Missing** | 1) خط أنابيب الحالة المرئي (NEW→CONTACTED→APPROVED→REJECTED). 2) التحويل ينشئ عقار بحالة مسودة (تم التحقق ✅). |
| **الملفات المطلوبة / Files** | تعديل طفيف على `AdminSubmissions.tsx` لتحسين عرض خط الأنابيب. |

---

## D) المباني والوحدات — Buildings & Units (`/admin/buildings`)

| الحقل / Field | القيمة / Value |
|---|---|
| **الحالة / Status** | **جزئي — PARTIAL** |
| **الموجود / Exists** | AdminBuildings.tsx (611 سطر) + AdminUnitFinance.tsx (743 سطر). إنشاء/تعديل/أرشفة المباني. إنشاء/تعديل الوحدات. بطاقة مالية للوحدة. سجل مالي. |
| **المفقود / Missing** | 1) **غير موجود في الشريط الجانبي** ❌. 2) يستخدم Navbar/Footer بدلاً من DashboardLayout ❌. 3) حالة الوحدة (AVAILABLE/BLOCKED/MAINTENANCE) — يحتاج تحقق. |
| **الملفات المطلوبة / Files** | إضافة إلى `DashboardLayout.tsx` sidebar. تحويل layout إلى DashboardLayout. |

---

## E) الحجوزات — Bookings

| الحقل / Field | القيمة / Value |
|---|---|
| **الحالة / Status** | **مفقود — MISSING** (كصفحة مستقلة) |
| **الموجود / Exists** | الحجوزات مدمجة في AdminDashboard فقط. الخادم يدعم: `admin.bookings`, `admin.approveBooking`, `admin.rejectBooking`, `admin.confirmPayment`. |
| **المفقود / Missing** | **صفحة مستقلة** `/admin/bookings` مع: تصفية حسب الحالة، تفاصيل كاملة، ربط بالعقار/الوحدة، حالة الدفع/السجل لكل حجز. إدخال في الشريط الجانبي. |
| **الملفات المطلوبة / Files** | إنشاء `client/src/pages/AdminBookings.tsx`. إضافة route في `App.tsx`. إضافة إلى `DashboardLayout.tsx` sidebar. |

---

## F) المدفوعات والسجل المالي — Payments & Ledger (`/admin/payments`)

| الحقل / Field | القيمة / Value |
|---|---|
| **الحالة / Status** | **جزئي — PARTIAL** |
| **الموجود / Exists** | AdminPayments.tsx (355 سطر). يعرض قائمة المدفوعات. الخادم يدعم: `finance.ledger.search`, `finance.ledger.create`, `finance.ledger.createAdjustment`, `finance.ledger.kpis`. |
| **المفقود / Missing** | 1) **غير موجود في الشريط الجانبي** ❌. 2) يستخدم Navbar/Footer ❌. 3) تصدير CSV. 4) إيصالات. 5) عمليات الاسترداد/التعديل من الواجهة. |
| **الملفات المطلوبة / Files** | إضافة إلى `DashboardLayout.tsx` sidebar. تحويل layout. إضافة CSV export + receipt generation. |

---

## G) التكاملات — Integrations (`/admin/integrations`)

| الحقل / Field | القيمة / Value |
|---|---|
| **الحالة / Status** | **جزئي — PARTIAL** |
| **الموجود / Exists** | AdminIntegrations.tsx (270 سطر). يستخدم DashboardLayout ✅. عرض التكاملات + تعديل الإعدادات + أزرار اختبار. شارات الحالة. |
| **المفقود / Missing** | 1) إخفاء المفاتيح السرية (masking). 2) عرض سجل التدقيق لكل تكامل. 3) عرض آخر اختبار + أخطاء معقمة. |
| **الملفات المطلوبة / Files** | تعديل `AdminIntegrations.tsx`. |

---

## H) إعدادات الموقع — Settings (`/admin/settings`)

| الحقل / Field | القيمة / Value |
|---|---|
| **الحالة / Status** | **جزئي — PARTIAL** |
| **الموجود / Exists** | AdminSettings.tsx (2222 سطر). تبويبات: عام، بطل، إحصائيات، رسوم، تذييل، قانوني، صلاحيات، تحليلات، مدن، أحياء، خدمات، صفحة رئيسية، دفع، واتساب، مدراء، معاينات، أسئلة شائعة، صيانة. رفع الشعار موجود. شروط الاستخدام (عربي/إنجليزي) موجودة. |
| **المفقود / Missing** | 1) **لا يستخدم DashboardLayout** ❌ (يستخدم تخطيط مخصص). 2) إصدارات الشروط (versioning). 3) سجل قبول الشروط (acceptance records). |
| **الملفات المطلوبة / Files** | تعديل `AdminSettings.tsx` لإضافة versioning + acceptance. قد يحتاج جدول DB جديد `terms_versions`. |

---

## I) الموظفين والصلاحيات — Staff & RBAC (`/admin/permissions`)

| الحقل / Field | القيمة / Value |
|---|---|
| **الحالة / Status** | **جزئي — PARTIAL** |
| **الموجود / Exists** | AdminPermissions.tsx (381 سطر). إدارة صلاحيات المستخدمين. الخادم يدعم: `permissions.list`, `permissions.update`, `roles.list`, `roles.create`. |
| **المفقود / Missing** | 1) **غير موجود في الشريط الجانبي** ❌. 2) يستخدم Navbar/Footer ❌. 3) عارض سجل التدقيق (audit log viewer). 4) إدارة الأدوار من الواجهة (CRUD). |
| **الملفات المطلوبة / Files** | إضافة إلى `DashboardLayout.tsx` sidebar. تحويل layout. إضافة audit log viewer. |

---

## J) واتساب — WhatsApp (`/admin/whatsapp`)

| الحقل / Field | القيمة / Value |
|---|---|
| **الحالة / Status** | **مؤجل — DEFERRED** |
| **الموجود / Exists** | AdminWhatsApp.tsx (547 سطر). موجود في الشريط الجانبي. إرسال رسائل + سجل. |
| **المفقود / Missing** | لا شيء حرج — مؤجل حسب الطلب. |
| **الملفات المطلوبة / Files** | لا يوجد. |

---

## K) مديرو العقارات — Managers (`/admin/managers`)

| الحقل / Field | القيمة / Value |
|---|---|
| **الحالة / Status** | **جزئي — PARTIAL** |
| **الموجود / Exists** | AdminManagers.tsx (472 سطر). موجود في الشريط الجانبي. إنشاء/تعديل/أرشفة. تعيين العقارات. |
| **المفقود / Missing** | 1) يستخدم Navbar/Footer بدلاً من DashboardLayout ❌. |
| **الملفات المطلوبة / Files** | تحويل layout إلى DashboardLayout. |

---

## L-N) الخدمات، طوارئ الصيانة، التحليلات — Services, Emergency, Analytics

| القسم / Section | الحالة / Status | المفقود / Missing |
|---|---|---|
| الخدمات / Services | **جزئي — PARTIAL** | يستخدم Navbar/Footer ❌. يحتاج تحويل layout. |
| طوارئ الصيانة / Emergency | **جزئي — PARTIAL** | يستخدم Navbar/Footer ❌. يحتاج تحويل layout. |
| التحليلات / Analytics | **جزئي — PARTIAL** | يستخدم Navbar/Footer ❌. يحتاج تحويل layout. |

---

## O) المدن والأحياء — Cities (`/admin/cities`)

| الحقل / Field | القيمة / Value |
|---|---|
| **الحالة / Status** | **مكتمل — COMPLETE** |
| **الموجود / Exists** | CityDistrictManagement.tsx. موجود في الشريط الجانبي. CRUD كامل. |
| **المفقود / Missing** | لا شيء. |

---

## P) حالة قاعدة البيانات — DB Status (`/admin/db-status`)

| الحقل / Field | القيمة / Value |
|---|---|
| **الحالة / Status** | **مكتمل — COMPLETE** |
| **الموجود / Exists** | AdminDbStatus.tsx (323 سطر). يستخدم DashboardLayout ✅. عرض صحة DB + ترحيلات + أعمدة. |
| **المفقود / Missing** | لا شيء. |

---

## ملخص الفجوات — Gap Summary

| القسم / Section | الحالة / Status | الأولوية / Priority |
|---|---|---|
| Dashboard | جزئي — PARTIAL | P2 |
| Properties | جزئي — PARTIAL | P1 |
| Submissions | جزئي — PARTIAL | P3 (معظمه يعمل) |
| Buildings & Units | جزئي — PARTIAL | P1 (غير موجود في sidebar) |
| **Bookings** | **مفقود — MISSING** | **P1** |
| Payments & Ledger | جزئي — PARTIAL | P1 (غير موجود في sidebar) |
| Integrations | جزئي — PARTIAL | P2 |
| Settings | جزئي — PARTIAL | P3 |
| Staff & RBAC | جزئي — PARTIAL | P2 (غير موجود في sidebar) |
| WhatsApp | مؤجل — DEFERRED | — |
| Managers | جزئي — PARTIAL | P2 (layout فقط) |
| Services | جزئي — PARTIAL | P2 (layout فقط) |
| Emergency | جزئي — PARTIAL | P2 (layout فقط) |
| Analytics | جزئي — PARTIAL | P2 (layout فقط) |
| Cities | مكتمل — COMPLETE | — |
| DB Status | مكتمل — COMPLETE | — |

### المشكلة الرئيسية — Main Issue

**11 من 16 صفحة إدارية تستخدم Navbar/Footer بدلاً من DashboardLayout.** هذا يعني أن الشريط الجانبي غير مرئي في معظم الصفحات. الإصلاح الأول والأهم هو تحويل جميع الصفحات لاستخدام DashboardLayout.

**11 of 16 admin pages use Navbar/Footer instead of DashboardLayout.** This means the sidebar is not visible on most pages. The first and most important fix is converting all pages to use DashboardLayout.

---

**آخر تحديث / Last Updated:** 2026-02-28
**المؤلف / Author:** the platform
