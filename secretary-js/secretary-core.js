'use strict';

// ============================================================================
// SECRETARY CORE - Master initialization, Supabase setup, global state
// ============================================================================

// === Supabase Configuration ===
const SUPABASE_URL = 'https://nhzbnzcdsebepsmrtona.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oemJuemNkc2ViZXBzbXJ0b25hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM2NjU4MTEsImV4cCI6MjA3OTI0MTgxMX0.wNSf49MpQjCCopByd3zCz4-TJ2EGGABc3-ICEsAPaFo';

// === Global State ===
window.supabaseClient = null;
window.currentAcademyId = null;
window.currentUserId = null;
window.userRole = null;
window.realtimeSyncEnabled = true; // Global flag for realtime sync control

window.students = [];
window.courses = [];
window.subscriptions = [];
window.payments = [];
window.attendances = [];
window.teachers = [];
window.modules = [];

// Data cache with timestamps (10 minutes cache)
window.dataCache = {
  students: { data: null, timestamp: 0, loading: false },
  courses: { data: null, timestamp: 0, loading: false },
  subscriptions: { data: null, timestamp: 0, loading: false },
  payments: { data: null, timestamp: 0, loading: false },
  attendances: { data: null, timestamp: 0, loading: false },
  teachers: { data: null, timestamp: 0, loading: false },
  treasury: { data: null, timestamp: 0, loading: false },
  notifications: { data: null, timestamp: 0, loading: false }
};

const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

// Function to clear cache
function clearDataCache(dataType = null) {
  if (dataType) {
    if (window.dataCache[dataType]) {
      window.dataCache[dataType] = { data: null, timestamp: 0, loading: false };
    }
  } else {
    // Clear all cache
    Object.keys(window.dataCache).forEach(key => {
      window.dataCache[key] = { data: null, timestamp: 0, loading: false };
    });
  }
  console.log('🗑️ Cache cleared:', dataType || 'all');
}
window.clearDataCache = clearDataCache;

// Memory cleanup function
function cleanupMemory() {
  const MAX_CACHE_AGE = 15 * 60 * 1000; // 15 minutes
  Object.keys(window.dataCache).forEach(key => {
    const cache = window.dataCache[key];
    if (cache.timestamp && (Date.now() - cache.timestamp) > MAX_CACHE_AGE) {
      cache.data = null;
      cache.timestamp = 0;
      console.log(`🧹 Cleaned cache for: ${key}`);
    }
  });
}

// Run cleanup every 5 minutes
setInterval(cleanupMemory, 5 * 60 * 1000);

// Academy access validation
function validateAcademyAccess(academyId) {
  const userAcademy = localStorage.getItem('current_academy_id');
  const profileAcademy = window.ACADEMY_ID;
  return userAcademy === academyId || profileAcademy === academyId;
}

function checkAcademyAccess() {
  const academyId = window.currentAcademyId || localStorage.getItem('current_academy_id');
  if (!academyId) {
    console.error('❌ No academy access');
    safeRedirect('select-academy.html');
    return false;
  }
  return true;
}

window.checkAcademyAccess = checkAcademyAccess;

let appInitialized = false;
let attendanceRefreshInterval = null;

// === Safe Redirect ===
function safeRedirect(url) {
  try {
    if (attendanceRefreshInterval) {
      clearInterval(attendanceRefreshInterval);
      attendanceRefreshInterval = null;
    }
    console.log('🔄 Redirecting to:', url);
    window.location.replace(url);
  } catch(e) {
    console.error('Redirect error:', e);
    setTimeout(() => { window.location.href = url; }, 100);
  }
}
window.safeRedirect = safeRedirect;

// === Supabase Initialization ===
(function() {
  try {
    if (!window.supabase || !window.supabase.createClient) {
      throw new Error('Supabase library not loaded');
    }
    
    const storage = {
      getItem: (key) => {
        try {
          const item = localStorage.getItem(key);
          return item;
        } catch (err) {
          console.error('Storage error:', err);
          return null;
        }
      },
      setItem: (key, value) => {
        try {
          localStorage.setItem(key, value);
        } catch (err) {
          console.error('Storage error:', err);
        }
      },
      removeItem: (key) => {
        try {
          localStorage.removeItem(key);
        } catch (err) {
          console.error('Storage error:', err);
        }
      }
    };
    
    const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        storage: storage,
        autoRefreshToken: true,
        persistSession: true
      }
    });
    
    window.supabaseClient = supabaseClient;
    console.log('✅ Supabase client initialized');
    
    // Setup auth monitor
    let authMonitorActive = false;
    supabaseClient.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' && authMonitorActive && document.readyState === 'complete') {
        console.error('❌ Session lost!');
        setTimeout(() => safeRedirect('index.html'), 1000);
      }
      if (!authMonitorActive) {
        authMonitorActive = true;
        console.log('✅ Auth monitor active');
      }
    });
    
  } catch (err) {
    console.error('❌ Supabase initialization failed:', err);
    alert('Database connection error: ' + (err?.message || 'Unknown'));
    setTimeout(() => safeRedirect('index.html'), 1000);
  }
})();

