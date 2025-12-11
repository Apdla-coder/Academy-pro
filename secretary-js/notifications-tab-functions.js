// ============================================================================
// NOTIFICATIONS TAB - Notifications management
// ============================================================================

let notificationsData = [];

/**
 * Load notifications
 */
async function loadNotificationsTab() {
  try {
    console.log('🔔 Loading notifications tab...');
    
    const academyId = window.currentAcademyId || window.ACADEMY_ID || localStorage.getItem('current_academy_id');
    const userId = localStorage.getItem('user_id');
    
    if (!academyId || !userId) {
      console.error('❌ Academy ID or User ID not set');
      return;
    }

    const container = document.getElementById('notificationsContainer');
    if (!container) return;

    container.innerHTML = '<div class="loading"><div class="loading-spinner"></div><p>جاري تحميل الإشعارات...</p></div>';

    const { data: notifications, error } = await safeSupabaseQuery(
      () => window.supabaseClient
        .from('notifications')
        .select('*')
        .eq('academy_id', academyId)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(100),
      'خطأ في تحميل الإشعارات',
      false
    );

    if (error) throw error;

    notificationsData = notifications || [];
    renderNotifications();
    // Sync notifications tab badge and header bell
    updateNotificationsBadge();
    try {
      const unreadCount = (notificationsData || []).filter(n => !n.is_read).length;
      if (typeof window.unreadNotificationCount !== 'number') window.unreadNotificationCount = 0;
      // sync header unread count with notifications table
      window.unreadNotificationCount = unreadCount;
      if (window.updateNotificationBadge) window.updateNotificationBadge();

      // Add unread notifications to header history (dedup by id)
      if (window.addToNotificationHistory && Array.isArray(notificationsData)) {
        notificationsData.filter(n => !n.is_read).forEach(n => {
          const emoji = n.type === 'withdrawal' ? '💳' : (n.type === 'danger' ? '⚠️' : '🔔');
          window.addToNotificationHistory(emoji, n.title || n.message || 'إشعار جديد', n.created_at, n.id);
        });
      }
    } catch (e) {
      console.warn('⚠️ Error syncing notifications to header:', e);
    }
  } catch (error) {
    console.error('❌ Error loading notifications:', error);
    const container = document.getElementById('notificationsContainer');
    if (container) {
      container.innerHTML = `<p style="text-align: center; color: var(--danger); padding: 20px;">خطأ في تحميل الإشعارات: ${error.message}</p>`;
    }
  }
}

/**
 * Render notifications
 */
