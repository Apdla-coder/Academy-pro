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
  teachers: { data: null, timestamp: 0, loading: false }
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
  const existing = document.querySelector('.notification');
  if (existing) existing.remove();

  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.innerHTML = `
    <div class="notification-content">
      ${type === 'success' ? '✅' : type === 'error' ? '❌' : type === 'warning' ? '⚠️' : 'ℹ️'} 
      ${escapeHtml(message)}
    </div>
  `;
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    if (notification.parentNode) {
      notification.style.animation = 'fadeOut 0.3s ease-out';
      setTimeout(() => notification.remove(), 300);
    }
  }, duration);
}

window.showNotification = showNotification;

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.style.display = 'none';
}

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
