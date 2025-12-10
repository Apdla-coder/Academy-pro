-- ============================================================================
-- التحقق من وجود الـ Trigger وإعادة إنشائه إذا لزم الأمر
-- ============================================================================

-- حذف الـ Trigger القديم إذا كان موجوداً
DROP TRIGGER IF EXISTS add_payment_to_treasury_trigger ON payments;

-- حذف الدالة القديمة إذا كانت موجودة
DROP FUNCTION IF EXISTS add_payment_to_treasury();

-- إعادة إنشاء الدالة
CREATE OR REPLACE FUNCTION add_payment_to_treasury()
RETURNS TRIGGER AS $$
DECLARE
    v_treasury_id UUID;
BEGIN
    -- التحقق من أن الدفعة مدفوعة
    IF NEW.status = 'paid' AND NEW.amount > 0 THEN
        -- البحث عن الخزينة
        SELECT id INTO v_treasury_id
        FROM treasury
        WHERE academy_id = NEW.academy_id
        LIMIT 1;
        
        -- إذا لم توجد خزينة، أنشئ واحدة
        IF v_treasury_id IS NULL THEN
            INSERT INTO treasury (academy_id, balance, total_deposited)
            VALUES (NEW.academy_id, NEW.amount, NEW.amount)
            RETURNING id INTO v_treasury_id;
        ELSE
            -- تحديث الخزينة
            UPDATE treasury
            SET 
                balance = balance + NEW.amount,
                total_deposited = total_deposited + NEW.amount,
                last_transaction_date = NOW(),
                updated_at = NOW()
            WHERE id = v_treasury_id;
        END IF;
        
        -- إضافة سجل المعاملة (فقط إذا لم تكن موجودة بالفعل)
        IF NOT EXISTS (
            SELECT 1 
            FROM treasury_transactions 
            WHERE payment_id = NEW.id
        ) THEN
            INSERT INTO treasury_transactions (
                treasury_id,
                academy_id,
                transaction_type,
                amount,
                description,
                payment_id,
                created_by
            )
            VALUES (
                v_treasury_id,
                NEW.academy_id,
                'deposit',
                NEW.amount,
                'دفعة من طالب - ' || COALESCE((SELECT full_name FROM students WHERE id = NEW.student_id LIMIT 1), 'غير محدد'),
                NEW.id,
                NULL
            );
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- إعادة إنشاء الـ Trigger
CREATE TRIGGER add_payment_to_treasury_trigger
    AFTER INSERT ON payments
    FOR EACH ROW
    EXECUTE FUNCTION add_payment_to_treasury();

-- التحقق من وجود الـ Trigger
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_statement
FROM information_schema.triggers
WHERE trigger_name = 'add_payment_to_treasury_trigger';

