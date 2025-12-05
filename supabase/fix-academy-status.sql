-- ============================================================
-- إنشاء جدول academy_status لإدارة قفل/فتح الأكاديميات
-- ============================================================

-- 1️⃣ إنشاء الجدول الأساسي
CREATE TABLE IF NOT EXISTS academy_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academy_id UUID NOT NULL REFERENCES academies(id) ON DELETE CASCADE,
  is_locked BOOLEAN DEFAULT FALSE NOT NULL,
  lock_reason TEXT,
  locked_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  UNIQUE(academy_id)
);

-- 2️⃣ إضافة Indexes لتحسين الأداء
CREATE INDEX IF NOT EXISTS idx_academy_status_academy_id 
  ON academy_status(academy_id);

CREATE INDEX IF NOT EXISTS idx_academy_status_is_locked 
  ON academy_status(is_locked);

CREATE INDEX IF NOT EXISTS idx_academy_status_locked_at 
  ON academy_status(locked_at DESC);

-- 3️⃣ إنشاء trigger لتحديث updated_at تلقائياً
CREATE OR REPLACE FUNCTION update_academy_status_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_academy_status_updated_at ON academy_status;

CREATE TRIGGER trigger_update_academy_status_updated_at
BEFORE UPDATE ON academy_status
FOR EACH ROW
EXECUTE FUNCTION update_academy_status_updated_at();

-- 4️⃣ تفعيل Row Level Security
ALTER TABLE academy_status ENABLE ROW LEVEL SECURITY;

-- 5️⃣ إزالة السياسات القديمة (إن وجدت)
DROP POLICY IF EXISTS "Allow public read" ON academy_status;
DROP POLICY IF EXISTS "Allow authenticated write" ON academy_status;
DROP POLICY IF EXISTS "Allow authenticated insert" ON academy_status;
DROP POLICY IF EXISTS "Allow authenticated delete" ON academy_status;

-- 6️⃣ إضافة سياسات RLS جديدة
CREATE POLICY "Allow public read academy_status" ON academy_status
  FOR SELECT USING (true);

CREATE POLICY "Allow authenticated insert academy_status" ON academy_status
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated update academy_status" ON academy_status
  FOR UPDATE USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated delete academy_status" ON academy_status
  FOR DELETE USING (auth.role() = 'authenticated');

-- 7️⃣ إدراج قيم افتراضية للأكاديميات الموجودة
INSERT INTO academy_status (academy_id, is_locked, lock_reason)
SELECT id, FALSE, NULL FROM academies
WHERE id NOT IN (SELECT academy_id FROM academy_status)
ON CONFLICT DO NOTHING;

-- ✅ اختبار: اعرض عدد السجلات المضافة
SELECT COUNT(*) as "عدد الأكاديميات المسجلة" FROM academy_status;

-- ✅ اختبار: اعرض الأكاديميات المقفولة
SELECT a.name, s.lock_reason, s.locked_at 
FROM academy_status s
LEFT JOIN academies a ON s.academy_id = a.id
WHERE s.is_locked = true;
