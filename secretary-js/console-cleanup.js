// ============================================================
// Remove Console Logs - إزالة جميع console.log في production
// ============================================================

// تعطيل console في production
(function() {
  const isProduction = !['localhost', '127.0.0.1'].includes(window.location.hostname);
  
  if (isProduction) {
    // حفظ console.error فقط
    const originalError = console.error;
    
    // تعطيل باقي الـ console methods
    console.log = function() {};
    console.warn = function() {};
    console.info = function() {};
    console.debug = function() {};
    console.trace = function() {};
    
    // إبقاء console.error للأخطاء الحقيقية فقط
    console.error = function(...args) {
      // فقط الأخطاء الحقيقية، تجاهل التحذيرات
      if (args[0]?.toString().includes('Error') || args[0]?.toString().includes('❌')) {
        originalError.apply(console, args);
      }
    };
  }
})();

// ============================================================
// منع Realtime Listeners الزائدة
// ============================================================

window.activeListeners = new Map();

function createOptimizedListener(channel, callback) {
  // إذا كان هناك listener نشط، ألغِه
  if (window.activeListeners.has(channel)) {
    const old = window.activeListeners.get(channel);
    if (old && typeof old.unsubscribe === 'function') {
      old.unsubscribe();
    }
  }

  // إنشاء listener جديد مع debounce
  const debouncedCallback = debounce(callback, 1000);
  const listener = supabaseClient
    .channel(channel)
    .on('*', payload => debouncedCallback(payload))
    .subscribe();

  window.activeListeners.set(channel, listener);
  return listener;
}

// تنظيف listeners عند الخروج
window.addEventListener('beforeunload', () => {
  window.activeListeners.forEach((listener, channel) => {
    if (listener && typeof listener.unsubscribe === 'function') {
      listener.unsubscribe();
    }
  });
  window.activeListeners.clear();
});

// ============================================================
// تقليل الطلبات المتكررة
// ============================================================

const requestDeduplicator = new Map();

async function deduplicatedRequest(key, requestFn) {
  // إذا كان هناك طلب معلق بنفس المفتاح، انتظره
  if (requestDeduplicator.has(key)) {
    return requestDeduplicator.get(key);
  }

  // تنفيذ الطلب وحفظ Promise
  const promise = requestFn()
    .finally(() => {
      // حذف من الـ map بعد الانتهاء
      requestDeduplicator.delete(key);
    });

  requestDeduplicator.set(key, promise);
  return promise;
}

// ============================================================
// Optimize DOM Updates
// ============================================================

const domUpdateQueue = new Map();

function batchDOMUpdate(key, updateFn, delay = 100) {
  if (domUpdateQueue.has(key)) {
    clearTimeout(domUpdateQueue.get(key).timeout);
  }

  const timeout = setTimeout(() => {
    updateFn();
    domUpdateQueue.delete(key);
  }, delay);

  domUpdateQueue.set(key, { timeout });
}

// ============================================================
// Memory Optimization
// ============================================================

// تنظيف الذاكرة من البيانات القديمة
setInterval(() => {
  // مسح البيانات المؤقتة الكبيرة
  if (window.cachedImages) {
    const now = Date.now();
    Object.keys(window.cachedImages).forEach(key => {
      if (now - window.cachedImages[key].timestamp > 60 * 60 * 1000) {
        delete window.cachedImages[key];
      }
    });
  }

  // مسح الـ request cache
  if (window.requestCache) {
    const now = Date.now();
    [...window.requestCache.entries()].forEach(([key, value]) => {
      if (now - value.timestamp > 5 * 60 * 1000) {
        window.requestCache.delete(key);
      }
    });
  }
}, 5 * 60 * 1000); // كل 5 دقائق

// ============================================================
// Disable Heavy Operations
// ============================================================

// تعطيل الحركات الثقيلة في development
if (window.location.hostname !== 'localhost') {
  // تقليل عدد animations
  document.documentElement.style.setProperty('--animation-duration', '0.2s');
  
  // تقليل transition duration
  const style = document.createElement('style');
  style.textContent = `
    * {
      animation-duration: 0.1s !important;
      transition-duration: 0.1s !important;
    }
  `;
  document.head.appendChild(style);
}

// ============================================================
// Monitor Performance
// ============================================================

if (window.location.hostname === 'localhost') {
  // في development: اعرض تحذيرات الأداء
  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (entry.duration > 1000) {
        console.warn(`⚠️ Slow operation: ${entry.name} took ${entry.duration.toFixed(2)}ms`);
      }
    }
  });

  observer.observe({ entryTypes: ['measure', 'navigation'] });
}
