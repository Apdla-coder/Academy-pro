-- ============================================================================
-- Fix Duplicate Treasury Entries
-- ============================================================================
-- هذا الملف يصلح مشكلة وجود خزينتين مكررتين لنفس الأكاديمية
-- يحذف الخزينات المكررة ويبقي على الأحدث فقط

-- حذف الخزينات المكررة، والاحتفاظ بالأحدث فقط لكل أكاديمية
WITH ranked_treasury AS (
    SELECT 
        id,
        academy_id,
        ROW_NUMBER() OVER (
            PARTITION BY academy_id 
            ORDER BY created_at DESC, updated_at DESC
        ) as rn
    FROM treasury
)
DELETE FROM treasury
WHERE id IN (
    SELECT id 
    FROM ranked_treasury 
    WHERE rn > 1
);

-- التأكد من وجود constraint لمنع التكرار في المستقبل
-- (يجب أن يكون موجوداً بالفعل في treasury-and-notifications.sql)
-- إذا لم يكن موجوداً، قم بتشغيل:
-- ALTER TABLE treasury ADD CONSTRAINT unique_academy_treasury UNIQUE (academy_id);

-- ملاحظة: إذا كان constraint موجوداً بالفعل، قد تحتاج إلى حذفه أولاً ثم إعادة إنشائه
-- ALTER TABLE treasury DROP CONSTRAINT IF EXISTS unique_academy_treasury;
-- ALTER TABLE treasury ADD CONSTRAINT unique_academy_treasury UNIQUE (academy_id);

