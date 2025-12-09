// ============================================================
// Auto-Refresh System - تحديث تلقائي للبيانات بعد أي تعديل
// ============================================================

// تسجيل دوال التحديث للتبويبات المختلفة
function registerTabRefreshFunctions() {
  
  // تحديث Students
  window.tabRefreshManager.onRefresh('students', async () => {
    try {
      window.perfMonitor.start('refresh_students');
      clearDataCache('students');
      await loadStudents();
      
      const container = document.getElementById('studentsContainer');
      if (container) {
        renderStudentsTable(window.students || [], container);
      }
      window.perfMonitor.end('refresh_students');
    } catch (error) {
      console.error('❌ خطأ في تحديث الطلاب:', error);
    }
  });

  // تحديث Courses
  window.tabRefreshManager.onRefresh('courses', async () => {
    try {
      window.perfMonitor.start('refresh_courses');
      clearDataCache('courses');
      await loadCourses();
      
      const container = document.getElementById('coursesContainer');
      if (container) {
        const coursesData = window.courses || [];
        renderCoursesTable(coursesData, container);
        
        // تحديث الإحصائيات - تمرير البيانات بشكل صريح
        updateCoursesStats(coursesData);
      }
      window.perfMonitor.end('refresh_courses');
    } catch (error) {
      console.error('❌ خطأ في تحديث الكورسات:', error);
    }
  });

  // تحديث Subscriptions
  window.tabRefreshManager.onRefresh('subscriptions', async () => {
    try {
      window.perfMonitor.start('refresh_subscriptions');
      clearDataCache('subscriptions');
      await loadSubscriptions();
      
      const container = document.getElementById('subscriptionsContainer');
      if (container) {
        renderSubscriptionsTable(window.subscriptions || [], container);
      }
      window.perfMonitor.end('refresh_subscriptions');
    } catch (error) {
      console.error('❌ خطأ في تحديث الاشتراكات:', error);
    }
  });

  // تحديث Payments
  window.tabRefreshManager.onRefresh('payments', async () => {
    try {
      window.perfMonitor.start('refresh_payments');
      clearDataCache('payments');
      await loadPayments();
      
      // Call the proper render function for payments
      if (typeof renderPaymentsByCourse === 'function') {
        renderPaymentsByCourse();
      }
      window.perfMonitor.end('refresh_payments');
    } catch (error) {
      console.error('❌ خطأ في تحديث المدفوعات:', error);
    }
  });

  // تحديث Attendances
  window.tabRefreshManager.onRefresh('attendances', async () => {
    try {
      window.perfMonitor.start('refresh_attendances');
      clearDataCache('attendances');
      await loadAttendance(); // Use loadAttendance instead of loadAttendances
      
      const container = document.getElementById('attendancesContainer');
      if (container && typeof renderAttendanceTable === 'function') {
        renderAttendanceTable(window.attendances || [], container);
        if (typeof updateAttendanceStats === 'function') {
          updateAttendanceStats(window.attendances || []);
        }
      }
      window.perfMonitor.end('refresh_attendances');
    } catch (error) {
      console.error('❌ خطأ في تحديث الحضور:', error);
    }
  });

  // تحديث Teacher Exams
  window.tabRefreshManager.onRefresh('teacherExams', async () => {
    try {
      window.perfMonitor.start('refresh_exams');
      clearDataCache('exams');
      // loadTeacherExams() already calls renderTeacherExams() internally
      await loadTeacherExams();
      window.perfMonitor.end('refresh_exams');
    } catch (error) {
      console.error('❌ خطأ في تحديث الاختبارات:', error);
    }
  });

  // تحديث Dashboard
  window.tabRefreshManager.onRefresh('dashboard', async () => {
    try {
      window.perfMonitor.start('refresh_dashboard');
      await loadDashboardData();
      window.perfMonitor.end('refresh_dashboard');
    } catch (error) {
      console.error('❌ خطأ في تحديث لوحة البيانات:', error);
    }
  });
}

// استدعاء دالة التسجيل عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', registerTabRefreshFunctions);

// ============================================================
// Wrapper Functions - وظائف محسّنة مع التحديث التلقائي
// ============================================================