// === Main Initialization ===
document.addEventListener('DOMContentLoaded', async function() {
  if (appInitialized) {
    console.log('⚠️ Already initialized');
    return;
  }
  appInitialized = true;
  
  try {
    console.log('🔄 Starting app initialization...');
    
    // Wait for supabaseClient
    let waitCount = 0;
    while (!window.supabaseClient && waitCount < 50) {
      await new Promise(r => setTimeout(r, 100));
      waitCount++;
    }
    
    if (!window.supabaseClient) {
      throw new Error('Supabase client timeout');
    }
    
    // Get session
    const { data: { session } } = await window.supabaseClient.auth.getSession();
    if (!session) {
      console.error('🔴 No active session');
      safeRedirect('index.html');
      return;
    }
    
    window.currentUserId = session.user.id;
    console.log('✅ User ID:', window.currentUserId);
    
    // Load user data
    const { data: userData } = await window.supabaseClient
      .from('profiles')
      .select('id, full_name, role, avatar_url, academy_id')
      .eq('id', session.user.id)
      .maybeSingle();
    
    if (userData) {
      const userNameEl = document.getElementById('userName');
      if (userNameEl) userNameEl.textContent = userData.full_name || 'السكرتير';
      window.userRole = userData.role;
      
      if (userData.academy_id) {
        window.currentAcademyId = userData.academy_id;
        console.log('✅ Academy ID from profiles:', window.currentAcademyId);
      }
    }
    
    // Fallback: academy_members
    if (!window.currentAcademyId) {
      const { data: memberData } = await window.supabaseClient
        .from('academy_members')
        .select('academy_id')
        .eq('user_id', session.user.id)
        .maybeSingle();
      
      if (memberData?.academy_id) {
        window.currentAcademyId = memberData.academy_id;
        console.log('✅ Academy ID from members:', window.currentAcademyId);
      }
    }
    
    // Validate
    if (!window.currentAcademyId) {
      throw new Error('Failed to set academy ID');
    }
    
    console.log('✅ Initialization complete:', {
      userId: window.currentUserId,
      academyId: window.currentAcademyId
    });
    
    // Load initial data - جميع البيانات الأساسية (في parallel لتقليل الوقت)
    console.log('🔄 Loading all data...');
    showGlobalLoading('جاري تحميل البيانات...');
    
    // Disable realtime sync during initial load
    window.realtimeSyncEnabled = false;
    
    try {
      // Load all data in parallel
      await Promise.all([
        loadCoursesData(),
        loadStudentsData(),
        loadSubscriptionsData(),
        loadPaymentsData(),
        loadAttendanceData(),
        loadTeachers()
      ]);
      
      await loadDashboardStats();
      console.log('✅ All data loaded');
    } finally {
      hideGlobalLoading();
    }
    
    // Setup UI and form listeners
    if (typeof setupFormEventListeners === 'function') {
      setupFormEventListeners();
    } else {
      console.warn('⚠️ setupFormEventListeners not available yet');
    }
    
    // Enable realtime sync after initial load
    setTimeout(() => {
      window.realtimeSyncEnabled = true;
      if (typeof setupRealtimeSync === 'function') {
        setupRealtimeSync();
      } else {
        console.warn('⚠️ setupRealtimeSync not available yet');
      }
    }, 2000); // Wait 2 seconds after initial load
    
    switchTab('dashboard');
    
  } catch (error) {
    console.error('🔴 Init error:', error);
    alert('Error: ' + (error.message || 'Unknown'));
    safeRedirect('index.html');
  }
});

// === Initial Data Loaders ===
async function loadCoursesData() {
  try {
    const academyId = window.currentAcademyId || window.ACADEMY_ID || localStorage.getItem('current_academy_id');
    if (!academyId) {
      console.error('❌ Academy ID not set');
      return;
    }
    
    const { data, error } = await safeSupabaseQuery(
      () => window.supabaseClient
        .from('courses')
        .select('*')
        .eq('academy_id', academyId),
      'خطأ في تحميل الكورسات',
      false // Don't show global loading for individual loads
    );
    
    if (error) {
      console.error('❌ Error loading courses:', error.message);
      window.courses = [];
      return;
    }
    
    window.courses = data || [];
  } catch (error) {
    console.error('❌ Error loading courses:', error);
    window.courses = [];
  }
}

async function loadStudentsData() {
  try {
    if (!window.currentAcademyId) return;
    
    const { data, error } = await safeSupabaseQuery(
      () => window.supabaseClient
        .from('students')
        .select('id, full_name, email, phone, address, birthdate, guardian_name, guardian_phone, notes')
        .eq('academy_id', window.currentAcademyId),
      'خطأ في تحميل الطلاب',
      false
    );
    
    if (error) throw error;
    window.students = data || [];
    console.log('✅ Students loaded:', window.students.length);
  } catch (error) {
    console.error('❌ Error loading students:', error);
  }
}

async function loadDashboardStats() {
  try {
    if (!window.currentAcademyId) return;
    
    const [studentsResult, coursesResult, subscriptionsResult] = await Promise.all([
      safeSupabaseQuery(
        () => window.supabaseClient
          .from('students')
          .select('id', { count: 'exact', head: true })
          .eq('academy_id', window.currentAcademyId),
        'خطأ في تحميل إحصائيات الطلاب',
        false
      ),
      safeSupabaseQuery(
        () => window.supabaseClient
          .from('courses')
          .select('id', { count: 'exact', head: true })
          .eq('academy_id', window.currentAcademyId),
        'خطأ في تحميل إحصائيات الكورسات',
        false
      ),
      safeSupabaseQuery(
        () => window.supabaseClient
          .from('subscriptions')
          .select('id', { count: 'exact', head: true })
          .eq('academy_id', window.currentAcademyId),
        'خطأ في تحميل إحصائيات الاشتراكات',
        false
      )
    ]);
    
    const studentsCount = studentsResult.count || 0;
    const coursesCount = coursesResult.count || 0;
    const subscriptionsCount = subscriptionsResult.count || 0;
    
    if (document.getElementById('totalStudents')) {
      document.getElementById('totalStudents').textContent = studentsCount;
    }
    if (document.getElementById('totalCourses')) {
      document.getElementById('totalCourses').textContent = coursesCount;
    }
    if (document.getElementById('totalSubscriptions')) {
      document.getElementById('totalSubscriptions').textContent = subscriptionsCount;
    }

    console.log('✅ Dashboard stats updated:', { studentsCount, coursesCount, subscriptionsCount });
  } catch (error) {
    console.error('❌ Error loading dashboard stats:', error);
  }
}

