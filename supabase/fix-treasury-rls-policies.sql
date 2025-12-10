-- ============================================================================
-- Fix Treasury RLS Policies
-- ============================================================================
-- هذا الملف يصلح سياسات RLS للخزينة والإشعارات

-- حذف السياسات القديمة إذا كانت موجودة
DROP POLICY IF EXISTS "Users can view treasury for their academy" ON treasury;
DROP POLICY IF EXISTS "Users can insert treasury for their academy" ON treasury;
DROP POLICY IF EXISTS "Admins can update treasury" ON treasury;
DROP POLICY IF EXISTS "Users can view transactions for their academy" ON treasury_transactions;
DROP POLICY IF EXISTS "Users can insert transactions for their academy" ON treasury_transactions;
DROP POLICY IF EXISTS "Admins can insert transactions" ON treasury_transactions;
DROP POLICY IF EXISTS "Users can view their own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON notifications;
DROP POLICY IF EXISTS "Admins can insert notifications" ON notifications;
DROP POLICY IF EXISTS "System can insert notifications" ON notifications;

-- Policy للخزينة - القراءة
CREATE POLICY "Users can view treasury for their academy"
    ON treasury FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM academy_members
            WHERE academy_members.academy_id = treasury.academy_id
            AND academy_members.user_id = auth.uid()
        )
    );

-- Policy للخزينة - الإدراج (لإنشاء خزينة جديدة)
CREATE POLICY "Users can insert treasury for their academy"
    ON treasury FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM academy_members
            WHERE academy_members.academy_id = treasury.academy_id
            AND academy_members.user_id = auth.uid()
        )
    );

-- Policy للخزينة - التحديث (للمدير فقط)
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

-- Policy لسجل المعاملات - القراءة
CREATE POLICY "Users can view transactions for their academy"
    ON treasury_transactions FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM academy_members
            WHERE academy_members.academy_id = treasury_transactions.academy_id
            AND academy_members.user_id = auth.uid()
        )
    );

-- Policy لسجل المعاملات - الإدراج (لجميع الأعضاء)
CREATE POLICY "Users can insert transactions for their academy"
    ON treasury_transactions FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM academy_members
            WHERE academy_members.academy_id = treasury_transactions.academy_id
            AND academy_members.user_id = auth.uid()
        )
    );

-- Policy للإشعارات - القراءة
CREATE POLICY "Users can view their own notifications"
    ON notifications FOR SELECT
    USING (user_id = auth.uid());

-- Policy للإشعارات - التحديث
CREATE POLICY "Users can update their own notifications"
    ON notifications FOR UPDATE
    USING (user_id = auth.uid());

-- Policy للإشعارات - الإدراج (للمدير فقط لإرسال إشعارات)
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

-- Policy إضافية للسماح للنظام بإدراج إشعارات (للاستخدام من خلال Functions)
-- هذا يحتاج إلى service_role key في production
-- CREATE POLICY "Service role can insert notifications"
--     ON notifications FOR INSERT
--     WITH CHECK (true);

