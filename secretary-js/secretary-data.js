'use strict';

// ============================================================================
// SECRETARY DATA - Data loading and management functions
// ============================================================================

// === Students Data ===
let studentsLoading = false;
// realtimeSyncEnabled is now managed globally via window.realtimeSyncEnabled

async function loadStudents(forceRefresh = false) {
  try {
    if (studentsLoading) return; // Prevent duplic
    // ate requests
    
    // Check cache
    const cache = window.dataCache.students;
    const now = Date.now();
    if (!forceRefresh && cache.data && (now - cache.timestamp) < CACHE_DURATION) {
      window.students = cache.data;
      const container = document.getElementById('studentsContainer');
      if (container && typeof renderStudentsTable === 'function') {
        renderStudentsTable(cache.data, container);
      }
      return;
    }
    
    if (studentsLoading) return;
    studentsLoading = true;
    
    if (!window.currentAcademyId) {
      console.error('❌ Academy ID not set');
      studentsLoading = false;
      return;
    }
    
    const container = document.getElementById('studentsContainer');
    if (container) {
      container.innerHTML = `
        <div class="loading">
          <div class="loading-spinner"></div>
          <p>جارٍ تحميل بيانات الطلاب...</p>
        </div>
      `;
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
    
    console.log('📊 Raw data from DB:', data?.length, 'records');
    data?.forEach((s, i) => console.log(`  [${i}] ID: ${s.id}, Name: ${s.full_name}, Email: ${s.email}`));
    
    // Remove duplicates by ID
    const uniqueData = [];
    const seenIds = new Set();
    (data || []).forEach(student => {
      if (!seenIds.has(student.id)) {
        seenIds.add(student.id);
        uniqueData.push(student);
      } else {
        console.warn('⚠️ Duplicate ID found:', student.id);
      }
    });
    
    if (uniqueData.length !== data.length) {
      console.warn('⚠️ Duplicates removed:', data.length - uniqueData.length);
    }
    
    window.students = uniqueData || [];
    
    // Update cache
    window.dataCache.students = {
      data: uniqueData,
      timestamp: Date.now(),
      loading: false
    };
    
    if (container) {
      renderStudentsTable(uniqueData, container);
    }
    console.log('✅ Students loaded:', uniqueData.length);
  } catch (error) {
    console.error('❌ Error loading students:', error);
    showStatus('خطأ في تحميل الطلاب', 'error');
  } finally {
    studentsLoading = false;
  }
}

function renderStudentsTable(data, container) {
  console.log('🔄 renderStudentsTable called with', data.length, 'students');
  
  let html = `
    <div style="padding: 20px;">
      <div style="display: flex; gap: 10px; margin-bottom: 25px; flex-wrap: wrap;">
        <button class="btn btn-primary" onclick="showAddStudentModal()" style="display: flex; align-items: center; gap: 8px;">
          <i class="fas fa-plus"></i> إضافة طالب
        </button>
        <button class="btn btn-success" onclick="exportStudentsExcel()" style="display: flex; align-items: center; gap: 8px;">
          <i class="fas fa-file-excel"></i> تحميل البيانات
        </button>
        <button class="btn btn-info" onclick="printStudents()" style="display: flex; align-items: center; gap: 8px;">
          <i class="fas fa-print"></i> طباعة
        </button>
      </div>`;

  if (!data || data.length === 0) {
    html += '<div style="text-align: center; padding: 60px 20px;"><p style="color: var(--text-light); font-size: 1.1em;">📚 لا توجد بيانات طلاب</p></div>';
  } else {
    html += `<div class="students-container" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(380px, 1fr)); gap: 20px;">`;
    
    data.forEach(student => {
      const subscriptions = (window.subscriptions || []).filter(s => s.student_id === student.id);
      const payments = (window.payments || []).filter(p => p.student_id === student.id);
      const totalPayments = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
      
      const coursesList = subscriptions
        .map(sub => {
          const course = (window.courses || []).find(c => c.id === sub.course_id);
          return course ? course.name : 'غير معروف';
        })
        .filter((v, i, a) => a.indexOf(v) === i)
        .join(', ');
      
      const totalSubscriptionCost = subscriptions.reduce((sum, sub) => {
        const course = (window.courses || []).find(c => c.id === sub.course_id);
        return sum + (course ? course.price || 0 : 0);
      }, 0);
      
      const remaining = totalSubscriptionCost - totalPayments;
      const paymentPercentage = totalSubscriptionCost > 0 ? (totalPayments / totalSubscriptionCost) * 100 : 0;
      
      html += `
        <div style="
          background: var(--bg-card);
          border-radius: var(--radius-md);
          padding: 20px;
          box-shadow: var(--shadow-md);
          transition: all 0.3s ease;
          border-right: 4px solid #3B82F6;
          cursor: pointer;
          border: 1px solid rgba(148, 163, 184, 0.1);
        " class="student-card" onmouseover="this.style.boxShadow='var(--shadow-lg)'; this.style.transform='translateY(-3px)';" onmouseout="this.style.boxShadow='var(--shadow-md)'; this.style.transform='translateY(0)';">
          
          <!-- Header with student name -->
          <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 15px; border-bottom: 2px solid rgba(148, 163, 184, 0.1); padding-bottom: 12px;">
            <div>
              <h3 style="margin: 0; color: #F1F5F9; font-size: 1.2em; font-weight: 700;">${escapeHtml(student.full_name)}</h3>
              <p style="margin: 5px 0 0 0; color: #CBD5E1; font-size: 0.9em;">🆔 ${student.id.substring(0, 8)}...</p>
            </div>
            <span style="background: #3B82F6; color: white; padding: 6px 12px; border-radius: var(--radius-sm); font-size: 0.85em; font-weight: 600;">
              ${subscriptions.length} اشتراك
            </span>
          </div>

          <!-- Contact Information -->
          <div style="background: var(--bg-secondary); padding: 12px; border-radius: var(--radius-md); margin-bottom: 15px; border: 1px solid rgba(148, 163, 184, 0.1);">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 0.9em;">
              <div>
                <p style="margin: 0 0 3px 0; color: #CBD5E1;"><strong>📧 البريد:</strong></p>
                <p style="margin: 0; color: #F1F5F9; word-break: break-all;">${escapeHtml(student.email || '-')}</p>
              </div>
              <div>
                <p style="margin: 0 0 3px 0; color: #CBD5E1;"><strong>📱 الهاتف:</strong></p>
                <p style="margin: 0; color: #F1F5F9;">${escapeHtml(student.phone || '-')}</p>
              </div>
            </div>
            ${student.guardian_name ? `
              <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid rgba(148, 163, 184, 0.1);">
                <p style="margin: 0 0 3px 0; color: #CBD5E1;"><strong> ولي الأمر:</strong></p>
                <p style="margin: 0; color: #F1F5F9;">${escapeHtml(student.guardian_name)} ${student.guardian_phone ? `(${student.guardian_phone})` : ''}</p>
              </div>
            ` : ''}
          </div>

          <!-- Courses -->
          ${coursesList ? `
            <div style="margin-bottom: 15px;">
              <p style="margin: 0 0 8px 0; color: #CBD5E1; font-weight: 600;">📚 الكورسات:</p>
              <div style="background: rgba(59, 130, 246, 0.1); padding: 10px; border-radius: var(--radius-sm); font-size: 0.9em; color: #F1F5F9; max-height: 60px; overflow-y: auto; border: 1px solid rgba(59, 130, 246, 0.2);">
                ${coursesList}
              </div>
            </div>
          ` : ''}

          <!-- Financial Stats -->
          <div style="background: var(--bg-secondary); padding: 12px; border-radius: var(--radius-md); margin-bottom: 15px; border: 1px solid rgba(148, 163, 184, 0.1);">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 0.9em;">
              <div>
                <p style="margin: 0 0 3px 0; color: #CBD5E1;">💰 الإجمالي</p>
                <p style="margin: 0; color: #3B82F6; font-weight: 700; font-size: 1.1em;">${formatCurrency(totalSubscriptionCost)}</p>
              </div>
              <div>
                <p style="margin: 0 0 3px 0; color: #CBD5E1;">✅ المدفوع</p>
                <p style="margin: 0; color: #10B981; font-weight: 700; font-size: 1.1em;">${formatCurrency(totalPayments)}</p>
              </div>
            </div>
            
            <!-- Progress Bar -->
            <div style="margin-top: 10px;">
              <div style="background: var(--bg-tertiary); height: 8px; border-radius: var(--radius-sm); overflow: hidden;">
                <div style="background: #10B981; height: 100%; width: ${Math.min(paymentPercentage, 100)}%; transition: width 0.3s ease;"></div>
              </div>
              <p style="margin: 5px 0 0 0; font-size: 0.85em; color: #94A3B8;">
                ${remaining > 0 ? `المتبقي: ${formatCurrency(remaining)}` : '✅ مدفوع بالكامل'}
              </p>
            </div>
          </div>

          <!-- Stats Row -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 15px; font-size: 0.9em;">
            <div style="text-align: center; padding: 10px; background: var(--bg-secondary); border-radius: var(--radius-sm); border: 1px solid rgba(148, 163, 184, 0.1);">
              <p style="margin: 0; color: #CBD5E1;">🧾 الدفعات</p>
              <p style="margin: 5px 0 0 0; font-weight: 700; color: #F1F5F9; font-size: 1.3em;">${payments.length}</p>
            </div>
            <div style="text-align: center; padding: 10px; background: var(--bg-secondary); border-radius: var(--radius-sm); border: 1px solid rgba(148, 163, 184, 0.1);">
              <p style="margin: 0; color: #CBD5E1;">📊 نسبة الدفع</p>
              <p style="margin: 5px 0 0 0; font-weight: 700; color: #3B82F6; font-size: 1.3em;">${Math.round(paymentPercentage)}%</p>
            </div>
          </div>

          <!-- Action Buttons -->
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px;">
            <button class="action-btn" onclick="editStudent('${student.id}')" style="background: #3B82F6; color: white; padding: 10px; border: none; border-radius: var(--radius-sm); cursor: pointer; font-weight: 600; transition: 0.3s;" onmouseover="this.style.background='#2563EB'" onmouseout="this.style.background='#3B82F6'">✏️ تعديل</button>
            <button class="action-btn" onclick="showStudentDetails('${student.id}')" style="background: #8B5CF6; color: white; padding: 10px; border: none; border-radius: var(--radius-sm); cursor: pointer; font-weight: 600; transition: 0.3s;" onmouseover="this.style.opacity='0.9'" onmouseout="this.style.opacity='1'">👁️ تفاصيل</button>
            <button class="action-btn" onclick="showStudentQR('${student.id}')" style="background: #64748B; color: white; padding: 10px; border: none; border-radius: var(--radius-sm); cursor: pointer; font-weight: 600; transition: 0.3s;" onmouseover="this.style.opacity='0.9'" onmouseout="this.style.opacity='1'">📱 QR Code</button>
            <button class="action-btn" onclick="sendStudentReport('${student.id}')" style="background: #10B981; color: white; padding: 10px; border: none; border-radius: var(--radius-sm); cursor: pointer; font-weight: 600; transition: 0.3s;" onmouseover="this.style.opacity='0.9'" onmouseout="this.style.opacity='1'">📊 تقرير</button>
            <button class="action-btn" onclick="deleteStudent('${student.id}')" style="background: #EF4444; color: white; padding: 10px; border: none; border-radius: var(--radius-sm); cursor: pointer; font-weight: 600; transition: 0.3s;" onmouseover="this.style.opacity='0.9'" onmouseout="this.style.opacity='1'">🗑️ حذف</button>
          </div>
        </div>
      `;
    });
    
    html += `</div>`;
  }
  
  html += `</div>`;
  container.innerHTML = html;
}

// === Courses Data ===
let coursesLoading = false;

async function loadCourses(forceRefresh = false) {
  try {
    if (coursesLoading) return;
    
    // Check cache
    const cache = window.dataCache.courses;
    const now = Date.now();
    if (!forceRefresh && cache.data && (now - cache.timestamp) < CACHE_DURATION) {
      window.courses = cache.data;
      const container = document.getElementById('coursesContainer');
      if (container && typeof renderCoursesTable === 'function') {
        renderCoursesTable(cache.data, container);
      }
      return;
    }
    
    if (coursesLoading) return;
    coursesLoading = true;
    
    if (!window.currentAcademyId) {
      console.error('❌ Academy ID not set');
      coursesLoading = false;
      return;
    }
    
    const container = document.getElementById('coursesContainer');
    if (container) {
      container.innerHTML = `
        <div class="loading">
          <div class="loading-spinner"></div>
          <p>جارٍ تحميل بيانات الكورسات...</p>
        </div>
      `;
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
    
    // Update cache
    window.dataCache.courses = {
      data: data || [],
      timestamp: Date.now(),
      loading: false
    };
    
    if (container) {
      renderCoursesTable(data, container);
    }
    console.log('✅ Courses loaded:', data.length);
  } catch (error) {
    console.error('❌ Error loading courses:', error);
    showStatus('خطأ في تحميل الكورسات', 'error');
  } finally {
    coursesLoading = false;
  }
}

// === Teachers Data ===
async function loadTeachers() {
  try {
    const academyId = window.currentAcademyId || window.ACADEMY_ID || localStorage.getItem('current_academy_id');
    if (!academyId) {
      console.error('❌ Academy ID not set');
      window.teachers = [];
      return;
    }
    
    // Direct query - simplified
    const { data, error } = await safeSupabaseQuery(
      () => window.supabaseClient
        .from('profiles')
        .select('id, full_name, role, academy_id')
        .eq('academy_id', academyId)
        .eq('role', 'teacher')
        .order('full_name', { ascending: true }),
      'خطأ في تحميل المعلمين',
      false
    );

    if (error) {
      console.error('❌ Error loading teachers:', error.message);
      window.teachers = [];
      return;
    }
    
    window.teachers = data || [];
  } catch (error) {
    console.error('❌ Error loading teachers:', error);
    window.teachers = [];
  }
}

function renderCoursesTable(data, container) {
  if (!data || data.length === 0) {
    container.innerHTML = `
      <div style="padding: 40px; text-align: center; color: var(--text-light); grid-column: 1/-1;">
        <i class="fas fa-inbox" style="font-size: 3rem; margin-bottom: 15px; display: block;"></i>
        <p style="font-size: 1.1rem;">لا توجد كورسات</p>
        <button class="btn btn-primary" onclick="showAddCourseModal()" style="margin-top: 15px;">
          <i class="fas fa-plus"></i> إضافة كورس جديد
        </button>
      </div>
    `;
    return;
  }

  const html = data.map(course => {
    const studentCount = (window.subscriptions || []).filter(s => s.course_id === course.id).length;
    const totalRevenue = (window.payments || []).filter(p => p.course_id === course.id)
      .reduce((sum, p) => sum + (p.amount || 0), 0);
    const teacher = window.teachers?.find(t => t.id === course.teacher_id);
    const teacherName = teacher?.full_name || 'لم يتم تعيين';
    
    return `
      <div style="background: var(--bg-card); border-radius: var(--radius-md); overflow: hidden; box-shadow: var(--shadow-md); transition: all 0.3s; cursor: pointer; border: 1px solid rgba(148, 163, 184, 0.1);" onmouseover="this.style.boxShadow='var(--shadow-lg)'; this.style.transform='translateY(-3px)'" onmouseout="this.style.boxShadow='var(--shadow-md)'; this.style.transform='translateY(0)'">
        <!-- Header -->
        <div style="background: #3B82F6; color: white; padding: 15px; border-bottom: 3px solid #2563EB;">
          <h3 style="margin: 0; font-size: 1.1rem; font-weight: 600; color: white;">${escapeHtml(course.name)}</h3>
          <p style="margin: 5px 0 0 0; opacity: 0.95; font-size: 0.85rem; color: white;"> ${escapeHtml(teacherName)}</p>
        </div>

        <!-- Content -->
        <div style="padding: 15px;">
          <p style="margin: 0 0 12px 0; color: #CBD5E1; font-size: 0.9rem; line-height: 1.4;">
            ${escapeHtml(course.description || 'بدون وصف')}
          </p>

          <!-- Stats Grid -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 15px;">
            <div style="background: rgba(59, 130, 246, 0.1); padding: 10px; border-radius: var(--radius-sm); text-align: center; border: 1px solid rgba(59, 130, 246, 0.2);">
              <div style="font-size: 0.75rem; color: #CBD5E1; margin-bottom: 4px; font-weight: 600;">السعر</div>
              <div style="font-size: 1.2rem; font-weight: bold; color: #3B82F6;">${formatCurrency(course.price || 0)}</div>
            </div>
            <div style="background: rgba(16, 185, 129, 0.1); padding: 10px; border-radius: var(--radius-sm); text-align: center; border: 1px solid rgba(16, 185, 129, 0.2);">
              <div style="font-size: 0.75rem; color: #CBD5E1; margin-bottom: 4px; font-weight: 600;">الطلاب</div>
              <div style="font-size: 1.2rem; font-weight: bold; color: #10B981;">${studentCount}</div>
            </div>
          </div>

          <!-- Revenue Info -->
          <div style="background: rgba(245, 158, 11, 0.1); padding: 10px; border-radius: var(--radius-sm); border-right: 3px solid #F59E0B; margin-bottom: 12px; border: 1px solid rgba(245, 158, 11, 0.2);">
            <div style="font-size: 0.75rem; color: #CBD5E1; margin-bottom: 2px; font-weight: 600;">الإيرادات</div>
            <div style="font-size: 1.1rem; font-weight: bold; color: #F59E0B;">${formatCurrency(totalRevenue)}</div>
          </div>
        </div>

        <!-- Actions -->
        <div style="padding: 12px 15px; background: var(--bg-secondary); border-top: 1px solid rgba(148, 163, 184, 0.1); display: flex; gap: 8px;">
          <button class="action-btn" onclick="openCourseManagement('${course.id}')" style="flex: 1; background: #3B82F6; color: white; border: none; padding: 8px; border-radius: var(--radius-sm); cursor: pointer; font-size: 0.85rem; font-weight: 600;">
            📚 إدارة
          </button>
          <button class="action-btn" onclick="deleteCourse('${course.id}')" style="flex: 1; background: #EF4444; color: white; border: none; padding: 8px; border-radius: var(--radius-sm); cursor: pointer; font-size: 0.85rem; font-weight: 600;">
            🗑️ حذف
          </button>
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = html;
  updateCoursesStats(data);
}

function updateCoursesStats(data = null) {
  // Use provided data or fallback to window.courses
  const coursesData = data || window.courses || [];
  
  if (!Array.isArray(coursesData)) {
    console.warn('⚠️ updateCoursesStats: coursesData is not an array', coursesData);
    return;
  }
  
  const totalCourses = coursesData.length;
  const totalStudents = (window.subscriptions || []).length;
  const totalRevenue = (window.payments || []).reduce((sum, p) => sum + (p.amount || 0), 0);
  const avgPrice = totalCourses > 0 ? coursesData.reduce((sum, c) => sum + (c.price || 0), 0) / totalCourses : 0;

  const totalCoursesCountEl = document.getElementById('totalCoursesCount');
  const totalCoursesStudentsEl = document.getElementById('totalCoursesStudents');
  const totalCoursesRevenueEl = document.getElementById('totalCoursesRevenue');
  const averageCoursePriceEl = document.getElementById('averageCoursePrice');

  if (totalCoursesCountEl) totalCoursesCountEl.textContent = totalCourses;
  if (totalCoursesStudentsEl) totalCoursesStudentsEl.textContent = totalStudents;
  if (totalCoursesRevenueEl) totalCoursesRevenueEl.textContent = formatCurrency(totalRevenue);
  if (averageCoursePriceEl) averageCoursePriceEl.textContent = formatCurrency(avgPrice);
}

// === Subscriptions Data ===
let subscriptionsLoading = false;

function renderSubscriptionsTable(data, container) {
  // reuse the centralized rendering (keeps layouts consistent)
  if (typeof window.renderSubscriptionsTable === 'function' && window.renderSubscriptionsTable !== renderSubscriptionsTable) {
    // if another module defined it (e.g., subscriptions-tab-functions.js), prefer that implementation
    try {
      window.renderSubscriptionsTable(data, container);
      return;
    } catch (e) {
      // fallback to local simple render
      console.warn('Fallback renderSubscriptionsTable used due to error:', e);
    }
  }

  // simple fallback when the above didn't run
  let html = '<div class="table-container">';
  if (!data || data.length === 0) {
    html += '<p class="no-data">لا توجد اشتراكات</p>';
  } else {
    html += '<div class="summary-cards">';
    const activeCount = data.filter(s => s.status === 'active').length;
    const inactiveCount = data.length - activeCount;
    html += `<div class="summary-card">إجمالي: <div class="value">${data.length}</div></div>`;
    html += `<div class="summary-card">نشط: <div class="value">${activeCount}</div></div>`;
    html += `<div class="summary-card">منتهي: <div class="value">${inactiveCount}</div></div>`;
    html += '</div>';

    html += '<div class="table-responsive"><table><thead><tr><th>الطالب</th><th>الكورس</th><th>السعر</th><th>التاريخ</th><th>الحالة</th><th>الإجراءات</th></tr></thead><tbody>';
    html += data.map(sub => `<tr><td data-label="الطالب">${escapeHtml(sub.student_name||'-')}</td><td data-label="الكورس">${escapeHtml(sub.course_name||'-')}</td><td data-label="السعر">${formatCurrency(sub.course_price||0)}</td><td data-label="التاريخ">${formatDate(sub.subscribed_at)}</td><td data-label="الحالة"><span class="status-badge ${sub.status==='active'?'active':'inactive'}">${sub.status==='active'?'✓ نشط':'✗ منتهي'}</span></td><td data-label="الإجراءات"><button class="action-btn view-btn" onclick="showSubscriptionDetails('${sub.id}')">📋</button></td></tr>`).join('');
    html += '</tbody></table></div>';
  }
  html += '</div>';
  container.innerHTML = html;
}
function renderSubscriptionsTable(data, container) {
  let html = `
    <div class="table-container">
      <div style="display: flex; gap: 10px; margin-bottom: 20px; flex-wrap: wrap;">
        <button class="btn btn-primary" onclick="showAddSubscriptionModal()" style="flex: 1; min-width: 150px;">
          <i class="fas fa-plus"></i> إضافة اشتراك جديد
        </button>
        <button class="btn btn-success" onclick="exportSubscriptionsExcel()" style="flex: 1; min-width: 150px;">
          <i class="fas fa-file-excel"></i> تحميل البيانات
        </button>
        <button class="btn btn-info" onclick="printSubscriptions()" style="flex: 1; min-width: 150px;">
          <i class="fas fa-print"></i> طباعة
        </button>
      </div>

      <div class="search-filter" style="display: flex; gap: 10px; margin-bottom: 20px;">
        <div class="search-box" style="flex: 1;">
          <input type="text" id="subscriptionSearch" placeholder="ابحث عن طالب أو كورس..." onkeyup="filterSubscriptions()" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px;">
        </div>
        <select id="subscriptionStatusFilter" onchange="filterSubscriptions()" style="padding: 10px; border: 1px solid #ddd; border-radius: 4px; min-width: 150px;">
          <option value="all">جميع الحالات</option>
          <option value="active">نشط فقط</option>
          <option value="inactive">منتهي فقط</option>
        </select>
      </div>`;

  if (!data || data.length === 0) {
    html += '<p class="no-data">لا توجد اشتراكات</p>';
  } else {
    const activeCount = data.filter(s => s.status === 'active').length;
    const inactiveCount = data.length - activeCount;

    html += `
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 20px;">
        <div style="background: var(--primary-light); padding: 12px; border-radius: var(--radius-sm); text-align: center; border: 1px solid var(--border);">
          <p style="margin: 0; color: var(--primary); font-size: 0.85em; font-weight: 600;">إجمالي الاشتراكات</p>
          <p style="margin: 5px 0 0 0; font-size: 1.5em; font-weight: 700; color: var(--primary-dark);">${data.length}</p>
        </div>
        <div style="background: var(--secondary-light); padding: 12px; border-radius: var(--radius-sm); text-align: center; border: 1px solid var(--border);">
          <p style="margin: 0; color: var(--success); font-size: 0.85em; font-weight: 600;">✓ الاشتراكات النشطة</p>
          <p style="margin: 5px 0 0 0; font-size: 1.5em; font-weight: 700; color: var(--success);">${activeCount}</p>
        </div>
        <div style="background: #FFE5E5; padding: 12px; border-radius: var(--radius-sm); text-align: center; border: 1px solid var(--border);">
          <p style="margin: 0; color: var(--danger); font-size: 0.85em; font-weight: 600;">✗ المنتهية</p>
          <p style="margin: 5px 0 0 0; font-size: 1.5em; font-weight: 700; color: var(--danger);">${inactiveCount}</p>
        </div>
      </div>

      <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 6px; overflow: hidden;">
        <thead>
          <tr style="background: var(--primary); color: white;">
            <th style="padding: 12px; text-align: right; font-weight: 600;">👤 الطالب</th>
            <th style="padding: 12px; text-align: right; font-weight: 600;">📖 الكورس</th>
            <th style="padding: 12px; text-align: right; font-weight: 600;">💰 السعر</th>
            <th style="padding: 12px; text-align: right; font-weight: 600;">📅 البداية</th>
            <th style="padding: 12px; text-align: right; font-weight: 600;">📅 النهاية</th>
            <th style="padding: 12px; text-align: right; font-weight: 600;">الحالة</th>
            <th style="padding: 12px; text-align: right; font-weight: 600;">الإجراءات</th>
          </tr>
        </thead>
        <tbody>
          ${data.map((sub, idx) => `
            <tr style="border-bottom: 1px solid var(--border); ${idx % 2 === 0 ? 'background: var(--bg-light);' : 'background: var(--bg-white);'} transition: background 0.2s;">
              <td style="padding: 12px; text-align: right; font-weight: 500;">${escapeHtml(sub.student_name || '-')}</td>
              <td style="padding: 12px; text-align: right;">${escapeHtml(sub.course_name || '-')}</td>
              <td style="padding: 12px; text-align: right; font-weight: 600; color: var(--success);">${formatCurrency(sub.course_price || 0)}</td>
              <td style="padding: 12px; text-align: right; font-size: 0.9em;">${formatDate(sub.start_date)}</td>
              <td style="padding: 12px; text-align: right; font-size: 0.9em;">${formatDate(sub.end_date)}</td>
              <td style="padding: 12px; text-align: right;">
                <span style="display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 0.85em; font-weight: 600; ${
                  sub.status === 'active' 
                    ? 'background: var(--secondary-light); color: var(--success);' 
                    : 'background: #FFE5E5; color: var(--danger);'
                }">
                  ${sub.status === 'active' ? '✓ نشط' : '✗ منتهي'}
                </span>
              </td>
              <td style="padding: 12px; text-align: right;">
                <button class="action-btn" onclick="showSubscriptionDetails('${sub.id}')" style="padding: 5px 10px; margin: 0 2px; background: var(--primary); color: white; border: none; border-radius: var(--radius-sm); cursor: pointer; font-size: 0.85em;">📋</button>
                <button class="action-btn" onclick="editSubscription('${sub.id}')" style="padding: 5px 10px; margin: 0 2px; background: var(--success); color: white; border: none; border-radius: var(--radius-sm); cursor: pointer; font-size: 0.85em;">✏️</button>
                <button class="action-btn" onclick="deleteSubscription('${sub.id}')" style="padding: 5px 10px; margin: 0 2px; background: var(--danger); color: white; border: none; border-radius: var(--radius-sm); cursor: pointer; font-size: 0.85em;">🗑️</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>`;
  }
  
  html += '</div>';
  container.innerHTML = html;
}

// === Payments Data ===
let paymentsLoading = false;

async function loadPayments(forceRefresh = false) {
  try {
    if (paymentsLoading) return;
    
    // Check cache
    const cache = window.dataCache.payments;
    const now = Date.now();
    if (!forceRefresh && cache.data && (now - cache.timestamp) < CACHE_DURATION) {
      window.payments = cache.data;
      return;
    }
    
    if (paymentsLoading) return;
    paymentsLoading = true;
    
    if (!window.currentAcademyId) {
      console.error('❌ Academy ID not set');
      paymentsLoading = false;
      return;
    }

    const { data: paymentsData, error } = await safeSupabaseQuery(
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

    // Get related data
    const { data: studentsData } = await safeSupabaseQuery(
      () => window.supabaseClient
        .from('students')
        .select('id, full_name'),
      'خطأ في تحميل بيانات الطلاب',
      false
    );

    const { data: coursesData } = await safeSupabaseQuery(
      () => window.supabaseClient
        .from('courses')
        .select('id, name, price')
        .eq('academy_id', window.currentAcademyId),
      'خطأ في تحميل بيانات الكورسات',
      false
    );

    // Manual join
    const data = paymentsData.map(payment => ({
      ...payment,
      student_name: studentsData?.find(s => s.id === payment.student_id)?.full_name || '-',
      course_name: coursesData?.find(c => c.id === payment.course_id)?.name || '-'
    }));

    // Store raw payment data - rendering will be done by loadPaymentsTab()
    window.payments = data || [];
    
    // Update cache
    window.dataCache.payments = {
      data: data || [],
      timestamp: Date.now(),
      loading: false
    };
    
    console.log('✅ Payments data loaded:', window.payments.length);
  } catch (error) {
    console.error('❌ Error loading payments:', error);
    showStatus('خطأ في تحميل الدفعات', 'error');
  } finally {
    paymentsLoading = false;
  }
}

function renderPaymentsTable(data, container) {
  if (!data || data.length === 0) {
    container.innerHTML = `
      <div class="table-container">
        <button class="btn btn-primary" onclick="showAddPaymentModal()" style="margin-bottom: 20px;">
          <i class="fas fa-plus"></i> إضافة دفعة
        </button>
        <p class="no-data">لا توجد دفعات</p>
      </div>
    `;
    return;
  }

  // Calculate statistics
  const totalPayments = data.reduce((sum, p) => sum + (p.amount || 0), 0);
  const paidPayments = data.filter(p => p.status === 'paid').length;
  const pendingPayments = data.filter(p => p.status === 'pending').length;
  const failedPayments = data.filter(p => p.status === 'failed').length;

  const html = `
    <div class="table-container">
      <!-- إزرار التحكم العلوية -->
      <div style="display: flex; gap: 12px; margin-bottom: 24px; flex-wrap: wrap;">
        <button class="btn btn-primary" onclick="showAddPaymentModal()" style="font-size: 1em; font-weight: 600; padding: 12px 20px;">
          <i class="fas fa-plus"></i> إضافة دفعة
        </button>
        <button class="btn btn-success" onclick="exportPaymentsExcel()" style="font-size: 1em; font-weight: 600; padding: 12px 20px;">
          <i class="fas fa-file-excel"></i> تحميل Excel
        </button>
        <button class="btn btn-info" onclick="printPayments()" style="font-size: 1em; font-weight: 600; padding: 12px 20px;">
          <i class="fas fa-print"></i> طباعة
        </button>
      </div>

      <!-- إحصائيات الدفعات -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 18px; margin-bottom: 24px;">
        <div style="background: #3B82F6; color: white; padding: 20px; border-radius: var(--radius-md); text-align: center;">
          <p style="margin: 0; font-size: 1em; font-weight: 600; opacity: 0.95;">💰 إجمالي المبالغ</p>
          <p style="margin: 10px 0 0 0; font-size: 1.7em; font-weight: 700;">${formatCurrency(totalPayments)}</p>
        </div>
        <div style="background: #10B981; color: white; padding: 20px; border-radius: var(--radius-md); text-align: center;">
          <p style="margin: 0; font-size: 1em; font-weight: 600; opacity: 0.95;">✓ مدفوع (${paidPayments})</p>
          <p style="margin: 10px 0 0 0; font-size: 1.7em; font-weight: 700;">${formatCurrency(data.filter(p => p.status === 'paid').reduce((sum, p) => sum + (p.amount || 0), 0))}</p>
        </div>
        <div style="background: #F59E0B; color: white; padding: 20px; border-radius: var(--radius-md); text-align: center;">
          <p style="margin: 0; font-size: 1em; font-weight: 600; opacity: 0.95;">⏳ قيد الانتظار (${pendingPayments})</p>
          <p style="margin: 10px 0 0 0; font-size: 1.7em; font-weight: 700;">${formatCurrency(data.filter(p => p.status === 'pending').reduce((sum, p) => sum + (p.amount || 0), 0))}</p>
        </div>
        <div style="background: #EF4444; color: white; padding: 20px; border-radius: var(--radius-md); text-align: center;">
          <p style="margin: 0; font-size: 1em; font-weight: 600; opacity: 0.95;">✗ فشل (${failedPayments})</p>
          <p style="margin: 10px 0 0 0; font-size: 1.7em; font-weight: 700;">${formatCurrency(data.filter(p => p.status === 'failed').reduce((sum, p) => sum + (p.amount || 0), 0))}</p>
        </div>
      </div>

      <!-- خانات البحث والتصفية -->
      <div style="display: flex; gap: 12px; margin-bottom: 24px; flex-wrap: wrap;">
        <input 
          type="text" 
          id="paymentSearch" 
          placeholder="ابحث عن طالب أو كورس..." 
          class="search-input"
          onkeyup="filterPayments()"
          style="flex: 1; min-width: 200px; padding: 12px 16px; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 1em; font-weight: 500;"
        >
        <select 
          id="paymentStatusFilter" 
          onchange="filterPayments()"
          style="padding: 12px 16px; border: 2px solid #e5e7eb; border-radius: 8px; background: white; font-size: 1em; font-weight: 500;"
        >
          <option value="all">كل الحالات</option>
          <option value="paid">✓ مدفوع</option>
          <option value="pending">⏳ قيد الانتظار</option>
          <option value="failed">✗ فشل</option>
        </select>
      </div>

      <!-- جدول الدفعات -->
      <table style="border-collapse: collapse; background: var(--bg-card); border: 1px solid rgba(148, 163, 184, 0.1); border-radius: 8px; overflow: hidden;">
        <thead>
          <tr style="background: #3B82F6;">
            <th style="font-size: 1.05em; font-weight: 700; padding: 14px 16px; color: white; border: none;">#</th>
            <th style="font-size: 1.05em; font-weight: 700; padding: 14px 16px; color: white; border: none;">👤 اسم الطالب</th>
            <th style="font-size: 1.05em; font-weight: 700; padding: 14px 16px; color: white; border: none;">📖 اسم الكورس</th>
            <th style="font-size: 1.05em; font-weight: 700; padding: 14px 16px; color: white; border: none;">💵 المبلغ</th>
            <th style="font-size: 1.05em; font-weight: 700; padding: 14px 16px; color: white; border: none;">🔄 طريقة الدفع</th>
            <th style="font-size: 1.05em; font-weight: 700; padding: 14px 16px; color: white; border: none;">📅 تاريخ الدفع</th>
            <th style="font-size: 1.05em; font-weight: 700; padding: 14px 16px; color: white; border: none;">⚙️ الحالة</th>
            <th style="font-size: 1.05em; font-weight: 700; padding: 14px 16px; color: white; border: none;">الإجراءات</th>
          </tr>
        </thead>
        <tbody>
          ${data.map((payment, idx) => `
            <tr style="border-bottom: 1px solid rgba(148, 163, 184, 0.1); background: var(--bg-card);">
              <td style="padding: 14px 16px; font-size: 1em; font-weight: 500; color: #CBD5E1;">${idx + 1}</td>
              <td style="padding: 14px 16px; font-size: 1em; font-weight: 500; color: #F1F5F9;">${escapeHtml(payment.student_name)}</td>
              <td style="padding: 14px 16px; font-size: 1em; font-weight: 500; color: #CBD5E1;">${escapeHtml(payment.course_name)}</td>
              <td style="padding: 14px 16px; font-weight: 700; color: #3B82F6; font-size: 1.1em;">${formatCurrency(payment.amount)}</td>
              <td style="padding: 14px 16px; font-size: 1em; font-weight: 500; color: #CBD5E1;">${getPaymentMethodLabel(payment.payment_method)}</td>
              <td style="padding: 14px 16px; font-size: 1em; font-weight: 500; color: #CBD5E1;">${formatDate(payment.payment_date)}</td>
              <td style="padding: 14px 16px;">
                <span class="status-badge" style="background: ${payment.status === 'paid' ? 'rgba(16, 185, 129, 0.2)' : payment.status === 'pending' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(239, 68, 68, 0.2)'}; color: ${payment.status === 'paid' ? '#10B981' : payment.status === 'pending' ? '#F59E0B' : '#EF4444'}; border: 2px solid ${payment.status === 'paid' ? '#10B981' : payment.status === 'pending' ? '#F59E0B' : '#EF4444'}; padding: 8px 14px; border-radius: 20px; font-weight: 600; font-size: 0.9em;">
                  ${payment.status === 'paid' ? '✓ مدفوع' : payment.status === 'pending' ? '⏳ قيد الانتظار' : '✗ فشل'}
                </span>
              </td>
              <td style="padding: 14px 16px;">
                <button class="action-btn" onclick="showPaymentDetails('${payment.id}')" style="background: #8B5CF6; color: white; padding: 8px 12px; border: none; border-radius: 6px; cursor: pointer; font-size: 0.95em; font-weight: 600; margin-left: 5px;">👁️ عرض</button>
                <button class="action-btn" onclick="editPayment('${payment.id}')" style="background: #F59E0B; color: white; padding: 8px 12px; border: none; border-radius: 6px; cursor: pointer; font-size: 0.95em; font-weight: 600; margin-left: 5px;">✏️ تعديل</button>
                <button class="action-btn" onclick="deletePayment('${payment.id}')" style="background: #EF4444; color: white; padding: 8px 12px; border: none; border-radius: 6px; cursor: pointer; font-size: 0.95em; font-weight: 600;">🗑️ حذف</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
  
  container.innerHTML = html;
}

// === Attendance Data ===
let attendanceLoading = false;

async function loadAttendance(forceRefresh = false) {
  try {
    if (attendanceLoading) return;
    
    // Check cache (attendance cache shorter - 2 minutes)
    const cache = window.dataCache.attendances;
    const now = Date.now();
    const ATTENDANCE_CACHE = 2 * 60 * 1000; // 2 minutes
    if (!forceRefresh && cache.data && (now - cache.timestamp) < ATTENDANCE_CACHE) {
      window.attendances = cache.data;
      const container = document.getElementById('attendancesContainer');
      if (container && typeof renderAttendanceTable === 'function') {
        renderAttendanceTable(cache.data, container);
        updateAttendanceStats(cache.data);
      }
      return;
    }
    
    if (attendanceLoading) return;
    attendanceLoading = true;
    
    if (!window.currentAcademyId) {
      console.error('❌ Academy ID not set');
      attendanceLoading = false;
      return;
    }
    
    const container = document.getElementById('attendancesContainer');
    if (!container) {
      console.warn('⚠️ attendancesContainer not found');
      attendanceLoading = false;
      return;
    }
    
    container.innerHTML = `
      <div class="loading">
        <div class="loading-spinner"></div>
        <p>جارٍ تحميل بيانات الحضور...</p>
      </div>
    `;

    // محاولة الجلب من جدول attendances أولاً، وإذا لم يوجد فمن attendance
    let attendanceData = null;
    let error = null;
    
    // محاولة 1: من جدول attendances - استخدام select('*') لتجنب مشاكل الأعمدة
    const result1 = await safeSupabaseQuery(
      () => window.supabaseClient
        .from('attendances')
        .select('*')
        .eq('academy_id', window.currentAcademyId)
        .order('created_at', { ascending: false })
        .limit(1000),
      'خطأ في تحميل الحضور',
      false
    );
    
    if (!result1.error && result1.data && result1.data.length > 0) {
      attendanceData = result1.data;
    } else if (result1.error && result1.error.code === '42P01') {
      // Table doesn't exist, try attendance table
      const result2 = await safeSupabaseQuery(
        () => window.supabaseClient
          .from('attendance')
          .select('*')
          .eq('academy_id', window.currentAcademyId)
          .order('created_at', { ascending: false })
          .limit(1000),
        'خطأ في تحميل الحضور',
        false
      );
      
      if (!result2.error && result2.data) {
        attendanceData = result2.data;
      } else {
        error = result2.error || result1.error;
      }
    } else {
      error = result1.error;
    }

    if (error) {
      console.error('❌ Error loading attendance:', error);
      container.innerHTML = `
        <div style="padding: 40px; text-align: center; color: var(--danger);">
          <i class="fas fa-exclamation-triangle" style="font-size: 3rem; margin-bottom: 15px; display: block;"></i>
          <p style="font-size: 1.1rem;">خطأ في تحميل بيانات الحضور</p>
          <p style="font-size: 0.9rem; color: var(--text-light);">${error.message}</p>
        </div>
      `;
      return;
    }

    if (!attendanceData || attendanceData.length === 0) {
      window.attendances = [];
      renderAttendanceTable([], container);
      updateAttendanceStats([]);
      return;
    }

    // Get related data - using students instead of profiles
    const { data: studentsData } = await safeSupabaseQuery(
      () => window.supabaseClient
        .from('students')
        .select('id, full_name')
        .eq('academy_id', window.currentAcademyId),
      'خطأ في تحميل بيانات الطلاب',
      false
    );

    const { data: coursesData } = await safeSupabaseQuery(
      () => window.supabaseClient
        .from('courses')
        .select('id, name')
        .eq('academy_id', window.currentAcademyId),
      'خطأ في تحميل بيانات الكورسات',
      false
    );

    // Manual join - معالجة أسماء الحقول المختلفة
    const data = attendanceData.map(att => {
      // التعامل مع أسماء الحقول المختلفة (date أو attendance_date أو created_at)
      const attendanceDate = att.date || att.attendance_date || att.att_date || att.created_at;
      
      return {
        ...att,
        date: attendanceDate,
        attendance_date: attendanceDate,
        student_name: studentsData?.find(s => s.id === att.student_id)?.full_name || '-',
        course_name: coursesData?.find(c => c.id === att.course_id)?.name || '-'
      };
    });

    window.attendances = data || [];
    
    // Update cache
    window.dataCache.attendances = {
      data: data || [],
      timestamp: Date.now(),
      loading: false
    };
    
    renderAttendanceTable(data, container);
    updateAttendanceStats(data);
    console.log('✅ Attendance loaded:', data.length);
  } catch (error) {
    console.error('❌ Error loading attendance:', error);
    const container = document.getElementById('attendancesContainer');
    if (container) {
      container.innerHTML = `
        <div style="padding: 40px; text-align: center; color: var(--danger);">
          <i class="fas fa-exclamation-triangle" style="font-size: 3rem; margin-bottom: 15px; display: block;"></i>
          <p style="font-size: 1.1rem;">خطأ في تحميل بيانات الحضور</p>
          <p style="font-size: 0.9rem; color: var(--text-light);">${error.message}</p>
        </div>
      `;
    }
    showStatus('خطأ في تحميل الحضور', 'error');
  } finally {
    attendanceLoading = false;
  }
}

function renderAttendanceTable(data, container) {
  if (!container) {
    console.error('❌ Container not found for renderAttendanceTable');
    return;
  }

  if (!data || data.length === 0) {
    container.innerHTML = `
      <div style="padding: 40px; text-align: center; color: var(--text-light);">
        <i class="fas fa-inbox" style="font-size: 3rem; margin-bottom: 15px; display: block;"></i>
        <p style="font-size: 1.1rem;">لا توجد بيانات حضور</p>
        <p style="font-size: 0.9rem; color: var(--text-light);">سيتم عرض بيانات الحضور المسجلة من قبل المعلمين هنا</p>
      </div>
    `;
    return;
  }

  const html = `
    <div class="responsive-table-wrapper">
      <table class="attendance-table" style="background: var(--bg-card); border: 1px solid rgba(148, 163, 184, 0.1);">
        <thead>
          <tr style="background: #3B82F6;">
            <th style="color: white; border: none;">👤 الطالب</th>
            <th style="color: white; border: none;">📚 الكورس</th>
            <th style="color: white; border: none;">📅 التاريخ</th>
            <th style="color: white; border: none;">📊 الحالة</th>
            <th style="color: white; border: none;">📝 ملاحظات</th>
          </tr>
        </thead>
        <tbody>
          ${data.map((att) => {
            const status = att.status || 'unknown';
            const attendanceDate = att.date || att.attendance_date || att.att_date || '-';
            return `
              <tr style="border-bottom: 1px solid rgba(148, 163, 184, 0.1); background: var(--bg-card);">
                <td class="td-student" data-label="الطالب" style="color: #F1F5F9;">${escapeHtml(att.student_name || '-')}</td>
                <td class="td-course" data-label="الكورس" style="color: #CBD5E1;">${escapeHtml(att.course_name || '-')}</td>
                <td class="td-date" data-label="التاريخ" style="color: #CBD5E1;">${formatDate(attendanceDate)}</td>
                <td class="td-status" data-label="الحالة">
                  <span class="status-badge ${status}">${getAttendanceStatusLabel(status)}</span>
                </td>
                <td class="td-notes" data-label="ملاحظات" style="color: #CBD5E1;">${att.notes ? escapeHtml(att.notes) : '-'}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
  
  container.innerHTML = html;
}