// === Additional Data Loaders ===
async function loadSubscriptionsData() {
  try {
    if (!window.currentAcademyId) return;
    
    const { data, error } = await safeSupabaseQuery(
      () => window.supabaseClient
        .from('subscriptions')
        .select('*')
        .eq('academy_id', window.currentAcademyId),
      'خطأ في تحميل الاشتراكات',
      false
    );
    
    if (error) throw error;
    window.subscriptions = data || [];
    console.log('✅ Subscriptions loaded:', window.subscriptions.length);
  } catch (error) {
    console.error('❌ Error loading subscriptions:', error);
  }
}

async function loadPaymentsData() {
  try {
    if (!window.currentAcademyId) return;
    
    await loadPayments();
  } catch (error) {
    console.error('❌ Error loading payments:', error);
  }
}

async function loadAttendanceData() {
  try {
    if (!window.currentAcademyId) return;
    
    const { data, error } = await safeSupabaseQuery(
      () => window.supabaseClient
        .from('attendance')
        .select('*')
        .eq('academy_id', window.currentAcademyId),
      'خطأ في تحميل الحضور',
      false
    );
    
    if (error) throw error;
    window.attendances = data || [];
    console.log('✅ Attendance loaded:', window.attendances.length);
  } catch (error) {
    console.error('❌ Error loading attendance:', error);
  }
}

// === Tab Management ===
// Helper function to check if data needs refresh
function needsDataRefresh(dataType) {
  const cache = window.dataCache[dataType];
  if (!cache) return true;
  
  const now = Date.now();
  const isStale = (now - cache.timestamp) > CACHE_DURATION;
  const isEmpty = !window[dataType] || window[dataType].length === 0;
  
  return isEmpty || isStale;
}

function switchTab(tabName) {
  console.log('🔄 Tab switched to:', tabName);
  
  document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
  const activeTab = document.getElementById(`${tabName}Content`);
  if (activeTab) {
    activeTab.style.display = 'block';
    
    // Always refresh when switching tabs for fresh data
    if (tabName === 'dashboard') {
      // Dashboard loads its own data
      if (typeof loadDashboardData === 'function') {
        loadDashboardData();
      }
    }
    else if (tabName === 'students') {
      // Force refresh students tab
      if (window.tabRefreshManager) {
        window.tabRefreshManager.refreshTab('students');
      } else if (typeof loadStudentsTab === 'function') {
        loadStudentsTab();
      } else if (typeof loadStudents === 'function') {
        loadStudents(true); // Force refresh
      }
    }
    else if (tabName === 'courses') {
      // Force refresh courses tab
      if (window.tabRefreshManager) {
        window.tabRefreshManager.refreshTab('courses');
      } else if (typeof loadCoursesTab === 'function') {
        loadCoursesTab();
      } else if (typeof loadCourses === 'function') {
        loadCourses(true); // Force refresh
      }
    }
    else if (tabName === 'subscriptions') {
      // Force refresh subscriptions tab
      if (window.tabRefreshManager) {
        window.tabRefreshManager.refreshTab('subscriptions');
      } else if (typeof loadSubscriptionsTab === 'function') {
        loadSubscriptionsTab();
      } else if (typeof loadSubscriptions === 'function') {
        loadSubscriptions(true); // Force refresh
      } else {
        console.error('❌ loadSubscriptionsTab function not found!');
        const container = document.getElementById('subscriptionsContainer');
        if (container) {
          container.innerHTML = `
            <div style="padding: 40px; text-align: center; color: #ef4444;">
              <i class="fas fa-exclamation-triangle" style="font-size: 3rem; margin-bottom: 15px;"></i>
              <p>خطأ: loadSubscriptionsTab غير موجودة</p>
              <p style="font-size: 0.9rem;">يرجى التأكد من تحميل ملف subscriptions-tab-functions.js</p>
            </div>
          `;
        }
      }
    }
    else if (tabName === 'payments') {
      // Force refresh payments tab
      if (window.tabRefreshManager) {
        window.tabRefreshManager.refreshTab('payments');
      } else if (typeof loadPaymentsTab === 'function') {
        loadPaymentsTab();
      } else if (typeof loadPayments === 'function') {
        loadPayments(true); // Force refresh
      }
    }
    else if (tabName === 'attendances') {
      // Force refresh attendances tab
      if (window.tabRefreshManager) {
        window.tabRefreshManager.refreshTab('attendances');
      } else if (typeof loadAttendancesTab === 'function') {
        loadAttendancesTab();
      } else if (typeof loadAttendance === 'function') {
        loadAttendance(true); // Force refresh
      }
    }
    else if (tabName === 'teacherExams') {
      // Force refresh teacher exams tab
      if (window.tabRefreshManager) {
        window.tabRefreshManager.refreshTab('teacherExams');
      } else if (typeof loadTeacherExams === 'function') {
        loadTeacherExams();
      }
    }
  } else {
    console.error('❌ Tab content not found:', tabName);
  }
}

// Make switchTab globally available
window.switchTab = switchTab;

// === Global Loading Indicator ===
function showGlobalLoading(message = 'جاري التحميل...') {
  const indicator = document.getElementById('globalLoadingIndicator');
  const messageEl = document.getElementById('loadingMessage');
  if (indicator) {
    if (messageEl) messageEl.textContent = message;
    indicator.style.display = 'flex';
  }
}

function hideGlobalLoading() {
  const indicator = document.getElementById('globalLoadingIndicator');
  if (indicator) {
    indicator.style.display = 'none';
  }
}

window.showGlobalLoading = showGlobalLoading;
window.hideGlobalLoading = hideGlobalLoading;

