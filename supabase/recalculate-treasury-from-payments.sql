-- ============================================================================
-- إعادة حساب الخزينة من المدفوعات الفعلية
-- ============================================================================
-- هذا الملف يعيد حساب الخزينة بناءً على جميع المدفوعات المدفوعة في جدول payments
-- ويحذف المعاملات المكررة

-- أولاً: حذف جميع المعاملات المكررة (نفس payment_id)
WITH ranked_transactions AS (
    SELECT 
        id,
        payment_id,
        ROW_NUMBER() OVER (
            PARTITION BY payment_id
            ORDER BY created_at ASC
        ) as rn
    FROM treasury_transactions
    WHERE payment_id IS NOT NULL
)
DELETE FROM treasury_transactions
WHERE id IN (
    SELECT id 
    FROM ranked_transactions 
    WHERE rn > 1
);

-- ثانياً: حذف جميع المعاملات الحالية
DELETE FROM treasury_transactions;

-- ثالثاً: إعادة إنشاء المعاملات من المدفوعات الفعلية
INSERT INTO treasury_transactions (
    treasury_id,
    academy_id,
    transaction_type,
    amount,
    description,
    payment_id,
    created_by
)
SELECT 
    t.id as treasury_id,
    p.academy_id,
    'deposit' as transaction_type,
    p.amount,
    'دفعة من طالب - ' || COALESCE(s.full_name, 'غير محدد') as description,
    p.id as payment_id,
    NULL as created_by
FROM payments p
INNER JOIN treasury t ON t.academy_id = p.academy_id
LEFT JOIN students s ON s.id = p.student_id
WHERE p.status = 'paid' 
  AND p.amount > 0
ORDER BY p.payment_date ASC;

-- رابعاً: إعادة حساب الخزينة بناءً على المعاملات الجديدة
UPDATE treasury t
SET 
    balance = COALESCE((
        SELECT SUM(
            CASE 
                WHEN transaction_type = 'deposit' THEN amount
                WHEN transaction_type = 'withdrawal' THEN -amount
                ELSE 0
            END
        )
        FROM treasury_transactions
        WHERE treasury_id = t.id
    ), 0),
    total_deposited = COALESCE((
        SELECT SUM(amount)
        FROM treasury_transactions
        WHERE treasury_id = t.id
        AND transaction_type = 'deposit'
    ), 0),
    total_withdrawn = COALESCE((
        SELECT SUM(amount)
        FROM treasury_transactions
        WHERE treasury_id = t.id
        AND transaction_type = 'withdrawal'
    ), 0),
    last_transaction_date = (
        SELECT MAX(created_at)
        FROM treasury_transactions
        WHERE treasury_id = t.id
    ),
    updated_at = NOW();

-- خامساً: التأكد من أن جميع الأكاديميات لديها خزينة
INSERT INTO treasury (academy_id, balance, total_deposited, total_withdrawn)
SELECT 
    a.id,
    0,
    0,
    0
FROM academies a
WHERE NOT EXISTS (
    SELECT 1 FROM treasury t WHERE t.academy_id = a.id
);

-- سادساً: إعادة حساب الخزينات التي لا تحتوي على معاملات
UPDATE treasury t
SET 
    balance = 0,
    total_deposited = 0,
    total_withdrawn = 0,
    updated_at = NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM treasury_transactions WHERE treasury_id = t.id
);

-- ملاحظة: بعد تشغيل هذا الملف، يجب أن تعمل الخزينة بشكل صحيح
-- والـ Trigger سيتولى تحديث الخزينة تلقائياً عند إضافة مدفوعات جديدة




