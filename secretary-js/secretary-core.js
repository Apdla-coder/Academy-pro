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
    
    // Disable realtime sync during initial load
    window.realtimeSyncEnabled = false;
    
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
    
    const { data, error } = await window.supabaseClient
      .from('courses')
      .select('*')
      .eq('academy_id', academyId);
    
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
    
    const { data, error } = await window.supabaseClient
      .from('students')
      .select('id, full_name, email, phone, address, birthdate, guardian_name, guardian_phone, notes')
      .eq('academy_id', window.currentAcademyId);
    
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
    
    const { count: studentsCount } = await window.supabaseClient
      .from('students')
      .select('id', { count: 'exact' })
      .eq('academy_id', window.currentAcademyId);
    
    const { count: coursesCount } = await window.supabaseClient
      .from('courses')
      .select('id', { count: 'exact' })
      .eq('academy_id', window.currentAcademyId);

    const { count: subscriptionsCount } = await window.supabaseClient
      .from('subscriptions')
      .select('id', { count: 'exact' })
      .eq('academy_id', window.currentAcademyId);
    
    if (document.getElementById('totalStudents')) {
      document.getElementById('totalStudents').textContent = studentsCount || 0;
    }
    if (document.getElementById('totalCourses')) {
      document.getElementById('totalCourses').textContent = coursesCount || 0;
    }
    if (document.getElementById('totalSubscriptions')) {
      document.getElementById('totalSubscriptions').textContent = subscriptionsCount || 0;
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
    
    const { data, error } = await window.supabaseClient
      .from('subscriptions')
      .select('*')
      .eq('academy_id', window.currentAcademyId);
    
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
    
    const { data, error } = await window.supabaseClient
      .from('attendance')
      .select('*')
      .eq('academy_id', window.currentAcademyId);
    
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
    
    if (tabName === 'dashboard') {
      // Dashboard loads its own data with cache checking
      if (typeof loadDashboardData === 'function') {
        loadDashboardData();
      }
    }
    else if (tabName === 'students') {
      // Only load if data is missing or stale
      if (needsDataRefresh('students') && typeof loadStudents === 'function') {
        loadStudents(false); // Use cache if available
      }
      // Render existing data immediately
      if (window.students && window.students.length > 0) {
        const container = document.getElementById('studentsContainer');
        if (container && typeof renderStudentsTable === 'function') {
          renderStudentsTable(window.students, container);
        }
      } else if (typeof loadStudentsTab === 'function') {
        loadStudentsTab();
      }
    }
    else if (tabName === 'courses') {
      // Only load if data is missing or stale
      if (needsDataRefresh('courses') && typeof loadCourses === 'function') {
        loadCourses(false); // Use cache if available
      }
      if (typeof loadCoursesTab === 'function') {
        loadCoursesTab();
      }
    }
    else if (tabName === 'subscriptions') {
      // Only load if data is missing or stale
      if (needsDataRefresh('subscriptions') && typeof loadSubscriptions === 'function') {
        loadSubscriptions(false); // Use cache if available
      }
      if (typeof loadSubscriptionsTab === 'function') {
        loadSubscriptionsTab();
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
      // Only load if data is missing or stale
      if (needsDataRefresh('payments') && typeof loadPayments === 'function') {
        loadPayments(false); // Use cache if available
      }
      if (typeof loadPaymentsTab === 'function') {
        loadPaymentsTab();
      }
    }
    else if (tabName === 'attendances') {
      // Only load if data is missing or stale
      if (needsDataRefresh('attendances') && typeof loadAttendance === 'function') {
        loadAttendance(false); // Use cache if available
      }
      if (typeof loadAttendancesTab === 'function') {
        loadAttendancesTab();
      }
    }
    else if (tabName === 'teacherExams') {
      if (typeof loadTeacherExams === 'function') {
        loadTeacherExams();
      }
    }
  } else {
    console.error('❌ Tab content not found:', tabName);
  }
}

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

    const cache = window.dataCache.students;
    const now = Date.now();
    if (!forceRefresh && cache.data && (now - cache.timestamp) < CACHE_DURATION) {
      window.students = cache.data;
      return;
    }

    const { data, error } = await window.supabaseClient
      .from('students')
      .select('id, full_name, email, phone, address, birthdate, guardian_name, guardian_phone, notes')
      .eq('academy_id', window.currentAcademyId)
      .order('created_at', { ascending: false });

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

    const cache = window.dataCache.courses;
    const now = Date.now();
    if (!forceRefresh && cache.data && (now - cache.timestamp) < CACHE_DURATION) {
      window.courses = cache.data;
      return;
    }

    const { data, error } = await window.supabaseClient
      .from('courses')
      .select('id, course_name, description, price, duration_months, modules_count')
      .eq('academy_id', window.currentAcademyId)
      .order('created_at', { ascending: false });

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

    const cache = window.dataCache.subscriptions;
    const now = Date.now();
    if (!forceRefresh && cache.data && (now - cache.timestamp) < CACHE_DURATION) {
      window.subscriptions = cache.data;
      return;
    }

    const { data, error } = await window.supabaseClient
      .from('subscriptions')
      .select(`
        id,
        student_id,
        course_id,
        status,
        subscribed_at,
        students(full_name),
        courses(name, price)
      `)
      .eq('academy_id', window.currentAcademyId)
      .order('subscribed_at', { ascending: false });

    if (error) throw error;
    
    // Transform data to match expected format
    const transformedData = (data || []).map(sub => ({
      ...sub,
      student_name: sub.students?.full_name || '-',
      course_name: sub.courses?.name || '-',
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

    const cache = window.dataCache.payments;
    const now = Date.now();
    if (!forceRefresh && cache.data && (now - cache.timestamp) < CACHE_DURATION) {
      window.payments = cache.data;
      return;
    }

    const { data, error } = await window.supabaseClient
      .from('payments')
      .select('*')
      .eq('academy_id', window.currentAcademyId)
      .order('payment_date', { ascending: false });

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

    const cache = window.dataCache.attendances;
    const now = Date.now();
    if (!forceRefresh && cache.data && (now - cache.timestamp) < CACHE_DURATION) {
      window.attendances = cache.data;
      return;
    }

    const { data, error } = await window.supabaseClient
      .from('attendance')
      .select('*')
      .eq('academy_id', window.currentAcademyId)
      .order('attendance_date', { ascending: false });

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