// === Safe Supabase Query Wrapper ===
async function safeSupabaseQuery(queryFn, errorMessage = 'خطأ في الاستعلام', showLoading = true) {
  try {
    // Check if supabaseClient exists
    if (!window.supabaseClient) {
      console.error('❌ Supabase client not initialized');
      showNotification('Supabase client غير مهيأ', 'error');
      return { data: null, error: { message: 'Supabase client not initialized' } };
    }

    // Show loading if requested
    if (showLoading) {
      showGlobalLoading(errorMessage);
    }

    // Execute query
    const result = await queryFn();
    
    // Hide loading
    if (showLoading) {
      hideGlobalLoading();
    }

    // Check for errors
    if (result.error) {
      console.error('❌ Query error:', result.error);
      showNotification(errorMessage + ': ' + (result.error.message || 'خطأ غير معروف'), 'error');
    }

    return result;
  } catch (error) {
    // Hide loading on error
    if (showLoading) {
      hideGlobalLoading();
    }
    console.error('❌ Query exception:', error);
    showNotification(errorMessage + ': ' + (error.message || 'خطأ غير معروف'), 'error');
    return { data: null, error: error };
  }
}

window.safeSupabaseQuery = safeSupabaseQuery;

// === Utility Functions ===
function formatCurrency(amount) {
  const num = Number(amount) || 0;
  return num.toLocaleString('ar-EG', {
    style: 'currency',
    currency: 'EGP',
    minimumFractionDigits: 2
  }).replace('EGP', 'ج.م');
}

function formatDate(dateString) {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return isNaN(date) ? '-' : date.toLocaleDateString('ar-EG', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function showStatus(message, type = 'success') {
  const statusEl = document.getElementById('status');
  if (!statusEl) return;
  statusEl.textContent = message;
  statusEl.className = '';
  statusEl.classList.add('show', type);
  setTimeout(() => {
    statusEl.classList.remove('show');
  }, 3000);
}

// Enhanced notification system
function showNotification(message, type = 'info', duration = 3000) {
  const notificationContainer = document.getElementById('notificationContainer');
  if (!notificationContainer) {
    console.warn('Notification container not found');
    return;
  }

  const existing = notificationContainer.querySelector('.notification');
  if (existing) existing.remove();

  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.innerHTML = `
    <div class="notification-content">
      ${type === 'success' ? '✅' : type === 'error' ? '❌' : type === 'warning' ? '⚠️' : 'ℹ️'} 
      ${escapeHtml(message)}
    </div>
  `;
  
  notificationContainer.appendChild(notification);
  
  setTimeout(() => {
    if (notification.parentNode) {
      notification.style.animation = 'fadeOut 0.3s ease-out';
      setTimeout(() => notification.remove(), 300);
    }
  }, duration);
}

window.showNotification = showNotification;

// ============================================================================
// REAL-TIME ADMIN ACTION NOTIFICATIONS
// ============================================================================

window.unreadNotificationCount = 0;
let adminActionSubscriptions = [];

console.log('✅ Notification system initialized - Count: 0');

/**
 * Initialize real-time listeners for admin actions
 */
function setupAdminActionListeners(academyId) {
  if (!window.supabaseClient || !academyId) {
    console.warn('⚠️ Supabase client or academy ID not available');
    return;
  }

  // Clean up existing subscriptions
  cleanupAdminActionListeners();

  const tables = ['students', 'courses', 'payments', 'subscriptions', 'attendances', 'treasury_transactions', 'users'];
  const actionEmojis = {
    'students': '👥',
    'courses': '📚',
    'payments': '💰',
    'subscriptions': '📋',
    'attendances': '📅',
    'treasury_transactions': '💳',
    'users': '👤'
  };

  const actionMessages = {
    'students': {
      'INSERT': 'تم إضافة طالب جديد',
      'UPDATE': 'تم تحديث بيانات طالب',
      'DELETE': 'تم حذف طالب'
    },
    'courses': {
      'INSERT': 'تم إضافة كورس جديد',
      'UPDATE': 'تم تحديث الكورس',
      'DELETE': 'تم حذف الكورس'
    },
    'payments': {
      'INSERT': 'تم تسجيل دفعة جديدة',
      'UPDATE': 'تم تحديث الدفعة',
      'DELETE': 'تم حذف الدفعة'
    },
    'subscriptions': {
      'INSERT': 'تم إضافة اشتراك جديد',
      'UPDATE': 'تم تحديث الاشتراك',
      'DELETE': 'تم حذف الاشتراك'
    },
    'attendances': {
      'INSERT': 'تم تسجيل حضور',
      'UPDATE': 'تم تحديث الحضور',
      'DELETE': 'تم حذف الحضور'
    },
    'treasury_transactions': {
      'INSERT': 'معاملة خزينة جديدة',
      'UPDATE': 'تم تحديث المعاملة',
      'DELETE': 'تم حذف المعاملة'
    },
    'users': {
      'INSERT': 'مستخدم جديد تم إضافته',
      'UPDATE': 'تم تحديث المستخدم',
      'DELETE': 'تم حذف المستخدم'
    }
  };

  tables.forEach(table => {
    try {
      const subscription = window.supabaseClient
        .channel(`public:${table}`)
        .on('postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: table,
            filter: `academy_id=eq.${academyId}`
          },
          (payload) => {
            handleAdminAction(payload, table, actionMessages, actionEmojis);
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log(`✅ Listening for ${table} changes`);
          }
        });

      adminActionSubscriptions.push(subscription);
    } catch (error) {
      console.error(`❌ Error setting up listener for ${table}:`, error);
    }
  });

  // Also listen to the notifications table for inserts so header bell shows notifications
  try {
    const userId = localStorage.getItem('user_id');
    const notifSubscription = window.supabaseClient
      .channel(`public:notifications`)
      .on('postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `academy_id=eq.${academyId}`
        },
        (payload) => {
          try {
            const row = payload.new;
            if (!row) return;
            // If notification targets a specific user, ignore others
            if (row.user_id && userId && row.user_id !== userId) return;

            const emoji = row.type === 'withdrawal' ? '💳' : (row.type === 'danger' ? '⚠️' : '🔔');
            if (window.addToNotificationHistory) window.addToNotificationHistory(emoji, row.title || row.message || 'إشعار جديد', row.created_at, row.id);
            window.unreadNotificationCount = (window.unreadNotificationCount || 0) + 1;
            if (window.updateNotificationBadge) window.updateNotificationBadge();
            if (window.showAdminActionNotification) window.showAdminActionNotification(emoji, row.title || row.message || 'إشعار جديد', 'notification');
          } catch (e) {
            console.error('❌ Error handling notification insert payload', e);
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') console.log('✅ Listening for notifications table inserts');
      });

    adminActionSubscriptions.push(notifSubscription);
  } catch (err) {
    console.error('❌ Error setting up notifications table realtime listener:', err);
  }
}

