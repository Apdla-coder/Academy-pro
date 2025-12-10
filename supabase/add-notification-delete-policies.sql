-- Add policies to allow deletion of notifications by their owner and by admins/owners of the academy

-- Ensure RLS is enabled (should already be enabled in existing SQL)
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Allow users to delete their own notifications
CREATE POLICY "Users can delete their own notifications"
    ON notifications FOR DELETE
    USING (user_id = auth.uid());

-- Allow admins/owners of the academy to delete any notification in that academy
CREATE POLICY "Admins can delete notifications"
    ON notifications FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM academy_members
            WHERE academy_members.academy_id = notifications.academy_id
              AND academy_members.user_id = auth.uid()
              AND academy_members.role IN ('admin', 'owner')
        )
    );

-- Note: After applying this file in the Supabase SQL editor, re-run the deletion from the UI.
