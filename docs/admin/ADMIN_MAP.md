# خريطة لوحة التحكم الإدارية — Admin Control Panel Map

> هذا المستند يحدد جميع أقسام لوحة التحكم المطلوبة، المسارات، الصلاحيات، وعمليات CRUD.
> This document defines all required admin panel sections, routes, permissions, and CRUD operations.

---

## A) لوحة التحكم — Dashboard

| الحقل / Field | القيمة / Value |
|---|---|
| **المسار / Route** | `/admin` |
| **الغرض / Purpose** | ملخص KPIs: الإشغال، PAR، المحصّل سنوياً، المدفوعات المستحقة، الموافقات المعلقة — KPI summary: occupancy, PAR, collected YTD, due payments, pending approvals |
| **عمليات CRUD** | قراءة فقط (R) — Read only |
| **الصلاحية / Permission** | `view_analytics` |
| **الجداول / Tables** | `bookings`, `payments`, `payment_ledger`, `properties`, `units`, `property_submissions` |
| **حالة الإطلاق / Launch Status** | **مطلوب — REQUIRED** |
| **ملاحظات / Notes** | يعرض حالياً الحجوزات + إحصائيات أساسية. يحتاج إضافة KPIs مالية (PAR, YTD). — Currently shows bookings + basic stats. Needs financial KPIs (PAR, YTD). |

---

## B) إدارة العقارات — Properties

| الحقل / Field | القيمة / Value |
|---|---|
| **المسار / Route** | `/admin/properties`, `/admin/properties/:id/edit` |
| **الغرض / Purpose** | إنشاء/تعديل/أرشفة العقارات، سير عمل النشر، رفع الصور، مصدر التسعير — Create/Edit/Archive properties, publish workflow, photo upload, pricing source |
| **عمليات CRUD** | إنشاء (C), قراءة (R), تعديل (U), أرشفة (D) — Create, Read, Update, Archive |
| **الصلاحية / Permission** | `manage_properties` |
| **الجداول / Tables** | `properties` |
| **حالة الإطلاق / Launch Status** | **مطلوب — REQUIRED** |
| **ملاحظات / Notes** | سير العمل: مسودة → قيد المراجعة → منشور → مؤرشف. يحتاج: إعادة ترتيب الصور، صورة الغلاف، حارس النشر (PricingSource). — Workflow: DRAFT→PENDING→PUBLISHED→ARCHIVED. Needs: photo reorder, cover photo, publish guard (PricingSource). |

---

## C) طلبات إضافة عقار (العملاء المحتملين) — Owner Submissions (Leads)

| الحقل / Field | القيمة / Value |
|---|---|
| **المسار / Route** | `/admin/submissions` |
| **الغرض / Purpose** | عرض الطلبات + الصور، خط أنابيب الحالة، ملاحظات داخلية، تحويل إلى عقار — View submissions + photos, status pipeline, internal notes, convert to property |
| **عمليات CRUD** | قراءة (R), تعديل الحالة (U), تحويل (Convert) — Read, Update status, Convert |
| **الصلاحية / Permission** | `manage_properties` |
| **الجداول / Tables** | `property_submissions`, `submission_photos`, `properties` |
| **حالة الإطلاق / Launch Status** | **مطلوب — REQUIRED** |
| **ملاحظات / Notes** | خط الأنابيب: جديد → تم التواصل → موافق → مرفوض. التحويل ينشئ عقار بحالة مسودة. — Pipeline: NEW→CONTACTED→APPROVED→REJECTED. Convert creates DRAFT property. |

---

## D) المباني والوحدات — Buildings & Units

| الحقل / Field | القيمة / Value |
|---|---|
| **المسار / Route** | `/admin/buildings`, `/admin/buildings/:id`, `/admin/units/:id` |
| **الغرض / Purpose** | إنشاء/تعديل/أرشفة المباني والوحدات، حالة الوحدة، بطاقة مالية، قائمة السجل — Create/Edit/Archive buildings & units, unit status, finance card, ledger list |
| **عمليات CRUD** | إنشاء (C), قراءة (R), تعديل (U), أرشفة (D) — Create, Read, Update, Archive |
| **الصلاحية / Permission** | `manage_properties` |
| **الجداول / Tables** | `buildings`, `units`, `unit_daily_status`, `payment_ledger` |
| **حالة الإطلاق / Launch Status** | **مطلوب — REQUIRED** |
| **ملاحظات / Notes** | حالات الوحدة: متاح/محجوز/صيانة. البطاقة المالية تعرض ملخص الإيرادات والمصروفات. — Unit status: AVAILABLE/BLOCKED/MAINTENANCE. Finance card shows revenue/expense summary. |

