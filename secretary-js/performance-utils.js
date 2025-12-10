// ============================================================
// Performance Utility - يزيل جميع console.log في production
// ============================================================

// تعطيل console.log في production (اترك التطوير فقط)
if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
  // في production: احفظ console.error فقط، أزل باقي
  const originalLog = console.log;
  const originalWarn = console.warn;
  
  console.log = function() { /* disabled */ };
  console.warn = function() { /* disabled */ };
  console.info = function() { /* disabled */ };
  
  // احتفظ بـ console.error فقط للأخطاء الحقيقية
  // console.error سيبقى كما هو
}

// ============================================================
// Tab Refresh System - تحديث تلقائي للتبويبات بعد التعديلات
// ============================================================

class TabRefreshManager {
  constructor() {
    this.refreshCallbacks = {
      students: [],
      courses: [],
      teacherExams: [],
      subscriptions: [],
      payments: [],
      attendances: [],
      dashboard: [],
      treasury: [],
      notifications: []
    };
  }

  // تسجيل دالة إعادة تحميل لتبويب معين
  onRefresh(tabName, callback) {
    if (this.refreshCallbacks[tabName]) {
      this.refreshCallbacks[tabName].push(callback);
    }
  }

  // تشغيل جميع دوال الإعادة لتبويب معين
  async refreshTab(tabName) {
    if (!this.refreshCallbacks[tabName]) return;
    
    try {
      for (const callback of this.refreshCallbacks[tabName]) {
        if (typeof callback === 'function') {
          await callback();
        }
      }
    } catch (error) {
      console.error(`❌ خطأ في تحديث تبويب ${tabName}:`, error);
    }
  }
}

// إنشاء instance عام
window.tabRefreshManager = new TabRefreshManager();

// ============================================================
// Debounce Helper - تقليل عدد الاستدعاءات
// ============================================================

function debounce(func, delay = 500) {
  let timeoutId;
  return function(...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(this, args), delay);
  };
}

// ============================================================
// Performance Monitor - قياس الأداء
// ============================================================

class PerformanceMonitor {
  constructor() {
    this.metrics = {};
  }

  start(name) {
    this.metrics[name] = performance.now();
  }

  end(name) {
    if (!this.metrics[name]) return;
    const duration = performance.now() - this.metrics[name];
    if (duration > 1000) {
      console.warn(`⚠️ العملية ${name} استغرقت ${duration.toFixed(2)}ms`);
    }
    delete this.metrics[name];
  }
}

window.perfMonitor = new PerformanceMonitor();

// ============================================================
// Cache Management - إدارة الذاكرة المؤقتة
// ============================================================

class CacheManager {
  constructor(ttl = 5 * 60 * 1000) { // 5 دقائق
    this.cache = {};
    this.ttl = ttl;
  }

  set(key, value) {
    this.cache[key] = {
      value,
      timestamp: Date.now()
    };
  }

  get(key) {
    if (!this.cache[key]) return null;
    
    const { value, timestamp } = this.cache[key];
    if (Date.now() - timestamp > this.ttl) {
      delete this.cache[key];
      return null;
    }
    
    return value;
  }

  clear() {
    this.cache = {};
  }

  invalidate(key) {
    delete this.cache[key];
  }
}

window.cacheManager = new CacheManager();

// ============================================================
// API Request Helper - تقليل الطلبات المتكررة
// ============================================================

const requestCache = new Map();

async function cachedSupabaseQuery(queryKey, queryFn, cacheDuration = 5000) {
  // التحقق من الـ cache
  if (requestCache.has(queryKey)) {
    const cached = requestCache.get(queryKey);
    if (Date.now() - cached.timestamp < cacheDuration) {
      return cached.data;
    }
    requestCache.delete(queryKey);
  }

  // تنفيذ الاستعلام
  try {
    const result = await queryFn();
    
    // حفظ في الـ cache
    requestCache.set(queryKey, {
      data: result,
      timestamp: Date.now()
    });

    // تنظيف الـ cache القديم
    if (requestCache.size > 50) {
      const firstKey = requestCache.keys().next().value;
      requestCache.delete(firstKey);
    }

    return result;
  } catch (error) {
    console.error(`❌ خطأ في ${queryKey}:`, error);
    throw error;
  }
}

// ============================================================
// Batch Operations - تجميع العمليات
// ============================================================

class BatchOperationQueue {
  constructor(batchSize = 10, delayMs = 100) {
    this.queue = [];
    this.batchSize = batchSize;
    this.delayMs = delayMs;
    this.isProcessing = false;
  }

  add(operation) {
    this.queue.push(operation);
    if (this.queue.length >= this.batchSize) {
      this.process();
    } else if (!this.isProcessing) {
      this.scheduleProcess();
    }
  }

  scheduleProcess() {
    setTimeout(() => this.process(), this.delayMs);
  }

  async process() {
    if (this.isProcessing || this.queue.length === 0) return;
    
    this.isProcessing = true;
    const batch = this.queue.splice(0, this.batchSize);
    
    try {
      await Promise.all(batch);
    } catch (error) {
      console.error('❌ خطأ في معالجة الدفعة:', error);
    }
    
    this.isProcessing = false;
    
    if (this.queue.length > 0) {
      this.scheduleProcess();
    }
  }
}

window.batchOperationQueue = new BatchOperationQueue();

// ============================================================
// Smart Loading Indicator
// ============================================================

let loadingTimeout;

window.showLoadingIndicator = function(message = 'جاري التحميل...', duration = null) {
  clearTimeout(loadingTimeout);
  
  let statusEl = document.getElementById('status');
  if (!statusEl) {
    statusEl = document.createElement('div');
    statusEl.id = 'status';
    document.body.appendChild(statusEl);
  }

  statusEl.innerHTML = `<div class="loading-indicator">${message}</div>`;
  statusEl.style.display = 'block';

  if (duration) {
    loadingTimeout = setTimeout(() => {
      statusEl.style.display = 'none';
    }, duration);
  }
};

window.hideLoadingIndicator = function() {
  clearTimeout(loadingTimeout);
  const statusEl = document.getElementById('status');
  if (statusEl) {
    statusEl.style.display = 'none';
  }
};

// ============================================================
// Export Functions
// ============================================================

window.performanceUtils = {
  debounce,
  PerformanceMonitor,
  CacheManager,
  TabRefreshManager,
  BatchOperationQueue,
  cachedSupabaseQuery
};
