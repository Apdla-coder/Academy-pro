// ============================================================================
// PAYMENTS TAB - Payment management organized by courses
// ============================================================================

async function loadPaymentsTab() {
  try {
    console.log('💰 Loading payments tab...');
    // Force refresh when opening tab
    await loadPayments(true);
    
    // تأكد من وجود البيانات
    console.log('📊 Data status:', {
      payments: (window.payments || []).length,
      courses: (window.courses || []).length,
      students: (window.students || []).length,
      subscriptions: (window.subscriptions || []).length
    });
    
    // استدعِ renderPaymentsByCourse مباشرة
    if (typeof renderPaymentsByCourse === 'function') {
      renderPaymentsByCourse();
    }
  } catch (error) {
    console.error('❌ Error loading payments tab:', error);
  }
}

function renderPaymentsByCourse() {
  const container = document.getElementById('paymentsContainer');
  if (!container) return;

  console.log('📊 Rendering payments by course...', {
    coursesCount: (window.courses || []).length,
    paymentsCount: (window.payments || []).length,
    subscriptionsCount: (window.subscriptions || []).length,
    studentsCount: (window.students || []).length
  });

  if (!window.courses || window.courses.length === 0) {
    container.innerHTML = '<p class="no-data">لا توجد كورسات</p>';
    return;
  }

  // Group payments by course
  const coursePayments = {};
  (window.courses || []).forEach(course => {
    const subscribed = (window.subscriptions || []).filter(s => s.course_id === course.id && s.status === 'active');
    const payments = (window.payments || []).filter(p => p.course_id === course.id);
    
    // Calculate per-student data
    const studentsData = subscribed.map(sub => {
      const student = (window.students || []).find(s => s.id === sub.student_id);
      const studentPayments = payments.filter(p => p.student_id === sub.student_id);
      const totalPaid = studentPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
      
      return {
        ...student,
        subscriptionId: sub.id,
        totalPaid,
        payments: studentPayments,
        coursePrice: course.price || 0,
        remaining: Math.max(0, (course.price || 0) - totalPaid)
      };
    });

    // Calculate comprehensive stats
    const totalExpected = subscribed.length * (course.price || 0); // المبلغ المتوقع من جميع الطلاب
    const totalPaidAmount = payments.reduce((sum, p) => sum + (p.amount || 0), 0); // الإجمالي المدفوع
    const totalRemaining = totalExpected - totalPaidAmount; // المتبقي
    
    coursePayments[course.id] = {
      course,
      students: studentsData,
      stats: {
        totalStudents: subscribed.length,
        totalExpected: totalExpected, // الإجمالي المتوقع
        totalPaidAmount: totalPaidAmount, // الإجمالي المدفوع
        totalRemaining: Math.max(0, totalRemaining), // المتبقي الإجمالي
        paidCount: payments.filter(p => p.status === 'paid').length,
        pendingCount: payments.filter(p => p.status === 'pending').length,
        paidPayments: payments.filter(p => p.status === 'paid').reduce((sum, p) => sum + (p.amount || 0), 0),
        pendingPayments: payments.filter(p => p.status === 'pending').reduce((sum, p) => sum + (p.amount || 0), 0),
        failedPayments: payments.filter(p => p.status === 'failed').reduce((sum, p) => sum + (p.amount || 0), 0)
      }
    };
  });

  let html = `
    <div class="payments-container">
      <div style="display: flex; gap: 12px; margin-bottom: 24px; flex-wrap: wrap;">
        <button class="btn btn-primary" onclick="showAddPaymentModal()" style="font-size: 1em; font-weight: 600; padding: 12px 20px;">
          <i class="fas fa-plus"></i> إضافة دفعة
        </button>
        <button class="btn btn-success" onclick="exportAllPaymentsExcel()" style="font-size: 1em; font-weight: 600; padding: 12px 20px;">
          <i class="fas fa-file-excel"></i> تحميل Excel
        </button>
        <button class="btn btn-info" onclick="printAllPayments()" style="font-size: 1em; font-weight: 600; padding: 12px 20px;">
          <i class="fas fa-print"></i> طباعة
        </button>
      </div>

      <div id="coursesPaymentsWrapper">
  `;

  // Render each course
  Object.values(coursePayments).forEach((courseData, idx) => {
    const { course, students, stats } = courseData;
    const courseId = course.id;
    const collapsedClass = `paymentsCourse_${courseId}`;

    html += `
      <div class="course-card">
        <!-- Course Header -->
        <div class="course-header" onclick="toggleCoursePayments('${courseId}')">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
              <h3 style="margin: 0; font-size: 1.5em; font-weight: 700; color: #F1F5F9;">📚 ${escapeHtml(course.name)}</h3>
              <p style="margin: 8px 0 0 0; font-size: 1em; font-weight: 500; color: #CBD5E1;">سعر الكورس: ${formatCurrency(course.price || 0)}</p>
            </div>
            <div style="text-align: right;">
              <p style="margin: 0; font-size: 1em; font-weight: 500; color: #CBD5E1;">عدد الطلاب</p>
              <p style="margin: 6px 0 0 0; font-size: 2em; font-weight: 700; color: #F1F5F9;">${stats.totalStudents}</p>
            </div>
          </div>
        </div>

        <!-- Course Stats -->
        <div class="summary-cards">
          <div class="summary-card" style="background: #3B82F6; color: white; border-radius: var(--radius-md);">
            <p style="margin: 0 0 10px 0; font-size: 1em; font-weight: 600; opacity: 0.95;">💵 الإجمالي المتوقع</p>
            <div class="value" style="font-size: 1.6em; font-weight: 700;">${formatCurrency(stats.totalExpected)}</div>
          </div>
          <div class="summary-card" style="background: #10B981; color: white; border-radius: var(--radius-md);">
            <p style="margin: 0 0 10px 0; font-size: 1em; font-weight: 600; opacity: 0.95;">✓ المدفوع</p>
            <div class="value" style="font-size: 1.6em; font-weight: 700;">${formatCurrency(stats.totalPaidAmount)}</div>
          </div>
          <div class="summary-card" style="background: #F59E0B; color: white; border-radius: var(--radius-md);">
            <p style="margin: 0 0 10px 0; font-size: 1em; font-weight: 600; opacity: 0.95;">⏳ المتبقي</p>
            <div class="value" style="font-size: 1.6em; font-weight: 700;">${formatCurrency(stats.totalRemaining)}</div>
          </div>
          <div class="summary-card" style="background: #8B5CF6; color: white; border-radius: var(--radius-md);">
            <p style="margin: 0 0 10px 0; font-size: 1em; font-weight: 600; opacity: 0.95;">📊 نسبة التحصيل</p>
            <div class="value" style="font-size: 1.6em; font-weight: 700;">${stats.totalExpected > 0 ? ((stats.totalPaidAmount / stats.totalExpected) * 100).toFixed(1) : 0}%</div>
          </div>
        </div>

        <!-- Students Payments Table -->
        <div class="${collapsedClass}" style="overflow: hidden;">
          <div class="table-responsive">
            <table style="border-collapse: collapse; background: var(--bg-card);">
              <thead>
                <tr style="background: #3B82F6;">
                  <th style="font-size: 1.05em; font-weight: 700; padding: 14px 16px; color: white; text-align: right; border: none;">👤 الطالب</th>
                  <th style="font-size: 1.05em; font-weight: 700; padding: 14px 16px; color: white; text-align: right; border: none;">💵 سعر الكورس</th>
                  <th style="font-size: 1.05em; font-weight: 700; padding: 14px 16px; color: white; text-align: right; border: none;">✓ المدفوع</th>
                  <th style="font-size: 1.05em; font-weight: 700; padding: 14px 16px; color: white; text-align: right; border: none;">⏳ المتبقي</th>
                  <th style="font-size: 1.05em; font-weight: 700; padding: 14px 16px; color: white; text-align: right; border: none;">📊 الحالة</th>
                  <th style="font-size: 1.05em; font-weight: 700; padding: 14px 16px; color: white; text-align: right; border: none;">الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                ${students.length === 0 ? `
                  <tr>
                    <td colspan="6" style="padding: 30px; text-align: center; color: #CBD5E1; font-size: 1.05em; background: var(--bg-card);">لا يوجد طلاب مسجلين في هذا الكورس</td>
                  </tr>
                ` : students.map(student => {
                  const paidStatus = student.remaining <= 0 ? 'completed' : student.totalPaid > 0 ? 'partial' : 'pending';
                  const statusText = paidStatus === 'completed' ? '✓ مكتمل' : paidStatus === 'partial' ? '⚠️ جزئي' : '❌ لم يدفع';
                  const statusClass = paidStatus === 'completed' ? 'active' : paidStatus === 'partial' ? 'partial' : 'inactive';

                  return `
                    <tr style="border-bottom: 1px solid rgba(148, 163, 184, 0.1); background: var(--bg-card);">
                      <td data-label="الطالب" style="padding: 14px 16px; font-size: 1em; font-weight: 500; color: #F1F5F9;">${escapeHtml(student.full_name || '-')}</td>
                      <td data-label="سعر الكورس" style="padding: 14px 16px; font-size: 1em; font-weight: 500; color: #CBD5E1;">${formatCurrency(student.coursePrice)}</td>
                      <td data-label="المدفوع" style="padding: 14px 16px; font-size: 1em; font-weight: 600; color: #10B981;">${formatCurrency(student.totalPaid)}</td>
                      <td data-label="المتبقي" style="padding: 14px 16px; font-size: 1em; font-weight: 600; color: #F59E0B;">${formatCurrency(student.remaining)}</td>
                      <td data-label="الحالة" style="padding: 14px 16px;"><span class="status-badge ${statusClass}">${statusText}</span></td>
                      <td data-label="الإجراءات" style="padding: 14px 16px;">
                        <button class="action-btn view-btn" onclick="showStudentPaymentDetails('${student.id}', '${courseId}')" style="font-size: 1em; padding: 8px 12px; background: #8B5CF6; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">👁️</button>
                        <button class="action-btn edit-btn" onclick="showAddPaymentModalForStudent('${student.id}', '${courseId}')" style="font-size: 1em; padding: 8px 12px; background: #10B981; color: white; border: none; border-radius: 6px; cursor: pointer; margin-right: 6px; font-weight: 600;">➕</button>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  });

  html += `
      </div>
    </div>
  `;

  container.innerHTML = html;
}

