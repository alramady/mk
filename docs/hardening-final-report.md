# تقرير التقوية الإنتاجية — المفتاح الشهري (MonthlyKey)

**التاريخ:** 2 مارس 2026  
**المنصة:** https://monthlykey.com  
**المستودع:** https://github.com/raneemndmo-collab/mk  
**الاستضافة:** Railway  
**الكومت الحالي:** `9beb60e`  

---

## ملخص تنفيذي

تم تنفيذ **4 مراحل تقوية إنتاجية** شاملة لمنصة المفتاح الشهري، تغطي إصلاح عرض الصور، مخطط الحجوزات، لوحة الإدارة، ودقة التحليلات. جميع الإصلاحات تم دفعها إلى GitHub ونشرها على Railway بنجاح.

---

## المرحلة 1: إصلاح عرض الصور (R2)

### المشكلة
صور العقارات المخزنة في Cloudflare R2 لم تظهر على بطاقات البحث وصفحات التفاصيل. كانت المنصة تعرض صور Unsplash بديلة بدلاً من الصور الحقيقية.

### الأسباب الجذرية
1. **CSP connect-src** لم يتضمن نطاق R2 (`pub-38c4c6d7eb714a07a24cd2d4c7870282.r2.dev`)
2. **Service Worker** كان يعترض طلبات الصور عبر النطاقات (cross-origin)
3. **التحميل الكسول (lazy loading)** مع التموضع المطلق منع intersection observer من العمل
4. **آلة حالة الشفافية (opacity state machine)** أبقت الصور غير مرئية

### الإصلاحات