---

## E) الحجوزات — Bookings

| الحقل / Field | القيمة / Value |
|---|---|
| **المسار / Route** | `/admin/bookings` (مطلوب إنشاؤه — needs creation) |
| **الغرض / Purpose** | عرض جميع الحجوزات، تصفية حسب الحالة، سير عمل الموافقة/الرفض، ربط بالعقار/الوحدة — View all bookings, filter by status, approve/reject workflow, link to property/unit |
| **عمليات CRUD** | قراءة (R), موافقة/رفض (U) — Read, Approve/Reject (Update) |
| **الصلاحية / Permission** | `manage_bookings` |
| **الجداول / Tables** | `bookings`, `properties`, `units`, `payment_ledger` |
| **حالة الإطلاق / Launch Status** | **مطلوب — REQUIRED** |
| **ملاحظات / Notes** | حالياً مدمج في لوحة التحكم فقط. يحتاج صفحة مستقلة مع تصفية وتفاصيل كاملة. — Currently embedded in dashboard only. Needs standalone page with filtering and full details. |

---

## F) المدفوعات والسجل المالي — Payments & Ledger

| الحقل / Field | القيمة / Value |
|---|---|
| **المسار / Route** | `/admin/payments` |
| **الغرض / Purpose** | سجل مالي كامل، استرداد/تعديل (إلحاق فقط)، تصدير CSV، إيصالات — Full ledger registry, refund/adjustment (append-only), CSV export, receipts |
| **عمليات CRUD** | قراءة (R), إنشاء تعديل/استرداد (C), تصدير (Export) — Read, Create adjustment/refund, Export |
| **الصلاحية / Permission** | `manage_payments` |
| **الجداول / Tables** | `payment_ledger`, `payments`, `payment_method_settings` |
| **حالة الإطلاق / Launch Status** | **مطلوب — REQUIRED** |
| **ملاحظات / Notes** | الصفحة موجودة لكن تحتاج: تصدير CSV، إيصالات، عمليات الاسترداد/التعديل. — Page exists but needs: CSV export, receipts, refund/adjustment operations. |

---

## G) التكاملات — Integrations (API Keys + Test)

| الحقل / Field | القيمة / Value |
|---|---|
| **المسار / Route** | `/admin/integrations` |
| **الغرض / Purpose** | إعداد واختبار: Beds24, Moyasar, البريد, الخرائط. شارات الحالة، آخر اختبار، أخطاء معقمة — Config + test: Beds24, Moyasar, Email, Maps. Status badges, last tested, sanitized errors |
| **عمليات CRUD** | قراءة (R), تعديل الإعدادات (U), اختبار (Test) — Read, Update config, Test |
| **الصلاحية / Permission** | `manage_settings` |
| **الجداول / Tables** | `integration_configs`, `audit_log` |
| **حالة الإطلاق / Launch Status** | **مطلوب — REQUIRED** |
| **ملاحظات / Notes** | الصفحة موجودة مع أزرار اختبار. يحتاج: إخفاء المفاتيح، سجل تدقيق. — Page exists with test buttons. Needs: mask secrets, audit log display. |

---

## H) إعدادات الموقع — Site Settings