// حفظ طالب جديد مع تحديث تلقائي
async function saveStudentWithRefresh(studentData) {
  try {
    window.showLoadingIndicator('جاري حفظ بيانات الطالب...');
    
    const result = await saveStudent(studentData);
    
    // تحديث التبويب تلقائياً
    await window.tabRefreshManager.refreshTab('students');
    
    window.hideLoadingIndicator();
    showStatus('✅ تم حفظ الطالب بنجاح', 'success');
    
    return result;
  } catch (error) {
    window.hideLoadingIndicator();
    showStatus('❌ خطأ في حفظ الطالب', 'error');
    throw error;
  }
}

// حفظ كورس جديد مع تحديث تلقائي
async function saveCourseWithRefresh(courseData) {
  try {
    window.showLoadingIndicator('جاري حفظ الكورس...');
    
    const result = await saveCourse(courseData);
    
    // تحديث التبويب تلقائياً
    await window.tabRefreshManager.refreshTab('courses');
    
    window.hideLoadingIndicator();
    showStatus('✅ تم حفظ الكورس بنجاح', 'success');
    
    return result;
  } catch (error) {
    window.hideLoadingIndicator();
    showStatus('❌ خطأ في حفظ الكورس', 'error');
    throw error;
  }
}

// حفظ اشتراك جديد مع تحديث تلقائي
async function saveSubscriptionWithRefresh(subscriptionData) {
  try {
    window.showLoadingIndicator('جاري حفظ الاشتراك...');
    
    const result = await saveSubscription(subscriptionData);
    
    // تحديث التبويبات المتأثرة
    await window.tabRefreshManager.refreshTab('subscriptions');
    await window.tabRefreshManager.refreshTab('payments');
    
    window.hideLoadingIndicator();
    showStatus('✅ تم حفظ الاشتراك بنجاح', 'success');
    
    return result;
  } catch (error) {
    window.hideLoadingIndicator();
    showStatus('❌ خطأ في حفظ الاشتراك', 'error');
    throw error;
  }
}

// حفظ دفعة جديدة مع تحديث تلقائي
async function savePaymentWithRefresh(paymentData) {
  try {
    window.showLoadingIndicator('جاري حفظ الدفعة...');
    
    const result = await savePayment(paymentData);
    
    // تحديث التبويبات المتأثرة
    await window.tabRefreshManager.refreshTab('payments');
    await window.tabRefreshManager.refreshTab('subscriptions');
    
    window.hideLoadingIndicator();
    showStatus('✅ تم حفظ الدفعة بنجاح', 'success');
    
    return result;
  } catch (error) {
    window.hideLoadingIndicator();
    showStatus('❌ خطأ في حفظ الدفعة', 'error');
    throw error;
  }
}

// ============================================================
// Optimized Render Functions - دوال عرض محسّنة
// ============================================================

// تقليل عدد re-renders باستخدام Virtual Scrolling للجداول الكبيرة
const renderOptimized = debounce(function(container, renderFunction, data) {
  if (container && data) {
    renderFunction(data, container);
  }
}, 300);

// ============================================================
// Lazy Loading for Large Lists
// ============================================================

class LazyListRenderer {
  constructor(container, data, itemsPerPage = 50) {
    this.container = container;
    this.data = data;
    this.itemsPerPage = itemsPerPage;
    this.currentPage = 0;
  }

  render() {
    const start = this.currentPage * this.itemsPerPage;
    const end = start + this.itemsPerPage;
    const pageData = this.data.slice(start, end);
    
    if (this.currentPage === 0) {
      this.container.innerHTML = '';
    }

    pageData.forEach(item => {
      this.container.appendChild(this.createItemElement(item));
    });

    this.currentPage++;
    return this.currentPage * this.itemsPerPage < this.data.length;
  }

  createItemElement(item) {
    // يجب أن يتم تعريف هذه الدالة حسب نوع العنصر
    const el = document.createElement('div');
    el.textContent = JSON.stringify(item);
    return el;
  }

  reset() {
    this.currentPage = 0;
    this.container.innerHTML = '';
  }
}

// ============================================================
// Export Auto-Refresh Functions
// ============================================================

window.autoRefresh = {
  saveStudentWithRefresh,
  saveCourseWithRefresh,
  saveSubscriptionWithRefresh,
  savePaymentWithRefresh,
  registerTabRefreshFunctions,
  LazyListRenderer
};