/**
 * Handle incoming admin actions and display notifications
 */
function handleAdminAction(payload, table, actionMessages, actionEmojis) {
  const { eventType, new: newData, old: oldData } = payload;
  
  // Skip notifications for certain internal operations
  if (payload.new?.is_system_update === true) {
    return;
  }

  const message = actionMessages[table]?.[eventType] || `تم ${eventType} في ${table}`;
  const emoji = actionEmojis[table] || '🔔';

  // Increment unread count
  window.unreadNotificationCount++;
  console.log(`🔔 Notification count incremented to: ${window.unreadNotificationCount}`);
  
  updateNotificationBadge();

  // Show transient notification
  showAdminActionNotification(emoji, message, table);

  // Log admin action
  console.log(`🔔 Admin Action: ${emoji} ${message}`, payload);
}

/**
 * Display admin action notification with animation
 */
function showAdminActionNotification(emoji, message, table) {
  const notificationContainer = document.getElementById('notificationContainer');
  if (!notificationContainer) return;

  const notification = document.createElement('div');
  notification.className = 'notification notification-info admin-action-notification';
  notification.style.fontSize = '0.85rem';
  notification.style.padding = '8px 12px';
  notification.innerHTML = `
    <div class="notification-content" style="display: flex; align-items: center; gap: 5px;">
      <span style="font-size: 1.1rem;">${emoji}</span>
      <span>${message}</span>
    </div>
  `;

  // Remove existing admin action notification
  const existing = notificationContainer.querySelector('.admin-action-notification');
  if (existing) existing.remove();

  notificationContainer.appendChild(notification);

  // Add to history
  if (window.addToNotificationHistory) {
    window.addToNotificationHistory(emoji, message);
  }

  // Auto-remove after 5 seconds
  setTimeout(() => {
    if (notification.parentNode) {
      notification.style.animation = 'fadeOut 0.3s ease-out';
      setTimeout(() => notification.remove(), 300);
    }
  }, 5000);
}

/**
 * Update notification badge with count
 */
function updateNotificationBadge() {
  const badge = document.getElementById('notificationBadge');
  if (!badge) {
    console.warn('⚠️ Badge element not found');
    return;
  }

  console.log('📊 Badge update - Count:', window.unreadNotificationCount);
  
  // عرض الرقم دائماً
  const displayText = window.unreadNotificationCount > 99 ? '99+' : window.unreadNotificationCount;
  badge.textContent = displayText;
  badge.style.display = 'inline-flex';
  
  // تغيير اللون حسب عدد الإشعارات غير المقروءة
  if (window.unreadNotificationCount > 20) {
    badge.style.background = '#ef4444'; // أحمر فاقع للعدد الكبير
    badge.style.fontWeight = 'bold';
  } else if (window.unreadNotificationCount > 10) {
    badge.style.background = '#f97316'; // برتقالي للعدد المتوسط
    badge.style.fontWeight = '600';
  } else if (window.unreadNotificationCount > 0) {
    badge.style.background = '#10b981'; // أخضر للعدد الصغير
    badge.style.fontWeight = '500';
  } else {
    badge.style.background = '#6b7280'; // رمادي عندما لا توجد إشعارات
    badge.style.fontWeight = '400';
  }
  
  console.log('✅ Badge updated:', displayText);
}

/**
 * Clear notification count and badge
 */
function clearNotificationCount() {
  window.unreadNotificationCount = 0;
  updateNotificationBadge();
}

/**
 * Clean up all admin action listeners
 */
function cleanupAdminActionListeners() {
  adminActionSubscriptions.forEach(subscription => {
    try {
      window.supabaseClient.removeChannel(subscription);
    } catch (error) {
      console.error('❌ Error removing subscription:', error);
    }
  });
  adminActionSubscriptions = [];
}

// Set up listeners when app initializes
window.setupAdminActionListeners = setupAdminActionListeners;
window.clearNotificationCount = clearNotificationCount;
window.cleanupAdminActionListeners = cleanupAdminActionListeners;
window.showAdminActionNotification = showAdminActionNotification;
window.handleAdminAction = handleAdminAction;
window.updateNotificationBadge = updateNotificationBadge;

/**
 * Start notifications system when Supabase client and academy ID are ready.
 * This polls for up to ~10 seconds and then initializes listeners and initial sync.
 */
window.startNotificationSystem = function() {
  (async function waitAndStart() {
    const maxAttempts = 40; // ~10s with 250ms interval
    let attempt = 0;

    while (attempt < maxAttempts) {
      const sup = window.supabaseClient;
      const academyId = window.currentAcademyId || window.ACADEMY_ID || localStorage.getItem('current_academy_id');
      if (sup && academyId) {
        try {
          setupAdminActionListeners(academyId);
          console.log('🔔 startNotificationSystem: listeners initialized for', academyId);
        } catch (e) {
          console.error('❌ Error initializing listeners in startNotificationSystem:', e);
        }

        // Perform initial unread fetch/sync if helper exists
        try {
          if (typeof window.fetchUnreadNotificationsAndSync === 'function') {
            window.fetchUnreadNotificationsAndSync(academyId).catch(err => console.error('❌ fetchUnreadNotificationsAndSync error:', err));
          }
        } catch (e) {
          console.warn('⚠️ fetchUnreadNotificationsAndSync not present or failed', e);
        }

        return;
      }

      await new Promise(r => setTimeout(r, 250));
      attempt++;
    }

    console.warn('⚠️ startNotificationSystem timed out waiting for supabaseClient or academyId');
  })();
};