| الحقل / Field | القيمة / Value |
|---|---|
| **المسار / Route** | `/admin/settings` |
| **الغرض / Purpose** | رفع الشعار، شروط الاستخدام (عربي/إنجليزي) + إصدارات + سجل القبول، محتوى التذييل، معلومات الاتصال — Logo upload, Terms of Use (AR/EN) + versioning + acceptance records, footer content, contact info |
| **عمليات CRUD** | قراءة (R), تعديل (U) — Read, Update |
| **الصلاحية / Permission** | `manage_settings` |
| **الجداول / Tables** | `platformSettings` |
| **حالة الإطلاق / Launch Status** | **مطلوب — REQUIRED** |
| **ملاحظات / Notes** | الصفحة موجودة (2222 سطر) مع تبويبات متعددة: عام، بطل، إحصائيات، رسوم، تذييل، قانوني، إلخ. رفع الشعار موجود. الشروط تحتاج: إصدارات + سجل قبول. — Page exists (2222 lines) with multiple tabs. Logo upload exists. Terms need: versioning + acceptance records. |

---

## I) الموظفين والصلاحيات — Staff & RBAC

| الحقل / Field | القيمة / Value |
|---|---|
| **المسار / Route** | `/admin/permissions` |
| **الغرض / Purpose** | إدارة المستخدمين الإداريين، إدارة الأدوار/الصلاحيات، عارض سجل التدقيق — Staff users CRUD, roles/permissions management, audit log viewer |
| **عمليات CRUD** | إنشاء (C), قراءة (R), تعديل (U), حذف (D) — Create, Read, Update, Delete |
| **الصلاحية / Permission** | `manage_roles`, `manage_users` |
| **الجداول / Tables** | `users`, `adminPermissions`, `roles`, `audit_log` |
| **حالة الإطلاق / Launch Status** | **مطلوب — REQUIRED** |
| **ملاحظات / Notes** | صفحة الصلاحيات موجودة. الأدوار موجودة في الخادم. يحتاج: عارض سجل التدقيق مدمج أو صفحة مستقلة. — Permissions page exists. Roles exist on server. Needs: audit log viewer integrated or standalone. |

---

## J) الإشعارات / واتساب — Notifications / WhatsApp

| الحقل / Field | القيمة / Value |
|---|---|
| **المسار / Route** | `/admin/whatsapp` |
| **الغرض / Purpose** | إرسال رسائل واتساب، قوالب، سجل الرسائل — Send WhatsApp messages, templates, message log |
| **عمليات CRUD** | إنشاء (C), قراءة (R) — Create, Read |
| **الصلاحية / Permission** | `send_notifications` |
| **الجداول / Tables** | `whatsapp_messages`, `notifications` |
| **حالة الإطلاق / Launch Status** | **مؤجل — DEFERRED** |
| **ملاحظات / Notes** | موجود في الشريط الجانبي. يبقى مؤجلاً ما لم يكن مطلوباً للإطلاق. — Exists in sidebar. Stays DEFERRED unless needed for launch. |

---

## K) مديرو العقارات — Property Managers

| الحقل / Field | القيمة / Value |
|---|---|
| **المسار / Route** | `/admin/managers` |
| **الغرض / Purpose** | إنشاء/تعديل/أرشفة مديري العقارات، تعيين العقارات — Create/Edit/Archive property managers, assign properties |
| **عمليات CRUD** | إنشاء (C), قراءة (R), تعديل (U), أرشفة (D) — Create, Read, Update, Archive |
| **الصلاحية / Permission** | `manage_properties` |
| **الجداول / Tables** | `propertyManagers`, `propertyManagerAssignments` |
| **حالة الإطلاق / Launch Status** | **مطلوب — REQUIRED** |
| **ملاحظات / Notes** | موجود في الشريط الجانبي والخادم. — Exists in sidebar and server. |

---

## L) الخدمات — Services

| الحقل / Field | القيمة / Value |
|---|---|
| **المسار / Route** | `/admin/services` |
| **الغرض / Purpose** | إدارة خدمات المنصة (تنظيف، صيانة، إلخ) — Manage platform services (cleaning, maintenance, etc.) |
| **عمليات CRUD** | إنشاء (C), قراءة (R), تعديل (U), أرشفة (D) — Create, Read, Update, Archive |
| **الصلاحية / Permission** | `manage_services` |
| **الجداول / Tables** | `platform_services`, `service_requests` |
| **حالة الإطلاق / Launch Status** | **مطلوب — REQUIRED** |
| **ملاحظات / Notes** | موجود في الشريط الجانبي. — Exists in sidebar. |

---

## M) طوارئ الصيانة — Emergency Maintenance

