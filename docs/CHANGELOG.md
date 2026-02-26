# Documentation Changelog / سجل تغييرات التوثيق

> This file tracks all changes to the Knowledge Base, Manuals, and internal documentation.
> يتتبع هذا الملف جميع التغييرات على قاعدة المعرفة والأدلة والتوثيق الداخلي.

---

## [1.0.0] — 2026-02-27

### Added / تمت الإضافة
- Initial bilingual Knowledge Base (10 topics in AR + EN)
- Copilot User Guide (AR + EN)
- Staff Manual (AR + EN)
- Full Technical Review (Code + DB + Logic + Workflows)
- Developer Handover Pack
- Launch Readiness Summary
- Docs Update Checklist

### Topics Covered / المواضيع المغطاة
1. Roles & Permissions / الأدوار والصلاحيات
2. Buildings & Units / المباني والوحدات
3. Payments / المدفوعات
4. Bookings & Occupancy / الحجوزات والإشغال
5. Renewals & Extensions / التجديدات والتمديدات
6. Customer Support / دعم العملاء
7. Notifications & Email / الإشعارات والبريد
8. Reports & KPIs / التقارير ومؤشرات الأداء
9. Content Management / إدارة المحتوى
10. Security & Privacy / الأمان والخصوصية

---

## Docs Update Checklist / قائمة تحديث التوثيق

Use this checklist for every release or PR that changes user-facing behavior:

- [ ] Identify which KB topics are affected by the change
- [ ] Update the Arabic article (`docs/knowledge-base/ar/`)
- [ ] Update the English article (`docs/knowledge-base/en/`)
- [ ] Update Staff Manuals if workflows changed
- [ ] Add entry to this CHANGELOG
- [ ] Verify Copilot answers reflect the update (test 2-3 questions)
- [ ] Update Developer Handover Pack if architecture changed
- [ ] Notify Operations Manager of the documentation update

### Ownership / المسؤولية

| Role | Responsibility |
|------|---------------|
| **Engineering Lead** | Updates technical docs (handover, reviews) on every release |
| **Operations Manager** | Updates KB and manuals when business processes change |
| **Product Manager** | Reviews and approves KB content for accuracy |
| **All Staff** | Reports incorrect or missing information to Operations Manager |
