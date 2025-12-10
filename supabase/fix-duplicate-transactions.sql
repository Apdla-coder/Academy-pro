-- ============================================================================
-- Fix Duplicate Treasury Transactions
-- ============================================================================
-- هذا الملف يحذف المعاملات المكررة في treasury_transactions
-- يحتفظ فقط بالمعاملة الأولى لكل payment_id

-- حذف المعاملات المكررة (نفس payment_id، نفس المبلغ، نفس التاريخ)
WITH ranked_transactions AS (
    SELECT 
        id,
        payment_id,
        amount,
        created_at,
        ROW_NUMBER() OVER (
            PARTITION BY payment_id, amount, DATE(created_at)
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

-- إعادة حساب إجمالي الخزينة بناءً على المعاملات الفعلية
-- حساب لكل أكاديمية بشكل منفصل
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
        WHERE academy_id = t.academy_id
    ), 0),
    total_deposited = COALESCE((
        SELECT SUM(amount)
        FROM treasury_transactions
        WHERE academy_id = t.academy_id
        AND transaction_type = 'deposit'
    ), 0),
    total_withdrawn = COALESCE((
        SELECT SUM(amount)
        FROM treasury_transactions
        WHERE academy_id = t.academy_id
        AND transaction_type = 'withdrawal'
    ), 0),
    last_transaction_date = (
        SELECT MAX(created_at)
        FROM treasury_transactions
        WHERE academy_id = t.academy_id
    ),
    updated_at = NOW()
WHERE EXISTS (
    SELECT 1 FROM treasury_transactions WHERE academy_id = t.academy_id
);

-- تحديث الخزينات التي لا تحتوي على معاملات
UPDATE treasury t
SET 
    balance = 0,
    total_deposited = 0,
    total_withdrawn = 0,
    updated_at = NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM treasury_transactions WHERE academy_id = t.academy_id
);