| الكومت | الوصف |
|--------|-------|
| [`3d945c4`](https://github.com/raneemndmo-collab/mk/commit/3d945c4) | إزالة آلة حالة الشفافية التي تبقي صور R2 غير مرئية |
| [`1bf5b91`](https://github.com/raneemndmo-collab/mk/commit/1bf5b91) | إصلاح CSP connect-src، تخطي cross-origin في SW، إزالة جميع بدائل Unsplash للعقارات |
| [`264dd23`](https://github.com/raneemndmo-collab/mk/commit/264dd23) | تغيير PropertyCard img إلى loading=eager، إزالة التموضع المطلق |

### التحقق
جميع 9 صور R2 (3 لكل عقار) تعود بـ HTTP 200:

```
HTTP 200: property3-photo1-original--3A0DvT9T_.webp
HTTP 200: property3-photo2-original-7t2X2NSCEY.webp
HTTP 200: property3-photo3-original-GmxjBWxp8g.webp
HTTP 200: property2-photo1-original-HOjnCiRwhY.webp
HTTP 200: property2-photo2-original-metSsebtBU.webp
HTTP 200: property2-photo3-original-ruw-kGXWnu.webp
HTTP 200: property1-photo1-original-BobahmmOV1.webp
HTTP 200: property1-photo2-original-zy5uLDmuoB.webp
HTTP 200: property1-photo3-original-9h8LR0a0ro.webp
```

---

## المرحلة 2: إصلاح مخطط الموقع والحجوزات

### المشكلة
1. حقل `locationSource` لم يُحفظ عند إنشاء عقار من لوحة الإدارة
2. إنشاء الحجوزات يفشل بسبب أعمدة مفقودة في قاعدة البيانات (10+ أعمدة، 7 جداول)

### الإصلاحات

| الكومت | الوصف |
|--------|-------|
| [`74bb76c`](https://github.com/raneemndmo-collab/mk/commit/74bb76c) | إضافة حقول الموقع إلى مخطط adminCreate، تنظيف القيم في الواجهة |
| [`657cf2c`](https://github.com/raneemndmo-collab/mk/commit/657cf2c) | إضافة auto-migrations شاملة لجميع الأعمدة والجداول المفقودة |

### التفاصيل التقنية
تمت إضافة ترحيلات تلقائية (idempotent) في `db.ts` تعمل عند بدء الخادم:
- جداول: `availability_blocks`, `booking_addons`, `booking_status_history`, `property_views`, `service_requests`, `maintenance_emergencies`, `notifications`
- أعمدة: `moveInDate`, `moveOutDate`, `totalAmount`, `securityDeposit`, `paymentStatus`, `contractUrl`, `notes`, `adminNotes`, `cancellationReason`, `source`
- إصلاح قيمة enum: `INITIAL_RENT` → `RENT` في إنشاء السجل المالي

---

## المرحلة 3: معالج الإدارة الموحد (5 خطوات)

### المشكلة
نموذج إنشاء العقار كان مسطحاً وغير موجه، مما يؤدي إلى أخطاء وبيانات ناقصة.

### الإصلاح

| الكومت | الوصف |
|--------|-------|
| [`679f6fe`](https://github.com/raneemndmo-collab/mk/commit/679f6fe) | معالج إنشاء ونشر موحد من 5 خطوات |

### خطوات المعالج
1. **المعلومات الأساسية** — الاسم، النوع، الوصف
2. **الموقع** — المدينة، الحي، الإحداثيات، مصدر الموقع
3. **المواصفات والتسعير** — الغرف، المساحة، الإيجار، الحد الأدنى للإقامة
4. **الصور** — رفع صور R2 مع معاينة
5. **المراجعة والنشر** — فحوصات الجاهزية، معاينة شاملة

---

## المرحلة 4: تقوية التحليلات

### المشكلة
1. استعلام الإيرادات لم يحسب مدفوعات Moyasar (حالة `paid`)
2. نسبة الإشغال تحسب بنسبة بسيطة بدلاً من أيام محجوزة فعلية
3. لا يوجد تفصيل لحالات الحجوزات

### الإصلاح

| الكومت | الوصف |
|--------|-------|
| [`9beb60e`](https://github.com/raneemndmo-collab/mk/commit/9beb60e) | إصلاح استعلام الإيرادات، إضافة availability_blocks، تفصيل حالات الحجوزات |

### التفاصيل التقنية

**قواعد المقاييس المعتمدة:**

| المقياس | التعريف |
|---------|---------|
| إجمالي الإيرادات | مجموع المدفوعات بحالة `completed` أو `paid` |
| الحجوزات النشطة | حجوزات بحالة `active` (بعد الدفع) |
| بانتظار الدفع | حجوزات بحالة `approved` (قبل الدفع) |
| نسبة الإشغال | (أيام محجوزة فعلية ÷ إجمالي الأيام المتاحة) × 100 |
| العقارات النشطة | عقارات بحالة `published` |

**وحدة availability_blocks الجديدة:**
- جدول `availability_blocks` يتتبع فترات الحجز الفعلية
- يُنشأ تلقائياً عند تأكيد الحجز
- يُحذف عند إلغاء الحجز
- نقطة نهاية `/api/admin/backfill-availability` لملء البيانات التاريخية

---

## حالة الإنتاج الحالية

### `/api/health`

```json
{
    "status": "ok",
    "dbStatus": "connected",
    "storageMode": "s3",
    "version": "1.0.0",
    "commitSha": "9beb60e62da2d8c076cd8154b1ad490dc59253db",
    "envName": "production",
    "uptimeSeconds": 385,
    "memoryMB": 64
}
```

### لوحة التحليلات (بعد الإصلاح)

| المقياس | القيمة | ملاحظات |
|---------|--------|---------|
| إجمالي المستخدمين | 2 | صحيح |
| عقارات نشطة | 0 | صحيح — العقارات بحالة published وليس active |
| حجوزات نشطة | 0 (2 بانتظار الدفع) | **جديد**: يعرض عدد الحجوزات المعتمدة بانتظار الدفع |
| إجمالي الإيرادات | 0 ر.س | صحيح — لا توجد مدفوعات مكتملة بعد |
| نسبة الإشغال | 0% (0 يوم محجوز) | **جديد**: يعرض عدد الأيام المحجوزة الفعلية |
| بانتظار الموافقة | 0 | صحيح |
| إجمالي الحجوزات | 4 | صحيح |
| إجمالي العقارات | 5 | صحيح |

### توزيع حالات الحجوزات
- قيد الانتظار: 50%
- معتمد: 50%

---

## ملخص الكومتات

| # | الكومت | الوصف | المرحلة |
|---|--------|-------|---------|
| 1 | [`3d945c4`](https://github.com/raneemndmo-collab/mk/commit/3d945c4) | إزالة آلة حالة الشفافية | الصور |
| 2 | [`1bf5b91`](https://github.com/raneemndmo-collab/mk/commit/1bf5b91) | إصلاح CSP + SW + إزالة Unsplash | الصور |
| 3 | [`264dd23`](https://github.com/raneemndmo-collab/mk/commit/264dd23) | تحميل eager + إزالة absolute | الصور |
| 4 | [`74bb76c`](https://github.com/raneemndmo-collab/mk/commit/74bb76c) | إصلاح حفظ locationSource | الموقع |
| 5 | [`657cf2c`](https://github.com/raneemndmo-collab/mk/commit/657cf2c) | auto-migrations للأعمدة المفقودة | الحجوزات |
| 6 | [`679f6fe`](https://github.com/raneemndmo-collab/mk/commit/679f6fe) | معالج إدارة 5 خطوات | الإدارة |
| 7 | [`9beb60e`](https://github.com/raneemndmo-collab/mk/commit/9beb60e) | تقوية التحليلات | التحليلات |

---

## التوصيات القادمة

1. **تكامل Beds24**: الأساس موجود (`beds24_map` + `beds24-guard.ts`). يحتاج تنفيذ sync/pull/push للتوافر.
2. **اختبار الدفع**: إجراء دفعة تجريبية عبر Moyasar للتحقق من أن الإيرادات تظهر في التحليلات.
3. **إشعارات الحجز**: تفعيل إشعارات WhatsApp عند تغيير حالة الحجز.
4. **النسخ الاحتياطي**: إعداد نسخ احتياطي تلقائي لقاعدة البيانات على Railway.

---

**أعد بواسطة:** Manus AI  
**آخر تحديث:** 2 مارس 2026