| الحقل / Field | القيمة / Value |
|---|---|
| **المسار / Route** | `/admin/emergency-maintenance` |
| **الغرض / Purpose** | إدارة طلبات الصيانة الطارئة — Manage emergency maintenance requests |
| **عمليات CRUD** | قراءة (R), تعديل الحالة (U) — Read, Update status |
| **الصلاحية / Permission** | `manage_maintenance` |
| **الجداول / Tables** | `emergency_maintenance`, `maintenance_updates` |
| **حالة الإطلاق / Launch Status** | **مطلوب — REQUIRED** |
| **ملاحظات / Notes** | موجود في الشريط الجانبي. — Exists in sidebar. |

---

## N) التحليلات — Analytics

| الحقل / Field | القيمة / Value |
|---|---|
| **المسار / Route** | `/admin/analytics` |
| **الغرض / Purpose** | تحليلات الاستخدام والأداء — Usage and performance analytics |
| **عمليات CRUD** | قراءة فقط (R) — Read only |
| **الصلاحية / Permission** | `view_analytics` |
| **الجداول / Tables** | `userActivities`, `bookings`, `payments` |
| **حالة الإطلاق / Launch Status** | **مطلوب — REQUIRED** |
| **ملاحظات / Notes** | موجود في الشريط الجانبي. — Exists in sidebar. |

---

## O) المدن والأحياء — Cities & Districts

| الحقل / Field | القيمة / Value |
|---|---|
| **المسار / Route** | `/admin/cities` |
| **الغرض / Purpose** | إدارة المدن والأحياء المدعومة — Manage supported cities and districts |
| **عمليات CRUD** | إنشاء (C), قراءة (R), تعديل (U), حذف (D) — Create, Read, Update, Delete |
| **الصلاحية / Permission** | `manage_cities` |
| **الجداول / Tables** | `cities`, `districts` |
| **حالة الإطلاق / Launch Status** | **مطلوب — REQUIRED** |
| **ملاحظات / Notes** | موجود في الشريط الجانبي. — Exists in sidebar. |

---

## P) حالة قاعدة البيانات — Database Status

| الحقل / Field | القيمة / Value |
|---|---|
| **المسار / Route** | `/admin/db-status` |
| **الغرض / Purpose** | مراقبة صحة قاعدة البيانات، الترحيلات، الأعمدة — Monitor DB health, migrations, columns |
| **عمليات CRUD** | قراءة فقط (R) — Read only |
| **الصلاحية / Permission** | `manage_settings` |
| **الجداول / Tables** | `__drizzle_migrations`, information_schema |
| **حالة الإطلاق / Launch Status** | **مطلوب — REQUIRED** |
| **ملاحظات / Notes** | موجود في الشريط الجانبي. أداة تشخيص مفيدة. — Exists in sidebar. Useful diagnostic tool. |

---

## المسارات المطلوب إزالتها أو حظرها — Routes to Remove or Block

هذه المسارات موجودة كـ routes لكن **ليست** في الشريط الجانبي ولا في خريطة الإدارة أعلاه. يجب إزالتها أو إعادة توجيهها.
These routes exist but are **not** in the sidebar or the admin map above. They should be removed or redirected.

| المسار / Route | الحالة / Status | الإجراء / Action |
|---|---|---|
| `/admin/ai-control` | غير مطلوب — Not required | إزالة أو حظر — Remove or block |
| `/admin/ai-copilot` | غير مطلوب — Not required | إزالة أو حظر — Remove or block |
| `/admin/ai-ratings` | غير مطلوب — Not required | إزالة أو حظر — Remove or block |
| `/admin/help-center` | غير مطلوب — Not required | إزالة أو حظر — Remove or block |
| `/admin/my-account` | حساب المستخدم — User account | يبقى كصفحة فرعية بدون sidebar — Keep as sub-page without sidebar entry |
| `/admin/knowledge-base` | مكرر مع hardening — Duplicate with hardening | دمج أو إزالة — Merge or remove |
| `/admin/hardening` | تقوية الإنتاج — Production hardening | يبقى (Root Admin فقط) — Keep (Root Admin only) |

---

**آخر تحديث / Last Updated:** 2026-02-28
**المؤلف / Author:** the platform
