-- ============================================================================
-- Fix Treasury Trigger RLS Issue
-- ============================================================================
-- The trigger needs to bypass RLS to update the treasury table
-- This file creates SECURITY DEFINER functions that can bypass RLS

-- 1. Create a SECURITY DEFINER version of the add_payment_to_treasury function
CREATE OR REPLACE FUNCTION add_payment_to_treasury()
RETURNS TRIGGER AS $$
DECLARE
    v_treasury_id UUID;
    v_student_name TEXT;
BEGIN
    -- التحقق من أن الدفعة مدفوعة
    IF NEW.status = 'paid' AND NEW.amount > 0 THEN
        -- البحث عن الخزينة
        SELECT id INTO v_treasury_id
        FROM treasury
        WHERE academy_id = NEW.academy_id
        LIMIT 1;
        
        -- الحصول على اسم الطالب
        SELECT full_name INTO v_student_name
        FROM students
        WHERE id = NEW.student_id
        LIMIT 1;
        
        -- إذا لم توجد خزينة، أنشئ واحدة
        IF v_treasury_id IS NULL THEN
            INSERT INTO treasury (academy_id, balance, total_deposited)
            VALUES (NEW.academy_id, NEW.amount, NEW.amount)
            RETURNING id INTO v_treasury_id;
            
            RAISE NOTICE '✅ New treasury created for academy: %, balance: %', NEW.academy_id, NEW.amount;
        ELSE
            -- تحديث الخزينة
            UPDATE treasury
            SET 
                balance = balance + NEW.amount,
                total_deposited = total_deposited + NEW.amount,
                last_transaction_date = NOW()
            WHERE id = v_treasury_id;
            
            RAISE NOTICE '✅ Treasury updated: +% ج.م', NEW.amount;
        END IF;
        
        -- إضافة سجل المعاملة
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
            'دفعة من طالب - ' || COALESCE(v_student_name, 'غير محدد'),
            NEW.id,
            NULL
        );
        
        RAISE NOTICE '✅ Transaction recorded: % ج.م for academy %', NEW.amount, NEW.academy_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Grant execution permissions to authenticated users
GRANT EXECUTE ON FUNCTION add_payment_to_treasury() TO authenticated;

-- 2. Make sure the trigger is set to fire AFTER INSERT
DROP TRIGGER IF EXISTS add_payment_to_treasury_trigger ON payments;

CREATE TRIGGER add_payment_to_treasury_trigger
    AFTER INSERT ON payments
    FOR EACH ROW
    EXECUTE FUNCTION add_payment_to_treasury();

-- 3. For UPDATE operations on payments (if status is changed to 'paid')
CREATE OR REPLACE FUNCTION update_payment_to_treasury()
RETURNS TRIGGER AS $$
DECLARE
    v_treasury_id UUID;
    v_student_name TEXT;
BEGIN
    -- إذا تم تغيير الحالة من non-paid إلى paid
    IF OLD.status != 'paid' AND NEW.status = 'paid' AND NEW.amount > 0 THEN
        -- البحث عن الخزينة
        SELECT id INTO v_treasury_id
        FROM treasury
        WHERE academy_id = NEW.academy_id
        LIMIT 1;
        
        -- الحصول على اسم الطالب
        SELECT full_name INTO v_student_name
        FROM students
        WHERE id = NEW.student_id
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
                last_transaction_date = NOW()
            WHERE id = v_treasury_id;
        END IF;
        
        -- إضافة سجل المعاملة
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
            'دفعة من طالب - ' || COALESCE(v_student_name, 'غير محدد'),
            NEW.id,
            NULL
        );
        
        RAISE NOTICE '✅ Payment status updated to paid: % ج.م', NEW.amount;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Grant execution permissions to authenticated users
GRANT EXECUTE ON FUNCTION update_payment_to_treasury() TO authenticated;

-- Create trigger for UPDATE operations
DROP TRIGGER IF EXISTS update_payment_to_treasury_trigger ON payments;

CREATE TRIGGER update_payment_to_treasury_trigger
    AFTER UPDATE ON payments
    FOR EACH ROW
    EXECUTE FUNCTION update_payment_to_treasury();

-- 4. Add RLS bypass for service role to do treasury operations
-- The treasury table updates via triggers should be allowed
-- Add a policy that allows the trigger to update without user context
ALTER TABLE treasury ENABLE ROW LEVEL SECURITY;

-- Keep existing policies but add a note that triggers bypass RLS
COMMENT ON TABLE treasury IS 'Treasury table with RLS. Note: Triggers bypass RLS for automatic updates.';
COMMENT ON TABLE treasury_transactions IS 'Treasury transactions table with RLS. Note: Triggers bypass RLS for automatic inserts.';

-- 5. Verify the functions are properly set up
GRANT EXECUTE ON FUNCTION add_payment_to_treasury TO postgres, authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION update_payment_to_treasury TO postgres, authenticated, anon, service_role;

-- Done!
-- Now the treasury should update automatically when payments are added