function renderNotifications(filter = '') {
  const container = document.getElementById('notificationsContainer');
  if (!container) return;

  let filteredNotifications = notificationsData;

  if (filter === 'unread') {
    filteredNotifications = notificationsData.filter(n => !n.is_read);
  } else if (filter === 'read') {
    filteredNotifications = notificationsData.filter(n => n.is_read);
  }

  if (filteredNotifications.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 40px; color: var(--text-secondary);">
        <i class="fas fa-bell-slash" style="font-size: 3rem; margin-bottom: 15px; display: block; opacity: 0.5;"></i>
        <p>لا توجد إشعارات</p>
      </div>
    `;
    return;
  }

  let html = '';

  filteredNotifications.forEach(notification => {
    const date = new Date(notification.created_at).toLocaleDateString('ar-EG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const typeColors = {
      'info': { bg: 'rgba(59, 130, 246, 0.1)', color: '#3B82F6', icon: 'fa-info-circle' },
      'success': { bg: 'rgba(16, 185, 129, 0.1)', color: '#10B981', icon: 'fa-check-circle' },
      'warning': { bg: 'rgba(245, 158, 11, 0.1)', color: '#F59E0B', icon: 'fa-exclamation-triangle' },
      'danger': { bg: 'rgba(239, 68, 68, 0.1)', color: '#EF4444', icon: 'fa-exclamation-circle' },
      'withdrawal': { bg: 'rgba(239, 68, 68, 0.1)', color: '#EF4444', icon: 'fa-money-bill-wave' }
    };

    const typeConfig = typeColors[notification.type] || typeColors['info'];
    const isUnread = !notification.is_read;

    html += `
      <div class="notification-card" style="
        background: var(--bg-card);
        border-radius: var(--radius-lg);
        padding: 20px;
        border: 1px solid var(--border);
        box-shadow: var(--shadow-md);
        transition: all 0.3s ease;
        cursor: pointer;
        ${isUnread ? 'border-right: 4px solid ' + typeConfig.color + ';' : ''}
        ${isUnread ? 'background: ' + typeConfig.bg + ';' : ''}
      " onclick="markNotificationAsRead('${notification.id}')" onmouseover="this.style.transform='translateX(-5px)'; this.style.boxShadow='var(--shadow-lg)'" onmouseout="this.style.transform='translateX(0)'; this.style.boxShadow='var(--shadow-md)'">
        <div style="display: flex; align-items: start; gap: 15px;">
          <div style="
            width: 50px;
            height: 50px;
            border-radius: 50%;
            background: ${typeConfig.bg};
            color: ${typeConfig.color};
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.5rem;
            flex-shrink: 0;
          ">
            <i class="fas ${typeConfig.icon}"></i>
          </div>
          <div style="flex: 1;">
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px; flex-wrap: wrap; gap: 10px;">
              <h4 style="margin: 0; font-size: 1.1rem; font-weight: 700; color: var(--text-primary);">
                ${notification.title}
                ${isUnread ? '<span style="display: inline-block; width: 10px; height: 10px; background: ' + typeConfig.color + '; border-radius: 50%; margin-right: 8px;"></span>' : ''}
              </h4>
              <span style="font-size: 0.85rem; color: var(--text-secondary);">${date}</span>
            </div>
            <p style="margin: 0; color: var(--text-secondary); line-height: 1.6; font-size: 0.95rem;">
              ${notification.message}
            </p>
          </div>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}

/**
 * Filter notifications
 */
function filterNotifications() {
  const filter = document.getElementById('notificationsFilter')?.value || '';
  renderNotifications(filter);
}

/**
 * Mark notification as read
 */
async function markNotificationAsRead(notificationId) {
  try {
    const userId = localStorage.getItem('user_id');
    if (!userId) return;

    const { error } = await safeSupabaseQuery(
      () => window.supabaseClient
        .from('notifications')
        .update({
          is_read: true,
          read_at: new Date().toISOString()
        })
        .eq('id', notificationId)
        .eq('user_id', userId),
      'خطأ في تحديث الإشعار',
      false
    );

    if (error) throw error;

    // Update local data
    const notification = notificationsData.find(n => n.id === notificationId);
    if (notification) {
      notification.is_read = true;
      notification.read_at = new Date().toISOString();
    }

    renderNotifications(document.getElementById('notificationsFilter')?.value || '');
    updateNotificationsBadge();
  } catch (error) {
    console.error('❌ Error marking notification as read:', error);
  }
}

/**
 * Mark all notifications as read
 */
async function markAllNotificationsAsRead() {
  try {
    const academyId = window.currentAcademyId || window.ACADEMY_ID || localStorage.getItem('current_academy_id');
    const userId = localStorage.getItem('user_id');
    
    if (!academyId || !userId) return;

    const unreadNotifications = notificationsData.filter(n => !n.is_read);
    if (unreadNotifications.length === 0) {
      showStatus('لا توجد إشعارات غير مقروءة', 'info');
      return;
    }

    const { error } = await safeSupabaseQuery(
      () => window.supabaseClient
        .from('notifications')
        .update({
          is_read: true,
          read_at: new Date().toISOString()
        })
        .eq('academy_id', academyId)
        .eq('user_id', userId)
        .eq('is_read', false),
      'خطأ في تحديث الإشعارات',
      true
    );

    if (error) throw error;

    // Update local data
    notificationsData.forEach(n => {
      if (!n.is_read) {
        n.is_read = true;
        n.read_at = new Date().toISOString();
      }
    });

    renderNotifications(document.getElementById('notificationsFilter')?.value || '');
    updateNotificationsBadge();
    showStatus(`✅ تم تحديد ${unreadNotifications.length} إشعار كمقروء`, 'success');
  } catch (error) {
    console.error('❌ Error marking all as read:', error);
    showStatus('خطأ في تحديث الإشعارات', 'error');
  }
}

// Export mark functions to global scope for other modules
window.markAllNotificationsAsRead = markAllNotificationsAsRead;
window.markNotificationAsRead = markNotificationAsRead;

/**
 * Clear all notifications
 */
async function clearAllNotifications() {
  if (!confirm('هل أنت متأكد من حذف جميع الإشعارات؟')) return;

  try {
    const academyId = window.currentAcademyId || window.ACADEMY_ID || localStorage.getItem('current_academy_id');
    const userId = localStorage.getItem('user_id');
    
    if (!academyId || !userId) return;

    const { error } = await safeSupabaseQuery(
      () => window.supabaseClient
        .from('notifications')
        .delete()
        .eq('academy_id', academyId)
        .eq('user_id', userId),
      'خطأ في حذف الإشعارات',
      true
    );

    if (error) throw error;

    notificationsData = [];
    renderNotifications();
    updateNotificationsBadge();
    showStatus('✅ تم حذف جميع الإشعارات', 'success');
  } catch (error) {
    console.error('❌ Error clearing notifications:', error);
    showStatus('خطأ في حذف الإشعارات', 'error');
  }
}

// Export DB delete function to window so header can call it
window.clearAllNotificationsDB = clearAllNotifications;

/**
 * Update notifications badge
 */
function updateNotificationsBadge() {
  const unreadCount = notificationsData.filter(n => !n.is_read).length;
  const badge = document.getElementById('notificationsUnreadCount');
  
  if (badge) {
    // تحديث الرقم
    badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
    
    // تغيير اللون حسب عدد الإشعارات غير المقروءة
    if (unreadCount > 20) {
      badge.style.background = '#ef4444'; // أحمر فاقع للعدد الكبير
      badge.style.fontWeight = 'bold';
    } else if (unreadCount > 10) {
      badge.style.background = '#f97316'; // برتقالي للعدد المتوسط
      badge.style.fontWeight = '600';
    } else if (unreadCount > 0) {
      badge.style.background = '#10b981'; // أخضر للعدد الصغير
      badge.style.fontWeight = '500';
    } else {
      badge.style.background = '#6b7280'; // رمادي عندما لا توجد إشعارات
    }
  }
  
  console.log(`🔔 Notifications badge updated: ${unreadCount} unread`);
}

/**
 * Check for new notifications periodically
 */
let notificationsCheckInterval = null;

function startNotificationsCheck() {
  // Check every 30 seconds
  if (notificationsCheckInterval) {
    clearInterval(notificationsCheckInterval);
  }

  notificationsCheckInterval = setInterval(async () => {
    const academyId = window.currentAcademyId || window.ACADEMY_ID || localStorage.getItem('current_academy_id');
    const userId = localStorage.getItem('user_id');
    
    if (!academyId || !userId) return;

    const { data: newNotifications, error } = await window.supabaseClient
      .from('notifications')
      .select('id, is_read')
      .eq('academy_id', academyId)
      .eq('user_id', userId)
      .eq('is_read', false)
      .limit(1);

    if (!error && newNotifications && newNotifications.length > 0) {
      // If notifications tab is open, reload full list
      if (document.getElementById('notificationsContent')?.style.display !== 'none') {
        await loadNotificationsTab();
      } else {
        // Otherwise fetch full details for the new notification(s) and push to header
        try {
          const ids = newNotifications.map(n => n.id);
          const { data: details, error: detailsErr } = await window.supabaseClient
            .from('notifications')
            .select('*')
            .in('id', ids)
            .order('created_at', { ascending: false });

          if (!detailsErr && details && details.length) {
            // Add to history and show transient header notification for each
            details.forEach(d => {
              const emoji = d.type === 'withdrawal' ? '💳' : (d.type === 'danger' ? '⚠️' : '🔔');
              if (window.addToNotificationHistory) window.addToNotificationHistory(emoji, d.title || d.message || 'إشعار جديد', d.created_at, d.id);
              if (window.showAdminActionNotification) window.showAdminActionNotification(emoji, d.title || d.message || 'إشعار جديد', 'notification');
              window.unreadNotificationCount = (window.unreadNotificationCount || 0) + 1;
              if (window.updateNotificationBadge) window.updateNotificationBadge();
            });
          } else {
            // fallback: just update badge
            updateNotificationsBadge();
            if (window.updateNotificationBadge) window.updateNotificationBadge();
          }
        } catch (e) {
          console.warn('⚠️ Error fetching notification details:', e);
          updateNotificationsBadge();
          if (window.updateNotificationBadge) window.updateNotificationBadge();
        }
      }
    }
  }, 30000); // 30 seconds
}

// Register the notifications refresh callback with the TabRefreshManager
if (window.tabRefreshManager) {
  window.tabRefreshManager.onRefresh('notifications', async function() {
    await loadNotificationsTab();
  });
}

// Auto-load when tab is switched - use event-based approach
if (!window._switchTabHandlers) {
  window._switchTabHandlers = [];
}

window._switchTabHandlers.push(function(tabName) {
  if (tabName === 'notifications') {
    loadNotificationsTab();
  }
});

// Start checking for notifications on page load
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    startNotificationsCheck();
    updateNotificationsBadge();
  }, 2000);
});