function toggleCoursePayments(courseId) {
  const elem = document.querySelector(`.paymentsCourse_${courseId}`);
  if (elem) {
    elem.style.display = elem.style.display === 'none' ? 'block' : 'none';
  }
}

function filterPayments() {
  // This function will be replaced by course-based view
  renderPaymentsByCourse();
}

// ============================================================================
// STUDENT PAYMENT DETAILS - عرض تفاصيل دفعات الطالب في كورس معين
// ============================================================================

function showStudentPaymentDetails(studentId, courseId) {
  const student = (window.students || []).find(s => s.id === studentId);
  const course = (window.courses || []).find(c => c.id === courseId);
  const payments = (window.payments || []).filter(p => p.student_id === studentId && p.course_id === courseId);
  const totalPaid = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
  const remaining = (course?.price || 0) - totalPaid;

  const detailsHTML = `
    <div class="payment-details-modal">
      <div class="details-header" style="background: #3B82F6; color: white; padding: 24px; border-radius: 8px 8px 0 0; margin-bottom: 0;">
        <h2 style="margin: 0; font-size: 1.6em; font-weight: 700; color: white; letter-spacing: 0.3px;">👤 ${escapeHtml(student?.full_name || '-')}</h2>
        <p style="margin: 10px 0 0 0; font-size: 1.1em; font-weight: 500; color: white; opacity: 0.95;">📚 ${escapeHtml(course?.name || '-')}</p>
      </div>

      <div style="padding: 30px; background: var(--bg-card);">
        <!-- ملخص الدفع -->
        <div class="details-section" style="margin-bottom: 30px;">
          <h3 style="color: #3B82F6; border-bottom: 2px solid rgba(59, 130, 246, 0.2); padding-bottom: 12px; margin-bottom: 20px; font-size: 1.3em; font-weight: 700;">💰 ملخص الدفع</h3>
          <div class="details-grid" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px;">
            <div style="background: rgba(59, 130, 246, 0.1); padding: 20px; border-radius: 10px; text-align: center; border: 2px solid rgba(59, 130, 246, 0.2);">
              <p style="margin: 0; color: #3B82F6; font-size: 1em; font-weight: 600; margin-bottom: 10px;">💵 سعر الكورس</p>
              <p style="margin: 0; font-weight: 700; color: #1E3A8A; font-size: 1.5em;">${formatCurrency(course?.price || 0)}</p>
            </div>
            <div style="background: rgba(16, 185, 129, 0.1); padding: 20px; border-radius: 10px; text-align: center; border: 2px solid rgba(16, 185, 129, 0.2);">
              <p style="margin: 0; color: #10B981; font-size: 1em; font-weight: 600; margin-bottom: 10px;">✓ المبلغ المدفوع</p>
              <p style="margin: 0; font-weight: 700; color: #059669; font-size: 1.5em;">${formatCurrency(totalPaid)}</p>
            </div>
            <div style="background: ${remaining > 0 ? 'rgba(245, 158, 11, 0.1)' : 'rgba(16, 185, 129, 0.1)'}; padding: 20px; border-radius: 10px; text-align: center; border: 2px solid ${remaining > 0 ? 'rgba(245, 158, 11, 0.2)' : 'rgba(16, 185, 129, 0.2)'};">
              <p style="margin: 0; color: ${remaining > 0 ? '#F59E0B' : '#10B981'}; font-size: 1em; font-weight: 600; margin-bottom: 10px;">⏳ المتبقي</p>
              <p style="margin: 0; font-weight: 700; color: ${remaining > 0 ? '#D97706' : '#059669'}; font-size: 1.5em;">${formatCurrency(remaining)}</p>
            </div>
          </div>
        </div>

        <!-- سجل الدفعات -->
        <div class="details-section">
          <h3 style="color: #3B82F6; border-bottom: 2px solid rgba(59, 130, 246, 0.2); padding-bottom: 12px; margin-bottom: 20px; font-size: 1.3em; font-weight: 700;">📋 سجل الدفعات (${payments.length})</h3>
          ${payments.length === 0 ? `
            <div style="text-align: center; padding: 40px; background: var(--bg-secondary); border-radius: 10px; border: 1px solid rgba(148, 163, 184, 0.1);">
              <p style="color: #CBD5E1; font-size: 1.1em; font-weight: 500; margin: 0;">لا توجد دفعات مسجلة</p>
            </div>
          ` : `
            <div style="overflow-x: auto; border-radius: 10px; border: 1px solid rgba(148, 163, 184, 0.1);">
              <table style="width: 100%; border-collapse: collapse; background: var(--bg-card);">
                <thead style="background: #3B82F6;">
                  <tr>
                    <th style="padding: 14px 18px; text-align: right; font-size: 1.05em; font-weight: 700; color: white; border: none;">📅 التاريخ</th>
                    <th style="padding: 14px 18px; text-align: right; font-size: 1.05em; font-weight: 700; color: white; border: none;">💵 المبلغ</th>
                    <th style="padding: 14px 18px; text-align: right; font-size: 1.05em; font-weight: 700; color: white; border: none;">🔄 الطريقة</th>
                    <th style="padding: 14px 18px; text-align: right; font-size: 1.05em; font-weight: 700; color: white; border: none;">⚙️ الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  ${payments.map((p, idx) => `
                    <tr style="border-bottom: 1px solid rgba(148, 163, 184, 0.1); background: ${idx % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-secondary)'};">
                      <td style="padding: 14px 18px; text-align: right; font-size: 1em; font-weight: 500; color: #F1F5F9;">${formatDate(p.payment_date)}</td>
                      <td style="padding: 14px 18px; text-align: right; font-weight: 600; color: #10B981; font-size: 1.1em;">${formatCurrency(p.amount)}</td>
                      <td style="padding: 14px 18px; text-align: right; font-size: 1em; font-weight: 500; color: #CBD5E1;">${getPaymentMethodLabel(p.payment_method)}</td>
                      <td style="padding: 14px 18px; text-align: right;">
                        <span style="background: ${p.status === 'paid' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)'}; color: ${p.status === 'paid' ? '#10B981' : '#F59E0B'}; padding: 8px 16px; border-radius: 20px; font-size: 0.95em; font-weight: 600; border: 1px solid ${p.status === 'paid' ? '#10B981' : '#F59E0B'};">
                          ${p.status === 'paid' ? '✓ مدفوع' : '⏳ قيد الانتظار'}
                        </span>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          `}
        </div>
      </div>

      <div style="padding: 20px; background: var(--bg-secondary); border-radius: 0 0 8px 8px; display: flex; gap: 12px; justify-content: flex-end; border-top: 1px solid rgba(148, 163, 184, 0.1);">
        <button onclick="closeStudentPaymentDetails()" class="btn btn-secondary" style="padding: 14px 28px; font-size: 1.05em; font-weight: 600;">إغلاق</button>
        <button onclick="showAddPaymentModalForStudent('${studentId}', '${courseId}')" class="btn btn-primary" style="padding: 14px 28px; font-size: 1.05em; font-weight: 600;">➕ إضافة دفعة</button>
      </div>
    </div>
  `;

  let detailsModal = document.getElementById('studentPaymentDetailsModal');
  if (!detailsModal) {
    detailsModal = document.createElement('div');
    detailsModal.id = 'studentPaymentDetailsModal';
    detailsModal.className = 'modal';
    detailsModal.style.cssText = 'display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.5);';
    document.body.appendChild(detailsModal);
  }

  detailsModal.innerHTML = `
    <div class="modal-content" style="width: 90%; max-width: 700px; max-height: 80vh; overflow-y: auto; background: var(--bg-card); border-radius: 12px; box-shadow: var(--shadow-lg), 0 0 30px rgba(59, 130, 246, 0.2); border: 1px solid rgba(148, 163, 184, 0.1);">
      ${detailsHTML}
    </div>
  `;
  detailsModal.style.display = 'flex';

  detailsModal.onclick = (e) => {
    if (e.target === detailsModal) closeStudentPaymentDetails();
  };
}

function closeStudentPaymentDetails() {
  const modal = document.getElementById('studentPaymentDetailsModal');
  if (modal) {
    modal.style.display = 'none';
  }
}

function showAddPaymentModalForStudent(studentId, courseId) {
  closeStudentPaymentDetails();
  
  const student = (window.students || []).find(s => s.id === studentId);
  const course = (window.courses || []).find(c => c.id === courseId);
  
  showAddPaymentModal();
  
  // Safely set pre-filled values (modal or elements may be missing)
  const paymentStudentEl = document.getElementById('paymentStudent');
  const paymentCourseEl = document.getElementById('paymentCourse');
  // the form uses `paymentCoursePrice` to display course price; fall back to `totalAmount` if present
  const paymentCoursePriceEl = document.getElementById('paymentCoursePrice') || document.getElementById('totalAmount');
  const paymentDateEl = document.getElementById('paymentDate');

  if (paymentStudentEl) {
    paymentStudentEl.value = studentId;
    // update courses dropdown based on the selected student
    if (typeof updatePaymentCourses === 'function') updatePaymentCourses();
  }

  if (paymentCourseEl) {
    paymentCourseEl.value = courseId;
  }

  if (paymentCoursePriceEl) {
    paymentCoursePriceEl.value = course?.price || 0;
  }

  if (paymentDateEl) {
    paymentDateEl.valueAsDate = new Date();
  }

  // Ensure calculated fields update (already-paid, remaining, etc.)
  if (typeof updatePaymentAmount === 'function') updatePaymentAmount();
}

function exportAllPaymentsExcel() {
  try {
    const data = (window.payments || []).map((p, idx) => {
      const student = (window.students || []).find(s => s.id === p.student_id);
      const course = (window.courses || []).find(c => c.id === p.course_id);
      return {
        '#': idx + 1,
        'اسم الطالب': student?.full_name || '-',
        'اسم الكورس': course?.name || '-',
        'المبلغ': formatCurrency(p.amount || 0),
        'طريقة الدفع': getPaymentMethodLabel(p.payment_method),
        'تاريخ الدفع': formatDate(p.payment_date),
        'الحالة': p.status === 'paid' ? '✓ مدفوع' : '⏳ قيد الانتظار'
      };
    });

    const ws = XLSX.utils.json_to_sheet(data);
    ws.A1.s = { font: { bold: true }, fill: { fgColor: { rgb: "FFD700" } } };
    
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'الدفعات');
    XLSX.writeFile(wb, `الدفعات_${new Date().toLocaleDateString('ar-EG')}.xlsx`);
    
    showStatus('✅ تم تصدير البيانات بنجاح', 'success');
  } catch (error) {
    console.error('❌ Error exporting payments:', error);
    showStatus('خطأ في التصدير', 'error');
  }
}

function printAllPayments() {
  try {
    const printContent = document.querySelector('#coursesPaymentsWrapper');
    
    if (!printContent) {
      showStatus('لا توجد بيانات للطباعة', 'error');
      return;
    }

    const printWindow = window.open('', '', 'height=600,width=1000');
    printWindow.document.write(`
      <html>
        <head>
          <title>تقرير الدفعات</title>
          <meta charset="UTF-8">
          <style>
            body { 
              font-family: 'Arial', sans-serif; 
              direction: rtl; 
              padding: 20px;
              background: #f5f5f5;
            }
            .header {
              text-align: center;
              margin-bottom: 20px;
              border-bottom: 3px solid #333;
              padding-bottom: 10px;
            }
            .header h2 {
              margin: 0;
              color: #333;
            }
            .header p {
              margin: 5px 0 0 0;
              color: #666;
              font-size: 0.9em;
            }
            table { 
              border-collapse: collapse; 
              width: 100%; 
              margin-top: 20px;
              background: white;
            }
            th, td { 
              border: 1px solid #ddd; 
              padding: 12px; 
              text-align: right; 
            }
            th { 
              background-color: var(--primary); 
              color: white;
              font-weight: bold;
            }
            tr:nth-child(even) {
              background-color: #f9f9f9;
            }
            tr:hover {
              background-color: #f0f0f0;
            }
            .footer {
              margin-top: 20px;
              text-align: center;
              color: #666;
              font-size: 0.85em;
            }
            .course-header {
              background: var(--primary);
              color: white;
              padding: 10px;
              font-weight: bold;
              margin-top: 15px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>تقرير الدفعات</h2>
            <p>تاريخ الطباعة: ${new Date().toLocaleDateString('ar-EG')}</p>
          </div>
          ${printContent.innerHTML}
          <div class="footer">
            <p>تم إنشاء هذا التقرير من نظام إدارة الأكاديمية</p>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  } catch (error) {
    console.error('❌ Error printing payments:', error);
    showStatus('خطأ في الطباعة', 'error');
  }
}

function getPaymentStatusColor(status) {
  const colors = {
    'paid': 'var(--success)',
    'pending': 'var(--warning)',
    'failed': 'var(--danger)'
  };
  return colors[status] || 'var(--gray)';
}

function getPaymentMethodLabel(method) {
  const labels = {
    'cash': 'نقداً',
    'card': 'بطاقة',
    'transfer': 'تحويل',
    'online': 'أونلاين',
    'bank_transfer': 'تحويل بنكي'
  };
  return labels[method] || method;
}


// ====================================================================
// SHOW PAYMENT RECEIPT AFTER SAVE - عرض فاتورة بعد الحفظ
// ====================================================================
function showPaymentReceiptAfterSave(paymentData) {
  try {
    const student = (window.students || []).find(s => s.id === paymentData.student_id);
    const course = (window.courses || []).find(c => c.id === paymentData.course_id);
    
    if (!student || !course) {
      console.error('❌ Student or course not found');
      return;
    }

    const modal = document.getElementById('paymentReceiptModal');
    if (!modal) {
      console.error('❌ Payment receipt modal not found');
      return;
    }

    const receiptContent = document.getElementById('paymentReceiptContent');
    if (!receiptContent) return;

    // حساب المتبقي
    const allPayments = (window.payments || []).filter(p => 
      p.student_id === paymentData.student_id && 
      p.course_id === paymentData.course_id &&
      p.status === 'paid'
    );
    const totalPaid = allPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
    const remaining = Math.max(0, (course.price || 0) - totalPaid);

    receiptContent.innerHTML = `
      <div style="text-align: center; padding: 30px; background: var(--primary); color: white; border-radius: var(--radius-md) var(--radius-md) 0 0;">
        <h2 style="margin: 0; font-size: 2em; font-weight: 600;">🧾 إيصال دفع</h2>
        <p style="margin: 10px 0 0 0; opacity: 0.95; font-size: 0.95em;">رقم الإيصال: ${paymentData.id.substring(0, 8).toUpperCase()}</p>
      </div>

      <div style="padding: 30px; background: white;">
        <!-- معلومات الطالب -->
        <div style="background: var(--primary-light); padding: 20px; border-radius: var(--radius-md); margin-bottom: 20px; border-right: 4px solid var(--primary);">
          <h3 style="margin: 0 0 15px 0; color: var(--primary); font-size: 1.2em; font-weight: 600;">👤 بيانات الطالب</h3>
          <div style="display: grid; gap: 10px;">
            <div style="display: flex; justify-content: space-between;">
              <span style="color: #666;">الاسم:</span>
              <strong style="color: #333;">${escapeHtml(student.full_name)}</strong>
            </div>
            ${student.phone ? `
              <div style="display: flex; justify-content: space-between;">
                <span style="color: #666;">الهاتف:</span>
                <strong style="color: #333;">${escapeHtml(student.phone)}</strong>
              </div>
            ` : ''}
            ${student.email ? `
              <div style="display: flex; justify-content: space-between;">
                <span style="color: #666;">البريد:</span>
                <strong style="color: #333;">${escapeHtml(student.email)}</strong>
              </div>
            ` : ''}
          </div>
        </div>

        <!-- معلومات الكورس -->
        <div style="background: var(--primary-light); padding: 20px; border-radius: var(--radius-md); margin-bottom: 20px; border-right: 4px solid var(--primary);">
          <h3 style="margin: 0 0 15px 0; color: var(--primary); font-size: 1.2em; font-weight: 600;">📚 بيانات الكورس</h3>
          <div style="display: grid; gap: 10px;">
            <div style="display: flex; justify-content: space-between;">
              <span style="color: #666;">اسم الكورس:</span>
              <strong style="color: #333;">${escapeHtml(course.name)}</strong>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: #666;">سعر الكورس:</span>
              <strong style="color: var(--primary); font-size: 1.1em;">${formatCurrency(course.price || 0)}</strong>
            </div>
          </div>
        </div>

        <!-- تفاصيل الدفعة -->
        <div style="background: var(--secondary-light); padding: 20px; border-radius: var(--radius-md); margin-bottom: 20px; border-right: 4px solid var(--success);">
          <h3 style="margin: 0 0 15px 0; color: var(--success); font-size: 1.2em; font-weight: 600;">💰 تفاصيل الدفعة</h3>
          <div style="display: grid; gap: 10px;">
            <div style="display: flex; justify-content: space-between;">
              <span style="color: var(--text-secondary);">المبلغ المدفوع:</span>
              <strong style="color: var(--success); font-size: 1.3em;">${formatCurrency(paymentData.amount)}</strong>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: #666;">طريقة الدفع:</span>
              <strong style="color: #333;">${getPaymentMethodLabel(paymentData.payment_method)}</strong>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: #666;">تاريخ الدفع:</span>
              <strong style="color: #333;">${formatDate(paymentData.payment_date)}</strong>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: var(--text-secondary);">الحالة:</span>
              <span style="background: ${paymentData.status === 'paid' ? 'var(--secondary-light)' : '#FFF3CD'}; color: ${paymentData.status === 'paid' ? 'var(--success)' : 'var(--warning)'}; padding: 6px 12px; border-radius: var(--radius-sm); font-weight: 600; font-size: 0.9em; border: 1px solid ${paymentData.status === 'paid' ? 'var(--success)' : 'var(--warning)'};">
                ${paymentData.status === 'paid' ? '✓ مدفوع' : '⏳ معلق'}
              </span>
            </div>
          </div>
        </div>

        <!-- ملخص مالي -->
        <div style="background: #FFF8E1; padding: 20px; border-radius: var(--radius-md); border-right: 4px solid var(--warning);">
          <h3 style="margin: 0 0 15px 0; color: var(--warning); font-size: 1.2em; font-weight: 600;">📊 الملخص المالي</h3>
          <div style="display: grid; gap: 10px;">
            <div style="display: flex; justify-content: space-between;">
              <span style="color: var(--text-secondary);">إجمالي المدفوع حتى الآن:</span>
              <strong style="color: var(--success); font-size: 1.1em;">${formatCurrency(totalPaid)}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; padding-top: 10px; border-top: 2px dashed var(--warning);">
              <span style="color: var(--text-secondary); font-weight: 600;">المتبقي:</span>
              <strong style="color: ${remaining > 0 ? 'var(--danger)' : 'var(--success)'}; font-size: 1.3em;">
                ${formatCurrency(remaining)}
              </strong>
            </div>
            ${remaining <= 0 ? `
              <div style="text-align: center; margin-top: 10px; padding: 12px; background: var(--secondary-light); border-radius: var(--radius-sm); border: 1px solid var(--success);">
                <span style="color: var(--success); font-weight: 700; font-size: 1.1em;">
                  ✅ تم سداد كامل المبلغ - بارك الله فيكم
                </span>
              </div>
            ` : ''}
          </div>
        </div>

        <!-- ملاحظات إضافية -->
        <div style="margin-top: 20px; padding: 15px; background: var(--bg-light); border-radius: var(--radius-md); text-align: center; border: 1px solid var(--border);">
          <p style="margin: 0; color: var(--text-secondary); font-size: 0.9em;">
            نشكركم على ثقتكم بنا 🌟
          </p>
          <p style="margin: 5px 0 0 0; color: var(--text-light); font-size: 0.85em;">
            تاريخ الإصدار: ${new Date().toLocaleString('ar-EG', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </p>
        </div>
      </div>
    `;

    modal.style.display = 'flex';
    
    // تخزين ID الدفعة الحالية للطباعة
    window.currentReceiptPaymentId = paymentData.id;
    
  } catch (error) {
    console.error('❌ Error showing payment receipt:', error);
  }
}

// ====================================================================
// PRINT PAYMENT RECEIPT - طباعة فاتورة الدفع
// ====================================================================
function printPaymentReceipt(paymentId = null) {
  try {
    // استخدام الـ ID المخزن أو المُمرر
    const targetPaymentId = paymentId || window.currentReceiptPaymentId;
    
    if (!targetPaymentId) {
      showStatus('خطأ: لم يتم العثور على الدفعة', 'error');
      return;
    }

    const payment = (window.payments || []).find(p => p.id === targetPaymentId);
    if (!payment) {
      showStatus('خطأ: لم يتم العثور على بيانات الدفعة', 'error');
      return;
    }

    const student = (window.students || []).find(s => s.id === payment.student_id);
    const course = (window.courses || []).find(c => c.id === payment.course_id);

    if (!student || !course) {
      showStatus('خطأ: بيانات غير مكتملة', 'error');
      return;
    }

    // حساب المتبقي
    const allPayments = (window.payments || []).filter(p => 
      p.student_id === payment.student_id && 
      p.course_id === payment.course_id &&
      p.status === 'paid'
    );
    const totalPaid = allPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
    const remaining = Math.max(0, (course.price || 0) - totalPaid);

    // إنشاء نافذة الطباعة
    const printWindow = window.open('', '', 'height=700,width=600');
    
    printWindow.document.write(`
      <html dir="rtl">
        <head>
          <title>إيصال دفع - ${student.full_name}</title>
          <meta charset="UTF-8">
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            
            body {
              font-family: 'Tajawal', 'Arial', sans-serif;
              direction: rtl;
              padding: 20px;
              background: white;
            }
            
            .receipt {
              max-width: 600px;
              margin: 0 auto;
              border: 2px solid var(--primary);
              border-radius: 12px;
              overflow: hidden;
            }
            
            .header {
              background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%);
              color: white;
              padding: 30px;
              text-align: center;
            }
            
            .header h1 {
              margin: 0;
              font-size: 2em;
            }
            
            .header p {
              margin: 10px 0 0 0;
              opacity: 0.9;
            }
            
            .content {
              padding: 30px;
            }
            
            .section {
              margin-bottom: 25px;
              padding: 20px;
              border-radius: 8px;
            }
            
            .section h3 {
              margin: 0 0 15px 0;
              font-size: 1.2em;
            }
            
            .info-row {
              display: flex;
              justify-content: space-between;
              padding: 8px 0;
              border-bottom: 1px dashed #ddd;
            }
            
            .info-row:last-child {
              border-bottom: none;
            }
            
            .label {
              color: #666;
            }
            
            .value {
              font-weight: bold;
              color: #333;
            }
            
            .highlight {
              font-size: 1.3em;
              color: #4caf50;
            }
            
            .remaining {
              font-size: 1.3em;
              color: #ef4444;
            }
            
            .completed {
              color: #4caf50 !important;
            }
            
            .footer {
              text-align: center;
              padding: 20px;
              background: #f9f9f9;
              color: #666;
              font-size: 0.9em;
            }
            
            @media print {
              body {
                padding: 0;
              }
              .receipt {
                border: none;
              }
            }
          </style>
        </head>
        <body>
          <div class="receipt">
            <div class="header">
              <h1>🧾 إيصال دفع</h1>
              <p>رقم الإيصال: ${payment.id.substring(0, 8).toUpperCase()}</p>
            </div>
            
            <div class="content">
              <!-- بيانات الطالب -->
              <div class="section" style="background: #f0f7ff; border-right: 4px solid #2196f3;">
                <h3 style="color: #2196f3;">👤 بيانات الطالب</h3>
                <div class="info-row">
                  <span class="label">الاسم:</span>
                  <span class="value">${escapeHtml(student.full_name)}</span>
                </div>
                ${student.phone ? `
                  <div class="info-row">
                    <span class="label">الهاتف:</span>
                    <span class="value">${escapeHtml(student.phone)}</span>
                  </div>
                ` : ''}
              </div>
              
              <!-- بيانات الكورس -->
              <div class="section" style="background: #f3e5f5; border-right: 4px solid var(--primary);">
                <h3 style="color: var(--primary);">📚 بيانات الكورس</h3>
                <div class="info-row">
                  <span class="label">اسم الكورس:</span>
                  <span class="value">${escapeHtml(course.name)}</span>
                </div>
                <div class="info-row">
                  <span class="label">سعر الكورس:</span>
                  <span class="value" style="color: var(--primary);">${formatCurrency(course.price || 0)}</span>
                </div>
              </div>
              
              <!-- تفاصيل الدفعة -->
              <div class="section" style="background: #e8f5e9; border-right: 4px solid #4caf50;">
                <h3 style="color: #4caf50;">💰 تفاصيل الدفعة</h3>
                <div class="info-row">
                  <span class="label">المبلغ المدفوع:</span>
                  <span class="value highlight">${formatCurrency(payment.amount)}</span>
                </div>
                <div class="info-row">
                  <span class="label">طريقة الدفع:</span>
                  <span class="value">${getPaymentMethodLabel(payment.payment_method)}</span>
                </div>
                <div class="info-row">
                  <span class="label">تاريخ الدفع:</span>
                  <span class="value">${formatDate(payment.payment_date)}</span>
                </div>
              </div>
              
              <!-- الملخص المالي -->
              <div class="section" style="background: #fff3e0; border-right: 4px solid #ff9800;">
                <h3 style="color: #ff9800;">📊 الملخص المالي</h3>
                <div class="info-row">
                  <span class="label">إجمالي المدفوع:</span>
                  <span class="value" style="color: #4caf50;">${formatCurrency(totalPaid)}</span>
                </div>
                <div class="info-row">
                  <span class="label">المتبقي:</span>
                  <span class="value ${remaining <= 0 ? 'completed' : 'remaining'}">
                    ${formatCurrency(remaining)}
                  </span>
                </div>
                ${remaining <= 0 ? `
                  <div style="text-align: center; margin-top: 15px; padding: 10px; background: #d1fae5; border-radius: 6px;">
                    <strong style="color: #059669;">✅ تم سداد كامل المبلغ</strong>
                  </div>
                ` : ''}
              </div>
            </div>
            
            <div class="footer">
              <p>نشكركم على ثقتكم بنا 🌟</p>
              <p style="margin-top: 10px;">
                تاريخ الإصدار: ${new Date().toLocaleString('ar-EG', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </p>
            </div>
          </div>
        </body>
      </html>
    `);
    
    printWindow.document.close();
    printWindow.focus();
    
    setTimeout(() => {
      printWindow.print();
    }, 250);
    
  } catch (error) {
    console.error('❌ Error printing receipt:', error);
    showStatus('خطأ في طباعة الفاتورة', 'error');
  }
}