-- ============================================================================
-- Treasury and Notifications System
-- ============================================================================

-- جدول الخزينة (Treasury)
CREATE TABLE IF NOT EXISTS treasury (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    academy_id UUID NOT NULL REFERENCES academies(id) ON DELETE CASCADE,
    balance DECIMAL(15, 2) DEFAULT 0 NOT NULL,
    total_deposited DECIMAL(15, 2) DEFAULT 0 NOT NULL,
    total_withdrawn DECIMAL(15, 2) DEFAULT 0 NOT NULL,
    last_transaction_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- جدول سجل المعاملات المالية (Treasury Transactions)
CREATE TABLE IF NOT EXISTS treasury_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    treasury_id UUID NOT NULL REFERENCES treasury(id) ON DELETE CASCADE,
    academy_id UUID NOT NULL REFERENCES academies(id) ON DELETE CASCADE,
    transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('deposit', 'withdrawal')),
    amount DECIMAL(15, 2) NOT NULL CHECK (amount > 0),
    description TEXT,
    payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- جدول الإشعارات (Notifications)
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    academy_id UUID NOT NULL REFERENCES academies(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL DEFAULT 'info',
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    related_id UUID, -- ID للمعاملات المرتبطة (مثل withdrawal_id)
    related_type VARCHAR(50), -- نوع المعاملة (مثل 'withdrawal', 'payment')
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    read_at TIMESTAMP WITH TIME ZONE
);

