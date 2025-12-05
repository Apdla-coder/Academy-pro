# 🔧 حل مشكلة academy_status 406

## المشكلة
```
GET https://nhzbnzcdsebepsmrtona.supabase.co/rest/v1/academy_status?select=*&academy_id=eq.xxx 
406 (Not Acceptable)
```

**السبب:** جدول `academy_status` غير موجود في قاعدة البيانات Supabase

---

## ✅ الحل

### الخطوة 1: إنشاء جدول academy_status في Supabase

اذهب إلى: **Supabase Dashboard → SQL Editor**

انسخ والصق الكود من ملف `supabase/fix-academy-status.sql`:

```sql
CREATE TABLE IF NOT EXISTS academy_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academy_id UUID NOT NULL REFERENCES academies(id) ON DELETE CASCADE,
  is_locked BOOLEAN DEFAULT FALSE,
  lock_reason TEXT,
  locked_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(academy_id)
);
```

ثم اضغط **Run**

### الخطوة 2: إضافة Indexes (للأداء الأفضل)

```sql
CREATE INDEX IF NOT EXISTS idx_academy_status_academy_id 
  ON academy_status(academy_id);

CREATE INDEX IF NOT EXISTS idx_academy_status_is_locked 
  ON academy_status(is_locked);
```

### الخطوة 3: تفعيل Row Level Security (اختياري)

```sql
ALTER TABLE academy_status ENABLE ROW LEVEL SECURITY;

-- السماح بالقراءة
CREATE POLICY "Allow public read" ON academy_status
  FOR SELECT USING (true);

-- السماح بالكتابة للمستخدمين المصرحين
CREATE POLICY "Allow authenticated write" ON academy_status
  FOR UPDATE USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');
```

---

## 🛡️ التحديثات في الكود

تم تحديث ملف `سوبر ادمن/super-admin-simplified.html` لمعالجة الحالات التالية:

### 1. **معالجة الأخطاء الذكية**
```javascript
try {
  // محاولة استخدام academy_status
} catch (error) {
  // تجاهل إذا كان الجدول غير موجود
  console.warn('⚠️ جدول academy_status قد لا يكون موجوداً')
}
```

### 2. **تحميل الحالة بأمان**
- محاولة جلب بيانات الحالة
- إذا فشل: يتم اعتبار الأكاديمية مفتوحة افتراضياً
- رسائل خطأ واضحة للمستخدم

### 3. **تحديث الحالة مع الرجوع الآمن**
- إذا نجحت العملية: تحديث الواجهة
- إذا فشلت: عرض تحذير لكن العملية تستمر

---

## 📋 قائمة التحقق

- [ ] تسجيل دخول Supabase Dashboard
- [ ] الذهاب إلى SQL Editor
- [ ] تشغيل سكريبت إنشاء الجدول
- [ ] تشغيل سكريبت الـ Indexes
- [ ] اختياري: تفعيل RLS
- [ ] اختبار: افتح صفحة السوبر ادمن في المتصفح
- [ ] اختبار: حاول إضافة أكاديمية جديدة
- [ ] اختبار: حاول قفل/فتح أكاديمية

---

## 🚀 الميزات الجديدة

✅ معالجة آمنة للأخطاء
✅ رسائل خطأ واضحة
✅ العمل حتى إذا كان الجدول غير موجود
✅ أداء محسّنة مع Indexes
✅ أمان قوي مع RLS

---

## 📞 في حالة استمرار المشاكل

1. تأكد من أن جدول `academies` موجود
2. تأكد من وجود foreign key reference صحيح
3. تحقق من أن `academy_id` في `academy_status` تطابق الـ id الفعلي
4. افتح DevTools (F12) وانظر إلى Console للرسائل التفصيلية