// Notification history tracking
window.notificationHistory = [];

/**
 * Add notification to history (dedup by id if provided)
 * @param {string} emoji
 * @param {string} message
 * @param {string|Date} timestamp
 * @param {string} [id]
 */
window.addToNotificationHistory = function(emoji, message, timestamp = new Date(), id = null) {
  // Deduplicate by id when available
  if (id) {
    const exists = window.notificationHistory.find(n => n.id === id);
    if (exists) return;
  }

  window.notificationHistory.unshift({
    id: id || null,
    emoji,
    message,
    timestamp
  });
  // Keep only last 50 notifications
  if (window.notificationHistory.length > 50) {
    window.notificationHistory.pop();
  }
  updateNotificationHistoryDisplay();
};

/**
 * Update notification history display in modal
 */
function updateNotificationHistoryDisplay() {
  const content = document.getElementById('notificationHistoryContent');
  if (!content) return;

  if (window.notificationHistory.length === 0) {
    content.innerHTML = `
      <i class="fas fa-bell-slash" style="font-size: 3rem; margin-bottom: 10px; opacity: 0.5;"></i>
      <p>لا توجد إشعارات جديدة</p>
    `;
    return;
  }

  const html = window.notificationHistory.map((notif, index) => {
    const time = notif.timestamp instanceof Date ?
      notif.timestamp.toLocaleString('ar-EG') :
      notif.timestamp;

    const isUnread = !notif.is_read;
    const borderStyle = isUnread ? 'border-right: 4px solid var(--danger); background: rgba(239,68,68,0.04);' : '';

    return `
      <div class="notification-card" style="padding: 14px; border-bottom: 1px solid rgba(255,255,255,0.03); text-align: right; cursor: pointer; transition: background 0.15s; ${borderStyle}" onclick="window._onNotificationHistoryClick('${notif.id || ''}')">
        <div style="display:flex; gap:12px; align-items:center;">
          <div style="width:48px; height:48px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:1.25rem; flex-shrink:0; background: rgba(0,0,0,0.06);">
            ${notif.emoji}
          </div>
          <div style="flex:1;">
            <div style="display:flex; justify-content:space-between; gap:10px; align-items:flex-start;">
              <div style="flex:1">
                <p style="margin:0; font-weight:700; color:var(--text-primary);">${escapeHtml(notif.message)}</p>
                <p style="margin:6px 0 0 0; font-size:0.85rem; color:var(--text-secondary);">${time}</p>
              </div>
              ${isUnread ? '<span style="display:inline-block; width:10px; height:10px; background: var(--danger); border-radius:50%; margin-left:8px"></span>' : ''}
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');

  content.innerHTML = html;
}

// Handle click on a history item: mark as read (optimistic) and call server-side mark if available
window._onNotificationHistoryClick = async function(id) {
  try {
    if (!id) return;
    // Optimistically mark in history
    const found = window.notificationHistory.find(n => n.id === id);
    if (found) found.is_read = true;
    updateNotificationHistoryDisplay();

    // Call server-side mark function if available
    if (typeof window.markNotificationAsRead === 'function') {
      try {
        await window.markNotificationAsRead(id);
      } catch (e) {
        console.warn('⚠️ markNotificationAsRead failed:', e);
      }
    }

    // Update badge count
    if (typeof window.updateNotificationBadge === 'function') {
      // recompute unread count from history where possible
      const unreadLocal = (window.notificationHistory || []).filter(n => !n.is_read).length;
      window.unreadNotificationCount = Math.max(0, unreadLocal);
      window.updateNotificationBadge();
    }
  } catch (e) {
    console.error('❌ _onNotificationHistoryClick error:', e);
  }
};

/**
 * Clear all notifications
 */
window.clearAllNotifications = function() {
  window.notificationHistory = [];
  window.unreadNotificationCount = 0;
  window.updateNotificationBadge();
  updateNotificationHistoryDisplay();
  console.log('🧹 All notifications cleared');
};

/**
 * Open notification history modal
 */
window.openNotificationHistory = function() {
  const modal = document.getElementById('notificationHistoryModal');
  if (modal) {
    updateNotificationHistoryDisplay();
    modal.style.display = 'flex';
  }
};

// Attach header modal buttons when opening
{ // Immediately run block to ensure functions exist
  const origOpen = window.openNotificationHistory;
  window.openNotificationHistory = function() {
    const modal = document.getElementById('notificationHistoryModal');
    if (modal) {
      updateNotificationHistoryDisplay();
      modal.style.display = 'flex';

      // Wire buttons
      const markBtn = document.getElementById('markAllAsReadBtn');
      if (markBtn) {
        markBtn.onclick = async function() {
          try {
            if (typeof window.markAllNotificationsAsRead === 'function') {
              await window.markAllNotificationsAsRead();
            }
          } catch (e) {
            console.warn('⚠️ markAllNotificationsAsRead error:', e);
          }
          // Update local history state
          window.notificationHistory.forEach(n => n.is_read = true);
          window.unreadNotificationCount = 0;
          if (window.updateNotificationBadge) window.updateNotificationBadge();
          updateNotificationHistoryDisplay();
        };
      }

      const delBtn = document.getElementById('deleteAllNotificationsBtn');
      if (delBtn) {
        delBtn.onclick = async function() {
          if (!confirm('هل أنت متأكد من حذف جميع الإشعارات؟')) return;

          // Prefer server-side deletion if exported
          if (typeof window.clearAllNotificationsDB === 'function') {
            try {
              await window.clearAllNotificationsDB();
              console.log('✅ clearAllNotificationsDB succeeded');
              // Local cleanup
              window.notificationHistory = [];
              window.unreadNotificationCount = 0;
              if (window.updateNotificationBadge) window.updateNotificationBadge();
              updateNotificationHistoryDisplay();
            } catch (e) {
              console.error('❌ clearAllNotificationsDB failed:', e);
              // Fallback to local clear
              window.notificationHistory = [];
              window.unreadNotificationCount = 0;
              if (window.updateNotificationBadge) window.updateNotificationBadge();
              updateNotificationHistoryDisplay();
              alert('حاول حذف الإشعارات من الخادم وفشل. تم مسح القائمة محلياً.');
            }
            return;
          }

          // Fallback: local-only clear
          if (typeof window.clearAllNotifications === 'function') {
            try {
              window.clearAllNotifications();
            } catch (e) {
              console.warn('⚠️ clearAllNotifications failed:', e);
              window.notificationHistory = [];
              window.unreadNotificationCount = 0;
              if (window.updateNotificationBadge) window.updateNotificationBadge();
              updateNotificationHistoryDisplay();
            }
          } else {
            window.notificationHistory = [];
            window.unreadNotificationCount = 0;
            if (window.updateNotificationBadge) window.updateNotificationBadge();
            updateNotificationHistoryDisplay();
          }
        };
      }
    }
  };
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.style.display = 'none';
}

/**
 * Stop notification visuals: remove badge animation, remove transient admin notifications
 */
window.stopNotificationVisuals = function() {
  try {
    const badge = document.getElementById('notificationBadge');
    if (badge) {
      badge.classList.remove('show');
      badge.style.display = 'none';
    }

    const container = document.getElementById('notificationContainer');
    if (container) {
      // remove transient admin-action-notification elements
      const transient = container.querySelectorAll('.admin-action-notification');
      transient.forEach(n => n.remove());
    }

    // Also remove small floating notifications if any
    const bodyNotifs = document.querySelectorAll('.notification');
    bodyNotifs.forEach(n => {
      // don't remove persistent history container children
      if (!n.classList.contains('admin-action-notification')) {
        n.remove();
      }
    });

    console.log('🔕 Notification visuals stopped');
  } catch (e) {
    console.error('❌ stopNotificationVisuals error:', e);
  }
};

function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.style.display = 'flex';
}

// Advanced search function
function advancedSearch(data, searchTerm, fields) {
  if (!searchTerm || searchTerm.trim() === '') return data;
  
  const term = searchTerm.toLowerCase().trim();
  return data.filter(item => 
    fields.some(field => {
      const value = item[field];
      if (value === null || value === undefined) return false;
      return value.toString().toLowerCase().includes(term);
    })
  );
}

window.advancedSearch = advancedSearch;

// Email validation
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

window.isValidEmail = isValidEmail;

// === Stub Functions (Placeholders) ===
async function loadStudents(forceRefresh = false) {
  try {
    if (!window.currentAcademyId) {
      console.error('❌ Academy ID not set');
      return;
    }

    // Skip cache check if force refresh is requested
    if (!forceRefresh) {
      const cache = window.dataCache.students;
      const now = Date.now();
      if (cache.data && (now - cache.timestamp) < CACHE_DURATION) {
        window.students = cache.data;
        return;
      }
    }

    const { data, error } = await safeSupabaseQuery(
      () => window.supabaseClient
        .from('students')
        .select('id, full_name, email, phone, address, birthdate, guardian_name, guardian_phone, notes, created_at')
        .eq('academy_id', window.currentAcademyId)
        .order('created_at', { ascending: false })
        .limit(1000), // Limit for performance
      'خطأ في تحميل الطلاب',
      false
    );

    if (error) throw error;
    
    window.students = data || [];
    window.dataCache.students = {
      data: data || [],
      timestamp: Date.now(),
      loading: false
    };
    
    console.log('✅ Students loaded:', window.students.length);
  } catch (error) {
    console.error('❌ Error loading students:', error);
  }
}

async function loadCourses(forceRefresh = false) {
  try {
    if (!window.currentAcademyId) {
      console.error('❌ Academy ID not set');
      return;
    }

    // Skip cache check if force refresh is requested
    if (!forceRefresh) {
      const cache = window.dataCache.courses;
      const now = Date.now();
      if (cache.data && (now - cache.timestamp) < CACHE_DURATION) {
        window.courses = cache.data;
        return;
      }
    }

    const { data, error } = await safeSupabaseQuery(
      () => window.supabaseClient
        .from('courses')
        .select('id, name, description, price, teacher_id, start_date, end_date, created_at, academy_id')
        .eq('academy_id', window.currentAcademyId)
        .order('created_at', { ascending: false })
        .limit(500), // Limit for performance
      'خطأ في تحميل الكورسات',
      false
    );

    if (error) throw error;
    
    window.courses = data || [];
    window.dataCache.courses = {
      data: data || [],
      timestamp: Date.now(),
      loading: false
    };
    
    console.log('✅ Courses loaded:', window.courses.length);
  } catch (error) {
    console.error('❌ Error loading courses:', error);
  }
}

async function loadSubscriptions(forceRefresh = false) {
  try {
    if (!window.currentAcademyId) {
      console.error('❌ Academy ID not set');
      return;
    }

    // Skip cache check if force refresh is requested
    if (!forceRefresh) {
      const cache = window.dataCache.subscriptions;
      const now = Date.now();
      if (cache.data && (now - cache.timestamp) < CACHE_DURATION) {
        window.subscriptions = cache.data;
        return;
      }
    }

    const { data, error } = await safeSupabaseQuery(
      () => window.supabaseClient
        .from('subscriptions')
        .select(`
          id,
          student_id,
          course_id,
          status,
          subscribed_at,
          created_at,
          students(full_name),
          courses(name, price)
        `)
        .eq('academy_id', window.currentAcademyId)
        .order('subscribed_at', { ascending: false })
        .limit(1000), // Limit for performance
      'خطأ في تحميل الاشتراكات',
      false
    );

    if (error) throw error;
    
    // Transform data to match expected format
    const transformedData = (data || []).map(sub => ({
      ...sub,
      student_name: sub.students?.full_name || '-',
      course_name: sub.courses?.name || sub.courses?.course_name || '-',
      course_price: sub.courses?.price || 0,
      start_date: sub.subscribed_at,
      end_date: null
    }));
    
    window.subscriptions = transformedData;
    window.dataCache.subscriptions = {
      data: transformedData,
      timestamp: Date.now(),
      loading: false
    };
    
    console.log('✅ Subscriptions loaded:', window.subscriptions.length);
  } catch (error) {
    console.error('❌ Error loading subscriptions:', error);
  }
}

async function loadPayments(forceRefresh = false) {
  try {
    if (!window.currentAcademyId) {
      console.error('❌ Academy ID not set');
      return;
    }

    // Skip cache check if force refresh is requested
    if (!forceRefresh) {
      const cache = window.dataCache.payments;
      const now = Date.now();
      if (cache.data && (now - cache.timestamp) < CACHE_DURATION) {
        window.payments = cache.data;
        return;
      }
    }

    const { data, error } = await safeSupabaseQuery(
      () => window.supabaseClient
        .from('payments')
        .select('id, student_id, course_id, amount, payment_method, payment_date, status, created_at, academy_id')
        .eq('academy_id', window.currentAcademyId)
        .order('payment_date', { ascending: false })
        .limit(1000), // Limit for performance
      'خطأ في تحميل المدفوعات',
      false
    );

    if (error) throw error;
    
    window.payments = data || [];
    window.dataCache.payments = {
      data: data || [],
      timestamp: Date.now(),
      loading: false
    };
    
    console.log('✅ Payments loaded:', window.payments.length);
  } catch (error) {
    console.error('❌ Error loading payments:', error);
  }
}

async function loadAttendance(forceRefresh = false) {
  try {
    if (!window.currentAcademyId) {
      console.error('❌ Academy ID not set');
      return;
    }

    // Skip cache check if force refresh is requested (shorter cache for attendance - 2 minutes)
    const ATTENDANCE_CACHE = 2 * 60 * 1000; // 2 minutes
    if (!forceRefresh) {
      const cache = window.dataCache.attendances;
      const now = Date.now();
      if (cache.data && (now - cache.timestamp) < ATTENDANCE_CACHE) {
        window.attendances = cache.data;
        return;
      }
    }

    // Use select('*') to avoid column name issues
    const { data, error } = await safeSupabaseQuery(
      () => window.supabaseClient
        .from('attendance')
        .select('*')
        .eq('academy_id', window.currentAcademyId)
        .order('created_at', { ascending: false })
        .limit(1000),
      'خطأ في تحميل الحضور',
      false
    );

    if (error) throw error;
    
    window.attendances = data || [];
    window.dataCache.attendances = {
      data: data || [],
      timestamp: Date.now(),
      loading: false
    };
    
    console.log('✅ Attendance loaded:', window.attendances.length);
  } catch (error) {
    console.error('❌ Error loading attendance:', error);
  }
}

async function loadTeachers(forceRefresh = false) {
  try {
    console.log('🔄 loadTeachers called - forceRefresh:', forceRefresh);

    const cache = window.dataCache.teachers = window.dataCache.teachers || {};
    const now = Date.now();
    if (!forceRefresh && cache.data && (now - cache.timestamp) < CACHE_DURATION) {
      window.teachers = cache.data;
      console.log('✅ Teachers from cache:', window.teachers.length);
      return;
    }

    console.log('🔄 Fetching teachers...');

    const academyId = window.currentAcademyId || window.ACADEMY_ID || localStorage.getItem('current_academy_id');
    
    // Try to get teachers by academy_id first
    let query = window.supabaseClient
      .from('profiles')
      .select('*');
    
    if (academyId) {
      query = query.eq('academy_id', academyId);
    }
    
    query = query.limit(100);

    const { data: allProfiles, error: allError } = await safeSupabaseQuery(
      () => query,
      'خطأ في تحميل المعلمين',
      false
    );

    console.log('📊 ALL PROFILES IN DATABASE:', {
      count: allProfiles?.length || 0,
      error: allError,
      data: allProfiles
    });

    if (allError) {
      console.error('❌ Error fetching profiles:', allError);
      window.teachers = [];
    } else {
      // Filter profiles to get teachers
      // Teachers should have specialty or role='teacher'
      const teachers = (allProfiles || []).filter(p => {
        const hasSpecialty = p.specialty && p.specialty !== 'غير محدد' && p.specialty !== null;
        const isTeacherRole = p.role === 'teacher' || p.role === 'instructor';
        return hasSpecialty || isTeacherRole || p.full_name; // At minimum, has a name
      });

      console.log('✅ FILTERED TEACHERS:', {
        total: teachers.length,
        teachers: teachers.map(t => ({
          id: t.id,
          name: t.full_name,
          email: t.email,
          specialty: t.specialty,
          role: t.role
        }))
      });

      window.teachers = teachers;
    }

    window.dataCache.teachers = {
      data: window.teachers,
      timestamp: Date.now(),
      loading: false
    };

    console.log('✅ loadTeachers completed. Teachers count:', window.teachers.length);
  } catch (error) {
    console.error('❌ Error in loadTeachers:', error);
    window.teachers = [];
  }
}