-- إنشاء فهرس لتحسين الأداء
CREATE INDEX IF NOT EXISTS idx_treasury_academy ON treasury(academy_id);
CREATE INDEX IF NOT EXISTS idx_treasury_transactions_treasury ON treasury_transactions(treasury_id);
CREATE INDEX IF NOT EXISTS idx_treasury_transactions_academy ON treasury_transactions(academy_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_academy ON notifications(academy_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);

-- دالة لتحديث updated_at تلقائياً
CREATE OR REPLACE FUNCTION update_treasury_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger لتحديث updated_at
CREATE TRIGGER update_treasury_timestamp
    BEFORE UPDATE ON treasury
    FOR EACH ROW
    EXECUTE FUNCTION update_treasury_updated_at();

-- دالة لإنشاء خزينة تلقائياً عند إنشاء أكاديمية جديدة
CREATE OR REPLACE FUNCTION create_treasury_for_academy()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO treasury (academy_id, balance, total_deposited, total_withdrawn)
    VALUES (NEW.id, 0, 0, 0);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger لإنشاء خزينة تلقائياً
CREATE TRIGGER create_treasury_on_academy_create
    AFTER INSERT ON academies
    FOR EACH ROW
    EXECUTE FUNCTION create_treasury_for_academy();

-- دالة لإضافة مبلغ إلى الخزينة عند إضافة دفعة
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
            'دفعة من طالب - ' || COALESCE((SELECT full_name FROM students WHERE id = NEW.student_id LIMIT 1), 'غير محدد'),
            NEW.id,
            NULL
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger لإضافة المدفوعات تلقائياً للخزينة
CREATE TRIGGER add_payment_to_treasury_trigger
    AFTER INSERT ON payments
    FOR EACH ROW
    EXECUTE FUNCTION add_payment_to_treasury();

-- دالة لسحب مبلغ من الخزينة
CREATE OR REPLACE FUNCTION withdraw_from_treasury(
    p_academy_id UUID,
    p_amount DECIMAL,
    p_description TEXT,
    p_created_by UUID
)
RETURNS UUID AS $$
DECLARE
    v_treasury_id UUID;
    v_current_balance DECIMAL;
    v_transaction_id UUID;
BEGIN
    -- البحث عن الخزينة
    SELECT id, balance INTO v_treasury_id, v_current_balance
    FROM treasury
    WHERE academy_id = p_academy_id
    LIMIT 1;
    
    IF v_treasury_id IS NULL THEN
        RAISE EXCEPTION 'لا توجد خزينة لهذه الأكاديمية';
    END IF;
    
    IF v_current_balance < p_amount THEN
        RAISE EXCEPTION 'الرصيد غير كافي. الرصيد الحالي: %', v_current_balance;
    END IF;
    
    -- تحديث الخزينة
    UPDATE treasury
    SET 
        balance = balance - p_amount,
        total_withdrawn = total_withdrawn + p_amount,
        last_transaction_date = NOW()
    WHERE id = v_treasury_id;
    
    -- إضافة سجل المعاملة
    INSERT INTO treasury_transactions (
        treasury_id,
        academy_id,
        transaction_type,
        amount,
        description,
        created_by
    )
    VALUES (
        v_treasury_id,
        p_academy_id,
        'withdrawal',
        p_amount,
        p_description,
        p_created_by
    )
    RETURNING id INTO v_transaction_id;
    
    RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql;

-- دالة لإرسال إشعار للسكرتير
CREATE OR REPLACE FUNCTION notify_secretary(
    p_academy_id UUID,
    p_title VARCHAR,
    p_message TEXT,
    p_type VARCHAR DEFAULT 'info',
    p_related_id UUID DEFAULT NULL,
    p_related_type VARCHAR DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_notification_id UUID;
    v_secretary_id UUID;
BEGIN
    -- البحث عن السكرتير في الأكاديمية
    SELECT user_id INTO v_secretary_id
    FROM academy_members
    WHERE academy_id = p_academy_id
    AND role = 'secretary'
    LIMIT 1;
    
    IF v_secretary_id IS NULL THEN
        -- إذا لم يوجد سكرتير، أرسل لجميع الأعضاء
        FOR v_secretary_id IN 
            SELECT user_id
            FROM academy_members
            WHERE academy_id = p_academy_id
            AND role IN ('secretary', 'admin', 'owner')
        LOOP
            INSERT INTO notifications (
                academy_id,
                user_id,
                type,
                title,
                message,
                related_id,
                related_type
            )
            VALUES (
                p_academy_id,
                v_secretary_id,
                p_type,
                p_title,
                p_message,
                p_related_id,
                p_related_type
            );
        END LOOP;
    ELSE
        -- إرسال للسكرتير فقط
        INSERT INTO notifications (
            academy_id,
            user_id,
            type,
            title,
            message,
            related_id,
            related_type
        )
        VALUES (
            p_academy_id,
            v_secretary_id,
            p_type,
            p_title,
            p_message,
            p_related_id,
            p_related_type
        )
        RETURNING id INTO v_notification_id;
    END IF;
    
    RETURN v_notification_id;
END;
$$ LANGUAGE plpgsql;

-- RLS Policies
ALTER TABLE treasury ENABLE ROW LEVEL SECURITY;
ALTER TABLE treasury_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Policy للخزينة - فقط الأعضاء يمكنهم الوصول
CREATE POLICY "Users can view treasury for their academy"
    ON treasury FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM academy_members
            WHERE academy_members.academy_id = treasury.academy_id
            AND academy_members.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert treasury for their academy"
    ON treasury FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM academy_members
            WHERE academy_members.academy_id = treasury.academy_id
            AND academy_members.user_id = auth.uid()
        )
    );

CREATE POLICY "Admins can update treasury"
    ON treasury FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM academy_members
            WHERE academy_members.academy_id = treasury.academy_id
            AND academy_members.user_id = auth.uid()
            AND academy_members.role IN ('admin', 'owner')
        )
    );

-- Policy لسجل المعاملات
CREATE POLICY "Users can view transactions for their academy"
    ON treasury_transactions FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM academy_members
            WHERE academy_members.academy_id = treasury_transactions.academy_id
            AND academy_members.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert transactions for their academy"
    ON treasury_transactions FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM academy_members
            WHERE academy_members.academy_id = treasury_transactions.academy_id
            AND academy_members.user_id = auth.uid()
        )
    );

-- Policy للإشعارات
CREATE POLICY "Users can view their own notifications"
    ON notifications FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users can update their own notifications"
    ON notifications FOR UPDATE
    USING (user_id = auth.uid());

CREATE POLICY "Admins can insert notifications"
    ON notifications FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM academy_members
            WHERE academy_members.academy_id = notifications.academy_id
            AND academy_members.user_id = auth.uid()
            AND academy_members.role IN ('admin', 'owner')
        )
    );