/**
 * Fetch unread notifications and sync them to header (badge + history)
 * This is safe to call on startup even if the notifications tab is closed.
 * @param {string} [academyId]
 */
window.fetchUnreadNotificationsAndSync = async function(academyId) {
  try {
    academyId = academyId || window.currentAcademyId || window.ACADEMY_ID || localStorage.getItem('current_academy_id');
    const userId = localStorage.getItem('user_id');
    if (!academyId) {
      console.warn('⚠️ fetchUnreadNotificationsAndSync: academyId not available');
      return;
    }

    // Build basic query
    let query = window.supabaseClient
      .from('notifications')
      .select('*')
      .eq('academy_id', academyId)
      .eq('is_read', false)
      .order('created_at', { ascending: false })
      .limit(100);

    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data: unread, error } = await safeSupabaseQuery(() => query, 'خطأ في جلب الإشعارات غير المقروءة', false);
    if (error) {
      console.error('❌ Error fetching unread notifications:', error);
      return;
    }

    const list = unread || [];
    // update global unread count (do not override if larger existing count)
    const unreadCount = list.length;
    if (typeof window.unreadNotificationCount !== 'number' || unreadCount > window.unreadNotificationCount) {
      window.unreadNotificationCount = unreadCount;
    }

    if (window.updateNotificationBadge) window.updateNotificationBadge();

    // Push to header history (dedupe by id)
    if (Array.isArray(list) && list.length && window.addToNotificationHistory) {
      list.forEach(n => {
        const emoji = n.type === 'withdrawal' ? '💳' : (n.type === 'danger' ? '⚠️' : '🔔');
        window.addToNotificationHistory(emoji, n.title || n.message || 'إشعار جديد', n.created_at, n.id);
      });
    }
    console.log('🔔 fetchUnreadNotificationsAndSync: synced', unreadCount, 'items to header');
    return list;
  } catch (e) {
    console.error('❌ fetchUnreadNotificationsAndSync failed:', e);
  }
};

